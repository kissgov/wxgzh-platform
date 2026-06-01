// Admin 支付配置 + 套餐管理
import { useState } from 'react';
import { Card, Form, Input, InputNumber, Switch, Button, message, Table, Modal, Tabs, Typography, Tag, Select, Space } from 'antd';
import { SettingOutlined, GoldOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPaymentConfig, updatePaymentConfig, getAdminPlans, updatePlan } from '@/services/payment.api';

const { Text, Title } = Typography;

export default function AdminPayment() {
  const qc = useQueryClient();
  const [configForm] = Form.useForm();
  const [planForm] = Form.useForm();
  const [planModal, setPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);

  const { data: config, isLoading } = useQuery({ queryKey: ['payment-config'], queryFn: getPaymentConfig });
  const { data: plans } = useQuery({ queryKey: ['admin-plans'], queryFn: getAdminPlans });

  const saveConfigMut = useMutation({
    mutationFn: updatePaymentConfig,
    onSuccess: () => { message.success('支付配置已保存'); qc.invalidateQueries({ queryKey: ['payment-config'] }); },
  });

  const savePlanMut = useMutation({
    mutationFn: ({ slug, ...v }: any) => updatePlan(slug, v),
    onSuccess: () => { message.success('套餐已保存'); setPlanModal(false); qc.invalidateQueries({ queryKey: ['admin-plans'] }); },
  });

  const planColumns = [
    { title: '名称', dataIndex: 'name', width: 120 },
    { title: '标识', dataIndex: 'slug', width: 100 },
    { title: '月付(分)', dataIndex: 'priceMonthly', width: 90 },
    { title: '季付(分)', dataIndex: 'priceQuarterly', width: 90 },
    { title: '年付(分)', dataIndex: 'priceYearly', width: 90 },
    { title: '公众号数', dataIndex: 'maxAuthorizers', width: 80 },
    { title: '用户数', dataIndex: 'maxUsers', width: 70 },
    { title: '状态', dataIndex: 'status', width: 70, render: (s: string) => <Tag color={s === 'active' ? 'green' : 'default'}>{s}</Tag> },
    { title: '排序', dataIndex: 'sortOrder', width: 60 },
    { title: '操作', key: 'act', width: 80,
      render: (_: any, r: any) => (
        <Button size="small" onClick={() => { setEditingPlan(r); planForm.setFieldsValue(r); setPlanModal(true); }}>编辑</Button>
      ),
    },
  ];

  return (
    <div>
      <Title level={4} className="!mb-4">支付配置</Title>
      <Tabs items={[
        {
          key: 'config', label: <span><SettingOutlined /> 支付设置</span>,
          children: (
            <Card>
              <Form form={configForm} layout="vertical" initialValues={config} onFinish={(v) => saveConfigMut.mutate(v)}>
                <div className="mb-4 flex items-center gap-4">
                  <Form.Item name="mode" label="支付模式" className="!mb-0"><Select options={[{ value: 'mock', label: 'Mock 模拟' }, { value: 'live', label: '正式支付' }]} style={{ width: 140 }} /></Form.Item>
                  <Form.Item name="mockSuccess" label="Mock 自动成功" valuePropName="checked" className="!mb-0"><Switch /></Form.Item>
                </div>
                <Text strong className="mb-2 block">微信支付</Text>
                <Space size={16}>
                  <Form.Item name="wechatAppId" label="AppID"><Input placeholder="wx..." style={{ width: 200 }} /></Form.Item>
                  <Form.Item name="wechatMchId" label="商户号"><Input placeholder="商户号" style={{ width: 160 }} /></Form.Item>
                  <Form.Item name="wechatApiKey" label="API 密钥"><Input.Password placeholder="API 密钥" style={{ width: 200 }} /></Form.Item>
                </Space>
                <Text strong className="mb-2 block mt-2">支付宝</Text>
                <Space size={16}>
                  <Form.Item name="alipayAppId" label="AppID"><Input placeholder="支付宝 AppID" style={{ width: 240 }} /></Form.Item>
                  <Form.Item name="alipayPid" label="商户 PID"><Input placeholder="商户 PID" style={{ width: 200 }} /></Form.Item>
                </Space>
                <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={saveConfigMut.isPending}>保存配置</Button>
              </Form>
            </Card>
          ),
        },
        {
          key: 'plans', label: <span><GoldOutlined /> 套餐管理</span>,
          children: (
            <div>
              <div className="mb-3"><Button icon={<PlusOutlined />} onClick={() => { setEditingPlan(null); planForm.resetFields(); planForm.setFieldsValue({ slug: '', name: '', priceMonthly: 0, priceQuarterly: 0, priceYearly: 0, maxAuthorizers: 5, maxUsers: 10, status: 'active', sortOrder: 10 }); setPlanModal(true); }}>新增套餐</Button></div>
              <Table rowKey="id" columns={planColumns} dataSource={plans || []} pagination={false} size="small" />
            </div>
          ),
        },
      ]} />

      <Modal title={editingPlan ? '编辑套餐' : '新增套餐'} open={planModal} onCancel={() => setPlanModal(false)} onOk={() => planForm.submit()} width={500}>
        <Form form={planForm} layout="vertical" onFinish={(v) => savePlanMut.mutate({ ...v, slug: editingPlan?.slug || v.slug })}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="slug" label="标识" rules={[{ required: true }]}><Input disabled={!!editingPlan} /></Form.Item>
          <Space size={12}>
            <Form.Item name="priceMonthly" label="月付(分)" rules={[{ required: true }]}><InputNumber min={0} /></Form.Item>
            <Form.Item name="priceQuarterly" label="季付(分)"><InputNumber min={0} /></Form.Item>
            <Form.Item name="priceYearly" label="年付(分)"><InputNumber min={0} /></Form.Item>
          </Space>
          <Space size={12}>
            <Form.Item name="maxAuthorizers" label="公众号数"><InputNumber min={1} /></Form.Item>
            <Form.Item name="maxUsers" label="用户数"><InputNumber min={1} /></Form.Item>
          </Space>
          <Form.Item name="status" label="状态"><Select options={[{ value: 'active', label: '启用' }, { value: 'hidden', label: '隐藏' }]} /></Form.Item>
          <Form.Item name="sortOrder" label="排序"><InputNumber min={0} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
