#!/bin/bash
# 微信公众号运营平台 — 宝塔面板一键部署脚本
# 使用方法: chmod +x deploy.sh && ./deploy.sh
set -e

APP_DIR="/www/wwwroot/wxgzh"
NODE_VERSION="20"

echo "========================================="
echo "  微信公众号运营平台 — 宝塔部署脚本"
echo "========================================="

# 1. 安装依赖
echo ">> [1/6] 安装 pnpm..."
npm install -g pnpm

echo ">> [2/6] 安装项目依赖..."
cd "$APP_DIR"
pnpm install --frozen-lockfile

# 2. 构建 shared 包
echo ">> [3/6] 构建共享包..."
cd "$APP_DIR/packages/shared"
npx tsc

# 3. 生成 Prisma Client
echo ">> [4/6] 生成数据库客户端..."
cd "$APP_DIR"
npx prisma generate

# 4. 执行数据库迁移
echo ">> [5/6] 执行数据库迁移..."
npx prisma migrate deploy
npx tsx prisma/seed.ts

# 5. 构建后端
echo ">> [6/6] 构建后端..."
cd "$APP_DIR/apps/server"
npx tsc -p tsconfig.json

# 6. 构建前端
echo ">> [6/6] 构建前端..."
cd "$APP_DIR/apps/web"
pnpm build

# 7. 启动/重启 PM2
echo ">> 启动 PM2 进程..."
cd "$APP_DIR"
pm2 delete wxgzh-api wxgzh-worker 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

echo ""
echo "========================================="
echo "  部署完成！"
echo "  后端: http://localhost:3000"
echo "  前端: 请配置宝塔网站指向 apps/web/dist"
echo "========================================="
