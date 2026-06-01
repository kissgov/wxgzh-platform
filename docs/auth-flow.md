# 微信公众号第三方平台 — 授权流程设计

> 版本: v1.0.0 | 日期: 2026-05-29

---

## 1. 第三方平台注册与 Ticket 推送

```mermaid
sequenceDiagram
    participant Admin as 平台管理员
    participant WXOpen as 微信开放平台
    participant Platform as 运营平台
    participant DB as PostgreSQL
    participant Redis as Redis

    Note over Admin,WXOpen: Step 1: 注册第三方平台
    Admin->>WXOpen: 提交平台信息（名称/简介/权限集）
    WXOpen->>WXOpen: 审核（3-7 工作日）
    WXOpen-->>Admin: 审核通过 → 获得 component_appid + component_appsecret
    Admin->>Platform: 配置 component_appid/secret/token/aesKey
    Platform->>DB: 存储 ComponentApp (secret/aesKey 加密)
    Platform->>Platform: 验证 Token + EncodingAESKey 有效性

    Note over WXOpen,Redis: Step 2: Ticket 推送（每 10 分钟/次）
    loop 每 10 分钟
        WXOpen->>Platform: POST /webhook/wechat/{appId} (加密 XML)
        Note right of Platform: WechatMessagePipe 验签+解密
        Platform->>DB: 存储 component_verify_ticket
        Platform->>Redis: SET ticket:{appId} <ticket> EX 1800
        Platform-->>WXOpen: HTTP 200 "success"
        Note right of Platform: 必须在 5 秒内响应
    end
```

## 2. 公众号授权流程（完整链路）

```mermaid
sequenceDiagram
    actor Operator as 运营人员
    actor MPAdmin as 公众号管理员
    participant Web as 前端 React SPA
    participant API as NestJS API
    participant WXOpen as 微信开放平台
    participant WXMP as 微信公众号后台
    participant DB as PostgreSQL
    participant Redis as Redis

    Note over Operator,Redis: === 授权发起 ===
    Operator->>Web: 点击「添加公众号」
    Web->>API: POST /platform/auth-url
    API->>Redis: GET component_access_token
    alt Token 未缓存或已过期
        API->>Redis: SET token:lock:component NX EX 10
        API->>DB: 查询 component_verify_ticket
        API->>WXOpen: POST /api_component_token (appid + ticket)
        WXOpen-->>API: component_access_token (7200s)
        API->>Redis: SET token:component <token> EX 7000
        API->>Redis: DEL token:lock:component
    end
    API->>WXOpen: POST /api_create_preauthcode
    WXOpen-->>API: pre_auth_code (600s)
    API-->>Web: auth_url + qr_code_url

    Web-->>Operator: 展示授权二维码
    Operator->>MPAdmin: 发送授权二维码给客户

    Note over MPAdmin,Redis: === 公众号管理员扫码授权 ===
    MPAdmin->>WXMP: 使用公众号管理员微信扫码
    WXMP-->>MPAdmin: 展示授权确认页（权限列表）
    MPAdmin->>WXMP: 确认授权

    Note over WXOpen,Redis: === 微信回调通知 ===
    WXOpen->>API: POST /webhook/wechat/{appId} (授权成功通知)
    Note right of API: WechatMessagePipe 解密验证
    API-->>WXOpen: "success" (5秒内)
    API->>DB: 存储 AuthEvent (eventType=authorized, rawXml)

    Note over API,Redis: === 异步换取 Token（EventEmitter 触发）===
    API->>WXOpen: POST /api_query_auth (authorization_code)
    WXOpen-->>API: authorizer_appid + access_token + refresh_token + func_info
    API->>WXOpen: POST /api_get_authorizer_info
    WXOpen-->>API: 公众号基本信息 (nickName/headImg/qrcodeUrl/...)
    API->>DB: UPSERT Authorizer (Token 加密存储)
    API->>Redis: SET token:authorizer:{appId} <access_token> EX 7000
    API->>DB: 创建初始同步任务 (SyncTask: follower_sync)
    API-->>Web: WebSocket 推送「授权成功」

    Web-->>Operator: 显示新授权的公众号（自动刷新列表）
```

## 3. Token 刷新与竞态控制

```mermaid
sequenceDiagram
    participant Req1 as 业务请求 A
    participant Req2 as 业务请求 B
    participant WXSV as WechatService
    participant Redis as Redis
    participant WXOpen as 微信开放平台

    Note over Req1,WXOpen: 场景：Token 即将过期，两个请求同时到达

    Req1->>WXSV: getAuthorizerToken(authorizerId)
    Req2->>WXSV: getAuthorizerToken(authorizerId)

    WXSV->>Redis: GET token:authorizer:{id}
    Redis-->>WXSV: null (已过期)

    Note over Req1,Req2: 分布式锁竞争（仅持锁者调用微信 API）

    Req1->>Redis: SET token:lock:{id} req1 NX EX 10
    Redis-->>Req1: OK (获取锁成功)
    Req2->>Redis: SET token:lock:{id} req2 NX EX 10
    Redis-->>Req2: nil (获取锁失败)

    Req1->>DB: 查询 refresh_token (解密)
    Req1->>WXOpen: POST /api_authorizer_token
    WXOpen-->>Req1: new_access_token + new_refresh_token
    Req1->>DB: 更新 access_token + refresh_token（加密）
    Req1->>Redis: SET token:authorizer:{id} <new_token> EX 7000
    Req1->>Redis: DEL token:lock:{id}
    Req1-->>Req1: 返回 new_token

    Note over Req2: 自旋等待 + 重试
    loop 最多 3 次，间隔 100ms
        Req2->>Redis: GET token:authorizer:{id}
        alt 缓存已更新
            Redis-->>Req2: new_token ✓
            Req2-->>Req2: 返回 new_token
            Note over Req2: 重试成功，退出循环
        else 仍未就绪
            Req2->>Req2: sleep 100ms
        end
    end

    Note over Req2: 3 次重试耗尽 → 抛出 BusinessException
```

