# 微信公众号第三方运营管理平台 — 产品需求文档 (PRD)

> 版本: v1.0.0 | 状态: Draft | 日期: 2026-05-29 | 作者: Architecture Team

---

## 1. 产品概要

### 1.1 产品定位

面向**中小型企业和代运营公司**的微信公众号第三方运营管理平台（SaaS），解决官方后台功能有限、数据分析薄弱、多账号管理效率低三大核心痛点。

### 1.2 核心价值主张

| 痛点 | 现状 | 解决方案 |
|------|------|----------|
| 多账号管理低效 | 运营人员需反复登录不同公众号后台 | 一个平台统一管理所有授权公众号，支持分组、批量操作、一键切换 |
| 数据分析薄弱 | 官方后台仅提供基础数据，无对比/趋势/画像能力 | 多维度数据分析看板 + 粉丝画像 + 多号横向对比 + 传播路径分析 |
| 运营工具匮乏 | 官方后台无自动化、无AI能力、无工作流 | 自动回复引擎 + AI智能客服 + 可视化工作流 + 内容合规审查 |

### 1.3 竞品差异化

- **vs 新榜**: 我们不是纯数据工具，而是「数据+运营」闭环
- **vs 微盟/有赞**: 我们不做电商交易，专注「内容+粉丝运营」深度
- **vs 西瓜数据**: 我们从数据出发延伸到操作执行，不只是看
- **vs 微伴助手**: 我们覆盖公众号全生命周期，不仅是客服环节

---

## 2. 目标用户画像

### 2.1 主要用户角色

| 角色 | 典型场景 | 核心诉求 | 使用频率 |
|------|----------|----------|----------|
| **代运营公司运营** | 同时管理 20-50 个客户公众号 | 批量操作、效率工具、数据报告自动生成 | 每日 4-8 小时 |
| **品牌方运营经理** | 管理 3-5 个品牌矩阵号 | 数据分析、内容排期、团队协作 | 每日 2-4 小时 |
| **中小企业市场部** | 运营 1-2 个公司公众号 | 简单易用、模板化操作、低学习成本 | 每日 1-2 小时 |
| **客服人员** | 处理粉丝咨询与互动 | 快速回复、知识库辅助、会话记录 | 每日 6-8 小时 |

### 2.2 用户痛点优先级

```
P0 痛点（MVP 必须解决）:
├── 多账号来回登录切换繁琐
├── 粉丝数据无法有效分析利用
├── 自动回复/关键词回复配置复杂
└── 授权 Token 过期导致服务中断

P1 痛点（V1 解决）:
├── 内容创作缺乏灵感和模板
├── 营销活动搭建技术门槛高
├── 团队协作权限管理混乱
└── 粉丝转化路径不清晰
```

---

## 3. MVP 范围定义（P0）

### 3.1 MVP 包含的功能模块

```
MVP = 授权管理 + 多账号管理 + 粉丝管理 + 消息管理 + 素材管理 + 菜单管理 + 数据统计
```

| 编号 | 模块 | MVP 范围 | 明确不在此版本 |
|------|------|----------|----------------|
| M01 | 第三方平台授权管理 | 授权扫码、Token自动刷新、到期预警、授权回收 | 批量授权 |
| M02 | 多公众号统一管理 | 公众号列表、分组、切换、基本信息同步 | — |
| M03 | 粉丝管理 | 粉丝列表、标签管理、标签规则引擎、粉丝画像、黑名单 | — |
| M04 | 消息管理 | 自动回复（关注/关键词/默认）、消息群发、模板消息 | AI客服、定时群发 |
| M05 | 素材管理 | 素材库CRUD、分类标签、上传下载、使用统计 | 批量上传拖拽 |
| M06 | 菜单管理 | 可视化菜单编辑、发布/回滚、菜单模板 | — |
| M07 | 数据统计 | 粉丝趋势、消息交互、图文分析基础看板 | 高级分析（留存/漏斗/路径） |

### 3.2 MVP 明确不包含

- 内容创作与发布（富文本编辑器、AI写作、发布审批）
- 营销活动引擎（H5搭建、裂变、渠道二维码）
- CRM（360°视图、RFM分群、用户旅程）
- 自动化工作流（可视化编排）
- AIGC 能力（AI生成文章/海报/客服）
- 小程序管理
- 开放平台 API
- 多渠道（短信/邮件/Push）

---

## 4. 核心用户故事

### 4.1 授权与账号管理

