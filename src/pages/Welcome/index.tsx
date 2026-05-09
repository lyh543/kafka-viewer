import { useEffect, useState } from 'react';
import { Button, Card, Input, List, Modal, Space, Typography, Form, message, Tooltip } from 'antd';
import {
  PlusOutlined,
  FolderOpenOutlined,
  DeleteOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { open } from '@tauri-apps/plugin-dialog';
import * as projectApi from '../../api/project';
import { useProjectStore } from '../../stores/project';
import type { RecentProject } from '../../types/project';

const { Title, Text } = Typography;

interface WelcomeProps {
  onProjectOpened: () => void;
}

export default function Welcome({ onProjectOpened }: WelcomeProps) {
  const { recentProjects, setRecentProjects, setCurrentProject } = useProjectStore();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    projectApi.getRecentProjects().then(setRecentProjects).catch(console.error);
  }, [setRecentProjects]);

  const handleCreateProject = async () => {
    try {
      const values = await form.validateFields();
      const project = await projectApi.createProject(values.name, values.path);
      setCurrentProject(project);
      setCreateModalOpen(false);
      onProjectOpened();
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) return;
      message.error(`创建项目失败: ${e}`);
    }
  };

  const handleOpenProject = async () => {
    const selected = await open({ directory: true, title: '选择项目文件夹' });
    if (selected) {
      try {
        const project = await projectApi.openProject(selected);
        setCurrentProject(project);
        onProjectOpened();
      } catch (e) {
        message.error(`打开项目失败: ${e}`);
      }
    }
  };

  const handleOpenRecent = async (recent: RecentProject) => {
    try {
      const project = await projectApi.openProject(recent.path);
      setCurrentProject(project);
      onProjectOpened();
    } catch (e) {
      message.error(`打开项目失败: ${e}`);
    }
  };

  const handleRemoveRecent = async (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await projectApi.removeRecentProject(path);
      setRecentProjects(recentProjects.filter((p) => p.path !== path));
    } catch (err) {
      message.error(`移除失败: ${err}`);
    }
  };

  const handleBrowseFolder = async () => {
    const selected = await open({ directory: true, title: '选择项目保存位置' });
    if (selected) {
      const name = form.getFieldValue('name') || 'my-project';
      form.setFieldsValue({ path: `${selected}/${name}` });
    }
  };

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f5f5',
      }}
    >
      <Card style={{ width: 640, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0 }}>
            Kafka Viewer
          </Title>
          <Text type="secondary">v0.1.0</Text>
        </div>

        <div style={{ display: 'flex', gap: 24 }}>
          {/* Left: actions */}
          <Space direction="vertical" style={{ width: 180 }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              block
              onClick={() => setCreateModalOpen(true)}
            >
              新建项目
            </Button>
            <Button icon={<FolderOpenOutlined />} block onClick={handleOpenProject}>
              打开项目
            </Button>
          </Space>

          {/* Right: recent projects */}
          <div style={{ flex: 1 }}>
            <Text strong style={{ fontSize: 13, marginBottom: 8, display: 'block' }}>
              最近的项目
            </Text>
            <List
              size="small"
              dataSource={recentProjects}
              locale={{ emptyText: '暂无最近项目' }}
              style={{ maxHeight: 240, overflow: 'auto' }}
              renderItem={(item) => (
                <List.Item
                  style={{ cursor: 'pointer', padding: '6px 8px' }}
                  onClick={() => handleOpenRecent(item)}
                  actions={[
                    <Tooltip title="移除" key="del">
                      <DeleteOutlined
                        style={{ color: '#999', fontSize: 12 }}
                        onClick={(e) => handleRemoveRecent(item.path, e)}
                      />
                    </Tooltip>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={<RightOutlined style={{ color: '#1677ff', marginTop: 4 }} />}
                    title={<Text style={{ fontSize: 13 }}>{item.name}</Text>}
                    description={
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {item.path}
                      </Text>
                    }
                  />
                </List.Item>
              )}
            />
          </div>
        </div>
      </Card>

      {/* Create project modal */}
      <Modal
        title="新建项目"
        open={createModalOpen}
        onOk={handleCreateProject}
        onCancel={() => setCreateModalOpen(false)}
        okText="创建"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ path: '' }}>
          <Form.Item
            name="name"
            label="项目名称"
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input
              placeholder="my-project"
              onChange={(e) => {
                const currentPath = form.getFieldValue('path') as string;
                if (!currentPath || currentPath.endsWith('/') || currentPath.match(/\/[^/]*$/)) {
                  const base = currentPath
                    ? currentPath.replace(/\/[^/]*$/, '/')
                    : '';
                  form.setFieldsValue({
                    path: base ? `${base}${e.target.value}` : '',
                  });
                }
              }}
            />
          </Form.Item>
          <Form.Item
            name="path"
            label="项目位置"
            rules={[{ required: true, message: '请选择项目位置' }]}
          >
            <Input
              placeholder="~/KafkaViewer/projects/my-project"
              addonAfter={
                <FolderOpenOutlined
                  style={{ cursor: 'pointer' }}
                  onClick={handleBrowseFolder}
                />
              }
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
