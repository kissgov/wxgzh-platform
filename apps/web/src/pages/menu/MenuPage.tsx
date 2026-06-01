// 菜单管理页 — 可视化编辑器（简化版）+ 模板 + 发布历史
// ============================================================================
import { useState, useEffect } from 'react';
import {
  Card, Button, Space, Input, Select, message, Popconfirm, Modal,
  Table, Tag, Typography, Tabs, Row, Col, Empty,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined, DeleteOutlined, SendOutlined, SaveOutlined,
  HistoryOutlined, AppstoreOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMenuDraft, saveMenuDraft, publishMenu, getMenuTemplates,
  applyMenuTemplate, getMenuPublishHistory,
} from '@/services/menu.api';
import { useAuthStore, useReady } from '@/stores/auth.store';
import AuthorizerSelect from '@/components/common/AuthorizerSelect';

const { Text } = Typography;

const BUTTON_TYPES = [
  { value: 'click', label: '点击推事件' },
  { value: 'view', label: '跳转 URL' },
  { value: 'miniprogram', label: '小程序' },
];

interface MenuButton {
  type: string;
  name: string;
  key?: string;
  url?: string;
  appid?: string;
  pagepath?: string;
  sub_button?: MenuButton[];
}

export default function MenuPage() {
  const queryClient = useQueryClient();
  const ready = useReady();
  const [authorizerId, setAuthorizerId] = useState<string>('');
  const [menuDraft, setMenuDraft] = useState<MenuButton[]>([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingBtn, setEditingBtn] = useState<MenuButton | null>(null);
  const [editingParentIdx, setEditingParentIdx] = useState<number | null>(null);
  const [btnForm, setBtnForm] = useState<MenuButton>({ type: 'click', name: '', key: '' });

  // 加载草稿
  const { data: draftData, isLoading } = useQuery({
    queryKey: ['menu-draft', authorizerId],
    queryFn: () => getMenuDraft(authorizerId),
    enabled: !!authorizerId,
  });

  // 加载模板
  const { data: templates } = useQuery({
    queryKey: ['menu-templates'],
    queryFn: () => getMenuTemplates(),
    enabled: ready,
  });

  // 加载发布历史
  const { data: history } = useQuery({
    queryKey: ['menu-history', authorizerId],
    queryFn: () => getMenuPublishHistory(authorizerId),
    enabled: !!authorizerId,
  });

  // 初始化草稿：draftData 变化时同步到本地编辑状态
  useEffect(() => {
    if (draftData?.menuJson?.button) {
      setMenuDraft(draftData.menuJson.button as MenuButton[]);
    }
  }, [draftData]);

  // Mutations
  const saveMut = useMutation({
    mutationFn: (buttons: MenuButton[]) => saveMenuDraft(authorizerId, { button: buttons }),
    onSuccess: () => message.success('草稿已保存'),
  });

  const publishMut = useMutation({
    mutationFn: () => publishMenu(authorizerId),
    onSuccess: () => {
      message.success('菜单已发布，24小时内生效');
      queryClient.invalidateQueries({ queryKey: ['menu-history'] });
    },
  });

  const applyTemplateMut = useMutation({
    mutationFn: (templateId: string) => applyMenuTemplate(authorizerId, templateId),
    onSuccess: () => {
      message.success('模板已应用');
      queryClient.invalidateQueries({ queryKey: ['menu-draft'] });
    },
  });

  // 添加/编辑按钮
  const openAddBtn = (parentIdx: number | null) => {
    setEditingParentIdx(parentIdx);
    setEditingBtn(null);
    setBtnForm({ type: 'click', name: '', key: '' });
    setEditModalOpen(true);
  };

  const saveBtn = () => {
    if (!btnForm.name) { message.warning('请输入菜单名称'); return; }

    const newMenu = [...menuDraft];
    const btn = { ...btnForm };

    if (editingParentIdx !== null) {
      const parent = newMenu[editingParentIdx];
      if (!parent) return;
      if (!parent.sub_button) parent.sub_button = [];

      if (editingBtn) {
        const idx = parent.sub_button.findIndex((b) => b.name === editingBtn.name);
        if (idx >= 0) parent.sub_button[idx] = btn;
      } else {
        if (parent.sub_button.length >= 5) { message.warning('二级菜单最多 5 个'); return; }
        parent.sub_button.push(btn);
      }
    } else {
      if (newMenu.length >= 3) { message.warning('一级菜单最多 3 个'); return; }
      newMenu.push(btn);
    }

    setMenuDraft(newMenu);
    setEditModalOpen(false);
  };

  const deleteBtn = (parentIdx: number | null, btnIdx: number) => {
    const newMenu = [...menuDraft];
    if (parentIdx !== null) {
      const parent = newMenu[parentIdx];
      if (parent?.sub_button) parent.sub_button.splice(btnIdx, 1);
    } else {
      newMenu.splice(btnIdx, 1);
    }
    setMenuDraft(newMenu);
  };

  const renderMenuPreview = () => (
    <div className="mx-auto w-72 rounded-lg border-2 border-gray-300 bg-white">
      {/* 手机状态栏模拟 */}
      <div className="rounded-t-lg bg-gray-800 py-1 text-center text-xs text-white">公众号菜单预览</div>
      {/* 菜单区域 */}
      <div className="flex border-t">
        {menuDraft.map((btn, idx) => (
          <div key={idx} className="group relative flex-1 border-r py-2 text-center text-xs last:border-r-0">
            <div className="font-medium">{btn.name || '(空)'}</div>
            {/* 二级菜单 */}
            {btn.sub_button && btn.sub_button.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 bg-white border shadow-lg rounded-t">
                {btn.sub_button.map((sub, si) => (
                  <div key={si} className="border-b px-1 py-1 text-xs last:border-b-0 flex justify-between">
                    <span>{sub.name}</span>
                    <button
                      className="text-red-400 opacity-0 group-hover:opacity-100"
                      onClick={() => deleteBtn(idx, si)}
                    >×</button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2 flex justify-center gap-1 opacity-0 group-hover:opacity-100">
              {(!btn.sub_button || btn.sub_button.length < 5) && (
                <Button size="small" type="link" onClick={() => openAddBtn(idx)}>+子菜单</Button>
              )}
              <Button size="small" type="link" danger onClick={() => deleteBtn(null, idx)}>删除</Button>
            </div>
          </div>
        ))}
      </div>
      {/* 底部操作 */}
      <div className="flex justify-between border-t p-2">
        <Button size="small" type="dashed" onClick={() => openAddBtn(null)} icon={<PlusOutlined />} disabled={menuDraft.length >= 3}>
          添加菜单
        </Button>
        <Space size="small">
          <Button size="small" icon={<SaveOutlined />} onClick={() => saveMut.mutate(menuDraft)} loading={saveMut.isPending}>
            保存
          </Button>
          <Popconfirm title="确定发布菜单？发布后 24 小时内生效" onConfirm={() => publishMut.mutate()}>
            <Button size="small" type="primary" icon={<SendOutlined />} loading={publishMut.isPending}>
              发布
            </Button>
          </Popconfirm>
        </Space>
      </div>
    </div>
  );

  const historyColumns: ColumnsType<any> = [
    { title: '版本', dataIndex: 'version', width: 60 },
    { title: '发布人', dataIndex: 'publishedBy', width: 120 },
    {
      title: '菜单结构', key: 'preview', ellipsis: true,
      render: (_, r) => {
        const buttons = r.menuJson?.button || [];
        return buttons.map((b: any) => b.name).join(' → ');
      },
    },
    { title: '发布时间', dataIndex: 'publishedAt', width: 160, render: (d: string) => d ? new Date(d).toLocaleString('zh-CN') : '-' },
  ];

  const tabItems = [
    {
      key: 'editor',
      label: '菜单编辑',
      children: (
        <Row gutter={24}>
          <Col span={16}>
            {renderMenuPreview()}
          </Col>
          <Col span={8}>
            <Card title="操作提示" size="small">
              <ul className="text-xs space-y-1 text-gray-500">
                <li>一级菜单最多 3 个</li>
                <li>二级菜单最多 5 个</li>
                <li>菜单名称不超过 4 个汉字（一级）/ 7 个汉字（二级）</li>
                <li>发布后 24 小时内生效</li>
              </ul>
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: 'templates',
      label: '菜单模板',
      children: (
        <div>
          {templates?.length ? (
            <div className="grid grid-cols-3 gap-4">
              {templates.map((t: any) => (
                <Card key={t.id} size="small" title={t.name}
                  extra={
                    <Button size="small" onClick={() => applyTemplateMut.mutate(t.id)}>应用</Button>
                  }
                >
                  <Text type="secondary" className="text-xs">{t.description || '无描述'}</Text>
                  <div className="mt-2">
                    {t.menuJson?.button?.map((b: any) => (
                      <Tag key={b.name} color="blue">{b.name}</Tag>
                    ))}
                  </div>
                  {t.category && <Tag className="mt-1">{t.category}</Tag>}
                </Card>
              ))}
            </div>
          ) : (
            <Empty description="暂无可用的菜单模板" />
          )}
        </div>
      ),
    },
    {
      key: 'history',
      label: '发布历史',
      children: (
        <Table
          rowKey="id"
          columns={historyColumns}
          dataSource={history || []}
          pagination={false}
          size="small"
        />
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        <h2 className="text-lg font-semibold">菜单管理</h2>
        <AuthorizerSelect value={authorizerId} onChange={(id) => setAuthorizerId(id)} />
      </div>
      <Card>
        <Tabs items={tabItems} />
      </Card>

      {/* 添加/编辑菜单项弹窗 */}
      <Modal
        title={editingBtn ? '编辑菜单项' : '添加菜单项'}
        open={editModalOpen}
        onOk={saveBtn}
        onCancel={() => setEditModalOpen(false)}
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm">菜单名称</label>
            <Input
              value={btnForm.name}
              onChange={(e) => setBtnForm({ ...btnForm, name: e.target.value })}
              placeholder={editingParentIdx !== null ? '≤ 7 个汉字' : '≤ 4 个汉字'}
              maxLength={editingParentIdx !== null ? 14 : 8}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm">菜单类型</label>
            <Select
              value={btnForm.type}
              onChange={(type) => setBtnForm({ ...btnForm, type, key: '', url: '', appid: '', pagepath: '' })}
              style={{ width: '100%' }}
              options={BUTTON_TYPES}
            />
          </div>
          {btnForm.type === 'click' && (
            <div>
              <label className="mb-1 block text-sm">事件 KEY</label>
              <Input value={btnForm.key || ''} onChange={(e) => setBtnForm({ ...btnForm, key: e.target.value })} placeholder="例如: MENU_TODAY" />
            </div>
          )}
          {btnForm.type === 'view' && (
            <div>
              <label className="mb-1 block text-sm">跳转 URL</label>
              <Input value={btnForm.url || ''} onChange={(e) => setBtnForm({ ...btnForm, url: e.target.value })} placeholder="https://..." />
            </div>
          )}
          {btnForm.type === 'miniprogram' && (
            <>
              <div>
                <label className="mb-1 block text-sm">小程序 AppID</label>
                <Input value={btnForm.appid || ''} onChange={(e) => setBtnForm({ ...btnForm, appid: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm">页面路径</label>
                <Input value={btnForm.pagepath || ''} onChange={(e) => setBtnForm({ ...btnForm, pagepath: e.target.value })} placeholder="pages/index" />
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
