#!/bin/bash
# scripts/health-check.sh <port>
# 检查指定端口的 API 服务是否健康 (200 OK)
# 用法: ./scripts/health-check.sh 3000
set -e

PORT=${1:-3000}
URL="http://127.0.0.1:${PORT}/api/v1/health"
RETRIES=${RETRIES:-5}
SLEEP_SECS=${SLEEP_SECS:-2}

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo "🔍 检查 $URL (重试 $RETRIES 次)..."

for i in $(seq 1 $RETRIES); do
  RESP=$(curl -s -o /dev/null -w '%{http_code}' "$URL" --max-time 5 || echo 000)
  if [ "$RESP" = "200" ]; then
    echo -e "${GREEN}✅ port $PORT healthy${NC}"
    exit 0
  fi
  echo "  [$i/$RETRIES] HTTP $RESP, ${SLEEP_SECS}s 后重试..."
  sleep $SLEEP_SECS
done

echo -e "${RED}❌ port $PORT unhealthy (最后: $RESP)${NC}"
exit 1
