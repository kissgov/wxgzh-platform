# V2.0 S5 — CI 升级 + 部署回滚 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CI 完整升级 (覆盖率门槛 + E2E + security + auto-merge 准备) + 数据库 migration 双向 + 蓝绿/灰度发布 + 一键回滚脚本 + 演练。

**Architecture:** GitHub Actions 多 job 矩阵 (lint / typecheck / test / build / security / e2e), prisma migration 双向 SQL, shell 脚本管理蓝绿 (Active/Standby 切换), 失败 webhook 触发自动回滚。

**Tech Stack:** GitHub Actions / pnpm 9 / Turborepo 2 / prisma migrate (双向 SQL) / nginx upstream / PM2 / Bash 脚本

**Spec:** [../specs/2026-06-02-v2-foundation-design.md §3.4 §6](../specs/2026-06-02-v2-foundation-design.md)

**前置依赖:** S1 (测试), S4 (security scan)

**本 sprint 不动:**
- 不动业务代码
- 不动 prisma schema 业务字段 (只保证 migration 双向)

---

## 累计文件结构 (本 sprint 创建)

```
.github/workflows/
├── ci.yml                          # MODIFY (整合: lint/typecheck/test/build/coverage/swagger/security/smoke)
├── e2e.yml                         # NEW (Playwright + supertest)
├── release.yml                     # NEW (tag → build image → push → 通知)
└── rollback-on-alert.yml           # NEW (workflow_dispatch 触发, 切回旧版本)

prisma/migrations/
├── 20260529*/                     # EXISTING
└── <new>/                          # NEW migration 必须有 down.sql

scripts/
├── deploy-blue.sh                  # NEW (蓝绿部署)
├── deploy-green.sh                 # NEW
├── rollback.sh                     # NEW (切回 standby)
├── health-check.sh                 # NEW (蓝/绿 各自 /health)
├── smoke-test.sh                   # NEW (部署后冒烟)
├── switch-traffic.sh               # NEW (切 nginx upstream)
└── verify-migration-bidirectional.sh # NEW (本地验证 up + down)

docs/runbooks/
├── deploy.md                       # MODIFY (蓝绿流程)
├── rollback.md                     # NEW
└── migration.md                    # NEW (写新 migration 的规范)

ecosystem.config.js                 # MODIFY (双 process: api-blue, api-green)
nginx.conf                          # MODIFY (upstream blue/green)
deploy.sh                           # MODIFY (改为调用 deploy-green.sh)
```

---

## Task 1: CI 整合 — 单一 ci.yml

**Files:**
- Modify: `.github/workflows/ci.yml` (整合现有 + 加 S5 必要 step)

- [ ] **Step 1: 写整合后的 ci.yml**

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '22'
  PNPM_VERSION: '9'

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - { uses: actions/checkout@v4 }
      - { uses: pnpm/action-setup@v4, with: { version: '9' } }
      - { uses: actions/setup-node@v4, with: { node-version: '22', cache: 'pnpm' } }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - { uses: actions/checkout@v4 }
      - { uses: pnpm/action-setup@v4, with: { version: '9' } }
      - { uses: actions/setup-node@v4, with: { node-version: '22', cache: 'pnpm' } }
      - run: pnpm install --frozen-lockfile
      - run: pnpm run typecheck

  test:
    runs-on: ubuntu-latest
    services:
      postgres: { image: postgres:16-alpine, env: { POSTGRES_USER: wxgzh, POSTGRES_PASSWORD: wxgzh123, POSTGRES_DB: wxgzh_test }, ports: ['5432:5432'], options: '--health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5' }
      redis: { image: redis:7-alpine, ports: ['6379:6379'] }
    steps:
      - { uses: actions/checkout@v4 }
      - { uses: pnpm/action-setup@v4, with: { version: '9' } }
      - { uses: actions/setup-node@v4, with: { node-version: '22', cache: 'pnpm' } }
      - run: pnpm install --frozen-lockfile
      - run: pnpm prisma:generate
        env: { DATABASE_URL: 'postgresql://wxgzh:wxgzh123@localhost:5432/wxgzh_test' }
      - run: pnpm test:ci
        env:
          DATABASE_URL: 'postgresql://wxgzh:wxgzh123@localhost:5432/wxgzh_test'
          REDIS_URL: 'redis://localhost:6379/1'
          JWT_SECRET: 'test-secret-do-not-use-in-production'
          ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef'
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: coverage-report, path: apps/server/coverage/ }

  swagger:
    runs-on: ubuntu-latest
    needs: [test]
    steps:
      - { uses: actions/checkout@v4 }
      - { uses: pnpm/action-setup@v4, with: { version: '9' } }
      - { uses: actions/setup-node@v4, with: { node-version: '22', cache: 'pnpm' } }
      - run: pnpm install --frozen-lockfile
      - run: pnpm prisma:generate
      - run: cd apps/server && pnpm test swagger-sync

  build:
    runs-on: ubuntu-latest
    needs: [lint, typecheck, test, swagger]
    steps:
      - { uses: actions/checkout@v4 }
      - { uses: pnpm/action-setup@v4, with: { version: '9' } }
      - { uses: actions/setup-node@v4, with: { node-version: '22', cache: 'pnpm' } }
      - run: pnpm install --frozen-lockfile
      - run: pnpm prisma:generate
      - run: pnpm build
      - uses: actions/upload-artifact@v4
        with: { name: dist, path: apps/web/dist }