```
US-01: 作为代运营公司运营，我希望通过扫码方式快速完成客户公众号的授权，
       以便在平台上统一管理所有客户账号。

验收标准:
- 生成授权二维码，公众号管理员扫码后完成授权
- 授权成功后自动同步公众号基本信息（名称、头像、类型、二维码）
- Token 自动刷新，无需人工干预
- 授权到期前 7 天发送预警通知

US-02: 作为运营经理，我希望按品牌/行业/客户对公众号进行分组管理，
       以便快速定位和批量操作目标账号。

验收标准:
- 支持创建/编辑/删除分组
- 一个公众号可归属多个分组
- 分组视图下支持批量切换和筛选
```

### 4.2 粉丝管理

```
US-03: 作为运营人员，我希望查看粉丝列表并了解粉丝画像（性别/地域/关注来源），
       以便制定精准的内容和活动策略。

验收标准:
- 粉丝列表展示昵称、头像、标签、关注时间、互动次数
- 支持按标签、地域、关注时间筛选
- 粉丝画像以可视化图表呈现（饼图/地图/柱状图）

US-04: 作为运营人员，我希望创建自动标签规则（如「活跃用户=近30天互动≥5次」），
       以便系统自动为粉丝打标签，减少人工操作。

验收标准:
- 支持创建多条件组合规则（AND/OR）
- 规则条件支持：互动次数、关注时间、地域、性别
- 定时（每小时）执行规则并自动打标签
- 规则执行日志可追溯
```

### 4.3 消息管理

```
US-05: 作为运营人员，我希望配置关键词自动回复规则，
       以便粉丝发送特定关键词时自动回复预设内容。

验收标准:
- 支持精确匹配、模糊匹配、正则匹配三种模式
- 支持一个关键词对应多条回复（随机或顺序返回）
- 回复内容支持文本、图文、图片、小程序卡片类型
- 规则支持启用/禁用，无需删除

US-06: 作为运营人员，我希望向特定标签的粉丝群发消息，
       以便进行精准的内容推送。

验收标准:
- 支持按标签/性别/地域筛选发送目标
- 消息类型支持文本、图文、图片
- 发送前预览确认
- 发送进度实时展示
```

### 4.4 菜单与素材

```
US-07: 作为运营人员，我希望通过可视化编辑器拖拽创建公众号菜单，
       以便无需技术能力即可配置复杂的菜单结构。

验收标准:
- 拖拽排序，最多 3 级菜单
- 支持点击推事件/跳转URL/小程序/扫码带参四种菜单类型
- 菜单发布前预览效果
- 支持保存为菜单模板，一键应用到其他公众号

US-08: 作为运营人员，我希望统一管理图片/视频/图文素材，
       以便在消息回复、群发、菜单配置时快速选用。

验收标准:
- 支持上传图片（≤10MB）和视频（≤10MB）
- 前端上传前校验文件大小和格式
- 素材按分类/标签组织，支持搜索
- 记录每个素材的使用次数
```

### 4.5 数据统计

```
US-09: 作为运营经理，我希望查看粉丝增长趋势和消息交互数据，
       以便评估运营效果并调整策略。

验收标准:
- 粉丝趋势：新增/取关/净增/总量，支持日/周/月粒度切换
- 消息交互：发送数/接收数/回复率，带同比环比
- 图文分析：阅读量/点赞/分享/阅读来源分布
- 支持选择时间范围和数据导出
```

---

## 5. 功能需求详述

### 5.1 第三方平台授权管理 (M01)

**功能描述**: 对接微信开放平台第三方平台 API，实现公众号授权的完整生命周期管理。

**核心流程**:
```
1. 平台在微信开放平台注册为第三方平台（获得 component_appid + component_appsecret）
2. 配置消息校验 Token + 加解密 Key + 授权事件接收 URL
3. 微信每隔 10 分钟推送 component_verify_ticket 到事件接收 URL
4. 运营人员在平台生成授权二维码/链接
5. 公众号管理员扫码，在微信侧确认授权
6. 微信回调通知平台「授权成功」，平台获取 authorizer_access_token
7. 平台定时刷新 Token，监控到期状态
```

**接口依赖**:

| 微信 API | 用途 | 频率限制 |
|----------|------|----------|
| `/cgi-bin/component/api_start_push_ticket` | 启动 ticket 推送 | — |
| `/cgi-bin/component/api_component_token` | 获取 component_access_token | 2000次/天 |
| `/cgi-bin/component/api_create_preauthcode` | 生成预授权码 | 2000次/天 |
| `/cgi-bin/component/api_query_auth` | 使用授权码换取 authorizer_access_token | 2000次/天 |
| `/cgi-bin/component/api_authorizer_token` | 刷新 authorizer_access_token | 2000次/天 |
| `/cgi-bin/component/api_get_authorizer_info` | 获取授权方基本信息 | 2000次/天 |

