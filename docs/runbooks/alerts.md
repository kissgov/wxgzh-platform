# 告警响应手册

> 本文档面向 on-call 工程师。S3 告警规则定义见 `infra/prometheus/alerts.yml`。
> Grafana: `http://localhost:3001` (admin/admin)。Prometheus: `http://localhost:9090`。

---

## HighErrorRate (HTTP 5xx > 5%)

**严重度**: critical
**触发条件**: `sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.05` 持续 5 分钟
**可能原因**: 微信 API 全面失败 / 数据库不可达 / 部署坏版本

**响应步骤**:
1. 打开 Grafana "HTTP 请求" 看板, 确认是哪个 route 集中报错
2. 查 `/var/log/wxgzh/api-error.log` 最近 5 分钟
3. 如是部署相关 → 触发 rollback (见 S5 plan: `scripts/rollback.sh`)
4. 如是下游服务 (DB/Redis/微信) → 临时禁用该 route (feature flag) 或限流

---

## SlowP95Latency (P95 > 1s)

**严重度**: warning
**触发条件**: P95 延迟在某 route > 1s 持续 10 分钟
**可能原因**: DB 慢查询 / 微信 API 限频 / 业务逻辑 N+1

**响应步骤**:
1. Grafana "HTTP 请求" → "Top 10 慢路由" 表格
2. 取 trace_id (`X-Trace-Id` 响应头) → 查 Jaeger/Tempo (待 S3 阶段 2 配置)
3. 看 span 树, 找最长 span
4. 若是 DB → `EXPLAIN ANALYZE` 该 SQL, 加索引
5. 若是微信 → 检查是否被限频 (`wechat_api_calls_total{result="rate_limited"}`)

---

## TokenRefreshFailure (Token 刷新失败率 > 10%)

**严重度**: critical
**影响**: 整个平台无法调微信 API, 业务全面停摆
**触发条件**: `rate(queue_jobs_total{queue="token-refresh",status="failed"}[15m]) > 0.1` 持续 5 分钟

**响应步骤**:
1. 查 Grafana "队列" 看板, 看 token-refresh 队列失败数趋势
2. 检查 `component_verify_ticket` 是否更新 (查 ComponentApp 表 `verifyTicket` 字段)
3. 手动调 `POST /admin/refresh-component-token` 触发重试
4. 仍失败 → 微信开放平台后台检查第三方平台状态 (是否有违规/封禁)
5. 紧急情况: 切到备用 component_appid (如已配)

---

## WechatApiRateLimited (微信 API 触发限频)

**严重度**: warning
**触发条件**: `rate(wechat_api_calls_total{result="rate_limited"}[5m]) > 1` 持续 5 分钟
**可能原因**: 短时间内大量粉丝同步/消息群发

**响应步骤**:
1. Grafana → 查 `wechat_api_calls_total` 按 endpoint 分组, 找是哪个调用触发的
2. 检查是哪个 component_appid / authorizer_appid 触发 (按 tenant_id 维度)
3. 临时降级非关键调用 (粉丝同步/统计拉取) — 在 scheduler 中注释
4. 1 小时后逐步恢复, 同时把限频事件加监控

---

## QueueBacklog (队列积压 > 1000)

**严重度**: warning
**触发条件**: `bullmq_waiting_count > 1000` 持续 10 分钟
**可能原因**: Worker 进程挂了 / 任务处理慢 / 任务生产速度突增

**响应步骤**:
1. `pm2 list` 看 worker 进程是否在跑
2. 看 `queue_jobs_total` 失败率, 是否有大批任务失败阻塞
3. 看具体队列, 临时扩容 worker 进程 (pm2 scale)
4. 若是 sync-data 积压 → 检查微信 API 是否限频 (联动 WechatApiRateLimited)
