# 回滚演练手册 (V2.0 S5)

> 强制: 每月一次回滚演练, 写记录到 CHANGELOG。
> 目标: 验证 1 分钟内能切回上一个 slot。

## 演练流程 (30 分钟)

| 步骤 | 操作 | 期望 |
|------|------|------|
| 1 | 选低峰期 (凌晨 2-4 点) | — |
| 2 | `./scripts/deploy-green.sh` | $TARGET 上线, 流量切到 $TARGET |
| 3 | 等 5 分钟, 跑 `smoke-test.sh` | 5 步全绿 |
| 4 | 观察 Grafana (HTTP 5xx 率, p99 延迟) | 无异常 |
| 5 | `./scripts/rollback.sh` | 切回 standby |
| 6 | `smoke-test.sh` 5 步 | 全绿 |
| 7 | `cat /var/log/wxgzh/rollback.log` | 看到 `[<ts>] rollback: ...` |
| 8 | 切回 $TARGET (新版本) | `switch-traffic.sh $TARGET` |
| 9 | 写记录到 CHANGELOG | 表格新增一行 |

## 演练记录表

| 日期 | 执行人 | 部署版本 | 回滚用时 | 冒烟结果 | 备注 |
|------|--------|----------|----------|----------|------|
| — | — | — | — | — | (待填) |

## 演练失败处理

- **standby 不健康**: 演练 skip, 修后再演练
- **smoke 失败**: 演练 fail, 走 post-mortem
  - 看 `pm2 logs` 找原因
  - 看 Grafana 找异常 metric
  - 修复后重演练

## 真实事故回滚

如果线上 P0/P1, 走事故流程:

1. 立刻在群里喊: "回滚!"
2. 1 人执行 `./scripts/rollback.sh`
3. 1 人同时贴出: 当前部署 commit hash / 当前 active slot / 上一版本 commit hash
4. 回滚后, 5 分钟内:
   - 冒烟
   - 看 Grafana 5xx 率
   - 给客户/PM 发"已恢复"通知
5. 24 小时内: post-mortem, 写到 `docs/postmortem/YYYY-MM-DD-<short-name>.md`

## 注意事项

- 回滚不会回滚 DB migration (有意识分离 — 避免双向数据风险)
- 如果事故是 migration 引入的, 先回滚代码, 再单独讨论 schema 回滚
- Redis 缓存会被切 slot 影响 (新 slot 是冷启动), 1-2 分钟内可能 cache miss 增多, 属正常