**数据结构**:

```prisma
model ComponentApp {
  id              String   @id @default(cuid())
  appId           String   @unique        // component_appid
  appSecret       String   @encrypted     // component_appsecret (AES-256-GCM)
  token           String                  // 消息校验 Token
  encodingAesKey  String   @encrypted     // 消息加解密 Key
  verifyTicket    String?  @encrypted     // component_verify_ticket
  accessToken     String?  @encrypted     // component_access_token
  tokenExpireAt   DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model Authorizer {
  id                String    @id @default(cuid())
  tenantId          String
  componentAppId    String
  appId             String    @unique        // 授权方 appid
  appType           Int                      // 0=订阅号, 1=订阅号(转服务号), 2=服务号
  nickName          String                   // 公众号昵称
  headImg           String?                  // 公众号头像 URL
  qrcodeUrl         String?                  // 公众号二维码 URL
  principalName     String?                  // 主体名称
  accessToken       String?   @encrypted     // authorizer_access_token
  refreshToken      String?   @encrypted     // authorizer_refresh_token
  tokenExpireAt     DateTime?
  funcInfo          Json                     // 授权权限集
  status            String    @default("authorized")  // authorized | expired | revoked
  authorizedAt      DateTime  @default(now())
  expiredAt         DateTime?                // 授权到期时间
  lastSyncAt        DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  deletedAt         DateTime?

  @@index([tenantId])
  @@index([tenantId, status])
  @@map("authorizers")
}
```

**技术风险**:
- `component_verify_ticket` 若丢失会导致整个平台 Token 刷新失败。必须持久化存储 + 监控告警
- 微信回调 URL 必须在 5 秒内返回 `success`，加解密逻辑必须高性能
- Token 刷新与业务请求存在竞态条件，需设计分布式锁避免重复刷新

### 5.2 多公众号统一管理 (M02)

**功能描述**: 提供公众号列表视图、分组管理和基本信息同步能力。

**页面结构**:
```
/accounts                    → 公众号列表页（卡片/表格视图切换）
/accounts/:authorizerId      → 公众号详情页（基本信息 + 数据概览）
/accounts/groups             → 分组管理页
```

**核心交互**:
- 顶栏账号切换器：展示当前账号头像+昵称，点击下拉切换
- 分组侧边栏：树形分组结构，支持拖拽账号到分组
- 批量操作栏：选中多个账号后出现批量操作工具栏

### 5.3 粉丝管理 (M03)

**页面结构**:
```
/followers                         → 粉丝列表页
/followers/:openId                 → 粉丝详情页（画像 + 互动历史）
/followers/tags                    → 标签管理页
/followers/tags/rules              → 标签规则引擎
/followers/blacklist               → 黑名单管理
```

**标签规则引擎设计**:
```json
{
  "name": "活跃用户",
  "conditions": [
    { "field": "interact_count", "operator": "gte", "value": 5 },
    { "field": "last_interact_days", "operator": "lte", "value": 30 }
  ],
  "logic": "AND"
}
```

**粉丝画像维度**:
- 性别分布（饼图）
- 地域分布（中国地图热力图）
- 关注来源分布（柱状图：公众号搜索/扫描二维码/名片分享/文章内关注等）
- 设备分布（iOS/Android/未知）
- 互动频次分布（近 30 天互动次数分段统计）

**风险**:
- 微信用户管理接口有同步延迟，粉丝数据不是实时的
- `openid` 在不同公众号间不互通，需基于 `unionid`（需授权）关联
- 粉丝量大（百万级）时列表查询需要游标分页 + 虚拟滚动

### 5.4 消息管理 (M04)

**页面结构**:
```
/messages/auto-reply              → 自动回复配置
/messages/auto-reply/follow       → 关注回复编辑
/messages/auto-reply/keyword      → 关键词回复列表
/messages/auto-reply/default      → 默认回复编辑
/messages/broadcast               → 消息群发
/messages/broadcast/history       → 群发历史
/messages/templates               → 模板消息管理
```

**关键词匹配优先级**:
```
1. 精确匹配（优先级最高）
2. 模糊匹配（包含关键词即匹配）
3. 正则匹配（按规则创建时间倒序匹配）
4. 默认回复（无匹配时兜底）
```

**群发限制（微信平台约束）**:
- 订阅号：每天 1 次
- 服务号：每月 4 次
- 平台需在前端展示剩余群发次数

### 5.5 素材管理 (M05)

**页面结构**:
```
/materials                        → 素材库首页
/materials/images                 → 图片素材
/materials/videos                 → 视频素材
/materials/news                   → 图文素材
```

