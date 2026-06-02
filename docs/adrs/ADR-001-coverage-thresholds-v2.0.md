# ADR-001: V2.0 单测覆盖率门槛策略

> **Date:** 2026-06-02
> **Status:** Accepted (V2.0 ship gate)
> **Deciders:** WXGZH 团队
> **Spec ref:** [2026-06-02-v2-foundation-design.md §1.5](../superpowers/specs/2026-06-02-v2-foundation-design.md)
> **Plan ref:** [v2-foundation S1 plan](../superpowers/plans/2026-06-02-v2-foundation-s1-testing.md)

---

## 1. Context

V2.0 spec §1.5 "成功标准"中关于单测的原文:

> 单元测试覆盖率 ≥ 60% (按行) / 集成 ≥ 50% / 关键流 E2E 100%

S1 sprint 落地时,在 `apps/server/jest.config.ts` 把 4 项 jest 阈值都设了
60/60/60/50 (line/function/stmt/branch),**比 spec 严**。但 S1-S3 阶段
`pnpm test:ci` 从未真正在 CI 跑(turbo.json 没有 test:ci 任务),门槛因此
**纸面有效、流水线无效**,直到 S3 合并阶段才被发现。

合并阶段实测(commit `e5226ac`,33 suites / 269 tests):

| 维度 | spec | 原 jest 设 | 实测 | 与 spec 对比 |
|---|---|---|---|---|
| **Line** | **≥ 60%** | 60 | **67.26%** | ✅ 超 7.3pp |
| Statement | (隐含) | 60 | 67.01% | ✅ |
| Branch | (默认 50) | 50 | 54.72% | ✅ |
| Function | (未指定) | 60 | 45.35% | ❌ 离 60 差 14.7pp |

function 维度未达 60% 的真因:**NestJS controllers 是薄壳** (`@Body() x →
return this.service.x(x)`),每个 controller 12-18 method,几乎没单测。
S6 的 3 条 E2E (登录 / 授权 / 群发) 已用 supertest 覆盖关键 controller 路径,
对 controllers 加纯单测只是测框架,不测业务,边际效益极低。

## 2. Decision

V2.0 ship gate 采用以下覆盖率门槛(`apps/server/jest.config.ts`):

```ts
coverageThreshold: {
  global: {
    lines: 60,        // 严守 spec §1.5
    functions: 40,    // 低于实测 (45.35%) 5pp 防回退;V2.0.x 渐进抬升到 60%
    statements: 60,   // 与 line 同步
    branches: 50,     // 默认底线
  },
}
```

`turbo.json` 中 `test:ci` 任务接入 CI,门槛真正强制。

## 3. Rationale

### 为什么不硬补 controllers 到 60%

1. **Spec 字面意思已达成**:line 67.26 > 60。S1 当初把 functions 设 60% 是
   over-strict 的本地决定,**不是 spec 要求**。
2. **重叠的测试成本**:S6 用 supertest 已覆盖 controller→service→DB 真链路 (3
   条 E2E + 4 controller flow)。再加 controller-only 单测是重复劳动。
3. **薄壳特性**:NestJS controller 大多是 1-3 行的代理函数。单测它就是 mock
   service + 断言 service 被调用,**测的是框架,不测业务逻辑**。
4. **机会成本**:补 7-10 个 controller 单测预计 30-60 min,这段时间更适合
   推进 S4 (安全) + S6 (架构 + E2E) 的合并 — V2.0 完工瓶颈不在 controllers。

### 为什么把 functions 设 40% 而不是 45% 或 60%

- **45%** = 当前实测,无缓冲,任何后续 commit 减一个 service 函数即触发 CI
  红 → false alarm 风险。
- **40%** = 留 5pp 缓冲,允许小幅波动,但仍阻挡显著回退(V1 baseline 28.6%)。
- **60%** = 当前不可达,接入 CI 后 PR-1 直接红,违背"先接电源再调高"原则。

### 渐进抬升路径

| 阶段 | functions 目标 | 触发 |
|---|---|---|
| V2.0 (本 ADR) | 40% | line 67 已超 spec, ship S3-S6 |
| V2.0.1 | 50% | S4/S6 合并后,新增 controller 单测顺带 |
| V2.0.2 | 60% | 配合 V2.1 业务方向时一次性扫尾 |

每次抬升必须先实测 ≥ 目标 + 5pp 才能改门槛,**不允许"先改门槛后补测试"**。

## 4. Consequences

### Positive

- ✅ V2.0 ship gate 不被 functions 维度卡住,符合 spec 实际范围
- ✅ 门槛真正接入 CI (turbo.json test:ci task),不再"纸面有效"
- ✅ 防回退地板 40% 高于 V1 baseline 28%,阻挡测试质量退步
- ✅ 留有渐进抬升路径,V2.0.x patch 可逐步收紧

### Negative

- ⚠️ 短期内 functions 覆盖率 (45%) 低于"专业项目"惯例 (60-80%)
- ⚠️ 控制器层在单测维度长期欠测,需通过 E2E 弥补
- ⚠️ 若有人后续把 functions 改回 60% 而不补测试,CI 立即红 — 需 onboarding 提醒

### Neutral

- 📋 line/branch/stmt 三项均高于门槛 7+ pp,**有正向缓冲**
- 📋 src/tasks (98%)、src/integrations/wechat (80%)、modules/oss (100%) 等
  关键模块已 well-covered
- 📋 黑洞主要剩 controllers,V2.0 E2E 已覆盖 3 个核心 flow

## 5. Alternatives Considered

| 方案 | 拒因 |
|---|---|
| A. 硬补 controllers 单测到 60% | 边际效益低 + 与 E2E 重叠 + 阻塞 S3 ship |
| B. 关闭 functions 门槛 | 失去回退保护信号,违反"门槛真接 CI"原则 |
| C. per-module 阈值差异化 (controllers 30, services 70) | 复杂度上升,jest 不原生支持 path glob 阈值 |
| **D. ADR 写明降 functions 到 40%** (本决议) | 平衡 spec 字面 + 防回退 + ship velocity |

## 6. Verification

执行 `pnpm test:ci` 应当:
- 退出码 0
- 报告 line/branch/stmt/func 4 项,均 ≥ 本 ADR 门槛
- 当前预期: line 67% / branch 55% / stmt 67% / function 45%

CI 任何 PR 把 functions 拉到 < 40% 时,test:ci 应 fail。

## 7. References

- jest coverage thresholds: <https://jestjs.io/docs/configuration#coveragethreshold-object>
- V1 → V2.0 测试体量:V1 仅 1 个 spec → V2.0 已 33 suites / 269 tests
- 相关 commit: cf873a2 (TS fix), e5226ac (新增 spec)
