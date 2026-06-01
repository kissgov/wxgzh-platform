// 订阅中心 — 两步订阅流程 + 防重复 + 免费版处理
import { useState } from 'react';
import { Card, Button, Row, Col, Tag, Table, message, Modal, Typography, Badge, Space, Result } from 'antd';
import { CrownOutlined, CheckOutlined, HistoryOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getPlans, createOrder, getOrders } from '@/services/payment.api';
import { getMySubscription } from '@/services/tenant.api';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

const PERIODS = [
  { key: 'monthly', label: '月付', discount: '' },
  { key: 'quarterly', label: '季付', discount: '9折' },
  { key: 'yearly', label: '年付', discount: '8折' },
];

export default function SubscriptionPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');
  const [payModal, setPayModal] = useState<{ plan: string; name: string; amount: number } | null>(null);

  const { data: plans } = useQuery({ queryKey: ['plans'], queryFn: getPlans });
  const { data: ordersData } = useQuery({ queryKey: ['payment-orders'], queryFn: () => getOrders() });
  const { data: sub } = useQuery({ queryKey: ['my-subscription'], queryFn: getMySubscription });

  const orderMut = useMutation({
    mutationFn: (v: { plan: string }) => createOrder({ ...v, period: selectedPeriod, method: 'scan' }),
    onSuccess: (d) => {
      setPayModal(null);
      qc.invalidateQueries({ queryKey: ['payment-orders'] });
      qc.invalidateQueries({ queryKey: ['my-subscription'] });
      if (d.status === 'paid') {
        message.success('订阅成功！');
      } else if (d.tradeNo) {
        navigate(`/pay/${d.tradeNo}`);
      }
    },
    onError: (e: any) => message.error(e?.response?.data?.message || '操作失败'),
  });

  const currentPlan = sub?.plan || 'free';
  const planOrder: Record<string, number> = { free: 0, starter: 1, pro: 2, enterprise: 3 };
  const currentLevel = planOrder[currentPlan] ?? 0;
  const isFree = (slug: string) => slug === 'free';
  const isCurrent = (slug: string) => slug === currentPlan;

  const getActionLabel = (slug: string) => {
    if (isFree(slug)) return null;
    if (isCurrent(slug)) return null;
    const level = planOrder[slug] ?? 0;
    if (level > currentLevel) return '升级';
    if (level < currentLevel) return '降级';
    return '切换周期';
  };
  const getActionColor = (slug: string) => {
    const level = planOrder[slug] ?? 0;
    if (level > currentLevel) return 'primary';
    if (level < currentLevel) return 'default';
    return 'primary';
  };

  const orderColumns = [
    { title: '套餐', dataIndex: 'plan', width: 80 },
    { title: '周期', dataIndex: 'period', width: 60 },
    { title: '金额', dataIndex: 'amount', width: 80, render: (v: number) => `¥${(v / 100).toFixed(2)}` },
    { title: '方式', dataIndex: 'method', width: 60, render: (m: string) => <Tag>{m === 'scan' ? '扫码' : m === 'wechat' ? '微信' : m === 'alipay' ? '支付宝' : m}</Tag> },
    { title: '状态', dataIndex: 'status', width: 80, render: (s: string) => <Tag color={s === 'paid' ? 'green' : s === 'pending' ? 'orange' : 'default'}>{s === 'paid' ? '已支付' : s === 'pending' ? '待支付' : s}</Tag> },
    { title: '时间', dataIndex: 'createdAt', width: 140, render: (d: string) => d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '-' },
  ];

  const getPrice = (plan: any) => selectedPeriod === 'monthly' ? plan.priceMonthly : selectedPeriod === 'quarterly' ? plan.priceQuarterly : plan.priceYearly;

  return (
    <div>
      <Title level={4}>订阅中心</Title>

      <div className="mb-4 flex items-center gap-2">
        <Text>付费周期：</Text>
        {PERIODS.map(p => (
          <Tag.CheckableTag key={p.key} checked={selectedPeriod === p.key} onChange={() => setSelectedPeriod(p.key)}>
            {p.label} {p.discount && <Text type="success" className="text-[10px]">{p.discount}</Text>}
          </Tag.CheckableTag>
        ))}
        {sub && <Tag color="blue" className="ml-2">当前：{sub.planName || currentPlan}</Tag>}
      </div>

      <Row gutter={16} className="mb-6">
        {(plans || []).map(plan => {
          const price = getPrice(plan);
          const free = isFree(plan.slug);
          const current = isCurrent(plan.slug);

          return (
            <Col span={6} key={plan.slug}>
              <Badge.Ribbon text={plan.slug === 'pro' ? '推荐' : current ? '当前' : getActionLabel(plan.slug) === '降级' ? '降级' : getActionLabel(plan.slug) === '升级' ? '升级' : ''}
                color={current ? 'green' : getActionLabel(plan.slug) === '降级' ? 'orange' : 'blue'}>
                <Card hoverable className="text-center"
                  actions={free ? [
                    <Button key="free" type="text" disabled block>免费套餐</Button>,
                  ] : current ? [
                    <Button key="current" type="text" disabled block>当前套餐</Button>,
                  ] : [
                    <Button key="subscribe" type={getActionColor(plan.slug) as any} icon={<CrownOutlined />} block
                      onClick={() => setPayModal({ plan: plan.slug, name: plan.name, amount: price })}>
                      {getActionLabel(plan.slug)} ¥{(price / 100).toFixed(0)}
                    </Button>,
                  ]}
                >
                  <Card.Meta
                    title={<span><CrownOutlined className={`mr-1 ${free ? 'text-gray-400' : 'text-yellow-500'}`} />{plan.name}</span>}
                    description={plan.description}
                  />
                  <div className="my-4">
                    <Text className="text-2xl font-bold">
                      {free ? '免费' : `¥${(price / 100).toFixed(0)}`}
                    </Text>
                    <Text type="secondary">{free ? '' : `/${selectedPeriod === 'monthly' ? '月' : selectedPeriod === 'quarterly' ? '季' : '年'}`}</Text>
                  </div>
                  <Space direction="vertical" size={4} className="text-sm">
                    {(Array.isArray(plan.features) ? plan.features : typeof plan.features === 'string' ? JSON.parse(plan.features) : []).map((f: string, i: number) => (
                      <Text key={i} type="secondary"><CheckOutlined className="mr-1 text-green-500" />{f}</Text>
                    ))}
                    <Text type="secondary"><CheckOutlined className="mr-1 text-green-500" />{plan.maxAuthorizers} 个公众号</Text>
                    <Text type="secondary"><CheckOutlined className="mr-1 text-green-500" />{plan.maxUsers} 个用户</Text>
                  </Space>
                </Card>
              </Badge.Ribbon>
            </Col>
          );
        })}
      </Row>

      <Card title={<span><HistoryOutlined /> 支付记录</span>}>
        <Table rowKey="id" columns={orderColumns} dataSource={ordersData?.list || []}
          pagination={{ pageSize: 10 }} size="small" locale={{ emptyText: '暂无记录' }}
          loading={!ordersData}
        />
      </Card>

      {/* 支付弹窗 */}
      <Modal title={`${getActionLabel(payModal?.plan || '') || '订阅'} ${payModal?.name}`} open={!!payModal} onCancel={() => setPayModal(null)} footer={null} width={360}>
        {getActionLabel(payModal?.plan || '') === '降级' && (
          <div className="mb-2 rounded bg-orange-50 p-2 text-center text-xs text-orange-600">降级将立即生效，部分功能可能受限</div>
        )}
        <Result icon={<CrownOutlined />} title={`¥${((payModal?.amount || 0) / 100).toFixed(0)}`}
          subTitle={`${PERIODS.find(p => p.key === selectedPeriod)?.label}订阅 · ${payModal?.name}`}
        />
        <Button type="primary" size="large" block icon={<CrownOutlined />}
          loading={orderMut.isPending}
          onClick={() => payModal && orderMut.mutate({ plan: payModal.plan })}>
          前往支付
        </Button>
      </Modal>
    </div>
  );
}
