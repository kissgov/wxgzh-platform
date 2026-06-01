// 素材管理页 — 图片/视频/图文列表 + 上传 + 分类筛选
// ============================================================================
import { useState } from 'react';
import {
  Card, Upload, Button, Space, Tag, Image, Table, Select, Input,
  Modal, message, Popconfirm, Radio, Empty,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { UploadOutlined, DeleteOutlined, PictureOutlined, VideoCameraOutlined, FileTextOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMaterials, getMaterialCategories, uploadMaterial, deleteMaterial,
} from '@/services/material.api';
import { useAuthStore, useReady } from '@/stores/auth.store';
import AuthorizerSelect from '@/components/common/AuthorizerSelect';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  image: <PictureOutlined />,
  video: <VideoCameraOutlined />,
  voice: <FileTextOutlined />,
  news: <FileTextOutlined />,
};

export default function MaterialsPage() {
  const queryClient = useQueryClient();
  const ready = useReady();
  const [authorizerId, setAuthorizerId] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [category, setCategory] = useState<string | undefined>();
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['materials', authorizerId, typeFilter, category, keyword, page],
    queryFn: () => getMaterials({ authorizerId, type: typeFilter, category, keyword, page, page_size: 20 }),
    enabled: !!authorizerId,
  });

  const { data: categories } = useQuery({
    queryKey: ['material-categories'],
    queryFn: getMaterialCategories,
    enabled: ready,
  });

  const delMut = useMutation({
    mutationFn: deleteMaterial,
    onSuccess: () => {
      message.success('已删除');
      queryClient.invalidateQueries({ queryKey: ['materials'] });
    },
  });

  const columns: ColumnsType<any> = [
    {
      title: '预览', key: 'preview', width: 80,
      render: (_, r) =>
        r.type === 'image' ? (
          <Image src={r.url} width={48} height={48} className="rounded object-cover" preview />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded bg-gray-100 text-xl">
            {TYPE_ICONS[r.type] || '?'}
          </div>
        ),
    },
    { title: '名称', dataIndex: 'name', width: 200, ellipsis: true },
    {
      title: '类型', dataIndex: 'type', width: 80,
      render: (t: string) => <Tag>{t}</Tag>,
    },
    {
      title: '大小', dataIndex: 'fileSize', width: 100,
      render: (s: number) => s ? `${(s / 1024).toFixed(0)} KB` : '-',
    },
    { title: '分类', dataIndex: 'category', width: 100 },
    {
      title: '标签', dataIndex: 'tags', width: 180,
      render: (t: string[]) => t?.map((tag) => <Tag key={tag}>{tag}</Tag>) || '-',
    },
    {
      title: '使用次数', dataIndex: 'usageCount', width: 80,
    },
    {
      title: '上传时间', dataIndex: 'createdAt', width: 160,
      render: (d: string) => d ? new Date(d).toLocaleDateString('zh-CN') : '-',
    },
    {
      title: '操作', key: 'actions', width: 100,
      render: (_, r) => (
        <Popconfirm title="确定删除？" onConfirm={() => delMut.mutate(r.id)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        <h2 className="text-lg font-semibold">素材管理</h2>
        <AuthorizerSelect value={authorizerId} onChange={(id) => setAuthorizerId(id)} />
      </div>

      {/* 筛选栏 */}
      <Card className="mb-4" size="small">
        <Space wrap>
          <Radio.Group value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} buttonStyle="solid" size="small">
            <Radio.Button value={undefined}>全部</Radio.Button>
            <Radio.Button value="image">图片</Radio.Button>
            <Radio.Button value="video">视频</Radio.Button>
            <Radio.Button value="voice">音频</Radio.Button>
            <Radio.Button value="news">图文</Radio.Button>
          </Radio.Group>
          <Select
            placeholder="分类" allowClear size="small" style={{ width: 120 }}
            value={category} onChange={setCategory}
            options={categories?.map((c: any) => ({ value: c.category, label: `${c.category} (${c.count})` }))}
          />
          <Input.Search
            placeholder="搜索素材名称" allowClear size="small"
            style={{ width: 180 }} onSearch={setKeyword}
          />
          <Button type="primary" icon={<UploadOutlined />} size="small" onClick={() => setUploadOpen(true)}>
            上传素材
          </Button>
        </Space>
      </Card>

      {/* 素材列表 */}
      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data?.list || []}
          loading={isLoading}
          pagination={{ current: page, total: data?.total, pageSize: 20, showTotal: (t) => `共 ${t} 个素材`, onChange: setPage }}
          size="small"
          locale={{ emptyText: <Empty description="暂无素材，点击上方按钮上传" /> }}
        />
      </Card>

      {/* 上传弹窗 */}
      <Modal
        title="上传素材"
        open={uploadOpen}
        onCancel={() => setUploadOpen(false)}
        footer={null}
      >
        <Upload.Dragger
          accept="image/*,video/*,audio/*"
          maxCount={1}
          customRequest={async ({ file }) => {
            try {
              await uploadMaterial(authorizerId, file as File, {
                name: (file as File).name,
                type: (file as File).type.startsWith('image/') ? 'image' : 'video',
              });
              message.success('上传成功');
              queryClient.invalidateQueries({ queryKey: ['materials'] });
              setUploadOpen(false);
            } catch {
              message.error('上传失败');
            }
          }}
        >
          <p className="text-3xl"><UploadOutlined /></p>
          <p>点击或拖拽文件到此区域上传</p>
          <p className="text-xs text-gray-400">图片 ≤ 10MB，视频 ≤ 10MB</p>
        </Upload.Dragger>
      </Modal>
    </div>
  );
}
