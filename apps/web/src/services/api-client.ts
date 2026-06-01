// Axios 封装 — 统一请求拦截、主动 Token 刷新、401 兜底处理
// ============================================================================
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse } from '@wxgzh/shared';
import { useAuthStore } from '@/stores/auth.store';
import { debugLog } from '@/utils/debug';

const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── JWT 工具 ─────────────────────────────────────────────────────────────

/** 主动刷新阈值：Token 还剩不到 5 分钟就过期时提前刷新 */
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

function getTokenExpMs(token: string): number {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return 0;
    return JSON.parse(atob(parts[1]!)).exp * 1000;
  } catch {
    return 0;
  }
}

function isNearExpiry(token: string): boolean {
  const expMs = getTokenExpMs(token);
  if (!expMs) return false;
  return expMs - Date.now() < REFRESH_THRESHOLD_MS;
}

// ── Token 刷新（单例锁，避免并发重复调用）───────────────────────────

let refreshPromise: Promise<boolean> | null = null;

async function refreshTokenIfNeeded(): Promise<void> {
  const token = useAuthStore.getState().accessToken;
  if (!token) return;

  // 仅在 Token 临近过期时主动刷新
  if (!isNearExpiry(token)) return;

  const rt = useAuthStore.getState().refreshToken;
  if (!rt) return;

  debugLog('http', '⏰ Token near expiry — proactive refresh', {
    expMs: getTokenExpMs(token),
    remaining: Math.round((getTokenExpMs(token) - Date.now()) / 1000) + 's',
  });

  await doRefreshToken(rt);
}

async function doRefreshToken(refreshToken: string): Promise<boolean> {
  if (refreshPromise) {
    try { await refreshPromise; return true; } catch { return false; }
  }

  refreshPromise = (async () => {
    try {
      debugLog('http', 'refreshToken: calling /auth/refresh');
      const { data } = await axios.post<ApiResponse<{
        access_token: string; refresh_token: string; expires_in: number;
      }>>('/api/v1/auth/refresh', { refresh_token: refreshToken });

      useAuthStore.getState().setTokens(data.data.access_token, data.data.refresh_token);
      debugLog('http', 'refreshToken: SUCCESS');
      return true;
    } catch (err) {
      debugLog('http', 'refreshToken: FAILED', (err as Error).message);
      throw err;
    } finally {
      refreshPromise = null;
    }
  })();

  try { await refreshPromise; return true; } catch { return false; }
}

// ── 请求拦截器：主动检测 Token 过期 ───────────────────────────────────

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    // 🔑 核心改进：发送请求前主动检查 Token 是否临近过期，提前刷新
    // 避免等到服务端返回 401 才被动处理
    const isRefreshEndpoint = config.url?.includes('/auth/refresh');
    if (!isRefreshEndpoint) {
      await refreshTokenIfNeeded();
    }
    // refreshTokenIfNeeded 可能已更新了 Token，重新读取
    const currentToken = useAuthStore.getState().accessToken;
    config.headers.Authorization = `Bearer ${currentToken}`;
  }

  debugLog('http', `${config.method?.toUpperCase()} ${config.url}`, {
    hasToken: !!token,
    isAuthenticated: useAuthStore.getState().isAuthenticated,
    authVerified: useAuthStore.getState().authVerified,
    hydrated: useAuthStore.getState().hydrated,
  });
  return config;
});

// ── 响应拦截器：401 兜底处理 ──────────────────────────────────────────

apiClient.interceptors.response.use(
  (response) => {
    if (!useAuthStore.getState().authVerified) {
      debugLog('http', '✅ 2xx → setAuthVerified(true)');
      useAuthStore.getState().setAuthVerified(true);
    }
    return response;
  },
  async (error: AxiosError<ApiResponse>) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '?';
      const method = error.config?.method?.toUpperCase() || '?';
      debugLog('http', `⚠️ 401 on ${method} ${url} (fallback — proactive refresh should have prevented this)`, {
        isRefresh: url.includes('/auth/refresh'),
        alreadyRetried: !!(error.config as any)?._retry,
      });

      if (url.includes('/auth/refresh')) {
        debugLog('http', '🔴 401 on /auth/refresh → LOGOUT');
        useAuthStore.getState().logout();
        return Promise.resolve({ data: { code: 10002, message: '请重新登录', data: null, trace_id: '' }, status: 401, headers: {}, config: error.config! } as any);
      }

      const alreadyRetried = (error.config as any)?._retry;
      if (!alreadyRetried) {
        (error.config as any)._retry = true;
        const rt = useAuthStore.getState().refreshToken;
        if (rt) {
          const refreshed = await doRefreshToken(rt);
          if (refreshed) {
            debugLog('http', `🔄 Retrying ${method} ${url} with refreshed token`);
            error.config!.headers.Authorization = `Bearer ${useAuthStore.getState().accessToken}`;
            return apiClient(error.config!);
          }
        }
      }

      debugLog('http', '🔴 401 unrecoverable → LOGOUT');
      useAuthStore.getState().logout();
      return Promise.resolve({ data: { code: 10002, message: '请重新登录', data: null, trace_id: '' }, status: 401, headers: {}, config: error.config! } as any);
    }

    debugLog('http', `❌ ${error.config?.method?.toUpperCase()} ${error.config?.url} → ${error.response?.status} ${error.message}`);
    return Promise.reject(error);
  },
);

export default apiClient;
