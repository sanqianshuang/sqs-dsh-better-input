#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Release sqs-dsh-better-input: verify -> bump -> commit -> npm publish -> git push.

Why a script instead of a checklist: a release has to move four things that only
stay correct together - the version in package.json, the built lib/ that npm
actually ships, the registry, and the git history. Done by hand they drift, and
they did: the registry sat at 0.2.0-rc.2-sqs.1 while the tree was already at
sqs.4, and the sqs.4 release commit had never been pushed.

Typical use, from anywhere:

    python scripts/publish.py --bump sqs -m "release: 0.2.0-rc.2-sqs.5 —— 修复 …"
    python scripts/publish.py --dry-run          # plan + tarball, no mutation
    python scripts/publish.py --no-publish --no-verify   # commit + push only
    python scripts/publish.py --bump sqs --no-verify

The npm token is read from --token, $NPM_TOKEN / $NODE_AUTH_TOKEN, or the token
file (default: ../npm.txt next to this repository). It is written into a
throwaway .npmrc inside a temp directory that is removed on exit, so it never
reaches the repository, the user's ~/.npmrc, or shell history.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import textwrap
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PKG_PATH = REPO / "package.json"
README_PATH = REPO / "README.md"
CHANGELOG_PATH = REPO / "CHANGELOG.md"
DEFAULT_REGISTRY = "https://registry.npmjs.org/"
DEFAULT_REMOTE = "origin"
DEFAULT_TOKEN_FILE = REPO.parent / "npm.txt"
CORE_RE = re.compile(r"^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$")
README_VERSION_RE = re.compile(r"(当前版本\s*\*\*`)([^`]+)(`\*\*)")

# --------------------------------------------------------------------------- #
# console
# --------------------------------------------------------------------------- #

for _stream in (sys.stdout, sys.stderr):
    # Piped output on Windows falls back to the ANSI codepage (gbk) and mangles
    # the Chinese messages; a real console already reports utf-8.
    try:
        if hasattr(_stream, "reconfigure") and (_stream.encoding or "").lower() not in ("utf-8", "utf8"):
            _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:  # pragma: no cover - never fail a release over console setup
        pass


def say(msg: str = "") -> None:
    print(msg, flush=True)


def step(msg: str) -> None:
    say(f"\n==> {msg}")


def info(msg: str) -> None:
    say(f"    {msg}")


def warn(msg: str) -> None:
    say(f"    ! {msg}")


def die(msg: str, code: int = 1) -> None:
    say("")
    print(f"xx {msg}", file=sys.stderr, flush=True)
    raise SystemExit(code)


def redact(text: str) -> str:
    """Keep tokens out of echoed commands."""
    text = re.sub(r"(x-access-token:)[^@\s]+@", r"\1***@", text)
    text = re.sub(r"(npm_)[A-Za-z0-9_\-]{8,}", r"\1***", text)
    return text


# --------------------------------------------------------------------------- #
# processes
# --------------------------------------------------------------------------- #


def _flat(cmd) -> str:
    return " ".join(str(c) for c in cmd)


def run(cmd, *, env=None, dry: bool = False) -> int:
    """Stream a command so long output stays visible; abort on non-zero."""
    info(f"$ {redact(_flat(cmd))}")
    if dry:
        return 0
    rc = subprocess.run([str(c) for c in cmd], cwd=str(REPO), env=env).returncode
    if rc != 0:
        die(f"命令失败（exit {rc}）：{redact(_flat(cmd))}")
    return rc


def capture(cmd, *, check: bool = True):
    """Run a command in the repository and return (returncode, stdout)."""
    p = subprocess.run(
        [str(c) for c in cmd],
        cwd=str(REPO),
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
    )
    out = (p.stdout or "") + (p.stderr or "")
    if p.returncode != 0 and check:
        if out.strip():
            say(textwrap.indent(out.rstrip(), "    "))
        die(f"命令失败（exit {p.returncode}）：{redact(_flat(cmd))}")
    return p.returncode, out


