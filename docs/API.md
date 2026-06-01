# 微信公众号第三方运营管理平台 — API 接口文档

> 版本: v1.0.0 | 规范: RESTful + OpenAPI 3.0 | 日期: 2026-05-29

---

## 1. 通用约定

### 1.1 基础 URL

```
开发环境: http://localhost:3000/api/v1
生产环境: https://api.wxgzh.example.com/api/v1
```

### 1.2 统一响应格式

```typescript
interface ApiResponse<T> {
  code: number;       // 0 = 成功，非 0 = 业务错误码
  message: string;    // 人类可读的消息
  data: T;            // 响应数据
  trace_id: string;   // 请求追踪 ID（UUID v4）
}

interface PaginatedResponse<T> {
  list: T[];
  total: number;       // 总记录数
  page: number;        // 当前页码
  page_size: number;   // 每页条数
}
```

### 1.3 认证方式

```
Authorization: Bearer <jwt_access_token>
X-Tenant-Id: <tenant_slug>    // 可选，从 JWT 自动提取
```

### 1.4 业务错误码

| 错误码 | HTTP 状态码 | 说明 |
|--------|------------|------|
| 0 | 200 | 成功 |
| 10001 | 400 | 参数校验失败 |
| 10002 | 401 | 未认证 / Token 过期 |
| 10003 | 403 | 无权限 |
| 10004 | 404 | 资源不存在 |
| 10005 | 409 | 资源冲突（重复创建等） |
| 10006 | 429 | 请求频率超限 |
| 20001 | 502 | 微信 API 调用失败 |
| 20002 | 502 | 微信 Token 过期 |
| 20003 | 503 | 微信 API 限频 |
| 30001 | 500 | 服务器内部错误 |
| 30002 | 500 | 数据库操作失败 |

### 1.5 分页参数

```
Query: ?page=1&page_size=20&sort=created_at&order=desc
范围: page ≥ 1, page_size ∈ [1, 100], 默认 20
```

---

## 2. 认证模块 (Auth)

### 2.1 登录

```
POST /auth/login
Content-Type: application/json

Request:
{
  "email": "user@example.com",
  "password": "password123"
}

Response:
{
  "code": 0,
  "data": {
    "access_token": "eyJhbG...",
    "refresh_token": "8a7b3c...",
    "expires_in": 7200,
    "user": {
      "id": "clx...",
      "name": "张三",
      "email": "user@example.com",
      "avatar": "https://...",
      "roles": ["admin"],
      "permissions": ["follower:read", "follower:write", "menu:publish"]
    }
  }
}
```

### 2.2 刷新 Token

```
POST /auth/refresh
Content-Type: application/json

Request:
{
  "refresh_token": "8a7b3c..."
}

Response: (同登录响应)
```

---

## 3. 第三方平台授权 (M01 — Platform)

### 3.1 生成授权二维码

```
POST /platform/auth-url
Authorization: Bearer <token>

Request:
{
  "authorizerId": null     // 可选，re-authorize 时传入
}

Response:
{
  "code": 0,
  "data": {
    "pre_auth_code": "preauthcode@@@...",
    "auth_url": "https://mp.weixin.qq.com/cgi-bin/componentloginpage?component_appid=...&pre_auth_code=...",
    "qr_code_url": "https://...",        // 授权二维码图片 URL
    "expires_in": 600                     // 10 分钟有效
  }
}
```

### 3.2 授权列表

```
GET /platform/authorizers?page=1&page_size=20&status=authorized&keyword=公众号名称

Response:
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "clx...",
        "appId": "wxabc123...",
        "nickName": "某某科技",
        "headImg": "https://...",
        "appType": 2,                     // 0=订阅号 1=升级服务号 2=服务号
        "status": "authorized",
        "totalFollowers": 15230,
        "authorizedAt": "2026-05-01T10:00:00Z",
        "expiredAt": "2027-05-01T10:00:00Z",
        "funcInfo": [{ "funcscope_category": { "id": 1 } }]
      }
    ],
    "total": 42,
    "page": 1,
    "page_size": 20
  }
}
```