**前端校验规则**:
- 图片：≤ 10MB，格式 jpg/jpeg/png/gif，建议尺寸 900×500px（封面图）
- 视频：≤ 10MB，格式 mp4，建议时长 ≤ 3 分钟
- 图文：标题 ≤ 64 字符，封面图必填

**素材同步策略**:
- 平台上传的素材同步到微信服务器（获取 media_id）
- 微信侧的素材变更（通过其他途径上传）定期拉取同步
- 素材删除后 media_id 失效，关联引用需标记

### 5.6 菜单管理 (M06)

**页面结构**:
```
/menu                             → 菜单编辑器
/menu/templates                   → 菜单模板库
/menu/history                     → 发布历史
```

**菜单编辑画布**:
- 左侧：组件面板（菜单项类型列表）
- 中间：手机预览框（实时渲染菜单效果）
- 右侧：属性配置面板（选中菜单项后的详细配置）

**菜单数据结构**:
```json
{
  "button": [
    {
      "type": "click",
      "name": "今日推荐",
      "key": "TODAY_RECOMMEND",
      "sub_button": [
        { "type": "view", "name": "热门文章", "url": "https://..." },
        { "type": "miniprogram", "name": "小程序", "appid": "wx...", "pagepath": "pages/index" }
      ]
    },
    { "type": "view", "name": "关于我们", "url": "https://..." }
  ]
}
```

**约束**:
- 一级菜单最多 3 个，二级菜单最多 5 个
- 菜单名称 ≤ 4 个汉字（一级）/ ≤ 7 个汉字（二级）
- 发布后 24 小时内生效（客户端缓存）

**风险**:
- 菜单发布不可撤回（只能覆盖发布），需前端二次确认
- 个性化菜单与默认菜单存在优先级冲突，MVP 仅支持默认菜单

### 5.7 数据统计 (M07)

**页面结构**:
```
/dashboard                        → 数据总览看板
/dashboard/followers              → 粉丝数据分析
/dashboard/messages               → 消息交互分析
/dashboard/news                   → 图文分析
```

**数据获取策略**:
```
策略 1（实时数据）: 平台自身数据库 → 粉丝/标签/消息量基础计数
策略 2（T+1 数据）: 微信数据接口 → 用户分析/图文分析/消息分析
策略 3（历史数据）: 定时任务异步拉取 → 写入时序表 → 前端查询
```

**看板指标清单**:

| 分类 | 指标 | 图表类型 | 时间粒度 |
|------|------|----------|----------|
| 粉丝趋势 | 新关注/取关/净增/累计 | 折线图（多系列） | 日/周/月 |
| 粉丝属性 | 性别/地域/来源 | 饼图+地图+柱状图 | 最新快照 |
| 消息交互 | 发送数/接收数/回复率 | 折线图+数值卡片 | 日/周/月 |
| 图文分析 | 阅读量/点赞/分享/来源 | 表格+柱状图 | 按文章 |
| 菜单点击 | 各菜单项点击次数 | 表格+饼图 | 日/周/月 |

**风险**:
- 微信数据接口有 T+1 延迟，看板需标注数据更新时间
- 微信接口返回的数据仅保留最近 30 天，历史数据需自行存储
- 部分数据接口仅对服务号开放，订阅号需降级处理

---

## 6. 非功能需求

### 6.1 性能要求

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 首屏加载 LCP | < 2s | Lighthouse (3G 模拟) |
| 首屏加载 FCP | < 1.5s | Lighthouse (3G 模拟) |
| API 响应时间 P95 | < 500ms | Prometheus + Grafana |
| 粉丝列表（10万+）渲染 | < 1s 可交互 | 虚拟滚动 |
| 微信 Token 刷新成功率 | > 99.9% | 日志统计 |
| 并发授权扫码 QPS | ≥ 100 | 压测 |

### 6.2 安全要求

- 微信 API 凭证使用 AES-256-GCM 加密存储（数据库字段级加密）
- 所有对外 API 使用 JWT 认证 + 租户隔离校验
- 敏感操作（授权回收、批量删除）二次确认 + 操作日志
- 接口限流：单租户 100 req/s，单 IP 50 req/s（滑动窗口）
- 用户数据脱敏：手机号中间 4 位、地址门牌号隐藏
- 数据库连接 SSL/TLS，Redis 密码认证
- 遵循《个人信息保护法》（PIPL），用户数据使用需明确告知

### 6.3 可用性要求

- 系统可用性 ≥ 99.5%（允许月度宕机 ≤ 3.6 小时）
- 微信回调接口可用性 ≥ 99.9%（Ticket 丢失影响全平台）
- Token 刷新失败自动重试 3 次，仍失败立即告警
- 数据库每日全量备份 + WAL 归档（PITR）

