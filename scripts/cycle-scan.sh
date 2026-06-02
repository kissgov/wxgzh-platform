#!/bin/bash
# scripts/cycle-scan.sh
# 扫描后端模块循环依赖 (madge)
# 失败 → 阻断 CI; 发现 V1 现有循环时打印报告但仍可继续 (S6 仅记录不修)
set -e
cd "$(dirname "$0")/.."

echo "🔍 扫描后端模块循环依赖 ..."

CYCLE=$(npx madge --circular --extensions ts apps/server/src 2>&1) || true
if echo "$CYCLE" | grep -q "Circular"; then
  echo "$CYCLE"
  echo "❌ 发现循环依赖, 修复后才能合入"
  exit 1
fi
echo "✅ 无循环依赖"