### 3.3 授权详情

```
GET /platform/authorizers/:authorizerId

Response:
{
  "code": 0,
  "data": {
    "id": "clx...",
    "appId": "wxabc123...",
    "nickName": "某某科技",
    "headImg": "https://...",
    "qrcodeUrl": "https://...",
    "principalName": "某某科技有限公司",
    "signature": "专注科技资讯分享",
    "appType": 2,
    "funcInfo": [...],
    "serviceInfo": { "nick_name": "服务商名称" },
    "verifyInfo": { "type": 0 },
    "status": "authorized",
    "tokenExpireAt": "2026-05-29T14:00:00Z",
    "lastSyncAt": "2026-05-29T12:30:00Z"
  }
}
```

### 3.4 回收授权

```
POST /platform/authorizers/:authorizerId/revoke

Response:
{
  "code": 0,
  "data": { "status": "revoked", "revokedAt": "2026-05-29T12:00:00Z" }
}
```

### 3.5 同步公众号基本信息

```
POST /platform/authorizers/:authorizerId/sync

Response:
{
  "code": 0,
  "data": { "syncedAt": "2026-05-29T12:30:00Z" }
}
```

---

## 4. 公众号管理 (M02 — Accounts)

### 4.1 公众号列表

```
GET /accounts?page=1&page_size=20&groupId=clx...&keyword=名称搜索

Response: (同 GET /platform/authorizers，增加分组信息)
{
  "code": 0,
  "data": {
    "list": [
      {
        ...授权信息,
        "groups": [{ "id": "clx...", "name": "电商客户" }]
      }
    ],
    "total": 42,
    "page": 1,
    "page_size": 20
  }
}
```

### 4.2 分组管理

```
GET    /accounts/groups                     // 获取分组树
POST   /accounts/groups                     // 创建分组
PUT    /accounts/groups/:groupId            // 编辑分组
DELETE /accounts/groups/:groupId            // 删除分组

POST   /accounts/groups/:groupId/items      // 添加公众号到分组
DELETE /accounts/groups/:groupId/items/:itemId  // 从分组移除
```

---

## 5. 粉丝管理 (M03 — Followers)

### 5.1 粉丝列表

```
GET /followers?page=1&page_size=50&tagId=clx...&keyword=昵称搜索&subscribeSince=2026-01-01&subscribeUntil=2026-05-29&sex=&province=

Response:
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "clx...",
        "openid": "oABC123...",
        "nickname": "微信用户",
        "headImg": "https://...",
        "sex": 1,
        "province": "广东",
        "city": "深圳",
        "subscribe": true,
        "subscribeAt": "2026-01-15T08:30:00Z",
        "subscribeScene": "ADD_SCENE_QR_CODE",
        "interactCount": 23,
        "lastInteractAt": "2026-05-28T18:00:00Z",
        "tags": [
          { "id": "clx...", "name": "活跃用户", "color": "#1677FF" },
          { "id": "clx...", "name": "VIP客户", "color": "#F5222D" }
        ],
        "remark": "重点维护"
      }
    ],
    "total": 15230,
    "page": 1,
    "page_size": 50
  }
}
```

### 5.2 粉丝详情

```
GET /followers/:followerId

Response:
{
  "code": 0,
  "data": {
    ...基本信息（同列表）,
    "country": "中国",
    "qrScene": "qrscene_123",
    "qrSceneStr": "推广海报-张三",
    "extra": { ... },
    "interactionHistory": {
      "last7Days": 5,
      "last30Days": 12
    }
  }
}
```

### 5.3 标签管理

```
GET    /followers/tags                      // 标签列表
POST   /followers/tags                      // 创建标签
PUT    /followers/tags/:tagId               // 编辑标签
DELETE /followers/tags/:tagId               // 删除标签

POST   /followers/tags/batch                // 批量打标签
Request: { "followerIds": ["..."], "tagIds": ["..."] }

DELETE /followers/tags/batch                // 批量移除标签
Request: { "followerIds": ["..."], "tagIds": ["..."] }
```

