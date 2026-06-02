# 模块依赖边界 (V2.0)

> 日期: 2026-06-02
> Sprint: V2.0 S6 — 架构清理

## 允许的依赖方向

```
common/*        (无业务依赖, 可被任何模块引用)
       ↓
common/arch     (抽象基类, 不引具体业务)
       ↓
modules/*       (业务模块, 可引 common, 但不互引)
       ↓
integrations/*  (微信/MinIO, 业务模块引)
```

## 禁止

- module A 直接 import module B 的 service (用 EventEmitter 解耦)
- module A import module B 的 prisma model (用 contract 共享类型)
- module 跨级反向依赖 (业务模块不允许引 integrations/* 内具体实现, 只引 interface)

## 工具

```bash
./scripts/cycle-scan.sh            # 循环依赖 (CI 阻断)
npx madge --extensions ts apps/server/src   # 详细依赖图
npx madge --image graph.svg apps/server/src # 生成 SVG 依赖图
```

## 抽象接口清单 (S6 落地)

| 接口 | 路径 | 实现 |
|------|------|------|
| IStorageProvider | `src/integrations/storage/storage.interface.ts` | MinioStorageProvider / LocalStorageProvider |
| IWechatClient | `src/integrations/wechat/wechat.client.interface.ts` | WechatClientImpl (后续 task 拆分) |

## 基类

- `AbstractService` (`src/common/arch/abstract-service.ts`) — 业务 service 基类, 统一 `safe()` 包装 + 日志
- `AbstractController` (`src/common/arch/abstract-controller.ts`) — 控制器基类 + `ProtectedController()` 装饰器

## CI 阻断

`.github/workflows/ci.yml` 的 lint job 末尾执行 `./scripts/cycle-scan.sh`, 失败 → PR 阻断合入。