def find_npm() -> str:
    candidates = ["npm.cmd", "npm.exe", "npm"] if os.name == "nt" else ["npm"]
    for name in candidates:
        path = shutil.which(name)
        if not path:
            continue
        # On Windows an extensionless `npm` is the bash shim; CreateProcess cannot run it.
        if os.name == "nt" and not path.lower().endswith((".cmd", ".exe", ".bat")):
            continue
        return path
    node = shutil.which("node.exe") or shutil.which("node")
    if os.name == "nt" and node:
        shim = Path(node).parent / "npm.cmd"
        if shim.exists():
            return str(shim)
    die("找不到 npm —— 请先安装 Node.js 并确保它在 PATH 上。")


# --------------------------------------------------------------------------- #
# git
# --------------------------------------------------------------------------- #


def git(*args, check: bool = True):
    return capture(["git", *args], check=check)


def git_dirty() -> list:
    _, out = git("status", "--porcelain")
    return [line.rstrip() for line in out.splitlines() if line.strip()]


def git_branch() -> str:
    _, out = git("rev-parse", "--abbrev-ref", "HEAD")
    return out.strip()


def git_head() -> str:
    _, out = git("rev-parse", "--short", "HEAD")
    return out.strip()


def git_staged() -> bool:
    rc, _ = git("diff", "--cached", "--quiet", check=False)
    return rc != 0


def git_remote_url(remote: str) -> str:
    rc, out = git("remote", "get-url", remote, check=False)
    return out.strip() if rc == 0 else ""


# --------------------------------------------------------------------------- #
# package.json / versions
# --------------------------------------------------------------------------- #


def read_pkg() -> dict:
    if not PKG_PATH.exists():
        die(f"找不到 {PKG_PATH}")
    return json.loads(PKG_PATH.read_text(encoding="utf-8"))


def write_text(path: Path, text: str) -> None:
    with open(path, "w", encoding="utf-8", newline="") as fh:  # LF everywhere
        fh.write(text)


def set_version_in_pkg(new_version: str, dry: bool) -> None:
    text = PKG_PATH.read_text(encoding="utf-8")
    new_text, hits = re.subn(
        r'("version"\s*:\s*")[^"]*(")',
        lambda m: m.group(1) + new_version + m.group(2),
        text,
        count=1,
    )
    if hits != 1:
        die('package.json 里找不到唯一的 "version" 字段。')
    if not dry:
        write_text(PKG_PATH, new_text)


def rewrite_readme_version(old: str, new: str, dry: bool) -> tuple:
    """The README pins the current version in prose and is shipped on npm.

    Two passes: the prose pin (`当前版本 **\\`x\\`**`), which also repairs a pin that
    had already gone stale, then any remaining literal mention of the old version.
    """
    text = README_PATH.read_text(encoding="utf-8")
    pinned, pins = README_VERSION_RE.subn(lambda m: m.group(1) + new + m.group(3), text)
    literals = pinned.count(old)
    if literals:
        pinned = pinned.replace(old, new)
    if (pins or literals) and not dry:
        write_text(README_PATH, pinned)
    return pins, literals


def _core(version: str, where: str) -> "re.Match":
    m = CORE_RE.fullmatch(version)
    if not m:
        die(f"{where}不是合法的 semver：{version}")
    return m


def bump_sqs(version: str) -> str:
    """0.2.0-rc.2-sqs.4 -> 0.2.0-rc.2-sqs.5: the convention this repo publishes with."""
    m = _core(version, "当前版本 ")
    core = f"{m.group(1)}.{m.group(2)}.{m.group(3)}"
    pre = m.group(4) or ""
    trail = re.fullmatch(r"(?:(.*)-)?sqs\.(\d+)", pre)
    if trail:
        base, n = trail.group(1), int(trail.group(2))
        new_pre = f"{base}-sqs.{n + 1}" if base else f"sqs.{n + 1}"
    else:
        new_pre = f"{pre}-sqs.1" if pre else "sqs.1"
    return f"{core}-{new_pre}"