### 5.4 标签规则引擎

```
GET    /followers/tags/rules                // 规则列表
POST   /followers/tags/rules                // 创建规则
Request:
{
  "name": "活跃用户",
  "conditions": [
    { "field": "interactCount", "operator": "gte", "value": 5 },
    { "field": "lastInteractAt", "operator": "days_ago_lte", "value": 30 }
  ],
  "logic": "AND",
  "targetTagId": "clx..."
}

PUT    /followers/tags/rules/:ruleId        // 编辑规则
DELETE /followers/tags/rules/:ruleId        // 删除规则
POST   /followers/tags/rules/:ruleId/execute  // 手动执行规则
```

**规则支持的操作符**:
```
数值: eq | neq | gt | gte | lt | lte
时间: days_ago_gt | days_ago_gte | days_ago_lt | days_ago_lte
字符串: contains | not_contains | starts_with | ends_with
枚举: in | not_in
```

### 5.5 黑名单

```
GET    /followers/blacklist                 // 黑名单列表
POST   /followers/:followerId/blacklist     // 拉黑
DELETE /followers/:followerId/blacklist     // 移除黑名单
```

### 5.6 粉丝画像

```
GET /followers/portrait?authorizerId=clx...

Response:
{
  "code": 0,
  "data": {
    "gender": { "male": 0.52, "female": 0.45, "unknown": 0.03 },
    "region": { "top": [{ "province": "广东", "count": 3200 }, ...] },
    "source": [
      { "scene": "公众号搜索", "count": 5200, "ratio": 0.34 },
      { "scene": "扫描二维码", "count": 3800, "ratio": 0.25 },
      { "scene": "名片分享", "count": 2800, "ratio": 0.18 },
      { "scene": "文章内关注", "count": 2100, "ratio": 0.14 },
      { "scene": "其他", "count": 1330, "ratio": 0.09 }
    ],
    "device": { "ios": 0.38, "android": 0.59, "unknown": 0.03 },
    "interactionFrequency": {
      "high": 1200, "medium": 4500, "low": 7800, "inactive": 1730
    }
  }
}
```

---

## 6. 消息管理 (M04 — Messages)

### 6.1 自动回复规则

```
GET    /messages/auto-reply?type=follow|keyword|default   // 规则列表
POST   /messages/auto-reply                                // 创建规则
Request:
{
  "ruleType": "keyword",
  "name": "产品咨询",
  "status": "enabled",
  "keywordReplies": [
    { "matchType": "exact", "keyword": "产品" },
    { "matchType": "fuzzy", "keyword": "价格" }
  ],
  "replyContents": [
    { "contentType": "text", "content": "您好，请问想了解哪款产品？", "sortOrder": 0 },
    { "contentType": "news", "content": "{\"title\":\"产品手册\",\"media_id\":\"...\"}", "sortOrder": 1 }
  ]
}

PUT    /messages/auto-reply/:ruleId                        // 编辑规则
DELETE /messages/auto-reply/:ruleId                        // 删除规则
PATCH  /messages/auto-reply/:ruleId/toggle                 // 启用/禁用
```

### 6.2 消息群发

```
POST   /messages/broadcast                                 // 创建群发
Request:
{
  "msgType": "text",
  "content": { "text": "尊敬的用户，我们推出了新功能..." },
  "targetType": "tag",
  "targetConfig": { "tagId": "clx..." }
}
Response: { "code": 0, "data": { "id": "clx...", "status": "draft" } }

POST   /messages/broadcast/:id/send                        // 发送群发
GET    /messages/broadcast/:id                             // 查询群发详情
GET    /messages/broadcast/:id/progress                    // 查询发送进度

Response (progress):
{
  "code": 0,
  "data": {
    "status": "sending",
    "totalTarget": 5000,
    "sentCount": 3200,
    "errorCount": 12,
    "progress": 0.64
  }
}
```

