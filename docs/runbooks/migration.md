# Prisma Migration 规范 (V2.0 S5 强制)

> 适用: 所有 V2.0+ 写 Prisma migration 的工程师。
> 强制项: 每个新 migration 必须有 down.sql, 且通过 `verify-migration-bidirectional.sh`。

## 写新 migration 流程

1. `pnpm prisma migrate dev --name <name>` 生成 up (Prisma 会写 `migration.sql`)
2. **手写 down.sql** 包含逆操作 (DROP TABLE / DROP COLUMN / DROP CONSTRAINT)
3. **跑** `./scripts/verify-migration-bidirectional.sh` 验证
4. CI 阻断: 缺 down.sql = 失败

## down.sql 模板

按 migration.sql 出现的逆序, 逐项反写:

```sql
-- 1. 先删 FK (避免 DROP TABLE 时 CASCADE 误删)
ALTER TABLE "<table>" DROP CONSTRAINT IF EXISTS "<table>_<col>_fkey";

-- 2. 删索引
DROP INDEX IF EXISTS "<table>_<col>_idx";

-- 3. 删列 (如果有 ALTER TABLE ADD COLUMN)
ALTER TABLE "<table>" DROP COLUMN IF EXISTS "<col>";

-- 4. 最后删表 (逆序, 避免被 FK 引用)
DROP TABLE IF EXISTS "<new_table>" CASCADE;
```

## 不可逆 migration 怎么办

| 操作 | 是否可逆 | 替代方案 |
|------|----------|----------|
| 加 column | ✅ 可逆 | DROP COLUMN |
| 删 column | ❌ 不可逆 | 备份数据 → DROP COLUMN, down.sql 留 TODO |
| 加 table | ✅ 可逆 | DROP TABLE CASCADE |
| 删 table | ❌ 不可逆 | 先 archive 到 `_archive_<date>` 表, down.sql 删 archive |
| 加 enum value | ✅ 可逆 | 暂留 (Postgres enum 不可单独删 value) |
| 删 enum value | ❌ 不可逆 | 改列类型到 TEXT, down.sql 留 TODO |
| 大表 ALTER (加索引) | ⚠️ 锁表 | 用 `CONCURRENTLY` 索引, down.sql 标 `CONCURRENTLY` |

## 紧急回滚

```bash
# 1. 找到要回滚的 migration 名称
ls prisma/migrations/

# 2. 应用 down.sql 到生产
psql "$DATABASE_URL" -f prisma/migrations/<name>/down.sql

# 3. 重新部署前一个版本
./scripts/rollback.sh
```

## CI 阻断逻辑

在 `ci.yml` 增加一个 job:

```yaml
migration-bidir:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - run: |
        apt-get update && apt-get install -y postgresql-client
        sudo -u postgres createuser -s root || true
        ./scripts/verify-migration-bidirectional.sh
```

## 验证记录

| 日期 | Migration | 双向验证 | 备注 |
|------|-----------|----------|------|
| 2026-06-02 | 20260529131923_init | ⏳ 待 CI 跑通 | V1 init, ~30 表 |
| 2026-06-02 | 20260531035452_unify_schema_billing | ⏳ 待 CI 跑通 | V1 统一 billing |
| 2026-06-02 | 20260531040741_add_team_collaboration | ⏳ 待 CI 跑通 | V1 团队协作 |
| 2026-06-02 | 20260531053850_add_content_creation | ⏳ 待 CI 跑通 | V1 内容创作 |
| 2026-06-02 | 20260531055326_add_campaign_models | ⏳ 待 CI 跑通 | V1 活动模型 |
| 2026-06-02 | 20260531061909_add_conversion_analytics | ⏳ 待 CI 跑通 | V1 转化分析 |
