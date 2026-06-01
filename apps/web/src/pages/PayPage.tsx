// 支付页面 — 二维码扫码支付
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Typography, Spin, Result, message, Statistic } from 'antd';
import { CheckCircleOutlined, QrcodeOutlined, CrownOutlined } from '@ant-design/icons';
import { QRCodeSVG } from 'qrcode.react';
import apiClient from '@/services/api-client';

const { Text, Title } = Typography;

export default function PayPage() {
  const { tradeNo } = useParams<{ tradeNo: string }>();
  const navigate = useNavigate();
  const [paid, setPaid] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [completing, setCompleting] = useState(false);

  const completePay = async () => {
    if (!tradeNo || completing) return;
    setCompleting(true);
    try {
      await apiClient.post(`/payment/pay/${tradeNo}/complete`);
      setPaid(true);
      setTimeout(() => { message.success('支付成功！订阅已激活'); navigate('/subscription'); }, 2000);
    } catch { message.error('支付失败'); setCompleting(false); }
  };

  // 自动倒计时
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timer); completePay(); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [tradeNo]);

  if (!tradeNo) return <Result status="error" title="无效订单" subTitle="未找到支付订单号" extra={<Button onClick={() => navigate('/subscription')}>返回订阅中心</Button>} />;

  const payUrl = `${window.location.origin}/api/v1/payment/callback/mock?trade_no=${tradeNo}`;

  return (
    <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
      <Card className="text-center" style={{ width: 360 }}>
        {paid ? (
          <Result icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />} title="支付成功" subTitle="订阅已激活，即将返回订阅中心..."
            extra={<Spin size="small" />}
          />
        ) : (
          <>
            <Title level={4} className="!mb-2"><CrownOutlined className="mr-1 text-yellow-500" />扫码支付</Title>
            <Text type="secondary">请使用微信或支付宝扫描二维码完成支付</Text>
            <div className="my-4 flex justify-center">
              <div className="relative rounded border border-gray-200 p-3">
                <QRCodeSVG value={payUrl} size={200} level="M" includeMargin />
                <div className="absolute inset-0 flex items-center justify-center">
                  <QrcodeOutlined style={{ fontSize: 40, color: '#1677FF', background: '#fff', borderRadius: 8, padding: 4 }} />
                </div>
              </div>
            </div>
            <div className="mb-4 flex items-center justify-center gap-4">
              <Statistic value={countdown} suffix="秒" valueStyle={{ fontSize: 16 }} />
              <Text type="secondary" className="text-xs">后自动完成支付</Text>
            </div>
            <Button type="primary" block onClick={() => setPaid(true)}>模拟支付成功</Button>
            <Text type="secondary" className="mt-2 block text-xs">当前为 Mock 模式，点击按钮或等待倒计时自动完成</Text>
          </>
        )}
      </Card>
    </div>
  );
}
