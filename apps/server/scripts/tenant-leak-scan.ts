// Tenant-leak Static Scan
// ============================================================================
// 扫描 prisma 调用的"潜在越权"模式, 即未带 tenantId 的多租户数据访问。
// 范围: prisma.{model}.findFirst/findMany/update/delete/updateMany/deleteMany。
// 目标: 强制每个跨租户数据访问必须显式声明 tenantId。
//
// 豁免机制:
//   1. // tenant-allow   — 调用前一行注释, 显式声明豁免 (须包含理由)
//   2. 系统级 model 白名单 (componentApp, subscriptionPlan, permission, etc.)
//   3. super_admin 角色保护路径 (admin/payment/tenants/ 等)
// ============================================================================
import * as fs from 'node:fs';
import * as path from 'node:path';

const SERVER_ROOT = path.resolve(__dirname, '..');
const SCAN_ROOTS = [
  path.join(SERVER_ROOT, 'src/modules'),
  path.join(SERVER_ROOT, 'src/tasks'),
  path.join(SERVER_ROOT, 'src/integrations'),
];

// 平台级 / 系统级 model — 这些表不属于单租户, 强加 tenantId 是错误
const SYSTEM_MODELS = new Set([
  'auditLog',
  'systemLog',
  'idempotency',
  'webhookEvent',
  'platformMetric',
  'permission',       // 全局权限定义
  'subscriptionPlan', // 全局套餐定义
  'componentApp',     // 第三方平台应用 (一租户一个, 但有 component_appid 唯一标识)
  'tenant',           // 平台级租户表 (平台 admin 操作)
  'healthCheck',
  'migration',
]);

// 平台级 / 平台管理员路径前缀 — 显式平台管理, 应有 super_admin 角色保护
const PLATFORM_PATH_PATTERNS = [
  /\/admin\//i,
  /\/platform\//i,
  /\/super-/i,
];

// 接受嵌套 where 限定 (e.g., where: { group: { tenantId } })
const NESTED_TENANT_RE = /\w+\s*:\s*\{[^}]*tenantId/;

interface Issue {
  file: string;
  line: number;
  rule: string;
  snippet: string;
  suggestion: string;
}

const issues: Issue[] = [];
const warnings: Issue[] = [];

