// 营销活动 — 活动列表 + 渠道二维码
import { useState } from 'react';
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Select, message, Popconfirm, Tabs, Typography, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, DeleteOutlined, RocketOutlined, QrcodeOutlined, PlayCircleOutlined, PauseCircleOutlined, StopOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCampaigns, createCampaign, deleteCampaign, changeCampaignStatus, getQrCodes, createQrCode, deleteQrCode } from '@/services/campaign.api';
import AuthorizerSelect from '@/components/common/AuthorizerSelect';
import dayjs from 'dayjs';

const { Text, Title } = Typography;
const TYPE_MAP: Record<string, string> = { h5_page: 'H5 页面', qrcode: '渠道二维码', referral: '裂变活动' };
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'default' }, active: { label: '进行中', color: 'green' },
  paused: { label: '已暂停', color: 'orange' }, ended: { label: '已结束', color: 'default' },
};

export default function CampaignsPage() {
  const qc = useQueryClient();
  const [authorizerId, setAuthorizerId] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [qrForm] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['campaigns', authorizerId], queryFn: () => getCampaigns(authorizerId), enabled: !!authorizerId,
  });
  const { data: qrCodes } = useQuery({
    queryKey: ['qrcodes', authorizerId], queryFn: () => getQrCodes(authorizerId), enabled: !!authorizerId,
  });

  const createMut = useMutation({ mutationFn: (v: any) => createCampaign(authorizerId, v), onSuccess: () => { message.success('已创建'); setModalOpen(false); form.resetFields(); qc.invalidateQueries({ queryKey: ['campaigns'] }); } });
  const deleteMut = useMutation({ mutationFn: deleteCampaign, onSuccess: () => { message.success('已删除'); qc.invalidateQueries({ queryKey: ['campaigns'] }); } });
  const statusMut = useMutation({ mutationFn: ({ id, action }: { id: string; action: string }) => changeCampaignStatus(id, action), onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }) });
  const createQrMut = useMutation({ mutationFn: (v: any) => createQrCode(authorizerId, v), onSuccess: () => { message.success('渠道码已创建'); setQrModalOpen(false); qrForm.resetFields(); qc.invalidateQueries({ queryKey: ['qrcodes'] }); } });
  const deleteQrMut = useMutation({ mutationFn: deleteQrCode, onSuccess: () => { message.success('已删除'); qc.invalidateQueries({ queryKey: ['qrcodes'] }); } });

  const columns: ColumnsType<any> = [
    { title: '名称', dataIndex: 'name', width: 200 },
    { title: '类型', dataIndex: 'type', width: 100, render: (t: string) => <Tag>{TYPE_MAP[t] || t}</Tag> },
    { title: '状态', dataIndex: 'status', width: 90, render: (s: string) => <Tag color={STATUS_MAP[s]?.color}>{STATUS_MAP[s]?.label}</Tag> },
    { title: '时间', key: 'time', width: 200, render: (_, r) => `${r.startAt ? dayjs(r.startAt).format('YYYY-MM-DD') : '未设'} ~ ${r.endAt ? dayjs(r.endAt).format('YYYY-MM-DD') : '未设'}` },
    { title: '创建时间', dataIndex: 'createdAt', width: 130, render: (d: string) => dayjs(d).format('YYYY-MM-DD HH:mm') },
    { title: '操作', key: 'act', width: 200,
      render: (_, r) => (
        <Space size={0}>
          {r.status === 'draft' && <Button size="small" type="link" icon={<PlayCircleOutlined />} onClick={() => statusMut.mutate({ id: r.id, action: 'start' })}>开始</Button>}
          {r.status === 'active' && <Button size="small" type="link" icon={<PauseCircleOutlined />} onClick={() => statusMut.mutate({ id: r.id, action: 'pause' })}>暂停</Button>}
          {r.status === 'paused' && <Button size="small" type="link" icon={<PlayCircleOutlined />} onClick={() => statusMut.mutate({ id: r.id, action: 'start' })}>继续</Button>}
          {(r.status === 'active' || r.status === 'paused') && <Button size="small" type="link" icon={<StopOutlined />} onClick={() => statusMut.mutate({ id: r.id, action: 'end' })}>结束</Button>}
          <Popconfirm title="确定删除？" onConfirm={() => deleteMut.mutate(r.id)}><Button size="small" type="link" danger icon={<DeleteOutlined />} /></Popconfirm>
        </Space>
      ),
    },
  ];

  const qrColumns: ColumnsType<any> = [
    { title: '名称', dataIndex: 'name', width: 160 },
    { title: '场景值', dataIndex: 'sceneStr', width: 120 },
    { title: '扫码', dataIndex: 'scanCount', width: 60 },
    { title: '关注', dataIndex: 'subscribeCount', width: 60 },
    { title: '创建时间', dataIndex: 'createdAt', width: 130, render: (d: string) => dayjs(d).format('YYYY-MM-DD HH:mm') },
    { title: '操作', key: 'act', width: 80,
      render: (_, r) => <Popconfirm title="确定删除？" onConfirm={() => deleteQrMut.mutate(r.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>,
    },
  ];

  const tabItems = [
    { key: 'list', label: <span><RocketOutlined /> 活动列表</span>,
      children: (
        <div>
          <div className="mb-3"><Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>创建活动</Button></div>
          <Table rowKey="id" columns={columns} dataSource={data?.list || []} loading={isLoading} pagination={{ pageSize: 20 }} size="small" locale={{ emptyText: <Empty description="暂无活动" /> }} />
        </div>
      ),
    },
    { key: 'qr', label: <span><QrcodeOutlined /> 渠道二维码 ({qrCodes?.length || 0})</span>,
      children: (
        <div>
          <div className="mb-3"><Button icon={<PlusOutlined />} onClick={() => { qrForm.resetFields(); setQrModalOpen(true); }}>创建渠道码</Button></div>
          <Table rowKey="id" columns={qrColumns} dataSource={qrCodes || []} pagination={false} size="small" locale={{ emptyText: <Empty description="暂无渠道码" /> }} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-2 flex items-center gap-4"><Title level={4} className="!mb-0">营销活动</Title><AuthorizerSelect value={authorizerId} onChange={(id) => setAuthorizerId(id)} /></div>
      <Card><Tabs items={tabItems} /></Card>
      <Modal title="创建活动" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()} confirmLoading={createMut.isPending}>
        <Form form={form} layout="vertical" onFinish={(v) => createMut.mutate(v)}>
          <Form.Item name="name" label="活动名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="type" label="活动类型" rules={[{ required: true }]}><Select options={Object.entries(TYPE_MAP).map(([k, v]) => ({ value: k, label: v }))} /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
      <Modal title="创建渠道二维码" open={qrModalOpen} onCancel={() => setQrModalOpen(false)} onOk={() => qrForm.submit()} confirmLoading={createQrMut.isPending}>
        <Form form={qrForm} layout="vertical" onFinish={(v) => createQrMut.mutate(v)}>
          <Form.Item name="name" label="渠道名称" rules={[{ required: true }]}><Input placeholder="如：公众号底部广告" /></Form.Item>
          <Form.Item name="sceneStr" label="场景值" rules={[{ required: true }]}><Input placeholder="如：PROMO_2026" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
