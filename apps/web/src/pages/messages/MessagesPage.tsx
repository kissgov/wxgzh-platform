// 消息管理页 — 自动回复配置 + 消息日志 + 群发
// ============================================================================
import { useState } from 'react';
import {
  Card, Tabs, Table, Tag, Space, Button, Modal, Form, Input, Select,
  Switch, message, Popconfirm, Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, SendOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAutoReplyRules, createAutoReplyRule, deleteAutoReplyRule,
  toggleAutoReplyRule, getMessageLogs,
} from '@/services/message.api';
import AuthorizerSelect from '@/components/common/AuthorizerSelect';

const { Text } = Typography;

export default function MessagesPage() {
  const queryClient = useQueryClient();
  const [authorizerId, setAuthorizerId] = useState<string>('');
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [ruleForm] = Form.useForm();

  // ── 自动回复规则 ────────────────────────────────────────────────────
  const { data: rules, isLoading: rulesLoading, refetch: refetchRules } = useQuery({
    queryKey: ['auto-reply-rules', authorizerId],
    queryFn: () => getAutoReplyRules(authorizerId),
    enabled: !!authorizerId,
  });

  // ── 消息日志 ────────────────────────────────────────────────────────
  const { data: logs, isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['message-logs', authorizerId],
    queryFn: () => getMessageLogs(authorizerId),
    enabled: !!authorizerId,
  });

  // ── Mutations ───────────────────────────────────────────────────────
  const createRuleMut = useMutation({
    mutationFn: (values: any) => createAutoReplyRule(authorizerId, values),
    onSuccess: () => {
      message.success('规则已创建');
      queryClient.invalidateQueries({ queryKey: ['auto-reply-rules'] });
      setRuleModalOpen(false);
      ruleForm.resetFields();
      setEditingRule(null);
    },
  });

  const deleteRuleMut = useMutation({
    mutationFn: deleteAutoReplyRule,
    onSuccess: () => {
      message.success('规则已删除');
      queryClient.invalidateQueries({ queryKey: ['auto-reply-rules'] });
    },
  });

  const toggleRuleMut = useMutation({
    mutationFn: toggleAutoReplyRule,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auto-reply-rules'] }),
  });

  // ── 规则表格列 ──────────────────────────────────────────────────────
  const ruleColumns: ColumnsType<any> = [
    {
      title: '规则名称', dataIndex: 'name', width: 200,
      render: (n: string, r) => (
        <div>
          <div className="font-medium">{n}</div>
          <Tag>{r.ruleType === 'follow' ? '关注回复' : r.ruleType === 'keyword' ? '关键词回复' : r.ruleType === 'keyboard' ? '关键词回复' : '默认回复'}</Tag>
        </div>
      ),
    },
    {
      title: '关键词', key: 'keywords', width: 200,
      render: (_, r) =>
        r.keywordReplies?.map((k: any) => (
          <Tag key={k.id} color="blue">{k.keyword}</Tag>
        )) || '-',
    },
    {
      title: '回复内容', key: 'content', ellipsis: true,
      render: (_, r) => {
        const first = r.replyContents?.[0];
        return first ? (
          <Text ellipsis className="max-w-xs">
            [{first.contentType}] {first.contentType === 'text' ? first.content : '(媒体消息)'}
          </Text>
        ) : '-';
      },
    },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: (s: string, r) => (
        <Switch
          checked={s === 'enabled'}
          onChange={() => toggleRuleMut.mutate(r.id)}
          size="small"
        />
      ),
    },
    {
      title: '操作', key: 'actions', width: 160,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => {
            setEditingRule(r);
            ruleForm.setFieldsValue({
              name: r.name, ruleType: r.ruleType,
              keywords: r.keywordReplies?.map((k: any) => `${k.matchType}:${k.keyword}`).join('\n') || '',
              replyText: r.replyContents?.find((rc: any) => rc.contentType === 'text')?.content || '',
            });
            setRuleModalOpen(true);
          }} />
          <Popconfirm title="确定删除此规则？" onConfirm={() => deleteRuleMut.mutate(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ── 日志表格列 ──────────────────────────────────────────────────────
  const logColumns: ColumnsType<any> = [
    { title: '粉丝', key: 'fan', width: 160, render: (_, r) => r.follower?.nickname || r.follower?.openid?.substring(0, 10) || '-' },
    {
      title: '方向', dataIndex: 'direction', width: 80,
      render: (d: string) => <Tag color={d === 'inbound' ? 'green' : 'blue'}>{d === 'inbound' ? '接收' : '发送'}</Tag>,
    },
    { title: '类型', dataIndex: 'msgType', width: 80 },
    { title: '内容', dataIndex: 'content', ellipsis: true },
    { title: '时间', dataIndex: 'createdAt', width: 160, render: (d: string) => d ? new Date(d).toLocaleString('zh-CN') : '-' },
  ];

  const tabItems = [
    {
      key: 'auto-reply',
      label: '自动回复',
      children: (
        <div>
          <div className="mb-4">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => {
              setEditingRule(null);
              ruleForm.resetFields();
              setRuleModalOpen(true);
            }}>创建规则</Button>
          </div>
          <Table
            rowKey="id"
            columns={ruleColumns}
            dataSource={rules || []}
            loading={rulesLoading}
            pagination={false}
            size="small"
            locale={{ emptyText: '暂无自动回复规则，点击上方按钮创建' }}
          />
        </div>
      ),
    },
    {
      key: 'logs',
      label: '消息日志',
      children: (
        <div>
          <div className="mb-2">
            <Button icon={<ReloadOutlined />} onClick={() => refetchLogs()} size="small">刷新</Button>
          </div>
          <Table
            rowKey="id"
            columns={logColumns}
            dataSource={logs?.list || []}
            loading={logsLoading}
            pagination={{ total: logs?.total, pageSize: 30, showTotal: (t) => `共 ${t} 条` }}
            size="small"
            scroll={{ y: 'calc(100vh - 380px)' }}
          />
        </div>
      ),
    },
    {
      key: 'broadcast',
      label: '消息群发',
      children: (
        <div className="py-12 text-center text-gray-400">
          <SendOutlined className="mb-2 text-4xl" />
          <div>消息群发功能将在此处配置</div>
          <div className="text-xs mt-1">支持按标签/性别/地域筛选发送目标</div>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        <h2 className="text-lg font-semibold">消息管理</h2>
        <AuthorizerSelect value={authorizerId} onChange={(id) => setAuthorizerId(id)} />
      </div>
      <Card>
        <Tabs items={tabItems} />
      </Card>

      {/* 创建/编辑规则弹窗 */}
      <Modal
        title={editingRule ? '编辑自动回复规则' : '创建自动回复规则'}
        open={ruleModalOpen}
        onCancel={() => { setRuleModalOpen(false); setEditingRule(null); }}
        onOk={() => ruleForm.submit()}
        confirmLoading={createRuleMut.isPending}
        width={600}
      >
        <Form
          form={ruleForm}
          layout="vertical"
          onFinish={(values) => {
            const keywords = values.keywords
              ? values.keywords.split('\n').filter(Boolean).map((line: string) => {
                  const [matchType = 'exact', ...rest] = line.split(':');
                  return { matchType, keyword: rest.join(':') || line };
                })
              : [];
            createRuleMut.mutate({
              ruleType: values.ruleType,
              name: values.name,
              keywordReplies: values.ruleType === 'keyword' ? keywords : undefined,
              replyContents: [
                { contentType: 'text', content: values.replyText || '默认回复内容' },
              ],
            });
          }}
        >
          <Form.Item name="ruleType" label="规则类型" rules={[{ required: true }]}>
            <Select options={[
              { value: 'follow', label: '关注回复 — 用户关注时自动回复' },
              { value: 'keyword', label: '关键词回复 — 匹配关键词自动回复' },
              { value: 'default', label: '默认回复 — 无匹配时的兜底回复' },
            ]} />
          </Form.Item>
          <Form.Item name="name" label="规则名称" rules={[{ required: true }]}>
            <Input placeholder="例如：产品咨询" />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.ruleType !== cur.ruleType}>
            {({ getFieldValue }) =>
              getFieldValue('ruleType') === 'keyword' ? (
                <Form.Item
                  name="keywords"
                  label="关键词（每行一个，格式：匹配模式:关键词）"
                  extra="匹配模式：exact=精确，fuzzy=模糊，regex=正则。例如：fuzzy:价格"
                >
                  <Input.TextArea rows={4} placeholder="exact:产品&#10;fuzzy:价格&#10;regex:^(帮助\|help)$" />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item name="replyText" label="回复内容" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="输入文本回复内容" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
