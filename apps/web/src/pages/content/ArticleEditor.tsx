// 文章编辑器 — TipTap 富文本（后续安装） + AI 侧面板
// ============================================================================
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Button, Space, Input, Select, Tag, message, Skeleton, Popconfirm, Row, Col, Divider, Typography,
} from 'antd';
import {
  ArrowLeftOutlined, SaveOutlined, SendOutlined, HistoryOutlined, RobotOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getArticle, createArticle, updateArticle } from '@/services/content.api';
import apiClient from '@/services/api-client';
import AuthorizerSelect from '@/components/common/AuthorizerSelect';
import { useSearchParams } from 'react-router-dom';

const { Text, Title } = Typography;
const { TextArea } = Input;

export default function ArticleEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const authorizerId = searchParams.get('authorizerId') || '';
  const isNew = id === 'new';
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [digest, setDigest] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  const { data: article, isLoading } = useQuery({
    queryKey: ['article', id],
    queryFn: () => getArticle(id!),
    enabled: !!id && !isNew,
  });

  // 新建文章：自动创建后重定向到编辑页
  useEffect(() => {
    if (!isNew || creating) return;
    setCreating(true);
    (async () => {
      try {
        const created = await createArticle(authorizerId, { title: '', content: '' });
        navigate(`/content/articles/${created.id}?authorizerId=${authorizerId}`, { replace: true });
      } catch (e: any) {
        message.error(e?.response?.data?.message || '创建失败');
        navigate('/content');
      }
    })();
  }, [isNew, authorizerId]);

  useEffect(() => {
    if (article) {
      setTitle(article.title || '');
      setAuthor(article.author || '');
      setDigest(article.digest || '');
      setContent(article.content || '');
      setTags((article.tags || []).join(', '));
    }
  }, [article]);

  const handleSave = async () => {
    if (!id || isNew) return;
    setSaving(true);
    try {
      await updateArticle(id, {
        title, author, digest, content,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      message.success('已保存');
      queryClient.invalidateQueries({ queryKey: ['article', id] });
    } catch (e: any) { message.error(e?.response?.data?.message || '保存失败'); }
    finally { setSaving(false); }
  };

  if (isNew) return <Skeleton active paragraph={{ rows: 10 }} />;
  if (isLoading) return <Skeleton active />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/content')}>返回</Button>
          <Title level={4} className="!mb-0">编辑文章</Title>
          {article && (
            <Tag color={article.status === 'published' ? 'green' : article.status === 'draft' ? 'default' : 'orange'}>
              {article.status === 'draft' ? '草稿' : article.status === 'published' ? '已发布' : article.status}
            </Tag>
          )}
          {article && <Text type="secondary" className="text-xs">版本 v{article.version}</Text>}
        </Space>
        <Space>
          <Button icon={<SaveOutlined />} onClick={handleSave} loading={saving} type="primary">保存</Button>
        </Space>
      </div>

      <Row gutter={16}>
        <Col span={16}>
          <Card className="mb-4">
            <Input
              placeholder="文章标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="!border-none !text-xl !font-bold !px-0"
              maxLength={64}
              suffix={<Text type="secondary" className="text-xs">{title.length}/64</Text>}
            />
            <div className="my-2 flex gap-4">
              <Input placeholder="作者" value={author} onChange={(e) => setAuthor(e.target.value)} className="!w-32" size="small" />
              <Input placeholder="标签（逗号分隔）" value={tags} onChange={(e) => setTags(e.target.value)} className="flex-1" size="small" />
            </div>
            <Divider className="!my-2" />
            <TextArea
              placeholder="在此撰写文章正文..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              autoSize={{ minRows: 20, maxRows: 40 }}
              className="!border-none !px-0 !resize-none"
            />
          </Card>

          {article?.revisions?.length > 0 && (
            <Card title={<span><HistoryOutlined /> 版本历史</span>} size="small">
              {article.revisions.map((rev: any) => (
                <div key={rev.id} className="flex justify-between border-b py-1 text-sm last:border-0">
                  <Space><Tag className="text-xs">v{rev.version}</Tag><Text>{rev.title}</Text></Space>
                  <Text type="secondary" className="text-xs">{new Date(rev.createdAt).toLocaleString('zh-CN')}</Text>
                </div>
              ))}
            </Card>
          )}
        </Col>

        <Col span={8}>
          <Card title="发布设置" size="small" className="mb-4">
            <div className="space-y-3">
              <div>
                <Text type="secondary" className="text-xs">摘要（选填）</Text>
                <TextArea rows={3} value={digest} onChange={(e) => setDigest(e.target.value)} maxLength={120}
                  placeholder="文章摘要，不填则自动截取正文前 120 字" />
                <Text type="secondary" className="text-xs">{digest.length}/120</Text>
              </div>
            </div>
          </Card>

          <Card title={<span><RobotOutlined /> AI 写作助手</span>} size="small">
            <div className="space-y-2">
              <TextArea rows={3} placeholder="输入需求，如：写一篇关于AI发展趋势的推文" id="ai-prompt" />
              <Space wrap size={4}>
                <Button size="small" icon={<RobotOutlined />} onClick={async () => {
                  const prompt = (document.getElementById('ai-prompt') as HTMLTextAreaElement)?.value;
                  if (!prompt) { message.warning('请输入需求'); return; }
                  try {
                    const { data: res } = await apiClient.post('/articles/ai/generate', { prompt, type: 'article' });
                    if (res.data?.content) setContent((prev) => prev + '\n' + res.data.content);
                    message.success('AI 内容已追加');
                  } catch { message.error('AI 调用失败'); }
                }}>生成正文</Button>
                <Button size="small" onClick={async () => {
                  const prompt = (document.getElementById('ai-prompt') as HTMLTextAreaElement)?.value;
                  if (!prompt) { message.warning('请输入需求'); return; }
                  try {
                    const { data: res } = await apiClient.post('/articles/ai/generate', { prompt, type: 'outline' });
                    if (res.data?.content) setContent((prev) => prev + '\n\n【大纲】\n' + res.data.content);
                    message.success('大纲已生成');
                  } catch { message.error('AI 调用失败'); }
                }}>生成大纲</Button>
                <Button size="small" onClick={async () => {
                  if (!content) { message.warning('请先撰写内容'); return; }
                  try {
                    const { data: res } = await apiClient.post('/articles/ai/rewrite', { content: content.slice(0, 2000), style: '更生动' });
                    if (res.data?.content) setContent(res.data.content);
                    message.success('已改写');
                  } catch { message.error('AI 调用失败'); }
                }}>改写润色</Button>
              </Space>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