def bump_numeric(version: str, part: str) -> str:
    m = _core(version, "当前版本 ")
    major, minor, patch = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if part == "major":
        major, minor, patch = major + 1, 0, 0
    elif part == "minor":
        minor, patch = minor + 1, 0
    else:
        patch += 1
    return f"{major}.{minor}.{patch}"


def version_from_dsh_base(base: str) -> str:
    _core(base, "--dsh-base ")
    if "-sqs." in base:
        die("--dsh-base 只需要 dsh 主线版本（例如 0.2.0-rc.3），不要带 -sqs.N。")
    return f"{base}-sqs.1"


# --------------------------------------------------------------------------- #
# npm registry
# --------------------------------------------------------------------------- #


def _json(url: str, timeout: int = 20):
    req = urllib.request.Request(
        url, headers={"Accept": "application/json", "User-Agent": "sqs-publish"}
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8", "replace"))


def version_exists(registry: str, name: str, version: str) -> bool:
    url = f"{registry.rstrip('/')}/{urllib.parse.quote(name, safe='')}/{version}"
    try:
        with urllib.request.urlopen(
            urllib.request.Request(
                url, headers={"Accept": "application/json", "User-Agent": "sqs-publish"}
            ),
            timeout=20,
        ) as resp:
            return resp.status == 200
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return False
        die(f"查询 registry 失败（HTTP {exc.code}）：{url}")
    except OSError as exc:
        die(f"查询 registry 失败（{exc}）：{url}\n    网络不通时可用 --skip-registry-check 跳过该检查。")
    return False


def dist_tags(registry: str, name: str) -> dict:
    url = f"{registry.rstrip('/')}/-/package/{urllib.parse.quote(name, safe='')}/dist-tags"
    try:
        return _json(url)
    except (urllib.error.HTTPError, OSError):
        return {}


def wait_for_version(registry: str, name: str, version: str, timeout: int) -> bool:
    """The registry accepts a publish asynchronously; the read side lags by minutes."""
    deadline = time.time() + timeout
    announced = False
    while True:
        if version_exists(registry, name, version):
            return True
        if time.time() >= deadline:
            return False
        if not announced:
            info("registry 异步接收发布，新版本可能要几分钟才可读 —— 正在等待 …")
            announced = True
        time.sleep(8)


# --------------------------------------------------------------------------- #
# cli
# --------------------------------------------------------------------------- #


def parse_args(argv):
    p = argparse.ArgumentParser(
        prog="publish.py",
        description="校验 → 升版本 → 提交 → 发布 npm → 推送 GitHub",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent(
            """\
            示例:
              python scripts/publish.py --bump sqs -m "release: … —— 修了什么"
              python scripts/publish.py --dry-run                      # 只演练，零改动
              python scripts/publish.py --no-publish --no-verify        # 只提交并推送
              python scripts/publish.py --dsh-base 0.2.0-rc.3           # 换 dsh 主线基线
            """
        ),
    )
    bump = p.add_mutually_exclusive_group()
    bump.add_argument(
        "--bump",
        choices=("sqs", "patch", "minor", "major"),
        help="sqs＝末尾 -sqs.N 加一（本仓库默认用法）；patch/minor/major＝数值升级并丢弃预发布后缀",
    )
    bump.add_argument(
        "--dsh-base", metavar="X.Y.Z[-pre]", help="换 dsh 主线版本，版本号重置为 <base>-sqs.1"
    )
    bump.add_argument("--set-version", metavar="VERSION", help="显式指定版本号")

    p.add_argument("--tag", metavar="TAG", help="npm dist-tag（默认：预发布用 next，正式版用 latest）")
    p.add_argument(
        "--also-latest",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="标签不是 latest 时，发布后同时把 latest 指向本次版本（默认开）",
    )
    p.add_argument("--registry", default=DEFAULT_REGISTRY, help=f"npm registry（默认 {DEFAULT_REGISTRY}）")
    p.add_argument("--token", help="npm 发布令牌（默认取 $NPM_TOKEN 或令牌文件）")
    p.add_argument("--token-file", metavar="PATH", help=f"令牌文件（默认 {DEFAULT_TOKEN_FILE}）")
    p.add_argument("--remote", default=DEFAULT_REMOTE, help=f"git remote（默认 {DEFAULT_REMOTE}）")
    p.add_argument("-m", "--message", metavar="MSG", help="release 提交信息（默认 release: <version>）")

    p.add_argument("--no-verify", action="store_true", help="跳过 npm run verify（仍会构建）")
    p.add_argument("--no-build", action="store_true", help="连构建也跳过，直接发已提交的 lib/")
    p.add_argument("--no-commit", action="store_true", help="不创建 release 提交（要求工作区干净）")
    p.add_argument("--no-publish", action="store_true", help="不发布到 npm，只提交/推送")
    p.add_argument("--no-push", action="store_true", help="不推送到远端")
    p.add_argument("--skip-registry-check", action="store_true", help="跳过「版本是否已发布」的预检")
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="演练：不写文件、不构建、不提交、不推送；npm publish 加 --dry-run",
    )
    p.add_argument("-y", "--yes", action="store_true", help="非交互确认（工作区有改动时必需）")
    p.add_argument("--keep-temp", action="store_true", help="保留临时目录（排查用）")
    p.add_argument(
        "--wait",
        type=int,
        default=180,
        metavar="SECONDS",
        help="发布后等待 registry 可读的秒数（默认 180，0＝不等）",
    )
    return p.parse_args(argv)


