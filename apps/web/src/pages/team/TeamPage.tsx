// 团队管理 — 用户管理 + 角色管理 + 邀请 + 审批 + 活动日志
// ============================================================================
import { useState } from 'react';
import {
  Card, Table, Button, Space, Tag, Modal, Form, Input, Select, message, Popconfirm, Tabs, Typography,
  Checkbox, List, Timeline, Badge, Divider, Row, Col, Tooltip, Popover,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, TeamOutlined, SafetyCertificateOutlined,
  MailOutlined, CheckCircleOutlined, HistoryOutlined, SendOutlined, StopOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { getUsers, getPermissions } from '@/services/tenant.api';
import { getAccounts } from '@/services/account.api';
import {
  getInvitations, createInvitation, cancelInvitation,
  getApprovalRequests, approveRequest, rejectRequest,
  getTeamActivities,
} from '@/services/team.api';
import apiClient from '@/services/api-client';
import { useAuthStore, useReady } from '@/stores/auth.store';
import AuthorizerSelect from '@/components/common/AuthorizerSelect';

const { Text, Title } = Typography;

const STATUS_COLORS: Record<string, string> = {
  pending: 'orange', accepted: 'green', expired: 'default', cancelled: 'default',
  approved: 'green', rejected: 'red', draft: 'default',
};

export default function TeamPage() {
  const queryClient = useQueryClient();
  const ready = useReady();
  const [userModal, setUserModal] = useState(false);
  const [roleModal, setRoleModal] = useState(false);
  const [inviteModal, setInviteModal] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [userForm] = Form.useForm();
  const [roleForm] = Form.useForm();
  const [inviteForm] = Form.useForm();
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);

  // 基础数据
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['team-users'], queryFn: getUsers, enabled: ready,
  });
  const { data: roles } = useQuery({
    queryKey: ['team-roles'], queryFn: async () => { const { data: r } = await apiClient.get('/roles'); return r.data || []; }, enabled: ready,
  });
  const { data: permissionGroups } = useQuery({
    queryKey: ['permissions'], queryFn: getPermissions, enabled: ready,
  });
  const { data: authorizers } = useQuery({
    queryKey: ['all-authorizers'], queryFn: async () => (await getAccounts({ page: 1, page_size: 100 }))?.list || [], enabled: ready,
  });

  // Sprint 1 新数据
  const { data: invitations } = useQuery({
    queryKey: ['team-invitations'], queryFn: getInvitations, enabled: ready,
  });
  const { data: approvalRequests } = useQuery({
    queryKey: ['team-approval-requests'], queryFn: getApprovalRequests, enabled: ready,
  });
  const { data: activitiesData } = useQuery({
    queryKey: ['team-activities'], queryFn: () => getTeamActivities({ page_size: 30 }), enabled: ready,
  });

  // ── Mutations ────────────────────────────────────────────────────
  const toggleUserStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiClient.put(`/users/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team-users'] }),
  });
  const saveUserMut = useMutation({
    mutationFn: ({ id, ...v }: any) => id ? apiClient.put(`/users/${id}`, v) : apiClient.post('/users', v),
    onSuccess: () => { message.success(editingUser ? '已更新' : '用户已创建'); setUserModal(false); userForm.resetFields(); queryClient.invalidateQueries({ queryKey: ['team-users'] }); },
    onError: (e: any) => message.error(e?.response?.data?.message || '操作失败'),
  });
  const createRoleMut = useMutation({
    mutationFn: (v: any) => apiClient.post('/roles', v),
    onSuccess: () => { message.success('角色已创建'); setRoleModal(false); roleForm.resetFields(); setSelectedPerms([]); queryClient.invalidateQueries({ queryKey: ['team-roles'] }); },
  });
  const updateRoleMut = useMutation({
    mutationFn: ({ id, ...v }: any) => apiClient.put(`/roles/${id}`, v),
    onSuccess: () => { message.success('已更新'); setRoleModal(false); queryClient.invalidateQueries({ queryKey: ['team-roles'] }); },
  });
  const deleteRoleMut = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/roles/${id}`),
    onSuccess: () => { message.success('已删除'); queryClient.invalidateQueries({ queryKey: ['team-roles'] }); },
  });

  // 邀请
  const inviteMut = useMutation({
    mutationFn: createInvitation,
    onSuccess: () => { message.success('邀请已发送'); setInviteModal(false); inviteForm.resetFields(); queryClient.invalidateQueries({ queryKey: ['team-invitations'] }); },
    onError: (e: any) => message.error(e?.response?.data?.message || '发送失败'),
  });
  const cancelInviteMut = useMutation({
    mutationFn: cancelInvitation,
    onSuccess: () => { message.success('已取消'); queryClient.invalidateQueries({ queryKey: ['team-invitations'] }); },
  });

  // 审批
  const approveMut = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) => approveRequest(id, comment),
    onSuccess: () => { message.success('已通过'); queryClient.invalidateQueries({ queryKey: ['team-approval-requests'] }); },
  });
  const rejectMut = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) => rejectRequest(id, comment),
    onSuccess: () => { message.success('已驳回'); queryClient.invalidateQueries({ queryKey: ['team-approval-requests'] }); },
  });

  // ── 列定义 ──────────────────────────────────────────────────────
  const userColumns: ColumnsType<any> = [
    { title: '姓名', dataIndex: 'name', width: 120 },
    { title: '邮箱', dataIndex: 'email', width: 200 },
    { title: '角色', dataIndex: 'roles', width: 200, render: (rs: any[]) => rs?.map((r: any) => <Tag key={r.id} color="blue">{r.name}</Tag>) || '-' },
    { title: '可管理公众号', key: 'authorizers', width: 200, render: (_: any, r: any) => r.authorizers?.length ? r.authorizers.map((a: any) => <Tag key={a.id}>{a.name}</Tag>) : <Tag color="default">全部</Tag> },
    { title: '状态', dataIndex: 'status', width: 80, render: (s: string) => <Tag color={s === 'active' ? 'green' : 'red'}>{s === 'active' ? '正常' : '禁用'}</Tag> },
    { title: '创建时间', dataIndex: 'createdAt', width: 160, render: (d: string) => d ? new Date(d).toLocaleString('zh-CN') : '-' },
    { title: '操作', key: 'act', width: 180,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingUser(r); userForm.setFieldsValue({ name: r.name, email: r.email, roleIds: r.roles?.map((role: any) => role.id) || [], authorizerIds: r.authorizers?.map((a: any) => a.id) || [] }); setUserModal(true); }}>编辑</Button>
          <Button size="small" loading={toggleUserStatusMut.isPending} onClick={() => toggleUserStatusMut.mutate({ id: r.id, status: r.status === 'active' ? 'disabled' : 'active' })}>{r.status === 'active' ? '禁用' : '启用'}</Button>
        </Space>
      ),
    },
  ];

  const roleColumns: ColumnsType<any> = [
    { title: '角色名称', dataIndex: 'name', width: 140 },
    { title: '标识', dataIndex: 'slug', width: 100 },
    {
      title: '权限', dataIndex: 'permissions', width: 360,
      render: (ps: any[]) => {
        if (!ps?.length) return <Text type="secondary">-</Text>;
        const grouped: Record<string, any[]> = {};
        ps.forEach((p: any) => {
          const resource = p.slug.split(':')[0] || 'other';
          if (!grouped[resource]) grouped[resource] = [];
          grouped[resource]!.push(p);
        });
        const names: Record<string, string> = {
          platform: '平台', account: '公众号', follower: '粉丝', message: '消息',
          material: '素材', menu: '菜单', analytics: '数据',
        };
        return (
          <Space size={2} wrap>
            {Object.entries(grouped).map(([res, perms]) => (
              <Tooltip key={res} title={perms.map((p: any) => p.name).join('、')} mouseEnterDelay={0.3}>
                <Tag color="blue" className="cursor-default text-[11px] leading-tight" style={{ marginInlineEnd: 2 }}>
                  {names[res] || res}({perms.length})
                </Tag>
              </Tooltip>
            ))}
          </Space>
        );
      },
    },
    { title: '系统', dataIndex: 'isSystem', width: 80, render: (v: boolean) => v ? <Tag color="orange">系统</Tag> : <Tag>自定义</Tag> },
    { title: '操作', key: 'act', width: 160,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingRole(r); setSelectedPerms(r.permissions?.map((p: any) => p.id) || []); roleForm.setFieldsValue({ name: r.name, slug: r.slug }); setRoleModal(true); }} />
          {!r.isSystem && <Popconfirm title="确定删除？" onConfirm={() => deleteRoleMut.mutate(r.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>}
        </Space>
      ),
    },
  ];

  const invitationColumns: ColumnsType<any> = [
    { title: '邮箱', dataIndex: 'email', width: 220 },
    { title: '邀请人', key: 'inviter', width: 120, render: (_, r: any) => r.inviter?.name || '-' },
    { title: '状态', dataIndex: 'status', width: 100, render: (s: string) => <Tag color={STATUS_COLORS[s] || 'default'}>{s}</Tag> },
    { title: '过期时间', dataIndex: 'expiresAt', width: 150, render: (d: string) => d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '-' },
    { title: '创建时间', dataIndex: 'createdAt', width: 150, render: (d: string) => d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '-' },
    { title: '操作', key: 'act', width: 100,
      render: (_, r) => r.status === 'pending' ? (
        <Popconfirm title="确定取消此邀请？" onConfirm={() => cancelInviteMut.mutate(r.id)}>
          <Button size="small" danger icon={<StopOutlined />}>取消</Button>
        </Popconfirm>
      ) : null,
    },
  ];

  const approvalColumns: ColumnsType<any> = [
    { title: '类型', dataIndex: 'resourceType', width: 100, render: (t: string) => <Tag>{t}</Tag> },
    { title: '提交人', key: 'submitter', width: 120, render: (_, r: any) => r.submitter?.name || '-' },
    { title: '审批流', key: 'workflow', width: 120, render: (_, r: any) => r.workflow?.name || '-' },
    { title: '状态', dataIndex: 'status', width: 100, render: (s: string) => <Tag color={STATUS_COLORS[s] || 'default'}>{s}</Tag> },
    { title: '提交时间', dataIndex: 'submittedAt', width: 150, render: (d: string) => d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '-' },
    { title: '操作', key: 'act', width: 160,
      render: (_, r) => r.status === 'pending' ? (
        <Space>
          <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => approveMut.mutate({ id: r.id })}>通过</Button>
          <Button size="small" danger onClick={() => { const c = prompt('驳回原因（可选）：'); rejectMut.mutate({ id: r.id, comment: c || undefined }); }}>驳回</Button>
        </Space>
      ) : null,
    },
  ];

  const actionLabels: Record<string, string> = {
    'user.invited': '邀请了新成员',
    'user.joined': '加入了团队',
    'article.submitted': '提交了文章审批',
    'article.approved': '通过了文章审批',
    'article.rejected': '驳回了文章审批',
    'campaign.published': '发布了营销活动',
  };

  const tabItems = [
    { key: 'users', label: <span><TeamOutlined /> 用户管理</span>,
      children: (
        <div>
          <div className="mb-4"><Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingUser(null); userForm.resetFields(); setUserModal(true); }}>添加用户</Button></div>
          <Table rowKey="id" columns={userColumns} dataSource={users || []} loading={usersLoading} pagination={false} size="small" />
        </div>
      ),
    },
    { key: 'roles', label: <span><SafetyCertificateOutlined /> 角色管理</span>,
      children: (
        <div>
          <div className="mb-4"><Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingRole(null); roleForm.resetFields(); setSelectedPerms([]); setRoleModal(true); }}>创建角色</Button></div>
          <Table rowKey="id" columns={roleColumns} dataSource={roles || []} pagination={false} size="small" />
        </div>
      ),
    },
    { key: 'invitations', label: <span><MailOutlined /> 邀请管理 <Badge count={invitations?.filter((i: any) => i.status === 'pending').length || 0} size="small" offset={[6, 0]} /></span>,
      children: (
        <div>
          <div className="mb-4"><Button type="primary" icon={<SendOutlined />} onClick={() => { inviteForm.resetFields(); setInviteModal(true); }}>邀请成员</Button></div>
          <Table rowKey="id" columns={invitationColumns} dataSource={invitations || []} pagination={false} size="small" locale={{ emptyText: '暂无邀请' }} />
        </div>
      ),
    },
    { key: 'approvals', label: <span><CheckCircleOutlined /> 审批中心 <Badge count={approvalRequests?.filter((r: any) => r.status === 'pending').length || 0} size="small" offset={[6, 0]} /></span>,
      children: (
        <div>
          <Table rowKey="id" columns={approvalColumns} dataSource={approvalRequests || []} pagination={false} size="small" locale={{ emptyText: '暂无审批' }} />
        </div>
      ),
    },
    { key: 'activity', label: <span><HistoryOutlined /> 活动日志</span>,
      children: (
        <List
          dataSource={activitiesData?.list || []}
          renderItem={(item: any) => (
            <List.Item className="flex items-start">
              <Timeline style={{ width: '100%' }}>
                <Timeline.Item color="blue">
                  <div className="flex items-center gap-2">
                    <Text strong>{item.user?.name || '未知用户'}</Text>
                    <Text type="secondary">{actionLabels[item.action] || item.action}</Text>
                    {item.targetType && <Tag className="text-xs">{item.targetType}</Tag>}
                    <Text type="secondary" className="text-xs ml-auto">{dayjs(item.createdAt).format('YYYY-MM-DD HH:mm')}</Text>
                  </div>
                </Timeline.Item>
              </Timeline>
            </List.Item>
          )}
          locale={{ emptyText: '暂无活动' }}
        />
      ),
    },
  ];

  return (
    <div>
      <Title level={4} className="!mb-4">团队管理</Title>
      <Card><Tabs items={tabItems} /></Card>

      {/* 用户弹窗 */}
      <Modal title={editingUser ? '编辑用户' : '添加用户'} open={userModal} onCancel={() => { setUserModal(false); userForm.resetFields(); }} onOk={() => userForm.submit()} confirmLoading={saveUserMut.isPending}>
        <Form form={userForm} layout="vertical" onFinish={(v) => saveUserMut.mutate({ id: editingUser?.id, ...v })}>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}><Input disabled={!!editingUser} /></Form.Item>
          {!editingUser && <Form.Item name="password" label="密码" rules={[{ required: true, min: 6 }]}><Input.Password placeholder="至少6位" /></Form.Item>}
          <Form.Item name="roleIds" label="角色"><Select mode="multiple" placeholder="选择角色" options={roles?.map((r: any) => ({ value: r.id, label: r.name }))} /></Form.Item>
          <Form.Item name="authorizerIds" label="可管理的公众号"><Select mode="multiple" placeholder="全部" options={authorizers?.map((a: any) => ({ value: a.id, label: a.nickName || a.appId }))} /></Form.Item>
        </Form>
      </Modal>

      {/* 角色弹窗 */}
      <Modal title={editingRole ? '编辑角色' : '创建角色'} open={roleModal} onCancel={() => { setRoleModal(false); setEditingRole(null); }} onOk={() => roleForm.submit()} confirmLoading={createRoleMut.isPending || updateRoleMut.isPending} width={720}>
        <Form form={roleForm} layout="vertical" onFinish={(v) => { const payload = { ...v, permissionIds: selectedPerms }; editingRole ? updateRoleMut.mutate({ id: editingRole.id, ...payload }) : createRoleMut.mutate(payload); }}>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="name" label="角色名称" rules={[{ required: true }]}><Input placeholder="如：运营编辑" /></Form.Item></Col>
            <Col span={12}><Form.Item name="slug" label="角色标识" rules={[{ required: true, pattern: /^[a-z_]+$/ }]}><Input placeholder="如：editor" disabled={!!editingRole} /></Form.Item></Col>
          </Row>
          <Divider plain className="!my-2 !text-xs">权限配置</Divider>
          <div className="max-h-[320px] overflow-y-auto pr-1">
            {Object.entries(permissionGroups || {}).map(([resource, perms]: [string, any]) => {
              const groupIds = (perms as any[]).map((p: any) => p.id);
              const checkedCount = groupIds.filter((id: string) => selectedPerms.includes(id)).length;
              const allChecked = checkedCount === groupIds.length;
              const someChecked = checkedCount > 0 && checkedCount < groupIds.length;
              return (
                <div key={resource} className="mb-2 rounded border border-gray-200 bg-gray-50 p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <Space size={4}>
                      <Checkbox
                        checked={allChecked}
                        indeterminate={someChecked}
                        onChange={() => {
                          if (allChecked) {
                            setSelectedPerms(selectedPerms.filter((id) => !groupIds.includes(id)));
                          } else {
                            const others = selectedPerms.filter((id) => !groupIds.includes(id));
                            setSelectedPerms([...others, ...groupIds]);
                          }
                        }}
                      />
                      <Text strong className="text-xs">{resource}</Text>
                    </Space>
                    <Tag className="!mr-0 text-[10px] leading-tight" color={allChecked ? 'blue' : 'default'}>{checkedCount}/{groupIds.length}</Tag>
                  </div>
                  <Checkbox.Group value={selectedPerms} onChange={(vals) => { const others = selectedPerms.filter((id) => !groupIds.includes(id)); setSelectedPerms([...others, ...(vals as string[])]); }}>
                    <div className="ml-6 flex flex-wrap gap-x-3 gap-y-0">
                      {(perms as any[]).map((p: any) => (
                        <Checkbox key={p.id} value={p.id} className="!text-xs !leading-6">{p.name}</Checkbox>
                      ))}
                    </div>
                  </Checkbox.Group>
                </div>
              );
            })}
          </div>
        </Form>
      </Modal>

      {/* 邀请弹窗 */}
      <Modal title="邀请成员" open={inviteModal} onCancel={() => setInviteModal(false)} onOk={() => inviteForm.submit()} confirmLoading={inviteMut.isPending}>
        <Form form={inviteForm} layout="vertical" onFinish={(v) => inviteMut.mutate(v)}>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}><Input placeholder="colleague@company.com" /></Form.Item>
          <Form.Item name="roleIds" label="角色"><Select mode="multiple" placeholder="选择角色" options={roles?.map((r: any) => ({ value: r.id, label: r.name }))} /></Form.Item>
          <Form.Item name="authorizerIds" label="可管理的公众号"><Select mode="multiple" placeholder="全部" options={authorizers?.map((a: any) => ({ value: a.id, label: a.nickName || a.appId }))} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
