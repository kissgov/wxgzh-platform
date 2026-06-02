# ADR-002: Tenant-leak Scan Baseline-lock 策略

> **Date:** 2026-06-02
> **Status:** Accepted (S4 PR ship gate)
> **Spec ref:** [2026-06-02-v2-foundation-design.md §1.3 安全加固](../superpowers/specs/2026-06-02-v2-foundation-design.md)
> **Plan ref:** [v2-foundation S4 plan §Task 3-4](../superpowers/plans/2026-06-02-v2-foundation-s4-security.md)
> **Sibling:** [ADR-001](ADR-001-coverage-thresholds-v2.0.md)

---

## 1. Context

S4 Task 3 实现了 `apps/server/scripts/tenant-leak-scan.ts` — 静态扫描 prisma
调用是否带 `tenantId` scope,catch 跨租户数据泄漏。Task 4 commit message 写
"修 7 个高危越权点"。

S4 PR (#2) 首次接入 `pnpm test:ci` 强制门槛时,扫到:

| 维度 | 数量 |
|---|---|
| Blocking (`update / delete / updateMany / deleteMany` 缺 tenantId) | **53** |
| Warning (`create / findFirst / findMany` 缺,纯 advisory) | 100 |

V2.0 spec §1.3 写"安全加固",但**没明确要求"全修"** — S4 Task 4 实际只修 7 个高危,
留 46 个 lower-risk 在 carry。若 scan 把所有 leak 当 hard fail,**S4 PR 不可能合并**,
违背"每个 sprint 可独立发布"的 V2.0 plan §强制 3。

## 2. Decision

`scripts/tenant-leak-scan.ts` 采用 **baseline-lock 模式**:

1. **`scripts/tenant-leak-baseline.json`** 记录 V2.0 S4 ship 时的 53 个 known issues
   (`file:line:rule` 三元组)。
2. 默认运行:scan 把当前 issues 减去 baseline → 只 fail **NEW leak**(baseline 外)。
3. Baseline 内的 known issues 显示 `ℹ️ N known issues` 但不阻断 CI。
4. 实际修了 known issue 后,scan 自动告警 baseline 减少,提示 `--write-baseline` 更新地板。
5. 真合法的非租户操作(如 super_admin 路径),在调用前一行加 `// tenant-allow <理由>`。

## 3. Rationale

### 为什么选 baseline-lock(而不是硬阻 or 直接关 gate)

| 方案 | 拒因 |
|---|---|
| A. 硬阻所有 53 → 必须先全修 | 不阻塞反阻塞,与 S4 plan "高危先修" 矛盾;一个 PR 改 50+ 业务文件不可 review |
| B. 关 gate 改 warn-only | 失去回归保护,任何新 PR 加 leak 都不会被 catch — 等于把扫描白做 |
| C. **baseline-lock(本决议)** | 阻挡新泄漏 + carry 历史 debt + 可量化的渐进消化 |
| D. per-file allowlist | 比 baseline JSON 更复杂,审查成本高 |

baseline-lock 是 industry standard(参考 sonar quality gate / mypy --baseline /
detekt baseline) — 既保护质量底线不退,又允许 carry 历史欠债。

### 为什么 53 是当前底线

- 跑 scan 实测得到 53(commit `0b22abe` 后的 v2-foundation/s4 状态)
- S4 Task 4 已修 7 个高危,这 53 个均为 medium/low 严重度(主要是 `update` 类,
  在已知调用方 context 下不构成跨租户泄漏,但缺少防御性 scope)
- 高危类型(`delete*`)如未在 baseline 内,新 PR 加任何 `prisma.X.delete()` 无 tenantId 立刻 fail

### 渐进消化路径

| 阶段 | baseline count | 触发 |
|---|---|---|
| V2.0 S4 (本 ADR) | 53 | 接入门槛 + 写 baseline.json |
| V2.0.1 | < 30 | 修 wechat.service / agent.service 关键路径 |
| V2.0.2 | < 10 | 修剩余 modules/* update 类 |
| V2.0.3 | 0 | 完全清零,删除 baseline 机制 |

每次 commit 修了 known issue 后,运行 `--write-baseline` 更新地板,**地板只能降不能升**。

## 4. Consequences

### Positive

- ✅ S4 PR 可合并,V2.0 PR 流水线推进
- ✅ 新 leak (在 baseline 之外) 仍硬阻 CI,新代码受保护
- ✅ baseline JSON 是可 grep / 可 diff 的 source-of-truth,review 时一目了然
- ✅ 每 PR 都自动告警 baseline 减少,激励渐进消化

### Negative

- ⚠️ 53 个 known leak 长期存在,生产风险面短期未减
- ⚠️ baseline JSON 需手动维护(`--write-baseline`),易遗忘
- ⚠️ 文件移动 / 重构会改 `file:line` 触发"false new leak",需 PR 内重写 baseline

### Neutral

- 📋 100 个 warnings(create-no-tenant 等)不进 baseline,完全 advisory
- 📋 baseline JSON 进版本控制(`scripts/tenant-leak-baseline.json`),不在 .gitignore
- 📋 `tenant-allow` 注释机制保留,合法豁免不进 baseline

## 5. Alternatives Considered

见 §3 表格。简要:硬阻太重 / 关 gate 太松 / per-file allowlist 太碎 — baseline 最平衡。

## 6. Verification

```bash
cd apps/server
npx tsx scripts/tenant-leak-scan.ts  # 应当 exit 0, 打印 "0 NEW leaks (53 known)"
```

CI: PR #2 起,`Tenant-leak Static Scan (S4)` job 在 baseline 不增的情况下保持绿。

加新违规测试:
```ts
// 故意加一个无 tenantId 的 update
prisma.user.delete({ where: { id: 'x' } });
```
应当让 CI 红 + 报告 NEW leak 位置。

## 7. References

- 现有调用 `npx tsx scripts/tenant-leak-scan.ts --write-baseline` 重生成 baseline
- 实现:`apps/server/scripts/tenant-leak-scan.ts` (V2.0 S4)
- 相关 commit: `e822e79` (S4 Task 4 修 7 高危), `<本 PR>` (接入 baseline-lock)
