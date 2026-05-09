import { useState, useEffect } from 'react';
import {
  Modal,
  List,
  Form,
  Input,
  Select,
  Button,
  Space,
  Tooltip,
  message,
  Divider,
  Typography,
  Tag,
} from 'antd';
import {
  PlusOutlined,
  CopyOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useConnectionStore } from '../../stores/connection';
import * as connectionApi from '../../api/connection';
import type { KafkaConnection, AuthConfig } from '../../types/connection';

const { Text } = Typography;

interface ConnectionModalProps {
  open: boolean;
  onClose: () => void;
}

const AUTH_OPTIONS = [
  { label: '无认证', value: 'none' },
  { label: 'SASL/PLAIN', value: 'sasl_plain' },
  { label: 'SASL/SCRAM-256', value: 'sasl_scram_256' },
  { label: 'SASL/SCRAM-512', value: 'sasl_scram_512' },
  { label: 'SSL', value: 'ssl' },
];

export default function ConnectionModal({ open, onClose }: ConnectionModalProps) {
  const connections = useConnectionStore((s) => s.connections);
  const setConnections = useConnectionStore((s) => s.setConnections);
  const addConnection = useConnectionStore((s) => s.addConnection);
  const updateConnection = useConnectionStore((s) => s.updateConnection);
  const removeConnection = useConnectionStore((s) => s.removeConnection);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (open) {
      connectionApi.getConnections().then(setConnections).catch(console.error);
    }
  }, [open, setConnections]);

  useEffect(() => {
    if (selectedId) {
      const conn = connections.find((c) => c.id === selectedId);
      if (conn) {
        form.setFieldsValue({
          name: conn.name,
          brokers: conn.brokers,
          auth_type: conn.auth.type,
          username: conn.auth.username || '',
          password: conn.auth.password || '',
        });
        setTestResult(null);
        setDirty(false);
      }
    }
  }, [selectedId, connections, form]);

  const handleNew = () => {
    const newConn: KafkaConnection = {
      id: crypto.randomUUID(),
      name: '新连接',
      brokers: 'localhost:9092',
      auth: { type: 'none' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    addConnection(newConn);
    setSelectedId(newConn.id);
    form.setFieldsValue({
      name: newConn.name,
      brokers: newConn.brokers,
      auth_type: 'none',
      username: '',
      password: '',
    });
    setDirty(true);
  };

  const handleDuplicate = () => {
    if (!selectedId) return;
    const conn = connections.find((c) => c.id === selectedId);
    if (!conn) return;
    const dup: KafkaConnection = {
      ...conn,
      id: crypto.randomUUID(),
      name: `${conn.name} (副本)`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    addConnection(dup);
    setSelectedId(dup.id);
    setDirty(true);
  };

  const handleDelete = () => {
    if (!selectedId) return;
    removeConnection(selectedId);
    connectionApi.deleteConnection(selectedId).catch(console.error);
    setSelectedId(null);
    form.resetFields();
  };

  const buildConnectionFromForm = (): KafkaConnection => {
    const values = form.getFieldsValue();
    const existing = connections.find((c) => c.id === selectedId);
    const auth: AuthConfig = {
      type: values.auth_type,
      ...(values.auth_type !== 'none' && values.auth_type !== 'ssl'
        ? { username: values.username, password: values.password }
        : {}),
    };
    return {
      id: selectedId!,
      name: values.name,
      brokers: values.brokers,
      auth,
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  };

  const handleTest = async () => {
    if (!selectedId) return;
    setTesting(true);
    setTestResult(null);
    try {
      const conn = buildConnectionFromForm();
      const result = await connectionApi.testConnection(conn);
      setTestResult(result);
    } catch (e) {
      setTestResult({ success: false, message: `${e}` });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!selectedId) return;
    try {
      await form.validateFields();
      const conn = buildConnectionFromForm();
      const saved = await connectionApi.saveConnection(conn);
      updateConnection(saved);
      setDirty(false);
      message.success('连接已保存');
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) return;
      message.error(`保存失败: ${e}`);
    }
  };

  const handleSaveAndClose = async () => {
    await handleSave();
    onClose();
  };

  const authType = Form.useWatch('auth_type', form);
  const showCredentials = authType && authType !== 'none' && authType !== 'ssl';

  return (
    <Modal
      title="管理连接"
      open={open}
      onCancel={onClose}
      footer={null}
      width={700}
      destroyOnClose
    >
      <div style={{ display: 'flex', gap: 16, minHeight: 360 }}>
        {/* Left: connection list */}
        <div style={{ width: 200, borderRight: '1px solid #f0f0f0', paddingRight: 16 }}>
          <Space size={4} style={{ marginBottom: 8 }}>
            <Tooltip title="新建连接">
              <Button size="small" icon={<PlusOutlined />} onClick={handleNew} />
            </Tooltip>
            <Tooltip title="复制连接">
              <Button
                size="small"
                icon={<CopyOutlined />}
                disabled={!selectedId}
                onClick={handleDuplicate}
              />
            </Tooltip>
            <Tooltip title="删除连接">
              <Button
                size="small"
                icon={<DeleteOutlined />}
                danger
                disabled={!selectedId}
                onClick={handleDelete}
              />
            </Tooltip>
          </Space>
          <List
            size="small"
            dataSource={connections}
            renderItem={(item) => (
              <List.Item
                style={{
                  cursor: 'pointer',
                  padding: '4px 8px',
                  background: selectedId === item.id ? '#e6f4ff' : 'transparent',
                  borderRadius: 4,
                }}
                onClick={() => setSelectedId(item.id)}
              >
                <Text
                  style={{ fontSize: 13 }}
                  ellipsis
                >
                  {item.name}
                </Text>
              </List.Item>
            )}
          />
        </div>

        {/* Right: connection form */}
        <div style={{ flex: 1 }}>
          {selectedId ? (
            <Form
              form={form}
              layout="vertical"
              size="small"
              onValuesChange={() => setDirty(true)}
            >
              <Form.Item
                name="name"
                label="连接名称"
                rules={[{ required: true, message: '请输入连接名称' }]}
              >
                <Input placeholder="开发环境" />
              </Form.Item>

              <Form.Item
                name="brokers"
                label="Brokers"
                rules={[{ required: true, message: '请输入 Broker 地址' }]}
              >
                <Input placeholder="localhost:9092" />
              </Form.Item>

              <Form.Item name="auth_type" label="身份验证" initialValue="none">
                <Select options={AUTH_OPTIONS} />
              </Form.Item>

              {showCredentials && (
                <>
                  <Form.Item name="username" label="用户名">
                    <Input placeholder="username" />
                  </Form.Item>
                  <Form.Item name="password" label="密码">
                    <Input.Password placeholder="password" />
                  </Form.Item>
                </>
              )}

              <Space style={{ marginBottom: 12 }}>
                <Button onClick={handleTest} loading={testing}>
                  测试连接
                </Button>
                {testResult && (
                  <Tag
                    icon={
                      testResult.success ? (
                        <CheckCircleOutlined />
                      ) : (
                        <CloseCircleOutlined />
                      )
                    }
                    color={testResult.success ? 'success' : 'error'}
                  >
                    {testResult.message}
                  </Tag>
                )}
              </Space>

              <Divider style={{ margin: '12px 0' }} />

              <Space>
                <Button onClick={onClose}>取消</Button>
                <Button type="primary" onClick={handleSave} disabled={!dirty}>
                  保存
                </Button>
                <Button type="primary" onClick={handleSaveAndClose} disabled={!dirty}>
                  保存并关闭
                </Button>
              </Space>
            </Form>
          ) : (
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#999',
              }}
            >
              请选择或新建一个连接
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
