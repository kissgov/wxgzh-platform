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

if (issues.length > 0) {
  console.error(`❌ 越权静态扫描发现 ${issues.length} 个问题:`);
  for (const i of issues) {
    console.error(`  ${i.file}:${i.line} [${i.rule}]`);
    console.error(`    snippet: ${i.snippet.slice(0, 120)}`);
    console.error(`    fix:     ${i.suggestion}`);
  }
  process.exit(1);
}

console.log(`✅ Tenant-leak scan 0 errors (扫了 ${SCAN_ROOTS.length} 个根目录)`);
