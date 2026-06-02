#!/bin/bash
# scripts/switch-traffic.sh <blue|green>
# 切换 nginx 上游到指定 slot
# 用法: ./scripts/switch-traffic.sh green
set -e

TARGET=$1
[ -n "$TARGET" ] || { echo "usage: $0 <blue|green>"; exit 1; }

if [ "$TARGET" = "blue" ]; then
  PORT=3000
elif [ "$TARGET" = "green" ]; then
  PORT=3001
else
  echo "❌ 未知 slot: $TARGET (只接受 blue / green)"; exit 1
fi

SLOT_CONF="/etc/nginx/slot.conf"
NGINX_CMD=${NGINX_CMD:-nginx}

# 写新 slot 配置
echo "slot=$PORT;" > "$SLOT_CONF" || { echo "❌ 写 $SLOT_CONF 失败 (需要 sudo)"; exit 1; }

# 测试 + reload
if command -v sudo &> /dev/null && [ "$EUID" -ne 0 ]; then
  SUDO="sudo"
else
  SUDO=""
fi

if $SUDO $NGINX_CMD -t 2>&1 | grep -q "test is successful"; then
  $SUDO $NGINX_CMD -s reload
  echo "✅ 已切到 $TARGET (:$PORT)"
else
  echo "❌ nginx 配置测试失败, 不 reload"
  exit 1
fi
