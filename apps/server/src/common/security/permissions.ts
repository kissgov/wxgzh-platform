// Permissions — 集中式权限常量 + 角色矩阵
// ============================================================================
// 单一事实源: 所有 controller 应 import 此处的常量, 不再硬编码字符串。
// 修改此文件 = 修改权限模型, 须 ADR 评审 + 同步刷新 prisma seed。
// ============================================================================

export const PERMISSIONS = {
  // 粉丝
  FOLLOWER_READ: 'follower:read',
  FOLLOWER_WRITE: 'follower:write',
  // 消息
  MESSAGE_READ: 'message:read',
  MESSAGE_WRITE: 'message:write',
  MESSAGE_SEND: 'message:send',
  // 素材
  MATERIAL_READ: 'material:read',
  MATERIAL_WRITE: 'material:write',
  // 菜单
  MENU_READ: 'menu:read',
  MENU_WRITE: 'menu:write',
  MENU_PUBLISH: 'menu:publish',
  // 数据
  ANALYTICS_READ: 'analytics:read',
  // 内容
  CONTENT_READ: 'content:read',
  CONTENT_WRITE: 'content:write',
  CONTENT_PUBLISH: 'content:publish',
  // 营销活动
  CAMPAIGN_READ: 'campaign:read',
  CAMPAIGN_WRITE: 'campaign:write',
  // Agent
  AGENT_READ: 'agent:read',
  AGENT_WRITE: 'agent:write',
  AGENT_RUN: 'agent:run',
  // LLM
  LLM_RUN: 'llm:run',
  // 计费
  BILLING_READ: 'billing:read',
  BILLING_WRITE: 'billing:write',
  // 成员
  TEAM_READ: 'team:read',
  TEAM_WRITE: 'team:write',
  // 租户
  TENANT_READ: 'tenant:read',
  TENANT_WRITE: 'tenant:write',
  // 平台
  PLATFORM_ADMIN: 'platform:admin',
  // 授权
  AUTHORIZE: 'authorizer:write',
  AUTHORIZE_REVOKE: 'authorizer:revoke',
  // 审计
  AUDIT_READ: 'audit:read',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

/** 角色 → 权限矩阵 (代码层默认值, 实际以 prisma `permissions` 表为准) */
export const ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
  super_admin: Object.values(PERMISSIONS),
  tenant_owner: Object.values(PERMISSIONS).filter((p) => p !== PERMISSIONS.PLATFORM_ADMIN),
  tenant_admin: [
    PERMISSIONS.FOLLOWER_READ, PERMISSIONS.FOLLOWER_WRITE,
    PERMISSIONS.MESSAGE_READ, PERMISSIONS.MESSAGE_WRITE, PERMISSIONS.MESSAGE_SEND,
    PERMISSIONS.MATERIAL_READ, PERMISSIONS.MATERIAL_WRITE,
    PERMISSIONS.MENU_READ, PERMISSIONS.MENU_WRITE, PERMISSIONS.MENU_PUBLISH,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.CONTENT_READ, PERMISSIONS.CONTENT_WRITE, PERMISSIONS.CONTENT_PUBLISH,
    PERMISSIONS.CAMPAIGN_READ, PERMISSIONS.CAMPAIGN_WRITE,
    PERMISSIONS.AGENT_READ, PERMISSIONS.AGENT_WRITE, PERMISSIONS.AGENT_RUN,
    PERMISSIONS.LLM_RUN,
    PERMISSIONS.TEAM_READ, PERMISSIONS.TEAM_WRITE,
    PERMISSIONS.TENANT_READ,
    PERMISSIONS.AUTHORIZE, PERMISSIONS.AUTHORIZE_REVOKE,
    PERMISSIONS.AUDIT_READ,
  ],
  operator: [
    PERMISSIONS.FOLLOWER_READ, PERMISSIONS.FOLLOWER_WRITE,
    PERMISSIONS.MESSAGE_READ, PERMISSIONS.MESSAGE_WRITE, PERMISSIONS.MESSAGE_SEND,
    PERMISSIONS.MATERIAL_READ, PERMISSIONS.MATERIAL_WRITE,
    PERMISSIONS.MENU_READ, PERMISSIONS.MENU_WRITE, PERMISSIONS.MENU_PUBLISH,
    PERMISSIONS.CONTENT_READ, PERMISSIONS.CONTENT_WRITE, PERMISSIONS.CONTENT_PUBLISH,
    PERMISSIONS.CAMPAIGN_READ, PERMISSIONS.CAMPAIGN_WRITE,
    PERMISSIONS.AGENT_READ, PERMISSIONS.AGENT_RUN, PERMISSIONS.LLM_RUN,
    PERMISSIONS.AUTHORIZE,
  ],
  analyst: [
    PERMISSIONS.FOLLOWER_READ, PERMISSIONS.MESSAGE_READ,
    PERMISSIONS.MATERIAL_READ, PERMISSIONS.MENU_READ,
    PERMISSIONS.ANALYTICS_READ, PERMISSIONS.CONTENT_READ,
    PERMISSIONS.CAMPAIGN_READ, PERMISSIONS.AUDIT_READ,
  ],
  agent: [
    PERMISSIONS.AGENT_READ, PERMISSIONS.AGENT_RUN, PERMISSIONS.LLM_RUN,
  ],
};

/** 反向索引: 给定权限, 哪些角色拥有它 */
export function rolesWithPermission(perm: Permission): string[] {
  return Object.entries(ROLE_PERMISSIONS)
    .filter(([, perms]) => perms.includes(perm))
    .map(([role]) => role);
}