```

- [ ] **Step 2: 推 PR 验证**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: 整合 ci.yml (lint/typecheck/test/coverage/swagger/build)"
git push
```

Expected: PR 跑通, 5 个 job 全绿。

---

## Task 2: prisma migration 双向 + 验证脚本

**Files:**
- Create: `scripts/verify-migration-bidirectional.sh`
- Create: `docs/runbooks/migration.md`

- [ ] **Step 1: 写双向验证脚本**

```bash
#!/bin/bash
# scripts/verify-migration-bidirectional.sh
# 验证每个 migration 都能 up + down 完整往返
set -e
cd "$(dirname "$0")/.."

MIGRATIONS_DIR="prisma/migrations"
PASS=0
FAIL=0

for m in $(ls $MIGRATIONS_DIR | grep -E '^[0-9]' | sort); do
  MIGRATION_SQL="$MIGRATIONS_DIR/$m/migration.sql"
  DOWN_SQL="$MIGRATIONS_DIR/$m/down.sql"
  if [ ! -f "$DOWN_SQL" ]; then
    echo "❌ $m: 缺少 down.sql"
    FAIL=$((FAIL+1))
    continue
  fi
  echo "🔍 验证 $m ..."
  # 用临时 DB
  TMPDB="wxgzh_mig_$$"
  createdb "$TMPDB" 2>/dev/null || true
  psql "$TMPDB" -f "$MIGRATION_SQL" -q || { echo "❌ $m up 失败"; FAIL=$((FAIL+1)); dropdb "$TMPDB"; continue; }
  psql "$TMPDB" -f "$DOWN_SQL" -q || { echo "❌ $m down 失败"; FAIL=$((FAIL+1)); dropdb "$TMPDB"; continue; }
  psql "$TMPDB" -f "$MIGRATION_SQL" -q || { echo "❌ $m up 再次失败"; FAIL=$((FAIL+1)); }
  dropdb "$TMPDB"
  echo "  ✅ $m: up + down + up 全部通过"
  PASS=$((PASS+1))
done

echo ""
echo "汇总: $PASS 通过 / $FAIL 失败"
[ $FAIL -eq 0 ] || exit 1
```

- [ ] **Step 2: 给 V1 现有 6 个 migration 写 down.sql**

逐个给:
- `20260529131923_init/`
- `20260531035452_unify_schema_billing/`
- `20260531040741_add_team_collaboration/`
- `20260531053850_add_content_creation/`
- `20260531055326_add_campaign_models/`
- `20260531061909_add_conversion_analytics/`

每个加 `down.sql`, 内容是逆操作 (DROP TABLE / DROP COLUMN)。

(具体 SQL 需对照 `migration.sql` 反写, 工作量大, 但必要。)

- [ ] **Step 3: 跑验证**

```bash
chmod +x scripts/verify-migration-bidirectional.sh
./scripts/verify-migration-bidirectional.sh
```

Expected: 6 个全过。

- [ ] **Step 4: 写 migration 规范文档**