const CALL_RE = /prisma\.([a-zA-Z][a-zA-Z0-9_]*)\.(findFirst|findMany|findUnique|update|delete|updateMany|deleteMany|create|createMany)\s*\(/g;
const WHERE_RE = /where\s*:\s*\{/g;
const TENANT_ID_RE = /tenantId\s*:/;

function isInPlatformPath(filePath: string): boolean {
  const rel = path.relative(SERVER_ROOT, filePath).replace(/\\/g, '/');
  return PLATFORM_PATH_PATTERNS.some((re) => re.test(rel));
}

function hasAllowComment(content: string, callPos: number): boolean {
  // 向上查找 3 行内是否有 // tenant-allow 注释
  const before = content.slice(Math.max(0, callPos - 500), callPos);
  const lines = before.split('\n').slice(-4, -1);
  return lines.some((l) => /tenant-allow/.test(l));
}

function scanFile(filePath: string): void {
  if (!/\.(ts|js)$/.test(filePath)) return;
  if (/\.spec\.ts$/.test(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf-8');
  const platformPath = isInPlatformPath(filePath);

  for (const m of content.matchAll(CALL_RE)) {
    const model = m[1];
    const method = m[2];
    const callStart = m.index!;

    if (SYSTEM_MODELS.has(model)) continue;
    if (hasAllowComment(content, callStart)) continue;
    if (platformPath) continue; // platform/admin 路径下需 super_admin 保护, 信任角色守卫

    // 提取 call 参数
    const callArgs = extractCallArgs(content, callStart + m[0].length - 1);
    if (!callArgs) continue;

    const lineNum = content.slice(0, callStart).split('\n').length;
    const rule = `prisma.${model}.${method}-no-tenant`;

    // create / createMany: 仅警告 (create 自己控制, 但应补 tenantId 防止 future 误用)
    if (method === 'create' || method === 'createMany') {
      if (!TENANT_ID_RE.test(callArgs)) {
        warnings.push({
          file: filePath,
          line: lineNum,
          rule: `prisma.${model}.${method}-no-tenant-warn`,
          snippet: m[0].slice(0, 100),
          suggestion: `create/createMany 的 data 应含 tenantId (warning, 不阻断)`,
        });
      }
      continue;
    }

    // findUnique / delete: 信任 unique key, 但要求外层校验
    if (method === 'findUnique' || method === 'delete') {
      if (method === 'delete' && !TENANT_ID_RE.test(callArgs)) {
        // delete 必须有 tenantId 防护
        issues.push({
          file: filePath,
          line: lineNum,
          rule: `prisma.${model}.delete-no-tenant`,
          snippet: m[0].slice(0, 100),
          suggestion: `delete 必须有 where.tenantId (防止误删跨租户数据)`,
        });
      }
      continue;
    }

    // findFirst / findMany / update / deleteMany / updateMany
    if (!WHERE_RE.test(callArgs)) {
      WHERE_RE.lastIndex = 0;
      if (method === 'findFirst' || method === 'findMany') {
        // 读操作缺 where 仅 warning (可能是全表扫描, 但不一定越权)
        warnings.push({
          file: filePath,
          line: lineNum,
          rule: `prisma.${model}.${method}-no-where-warn`,
          snippet: m[0].slice(0, 100),
          suggestion: `${method} 缺 where 子句 (warning)`,
        });
      } else {
        issues.push({
          file: filePath,
          line: lineNum,
          rule: `prisma.${model}.${method}-no-where`,
          snippet: m[0].slice(0, 100),
          suggestion: `${method} 必须有 where 子句`,
        });
      }
      continue;
    }
    WHERE_RE.lastIndex = 0;

    if (!TENANT_ID_RE.test(callArgs) && !NESTED_TENANT_RE.test(callArgs)) {
      // findFirst/findMany 缺 tenantId: 仅 warning (常使用外部 where 变量)
      if (method === 'findFirst' || method === 'findMany') {
        warnings.push({
          file: filePath,
          line: lineNum,
          rule: `prisma.${model}.${method}-no-tenant-warn`,
          snippet: m[0].slice(0, 80) + (callArgs.length > 60 ? '...' : ''),
          suggestion: `${method} 字面量无 tenantId, 确认 where 变量含 tenantId (warning)`,
        });
      } else {
        // update/delete/updateMany/deleteMany: blocking
        issues.push({
          file: filePath,
          line: lineNum,
          rule,
          snippet: m[0].slice(0, 80) + (callArgs.length > 60 ? '...' : ''),
          suggestion: `添加 tenantId: { tenantId: ctx.tenantId } 到 where`,
        });
      }
    }
  }
}

function extractCallArgs(content: string, openIdx: number): string | null {
  if (content[openIdx] !== '(') return null;
  let depth = 0;
  for (let i = openIdx; i < content.length; i++) {
    const ch = content[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return content.slice(openIdx + 1, i);
    }
  }
  return null;
}

function scanDir(dir: string): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(p);
    } else {
      scanFile(p);
    }
  }
}

SCAN_ROOTS.forEach(scanDir);

// ── Baseline lock (V2.0.x phased fix) ──────────────────────────────────────
// 把已存在的 leak 当 known debt 锁起来,CI 只挡 NEW leak。后续 PR 减少
// baseline 数量,V2.0.x 渐进消化到 0。详见 docs/adrs/ADR-002-tenant-leak-baseline.md。
//
// 用法:
//   `npx tsx scripts/tenant-leak-scan.ts --write-baseline` → 把当前 issues 写入 baseline
//   `npx tsx scripts/tenant-leak-scan.ts`                  → 默认,读 baseline 只挡新 leak
const BASELINE_PATH = path.join(SERVER_ROOT, 'scripts/tenant-leak-baseline.json');
const WRITE_BASELINE = process.argv.includes('--write-baseline');

function issueKey(i: Issue): string {
  // 文件路径 normalize 成相对 SERVER_ROOT 的 posix 形式,Windows/Linux 一致
  const rel = path.relative(SERVER_ROOT, i.file).replace(/\\/g, '/');
  return `${rel}:${i.line}:${i.rule}`;
}

if (WRITE_BASELINE) {
  const baseline = {
    generatedAt: 'baseline-locked-at-S4-merge',
    count: issues.length,
    note: '当前 V2.0 已知未修越权点。V2.0.x 渐进减少到 0。新 PR 不得增加。',
    keys: issues.map(issueKey).sort(),
  };
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n');
  console.log(`✅ baseline 已写入 ${BASELINE_PATH} (${issues.length} 个 known issues)`);
  process.exit(0);
}

const baselineKeys = new Set<string>();
if (fs.existsSync(BASELINE_PATH)) {
  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8')) as { keys: string[] };
  for (const k of baseline.keys) baselineKeys.add(k);
}

const newIssues = issues.filter((i) => !baselineKeys.has(issueKey(i)));
const knownIssues = issues.filter((i) => baselineKeys.has(issueKey(i)));

if (warnings.length > 0) {
  console.log(`⚠️  ${warnings.length} 个 warning (create 缺 tenantId, 不阻断):`);
  for (const w of warnings.slice(0, 10)) {
    console.log(`  ${w.file}:${w.line} [${w.rule}]`);
  }
  if (warnings.length > 10) {
    console.log(`  ... (共 ${warnings.length} 个, 省略 ${warnings.length - 10} 个)`);
  }
  console.log('');
}

if (knownIssues.length > 0) {
  console.log(`ℹ️  ${knownIssues.length} 个 known issues (在 baseline 内, 不阻断 — V2.0.x 渐进消化):`);
  if (baselineKeys.size > 0) {
    console.log(`  (baseline 总数 ${baselineKeys.size}; 若实际已修请运行 --write-baseline 更新)`);
  }
  console.log('');
}

if (newIssues.length > 0) {
  console.error(`❌ 发现 ${newIssues.length} 个 NEW 越权 (不在 baseline 内, 必须修):`);
  for (const i of newIssues) {
    console.error(`  ${i.file}:${i.line} [${i.rule}]`);
    console.error(`    snippet: ${i.snippet.slice(0, 120)}`);
    console.error(`    fix:     ${i.suggestion}`);
  }
  console.error('');
  console.error(`提示: 若该越权确属合法 (e.g. 平台 admin 路径), 在调用前一行加 \`// tenant-allow <理由>\` 注释豁免。`);
  process.exit(1);
}

const totalKnown = knownIssues.length;
const baselineLeft = baselineKeys.size - totalKnown;
if (baselineLeft > 0) {
  console.log(`📉 baseline 减少 ${baselineLeft} 项 (实际已修但 baseline 未更新)。运行 \`--write-baseline\` 锁定新地板。`);
}
console.log(`✅ Tenant-leak scan 0 NEW leaks (${totalKnown} known / ${warnings.length} warnings)`);
