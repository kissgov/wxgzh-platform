// Prisma 种子数据 — 创建初始租户、管理员和预置角色
// ============================================================================
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PERMISSION_LABELS } from '../packages/shared/src/constants/permission-labels';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── 1. 创建默认租户 ───────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      name: '默认租户',
      slug: 'default',
      contact: '管理员',
      status: 'active',
      plan: 'free',
      billingPeriod: 'trial',
      maxAuthorizers: 2,
      maxUsers: 5,
      trialEndsAt: new Date(Date.now() + 14 * 86400000),
    },
  });
  console.log(`  ✓ Tenant: ${tenant.name}`);

  // ── 2. 创建预置角色 ───────────────────────────────────────────────
  const roles = [
    { slug: 'super_admin', name: '超级管理员', isSystem: true, isDefault: false },
    { slug: 'admin', name: '管理员', isSystem: true, isDefault: false },
    { slug: 'editor', name: '运营编辑', isSystem: true, isDefault: true },
    { slug: 'analyst', name: '数据分析师', isSystem: true, isDefault: false },
    { slug: 'cs', name: '客服', isSystem: true, isDefault: false },
  ];

  const createdRoles: Record<string, string> = {};

  for (const role of roles) {
    const r = await prisma.role.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: role.slug } },
      update: {},
      create: { ...role, tenantId: tenant.id },
    });
    createdRoles[role.slug] = r.id;
    console.log(`  ✓ Role: ${role.name} (${role.slug})`);
  }

  // ── 3. 创建默认权限 ───────────────────────────────────────────────
  const resourceActions = {
    platform: ['read', 'create', 'delete'],
    account: ['read', 'create', 'update', 'delete'],
    follower: ['read', 'create', 'update', 'delete', 'tag', 'blacklist'],
    message: ['read', 'create', 'update', 'delete', 'broadcast'],
    material: ['read', 'create', 'update', 'delete', 'upload'],
    menu: ['read', 'create', 'update', 'delete', 'publish'],
    analytics: ['read', 'export'],
  };

  for (const [resource, actions] of Object.entries(resourceActions)) {
    for (const action of actions) {
      const slug = `${resource}:${action}`;
      const name = PERMISSION_LABELS[slug] || `${resource}:${action}`;
      await prisma.permission.upsert({
        where: { slug },
        update: { name },
        create: { slug, name, resource, action },
      });
    }
  }
  console.log('  ✓ Permissions: created all resource permissions');

  // ── 4. 角色默认权限分配 ───────────────────────────────────────────

  // admin: 所有管理权限（仅次于 super_admin）
  const adminPerms = [
    'platform:read', 'platform:create',
    'account:read', 'account:create', 'account:update', 'account:delete',
    'follower:read', 'follower:create', 'follower:update', 'follower:tag', 'follower:blacklist',
    'message:read', 'message:create', 'message:update', 'message:broadcast',
    'material:read', 'material:create', 'material:update', 'material:upload',
    'menu:read', 'menu:create', 'menu:update', 'menu:publish',
    'analytics:read', 'analytics:export',
  ];

  // editor: 内容运营权限
  const editorPerms = [
    'follower:read', 'follower:tag',
    'message:read', 'message:create', 'message:update',
    'material:read', 'material:create', 'material:upload',
    'menu:read',
    'analytics:read',
  ];

  // analyst: 只读分析权限
  const analystPerms = [
    'follower:read',
    'message:read',
    'analytics:read', 'analytics:export',
  ];

  // cs: 客服权限
  const csPerms = [
    'follower:read', 'follower:tag',
    'message:read', 'message:create',
    'material:read',
  ];

  const rolePermMap: Record<string, string[]> = {
    admin: adminPerms,
    editor: editorPerms,
    analyst: analystPerms,
    cs: csPerms,
  };

  const allPermissions = await prisma.permission.findMany();

  // 超级管理员：所有权限
  const superAdminRoleId = createdRoles['super_admin']!;
  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: superAdminRoleId, permissionId: perm.id } },
      update: {},
      create: { roleId: superAdminRoleId, permissionId: perm.id },
    });
  }
  console.log('  ✓ Super admin gets all permissions');

  // 其他角色：按默认权限集分配
  for (const [roleSlug, permSlugs] of Object.entries(rolePermMap)) {
    const roleId = createdRoles[roleSlug];
    if (!roleId) continue;
    for (const slug of permSlugs) {
      const perm = allPermissions.find((p) => p.slug === slug);
      if (!perm) {
        console.log(`  ⚠ Permission not found: ${slug} (skipped)`);
        continue;
      }
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: perm.id } },
        update: {},
        create: { roleId, permissionId: perm.id },
      });
    }
    console.log(`  ✓ Role ${roleSlug}: ${permSlugs.length} permissions`);
  }

  // ── 5. 创建默认管理员用户 ─────────────────────────────────────────
  const passwordHash = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@wxgzh.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@wxgzh.com',
      passwordHash,
      name: '系统管理员',
      status: 'active',
    },
  });
  console.log(`  ✓ Admin user: ${admin.email} (password: admin123)`);

  // 分配超级管理员角色
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: superAdminRoleId } },
    update: {},
    create: { userId: admin.id, roleId: superAdminRoleId },
  });

  // ── 6. 创建订阅套餐 ──────────────────────────────────────────────────
  const plans = [
    {
      slug: 'free',
      name: '免费版',
      description: '适合个人和小团队起步使用',
      priceMonthly: 0, priceQuarterly: 0, priceYearly: 0,
      maxAuthorizers: 2, maxUsers: 5, trialDays: 14,
      sortOrder: 1, status: 'active',
      features: ['2个公众号', '5个用户', '基础分析', '7天消息记录'],
    },
    {
      slug: 'starter',
      name: '入门版',
      description: '适合小型代运营团队',
      priceMonthly: 9900, priceQuarterly: 26800, priceYearly: 94900,
      maxAuthorizers: 10, maxUsers: 20, trialDays: 14,
      sortOrder: 2, status: 'active',
      features: ['10个公众号', '20个用户', '高级分析', '30天消息记录', '自动标签规则'],
    },
    {
      slug: 'pro',
      name: '专业版',
      description: '适合中型代运营公司',
      priceMonthly: 29900, priceQuarterly: 79800, priceYearly: 287900,
      maxAuthorizers: 50, maxUsers: 100, trialDays: 14,
      sortOrder: 3, status: 'active',
      features: ['50个公众号', '100个用户', '全部分析', '无限消息记录', '批量操作', '数据导出', 'API访问'],
    },
    {
      slug: 'enterprise',
      name: '企业版',
      description: '适合大型机构及定制需求',
      priceMonthly: 99900, priceQuarterly: 269900, priceYearly: 959900,
      maxAuthorizers: 200, maxUsers: 500, trialDays: 30,
      sortOrder: 4, status: 'active',
      features: ['200个公众号', '500个用户', '全部功能', '专属支持', 'SSO集成', '审计日志', 'SLA保障'],
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { slug: plan.slug },
      update: {},
      create: plan,
    });
  }
  console.log('  ✓ Subscription plans created');

  console.log('\n🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
