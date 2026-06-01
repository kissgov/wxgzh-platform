// 主布局 — 侧边栏 + 顶栏 + 内容区 + 租户切换
// ============================================================================
import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Layout, Menu, Avatar, Dropdown, Modal, List, Typography, message, Card, Form, Input, Tag, Table, Descriptions,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  DashboardOutlined, TeamOutlined, MessageOutlined, PictureOutlined,
  MenuOutlined, SettingOutlined, SwapOutlined, LogoutOutlined,
  UserOutlined, AuditOutlined, CheckOutlined, CrownOutlined, EditOutlined, RocketOutlined, GoldOutlined, RobotOutlined,
} from '@ant-design/icons';
import { useEffect, useRef } from 'react';
import dayjs from 'dayjs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { useReady } from '@/stores/auth.store';
import { getTenants, getMySubscription } from '@/services/tenant.api';
import apiClient from '@/services/api-client';
import SelfUpgrade from '@/components/common/SelfUpgrade';
import { usePermission } from '@/hooks/usePermission';
import { debugLog } from '@/utils/debug';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

type MenuItem = Required<MenuProps>['items'][number];

interface TenantItem {
  id: string;
  name: string;
  slug: string;
}

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [tenantModal, setTenantModal] = useState(false);
  const [profileModal, setProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', oldPassword: '', newPassword: '' });
  const [profileLoading, setProfileLoading] = useState(false);
  const [subModal, setSubModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user, currentTenant, setCurrentTenant, logout } = useAuthStore();
  const { hasPermission, hasRole } = usePermission();
  const pathParts = location.pathname.split('/').filter(Boolean);
  const selectedKey = '/' + (pathParts.length >= 2 ? pathParts.slice(0, 2).join('/') : pathParts[0] || '');
  const isSuperAdmin = user?.roles?.includes('super_admin');

  const allMenuItems: Array<{ key: string; icon: React.ReactNode; label: string; requirePerm?: string; requireRole?: string }> = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '数据看板', requirePerm: 'analytics:read' },
    { key: '/accounts', icon: <AuditOutlined />, label: '公众号管理', requirePerm: 'account:read' },
    { key: '/followers', icon: <TeamOutlined />, label: '粉丝管理', requirePerm: 'follower:read' },
    { key: '/messages', icon: <MessageOutlined />, label: '消息管理', requirePerm: 'message:read' },
    { key: '/materials', icon: <PictureOutlined />, label: '素材管理', requirePerm: 'material:read' },
    { key: '/menu', icon: <MenuOutlined />, label: '菜单管理', requirePerm: 'menu:read' },
    { key: '/content', icon: <EditOutlined />, label: '内容创作', requirePerm: 'follower:read' },
    { key: '/campaigns', icon: <RocketOutlined />, label: '营销活动', requirePerm: 'follower:read' },
    { key: '/platform', icon: <SettingOutlined />, label: '平台授权', requirePerm: 'platform:read' },
    { key: '/team', icon: <TeamOutlined />, label: '团队管理', requireRole: 'admin' },
    { key: '/subscription', icon: <CrownOutlined />, label: '订阅中心', requirePerm: 'analytics:read' },
    { key: '/agents', icon: <RobotOutlined />, label: 'Agent 控制台', requirePerm: 'analytics:read' },
    { key: '/admin', icon: <SettingOutlined />, label: '系统管理', requireRole: 'super_admin' },
  ];

  const menuItems: MenuItem[] = allMenuItems
    .filter((item) => {
      if (isSuperAdmin) return true;
      if (item.requirePerm) return hasPermission(item.requirePerm);
      if (item.requireRole) return hasRole(item.requireRole);
      return true;
    })
    .map(({ key, icon, label }) => ({ key, icon, label } as MenuItem));

  // 仅超管可获取全部租户列表
  const { data: tenants } = useQuery({
    queryKey: ['tenants'],
    queryFn: getTenants,
    enabled: isSuperAdmin,
  });

  // ── 调试：监控认证状态变化 ─────────────────────────────────────
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const ready = useReady();
  const prevReady = useRef(ready);
  useEffect(() => {
    if (prevReady.current !== ready) {
      debugLog('guard', `MainLayout useReady: ${prevReady.current} → ${ready}`, {
        isAuthenticated,
        authVerified: useAuthStore.getState().authVerified,
        hydrated: useAuthStore.getState().hydrated,
        hasToken: !!useAuthStore.getState().accessToken,
      });
      prevReady.current = ready;
    }
  }, [ready, isAuthenticated]);

  // ── 调试：监控 logout 调用 ─────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated && prevReady.current !== ready) {
      debugLog('guard', '⚠️ isAuthenticated became false — will redirect to /login');
    }
  }, [isAuthenticated, ready]);

  // 订阅信息（仅在认证就绪且通过验证时查询）
  const { data: subscription } = useQuery({
    queryKey: ['my-subscription'],
    queryFn: getMySubscription,
    enabled: ready,
  });

  const PERIOD_MAP: Record<string, string> = { trial: '试用中', monthly: '月付', quarterly: '季付', yearly: '年付', permanent: '永久' };
  const subPeriod = subscription?.billingPeriod || 'trial';
  const isExpired = subscription?.subscriptionExpiresAt && dayjs(subscription.subscriptionExpiresAt).isBefore(dayjs());

  // 如果登录时有分配的租户，使用它；否则默认第一个
  const activeTenant: TenantItem | null =
    currentTenant ||
    (tenants?.length ? tenants[0]! : null);

  // 如果没有 currentTenant 但有可用租户，自动设置
  if (!currentTenant && tenants?.length) {
    setCurrentTenant(tenants[0]!);
  }

  const handleSwitchTenant = (item: TenantItem) => {
    setCurrentTenant(item);
    setTenantModal(false);
    message.success(`已切换到「${item.name}」`);
  };

  const userMenuItems: MenuProps['items'] = [
    { key: 'profile', icon: <UserOutlined />, label: '个人设置' },
    ...(isSuperAdmin
      ? [{
          key: 'switch',
          icon: <SwapOutlined />,
          label: activeTenant ? `切换租户 (${activeTenant.name})` : '切换租户',
          onClick: () => setTenantModal(true),
        } as const]
      : []),
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true },
  ];

  const handleUserMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'logout') logout();
    if (key === 'profile') {
      setProfileForm({ name: user?.name || '', oldPassword: '', newPassword: '' });
      setProfileModal(true);
    }
  };

  const handleSaveProfile = async () => {
    setProfileLoading(true);
    try {
      const payload: Record<string, string> = {};
      if (profileForm.name) payload['name'] = profileForm.name;
      if (profileForm.oldPassword && profileForm.newPassword) {
        payload['oldPassword'] = profileForm.oldPassword;
        payload['newPassword'] = profileForm.newPassword;
      }
      const { data: res } = await apiClient.put('/auth/profile', payload);
      // 同步更新 store 中的用户信息
      if (res.data) {
        const store = useAuthStore.getState();
        store.setUser({
          ...store.user!,
          name: res.data.name || store.user!.name,
        });
      }
      message.success('个人信息已更新');
      setProfileModal(false);
    } catch (err: any) {
      message.error(err?.response?.data?.message || '更新失败');
    } finally {
      setProfileLoading(false);
    }
  };

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        style={{ background: '#fff' }}
        width={220}
      >
        <div
          className="flex items-center gap-2 px-4 py-4"
          style={{ borderBottom: '1px solid #f0f0f0' }}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500 text-sm font-bold text-white">
            W
          </div>
          {!collapsed && <span className="text-base font-semibold">WXGZH</span>}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderInlineEnd: 'none', marginTop: 8 }}
        />
      </Sider>

      <Layout>
        <Header
          className="flex items-center justify-between px-6"
          style={{ background: '#fff', height: 56, borderBottom: '1px solid #f0f0f0' }}
        >
          <div className="flex items-center gap-3">
            {activeTenant && (
              <Text type="secondary" className="text-sm">
                当前租户: <Text strong>{activeTenant.name}</Text>
              </Text>
            )}
            {subscription && (
              <span className="cursor-pointer" onClick={() => setSubModal(true)}>
                <Tag color={isExpired ? 'red' : subPeriod === 'trial' ? 'orange' : 'blue'} icon={<CrownOutlined />}>
                  {subscription.planName} · {PERIOD_MAP[subPeriod]}
                  {subscription.subscriptionExpiresAt && subPeriod !== 'permanent' && subPeriod !== 'trial' &&
                    ` · ${dayjs(subscription.subscriptionExpiresAt).format('YYYY-MM-DD')}到期`}
                </Tag>
              </span>
            )}
          </div>
          <Dropdown menu={{ items: userMenuItems, onClick: handleUserMenuClick }}>
            <div className="flex cursor-pointer items-center gap-2">
              <Avatar size="small" icon={<UserOutlined />} />
              <span className="text-sm">{user?.name || '用户'}</span>
            </div>
          </Dropdown>
        </Header>

        <Content className="overflow-auto p-6" style={{ background: '#f5f5f5' }}>
          <Outlet />
        </Content>
      </Layout>

      {/* 个人设置弹窗 */}
      <Modal
        title="个人设置"
        open={profileModal}
        onCancel={() => setProfileModal(false)}
        onOk={handleSaveProfile}
        confirmLoading={profileLoading}
      >
        <Form layout="vertical">
          <Form.Item label="邮箱">
            <Input value={user?.email || ''} disabled />
          </Form.Item>
          <Form.Item label="姓名">
            <Input
              value={profileForm.name}
              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              placeholder="输入姓名"
            />
          </Form.Item>
          <Form.Item label="原密码（修改密码时填写）">
            <Input.Password
              value={profileForm.oldPassword}
              onChange={(e) => setProfileForm({ ...profileForm, oldPassword: e.target.value })}
              placeholder="输入原密码"
            />
          </Form.Item>
          <Form.Item label="新密码">
            <Input.Password
              value={profileForm.newPassword}
              onChange={(e) => setProfileForm({ ...profileForm, newPassword: e.target.value })}
              placeholder="至少 6 位"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 订阅详情弹窗 */}
      <Modal title="订阅信息" open={subModal} onCancel={() => setSubModal(false)} footer={null} width={600}>
        {subscription && (
          <div>
            <Descriptions size="small" column={2} className="mb-4">
              <Descriptions.Item label="当前套餐"><Tag color="blue">{subscription.planName}</Tag></Descriptions.Item>
              <Descriptions.Item label="付费周期"><Tag>{PERIOD_MAP[subPeriod]}</Tag></Descriptions.Item>
              <Descriptions.Item label="到期时间">
                {subPeriod === 'permanent' ? '永久有效' : subPeriod === 'trial'
                  ? (subscription.trialEndsAt ? dayjs(subscription.trialEndsAt).format('YYYY-MM-DD HH:mm') : '试用中')
                  : (subscription.subscriptionExpiresAt ? dayjs(subscription.subscriptionExpiresAt).format('YYYY-MM-DD HH:mm') : '-')}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={isExpired ? 'red' : 'green'}>{isExpired ? '已过期' : '生效中'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="最大公众号">{subscription.maxAuthorizers}</Descriptions.Item>
              <Descriptions.Item label="最大用户">{subscription.maxUsers}</Descriptions.Item>
            </Descriptions>
            <SelfUpgrade currentPlan={subscription.plan} onUpgraded={() => { queryClient.invalidateQueries({ queryKey: ['my-subscription'] }); }} />
            <Text strong className="mb-2 mt-4 block">订阅记录</Text>
            <Table
              rowKey="id" size="small" pagination={false}
              dataSource={subscription.records || []}
              columns={[
                { title: '套餐', dataIndex: 'plan', width: 80 },
                { title: '周期', dataIndex: 'period', width: 60, render: (v: string) => PERIOD_MAP[v] || v },
                { title: '金额', dataIndex: 'amount', width: 80, render: (v: number) => `¥${(v / 100).toFixed(2)}` },
                { title: '开始', dataIndex: 'startedAt', width: 100, render: (d: string) => d ? dayjs(d).format('YYYY-MM-DD') : '-' },
                { title: '到期', dataIndex: 'expiresAt', width: 100, render: (d: string) => d ? dayjs(d).format('YYYY-MM-DD') : '永久' },
                { title: '状态', dataIndex: 'status', width: 60, render: (s: string) => <Tag color={s === 'active' ? 'green' : 'default'}>{s}</Tag> },
              ]}
            />
          </div>
        )}
      </Modal>

      {/* 租户切换弹窗 */}
      <Modal
        title="切换租户"
        open={tenantModal}
        onCancel={() => setTenantModal(false)}
        footer={null}
        width={400}
      >
        <List
          dataSource={tenants || []}
          renderItem={(item) => (
            <Card
              size="small"
              hoverable
              className={`mb-2 cursor-pointer ${activeTenant?.id === item.id ? 'border-blue-500 bg-blue-50' : ''}`}
              onClick={() => handleSwitchTenant(item)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{item.name}</div>
                  <Text type="secondary" className="text-xs">{item.slug}</Text>
                </div>
                {activeTenant?.id === item.id && (
                  <CheckOutlined className="text-blue-500" />
                )}
              </div>
            </Card>
          )}
          locale={{ emptyText: '暂无可用租户' }}
        />
      </Modal>
    </Layout>
  );
}
