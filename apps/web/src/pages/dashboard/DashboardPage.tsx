// 数据看板 — 总览 + 粉丝趋势 + 消息分析 + 图文分析
// ============================================================================
import { useState } from 'react';
import {
  Card, Row, Col, Statistic, DatePicker, Table, Typography, Skeleton, Empty,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  UserOutlined, RiseOutlined, FallOutlined, MessageOutlined,
  ReadOutlined, LikeOutlined, ShareAltOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import {
  getDashboardOverview, getFollowerTrend, getMessageTrend, getNewsAnalysis,
} from '@/services/dashboard.api';
import AuthorizerSelect from '@/components/common/AuthorizerSelect';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

export default function DashboardPage() {
  const [authorizerId, setAuthorizerId] = useState<string>('');
  const [dateRange, setDateRange] = useState<[string, string]>([
    dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
    dayjs().format('YYYY-MM-DD'),
  ]);

  // 看板概览
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['dashboard-overview', authorizerId],
    queryFn: () => getDashboardOverview(authorizerId),
    enabled: !!authorizerId,
  });

  // 粉丝趋势
  const { data: followerTrend, isLoading: followerLoading } = useQuery({
    queryKey: ['dashboard-followers', authorizerId, dateRange],
    queryFn: () => getFollowerTrend(authorizerId, dateRange[0], dateRange[1]),
    enabled: !!authorizerId,
  });

  // 消息趋势
  const { data: messageTrend, isLoading: messageLoading } = useQuery({
    queryKey: ['dashboard-messages', authorizerId, dateRange],
    queryFn: () => getMessageTrend(authorizerId, dateRange[0], dateRange[1]),
    enabled: !!authorizerId,
  });

  // 图文分析
  const { data: newsData, isLoading: newsLoading } = useQuery({
    queryKey: ['dashboard-news', authorizerId, dateRange],
    queryFn: () => getNewsAnalysis(authorizerId, dateRange[0], dateRange[1]),
    enabled: !!authorizerId,
  });

  const newsColumns: ColumnsType<any> = [
    { title: '标题', dataIndex: 'title', ellipsis: true },
    { title: '阅读', dataIndex: 'readCount', width: 80, render: (v: number) => v?.toLocaleString() },
    { title: '点赞', dataIndex: 'likeCount', width: 60 },
    { title: '在看', dataIndex: 'favorCount', width: 60 },
    { title: '分享', dataIndex: 'shareCount', width: 60 },
    { title: '评论', dataIndex: 'commentCount', width: 60 },
    { title: '日期', dataIndex: 'statDate', width: 100, render: (d: string) => d?.split('T')[0] },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Typography.Title level={4} className="!mb-0">数据看板</Typography.Title>
          <AuthorizerSelect value={authorizerId} onChange={(id) => setAuthorizerId(id)} />
        </div>
        <RangePicker
          defaultValue={[dayjs().subtract(30, 'day'), dayjs()]}
          onChange={(dates) => {
            if (dates?.[0] && dates?.[1]) {
              setDateRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]);
            }
          }}
        />
      </div>

      {/* 概览卡片 */}
      {overviewLoading ? (
        <Skeleton active />
      ) : overview ? (
        <Row gutter={[16, 16]} className="mb-4">
          <Col xs={12} sm={6}>
            <Card>
              <Statistic title="累计粉丝" value={overview.totalFollowers} prefix={<UserOutlined />} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="近30天新增"
                value={overview.last30Days?.newSubscribers}
                prefix={<RiseOutlined />}
                valueStyle={{ color: '#52C41A' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="近30天取关"
                value={overview.last30Days?.unsubscribers}
                prefix={<FallOutlined />}
                valueStyle={{ color: '#F5222D' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="净增长"
                value={overview.last30Days?.netGrowth}
                prefix={<RiseOutlined />}
                valueStyle={{ color: overview.last30Days?.netGrowth >= 0 ? '#52C41A' : '#F5222D' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic title="近30天收到消息" value={overview.messages?.received} prefix={<MessageOutlined />} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic title="近30天发送消息" value={overview.messages?.sent} prefix={<MessageOutlined />} />
            </Card>
          </Col>
        </Row>
      ) : (
        <Empty description="暂无数据" />
      )}

      {/* 粉丝趋势表 */}
      <Card title="粉丝趋势" className="mb-4">
        {followerLoading ? <Skeleton /> : followerTrend?.series ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2">日期</th>
                  <th className="py-2">新增</th>
                  <th className="py-2">取关</th>
                  <th className="py-2">净增</th>
                  <th className="py-2">累计</th>
                </tr>
              </thead>
              <tbody>
                {followerTrend.series.slice(-14).map((s: any) => (
                  <tr key={s.date} className="border-b">
                    <td className="py-1">{s.date}</td>
                    <td className="py-1 text-green-600">+{s.newSubs}</td>
                    <td className="py-1 text-red-500">-{s.unsubs}</td>
                    <td className="py-1" style={{ color: s.net >= 0 ? '#52C41A' : '#F5222D' }}>
                      {s.net >= 0 ? '+' : ''}{s.net}
                    </td>
                    <td className="py-1">{s.total?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty description="暂无粉丝数据" />}
        {followerTrend?.summary && (
          <div className="mt-2 text-sm text-gray-500">
            周期净增: {followerTrend.summary.netGrowth >= 0 ? '+' : ''}{followerTrend.summary.netGrowth}
            &nbsp;|&nbsp;累计: {followerTrend.summary.totalFollowers?.toLocaleString()}
          </div>
        )}
      </Card>

      {/* 消息趋势 + 图文分析 */}
      <Row gutter={16}>
        <Col span={12}>
          <Card title="消息交互概览">
            {messageLoading ? <Skeleton /> : messageTrend?.summary ? (
              <div>
                <Row gutter={16}>
                  <Col span={8}><Statistic title="发送" value={messageTrend.summary.sent} /></Col>
                  <Col span={8}><Statistic title="接收" value={messageTrend.summary.received} /></Col>
                  <Col span={8}>
                    <Statistic
                      title="回复率"
                      value={`${(messageTrend.summary.replyRate * 100).toFixed(1)}%`}
                    />
                  </Col>
                </Row>
              </div>
            ) : <Empty description="暂无消息数据" />}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="图文分析 TOP10">
            {newsLoading ? <Skeleton /> : (
              <Table
                rowKey="id"
                columns={newsColumns}
                dataSource={newsData?.list?.slice(0, 10) || []}
                pagination={false}
                size="small"
                locale={{ emptyText: '暂无图文数据' }}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
