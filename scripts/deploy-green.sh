#!/bin/bash
# scripts/deploy-green.sh — 蓝绿部署到 standby slot, 切流量, 冒烟
#
# 流程:
#   1. 拉代码
#   2. 装依赖
#   3. 跑 migration
#   4. 构建
#   5. 启动 standby slot
#   6. 健康检查
#   7. 切流量
#   8. 冒烟测试
#
# 用法: ./scripts/deploy-green.sh
set -e

# ── 配置 ──────────────────────────────────────────────
APP_DIR="/www/wwwroot/wxgzh"
BLUE_PORT=3000
GREEN_PORT=3001
SLOT_CONF="/etc/nginx/slot.conf"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ── 1. 决定 target slot ────────────────────────────────
if [ -f "$SLOT_CONF" ]; then
  CURRENT_PORT=$(grep -oE '[0-9]+' "$SLOT_CONF" | head -1)
else
  # 首次部署, 默认 blue 是 active
  CURRENT_PORT=$BLUE_PORT
fi

if [ "$CURRENT_PORT" = "$BLUE_PORT" ]; then
  TARGET=green
  TARGET_PORT=$GREEN_PORT
else
  TARGET=blue
  TARGET_PORT=$BLUE_PORT
fi
echo -e "${YELLOW}🎯 部署目标: $TARGET (:$TARGET_PORT)${NC}"
echo "================================"

# ── 2. 拉代码 ──────────────────────────────────────────
cd "$APP_DIR"
echo ">> 拉代码..."
git pull

# ── 3. 装依赖 ──────────────────────────────────────────
echo ">> 装依赖..."
pnpm install --frozen-lockfile

# ── 4. 跑 migration ───────────────────────────────────
echo ">> prisma migrate deploy..."
npx prisma migrate deploy

# ── 5. 构建 ────────────────────────────────────────────
echo ">> 构建 shared..."
cd "$APP_DIR/packages/shared"
npx tsc

echo ">> 构建 server..."
cd "$APP_DIR/apps/server"
npx tsc -p tsconfig.json

echo ">> 构建 web..."
cd "$APP_DIR/apps/web"
pnpm build

# ── 6. 启 target slot ────────────────────────────────
cd "$APP_DIR"
echo ">> 启动 wxgzh-api-$TARGET..."
pm2 delete "wxgzh-api-$TARGET" 2>/dev/null || true
pm2 start ecosystem.config.js --only "wxgzh-api-$TARGET"
pm2 save

# ── 7. 健康检查 ───────────────────────────────────────
echo ">> 健康检查..."
if ! "$APP_DIR/scripts/health-check.sh" "$TARGET_PORT"; then
  echo -e "${RED}❌ $TARGET 不健康, 不切流量${NC}"
  echo "排查: pm2 logs wxgzh-api-$TARGET --lines 100"
  exit 1
fi

# ── 8. 切流量 ─────────────────────────────────────────
echo ">> 切流量到 $TARGET..."
"$APP_DIR/scripts/switch-traffic.sh" "$TARGET"

# ── 9. 冒烟 ───────────────────────────────────────────
echo ">> 冒烟测试..."
"$APP_DIR/scripts/smoke-test.sh" "${SMOKE_DOMAIN:-https://api.wxgzh.example.com}"

echo "================================"
echo -e "${GREEN}✅ $TARGET 上线完成${NC}"
