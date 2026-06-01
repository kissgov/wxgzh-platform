// 第三方平台配置页 — 微信开放平台参数管理
// ============================================================================
import { useState, useEffect } from 'react';
import {
  Card, Form, Input, Button, message, Descriptions, Tag, Typography, Space, Alert,
} from 'antd';
import { SaveOutlined, LinkOutlined, CopyOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getComponentAppConfig, updateComponentAppConfig } from '@/services/platform.api';
import { useAuthStore, useReady } from '@/stores/auth.store';

const { Text, Title } = Typography;

interface ComponentAppConfig {
  id: string;
  appId: string;
  appSecret: string;
  token: string;
  encodingAesKey: string;
  hasVerifyTicket: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function PlatformSettings() {
  const queryClient = useQueryClient();
  const ready = useReady();
  const [form] = Form.useForm();
  const [editing, setEditing] = useState(false);

  // 查询当前配置（仅已认证时查询）
  const { data: config, isLoading } = useQuery({
    queryKey: ['component-app-config'],
    queryFn: getComponentAppConfig,
    enabled: ready,
  });

  // 保存配置
  const saveMutation = useMutation({
    mutationFn: updateComponentAppConfig,
    onSuccess: () => {
      message.success('配置已保存');
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['component-app-config'] });
    },
    onError: () => message.error('保存失败'),
  });

  // 填写表单
  useEffect(() => {
    if (config && !editing) {
      form.setFieldsValue({
        appId: config.appId,
        token: config.token,
        encodingAesKey: config.encodingAesKey,
        appSecret: undefined, // 不回填，需重新输入
      });
    }
  }, [config, editing, form]);

  const webhookUrl = `${window.location.protocol}//${window.location.hostname}:3000/api/v1/webhook/wechat/${config?.appId || '{appId}'}`;

  const handleSave = () => {
    form.validateFields().then((values) => {
      saveMutation.mutate(values);
    });
  };

  return (
    <div className="max-w-3xl">
      <Title level={4} className="!mb-4">第三方平台配置</Title>

      <Alert
        type="info"
        showIcon
        className="mb-4"
        message="配置说明"
        description={
          <ul className="mt-1 list-disc pl-4 text-sm space-y-0.5">
            <li>在 <a href="https://open.weixin.qq.com" target="_blank" rel="noreferrer">微信开放平台</a> 注册第三方平台后获取以下参数</li>
            <li>AppSecret 和 EncodingAESKey 保存后将脱敏显示，如需修改请重新输入</li>
            <li>消息校验 Token 和加解密 Key 必须与开放平台配置完全一致</li>
            <li>配置完成后，微信将每 10 分钟推送 component_verify_ticket 到下方回调 URL</li>
          </ul>
        }
      />

      <Card loading={isLoading} className="mb-4">
        {config ? (
          <Descriptions
            column={1}
            size="small"
            labelStyle={{ width: 140, fontWeight: 500 }}
          >
            <Descriptions.Item label="平台 AppID">
              <Text copyable>{config.appId}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="AppSecret">
              {config.appSecret}
            </Descriptions.Item>
            <Descriptions.Item label="消息校验 Token">
              <Text code>{config.token}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="加解密 Key">
              {config.encodingAesKey}
            </Descriptions.Item>
            <Descriptions.Item label="Ticket 状态">
              {config.hasVerifyTicket ? (
                <Tag color="green">已收到</Tag>
              ) : (
                <Tag color="orange">等待推送</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={config.status === 'active' ? 'green' : 'red'}>{config.status === 'active' ? '启用' : '停用'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="最后更新">
              {config.updatedAt ? new Date(config.updatedAt).toLocaleString('zh-CN') : '-'}
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <div className="py-8 text-center text-gray-400">尚未配置第三方平台参数</div>
        )}

        <div className="mt-4">
          <Button type="primary" onClick={() => setEditing(!editing)}>
            {editing ? '取消编辑' : '修改配置'}
          </Button>
        </div>
      </Card>

      {editing && (
        <Card title={config ? '修改配置' : '新建配置'} className="mb-4">
          <Form form={form} layout="vertical" onFinish={handleSave}>
            <Form.Item
              name="appId"
              label="平台 AppID"
              rules={[
                { required: true, message: '请输入 AppID' },
                { pattern: /^wx/, message: 'AppID 应以 wx 开头' },
              ]}
              extra="微信开放平台分配的第三方平台 AppID，以 wx 开头"
            >
              <Input placeholder="wx0000000000000000" maxLength={32} />
            </Form.Item>

            <Form.Item
              name="appSecret"
              label="AppSecret"
              rules={[{ required: true, message: '请输入 AppSecret' }]}
              extra="平台密钥，需在开放平台管理员扫码后查看"
            >
              <Input.Password placeholder="输入 AppSecret" />
            </Form.Item>

            <Form.Item
              name="token"
              label="消息校验 Token"
              rules={[
                { required: true, message: '请输入 Token' },
                { min: 3, max: 32, message: '3-32 个字符' },
              ]}
              extra="与开放平台「授权事件接收 URL」配置的 Token 保持一致"
            >
              <Input placeholder="自定义 Token（3-32字符）" maxLength={32} />
            </Form.Item>

            <Form.Item
              name="encodingAesKey"
              label="消息加解密 Key"
              rules={[
                { required: true, message: '请输入 EncodingAESKey' },
                { len: 43, message: '必须为 43 个字符' },
              ]}
              extra="与开放平台配置的 EncodingAESKey 保持一致，必须正好 43 个字符"
            >
              <Input placeholder="43 位随机字符串" maxLength={43} />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saveMutation.isPending}>
                  保存配置
                </Button>
                <Button onClick={() => setEditing(false)}>取消</Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      )}

      {/* 回调 URL 信息 */}
      <Card
        title={
          <Space>
            <LinkOutlined />
            <span>微信回调 URL</span>
          </Space>
        }
        size="small"
      >
        <div className="space-y-2">
          <div>
            <Text type="secondary" className="text-xs">授权事件接收 URL（配置到微信开放平台）:</Text>
            <div className="mt-1 flex items-center gap-2 rounded bg-gray-50 p-2 font-mono text-sm break-all">
              <Text copyable code>{webhookUrl}</Text>
            </div>
          </div>
          <div>
            <Text type="secondary" className="text-xs">消息与事件接收 URL（配置到公众号后台）:</Text>
            <div className="mt-1 rounded bg-gray-50 p-2 font-mono text-sm text-gray-500 break-all">
              {webhookUrl.replace('{appId}', '{authorizerAppId}')}
            </div>
          </div>
          <div className="text-xs text-gray-400">
            * 请确保服务器已部署到公网并可被微信服务器访问（微信要求端口 80 或 443）
          </div>
        </div>
      </Card>
    </div>
  );
}
