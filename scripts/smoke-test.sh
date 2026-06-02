#!/bin/bash
# scripts/smoke-test.sh <domain>
# 部署后冒烟测试: 健康 / Swagger / metrics / 登录 / 受保护接口
# 用法: ./scripts/smoke-test.sh https://api.wxgzh.example.com
set -e

DOMAIN=${1:-http://localhost}
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo "🔍 冒烟测试 $DOMAIN ..."
echo "================================"

# 1. /health
echo -n "  [1/5] /api/v1/health ... "
if ! curl -fsS "$DOMAIN/api/v1/health" > /dev/null --max-time 10; then
  echo -e "${RED}❌ 失败${NC}"; exit 1
fi
echo -e "${GREEN}✅${NC}"

# 2. Swagger JSON 可达
echo -n "  [2/5] /api/docs-json ... "
if ! curl -fsS "$DOMAIN/api/docs-json" > /dev/null --max-time 10; then
  echo -e "${RED}❌ 失败${NC}"; exit 1
fi
echo -e "${GREEN}✅${NC}"

# 3. Prometheus /metrics 端点
echo -n "  [3/5] /metrics ... "
if ! curl -fsS "$DOMAIN/metrics" 2>/dev/null | head -5 > /dev/null --max-time 10; then
  echo -e "${RED}❌ 失败${NC}"; exit 1
fi
echo -e "${GREEN}✅${NC}"

# 4. 登录 (admin seed 账号, V1 默认)
echo -n "  [4/5] 登录 (admin@wxgzh.com) ... "
LOGIN=$(curl -fsS -X POST "$DOMAIN/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@wxgzh.com","password":"admin123"}' \
  --max-time 10)
TOKEN=$(echo "$LOGIN" | jq -r '.data.access_token' 2>/dev/null)
if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo -e "${RED}❌ 失败 (响应: $LOGIN)${NC}"; exit 1
fi
echo -e "${GREEN}✅${NC}"

# 5. 调受保护接口
echo -n "  [5/5] /api/v1/accounts (Bearer) ... "
if ! curl -fsS "$DOMAIN/api/v1/accounts" \
  -H "Authorization: Bearer $TOKEN" \
  --max-time 10 > /dev/null; then
  echo -e "${RED}❌ 失败${NC}"; exit 1
fi
echo -e "${GREEN}✅${NC}"

echo "================================"
echo -e "${GREEN}✅ 全部冒烟通过${NC}"
