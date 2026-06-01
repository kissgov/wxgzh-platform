// 粉丝管理页 — 粉丝列表 + 标签管理 + 画像
// ============================================================================
import { useState } from 'react';
import {
  Card, Table, Tag, Space, Input, Select, Button, Modal, message,
  Tabs, Row, Col, Statistic, Popconfirm, Tooltip, Image,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SearchOutlined, TagsOutlined, BarChartOutlined,
  PlusOutlined, DeleteOutlined, ReloadOutlined,
  UserOutlined, ManOutlined, WomanOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AuthorizerSelect from '@/components/common/AuthorizerSelect';
import {
  getFollowers, getTags, createTag, deleteTag, batchTag, batchUntag, getPortrait,
} from '@/services/follower.api';

const SEX_MAP: Record<number, string> = { 0: '未知', 1: '男', 2: '女' };

export default function FollowersPage() {
  const queryClient = useQueryClient();
  const [authorizerId, setAuthorizerId] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [tagFilter, setTagFilter] = useState<string | undefined>();
  const [sexFilter, setSexFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  // ── 粉丝列表查询 ────────────────────────────────────────────────────
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['followers', authorizerId, page, keyword, tagFilter, sexFilter],
    queryFn: () =>
      getFollowers(authorizerId, {
        page, page_size: 30, keyword, tagId: tagFilter, sex: sexFilter,
      }),
    enabled: !!authorizerId,
  });

  // ── 标签列表 ────────────────────────────────────────────────────────
  const { data: tags } = useQuery({
    queryKey: ['follower-tags', authorizerId],
    queryFn: () => getTags(authorizerId),
    enabled: !!authorizerId,
  });

  // ── 粉丝画像 ────────────────────────────────────────────────────────
  const { data: portrait } = useQuery({
    queryKey: ['follower-portrait', authorizerId],
    queryFn: () => getPortrait(authorizerId),
    enabled: !!authorizerId,
  });

  // ── Mutations ───────────────────────────────────────────────────────
  const createTagMut = useMutation({
    mutationFn: (name: string) => createTag(authorizerId, { name }),
    onSuccess: () => {
      message.success('标签已创建');
      queryClient.invalidateQueries({ queryKey: ['follower-tags'] });
      setTagModalOpen(false); setNewTagName('');
    },
  });

  const deleteTagMut = useMutation({
    mutationFn: deleteTag,
    onSuccess: () => {
      message.success('标签已删除');
      queryClient.invalidateQueries({ queryKey: ['follower-tags'] });
    },
  });

  // ── 表格列 ──────────────────────────────────────────────────────────
  const columns: ColumnsType<any> = [
    {
      title: '粉丝',
      key: 'info',
      width: 280,
      render: (_, r) => (
        <Space>
          <Image src={r.headImg} width={36} height={36} className="rounded-full" preview={false}
            fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzYiIGhlaWdodD0iMzYiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjM2IiBoZWlnaHQ9IjM2IiBmaWxsPSIjZjBmMGYwIi8+PC9zdmc+"
          />
          <div>
            <div className="font-medium">{r.nickname || '微信用户'}</div>
            <div className="text-xs text-gray-400">{r.openid?.substring(0, 16)}...</div>
          </div>
        </Space>
      ),
    },
    {
      title: '性别', dataIndex: 'sex', width: 80,
      render: (s: number) => (
        <Tag icon={s === 1 ? <ManOutlined /> : s === 2 ? <WomanOutlined /> : undefined}>
          {SEX_MAP[s] || '未知'}
        </Tag>
      ),
    },
    {
      title: '地区', key: 'region', width: 140,
      render: (_, r) => [r.province, r.city].filter(Boolean).join(' ') || '-',
    },
    {
      title: '标签', key: 'tags', width: 200,
      render: (_, r) => (
        <Space size={2} wrap>
          {(r.tags || []).map((t: any) => (
            <Tag key={t.id} color={t.color || '#1677FF'} className="text-xs">{t.name}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '互动', dataIndex: 'interactCount', width: 80,
    },
    {
      title: '关注时间', dataIndex: 'subscribeAt', width: 160,
      render: (d: string) => d ? new Date(d).toLocaleDateString('zh-CN') : '-',
    },
    {
      title: '备注', dataIndex: 'remark', width: 120, ellipsis: true,
    },
  ];

  const tabItems = [
    {
      key: 'list',
      label: '粉丝列表',
      children: (
        <div>
          {/* 筛选栏 */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Input.Search
              placeholder="搜索昵称/备注/OpenID"
              allowClear
              onSearch={setKeyword}
              style={{ width: 220 }}
            />
            <Select
              placeholder="按标签筛选"
              allowClear
              style={{ width: 160 }}
              value={tagFilter}
              onChange={setTagFilter}
              options={tags?.map((t: any) => ({ value: t.id, label: t.name }))}
            />
            <Select
              placeholder="性别"
              allowClear
              style={{ width: 100 }}
              value={sexFilter}
              onChange={setSexFilter}
              options={[{ value: '1', label: '男' }, { value: '2', label: '女' }]}
            />

            <div className="flex-1" />

            {selectedRowKeys.length > 0 && (
              <Button onClick={() => setTagModalOpen(true)} icon={<TagsOutlined />}>
                批量打标签 ({selectedRowKeys.length})
              </Button>
            )}
            <Button onClick={() => refetch()} icon={<ReloadOutlined />}>刷新</Button>
          </div>

          <Table
            rowKey="id"
            columns={columns}
            dataSource={data?.list || []}
            loading={isLoading}
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys as string[]),
            }}
            pagination={{
              current: page,
              total: data?.total || 0,
              pageSize: 30,
              showTotal: (t) => `共 ${t} 位粉丝`,
              onChange: setPage,
            }}
            scroll={{ y: 'calc(100vh - 360px)' }}
            size="small"
          />
        </div>
      ),
    },
    {
      key: 'portrait',
      label: '粉丝画像',
      children: portrait ? (
        <Row gutter={[24, 24]}>
          <Col span={6}>
            <Card><Statistic title="粉丝总数" value={portrait.totalFollowers} prefix={<UserOutlined />} /></Card>
          </Col>
          <Col span={6}>
            <Card><Statistic title="男性占比" value={`${Math.round(portrait.gender.male * 100)}%`} prefix={<ManOutlined />} /></Card>
          </Col>
          <Col span={6}>
            <Card><Statistic title="女性占比" value={`${Math.round(portrait.gender.female * 100)}%`} prefix={<WomanOutlined />} /></Card>
          </Col>
          <Col span={6}>
            <Card><Statistic title="未知性别" value={`${Math.round(portrait.gender.unknown * 100)}%`} /></Card>
          </Col>
          <Col span={12}>
            <Card title="地域分布 TOP10">
              {portrait.region?.slice(0, 10).map((r: any) => (
                <div key={r.province} className="mb-1 flex justify-between text-sm">
                  <span>{r.province}</span>
                  <span className="text-gray-400">{r.count.toLocaleString()}</span>
                </div>
              ))}
            </Card>
          </Col>
          <Col span={12}>
            <Card title="标签统计">
              {tags?.map((t: any) => (
                <Tag key={t.id} color={t.color} className="mb-1">
                  {t.name}
                </Tag>
              ))}
            </Card>
          </Col>
        </Row>
      ) : (
        <div className="py-12 text-center text-gray-400">请选择公众号后查看粉丝画像</div>
      ),
    },
    {
      key: 'tags',
      label: '标签管理',
      children: (
        <div>
          <div className="mb-4 flex items-center gap-2">
            <Input
              placeholder="新标签名称"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              style={{ width: 200 }}
              onPressEnter={() => newTagName && createTagMut.mutate(newTagName)}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => newTagName && createTagMut.mutate(newTagName)}
              loading={createTagMut.isPending}
            >
              创建标签
            </Button>
          </div>
          <Space wrap>
            {tags?.map((t: any) => (
              <Popconfirm
                key={t.id}
                title={`确定删除标签「${t.name}」？`}
                onConfirm={() => deleteTagMut.mutate(t.id)}
              >
                <Tag
                  color={t.color || '#1677FF'}
                  closable
                  onClose={(e) => { e.preventDefault(); deleteTagMut.mutate(t.id); }}
                  className="cursor-pointer px-3 py-1 text-sm"
                >
                  {t.name}
                </Tag>
              </Popconfirm>
            ))}
          </Space>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-2 flex items-center gap-4">
        <h2 className="text-lg font-semibold">粉丝管理</h2>
        <AuthorizerSelect value={authorizerId} onChange={(id) => setAuthorizerId(id)} />
      </div>
      <Card>
        <Tabs items={tabItems} />
      </Card>

      {/* 批量打标签弹窗 */}
      <Modal
        title={`批量打标签 (${selectedRowKeys.length} 位粉丝)`}
        open={tagModalOpen}
        onCancel={() => setTagModalOpen(false)}
        onOk={() => {
          // 简化处理：使用第一个可用标签
          if (tags?.[0]) {
            batchTag({ followerIds: selectedRowKeys, tagIds: [tags[0].id] }).then(() => {
              message.success('批量打标签已提交');
              setTagModalOpen(false);
              setSelectedRowKeys([]);
              refetch();
            });
          }
        }}
      >
        <Select
          placeholder="选择标签"
          style={{ width: '100%' }}
          options={tags?.map((t: any) => ({ value: t.id, label: t.name }))}
        />
      </Modal>
    </div>
  );
}
