// 自助订阅升级 + 支付
// ============================================================================
import { useState } from 'react';
import { Card, Row, Col, Button, Tag, App, Radio, Typography, Modal, Descriptions, Table, Popconfirm } from 'antd';
import { CrownOutlined, CheckOutlined, WalletOutlined, HistoryOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPlans, getPaymentOrders, createSubscribeOrder, payOrder } from '@/services/tenant.api';
import { useAuthStore, useReady } from '@/stores/auth.store';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

const PERIODS = [
  { key: 'monthly', label: '月付' },
  { key: 'quarterly', label: '季付' },
  { key: 'yearly', label: '年付' },
];

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  pending: { color: 'orange', label: '待支付' },
  paid: { color: 'green', label: '已支付' },
  cancelled: { color: 'default', label: '已取消' },
};

interface Props {
  currentPlan: string;
  onUpgraded: () => void;
}

export default function SelfUpgrade({ currentPlan, onUpgraded }: Props) {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const ready = useReady();
  const [selectedPeriod, setSelectedPeriod] = useState('yearly');
  const [payModal, setPayModal] = useState(false);
  const [payOrderId, setPayOrderId] = useState('');
  const [payAmount, setPayAmount] = useState(0);

  const { data: plans } = useQuery({
    queryKey: ['plans'],
    queryFn: getPlans,
    enabled: ready,
  });

  const { data: orders } = useQuery({
    queryKey: ['payment-orders'],
    queryFn: getPaymentOrders,
    enabled: ready,
  });

  const createOrderMut = useMutation({
    mutationFn: createSubscribeOrder,
    onSuccess: (res) => {
      if (res?.orderId) {
        setPayOrderId(res.orderId);
        setPayAmount(res.amount);
        setPayModal(true);
        queryClient.invalidateQueries({ queryKey: ['payment-orders'] });
      }
    },
    onError: (e: any) => message.error(e?.response?.data?.message || '创建订单失败'),
  });

  const payMut = useMutation({
    mutationFn: payOrder,
    onSuccess: () => { message.success('支付成功，订阅已激活！'); setPayModal(false); onUpgraded(); queryClient.invalidateQueries({ queryKey: ['payment-orders'] }); },
    onError: (e: any) => message.error(e?.response?.data?.message || '支付失败'),
  });

  const getPrice = (plan: any, period: string) => {
    if (period === 'monthly') return plan.priceMonthly;
    if (period === 'quarterly') return plan.priceQuarterly;
    return plan.priceYearly;
  };

  const pendingOrder = (orders || []).find((o: any) => o.status === 'pending');

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Text strong>升级套餐</Text>
        <Radio.Group value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} size="small" optionType="button">
          {PERIODS.map((p) => <Radio.Button key={p.key} value={p.key}>{p.label}</Radio.Button>)}
        </Radio.Group>
      </div>
      <Row gutter={12}>
        {(plans || []).map((plan: any) => {
          const price = getPrice(plan, selectedPeriod);
          const isCurrent = plan.slug === currentPlan;
          const isFree = plan.slug === 'free';
          return (
            <Col span={8} key={plan.id}>
              <Card
                size="small"
                className={`text-center ${isCurrent ? 'border-blue-500 bg-blue-50' : ''}`}
                title={<span style={{ color: plan.color || '#1677FF' }}><CrownOutlined /> {plan.name}</span>}
              >
                <div className="text-xl font-bold text-blue-600">
                  {price === 0 ? '免费' : `¥${(price / 100).toFixed(0)}`}
                  <Text type="secondary" className="text-xs">/{PERIODS.find(p => p.key === selectedPeriod)?.label}</Text>
                </div>
                <div className="my-2 text-xs text-gray-500">
                  公众号 {plan.maxAuthorizers} | 用户 {plan.maxUsers}
                </div>
                <Button
                  type={isCurrent ? 'default' : 'primary'}
                  size="small" block disabled={isCurrent || isFree}
                  icon={isCurrent ? <CheckOutlined /> : <WalletOutlined />}
                  loading={createOrderMut.isPending}
                  onClick={() => createOrderMut.mutate({ plan: plan.slug, period: selectedPeriod })}
                >
                  {isCurrent ? '当前套餐' : isFree ? '免费套餐' : '立即订购'}
                </Button>
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* 待支付提示 */}
      {pendingOrder && (
        <div className="mt-3 rounded bg-orange-50 p-3">
          <div className="flex items-center justify-between">
            <span>
              <Tag color="orange">待支付</Tag>
              <Text>{pendingOrder.plan} · {PERIODS.find(p => p.key === pendingOrder.period)?.label} · ¥{(pendingOrder.amount / 100).toFixed(2)}</Text>
            </span>
            <Button type="primary" size="small" onClick={() => { setPayOrderId(pendingOrder.id); setPayAmount(pendingOrder.amount); setPayModal(true); }}>
              去支付
            </Button>
          </div>
        </div>
      )}

      {/* 支付记录 */}
      {(orders || []).length > 0 && (
        <div className="mt-3">
          <Text type="secondary" className="mb-1 block text-xs"><HistoryOutlined /> 支付记录</Text>
          <Table
            rowKey="id" size="small" pagination={false}
            dataSource={orders || []}
            columns={[
              { title: '套餐', dataIndex: 'plan', width: 80 },
              { title: '周期', dataIndex: 'period', width: 60, render: (v: string) => PERIODS.find(p => p.key === v)?.label || v },
              { title: '金额', dataIndex: 'amount', width: 80, render: (v: number) => `¥${(v / 100).toFixed(2)}` },
              { title: '状态', dataIndex: 'status', width: 80, render: (s: string) => <Tag color={STATUS_MAP[s]?.color}>{STATUS_MAP[s]?.label || s}</Tag> },
              { title: '时间', dataIndex: 'createdAt', width: 130, render: (d: string) => d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '-' },
              {
                title: '', key: 'act', width: 70,
                render: (_: any, r: any) => r.status === 'pending' ? (
                  <Button size="small" type="link" onClick={() => { setPayOrderId(r.id); setPayAmount(r.amount); setPayModal(true); }}>支付</Button>
                ) : null,
              },
            ]}
          />
        </div>
      )}

      {/* 支付弹窗 */}
      <Modal
        title="确认支付"
        open={payModal}
        onCancel={() => setPayModal(false)}
        footer={[
          <Button key="cancel" onClick={() => setPayModal(false)}>取消</Button>,
          <Button key="pay" type="primary" loading={payMut.isPending} onClick={() => payMut.mutate(payOrderId)}>
            确认支付 ¥{(payAmount / 100).toFixed(2)}
          </Button>,
        ]}
      >
        <Descriptions size="small" column={1}>
          <Descriptions.Item label="订单号"><Text code>{payOrderId}</Text></Descriptions.Item>
          <Descriptions.Item label="金额"><Text strong className="text-lg">¥{(payAmount / 100).toFixed(2)}</Text></Descriptions.Item>
          <Descriptions.Item label="支付方式"><Tag>模拟支付（开发环境）</Tag></Descriptions.Item>
        </Descriptions>
        <Text type="secondary" className="text-xs">* 生产环境将接入微信支付/支付宝</Text>
      </Modal>
    </div>
  );
}
