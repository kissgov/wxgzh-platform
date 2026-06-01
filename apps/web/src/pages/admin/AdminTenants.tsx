// 租户管理 + 订阅套餐（仅超管）
// ============================================================================
import { useState } from 'react';
import {
  Card, Table, Button, Space, Tag, Modal, Select, Input, InputNumber, message, Tabs, Typography, Descriptions, DatePicker, Popconfirm, Switch, Form, Statistic,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { EditOutlined, ReloadOutlined, DollarOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  adminGetTenants, adminUpdateTenant, adminSubscribeTenant,
  adminGetPaymentOrders, adminConfirmPayment, adminUpdatePlan,
  adminGetTenantRecords, getPlans,
} from '@/services/tenant.api';
import { getPaymentConfig, updatePaymentConfig } from '@/services/payment.api';
import { getLlmConfig, updateLlmConfig, getLlmStats, getLlmLogs } from '@/services/llm.api';
import { useAuthStore, useReady } from '@/stores/auth.store';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const PERIOD_LABELS: Record<string, string> = {
  trial: '试用', monthly: '月付', quarterly: '季付', yearly: '年付', permanent: '永久',
};

export default function AdminTenants() {
  const queryClient = useQueryClient();
  const ready = useReady();
  const [editModal, setEditModal] = useState(false);
  const [subModal, setSubModal] = useState(false);
  const [planModal, setPlanModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState<any>(null);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [recordsModal, setRecordsModal] = useState(false);
  const [recordsTenantId, setRecordsTenantId] = useState('');

  // tenant form state
  const [tName, setTName] = useState('');
  const [tContact, setTContact] = useState('');
  const [tStatus, setTStatus] = useState('');
  const [tPlan, setTPlan] = useState('');
  const [tPeriod, setTPeriod] = useState('');
  const [tMaxAuth, setTMaxAuth] = useState(2);

  // subscribe form state
  const [subPlan, setSubPlan] = useState('');
  const [subPeriod, setSubPeriod] = useState('yearly');
  const [subAmount, setSubAmount] = useState(0);
  const [subExpires, setSubExpires] = useState<string>('');

  const { data: tenants, isLoading } = useQuery({
    queryKey: ['admin-tenants'],
    queryFn: adminGetTenants,
    enabled: ready,
  });

  const { data: plans } = useQuery({
    queryKey: ['plans'],
    queryFn: getPlans,
    enabled: ready,
  });

  const { data: paymentOrders } = useQuery({
    queryKey: ['admin-payment-orders'],
    queryFn: adminGetPaymentOrders,
    enabled: ready,
  });

  const { data: records } = useQuery({
    queryKey: ['sub-records', recordsTenantId],
    queryFn: () => adminGetTenantRecords(recordsTenantId),
    enabled: !!recordsTenantId,
  });

  const saveTenantMut = useMutation({
    mutationFn: ({ id, ...v }: any) => adminUpdateTenant(id, v),
    onSuccess: () => { message.success('已更新'); setEditModal(false); queryClient.invalidateQueries({ queryKey: ['admin-tenants'] }); },
  });

  const subscribeMut = useMutation({
    mutationFn: (v: any) => adminSubscribeTenant(editingTenant?.id, v),
    onSuccess: () => { message.success('订阅成功'); setSubModal(false); queryClient.invalidateQueries({ queryKey: ['admin-tenants'] }); },
  });

  const confirmPayMut = useMutation({
    mutationFn: adminConfirmPayment,
    onSuccess: () => { message.success('已确认收款'); queryClient.invalidateQueries({ queryKey: ['admin-payment-orders'] }); },
  });

  const savePlanMut = useMutation({
    mutationFn: ({ slug, ...v }: any) => adminUpdatePlan(slug, v),
    onSuccess: () => { message.success('套餐已更新'); setPlanModal(false); queryClient.invalidateQueries({ queryKey: ['plans'] }); },
  });

  // 支付配置
  const { data: payConfig } = useQuery({ queryKey: ['payment-config'], queryFn: getPaymentConfig, enabled: ready });
  const savePayConfigMut = useMutation({
    mutationFn: updatePaymentConfig,
    onSuccess: () => { message.success('支付配置已保存'); queryClient.invalidateQueries({ queryKey: ['payment-config'] }); },
  });
  const [payForm] = Form.useForm();

  // LLM 配置
  const { data: llmConfig } = useQuery({ queryKey: ['llm-config'], queryFn: getLlmConfig, enabled: ready });
  const { data: llmStats } = useQuery({ queryKey: ['llm-stats'], queryFn: getLlmStats, enabled: ready });
  const { data: llmLogs } = useQuery({ queryKey: ['llm-logs'], queryFn: () => getLlmLogs(), enabled: ready });
  const saveLlmMut = useMutation({
    mutationFn: updateLlmConfig,
    onSuccess: () => { message.success('LLM 配置已保存'); queryClient.invalidateQueries({ queryKey: ['llm-config', 'llm-stats'] }); },
  });
  const [llmForm] = Form.useForm();

  const openEdit = (t: any) => {
    setEditingTenant(t);
    setTName(t.name); setTContact(t.contact || ''); setTStatus(t.status);
    setTPlan(t.plan); setTPeriod(t.billingPeriod); setTMaxAuth(t.maxAuthorizers);
    setEditModal(true);
  };

  const openSubscribe = (t: any) => {
    setEditingTenant(t);
    const plan = plans?.find((p: any) => p.slug === t.plan) || plans?.[0];
    setSubPlan(plan?.slug || 'free');
    setSubPeriod('yearly');
    setSubAmount(plan?.priceYearly || 0);
    setSubExpires('');
    setSubModal(true);
  };

  const handlePeriodChange = (p: string) => {
    setSubPeriod(p);
    const plan = plans?.find((pl: any) => pl.slug === subPlan);
    if (plan) {
      setSubAmount(p === 'monthly' ? plan.priceMonthly : p === 'quarterly' ? plan.priceQuarterly : plan.priceYearly);
    }
  };

  const columns: ColumnsType<any> = [
    { title: '租户名称', dataIndex: 'name', width: 140 },
    { title: '联系人', dataIndex: 'contact', width: 100, render: (v: string) => v || '-' },
    {
      title: '套餐', key: 'plan', width: 130,
      render: (_: any, r: any) => {
        const plan = plans?.find((p: any) => p.slug === r.plan);
        return <Tag color={plan?.color || '#1677FF'}>{plan?.name || r.plan}</Tag>;
      },
    },
    {
      title: '周期/到期', key: 'period', width: 160,
      render: (_: any, r: any) => (
        <div>
          <Tag>{PERIOD_LABELS[r.billingPeriod] || r.billingPeriod}</Tag>
          {r.subscriptionExpiresAt && r.billingPeriod !== 'permanent' && r.billingPeriod !== 'trial' && (
            <Text type="secondary" className="text-xs">{dayjs(r.subscriptionExpiresAt).format('YYYY-MM-DD')}</Text>
          )}
          {r.billingPeriod === 'trial' && r.trialEndsAt && (
            <Text type="warning" className="text-xs">试用至 {dayjs(r.trialEndsAt).format('YYYY-MM-DD')}</Text>
          )}
        </div>
      ),
    },
    {
      title: '用量', key: 'usage', width: 140,
      render: (_: any, r: any) => (
        <div>
          <div>用户: {r.userCount}/{r.maxUsers}</div>
          <div>公众号: {r.authorizerCount}/{r.maxAuthorizers}</div>
        </div>
      ),
    },
    {
      title: '状态', dataIndex: 'status', width: 70,
      render: (s: string) => <Tag color={s === 'active' ? 'green' : 'red'}>{s === 'active' ? '正常' : s}</Tag>,
    },
    { title: '创建', dataIndex: 'createdAt', width: 100, render: (d: string) => d ? dayjs(d).format('YYYY-MM-DD') : '-' },
    {
      title: '操作', key: 'act', width: 160,
      render: (_: any, r: any) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>信息</Button>
          <Button size="small" icon={<DollarOutlined />} onClick={() => openSubscribe(r)}>订阅</Button>
          <Button size="small" onClick={() => { setRecordsTenantId(r.id); setRecordsModal(true); }}>记录</Button>
        </Space>
      ),
    },
  ];

  const planColumns: ColumnsType<any> = [
    { title: '套餐', dataIndex: 'name', width: 80 },
    { title: '月付(¥)', dataIndex: 'priceMonthly', width: 80, render: (v: number) => (v / 100).toFixed(0) },
    { title: '季付(¥)', dataIndex: 'priceQuarterly', width: 80, render: (v: number) => (v / 100).toFixed(0) },
    { title: '年付(¥)', dataIndex: 'priceYearly', width: 80, render: (v: number) => (v / 100).toFixed(0) },
    { title: '试用(天)', dataIndex: 'trialDays', width: 70 },
    { title: '最大公众号', dataIndex: 'maxAuthorizers', width: 80 },
    { title: '最大用户', dataIndex: 'maxUsers', width: 70 },
    {
      title: '操作', key: 'act', width: 60,
      render: (_: any, r: any) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingPlan(r); setPlanModal(true); }} />
      ),
    },
  ];

  const recordColumns: ColumnsType<any> = [
    { title: '套餐', dataIndex: 'plan', width: 80 },
    { title: '周期', dataIndex: 'period', width: 60, render: (v: string) => PERIOD_LABELS[v] || v },
    { title: '金额', dataIndex: 'amount', width: 80, render: (v: number) => `¥${(v / 100).toFixed(2)}` },
    { title: '开始', dataIndex: 'startedAt', width: 100, render: (d: string) => d ? dayjs(d).format('YYYY-MM-DD') : '-' },
    { title: '到期', dataIndex: 'expiresAt', width: 100, render: (d: string) => d ? dayjs(d).format('YYYY-MM-DD') : '永久' },
    { title: '状态', dataIndex: 'status', width: 60, render: (s: string) => <Tag color={s === 'active' ? 'green' : 'default'}>{s}</Tag> },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Title level={4} className="!mb-0">租户管理与订阅</Title>
        <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-tenants'] })}>刷新</Button>
      </div>
      <Tabs items={[
        {
          key: 'tenants', label: '租户列表',
          children: (
            <Table rowKey="id" columns={columns} dataSource={tenants || []} loading={isLoading}
              pagination={false} size="small"
            />
          ),
        },
        {
          key: 'payments', label: '支付订单',
          children: (
            <Table rowKey="id" size="small" pagination={false}
              dataSource={paymentOrders || []}
              columns={[
                { title: '租户', dataIndex: 'tenantName', width: 120 },
                { title: '套餐', dataIndex: 'plan', width: 80 },
                { title: '周期', dataIndex: 'period', width: 60, render: (v: string) => PERIOD_LABELS[v] || v },
                { title: '金额', dataIndex: 'amount', width: 80, render: (v: number) => `¥${(v / 100).toFixed(2)}` },
                { title: '状态', dataIndex: 'status', width: 80, render: (s: string) => <Tag color={s === 'paid' ? 'green' : s === 'pending' ? 'orange' : 'default'}>{s === 'paid' ? '已支付' : s === 'pending' ? '待支付' : s}</Tag> },
                { title: '创建时间', dataIndex: 'createdAt', width: 130, render: (d: string) => d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '-' },
                { title: '支付时间', dataIndex: 'paidAt', width: 130, render: (d: string) => d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '-' },
                {
                  title: '操作', key: 'act', width: 80,
                  render: (_: any, r: any) => r.status === 'pending' ? (
                    <Popconfirm title="确认已收到款项？" onConfirm={() => confirmPayMut.mutate(r.id)}>
                      <Button size="small" type="primary">确认收款</Button>
                    </Popconfirm>
                  ) : null,
                },
              ]}
            />
          ),
        },
        {
          key: 'plans', label: '套餐管理',
          children: (
            <Table rowKey="id" columns={planColumns} dataSource={plans || []} pagination={false} size="small" />
          ),
        },
        {
          key: 'payconfig', label: '支付配置',
          children: (
            <Card size="small">
              <Form form={payForm} layout="vertical" initialValues={payConfig} onFinish={(v) => savePayConfigMut.mutate(v)} className="max-w-xl">
                <div className="mb-3 flex items-center gap-6">
                  <Form.Item name="channel" label="支付通道" className="!mb-0">
                    <Select options={[
                      { value: 'mock', label: 'Mock 模拟（开发）' },
                      { value: 'official', label: '官方直连支付' },
                      { value: 'thirdparty', label: '第三方支付网关' },
                    ]} style={{ width: 180 }} />
                  </Form.Item>
                  <Form.Item name="mockSuccess" label="Mock 自动成功" valuePropName="checked" className="!mb-0"><Switch /></Form.Item>
                </div>

                <Form.Item noStyle shouldUpdate={(prev, cur) => prev.channel !== cur.channel}>
                  {({ getFieldValue }) => {
                    const ch = getFieldValue('channel');
                    return (
                      <>
                        {(ch === 'official') && (
                          <>
                            <div className="mb-1 rounded bg-green-50 px-3 py-2 text-xs font-medium text-green-700">微信支付（官方直连）</div>
                            <div className="flex flex-wrap gap-3">
                              <Form.Item name="wechatAppId" label="AppID" className="!mb-1"><Input placeholder="wx..." style={{ width: 180 }} /></Form.Item>
                              <Form.Item name="wechatMchId" label="商户号" className="!mb-1"><Input placeholder="商户号" style={{ width: 160 }} /></Form.Item>
                              <Form.Item name="wechatApiKey" label="API v3 密钥" className="!mb-1"><Input.Password placeholder="API v3 Key" style={{ width: 220 }} /></Form.Item>
                              <Form.Item name="wechatCertPath" label="证书路径" className="!mb-1"><Input placeholder="/path/to/cert.pem" style={{ width: 200 }} /></Form.Item>
                            </div>
                            <div className="mb-1 mt-2 rounded bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">支付宝（官方直连）</div>
                            <div className="flex flex-wrap gap-3">
                              <Form.Item name="alipayAppId" label="AppID" className="!mb-1"><Input placeholder="支付宝 AppID" style={{ width: 200 }} /></Form.Item>
                              <Form.Item name="alipayPid" label="商户 PID" className="!mb-1"><Input placeholder="2088..." style={{ width: 200 }} /></Form.Item>
                              <Form.Item name="alipayPrivateKey" label="应用私钥" className="!mb-1"><Input.TextArea rows={2} placeholder="RSA 私钥" style={{ width: 280 }} /></Form.Item>
                              <Form.Item name="alipayPublicKey" label="支付宝公钥" className="!mb-1"><Input.TextArea rows={2} placeholder="RSA 公钥" style={{ width: 280 }} /></Form.Item>
                            </div>
                          </>
                        )}
                        {(ch === 'thirdparty') && (
                          <>
                            <div className="mb-1 rounded bg-orange-50 px-3 py-2 text-xs font-medium text-orange-700">第三方支付网关</div>
                            <div className="flex flex-wrap gap-3">
                              <Form.Item name="thirdpartyGateway" label="网关" className="!mb-1">
                                <Select placeholder="选择网关" style={{ width: 140 }} options={[
                                  { value: 'payjs', label: 'PayJS' }, { value: 'xorpay', label: 'XorPay' }, { value: 'epay', label: '易支付' },
                                ]} allowClear />
                              </Form.Item>
                              <Form.Item name="thirdpartyAppId" label="商户 ID" className="!mb-1"><Input placeholder="网关商户号" style={{ width: 160 }} /></Form.Item>
                              <Form.Item name="thirdpartyAppKey" label="商户 Key" className="!mb-1"><Input.Password placeholder="网关密钥" style={{ width: 200 }} /></Form.Item>
                              <Form.Item name="thirdpartyApiUrl" label="API 地址" className="!mb-1"><Input placeholder="https://pay.example.com/api" style={{ width: 280 }} /></Form.Item>
                              <Form.Item name="thirdpartyNotifyUrl" label="回调地址" className="!mb-1"><Input placeholder="https://your-domain.com/api/v1/payment/callback" style={{ width: 300 }} /></Form.Item>
                            </div>
                          </>
                        )}
                      </>
                    );
                  }}
                </Form.Item>
                <Form.Item className="!mb-0 mt-3"><Button type="primary" htmlType="submit" loading={savePayConfigMut.isPending}>保存配置</Button></Form.Item>
              </Form>
            </Card>
          ),
        },
        {
          key: 'llm', label: 'AI 模型',
          children: (
            <div>
              <Card size="small" className="mb-3">
                <Form form={llmForm} layout="inline" initialValues={llmConfig} onFinish={(v) => saveLlmMut.mutate(v)}>
                  <Form.Item name="provider" label="Provider">
                    <Select style={{ width: 120 }} options={[
                      { value: 'openai', label: 'OpenAI' }, { value: 'claude', label: 'Claude' },
                      { value: 'deepseek', label: 'DeepSeek' }, { value: 'qwen', label: '通义千问' }, { value: 'local', label: '本地模型' },
                    ]} />
                  </Form.Item>
                  <Form.Item name="model" label="模型"><Input placeholder="gpt-4o" style={{ width: 150 }} /></Form.Item>
                  <Form.Item name="apiKey" label="API Key"><Input.Password placeholder="sk-..." style={{ width: 200 }} /></Form.Item>
                  <Form.Item name="apiUrl" label="API URL"><Input placeholder="自定义地址" style={{ width: 240 }} /></Form.Item>
                  <Form.Item name="dailyLimit" label="日限额"><InputNumber min={1} max={9999} style={{ width: 80 }} /></Form.Item>
                  <Form.Item name="status" label="状态">
                    <Select style={{ width: 90 }} options={[{ value: 'active', label: '启用' }, { value: 'disabled', label: '禁用' }]} />
                  </Form.Item>
                  <Form.Item><Button type="primary" htmlType="submit" loading={saveLlmMut.isPending} size="small">保存</Button></Form.Item>
                </Form>
              </Card>
              {llmStats && (
                <Card size="small" className="mb-3">
                  <Space size={24}>
                    <Statistic title="今日调用" value={llmStats.today} suffix={`/ ${llmStats.limit}`} valueStyle={{ fontSize: 18 }} />
                    <Statistic title="累计调用" value={llmStats.total} valueStyle={{ fontSize: 18 }} />
                  </Space>
                </Card>
              )}
              <Table rowKey="id" size="small" pagination={{ pageSize: 10 }}
                dataSource={llmLogs?.list || []}
                columns={[
                  { title: '场景', dataIndex: 'scene', width: 100, render: (s: string) => <Tag>{s}</Tag> },
                  { title: '模型', dataIndex: 'model', width: 120 },
                  { title: 'Token (in/out)', key: 'tokens', width: 120, render: (_, r: any) => `${r.tokensIn}/${r.tokensOut}` },
                  { title: '耗时', dataIndex: 'durationMs', width: 80, render: (v: number) => `${v}ms` },
                  { title: '状态', dataIndex: 'status', width: 70, render: (s: string) => <Tag color={s === 'success' ? 'green' : 'red'}>{s}</Tag> },
                  { title: '时间', dataIndex: 'createdAt', width: 140, render: (d: string) => d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '-' },
                ]}
              />
            </div>
          ),
        },
      ]} />

      {/* 编辑租户信息 */}
      <Modal title="编辑租户" open={editModal} onCancel={() => setEditModal(false)}
        onOk={() => saveTenantMut.mutate({ id: editingTenant?.id, name: tName, contact: tContact, status: tStatus, plan: tPlan, billingPeriod: tPeriod, maxAuthorizers: tMaxAuth })}
      >
        <div className="space-y-3">
          <div><label className="mb-1 block text-sm">名称</label><Input value={tName} onChange={(e) => setTName(e.target.value)} /></div>
          <div><label className="mb-1 block text-sm">联系人</label><Input value={tContact} onChange={(e) => setTContact(e.target.value)} /></div>
          <div><label className="mb-1 block text-sm">状态</label><Select value={tStatus} onChange={setTStatus} style={{ width: '100%' }} options={[{ value: 'active', label: '正常' }, { value: 'suspended', label: '停用' }]} /></div>
          <div><label className="mb-1 block text-sm">套餐</label><Select value={tPlan} onChange={setTPlan} style={{ width: '100%' }} options={plans?.map((p: any) => ({ value: p.slug, label: p.name }))} /></div>
          <div><label className="mb-1 block text-sm">最大公众号数</label><InputNumber value={tMaxAuth} onChange={(v) => setTMaxAuth(v || 2)} min={1} max={100} style={{ width: '100%' }} /></div>
        </div>
      </Modal>

      {/* 订阅弹窗 */}
      <Modal title="租户订阅" open={subModal} onCancel={() => setSubModal(false)}
        onOk={() => subscribeMut.mutate({ plan: subPlan, period: subPeriod, amount: subAmount, expiresAt: subExpires || null })}
      >
        <div className="space-y-3">
          <div><label className="mb-1 block text-sm">套餐</label>
            <Select value={subPlan} onChange={(v) => { setSubPlan(v); const plan = plans?.find((p: any) => p.slug === v); if (plan) handlePeriodChange(subPeriod); }} style={{ width: '100%' }}
              options={plans?.map((p: any) => ({ value: p.slug, label: p.name }))} />
          </div>
          <div><label className="mb-1 block text-sm">周期</label>
            <Select value={subPeriod} onChange={handlePeriodChange} style={{ width: '100%' }}
              options={[
                { value: 'trial', label: '试用' }, { value: 'monthly', label: '月付' },
                { value: 'quarterly', label: '季付' }, { value: 'yearly', label: '年付' },
                { value: 'permanent', label: '永久' },
              ]} />
          </div>
          <div><label className="mb-1 block text-sm">金额 (分)</label><InputNumber value={subAmount} onChange={(v) => setSubAmount(v || 0)} style={{ width: '100%' }} min={0} /></div>
          <div><label className="mb-1 block text-sm">到期时间</label><DatePicker showTime value={subExpires ? dayjs(subExpires) : null} onChange={(d) => setSubExpires(d?.toISOString() || '')} style={{ width: '100%' }} /></div>
        </div>
      </Modal>

      {/* 订阅记录 */}
      <Modal title="订阅记录" open={recordsModal} onCancel={() => { setRecordsModal(false); setRecordsTenantId(''); }} footer={null} width={600}>
        <Table rowKey="id" columns={recordColumns} dataSource={records || []} pagination={false} size="small" />
      </Modal>

      {/* 编辑套餐 */}
      <Modal title="编辑套餐" open={planModal} onCancel={() => setPlanModal(false)}
        onOk={() => {
          const feats = document.getElementById('plan-features-input') as HTMLInputElement;
          savePlanMut.mutate({ slug: editingPlan?.slug, name: editingPlan?.name, priceMonthly: editingPlan?.priceMonthly, priceQuarterly: editingPlan?.priceQuarterly, priceYearly: editingPlan?.priceYearly, maxAuthorizers: editingPlan?.maxAuthorizers, maxUsers: editingPlan?.maxUsers, trialDays: editingPlan?.trialDays, features: feats?.value || '' });
        }}
        width={500}
      >
        {editingPlan && (
          <div className="space-y-3">
            <div><label className="mb-1 block text-sm">名称</label><Input value={editingPlan.name} onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })} /></div>
            <div className="flex gap-2">
              <div className="flex-1"><label className="mb-1 block text-sm">月付(分)</label><InputNumber value={editingPlan.priceMonthly} onChange={(v) => setEditingPlan({ ...editingPlan, priceMonthly: v })} style={{ width: '100%' }} /></div>
              <div className="flex-1"><label className="mb-1 block text-sm">季付(分)</label><InputNumber value={editingPlan.priceQuarterly} onChange={(v) => setEditingPlan({ ...editingPlan, priceQuarterly: v })} style={{ width: '100%' }} /></div>
              <div className="flex-1"><label className="mb-1 block text-sm">年付(分)</label><InputNumber value={editingPlan.priceYearly} onChange={(v) => setEditingPlan({ ...editingPlan, priceYearly: v })} style={{ width: '100%' }} /></div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1"><label className="mb-1 block text-sm">试用天数</label><InputNumber value={editingPlan.trialDays} onChange={(v) => setEditingPlan({ ...editingPlan, trialDays: v })} style={{ width: '100%' }} /></div>
              <div className="flex-1"><label className="mb-1 block text-sm">最大公众号</label><InputNumber value={editingPlan.maxAuthorizers} onChange={(v) => setEditingPlan({ ...editingPlan, maxAuthorizers: v })} style={{ width: '100%' }} /></div>
              <div className="flex-1"><label className="mb-1 block text-sm">最大用户</label><InputNumber value={editingPlan.maxUsers} onChange={(v) => setEditingPlan({ ...editingPlan, maxUsers: v })} style={{ width: '100%' }} /></div>
            </div>
            <div><label className="mb-1 block text-sm">功能列表 (JSON)</label><Input.TextArea id="plan-features-input" defaultValue={typeof editingPlan.features === 'string' ? editingPlan.features : JSON.stringify(editingPlan.features || [])} rows={3} /></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