def confirm(question: str, assume_yes: bool) -> bool:
    if assume_yes:
        return True
    if not sys.stdin.isatty():
        die(f"{question}\n    非交互环境：确认请加 --yes。")
    try:
        return input(f"    {question} [y/N] ").strip().lower() in ("y", "yes", "是", "确认")
    except EOFError:
        return False


# --------------------------------------------------------------------------- #
# steps
# --------------------------------------------------------------------------- #


def resolve_token(args) -> str:
    if args.token:
        return args.token.strip()
    for var in ("NPM_TOKEN", "NODE_AUTH_TOKEN", "NPM_AUTH_TOKEN"):
        value = os.environ.get(var)
        if value:
            return value.strip()
    token_file = Path(args.token_file) if args.token_file else DEFAULT_TOKEN_FILE
    if token_file.exists():
        for line in token_file.read_text(encoding="utf-8", errors="replace").splitlines():
            m = re.search(r"(?:token|_authToken)\s*[:=]\s*(\S+)", line, re.I)
            if m:
                return m.group(1)
            m = re.fullmatch(r"\s*(npm_\S+)\s*", line)
            if m:
                return m.group(1)
        warn(f"{token_file} 里没找到令牌（期望 `token: npm_…` 或单独一行 npm_…）。")
    return ""


def build_npm_env(args, tmpdir: Path, token: str):
    """npm runs entirely inside the temp dir: nothing lands in ~/.npm or the repo."""
    env = os.environ.copy()
    env["npm_config_registry"] = args.registry
    env["npm_config_cache"] = str(tmpdir / "npm-cache")
    env["npm_config_logs_dir"] = str(tmpdir / "npm-logs")
    env["npm_config_fund"] = "false"
    env["npm_config_audit"] = "false"
    env["TEMP"] = env["TMP"] = str(tmpdir / "tmp")
    for path in (tmpdir / "npm-cache", tmpdir / "npm-logs", tmpdir / "tmp"):
        path.mkdir(parents=True, exist_ok=True)
    if token:
        netloc = urllib.parse.urlparse(args.registry).netloc
        write_text(
            tmpdir / ".npmrc",
            f"registry={args.registry}\n//{netloc}/:_authToken={token}\n",
        )
        env["npm_config_userconfig"] = str(tmpdir / ".npmrc")
    return env


def do_build(npm: str, env, args, dry: bool) -> None:
    if args.no_build:
        warn("按 --no-build 跳过构建：发布的是已提交的 lib/。")
        return
    if not (REPO / "node_modules").exists():
        die("缺少 node_modules —— 先运行：npm install --legacy-peer-deps")
    if args.no_verify:
        step("构建")
        run([npm, "run", "build"], env=env, dry=dry)
        return
    step("校验 + 构建")
    run([npm, "run", "verify"], env=env, dry=dry)


