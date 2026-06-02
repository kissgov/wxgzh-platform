# 部署流程 (V2.0 蓝绿)

> 适用: 生产部署 (`wxgzh.kxrdyf.cn` / `api.wxgzh.example.com`)
> 前置: 已在生产机器配置好 nginx + PM2 + PostgreSQL + Redis

## 标准发布 (低峰期, 1-3 分钟)

```bash
ssh prod
cd /www/wwwroot/wxgzh
./scripts/deploy-green.sh
```

脚本会自动:

1. 拉最新 main 分支
2. `pnpm install --frozen-lockfile`
3. `npx prisma migrate deploy`
4. 构建 shared / server / web
5. 启动 **standby** slot (与 active 相反的端口)
6. 健康检查 (5 次重试, 每次间隔 2s)
7. 切流量 (写 `/etc/nginx/slot.conf` + `nginx -s reload`)
8. 冒烟测试 (5 步: /health, swagger, /metrics, login, /accounts)

## 一键回滚 (1 分钟内)

```bash
./scripts/rollback.sh
```

- 自动判断当前 active → 切到 standby
- 失败: `pm2 logs wxgzh-api-<slot> --lines 100`

## 紧急: 切不回去

如果 standby 不健康 **且** 当前 active 也有问题:

```bash
# 1. 暂停所有 PM2 进程
pm2 stop all

# 2. 手动 ssh 上去, 单独启一个 slot
cd /www/wwwroot/wxgzh
pm2 start ecosystem.config.js --only wxgzh-api-blue
./scripts/switch-traffic.sh blue

# 3. 冒烟
./scripts/smoke-test.sh http://localhost
```

## 端口约定

| 进程 | 端口 | 角色 |
|------|------|------|
| wxgzh-api-blue | 3000 | 默认 active |
| wxgzh-api-green | 3001 | 部署目标 / 回滚目标 |
| wxgzh-worker | — | BullMQ 后台任务 |

## 部署后清单

- [ ] `pm2 ls` 看到 wxgzh-api-blue 和 wxgzh-api-green 都 in status `online`
- [ ] `curl https://api.wxgzh.example.com/api/v1/health` 返回 200
- [ ] Grafana 看板 5 分钟内无新告警
- [ ] (有条件) 看一眼日志: `pm2 logs --lines 50`

## 不在 S5 范围

- 多机负载均衡 (暂未做, 单机 PM2 fork 模式)
- 自动伸缩 (V2.1+ 考虑)
- 数据库读写分离 (V2.1+ 考虑)
