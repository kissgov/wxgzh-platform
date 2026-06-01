// 第三方平台授权管理 — 授权列表 + 生成授权码 + 回收 + 平台配置
// ============================================================================
import { useState } from 'react';
import {
  Card, Table, Button, Tag, Space, Modal, Image, message, Popconfirm,
  Typography, Descriptions, Tooltip, Input, Tabs,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined, ReloadOutlined, SyncOutlined, SettingOutlined,
  DeleteOutlined, EyeOutlined,
} from '@ant-design/icons';
import PlatformSettings from './PlatformSettings';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AuthorizerItem } from '@/services/platform.api';
import { useAuthStore, useReady } from '@/stores/auth.store';
import {
  getAuthorizers, generateAuthUrl, syncAuthorizer, revokeAuthorizer,
} from '@/services/platform.api';

const { Text } = Typography;

const APP_TYPE_MAP: Record<number, string> = { 0: '订阅号', 1: '升级服务号', 2: '服务号' };
const STATUS_MAP: Record<string, { color: string; label: string }> = {
  authorized: { color: 'green', label: '已授权' },
  expired: { color: 'orange', label: '已过期' },
  revoked: { color: 'red', label: '已回收' },
};

export default function PlatformPage() {
  const queryClient = useQueryClient();
  const ready = useReady();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authQrUrl, setAuthQrUrl] = useState('');
  const [authUrl, setAuthUrl] = useState('');

  // ── 查询授权列表 ────────────────────────────────────────────────────
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['authorizers', searchKeyword],
    queryFn: () => getAuthorizers({ page: 1, page_size: 50, keyword: searchKeyword }),
    enabled: ready,
  });

  // ── 生成授权 URL ────────────────────────────────────────────────────
  const generateMutation = useMutation({
    mutationFn: generateAuthUrl,
    onSuccess: (result) => {
      setAuthQrUrl(result.qr_code_url);
      setAuthUrl(result.auth_url);
      setAuthModalOpen(true);
    },
    onError: () => message.error('生成授权链接失败'),
  });

  // ── 同步基本信息 ────────────────────────────────────────────────────
  const syncMutation = useMutation({
    mutationFn: syncAuthorizer,
    onSuccess: () => {
      message.success('同步成功');
      queryClient.invalidateQueries({ queryKey: ['authorizers'] });
    },
    onError: () => message.error('同步失败'),
  });

  // ── 回收授权 ────────────────────────────────────────────────────────
  const revokeMutation = useMutation({
    mutationFn: revokeAuthorizer,
    onSuccess: () => {
      message.success('授权已回收');
      queryClient.invalidateQueries({ queryKey: ['authorizers'] });
    },
    onError: () => message.error('回收失败'),
  });

  // ── 表格列 ──────────────────────────────────────────────────────────
  const columns: ColumnsType<AuthorizerItem> = [
    {
      title: '公众号',
      key: 'info',
      width: 300,
      render: (_, record) => (
        <Space>
          <Image
            src={record.headImg || undefined}
            width={40}
            height={40}
            className="rounded-full"
            fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjZjBmMGYwIi8+PC9zdmc+"
            preview={false}
          />
          <div>
            <div className="font-medium">{record.nickName}</div>
            <Text type="secondary" className="text-xs">{record.appId}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'appType',
      width: 120,
      render: (t: number) => <Tag>{APP_TYPE_MAP[t] || '未知'}</Tag>,
    },
    {
      title: '主体',
      dataIndex: 'principalName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (s: string) => {
        const cfg = STATUS_MAP[s] || { color: 'default', label: s };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '授权时间',
      dataIndex: 'authorizedAt',
      width: 170,
      render: (d: string) => new Date(d).toLocaleDateString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="同步信息">
            <Button
              size="small"
              icon={<SyncOutlined />}
              loading={syncMutation.isPending}
              onClick={() => syncMutation.mutate(record.id)}
            />
          </Tooltip>
          {record.status === 'authorized' && (
            <Popconfirm
              title="确定回收此公众号的授权？"
              description="回收后公众号将无法使用平台服务"
              onConfirm={() => revokeMutation.mutate(record.id)}
              okText="确定"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button size="small" danger icon={<DeleteOutlined />}>
                回收
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const user = useAuthStore((s) => s.user);
  const isPlatformDev = user?.roles?.includes('super_admin');

  const tabItems = [
    {
      key: 'authorizers',
      label: '授权管理',
      children: (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <Typography.Title level={5} className="!mb-0">
              已授权公众号
            </Typography.Title>
            <Space>
              <Input.Search
                placeholder="搜索公众号名称/appId"
                allowClear
                onSearch={setSearchKeyword}
                style={{ width: 240 }}
              />
              <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
                刷新
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                loading={generateMutation.isPending}
                onClick={() => generateMutation.mutate({})}
              >
                添加公众号
              </Button>
            </Space>
          </div>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={data?.list || []}
            loading={isLoading}
            pagination={{
              total: data?.total || 0,
              pageSize: 50,
              showTotal: (t) => `共 ${t} 个公众号`,
            }}
            expandable={{
              expandedRowRender: (record) => (
                <Descriptions size="small" column={3}>
                  <Descriptions.Item label="AppID">{record.appId}</Descriptions.Item>
                  <Descriptions.Item label="权限集">
                    {record.funcInfo?.map((f) => (
                      <Tag key={f.funcscope_category.id}>{f.funcscope_category.id}</Tag>
                    )) || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="最后同步">
                    {record.lastSyncAt
                      ? new Date(record.lastSyncAt).toLocaleString('zh-CN')
                      : '未同步'}
                  </Descriptions.Item>
                  <Descriptions.Item label="授权到期">
                    {record.expiredAt
                      ? new Date(record.expiredAt).toLocaleString('zh-CN')
                      : '长期有效'}
                  </Descriptions.Item>
                </Descriptions>
              ),
            }}
          />
        </div>
      ),
    },
    ...(isPlatformDev
      ? [{ key: 'settings', label: '平台配置', children: <PlatformSettings /> }]
      : []),
  ];

  return (
    <div>
      <Typography.Title level={4} className="!mb-4">
        第三方平台授权管理
      </Typography.Title>
      <Card>
        <Tabs
          items={tabItems}
          tabBarExtraContent={
            <Space>
              <SettingOutlined />
              <span className="text-sm text-gray-400">管理微信开放平台对接参数</span>
            </Space>
          }
        />
      </Card>

      {/* 授权二维码弹窗 */}
      <Modal
        title="扫码授权"
        open={authModalOpen}
        onCancel={() => setAuthModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setAuthModalOpen(false)}>
            关闭
          </Button>,
          <Button
            key="done"
            type="primary"
            onClick={() => {
              setAuthModalOpen(false);
              refetch();
            }}
          >
            已完成授权
          </Button>,
        ]}
      >
        <div className="flex flex-col items-center gap-4 py-4">
          <Image src={authQrUrl} width={200} height={200} alt="授权二维码" />
          <Text type="secondary">请使用公众号管理员微信扫码授权</Text>
          <Text type="secondary" className="text-xs">
            二维码有效期 10 分钟
          </Text>
        </div>
      </Modal>
    </div>
  );
}
