// 权限中文本地化标签 — 前后端共享唯一数据源
// ============================================================================

/** 资源名称（中文） */
export const RESOURCE_LABELS: Record<string, string> = {
  platform: '平台授权',
  account: '公众号管理',
  follower: '粉丝管理',
  message: '消息管理',
  material: '素材管理',
  menu: '菜单管理',
  analytics: '数据统计',
};

/** 操作名称（中文） */
const ACTION_LABELS: Record<string, string> = {
  read: '查看',
  create: '创建',
  update: '编辑',
  delete: '删除',
  tag: '标签管理',
  blacklist: '黑名单',
  broadcast: '群发',
  upload: '上传',
  publish: '发布',
  export: '导出',
};

/** 权限完整中文名映射（slug → 中文名） */
export const PERMISSION_LABELS: Record<string, string> = {
  // platform
  'platform:read': '查看平台配置',
  'platform:create': '生成授权链接',
  'platform:delete': '回收授权',
  // account
  'account:read': '查看公众号列表',
  'account:create': '创建分组',
  'account:update': '编辑分组',
  'account:delete': '删除分组',
  // follower
  'follower:read': '查看粉丝列表',
  'follower:create': '创建标签',
  'follower:update': '编辑粉丝备注',
  'follower:delete': '移除粉丝',
  'follower:tag': '管理粉丝标签',
  'follower:blacklist': '管理黑名单',
  // message
  'message:read': '查看消息记录',
  'message:create': '创建自动回复',
  'message:update': '编辑自动回复',
  'message:delete': '删除自动回复',
  'message:broadcast': '群发消息',
  // material
  'material:read': '查看素材库',
  'material:create': '创建素材',
  'material:update': '编辑素材信息',
  'material:delete': '删除素材',
  'material:upload': '上传素材文件',
  // menu
  'menu:read': '查看菜单配置',
  'menu:create': '编辑菜单草稿',
  'menu:update': '更新菜单',
  'menu:delete': '删除菜单模板',
  'menu:publish': '发布菜单到微信',
  // analytics
  'analytics:read': '查看数据报表',
  'analytics:export': '导出分析报告',
};

/**
 * 根据 resource:action 生成中文名（无硬编码映射时回退）
 * 用于未来动态新增权限时提供基本的中文显示
 */
export function buildPermissionLabel(resource: string, action: string): string {
  const slug = `${resource}:${action}`;
  if (PERMISSION_LABELS[slug]) return PERMISSION_LABELS[slug]!;
  const res = RESOURCE_LABELS[resource] || resource;
  const act = ACTION_LABELS[action] || action;
  return `${res} - ${act}`;
}
