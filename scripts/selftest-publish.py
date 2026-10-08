#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""End-to-end self test for publish.py, against a local fake npm registry.

Releases are hard to test on the real thing (npm forbids republishing a version
and a mistake is public), so this runs the whole chain against a throwaway copy:
a temp bare remote, a clone of this repository, and a minimal npm-registry API on
127.0.0.1. It releases there with `--no-build` (the clone has no node_modules) and
then asserts registry, git and README state. The real registry and the real
origin are never contacted; the repository itself is only read.

    python scripts/selftest-publish.py
    python scripts/selftest-publish.py --keep      # keep the temp tree for inspection
"""

import json
import re
import shutil
import subprocess
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

REPO = Path(__file__).resolve().parent.parent
PUBLISH = REPO / "scripts" / "publish.py"
PKG = "sqs-dsh-better-input"
OLD = "0.2.0-rc.2-sqs.4"
NEW = "0.2.0-rc.2-sqs.5"
MESSAGE = "release: selftest —— 端到端演练"

for _stream in (sys.stdout, sys.stderr):
    try:
        if hasattr(_stream, "reconfigure") and (_stream.encoding or "").lower() not in ("utf-8", "utf8"):
            _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:  # pragma: no cover
        pass

# --------------------------------------------------------------- fake registry

STATE = {
    "versions": {PKG: ["0.1.0", "0.2.0-rc.2", "0.2.0-rc.2-sqs.1", OLD]},
    "tags": {PKG: {"next": OLD, "latest": OLD}},
}
REQUESTS = []


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):
        pass

    def _send(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _route(self):
        path = unquote(self.path.split("?")[0])
        m = re.fullmatch(r"/-/package/(.+?)/dist-tags(?:/(.+))?", path)
        if m:
            return "dist-tags", m.group(1), m.group(2)
        parts = [p for p in path.strip("/").split("/") if p]
        if len(parts) == 1:
            return "packument", parts[0], None
        if len(parts) == 2:
            return "version", parts[0], parts[1]
        return "unknown", None, None

    def do_GET(self):
        kind, name, extra = self._route()
        REQUESTS.append(("GET", self.path))
        if kind == "packument":
            if name not in STATE["versions"]:
                return self._send(404, {"error": "Not found"})
            return self._send(
                200,
                {
                    "name": name,
                    "dist-tags": STATE["tags"].get(name, {}),
                    "versions": {v: {"name": name, "version": v} for v in STATE["versions"][name]},
                },
            )
        if kind == "version":
            if extra in STATE["versions"].get(name, []):
                return self._send(200, {"name": name, "version": extra})
            return self._send(404, {"error": "version not found"})
        if kind == "dist-tags":
            return self._send(200, STATE["tags"].get(name, {}))
        return self._send(200, {"ok": True})

    def do_PUT(self):
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length).decode("utf-8", "replace")
        kind, name, extra = self._route()
        REQUESTS.append(("PUT", self.path))
        if kind == "packument":
            doc = json.loads(raw)
            name = doc.get("name") or name
            STATE["versions"].setdefault(name, [])
            for version in doc.get("versions", {}):
                if version not in STATE["versions"][name]:
                    STATE["versions"][name].append(version)
            STATE["tags"].setdefault(name, {}).update(doc.get("dist-tags", {}))
            return self._send(201, {"ok": True, "id": name, "rev": "selftest"})
        if kind == "dist-tags":
            STATE["tags"].setdefault(name, {})[extra] = json.loads(raw)
            return self._send(201, {"ok": True})
        return self._send(404, {"error": "unsupported"})


# ------------------------------------------------------------------------ utils


def sh(cmd, cwd=None, check=True):
    p = subprocess.run(
        [str(c) for c in cmd],
        cwd=str(cwd) if cwd else None,
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
    )
    if check and p.returncode != 0:
        print(f"FAIL  {' '.join(map(str, cmd))}\n{p.stdout}\n{p.stderr}")
        raise SystemExit(1)
    return (p.stdout or "").strip()


def main(argv):
    keep = "--keep" in argv
    if not PUBLISH.exists():
        print(f"FAIL  找不到 {PUBLISH}")
        return 1

    real_head = sh(["git", "-C", REPO, "rev-parse", "HEAD"])
    real_status = sh(["git", "-C", REPO, "status", "--porcelain"])

    work_root = Path(tempfile.mkdtemp(prefix="sqs-publish-selftest-"))
    work = work_root / "work"
    remote = work_root / "remote.git"
    print(f"--- 演练目录 {work_root}")
    try:
        # A throwaway remote and clone: the real origin is never a push target.
        (work_root / "npm.txt").write_text(
            f"账号 selftest\n密码 selftest\ntoken: npm_SELFTEST{'0' * 30}\n", encoding="utf-8"
        )
        sh(["git", "init", "--bare", "-q", remote])
        sh(["git", "clone", "--local", "--no-hardlinks", "-q", REPO, work])
        sh(["git", "-C", work, "remote", "set-url", "origin", remote])
        sh(["git", "-C", work, "config", "user.name", "selftest"])
        sh(["git", "-C", work, "config", "user.email", "selftest@example.invalid"])
        sh(["git", "-C", work, "push", "-q", "origin", "HEAD:refs/heads/main"])
        url = sh(["git", "-C", work, "remote", "get-url", "origin"])
        if str(remote) not in url:
            print(f"FAIL  克隆的 origin 不是演练远端：{url}")
            return 1
        shutil.copy2(PUBLISH, work / "scripts" / PUBLISH.name)

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        registry = f"http://127.0.0.1:{server.server_address[1]}/"
        threading.Thread(target=server.serve_forever, daemon=True).start()
        print(f"--- 假 registry {registry}")

        cmd = [
            sys.executable, work / "scripts" / PUBLISH.name,
            "--bump", "sqs", "--no-build", "-y",
            "--registry", registry, "--wait", "20", "-m", MESSAGE,
        ]
        print(f"--- $ {' '.join(str(c) for c in cmd)}\n")
        proc = subprocess.run([str(c) for c in cmd], cwd=str(work), text=True,
                              encoding="utf-8", errors="replace")
        server.shutdown()
        print(f"\n--- release 退出码 {proc.returncode}\n")

        pkg = json.loads((work / "package.json").read_text(encoding="utf-8"))
        pin = re.search(r"当前版本\s*\*\*`([^`]+)`\*\*", (work / "README.md").read_text(encoding="utf-8"))
        failures = []

        def check(label, got, want):
            ok = got == want
            print(f"{'PASS' if ok else 'FAIL'}  {label}" + ("" if ok else f"   got={got!r} want={want!r}"))
            if not ok:
                failures.append(label)

        check("release 退出码为 0", proc.returncode, 0)
        check("package.json 已升版本", pkg["version"], NEW)
        check("README 固定行已同步", pin.group(1) if pin else None, NEW)
        check("release 提交信息", sh(["git", "-C", work, "log", "-1", "--format=%s"]), MESSAGE)
        check("改动已全部提交", sh(["git", "-C", work, "status", "--porcelain"]), "")
        check(
            "已推送到 origin/main",
            sh(["git", "--git-dir", remote, "rev-parse", "main"]),
            sh(["git", "-C", work, "rev-parse", "HEAD"]),
        )
        check("registry 收到新版本", NEW in STATE["versions"][PKG], True)
        check("registry dist-tags", STATE["tags"][PKG], {"next": NEW, "latest": NEW})
        check("真实仓库 HEAD 未变", sh(["git", "-C", REPO, "rev-parse", "HEAD"]), real_head)
        check("真实仓库状态未变", sh(["git", "-C", REPO, "status", "--porcelain"]), real_status)

        print()
        if failures:
            print(f"SELFTEST FAILED: {len(failures)} 项 -> {failures}")
            return 1
        print("SELFTEST OK —— 升版本 / 校验 / 提交 / 发布 / dist-tag / 推送 全链路通过")
        return 0
    finally:
        if keep:
            print(f"--- 已保留演练目录：{work_root}")
        else:
            shutil.rmtree(work_root, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