### 6.3 消息记录

```
GET /messages/logs?authorizerId=clx...&direction=inbound|outbound&msgType=text&keyword=搜索内容&page=1&page_size=50

Response:
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "clx...",
        "follower": { "nickname": "微信用户", "headImg": "https://..." },
        "direction": "inbound",
        "msgType": "text",
        "content": "你好",
        "replyRuleId": null,
        "createdAt": "2026-05-29T10:30:00Z"
      },
      {
        "id": "clx...",
        "follower": { "nickname": "微信用户", "headImg": "https://..." },
        "direction": "outbound",
        "msgType": "text",
        "content": "您好，请问有什么可以帮您？",
        "replyRuleId": "clx...",
        "createdAt": "2026-05-29T10:30:01Z"
      }
    ],
    "total": 1250,
    "page": 1,
    "page_size": 50
  }
}
```

---

## 7. 素材管理 (M05 — Materials)

### 7.1 素材 CRUD

```
GET    /materials?type=image&category=封面图&keyword=名称&page=1&page_size=20
POST   /materials                              // 上传素材（multipart/form-data）
Request:
  file: binary                                 // 文件
  name: "产品封面图"
  category: "封面图"
  tags: ["产品", "封面"]

PUT    /materials/:materialId                  // 编辑素材信息（分类/标签/名称）
DELETE /materials/:materialId                  // 删除素材

Response (列表):
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "clx...",
        "type": "image",
        "name": "产品封面图",
        "url": "https://minio.xxx.com/materials/abc.jpg",
        "thumbUrl": "https://minio.xxx.com/materials/abc_thumb.jpg",
        "fileSize": 245760,
        "width": 900,
        "height": 500,
        "format": "jpg",
        "category": "封面图",
        "tags": ["产品", "封面"],
        "usageCount": 12,
        "isSynced": true,
        "createdAt": "2026-05-20T08:00:00Z"
      }
    ],
    "total": 156,
    "page": 1,
    "page_size": 20
  }
}
```

### 7.2 同步到微信

```
POST /materials/:materialId/sync

Response:
{
  "code": 0,
  "data": { "mediaId": "abc123...", "syncedAt": "2026-05-29T10:00:00Z" }
}
```

---

## 8. 菜单管理 (M06 — Menu)

### 8.1 菜单编辑

```
GET    /menu/current                           // 获取当前菜单配置
POST   /menu                                   // 创建/更新菜单草稿
Request:
{
  "menuJson": {
    "button": [
      { "type": "click", "name": "今日推荐", "key": "TODAY_RECOMMEND" },
      {
        "name": "更多服务",
        "sub_button": [
          { "type": "view", "name": "关于我们", "url": "https://..." },
          { "type": "miniprogram", "name": "小程序", "appid": "wx...", "pagepath": "pages/index" }
        ]
      }
    ]
  }
}

POST   /menu/publish                           // 发布菜单到微信
Response:
{ "code": 0, "data": { "version": 3, "publishedAt": "2026-05-29T12:00:00Z" } }

GET    /menu/history?page=1&page_size=10       // 发布历史
```

### 8.2 菜单模板

```
GET    /menu/templates?category=电商&page=1&page_size=20
POST   /menu/templates                         // 保存为模板
DELETE /menu/templates/:templateId
POST   /menu/templates/:templateId/apply       // 应用模板（替换当前草稿）
```

---

## 9. 数据统计 (M07 — Dashboard)

### 9.1 粉丝趋势

```
GET /dashboard/followers/trend?authorizerId=clx...&startDate=2026-04-01&endDate=2026-05-29&granularity=day

Response:
{
  "code": 0,
  "data": {
    "summary": {
      "totalFollowers": 15230,
      "newSubscribers": 1250,
      "unsubscribers": 320,
      "netGrowth": 930
    },
    "series": [
      { "date": "2026-05-01", "newSubs": 45, "unsubs": 12, "net": 33, "total": 14300 },
      { "date": "2026-05-02", "newSubs": 52, "unsubs": 8,  "net": 44, "total": 14344 }
    ]
  }
}
```

