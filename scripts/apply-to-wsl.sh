#!/usr/bin/env bash
# =============================================================================
# apply-to-wsl.sh — 把本仓库（Windows 侧工作区）的已修复产物同步进 WSL 的 dsh
#                   profile 安装副本，并重启 dsh web 服务。
#
# 背景（事故 INCIDENT-20260925-typert-model.md）：
#   WSL profile 的 package.json 里依赖是 `file:/mnt/d/project/DeepseekHarness/
#   sanqianshuang-better-input`，pnpm 把它**复制**成实目录
#   /root/.dsh/profiles/web/node_modules/sanqianshuang-better-input。
#   该副本是快照：工作区里重新 build 出的 lib/ 不会自动进去。
#   旧快照的 lib/typert.js 缺 TYPERT.model → typert-loader 拒收 manifest
#   → 内置 typert-loader 自己激活失败 → 整个 Typert 网关无定义
#   → 设置/模型/权限页全部“加载失败”。
#
# 用法（在 WSL 内以 root 跑，或在 Windows 上用 wsl 调用）：
#   bash /mnt/d/project/DeepseekHarness/sanqianshuang-better-input/scripts/apply-to-wsl.sh
#     [--no-restart]   只同步文件，不重启服务
#     [--dry-run]      只打印计划
#
# 幂等：重复执行安全；每次同步前自动留一份 .bak-<ts> 备份。
# =============================================================================
set -u

SRC="${SRC:-/mnt/d/project/DeepseekHarness/sanqianshuang-better-input}"
PROFILE_ROOT="${PROFILE_ROOT:-/root/.dsh/profiles/web}"
DEST="$PROFILE_ROOT/node_modules/sanqianshuang-better-input"
OPS="${DSH_OPS:-/usr/local/bin/dsh-ops.sh}"
WEB_LOG="${WEB_LOG:-/var/log/dsh-web.log}"

RESTART=1
DRY=0
for a in "$@"; do
  case "$a" in
    --no-restart) RESTART=0 ;;
    --dry-run)    DRY=1 ;;
    *) echo "unknown arg: $a" >&2; exit 2 ;;
  esac
done

TS=$(date +%Y%m%d-%H%M%S)
log() { printf '[apply-to-wsl] %s\n' "$*"; }
die() { printf '[apply-to-wsl] ERROR: %s\n' "$*" >&2; exit 1; }

[ -d "$SRC" ]  || die "源目录不存在：$SRC（Windows 盘是否已挂载到 /mnt/d ?）"
[ -d "$DEST" ] || die "目标安装副本不存在：$DEST"
[ -f "$SRC/lib/typert.js" ] || die "源产物缺失：$SRC/lib/typert.js（先 npm run build）"

# 0. 修复前自检：源产物必须带 model 块（否则同步了也是坏的）
if ! grep -q 'model: {' "$SRC/lib/typert.js"; then
  die "源 lib/typert.js 里没有 TYPERT.model 块 —— 尚未 build 或 build 失败"
fi
log "源产物自检通过（含 TYPERT.model 块）"

if [ "$DRY" = 1 ]; then
  log "DRY-RUN：将把 $SRC/{lib,package.json,cordis.patch.yml,assets,README.md,LICENSE} 同步到 $DEST"
  log "DRY-RUN：将重启 $OPS restart"
  exit 0
fi

# 1. 备份现有副本（只留最近 3 份）
BAK="$DEST.bak-$TS"
mkdir -p "$BAK"
cp -a "$DEST/lib" "$DEST/package.json" "$BAK/" 2>/dev/null || true
log "已备份 -> $BAK"
ls -1dt "$DEST".bak-* 2>/dev/null | tail -n +4 | while read -r old; do rm -rf "$old"; done

# 2. 同步（lib 先清空再拷，避免残留旧 chunk；assets/templates 保留目录结构）
rm -rf "$DEST/lib"
cp -a "$SRC/lib" "$DEST/lib"
for f in package.json cordis.patch.yml README.md LICENSE; do
  [ -f "$SRC/$f" ] && cp -a "$SRC/$f" "$DEST/$f"
done
[ -d "$SRC/assets" ] && { rm -rf "$DEST/assets"; cp -a "$SRC/assets" "$DEST/assets"; }
chmod -R a+rX "$DEST" 2>/dev/null || true
log "已同步产物 -> $DEST"

# 3. 同步后自检：安装副本里的 typert.js 必须与源一致
if ! cmp -s "$SRC/lib/typert.js" "$DEST/lib/typert.js"; then
  die "同步校验失败：$DEST/lib/typert.js 与源不一致"
fi
log "同步校验通过（lib/typert.js 字节一致，size=$(stat -c%s "$DEST/lib/typert.js"))"

# 4. 重启服务
if [ "$RESTART" = 1 ]; then
  [ -x "$OPS" ] || die "找不到运维入口：$OPS"
  LOG_OFFSET=0
  [ -f "$WEB_LOG" ] && LOG_OFFSET=$(stat -c%s "$WEB_LOG")
  log "重启 dsh web：$OPS restart"
  "$OPS" restart || true
  sleep 3
  log "--- 重启后新增日志（typert 相关）---"
  [ -f "$WEB_LOG" ] && tail -c "+$((LOG_OFFSET + 1))" "$WEB_LOG" | grep -i -E 'typert|did not activate|must be an object' || echo '(无 typert 报错)'
  log "URL=$(cat /root/.dsh-current-url 2>/dev/null)"
fi

log "完成。"
