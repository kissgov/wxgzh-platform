// 认证状态管理 — Zustand + persist
// ============================================================================
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { debugLog } from '@/utils/debug';

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
}

interface UserInfo {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  roles: string[];
  permissions: string[];
  tenantId?: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserInfo | null;
  isAuthenticated: boolean;
  currentTenant: TenantInfo | null;
  hydrated: boolean;
  authVerified: boolean;

  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: UserInfo) => void;
  setCurrentTenant: (tenant: TenantInfo) => void;
  login: (accessToken: string, refreshToken: string, user: UserInfo, tenant: TenantInfo) => void;
  logout: () => void;
  setAuthVerified: (verified: boolean) => void;
}

function isJwtExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1]!));
    if (!payload.exp) return false;
    const expired = payload.exp * 1000 < Date.now();
    if (expired) {
      debugLog('auth', 'Token expired at', new Date(payload.exp * 1000).toISOString(), 'now=', new Date().toISOString());
    }
    return expired;
  } catch {
    debugLog('auth', 'Token parse failed — treating as expired');
    return true;
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      currentTenant: null,
      hydrated: false,
      authVerified: false,

      setTokens: (accessToken, refreshToken) => {
        const expired = isJwtExpired(accessToken);
        const wasAuth = get().isAuthenticated;
        const wasVerified = get().authVerified;
        debugLog('store', 'setTokens', {
          hasToken: !!accessToken,
          expired,
          wasAuth,
          wasVerified,
          newAuth: !expired,
          newVerified: !expired,
        });
        set({ accessToken, refreshToken, isAuthenticated: !expired, authVerified: !expired });
      },

      setUser: (user) => {
        debugLog('store', 'setUser', user.email);
        set({ user });
      },

      setCurrentTenant: (tenant) => {
        debugLog('store', 'setCurrentTenant', tenant.name);
        set({ currentTenant: tenant });
      },

      login: (accessToken, refreshToken, user, tenant) => {
        const expired = isJwtExpired(accessToken);
        debugLog('store', 'LOGIN', {
          user: user.email,
          tenant: tenant.name,
          tokenExpired: expired,
          isAuthenticated: !expired,
          authVerified: true,
        });
        set({
          accessToken,
          refreshToken,
          user,
          currentTenant: tenant,
          isAuthenticated: !expired,
          authVerified: true,
        });
      },

      logout: () => {
        debugLog('store', 'LOGOUT — clearing auth state');
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          currentTenant: null,
          isAuthenticated: false,
          authVerified: false,
        });
      },

      setAuthVerified: (verified) => {
        const prev = get().authVerified;
        if (prev !== verified) {
          debugLog('store', `authVerified: ${prev} → ${verified}`);
        }
        set({ authVerified: verified });
      },
    }),
    {
      name: 'wxgzh-auth',
      partialize: (state) => {
        debugLog('store', 'persist:partialize', { hasToken: !!state.accessToken, auth: false, verified: false });
        return {
          accessToken: state.accessToken,
          refreshToken: state.refreshToken,
          user: state.user,
          currentTenant: state.currentTenant,
          isAuthenticated: false,
          authVerified: false,
        };
      },
      onRehydrateStorage: () => {
        debugLog('store', 'persist:onRehydrateStorage — starting');
        return (state) => {
          if (state) {
            const expired = isJwtExpired(state.accessToken);
            state.isAuthenticated = !expired && !!state.accessToken;
            state.authVerified = false;
            state.hydrated = true;
            debugLog('store', 'persist:rehydrated', {
              hasToken: !!state.accessToken,
              expired,
              isAuthenticated: state.isAuthenticated,
              authVerified: state.authVerified,
            });
          }
        };
      },
    },
  ),
);

export function useReady(): boolean {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authVerified = useAuthStore((s) => s.authVerified);
  const hydrated = useAuthStore((s) => s.hydrated);
  const ready = isAuthenticated && authVerified && hydrated;
  // 仅在 ready 状态变化时输出日志
  return ready;
}