### 9.2 消息交互趋势

```
GET /dashboard/messages/trend?authorizerId=clx...&startDate=2026-04-01&endDate=2026-05-29&granularity=day

Response:
{
  "code": 0,
  "data": {
    "summary": { "sent": 5200, "received": 18400, "replyRate": 0.72 },
    "series": [
      { "date": "2026-05-01", "sent": 180, "received": 620, "replied": 450, "replyRate": 0.73 }
    ]
  }
}
```

### 9.3 图文分析

```
GET /dashboard/news?authorizerId=clx...&startDate=2026-04-01&endDate=2026-05-29&page=1&page_size=20&sort=readCount&order=desc

Response:
{
  "code": 0,
  "data": {
    "list": [
      {
        "title": "2026技术趋势报告",
        "readCount": 12500,
        "likeCount": 320,
        "favorCount": 180,
        "shareCount": 450,
        "commentCount": 85,
        "readSources": {
          "session": 6800, "friend": 2100, "moments": 1800, "other": 1800
        }
      }
    ],
    "total": 45,
    "page": 1,
    "page_size": 20
  }
}
```

### 9.4 数据导出

```
POST /dashboard/export
Request:
{
  "authorizerId": "clx...",
  "type": "followers_trend",               // followers_trend | message_trend | news_analysis
  "startDate": "2026-04-01",
  "endDate": "2026-05-29",
  "format": "xlsx"                         // xlsx | csv
}

Response:
{ "code": 0, "data": { "downloadUrl": "https://minio.xxx.com/exports/abc.xlsx", "expiresIn": 3600 } }
```

---

## 10. OpenAPI 3.0 Schema（核心类型）

```yaml
openapi: 3.0.3
info:
  title: WXGZH Platform API
  version: 1.0.0
  description: 微信公众号第三方运营管理平台 API

components:
  schemas:
    ApiResponse:
      type: object
      properties:
        code: { type: integer }
        message: { type: string }
        data: { type: object }
        trace_id: { type: string, format: uuid }

    PaginatedResponse:
      type: object
      properties:
        list: { type: array, items: {} }
        total: { type: integer }
        page: { type: integer }
        page_size: { type: integer }

    Authorizer:
      type: object
      properties:
        id: { type: string }
        appId: { type: string }
        nickName: { type: string }
        headImg: { type: string, format: uri }
        appType: { type: integer, enum: [0, 1, 2] }
        status: { type: string, enum: [authorized, expired, revoked] }
        tokenExpireAt: { type: string, format: date-time }
        totalFollowers: { type: integer }

    Follower:
      type: object
      properties:
        id: { type: string }
        openid: { type: string }
        nickname: { type: string }
        headImg: { type: string, format: uri }
        sex: { type: integer, enum: [0, 1, 2] }
        province: { type: string }
        city: { type: string }
        subscribe: { type: boolean }
        subscribeAt: { type: string, format: date-time }
        interactCount: { type: integer }
        tags: { type: array, items: { $ref: '#/components/schemas/FollowerTag' } }

    FollowerTag:
      type: object
      properties:
        id: { type: string }
        name: { type: string }
        color: { type: string }

    MenuButton:
      type: object
      properties:
        type: { type: string, enum: [click, view, miniprogram, scancode_push, scancode_waitmsg, pic_sysphoto, pic_photo_or_album, pic_weixin, location_select, media_id, view_limited] }
        name: { type: string, maxLength: 7 }
        key: { type: string }
        url: { type: string, format: uri }
        appid: { type: string }
        pagepath: { type: string }
        sub_button: { type: array, items: { $ref: '#/components/schemas/MenuButton' }, maxItems: 5 }

  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```