## 4. 微信消息回调处理流程

```mermaid
sequenceDiagram
    participant WXServer as 微信服务器
    participant WebhookCtl as WechatWebhookController
    participant Pipe as WechatMessagePipe
    participant Crypto as WechatCryptoService
    participant Emitter as EventEmitter
    participant Platform as PlatformService
    participant Message as MessageService
    participant TaskQ as BullMQ Queue

    WXServer->>WebhookCtl: POST /webhook/wechat/{appId}?signature=...&timestamp=...&nonce=...
    Note right of WXServer: 加密的 XML 消息体

    WebhookCtl->>Pipe: transform(encryptedBody)

    rect rgb(240, 248, 255)
        Note over Pipe,Crypto: WechatMessagePipe 处理链
        Pipe->>Crypto: checkSignature(signature, timestamp, nonce)
        Crypto->>Crypto: SHA1(token, timestamp, nonce, content)
        alt 签名不匹配
            Crypto-->>Pipe: ❌ 非法请求
            Pipe-->>WebhookCtl: 403 Forbidden
        end
        Pipe->>Crypto: decrypt(encryptedXml)
        Crypto->>Crypto: Base64.decode → AES.decrypt → PKCS7.unpad
        Crypto-->>Pipe: 明文 XML
        Pipe->>Pipe: XML → WechatEventDto
        Pipe-->>WebhookCtl: WechatEventDto
    end

    WebhookCtl-->>WXServer: HTTP 200 "success"
    Note right of WebhookCtl: 必须 5 秒内返回

    WebhookCtl->>Emitter: emit(wechat.event.received)

    alt event = component_verify_ticket
        Emitter->>Platform: 存储 ticket → 刷新 component_token
    else event = authorized
        Emitter->>Platform: 换取 authorizer_token → 同步信息
    else event = unauthorized
        Emitter->>Platform: 标记 revoked
    else event = text/image/voice (粉丝消息)
        Emitter->>Message: handleIncomingMessage()
        Message->>Message: 基于 MsgId 去重 (Redis SETNX)
        Message->>TaskQ: 排队: 匹配自动回复规则
        Note right of TaskQ: 异步处理不阻塞回调响应
        TaskQ->>Message: 匹配规则 → 生成回复
        Message->>Message: 调用微信客服消息 API 回复
    else event = subscribe/unsubscribe
        Emitter->>Platform: 更新 Follower 状态
    end
```

## 5. 授权到期预警流程

```mermaid
sequenceDiagram
    participant Cron as 定时任务 (每日)
    participant API as NestJS Scheduler
    participant DB as PostgreSQL
    participant Redis as Redis
    participant BullMQ as BullMQ Queue
    actor Operator as 运营人员

    Note over Cron,BullMQ: 每日凌晨执行
    Cron->>API: @Cron('0 0 2 * * *')
    API->>DB: SELECT * FROM authorizers WHERE status='authorized' AND expired_at <= NOW() + INTERVAL '7 days'
    DB-->>API: 即将到期的公众号列表

    loop 每个即将到期的公众号
        API->>BullMQ: 排队: 发送预警通知
    end

    BullMQ->>BullMQ: 处理预警任务
    Note over BullMQ: 站内通知 + 邮件/短信

    BullMQ-->>Operator: 「某某科技」公众号授权将在 7 天后到期，请及时续期
```

---

## 6. 核心数据结构流转

```
微信回调 (XML 加密)
  │
  ├─ WechatMessagePipe
  │   ├─ checkSignature(SHA1) → bool
  │   ├─ decrypt(AES-256-CBC-PKCS7) → XML String
  │   └─ parse(xml2js) → WechatEventDto
  │
  ├─ EventEmitter.emit(event)
  │   ├─ 'component_verify_ticket'
  │   │   └─ ComponentApp.verifyTicket (DB)
  │   │   └─ [触发] refreshComponentToken()
  │   │       └─ POST /api_component_token → component_access_token (Redis, 7000s)
  │   │
  │   ├─ 'authorized'
  │   │   └─ AuthEvent (DB)
  │   │   └─ [触发] queryAuth()
  │   │       └─ POST /api_query_auth → authorizer_access_token + refresh_token
  │   │       └─ [触发] getAuthorizerInfo()
  │   │           └─ POST /api_get_authorizer_info → 基本信息
  │   │           └─ Upsert Authorizer (DB)
  │   │           └─ authorizer_access_token → Redis (7000s)
  │   │
  │   ├─ 'unauthorized'
  │   │   └─ Authorizer.status = 'revoked' (DB)
  │   │   └─ 清理 Redis 缓存 + 操作日志
  │   │
  │   └─ 'message/text/image/voice/video/location/link/event'
  │       └─ MessageLog (DB, INSERT ... ON CONFLICT(msgId) DO NOTHING)
  │       └─ [异步] 匹配自动回复规则
  │           ├─ 精确匹配 → 模糊匹配 → 正则匹配 → 默认回复
  │           └─ 调用微信客服消息 API 回复
  │       └─ [异步] 更新 Follower 互动计数
  │       └─ [异步] 触发标签规则评估
  │       └─ [异步, event=subscribe] Follower.upsert (openid)
  │       └─ [异步, event=unsubscribe] Follower.subscribe = false
```
