// 多公众号管理 — 卡片/表格视图 + 分组管理
// ============================================================================
import { useState } from 'react';
import {
  Card, Row, Col, Input, Select, Button, Space, Typography, Tag, Image,
  Modal, Form, Tree, Dropdown, message, Skeleton, Empty,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  AppstoreOutlined, UnorderedListOutlined, PlusOutlined,
  FolderAddOutlined, MoreOutlined, EditOutlined, DeleteOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAccounts, getGroupTree, createGroup, updateGroup,
  deleteGroup, addAccountsToGroup, removeFromGroup,
} from '@/services/account.api';
import type { AccountGroup } from '@/services/account.api';
import { useReady } from '@/stores/auth.store';

const { Text, Title } = Typography;

const APP_TYPE_MAP: Record<number, string> = { 0: '订阅号', 1: '升级服务号', 2: '服务号' };

export default function AccountsPage() {
  const queryClient = useQueryClient();
  const ready = useReady();
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [keyword, setKeyword] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>();
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AccountGroup | null>(null);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [movingAccountId, setMovingAccountId] = useState<string | null>(null);
  const [form] = Form.useForm();

  // ── 公众号列表 ──────────────────────────────────────────────────────
  const { data: accountData, isLoading } = useQuery({
    queryKey: ['accounts', keyword, selectedGroup],
    queryFn: () => getAccounts({ page: 1, page_size: 50, keyword, groupId: selectedGroup }),
    enabled: ready,
  });

  // ── 分组树 ──────────────────────────────────────────────────────────
  const { data: groups } = useQuery({
    queryKey: ['account-groups'],
    queryFn: getGroupTree,
    enabled: ready,
  });

  // ── 分组操作 mutations ──────────────────────────────────────────────
  const createGroupMutation = useMutation({
    mutationFn: (values: { name: string; parentId?: string }) => createGroup(values),
    onSuccess: () => {
      message.success('分组已创建');
      queryClient.invalidateQueries({ queryKey: ['account-groups'] });
      setGroupModalOpen(false);
      form.resetFields();
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, ...rest }: { id: string; name?: string }) => updateGroup(id, rest),
    onSuccess: () => {
      message.success('分组已更新');
      queryClient.invalidateQueries({ queryKey: ['account-groups'] });
      setGroupModalOpen(false);
      setEditingGroup(null);
      form.resetFields();
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: deleteGroup,
    onSuccess: () => {
      message.success('分组已删除');
      queryClient.invalidateQueries({ queryKey: ['account-groups'] });
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ groupId, accountId }: { groupId: string; accountId: string }) =>
      addAccountsToGroup(groupId, [accountId]),
    onSuccess: () => {
      message.success('已移动');
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setMoveModalOpen(false);
    },
  });

  // ── 分组操作菜单 ────────────────────────────────────────────────────
  const getGroupMenuItems = (group: AccountGroup): MenuProps['items'] => [
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: '重命名',
      onClick: () => {
        setEditingGroup(group);
        form.setFieldsValue({ name: group.name });
        setGroupModalOpen(true);
      },
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: '删除',
      danger: true,
      onClick: () => deleteGroupMutation.mutate(group.id),
    },
  ];

  const accounts = accountData?.list || [];

  return (
    <div>
      <Title level={4} className="!mb-4">公众号管理</Title>

      <Row gutter={24}>
        {/* 左侧分组 */}
        <Col xs={24} sm={6}>
          <Card
            size="small"
            title="分组"
            extra={
              <Button
                size="small"
                type="text"
                icon={<FolderAddOutlined />}
                onClick={() => {
                  setEditingGroup(null);
                  form.resetFields();
                  setGroupModalOpen(true);
                }}
              />
            }
          >
            <div
              className={`mb-1 cursor-pointer rounded px-2 py-1 text-sm ${!selectedGroup ? 'bg-blue-50 font-medium text-blue-600' : ''}`}
              onClick={() => setSelectedGroup(undefined)}
            >
              全部 ({accountData?.total || 0})
            </div>
            {groups?.map((g) => (
              <div
                key={g.id}
                className={`group mb-1 flex cursor-pointer items-center justify-between rounded px-2 py-1 text-sm ${selectedGroup === g.id ? 'bg-blue-50 font-medium text-blue-600' : ''}`}
                onClick={() => setSelectedGroup(g.id)}
              >
                <span>{g.name} ({g.accountCount})</span>
                <Dropdown menu={{ items: getGroupMenuItems(g) }} trigger={['click']}>
                  <Button type="text" size="small" icon={<MoreOutlined />} />
                </Dropdown>
              </div>
            ))}
            {(!groups || groups.length === 0) && (
              <Text type="secondary" className="text-xs">暂无分组</Text>
            )}
          </Card>
        </Col>

        {/* 右侧公众号列表 */}
        <Col xs={24} sm={18}>
          <Card
            size="small"
            title={
              <Space>
                <Input.Search
                  placeholder="搜索公众号名称"
                  allowClear
                  onSearch={setKeyword}
                  style={{ width: 200 }}
                />
                <Select
                  placeholder="类型"
                  allowClear
                  style={{ width: 120 }}
                  options={[
                    { value: '0', label: '订阅号' },
                    { value: '2', label: '服务号' },
                  ]}
                />
              </Space>
            }
            extra={
              <Space>
                <Button
                  type={viewMode === 'card' ? 'primary' : 'default'}
                  icon={<AppstoreOutlined />}
                  size="small"
                  onClick={() => setViewMode('card')}
                />
                <Button
                  type={viewMode === 'table' ? 'primary' : 'default'}
                  icon={<UnorderedListOutlined />}
                  size="small"
                  onClick={() => setViewMode('table')}
                />
              </Space>
            }
          >
            {isLoading ? (
              <Skeleton active />
            ) : accounts.length === 0 ? (
              <Empty description="暂无公众号，请先完成授权" />
            ) : viewMode === 'card' ? (
              /* 卡片视图 */
              <Row gutter={[16, 16]}>
                {accounts.map((acc: any) => (
                  <Col key={acc.id} xs={24} sm={12} lg={8}>
                    <Card
                      hoverable
                      size="small"
                      cover={
                        acc.headImg ? (
                          <div className="flex justify-center bg-gray-50 py-4">
                            <Image src={acc.headImg} width={64} height={64} className="rounded-full" preview={false} />
                          </div>
                        ) : (
                          <div className="flex justify-center bg-gray-50 py-4">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-200 text-2xl text-gray-400">
                              {acc.nickName?.[0] || '?'}
                            </div>
                          </div>
                        )
                      }
                      actions={[
                        <Dropdown
                          key="move"
                          menu={{
                            items: (groups || []).map((g) => ({
                              key: g.id,
                              label: g.name,
                              onClick: () => moveMutation.mutate({ groupId: g.id, accountId: acc.id }),
                            })),
                          }}
                        >
                          <SwapOutlined key="move" />
                        </Dropdown>,
                      ]}
                    >
                      <Card.Meta
                        title={
                          <Space>
                            <span className="text-sm">{acc.nickName}</span>
                            <Tag color={acc.appType === 2 ? 'blue' : 'default'}>
                              {APP_TYPE_MAP[acc.appType] || '未知'}
                            </Tag>
                          </Space>
                        }
                        description={
                          <div className="text-xs">
                            <Text type="secondary">{acc.appId}</Text>
                            {acc.groups?.length > 0 && (
                              <div className="mt-1">
                                {acc.groups.map((g: any) => (
                                  <Tag key={g.id} className="text-xs">{g.name}</Tag>
                                ))}
                              </div>
                            )}
                          </div>
                        }
                      />
                    </Card>
                  </Col>
                ))}
              </Row>
            ) : (
              /* 列表视图（简化版） */
              <div>
                {accounts.map((acc: any) => (
                  <div
                    key={acc.id}
                    className="flex items-center justify-between border-b py-3 last:border-0"
                  >
                    <Space>
                      {acc.headImg ? (
                        <Image src={acc.headImg} width={36} height={36} className="rounded-full" preview={false} />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200">
                          {acc.nickName?.[0] || '?'}
                        </div>
                      )}
                      <div>
                        <div className="font-medium">{acc.nickName}</div>
                        <Text type="secondary" className="text-xs">{acc.appId}</Text>
                      </div>
                    </Space>
                    <Space>
                      <Tag color={acc.appType === 2 ? 'blue' : 'default'}>
                        {APP_TYPE_MAP[acc.appType] || '未知'}
                      </Tag>
                      {acc.groups?.map((g: any) => (
                        <Tag key={g.id}>{g.name}</Tag>
                      ))}
                    </Space>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* 创建/编辑分组弹窗 */}
      <Modal
        title={editingGroup ? '编辑分组' : '创建分组'}
        open={groupModalOpen}
        onOk={() => form.submit()}
        onCancel={() => {
          setGroupModalOpen(false);
          setEditingGroup(null);
          form.resetFields();
        }}
        confirmLoading={createGroupMutation.isPending || updateGroupMutation.isPending}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            if (editingGroup) {
              updateGroupMutation.mutate({ id: editingGroup.id, ...values });
            } else {
              createGroupMutation.mutate(values);
            }
          }}
        >
          <Form.Item name="name" label="分组名称" rules={[{ required: true, message: '请输入分组名称' }]}>
            <Input placeholder="例如：电商客户、品牌账号" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
