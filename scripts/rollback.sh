#!/bin/bash
# scripts/rollback.sh — 切回原 active slot
#
# 用法: ./scripts/rollback.sh
set -e

APP_DIR="/www/wwwroot/wxgzh"
BLUE_PORT=3000
GREEN_PORT=3001
SLOT_CONF="/etc/nginx/slot.conf"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ ! -f "$SLOT_CONF" ]; then
  echo -e "${RED}❌ $SLOT_CONF 不存在, 不知道当前 active 是谁${NC}"
  exit 1
fi

CURRENT_PORT=$(grep -oE '[0-9]+' "$SLOT_CONF" | head -1)
if [ "$CURRENT_PORT" = "$BLUE_PORT" ]; then
  PREV=green
  PREV_PORT=$GREEN_PORT
else
  PREV=blue
  PREV_PORT=$BLUE_PORT
fi

echo -e "${YELLOW}⚠️  回滚到 $PREV (:$PREV_PORT)${NC}"

# 1. 确认 standby 还在
if ! "$APP_DIR/scripts/health-check.sh" "$PREV_PORT"; then
  echo -e "${RED}❌ $PREV 不健康, 无法回滚${NC}"
  echo "排查: pm2 logs wxgzh-api-$PREV --lines 100"
  exit 1
fi

# 2. 切流量
"$APP_DIR/scripts/switch-traffic.sh" "$PREV"

# 3. 冒烟
"$APP_DIR/scripts/smoke-test.sh" "${SMOKE_DOMAIN:-https://api.wxgzh.example.com}"

# 4. 记录
TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
LOG=/var/log/wxgzh/rollback.log
mkdir -p "$(dirname "$LOG")" 2>/dev/null || true
echo "[$TS] rollback: blue/green → $PREV" >> "$LOG" 2>/dev/null || true

echo -e "${GREEN}✅ 回滚完成 (记录到 $LOG)${NC}"
