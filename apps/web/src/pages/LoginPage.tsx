// 登录/注册页
// ============================================================================
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Input, Button, Typography, App, Tabs } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, TeamOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/stores/auth.store';
import { login as loginApi, register as registerApi } from '@/services/auth.api';

const { Title, Text } = Typography;

export default function LoginPage() {
  const [loginLoading, setLoginLoading] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const navigate = useNavigate();
  const { message } = App.useApp(); // 使用 context-aware message，避免 static 警告
  const [loginForm] = Form.useForm();
  const [regForm] = Form.useForm();

  const onLogin = async (values: { email: string; password: string }) => {
    setLoginLoading(true);
    try {
      const data = await loginApi(values.email, values.password);
      useAuthStore.getState().login(
        data.access_token, data.refresh_token, data.user,
        data.tenant || { id: '', name: '', slug: '' },
      );
      message.success('登录成功');
      navigate('/', { replace: true });
    } catch {
      message.error('邮箱或密码错误');
    } finally {
      setLoginLoading(false);
    }
  };

  const onRegister = async (values: {
    name: string; email: string; password: string; company: string;
  }) => {
    setRegLoading(true);
    try {
      const data = await registerApi(values);
      useAuthStore.getState().login(data.access_token, data.refresh_token, data.user, data.tenant);
      message.success('注册成功！已自动登录');
      navigate('/', { replace: true });
    } catch (err: any) {
      const msg = err?.response?.data?.message || '注册失败，请稍后重试';
      message.error(msg);
    } finally {
      setRegLoading(false);
    }
  };

  const loginTab = (
    <Form form={loginForm} layout="vertical" onFinish={onLogin} autoComplete="off">
      <Form.Item name="email" rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}>
        <Input prefix={<MailOutlined />} placeholder="邮箱" size="large" />
      </Form.Item>
      <Form.Item name="password" rules={[{ required: true, min: 6, message: '密码至少 6 位' }]}>
        <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loginLoading} block size="large">
          登 录
        </Button>
      </Form.Item>
    </Form>
  );

  const registerTab = (
    <Form form={regForm} layout="vertical" onFinish={onRegister} autoComplete="off">
      <Form.Item name="name" rules={[{ required: true, message: '请输入姓名' }]}>
        <Input prefix={<UserOutlined />} placeholder="姓名" size="large" />
      </Form.Item>
      <Form.Item name="email" rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}>
        <Input prefix={<MailOutlined />} placeholder="邮箱" size="large" />
      </Form.Item>
      <Form.Item name="password" rules={[{ required: true, min: 6, message: '密码至少 6 位' }]}>
        <Input.Password prefix={<LockOutlined />} placeholder="密码（至少 6 位）" size="large" />
      </Form.Item>
      <Form.Item name="company" rules={[{ required: true, message: '请输入公司/团队名称' }]}>
        <Input prefix={<TeamOutlined />} placeholder="公司/团队名称" size="large" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={regLoading} block size="large">
          注 册
        </Button>
      </Form.Item>
    </Form>
  );

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card style={{ width: 420 }} className="shadow-lg">
        <div className="mb-4 text-center">
          <Title level={3}>WXGZH 运营平台</Title>
          <Text type="secondary">微信公众号第三方管理平台</Text>
        </div>
        <Tabs
          centered
          items={[
            { key: 'login', label: '登录', children: loginTab },
            { key: 'register', label: '注册', children: registerTab },
          ]}
        />
      </Card>
    </div>
  );
}
