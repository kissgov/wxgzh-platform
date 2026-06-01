// 公众号选择器 — 全局组件（仅显示用户有权限的公众号）
// ============================================================================
import { Select, Space, Avatar, Typography, Skeleton } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { getMyAuthorizers } from '@/services/tenant.api';
import { useReady } from '@/stores/auth.store';
import { debugLog } from '@/utils/debug';

const { Text } = Typography;

interface Props {
  value?: string;
  onChange: (authorizerId: string, authorizer: any) => void;
  placeholder?: string;
}

export default function AuthorizerSelect({ value, onChange, placeholder }: Props) {
  const ready = useReady();
  const { data: authorizers, isLoading, status } = useQuery({
    queryKey: ['my-authorizers'],
    queryFn: getMyAuthorizers,
    enabled: ready,
  });
  debugLog('query', 'AuthorizerSelect', { ready, status, count: (authorizers as any[])?.length ?? 0 });

  if (isLoading) return <Skeleton.Input active size="small" style={{ width: 220 }} />;

  return (
    <Select
      value={value}
      placeholder={placeholder || '请选择公众号'}
      style={{ width: 220 }}
      onChange={(id) => {
        const found = authorizers?.find((a: any) => a.id === id);
        onChange(id, found || null);
      }}
      options={(authorizers || []).map((a: any) => ({
        value: a.id,
        label: (
          <Space>
            <Avatar src={a.headImg} size={20} />
            <span>{a.nickName}</span>
            <Text type="secondary" className="text-xs">{a.appType === 2 ? '服务号' : '订阅号'}</Text>
          </Space>
        ),
      }))}
      notFoundContent="暂无已授权或已分配的公众号"
    />
  );
}
