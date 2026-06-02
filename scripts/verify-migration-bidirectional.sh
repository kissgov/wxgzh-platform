#!/bin/bash
# scripts/verify-migration-bidirectional.sh
# 验证每个 migration 都能 up + down 完整往返
#
# 用法: ./scripts/verify-migration-bidirectional.sh
# 前置: 本地已安装 psql, 且 createdb/dropdb 可用 (PostgreSQL client tools)
#
# 每个 migration 必须同时存在 migration.sql 和 down.sql, 然后:
#   1. createdb 临时库
#   2. psql < migration.sql   (up)
#   3. psql < down.sql        (down)
#   4. psql < migration.sql   (up 再次, 确认 down 没破坏)
#   5. dropdb 临时库
#
# 任何一个失败立即 exit 1, 最后打印汇总。
set -e

cd "$(dirname "$0")/.."

MIGRATIONS_DIR="prisma/migrations"
PASS=0
FAIL=0
FAILED_LIST=""

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🔍 Prisma Migration 双向验证${NC}"
echo "================================"

# 检查 psql 是否可用
if ! command -v psql &> /dev/null; then
  echo -e "${RED}❌ psql 未安装,请先安装 PostgreSQL client tools${NC}"
  exit 1
fi

# 收集所有 migration 目录 (按时间戳排序)
MIGRATIONS=$(ls "$MIGRATIONS_DIR" 2>/dev/null | grep -E '^[0-9]' | sort)
if [ -z "$MIGRATIONS" ]; then
  echo -e "${RED}❌ 未发现任何 migration 目录${NC}"
  exit 1
fi

for m in $MIGRATIONS; do
  MIGRATION_SQL="$MIGRATIONS_DIR/$m/migration.sql"
  DOWN_SQL="$MIGRATIONS_DIR/$m/down.sql"

  if [ ! -f "$MIGRATION_SQL" ]; then
    echo -e "${RED}❌ $m: 缺少 migration.sql${NC}"
    FAIL=$((FAIL+1))
    FAILED_LIST="$FAILED_LIST $m"
    continue
  fi

  if [ ! -f "$DOWN_SQL" ]; then
    echo -e "${RED}❌ $m: 缺少 down.sql${NC}"
    FAIL=$((FAIL+1))
    FAILED_LIST="$FAILED_LIST $m"
    continue
  fi

  echo ""
  echo "🔍 验证 $m ..."

  # 用临时 DB (避免污染开发库)
  TMPDB="wxgzh_mig_$$_${RANDOM}"
  if ! createdb "$TMPDB" 2>/dev/null; then
    echo -e "${RED}❌ $m: createdb 失败 (权限?)${NC}"
    FAIL=$((FAIL+1))
    FAILED_LIST="$FAILED_LIST $m"
    continue
  fi

  # 1. up
  if ! psql "$TMPDB" -f "$MIGRATION_SQL" -q -v ON_ERROR_STOP=1 > /dev/null 2>&1; then
    echo -e "${RED}❌ $m: up 失败${NC}"
    dropdb "$TMPDB" 2>/dev/null || true
    FAIL=$((FAIL+1))
    FAILED_LIST="$FAILED_LIST $m"
    continue
  fi

  # 2. down
  if ! psql "$TMPDB" -f "$DOWN_SQL" -q -v ON_ERROR_STOP=1 > /dev/null 2>&1; then
    echo -e "${RED}❌ $m: down 失败${NC}"
    dropdb "$TMPDB" 2>/dev/null || true
    FAIL=$((FAIL+1))
    FAILED_LIST="$FAILED_LIST $m"
    continue
  fi

  # 3. up 再次 (确认 down 没破坏 schema)
  if ! psql "$TMPDB" -f "$MIGRATION_SQL" -q -v ON_ERROR_STOP=1 > /dev/null 2>&1; then
    echo -e "${RED}❌ $m: up 再次失败 (down 后 up 不能恢复)${NC}"
    dropdb "$TMPDB" 2>/dev/null || true
    FAIL=$((FAIL+1))
    FAILED_LIST="$FAILED_LIST $m"
    continue
  fi

  dropdb "$TMPDB" 2>/dev/null || true
  echo -e "${GREEN}  ✅ $m: up + down + up 全部通过${NC}"
  PASS=$((PASS+1))
done

echo ""
echo "================================"
if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}🎉 汇总: $PASS 通过 / $FAIL 失败${NC}"
  exit 0
else
  echo -e "${RED}❌ 汇总: $PASS 通过 / $FAIL 失败${NC}"
  echo -e "${RED}失败的 migration:$FAILED_LIST${NC}"
  exit 1
fi