### 6.4 可扩展性

- 微服务架构：核心业务服务独立部署、独立扩缩容
- 数据库：支持读写分离（Prisma 配置多数据源）
- 缓存：Redis Cluster 模式，支持水平扩展
- 消息队列：Kafka 分区策略，消费者组弹性伸缩

---

## 7. 成功指标（MVP）

| 类别 | 指标 | 目标（MVP 上线 3 个月） |
|------|------|--------------------------|
| 产品 | 授权公众号数 | ≥ 100 |
| 产品 | 周活跃运营人员 | ≥ 50 |
| 技术 | Token 自动刷新成功率 | ≥ 99.9% |
| 技术 | API P95 延迟 | < 500ms |
| 技术 | 生产事故次数 | < 2 次/月 |
| 用户 | 核心功能（粉丝/消息/菜单）周使用率 | ≥ 60% |
| 用户 | 用户满意度 NPS | ≥ 30 |

---

## 8. 风险与假设

### 8.1 关键假设

| 假设 | 验证方式 | 降级方案 |
|------|----------|----------|
| 目标用户有多个公众号需要管理 | 种子用户访谈 | — |
| 目标用户愿意为运营效率工具付费 | MVP 免费试用 + 付费转化漏斗分析 | — |
| 微信开放平台审核能通过 | 提前对接微信审核要求，准备资质材料 | 自建应用模式过渡 |
| 微信 API 稳定可用 | 建立 API 监控 + 降级策略 | 本地缓存兜底 |

### 8.2 核心风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 微信 API 接口变更或限频加严 | 中 | 高 | Token 缓存、限流器、灰度适配 |
| component_verify_ticket 推送中断 | 低 | 极高 | 分布式存储 + 监控告警 + 手动补推 |
| 第三方平台审核不通过 | 中 | 极高 | 提前准备材料、自建应用过渡 |
| 粉丝数据量过大导致查询慢 | 高 | 中 | 分表、ES 搜索、虚拟滚动 |
| 竞品快速跟进 | 中 | 中 | 聚焦 P1 差异化功能快速迭代 |

---

## 9. 发布计划

```
Phase 0: 需求澄清 + 技术设计    → Week 1-2   (当前)
Phase 1: 项目脚手架搭建          → Week 3
Phase 2: Sprint 1 — 授权 + 账号  → Week 4-5
Phase 3: Sprint 2 — 粉丝 + 消息  → Week 6-7
Phase 4: Sprint 3 — 素材 + 菜单 + 数据 → Week 8-9
Phase 5: 集成测试 + 微信沙箱联调  → Week 10
Phase 6: 内部 Alpha 测试          → Week 11
Phase 7: 种子用户 Beta 测试       → Week 12
Phase 8: MVP 正式发布             → Week 13
```

---

## 10. 附录

### 10.1 术语表

| 术语 | 说明 |
|------|------|
| component_appid | 第三方平台在微信开放平台的唯一标识 |
| component_appsecret | 第三方平台密钥 |
| component_verify_ticket | 微信推送的票据，用于获取 component_access_token |
| component_access_token | 第三方平台接口凭证 |
| authorizer_appid | 授权方（公众号）的 appid |
| authorizer_access_token | 授权方接口凭证，有效期 2 小时 |
| authorizer_refresh_token | 授权方刷新凭证，用于刷新 access_token |
| openid | 用户在每个公众号下的唯一标识 |
| unionid | 用户在同一开放平台主体下的唯一标识 |

### 10.2 参考文档

- [微信开放平台第三方平台 API](https://developers.weixin.qq.com/doc/oplatform/Third-party_Platforms/2.0/api/Before_Develop/Technical_Plan.html)
- [微信公众号开发文档](https://developers.weixin.qq.com/doc/offiaccount/Getting_Started/Overview.html)
- [微信开放平台运营规范](https://developers.weixin.qq.com/doc/oplatform/Third-party_Platforms/2.0/operation/operation.html)
- [NestJS 官方文档](https://docs.nestjs.com/)
- [Prisma ORM 文档](https://www.prisma.io/docs)
- [TanStack Query 文档](https://tanstack.com/query/latest)
- [Ant Design 5.x 文档](https://ant.design/)

### 10.3 变更记录

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| v1.0.0 | 2026-05-29 | 初始版本，MVP 范围定义 | Architecture Team |

---

> **下一步**: 进入 Phase 1 — 技术设计阶段，输出微服务拆分方案、完整 Prisma Schema、API 接口文档和授权流程时序图。
