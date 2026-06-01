// 调试日志工具 — 仅开发环境启用，生产自动禁用
// ============================================================================

const DEBUG_ENABLED = import.meta.env.DEV;

const COLORS: Record<string, string> = {
  auth: '#1677FF',
  http: '#52C41A',
  store: '#FA8C16',
  query: '#722ED1',
  guard: '#EB2F96',
};

function fmtTime(): string {
  return new Date().toISOString().split('T')[1]!.replace('Z', '');
}

export function debugLog(category: string, ...args: unknown[]) {
  if (!DEBUG_ENABLED) return;
  const color = COLORS[category] || '#888';
  console.log(
    `%c[${fmtTime()}]%c[${category}]`,
    'color:#888;font-size:10px',
    `color:${color};font-weight:bold`,
    ...args,
  );
}

/** 分组日志：记录组内多条信息 */
export function debugGroup(category: string, label: string, fn: () => void) {
  if (!DEBUG_ENABLED) return;
  console.groupCollapsed(
    `%c[${fmtTime()}]%c[${category}] %c${label}`,
    'color:#888;font-size:10px',
    `color:#888;font-weight:bold`,
    'color:#333;font-weight:normal',
  );
  fn();
  console.groupEnd();
}
