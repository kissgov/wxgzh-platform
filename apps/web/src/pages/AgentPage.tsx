// Agent 控制台 — Skill 管理 + Agent 编排 + 任务执行
import { useState } from 'react';
import { Card, Button, Space, Tag, Input, Modal, Form, Select, message, Table, Typography, Row, Col, Popconfirm, Divider, Tabs } from 'antd';
import { RobotOutlined, ThunderboltOutlined, PlusOutlined, PlayCircleOutlined, HistoryOutlined, ApiOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { seedSkills, getSkills, createSkill, deleteSkill, getAgents, createAgent, deleteAgent, runAgent, getAgentTasks } from '@/services/agent.api';
import dayjs from 'dayjs';

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;

export default function AgentPage() {
  const qc = useQueryClient();
  const [skillModal, setSkillModal] = useState(false);
  const [agentModal, setAgentModal] = useState(false);
  const [runModal, setRunModal] = useState<{ agentId: string; name: string } | null>(null);
  const [taskModal, setTaskModal] = useState<{ agentId: string; name: string } | null>(null);
  const [runInput, setRunInput] = useState('');
  const [runSkillId, setRunSkillId] = useState<string | undefined>();
  const [skillForm] = Form.useForm();
  const [agentForm] = Form.useForm();

  const { data: skills } = useQuery({ queryKey: ['skills'], queryFn: () => getSkills() });
  const { data: agents } = useQuery({ queryKey: ['agents'], queryFn: getAgents });
  const { data: tasks } = useQuery({ queryKey: ['agent-tasks', taskModal?.agentId], queryFn: () => getAgentTasks(taskModal!.agentId), enabled: !!taskModal?.agentId });

  const seedMut = useMutation({ mutationFn: seedSkills, onSuccess: () => { message.success('内置 Skills 已初始化'); qc.invalidateQueries({ queryKey: ['skills'] }); } });
  const saveSkillMut = useMutation({ mutationFn: createSkill, onSuccess: () => { message.success('Skill 已创建'); setSkillModal(false); qc.invalidateQueries({ queryKey: ['skills'] }); } });
  const delSkillMut = useMutation({ mutationFn: deleteSkill, onSuccess: () => { message.success('已删除'); qc.invalidateQueries({ queryKey: ['skills'] }); } });
  const saveAgentMut = useMutation({ mutationFn: createAgent, onSuccess: () => { message.success('Agent 已创建'); setAgentModal(false); qc.invalidateQueries({ queryKey: ['agents'] }); } });
  const delAgentMut = useMutation({ mutationFn: deleteAgent, onSuccess: () => { message.success('已删除'); qc.invalidateQueries({ queryKey: ['agents'] }); } });
  const runMut = useMutation({ mutationFn: ({ id, input, skillId }: { id: string; input: string; skillId?: string }) => runAgent(id, input, skillId),
    onSuccess: (d) => { message.success(`执行完成 (${d.tokensUsed} tokens, ${d.durationMs}ms)`); setRunModal(null); setRunInput(''); qc.invalidateQueries({ queryKey: ['agent-tasks'] }); },
    onError: (e: any) => message.error(e?.response?.data?.message || '执行失败'),
  });

  // 按 category 分组 skill
  const categories = [...new Set((skills || []).map((s: any) => s.category))] as string[];
  const catLabels: Record<string, string> = { content: '内容创作', service: '客服服务', analytics: '数据分析', marketing: '营销活动', general: '通用工具' };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Title level={4} className="!mb-0">Agent 控制台</Title>
        <Button onClick={() => seedMut.mutate()} loading={seedMut.isPending} icon={<ApiOutlined />}>初始化内置 Skills</Button>
      </div>

      <Tabs items={[
        {
          key: 'skills', label: <span><ThunderboltOutlined /> Skills ({skills?.length || 0})</span>,
          children: (
            <div>
              <div className="mb-3"><Button icon={<PlusOutlined />} onClick={() => { skillForm.resetFields(); setSkillModal(true); }}>创建 Skill</Button></div>
              {categories.map(cat => (
                <div key={cat} className="mb-4">
                  <Text strong className="mb-2 block text-xs uppercase text-gray-400">{catLabels[cat] || cat}</Text>
                  <Row gutter={[12, 12]}>
                    {(skills || []).filter((s: any) => s.category === cat).map((s: any) => (
                      <Col span={6} key={s.id}>
                        <Card size="small" hoverable actions={[
                          <Popconfirm key="del" title="确定删除？" onConfirm={() => delSkillMut.mutate(s.id)}><Button size="small" type="link" danger>删除</Button></Popconfirm>,
                        ]}>
                          <Card.Meta title={<Text className="text-sm">{s.name}</Text>} description={<Text className="text-xs text-gray-400">{s.description}</Text>} />
                        </Card>
                      </Col>
                    ))}
                  </Row>
                </div>
              ))}
            </div>
          ),
        },
        {
          key: 'agents', label: <span><RobotOutlined /> Agents ({agents?.length || 0})</span>,
          children: (
            <div>
              <div className="mb-3"><Button icon={<PlusOutlined />} onClick={() => { agentForm.resetFields(); setAgentModal(true); }}>创建 Agent</Button></div>
              <Row gutter={[16, 16]}>
                {(agents || []).map((a: any) => (
                  <Col span={8} key={a.id}>
                    <Card size="small" actions={[
                      <Button key="run" type="link" icon={<PlayCircleOutlined />} onClick={() => { setRunModal({ agentId: a.id, name: a.name }); setRunSkillId(a.agentSkills?.[0]?.skillId); }}>执行</Button>,
                      <Button key="task" type="link" icon={<HistoryOutlined />} onClick={() => setTaskModal({ agentId: a.id, name: a.name })}>日志</Button>,
                      <Popconfirm key="del" title="确定删除？" onConfirm={() => delAgentMut.mutate(a.id)}><Button type="link" danger size="small">删除</Button></Popconfirm>,
                    ]}>
                    <Card.Meta title={<span><RobotOutlined className="mr-1" />{a.name}</span>}
                      description={<>
                        <Text className="text-xs text-gray-400">{a.description || '无描述'}</Text>
                        <div className="mt-1">{(a.agentSkills || []).map((as: any) => <Tag key={as.skillId} className="text-[10px]">{as.skill?.name}</Tag>)}</div>
                      </>}
                    />
                  </Card>
                  </Col>
                ))}
              </Row>
            </div>
          ),
        },
      ]} />

      {/* 创建 Skill */}
      <Modal title="创建 Skill" open={skillModal} onCancel={() => setSkillModal(false)} onOk={() => skillForm.submit()}>
        <Form form={skillForm} layout="vertical" onFinish={(v) => saveSkillMut.mutate(v)}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="slug" label="标识" rules={[{ required: true }]}><Input placeholder="my-skill" /></Form.Item>
          <Form.Item name="category" label="分类"><Select options={Object.entries(catLabels).map(([k, v]) => ({ value: k, label: v }))} /></Form.Item>
          <Form.Item name="description" label="描述"><Input /></Form.Item>
          <Form.Item name="prompt" label="提示词模板" rules={[{ required: true }]}><TextArea rows={4} /></Form.Item>
        </Form>
      </Modal>

      {/* 创建 Agent */}
      <Modal title="创建 Agent" open={agentModal} onCancel={() => setAgentModal(false)} onOk={() => agentForm.submit()} width={500}>
        <Form form={agentForm} layout="vertical" onFinish={(v) => saveAgentMut.mutate(v)}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input placeholder="如：内容创作助手" /></Form.Item>
          <Form.Item name="description" label="描述"><Input /></Form.Item>
          <Form.Item name="systemPrompt" label="系统提示词"><TextArea rows={3} placeholder="定义 Agent 的行为和风格" /></Form.Item>
          <Form.Item name="skillIds" label="关联 Skills"><Select mode="multiple" placeholder="选择技能" options={skills?.map((s: any) => ({ value: s.id, label: `${s.name} (${catLabels[s.category] || s.category})` }))} /></Form.Item>
        </Form>
      </Modal>

      {/* 执行任务 */}
      <Modal title={`执行 Agent: ${runModal?.name}`} open={!!runModal} onCancel={() => setRunModal(null)} footer={null} width={500}>
        <TextArea rows={4} value={runInput} onChange={(e) => setRunInput(e.target.value)} placeholder="输入任务指令，如：写一篇关于AI发展趋势的文章" className="mb-3" />
        <Select className="mb-3 w-full" value={runSkillId} onChange={setRunSkillId} allowClear placeholder="选择 Skill（可选）"
          options={skills?.map((s: any) => ({ value: s.id, label: `${s.name}` }))} />
        <Button type="primary" icon={<PlayCircleOutlined />} block loading={runMut.isPending}
          onClick={() => runInput && runMut.mutate({ id: runModal!.agentId, input: runInput, skillId: runSkillId })}>执行任务</Button>
      </Modal>

      {/* 任务日志 */}
      <Modal title={`${taskModal?.name} - 任务日志`} open={!!taskModal} onCancel={() => setTaskModal(null)} footer={null} width={700}>
        <Table rowKey="id" size="small" dataSource={tasks?.list || []} pagination={{ pageSize: 10 }}
          columns={[
            { title: '输入', dataIndex: 'input', width: 200, ellipsis: true },
            { title: '输出', dataIndex: 'output', width: 200, ellipsis: true, render: (v: string) => v?.slice(0, 80) || '-' },
            { title: 'Skill', key: 'skill', width: 80, render: (_, r: any) => r.skill?.name ? <Tag>{r.skill.name}</Tag> : '-' },
            { title: 'Tokens', dataIndex: 'tokensUsed', width: 60 },
            { title: '耗时', dataIndex: 'durationMs', width: 60, render: (v: number) => `${v}ms` },
            { title: '状态', dataIndex: 'status', width: 70, render: (s: string) => <Tag color={s === 'completed' ? 'green' : s === 'running' ? 'blue' : 'red'}>{s}</Tag> },
            { title: '时间', dataIndex: 'createdAt', width: 130, render: (d: string) => dayjs(d).format('MM-DD HH:mm') },
          ]}
        />
      </Modal>
    </div>
  );
}
