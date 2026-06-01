// 内容创作 — 文章管理 + 分类 + 模板
// ============================================================================
import { useState } from 'react';
import {
  Card, Table, Button, Space, Tag, Input, Select, Modal, Form, message, Popconfirm, Tabs, Typography, Empty,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, FileTextOutlined, FolderOutlined, AppstoreOutlined, RobotOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import apiClient from '@/services/api-client';
import {
  getArticles, createArticle, deleteArticle,
  getCategories, createCategory, deleteCategory,
  getTemplates, createTemplate, applyTemplate, deleteTemplate,
} from '@/services/content.api';
import AuthorizerSelect from '@/components/common/AuthorizerSelect';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'default' },
  pending_review: { label: '待审核', color: 'orange' },
  approved: { label: '已通过', color: 'blue' },
  published: { label: '已发布', color: 'green' },
  failed: { label: '失败', color: 'red' },
};

export default function ContentPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [authorizerId, setAuthorizerId] = useState<string>('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [keyword, setKeyword] = useState('');
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catName, setCatName] = useState('');
  const [tplModalOpen, setTplModalOpen] = useState(false);
  const [tplForm] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['articles', authorizerId, page, statusFilter, keyword],
    queryFn: () => getArticles(authorizerId, { page, page_size: 20, status: statusFilter, keyword }),
    enabled: !!authorizerId,
  });
  const { data: categories } = useQuery({
    queryKey: ['article-categories'], queryFn: getCategories,
  });
  const { data: templates } = useQuery({
    queryKey: ['article-templates'], queryFn: () => getTemplates(),
  });

  const handleCreate = () => {
    if (!authorizerId) { message.warning('请先选择公众号'); return; }
    navigate(`/content/articles/new?authorizerId=${authorizerId}`);
  };
  const deleteMut = useMutation({
    mutationFn: deleteArticle,
    onSuccess: () => { message.success('已删除'); queryClient.invalidateQueries({ queryKey: ['articles'] }); },
  });
  const addCatMut = useMutation({
    mutationFn: createCategory,
    onSuccess: () => { message.success('分类已创建'); setCatModalOpen(false); setCatName(''); queryClient.invalidateQueries({ queryKey: ['article-categories'] }); },
  });
  const delCatMut = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => { message.success('已删除'); queryClient.invalidateQueries({ queryKey: ['article-categories'] }); },
  });
  const saveTplMut = useMutation({
    mutationFn: createTemplate,
    onSuccess: () => { message.success('模板已保存'); setTplModalOpen(false); tplForm.resetFields(); queryClient.invalidateQueries({ queryKey: ['article-templates'] }); },
  });
  const applyTplMut = useMutation({
    mutationFn: ({ id }: { id: string }) => applyTemplate(authorizerId, id),
    onSuccess: (d: any) => { message.success('模板已应用'); navigate(`/content/articles/${d.id}`); },
  });
  const delTplMut = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => { message.success('已删除'); queryClient.invalidateQueries({ queryKey: ['article-templates'] }); },
  });

  const columns: ColumnsType<any> = [
    { title: '标题', dataIndex: 'title', width: 280, ellipsis: true,
      render: (t: string, r: any) => <a onClick={() => navigate(`/content/articles/${r.id}`)}>{t}</a>,
    },
    { title: '分类', key: 'cat', width: 100, render: (_, r) => r.category?.name ? <Tag>{r.category.name}</Tag> : '-' },
    { title: '状态', dataIndex: 'status', width: 90,
      render: (s: string) => <Tag color={STATUS_MAP[s]?.color || 'default'}>{STATUS_MAP[s]?.label || s}</Tag>,
    },
    { title: '标签', dataIndex: 'tags', width: 150, ellipsis: true, render: (ts: string[]) => ts?.length ? ts.join(', ') : '-' },
    { title: '版本', dataIndex: 'version', width: 60 },
    { title: '更新时间', dataIndex: 'updatedAt', width: 150, render: (d: string) => d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '-' },
    { title: '操作', key: 'act', width: 140,
      render: (_, r) => (
        <Space size={0}>
          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => navigate(`/content/articles/${r.id}`)}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => deleteMut.mutate(r.id)}>
            <Button size="small" type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'articles', label: <span><FileTextOutlined /> 文章列表</span>,
      children: (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建文章</Button>
            <Input.Search placeholder="搜索标题" allowClear style={{ width: 200 }} onSearch={setKeyword} />
            <Select placeholder="状态筛选" allowClear style={{ width: 120 }} value={statusFilter} onChange={setStatusFilter}
              options={Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: v.label }))}
            />
            <div className="flex-1" />
            <Text type="secondary" className="text-xs">共 {data?.total || 0} 篇</Text>
          </div>
          <Table rowKey="id" columns={columns} dataSource={data?.list || []} loading={isLoading}
            pagination={{ current: page, total: data?.total || 0, pageSize: 20, onChange: setPage }}
            size="small" locale={{ emptyText: <Empty description="请选择公众号后查看文章" /> }} />
        </div>
      ),
    },
    {
      key: 'categories', label: <span><FolderOutlined /> 分类管理</span>,
      children: (
        <div>
          <div className="mb-3">
            <Input.Search placeholder="新分类名称" enterButton="创建" style={{ width: 280 }}
              value={catName} onChange={(e) => setCatName(e.target.value)}
              onSearch={(v) => v && addCatMut.mutate(v)} loading={addCatMut.isPending} />
          </div>
          <Space wrap>{(categories || []).map((c: any) => (
            <Tag key={c.id} closable onClose={(e) => { e.preventDefault(); delCatMut.mutate(c.id); }} className="px-2 py-1">{c.name}</Tag>
          ))}</Space>
        </div>
      ),
    },
    {
      key: 'templates', label: <span><AppstoreOutlined /> 模板库</span>,
      children: (
        <div>
          <div className="mb-3"><Button icon={<PlusOutlined />} onClick={() => { tplForm.resetFields(); setTplModalOpen(true); }}>创建模板</Button></div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {(templates || []).map((t: any) => (
              <Card key={t.id} size="small" hoverable actions={[
                <Button key="apply" size="small" type="link" onClick={() => applyTplMut.mutate({ id: t.id })} disabled={!authorizerId}>应用</Button>,
                <Popconfirm key="del" title="确定删除？" onConfirm={() => delTplMut.mutate(t.id)}><Button size="small" type="link" danger>删除</Button></Popconfirm>,
              ]}>
                <Card.Meta title={t.name} description={t.description || t.category || '无描述'} />
              </Card>
            ))}
          </div>
        </div>
      ),
    },
    {
      key: 'ai', label: <span><RobotOutlined /> AI 助手</span>,
      children: (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card title="AI 智能创作" size="small">
            <Space direction="vertical" className="w-full">
              <Input placeholder="输入主题，如：2026年AI发展趋势" id="ai-topic" />
              <Button type="primary" icon={<RobotOutlined />} block onClick={async () => {
                const topic = (document.getElementById('ai-topic') as HTMLInputElement)?.value;
                if (!topic) { message.warning('请输入主题'); return; }
                if (!authorizerId) { message.warning('请先选择公众号'); return; }
                try {
                  const { data: res } = await apiClient.post('/llm/scheduled-article', { topic }, { params: { authorizerId } });
                  if (res.data) { message.success('AI 文章草稿已生成'); queryClient.invalidateQueries({ queryKey: ['articles'] }); }
                } catch { message.error('AI 生成失败，请检查 LLM 配置'); }
              }}>生成文章草稿</Button>
            </Space>
          </Card>
          <Card title="AI 运营周报" size="small">
            <Space direction="vertical" className="w-full">
              <Text type="secondary" className="text-xs">基于近 7 天数据自动生成运营总结</Text>
              <Button icon={<RobotOutlined />} block onClick={async () => {
                if (!authorizerId) { message.warning('请先选择公众号'); return; }
                try {
                  const { data: res } = await apiClient.post('/llm/weekly-report', {}, { params: { authorizerId } });
                  if (res.data) {
                    Modal.info({ title: 'AI 运营周报', content: res.data.report, width: 500 });
                  }
                } catch { message.error('周报生成失败'); }
              }}>生成周报</Button>
            </Space>
          </Card>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-2 flex items-center gap-4">
        <Title level={4} className="!mb-0">内容创作</Title>
        <AuthorizerSelect value={authorizerId} onChange={(id) => setAuthorizerId(id)} />
      </div>
      <Card><Tabs items={tabItems} /></Card>

      {/* 模板创建弹窗 */}
      <Modal title="创建模板" open={tplModalOpen} onCancel={() => setTplModalOpen(false)} onOk={() => tplForm.submit()} confirmLoading={saveTplMut.isPending}>
        <Form form={tplForm} layout="vertical" onFinish={(v) => saveTplMut.mutate(v)}>
          <Form.Item name="name" label="模板名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="category" label="分类"><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