def do_commit(args, message: str, branch: str, dry: bool) -> None:
    if args.no_commit:
        return
    step(f"提交 release（{branch}）")
    if dry:
        info(f"$ git add -A && git commit -m {message}")
        return
    git("add", "-A")
    if not git_staged():
        warn("没有需要提交的改动 —— 跳过提交。")
        return
    _, stat = git("diff", "--cached", "--stat")
    say(textwrap.indent(stat.rstrip(), "    "))
    git("commit", "-m", message)


def do_publish(npm: str, env, args, name: str, version: str, tag: str, dry: bool) -> None:
    step(f"发布 {name}@{version}（tag: {tag}）")
    cmd = [
        npm,
        "publish",
        "--ignore-scripts",
        "--tag",
        tag,
        "--registry",
        args.registry,
        "--access",
        "public",
    ]
    if dry:
        cmd.append("--dry-run")
    run(cmd, env=env)
    if dry:
        return
    if tag != "latest" and args.also_latest:
        run([npm, "dist-tag", "add", f"{name}@{version}", "latest", "--registry", args.registry], env=env)


def do_push(args, branch: str, dry: bool) -> None:
    step(f"推送到 {args.remote}（{branch}）")
    cmd = ["git", "push"]
    if dry:
        cmd.append("--dry-run")
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN") or ""
    url = git_remote_url(args.remote)
    if token and url.startswith("https://github.com/"):
        # Single command; the token never lands in .git/config.
        auth = url.replace("https://", f"https://x-access-token:{token}@", 1)
        run([*cmd, auth, f"HEAD:{branch}"])
    else:
        run([*cmd, args.remote, f"HEAD:{branch}"])


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #


def main(argv=None) -> int:
    args = parse_args(argv)
    dry = args.dry_run

    step("环境")
    if not shutil.which("git"):
        die("找不到 git —— 提交/推送需要它。")
    npm = find_npm()
    info(f"npm      : {npm}")
    info(f"仓库     : {REPO}")

    pkg = read_pkg()
    name = pkg["name"]
    current = pkg["version"]
    branch = git_branch()
    info(f"分支     : {branch}")

    # --- 目标版本 -----------------------------------------------------------
    target = current
    if args.set_version:
        _core(args.set_version, "--set-version ")
        target = args.set_version
    elif args.dsh_base:
        target = version_from_dsh_base(args.dsh_base)
    elif args.bump == "sqs":
        target = bump_sqs(current)
    elif args.bump:
        target = bump_numeric(current, args.bump)
        warn("数值升级丢掉了预发布后缀；若只是换 dsh 主线版本，请用 --dsh-base。")
    if target != current and args.no_commit:
        die("指定了升版本却又要 --no-commit —— 版本号会改了但不入库，请去掉 --no-commit。")
    info(f"版本     : {current}{'  ->  ' + target if target != current else '（不变）'}")

    # --- 工作区 -------------------------------------------------------------
    dirty = git_dirty()
    step("工作区状态")
    if not dirty:
        info("干净")
    else:
        say(textwrap.indent("\n".join(dirty), "    "))
        if args.no_commit:
            die(f"工作区有 {len(dirty)} 处未提交改动，但指定了 --no-commit；先提交，或去掉 --no-commit。")
        if not dry and not confirm(f"以上 {len(dirty)} 处改动会进入本次 release 提交，继续？", args.yes):
            die("已取消。")

    # --- registry 预检 ------------------------------------------------------
    tag = args.tag or ("next" if re.search(r"-\w", target) else "latest")
    if not args.no_publish:
        step("registry 预检")
        if args.skip_registry_check:
            warn("按 --skip-registry-check 跳过版本占用检查。")
        elif version_exists(args.registry, name, target):
            if dry:
                warn(f"{name}@{target} 已经发布过 —— 正式运行会在这里中止（先 --bump sqs）。")
            else:
                die(
                    f"{name}@{target} 已经发布到 {args.registry}，npm 不允许覆盖已发布版本。\n"
                    '    升级版本号后重试，例如：python scripts/publish.py --bump sqs -m "release: …"'
                )
        else:
            info(f"{name}@{target} 在 {args.registry} 上还不存在 —— 可以发布。")

    tmpdir = Path(tempfile.mkdtemp(prefix="sqs-publish-"))
    try:
        token = "" if args.no_publish else resolve_token(args)
        if not args.no_publish:
            if token:
                info("npm 令牌 : 已获取（写进临时 .npmrc，退出即删）")
            else:
                warn("没找到 npm 令牌：将用本机已登录的 npm 凭据（未登录会在发布时报 ENEEDAUTH）。")
        env = build_npm_env(args, tmpdir, token)

        # --- 升版本 ---------------------------------------------------------
        if target != current:
            step(f"升版本 {current} -> {target}")
            set_version_in_pkg(target, dry)
            pins, literals = rewrite_readme_version(current, target, dry)
            if pins or literals:
                info(f"README 同步：固定行 {pins} 处，其它字面量 {literals} 处。")
            else:
                warn("README 里没有找到版本号固定行，未做同步。")

        # --- 校验 + 构建 ----------------------------------------------------
        do_build(npm, env, args, dry)

        # --- CHANGELOG 提醒 -------------------------------------------------
        step("CHANGELOG 检查")
        changelog = CHANGELOG_PATH.read_text(encoding="utf-8") if CHANGELOG_PATH.exists() else ""
        if re.search(rf"^##\s*\[{re.escape(target)}\]", changelog, re.M):
            info(f"已包含 {target} 的条目。")
        else:
            warn(f"CHANGELOG.md 里没有 `## [{target}]` 条目 —— 建议先补上（脚本不替你写内容）。")

        # --- 提交 -----------------------------------------------------------
        do_commit(args, args.message or f"release: {target}", branch, dry)

        # --- 发布 -----------------------------------------------------------
        if args.no_publish:
            warn("按 --no-publish 跳过 npm 发布。")
        else:
            if dry and target != current:
                warn(f"演练不改 package.json，下面 tarball 预览仍是 {current}；正式运行发的是 {target}。")
            do_publish(npm, env, args, name, target, tag, dry)
            if not dry and args.wait > 0 and not args.skip_registry_check:
                step(f"等待 registry 生效（≤{args.wait}s）")
                if wait_for_version(args.registry, name, target, args.wait):
                    info(f"{name}@{target} 已可读。")
                    tags = dist_tags(args.registry, name)
                    if tags:
                        info("dist-tags: " + ", ".join(f"{k}={v}" for k, v in sorted(tags.items())))
                else:
                    warn(f"等了 {args.wait}s 还没读到 —— registry 可能仍在处理（通常几分钟内会好）。")

        # --- 推送 -----------------------------------------------------------
        if args.no_push:
            warn("按 --no-push 跳过 git 推送。")
        else:
            do_push(args, branch, dry)
    finally:
        if args.keep_temp:
            warn(f"按 --keep-temp 保留临时目录：{tmpdir}")
        else:
            shutil.rmtree(tmpdir, ignore_errors=True)

    # --- 收尾 ---------------------------------------------------------------
    url = git_remote_url(args.remote)
    say("")
    say("=" * 64)
    if dry:
        say("演练完成（--dry-run：文件、registry、git 都没有改动）")
    elif args.no_publish:
        say("提交完成（按 --no-publish 未发布到 npm）")
    else:
        say("发布完成")
    say("=" * 64)
    say(f"  包名     : {name}")
    say(f"  版本     : {target}")
    if args.no_publish:
        say("  npm      : 未发布（--no-publish）")
    else:
        tags = [tag] + (["latest"] if tag != "latest" and args.also_latest else [])
        say(f"  npm 标签 : {', '.join(tags)}")
        say(f"  npm 页面 : https://www.npmjs.com/package/{name}/v/{target}")
    if args.no_push:
        say("  git      : 未推送（--no-push）")
    else:
        say(f"  git      : {git_head()} -> {branch} @ {url or args.remote}")
    say("")
    return 0


if __name__ == "__main__":
    sys.exit(main())