```markdown
# Prisma Migration 规范

## 写新 migration 流程

1. `pnpm prisma migrate dev --name <name>` 生成 up
2. **手写 down.sql** 包含逆操作
3. **跑** `./scripts/verify-migration-bidirectional.sh` 验证
4. CI 阻断: 缺 down.sql = 失败

## 不可逆 migration 怎么办

- 加 column → 直接 DROP COLUMN (可逆)
- 加 enum value → 加 placeholder value (可逆)
- 删 table → 先 archive 到 _archive_<date> 表
- 大表 ALTER → 分批 (10000 行/批) + 文档化停机窗口

## 紧急回滚

\`\`\`bash
./scripts/rollback-migration.sh <migration_name>
# 自动 down + 应用前一个 migration
\`\`\`
```

- [ ] **Step 5: 提交**

```bash
git add scripts/verify-migration-bidirectional.sh docs/runbooks/migration.md prisma/migrations/
git commit -m "feat(db): migration 双向验证 + V1 6 个 migration 补 down.sql"
```

---

## Task 3: 蓝绿部署脚本 (本地化版本, 适配宝塔)

**Files:**
- Create: `scripts/deploy-blue.sh`
- Create: `scripts/deploy-green.sh`
- Create: `scripts/switch-traffic.sh`
- Create: `scripts/health-check.sh`
- Create: `scripts/smoke-test.sh`
- Create: `scripts/rollback.sh`
- Modify: `ecosystem.config.js`
- Modify: `nginx.conf`

- [ ] **Step 1: 修改 ecosystem.config.js (双 process)**

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'wxgzh-api-blue',
      cwd: '/www/wwwroot/wxgzh',
      script: 'apps/server/dist/main.js',
      env: { NODE_ENV: 'production', APP_SLOT: 'blue', PORT: 3000 },
    },
    {
      name: 'wxgzh-api-green',
      cwd: '/www/wwwroot/wxgzh',
      script: 'apps/server/dist/main.js',
      env: { NODE_ENV: 'production', APP_SLOT: 'green', PORT: 3001 },
    },
    { name: 'wxgzh-worker', script: 'apps/server/dist/worker.js' },
  ],
};
```

- [ ] **Step 2: 修改 nginx.conf (upstream 双 slot)**

```nginx
upstream wxgzh_active { server 127.0.0.1:3000; }   # 蓝或绿, 由 switch-traffic.sh 改
upstream wxgzh_standby { server 127.0.0.1:3001; }  # 反之

