// App 根组件 — 路由出口 + 角色守卫
// ============================================================================
import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuthStore } from '@/stores/auth.store';
import { debugLog } from '@/utils/debug';
import MainLayout from '@/components/layout/MainLayout';
import LoginPage from '@/pages/LoginPage';

// 页面懒加载
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const AccountsPage = lazy(() => import('@/pages/accounts/AccountsPage'));
const FollowersPage = lazy(() => import('@/pages/followers/FollowersPage'));
const MessagesPage = lazy(() => import('@/pages/messages/MessagesPage'));
const MaterialsPage = lazy(() => import('@/pages/materials/MaterialsPage'));
const MenuPage = lazy(() => import('@/pages/menu/MenuPage'));
const PlatformPage = lazy(() => import('@/pages/platform/PlatformPage'));
const TeamPage = lazy(() => import('@/pages/team/TeamPage'));
const ContentPage = lazy(() => import('@/pages/content/ContentPage'));
const ArticleEditor = lazy(() => import('@/pages/content/ArticleEditor'));
const CampaignsPage = lazy(() => import('@/pages/campaigns/CampaignsPage'));
const AnalyticsPage = lazy(() => import('@/pages/dashboard/AnalyticsPage'));
const SubscriptionPage = lazy(() => import('@/pages/SubscriptionPage'));
const PayPage = lazy(() => import('@/pages/PayPage'));
const AgentPage = lazy(() => import('@/pages/AgentPage'));
const AdminTenants = lazy(() => import('@/pages/admin/AdminTenants'));

function PageLoader() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <Spin size="large" />
    </div>
  );
}

/** 路由守卫：未登录重定向到登录页 */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const authenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrated = useAuthStore((s) => s.hydrated);
  const verified = useAuthStore((s) => s.authVerified);
  if (!authenticated) {
    debugLog('guard', 'AuthGuard: BLOCKED → redirect /login', { authenticated, hydrated, verified });
    return <Navigate to="/login" replace />;
  }
  debugLog('guard', 'AuthGuard: ALLOWED', { authenticated, hydrated, verified });
  return <>{children}</>;
}

/** 角色守卫：仅 super_admin 可访问 */
function AdminGuard({ children }: { children: React.ReactNode }) {
  const roles = useAuthStore((s) => s.user?.roles || []);
  if (!roles.includes('super_admin')) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <AuthGuard>
              <MainLayout />
            </AuthGuard>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard/*" element={<DashboardPage />} />
          <Route path="accounts/*" element={<AccountsPage />} />
          <Route path="followers/*" element={<FollowersPage />} />
          <Route path="messages/*" element={<MessagesPage />} />
          <Route path="materials/*" element={<MaterialsPage />} />
          <Route path="menu/*" element={<MenuPage />} />
          <Route path="platform/*" element={<PlatformPage />} />
          <Route path="team/*" element={<TeamPage />} />
          <Route path="content/*" element={<ContentPage />} />
          <Route path="content/articles/:id" element={<ArticleEditor />} />
          <Route path="campaigns/*" element={<CampaignsPage />} />
          <Route path="analytics/*" element={<AnalyticsPage />} />
          <Route path="subscription" element={<SubscriptionPage />} />
          <Route path="pay/:tradeNo" element={<PayPage />} />
          <Route path="agents/*" element={<AgentPage />} />
          <Route
            path="admin/*"
            element={
              <AdminGuard>
                <AdminTenants />
              </AdminGuard>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
