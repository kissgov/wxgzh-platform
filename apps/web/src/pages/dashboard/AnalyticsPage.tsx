// 转化分析 — 漏斗 + RFM
import { useState } from 'react';
import { Card, Button, Space, Tag, Modal, Form, Input, message, Typography, Empty, Row, Col, Statistic } from 'antd';
import { PlusOutlined, FunnelPlotOutlined, PieChartOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { getFunnels, createFunnel, getFunnelData, getRfmOverview, computeRfm } from '@/services/analytics.api';
import AuthorizerSelect from '@/components/common/AuthorizerSelect';

const { Text, Title } = Typography;

export default function AnalyticsPage() {
  const qc = useQueryClient();
  const [authorizerId, setAuthorizerId] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedFunnel, setSelectedFunnel] = useState<string | null>(null);
  const [form] = Form.useForm();

  const { data: funnels } = useQuery({ queryKey: ['funnels', authorizerId], queryFn: () => getFunnels(authorizerId), enabled: !!authorizerId });
  const { data: funnelData } = useQuery({ queryKey: ['funnel-data', selectedFunnel], queryFn: () => getFunnelData(selectedFunnel!), enabled: !!selectedFunnel });
  const { data: rfm } = useQuery({ queryKey: ['rfm', authorizerId], queryFn: () => getRfmOverview(authorizerId), enabled: !!authorizerId });

  const createMut = useMutation({ mutationFn: (v: any) => createFunnel(authorizerId, v), onSuccess: () => { message.success('漏斗已创建'); setModalOpen(false); qc.invalidateQueries({ queryKey: ['funnels'] }); } });
  const computeRfmMut = useMutation({ mutationFn: () => computeRfm(authorizerId), onSuccess: (d) => { message.success(`RFM 计算完成: ${d.processed} 位粉丝`); qc.invalidateQueries({ queryKey: ['rfm'] }); } });

  const funnelOption = funnelData ? {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    series: [{
      type: 'funnel', left: '15%', width: '70%', sort: 'descending', gap: 4,
      label: { show: true, position: 'inside', formatter: '{b}\n{c}' },
      data: funnelData.data?.map((d: any) => ({ name: d.name, value: d.value })),
    }],
  } : null;

  const rfmOption = rfm?.length ? {
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie', radius: ['45%', '70%'], center: ['50%', '50%'],
      label: { formatter: '{b}: {c}' },
      data: rfm.map((s: any) => ({ name: s.label, value: s.count })),
    }],
  } : null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Space><Title level={4} className="!mb-0">转化分析</Title><AuthorizerSelect value={authorizerId} onChange={(id) => setAuthorizerId(id)} /></Space>
      </div>

      <Row gutter={16}>
        <Col span={12}>
          <Card title={<span><FunnelPlotOutlined /> 转化漏斗</span>}
            extra={funnels?.length ? <Button size="small" onClick={() => { form.resetFields(); setModalOpen(true); }} icon={<PlusOutlined />}>新建</Button> : null}
          >
            {funnels?.length ? (
              <div>
                <Space wrap className="mb-3">
                  {funnels.map((f: any) => (
                    <Tag.CheckableTag key={f.id} checked={selectedFunnel === f.id} onChange={() => setSelectedFunnel(selectedFunnel === f.id ? null : f.id)}>
                      {f.name}
                    </Tag.CheckableTag>
                  ))}
                </Space>
                {funnelOption ? <ReactECharts option={funnelOption} style={{ height: 280 }} /> : <Empty description="选择漏斗查看数据" />}
              </div>
            ) : (
              <Empty description="暂无漏斗">
                <Button icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>新建漏斗</Button>
              </Empty>
            )}
          </Card>
        </Col>

        <Col span={12}>
          <Card title={<span><PieChartOutlined /> RFM 用户分层</span>}
            extra={<Button size="small" onClick={() => computeRfmMut.mutate()} loading={computeRfmMut.isPending}>计算 RFM</Button>}
          >
            {rfmOption ? (
              <div>
                <ReactECharts option={rfmOption} style={{ height: 240 }} />
                <Row gutter={8} className="mt-2">
                  {(rfm || []).map((s: any) => (
                    <Col span={Math.floor(24 / (rfm || []).length || 4)} key={s.segment}><Statistic title={s.label} value={s.count} /></Col>
                  ))}
                </Row>
              </div>
            ) : <Empty description="点击「计算 RFM」生成用户分层数据" />}
          </Card>
        </Col>
      </Row>

      <Modal title="新建漏斗" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()} confirmLoading={createMut.isPending}>
        <Form form={form} layout="vertical" onFinish={(v) => createMut.mutate(v)}>
          <Form.Item name="name" label="漏斗名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input /></Form.Item>
          <Form.Item name="steps" label="步骤 (JSON)" rules={[{ required: true }]}
            help='[{"key":"s1","label":"关注公众号","eventType":"subscribe"},{"key":"s2","label":"发送消息","eventType":"send_message"}]'
          >
            <Input.TextArea rows={5} placeholder='JSON 数组格式的漏斗步骤定义' />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