server {
  listen 443 ssl;
  server_name api.wxgzh.example.com;

  location / {
    proxy_pass http://wxgzh_active;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

策略: nginx 不直接 upstream 蓝绿, 用 `set $slot blue;` + include file 切换。或者更简单: 用 `map` 指令根据 cookie/header 切; 默认走 active。

更简单方案: `proxy_pass http://127.0.0.1:$slot_port;`, `slot` 来自 `/etc/nginx/slot.env` (脚本写入)。

```nginx
include /etc/nginx/slot.conf;
server {
  location / { proxy_pass http://127.0.0.1:$slot_port; }
}
```

- [ ] **Step 3: 写 health-check.sh**

```bash
#!/bin/bash
# scripts/health-check.sh <port>
PORT=${1:-3000}
URL="http://127.0.0.1:${PORT}/health"
for i in 1 2 3 4 5; do
  RESP=$(curl -s -o /dev/null -w '%{http_code}' "$URL" || echo 000)
  if [ "$RESP" = "200" ]; then
    echo "✅ port $PORT healthy"
    exit 0
  fi
  sleep 2
done
echo "❌ port $PORT unhealthy (last: $RESP)"
exit 1
```

- [ ] **Step 4: 写 smoke-test.sh**

```bash
#!/bin/bash
# scripts/smoke-test.sh
set -e
DOMAIN=${1:-http://localhost}
echo "🔍 冒烟测试 $DOMAIN ..."

# 1. /health
curl -fsS "$DOMAIN/api/v1/health" > /dev/null || { echo "❌ /health 失败"; exit 1; }

# 2. /api/docs Swagger 可达
curl -fsS "$DOMAIN/api/docs-json" > /dev/null || { echo "❌ Swagger 失败"; exit 1; }

# 3. /metrics 端点
curl -fsS "$DOMAIN/metrics" | head -5 > /dev/null || { echo "❌ /metrics 失败"; exit 1; }

# 4. 登录 (用 admin seed 账号)
LOGIN=$(curl -fsS -X POST "$DOMAIN/api/v1/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@wxgzh.com","password":"admin123"}')
TOKEN=$(echo "$LOGIN" | jq -r .data.access_token)
[ -n "$TOKEN" ] || { echo "❌ 登录失败"; exit 1; }

# 5. 调受保护接口
curl -fsS "$DOMAIN/api/v1/accounts" -H "Authorization: Bearer $TOKEN" > /dev/null || { echo "❌ /accounts 失败"; exit 1; }

echo "✅ 全部冒烟通过"
```

- [ ] **Step 5: 写 switch-traffic.sh**

```bash
#!/bin/bash
# scripts/switch-traffic.sh <blue|green>
TARGET=$1
[ -n "$TARGET" ] || { echo "usage: $0 <blue|green>"; exit 1; }
if [ "$TARGET" = "blue" ]; then PORT=3000; else PORT=3001; fi
echo "slot=$PORT;" > /etc/nginx/slot.conf
nginx -t && nginx -s reload
echo "✅ 已切到 $TARGET (:$PORT)"
```

- [ ] **Step 6: 写 deploy-green.sh**

```bash
#!/bin/bash
# scripts/deploy-green.sh — 部署到 standby slot, 蓝绿切换
set -e
cd /www/wwwroot/wxgzh

# 当前 active (来自 /etc/nginx/slot.conf)
CURRENT_PORT=$(grep -oE '[0-9]+' /etc/nginx/slot.conf | head -1)
if [ "$CURRENT_PORT" = "3000" ]; then
  TARGET=green
  TARGET_PORT=3001
else
  TARGET=blue
  TARGET_PORT=3000
fi
echo "🎯 部署目标: $TARGET (:$TARGET_PORT)"

# 1. 拉代码
git pull

# 2. 装依赖
pnpm install --frozen-lockfile

# 3. 跑 migration
npx prisma migrate deploy

# 4. 构建
cd packages/shared && npx tsc && cd ../..
cd apps/server && npx tsc -p tsconfig.json && cd ../..
cd apps/web && pnpm build && cd ../..

# 5. 启 target
pm2 delete wxgzh-api-$TARGET 2>/dev/null || true
pm2 start ecosystem.config.js --only wxgzh-api-$TARGET

# 6. 等健康
./scripts/health-check.sh $TARGET_PORT

# 7. 切流量
./scripts/switch-traffic.sh $TARGET

# 8. 冒烟
./scripts/smoke-test.sh https://api.wxgzh.example.com

echo "✅ $TARGET 上线完成"
```

- [ ] **Step 7: 写 rollback.sh**

```bash
#!/bin/bash
# scripts/rollback.sh — 切回原 active slot
set -e
CURRENT_PORT=$(grep -oE '[0-9]+' /etc/nginx/slot.conf | head -1)
if [ "$CURRENT_PORT" = "3000" ]; then
  PREV=green
  PREV_PORT=3001
else
  PREV=blue
  PREV_PORT=3000
fi
echo "⚠️  回滚到 $PREV (:$PREV_PORT)"
./scripts/health-check.sh $PREV_PORT || { echo "❌ $PREV 不健康, 无法回滚"; exit 1; }
./scripts/switch-traffic.sh $PREV
./scripts/smoke-test.sh https://api.wxgzh.example.com
echo "✅ 回滚完成"
```

- [ ] **Step 8: 写 deploy-blue.sh (兼容旧版, 默认用 green)**

```bash
#!/bin/bash
# scripts/deploy-blue.sh — 兼容旧调用, 等价 deploy-green.sh
exec "$(dirname "$0")/deploy-green.sh" "$@"
```

- [ ] **Step 9: 部署 docs/runbooks/deploy.md + rollback.md**

```markdown
# 部署流程 (V2.0 蓝绿)

## 标准发布

\`\`\`bash
ssh prod
cd /www/wwwroot/wxgzh
./scripts/deploy-green.sh
\`\`\`

脚本会:
1. 拉最新 main 分支
2. 装依赖 + migration
3. 构建
4. 部署到 standby slot
5. 健康检查
6. 切流量
7. 冒烟

## 一键回滚

\`\`\`bash
./scripts/rollback.sh
\`\`\`

1 分钟内回到上一个 slot。

## 紧急: 切不回去

如果 standby 不健康, 且当前 active 也有问题:
1. 暂停: `pm2 stop all`
2. 手动修
3. 单独启一个 slot
```

```markdown
# 回滚演练手册

## 每月一次回滚演练

1. 部署 v2.0.x → blue
2. 验证生产 5 分钟
3. 触发回滚 (./scripts/rollback.sh) — 切到 green 旧版
4. 验证生产 5 分钟
5. 切回 blue (./scripts/switch-traffic.sh blue)
6. 记录到 CHANGELOG

## 演练失败场景

- standby 不健康: 演练 skip, 修后再演练
- smoke 失败: 演练 fail, post-mortem
```

- [ ] **Step 10: 提交 + 跑一次演练**

```bash
chmod +x scripts/*.sh
git add scripts/ docs/runbooks/ ecosystem.config.js nginx.conf
git commit -m "feat(delivery): 蓝绿部署 + 回滚 + smoke + 演练手册"
# 在生产跑 ./scripts/deploy-green.sh 验证
```

---

## Task 4: E2E 流水线框架 (E2E 实现在 S6, 这里只接 job 框架)

**Files:**
- Create: `.github/workflows/e2e.yml`

- [ ] **Step 1: 写 e2e.yml (S6 实现后即可用)**

```yaml
name: E2E
on:
  push: { branches: [main] }
  workflow_dispatch: {}

jobs:
  e2e:
    runs-on: ubuntu-latest
    services:
      postgres: { image: postgres:16-alpine, env: { POSTGRES_USER: wxgzh, POSTGRES_PASSWORD: wxgzh123, POSTGRES_DB: wxgzh_test }, ports: ['5432:5432'] }
      redis: { image: redis:7-alpine, ports: ['6379:6379'] }
    steps:
      - { uses: actions/checkout@v4 }
      - { uses: pnpm/action-setup@v4, with: { version: '9' } }
      - { uses: actions/setup-node@v4, with: { node-version: '22', cache: 'pnpm' } }
      - run: pnpm install --frozen-lockfile
      - run: pnpm prisma:generate
      - run: pnpm --filter server db:seed:test
      - run: cd apps/server && pnpm run test:e2e
        env: { DATABASE_URL: 'postgresql://wxgzh:wxgzh123@localhost:5432/wxgzh_test', REDIS_URL: 'redis://localhost:6379/1' }
```

- [ ] **Step 2: 提交**

```bash
git add .github/workflows/e2e.yml
git commit -m "ci: E2E job 框架 (S6 实现 test:e2e)"
```

---

## Task 5: Auto-rollback on alert (workflow_dispatch 触发)

**Files:**
- Create: `.github/workflows/rollback-on-alert.yml`

- [ ] **Step 1: 写 workflow**

```yaml
name: Rollback on Alert
on:
  workflow_dispatch:
    inputs:
      reason:
        description: '回滚原因'
        required: true

jobs:
  rollback:
    runs-on: ubuntu-latest
    steps:
      - name: SSH to prod and rollback
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.PROD_HOST }}
          username: ${{ secrets.PROD_USER }}
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            cd /www/wwwroot/wxgzh
            ./scripts/rollback.sh
            echo "回滚原因: ${{ inputs.reason }}" >> /var/log/wxgzh/rollback.log
```

- [ ] **Step 2: 提交**

```bash
git add .github/workflows/rollback-on-alert.yml
git commit -m "ci: workflow_dispatch 触发回滚"
```

---

## Task 6: 全量验证 + 演练

- [ ] **Step 1: 跑 verify-migration-bidirectional.sh**

```bash
./scripts/verify-migration-bidirectional.sh
```

Expected: 6 PASS / 0 FAIL.

- [ ] **Step 2: 跑 CI 全套 (本地或 PR)**

确认 lint / typecheck / test / swagger / build / security 全绿。

- [ ] **Step 3: 生产演练回滚 (低峰)**

```bash
# 部署新版本
./scripts/deploy-green.sh
# 验证 5 分钟
./scripts/smoke-test.sh https://api.wxgzh.example.com
# 触发回滚
./scripts/rollback.sh
# 再次冒烟
./scripts/smoke-test.sh https://api.wxgzh.example.com
```

- [ ] **Step 4: 写回滚演练记录到 CHANGELOG**

---

## 完工判定 (S5)

- [ ] CI 5 个 job (lint/typecheck/test/swagger/build) 全绿
- [ ] E2E job 框架就绪 (S6 填充)
- [ ] 6 个 migration 双向验证通过
- [ ] 蓝绿部署 + 回滚脚本就绪
- [ ] 1 次回滚演练成功 (1 分钟内切回)
- [ ] docs/runbooks/{deploy,rollback,migration}.md 写好

→ S5 完成, 进入 S6 (架构清理 + E2E 关键流)
