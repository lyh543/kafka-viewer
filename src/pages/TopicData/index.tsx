import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Button,
  Space,
  Select,
  Switch,
  Input,
  Form,
  Modal,
  Tooltip,
  Typography,
  Skeleton,
  Tag,
  message,
} from 'antd';
import {
  ReloadOutlined,
  EditOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import * as topicApi from '../../api/topic';
import { useAutoRefresh, REFRESH_OPTIONS, type RefreshInterval } from '../../hooks/useAutoRefresh';
import type { KafkaMessage, DataFilter } from '../../types/topic';

const { Text } = Typography;
const { TextArea } = Input;

interface TopicDataProps {
  connectionId: string;
  connectionName: string;
  topicName: string;
}

const FILTER_MODES = [
  { label: '等于', value: 'equals' },
  { label: '不等于', value: 'not_equals' },
  { label: '包含', value: 'contains' },
  { label: '正则', value: 'regex' },
];

const START_FROM_OPTIONS = [
  { label: '最新', value: 'latest' },
  { label: '从开头', value: 'beginning' },
  { label: '最新N条', value: 'last_n' },
];

export default function TopicData({ connectionId, connectionName: _connectionName, topicName }: TopicDataProps) {
  const [messages, setMessages] = useState<KafkaMessage[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<RefreshInterval>(10);
  const [produceModalOpen, setProduceModalOpen] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [produceForm] = Form.useForm();

  // Filter state
  const [filter, setFilter] = useState<DataFilter>({
    start_from: { type: 'last_n', count: 100 },
  });

  const fetchData = useCallback(async () => {
    try {
      const data = await topicApi.fetchMessages(connectionId, topicName, filter);
      setMessages(data);
    } finally {
      setInitialLoading(false);
    }
  }, [connectionId, topicName, filter]);

  const { loading, refresh } = useAutoRefresh(fetchData, {
    enabled: autoRefreshEnabled,
    intervalSecs: refreshInterval,
  });

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleProduce = async () => {
    try {
      const values = await produceForm.validateFields();
      const headers: Record<string, string> = {};
      if (values.headers) {
        try {
          Object.assign(headers, JSON.parse(values.headers));
        } catch {
          // ignore parse errors
        }
      }
      await topicApi.produceMessage({
        connection_id: connectionId,
        topic: topicName,
        key: values.key || undefined,
        value: values.value,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        partition: values.partition != null ? Number(values.partition) : undefined,
      });
      message.success('消息已发送');
      setProduceModalOpen(false);
      produceForm.resetFields();
      refresh();
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) return;
      message.error(`发送失败: ${e}`);
    }
  };

  const columns = [
    { title: '分区', dataIndex: 'partition', key: 'partition', width: 60 },
    { title: '偏移量', dataIndex: 'offset', key: 'offset', width: 80 },
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 170,
      render: (v: number) => v ? new Date(v).toLocaleString() : '-',
    },
    {
      title: 'Key',
      dataIndex: 'key',
      key: 'key',
      width: 150,
      ellipsis: true,
      render: (v: string | null) => v ?? <Text type="secondary">null</Text>,
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
      ellipsis: true,
      render: (v: string | null) => v ?? <Text type="secondary">null</Text>,
    },
  ];

  if (initialLoading) {
    return <Skeleton active paragraph={{ rows: 10 }} />;
  }

  return (
    <div>
      {/* Toolbar */}
      <Space style={{ marginBottom: 8 }} size={8}>
        <Tooltip title="刷新">
          <Button
            size="small"
            icon={<ReloadOutlined spin={loading} />}
            onClick={refresh}
          />
        </Tooltip>
        <Tooltip title="写入数据">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => setProduceModalOpen(true)}
          />
        </Tooltip>
        <Tooltip title="筛选">
          <Button
            size="small"
            icon={<FilterOutlined />}
            type={filterVisible ? 'primary' : 'default'}
            onClick={() => setFilterVisible(!filterVisible)}
          />
        </Tooltip>
        <Space size={4}>
          <Text style={{ fontSize: 12 }}>自动刷新</Text>
          <Switch
            size="small"
            checked={autoRefreshEnabled}
            onChange={setAutoRefreshEnabled}
          />
          {autoRefreshEnabled && (
            <Select
              size="small"
              value={refreshInterval}
              onChange={setRefreshInterval}
              options={REFRESH_OPTIONS}
              style={{ width: 80 }}
            />
          )}
        </Space>
        <Tag>{messages.length} 条消息</Tag>
      </Space>

      {/* Filter panel */}
      {filterVisible && (
        <div
          style={{
            padding: 12,
            background: '#fafafa',
            borderRadius: 4,
            marginBottom: 8,
            border: '1px solid #f0f0f0',
          }}
        >
          <Space wrap size={8}>
            <Space size={4}>
              <Text style={{ fontSize: 12 }}>起点:</Text>
              <Select
                size="small"
                value={filter.start_from.type}
                onChange={(v) => {
                  if (v === 'last_n') {
                    setFilter({ ...filter, start_from: { type: 'last_n', count: 100 } });
                  } else {
                    setFilter({ ...filter, start_from: { type: v } as DataFilter['start_from'] });
                  }
                }}
                options={START_FROM_OPTIONS}
                style={{ width: 100 }}
              />
              {filter.start_from.type === 'last_n' && (
                <Input
                  size="small"
                  type="number"
                  value={(filter.start_from as { count: number }).count}
                  onChange={(e) =>
                    setFilter({
                      ...filter,
                      start_from: { type: 'last_n', count: Number(e.target.value) || 100 },
                    })
                  }
                  style={{ width: 70 }}
                />
              )}
            </Space>
            <Space size={4}>
              <Text style={{ fontSize: 12 }}>Key 筛选:</Text>
              <Select
                size="small"
                allowClear
                placeholder="模式"
                value={filter.key_filter?.mode}
                onChange={(v) =>
                  setFilter({
                    ...filter,
                    key_filter: v
                      ? { mode: v, value: filter.key_filter?.value || '' }
                      : undefined,
                  })
                }
                options={FILTER_MODES}
                style={{ width: 80 }}
              />
              {filter.key_filter && (
                <Input
                  size="small"
                  value={filter.key_filter.value}
                  onChange={(e) =>
                    setFilter({
                      ...filter,
                      key_filter: { ...filter.key_filter!, value: e.target.value },
                    })
                  }
                  placeholder="值"
                  style={{ width: 120 }}
                />
              )}
            </Space>
            <Space size={4}>
              <Text style={{ fontSize: 12 }}>Value 筛选:</Text>
              <Select
                size="small"
                allowClear
                placeholder="模式"
                value={filter.value_filter?.mode}
                onChange={(v) =>
                  setFilter({
                    ...filter,
                    value_filter: v
                      ? { mode: v, value: filter.value_filter?.value || '' }
                      : undefined,
                  })
                }
                options={FILTER_MODES}
                style={{ width: 80 }}
              />
              {filter.value_filter && (
                <Input
                  size="small"
                  value={filter.value_filter.value}
                  onChange={(e) =>
                    setFilter({
                      ...filter,
                      value_filter: { ...filter.value_filter!, value: e.target.value },
                    })
                  }
                  placeholder="值"
                  style={{ width: 120 }}
                />
              )}
            </Space>
            <Button size="small" type="primary" onClick={refresh}>
              应用
            </Button>
          </Space>
        </div>
      )}

      {/* Messages table */}
      <Table<KafkaMessage>
        size="small"
        dataSource={messages}
        columns={columns}
        rowKey={(r) => `${r.partition}-${r.offset}`}
        pagination={{ pageSize: 50, size: 'small', showSizeChanger: true }}
        scroll={{ y: 400 }}
        bordered
        expandable={{
          expandedRowRender: (record) => (
            <div style={{ padding: 8 }}>
              <Text strong style={{ fontSize: 12 }}>
                Value:
              </Text>
              <pre
                style={{
                  fontSize: 12,
                  maxHeight: 200,
                  overflow: 'auto',
                  background: '#f5f5f5',
                  padding: 8,
                  borderRadius: 4,
                  margin: '4px 0 0 0',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {record.value}
              </pre>
              {record.headers && Object.keys(record.headers).length > 0 && (
                <>
                  <Text strong style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
                    Headers:
                  </Text>
                  <pre
                    style={{
                      fontSize: 12,
                      background: '#f5f5f5',
                      padding: 8,
                      borderRadius: 4,
                      margin: '4px 0 0 0',
                    }}
                  >
                    {JSON.stringify(record.headers, null, 2)}
                  </pre>
                </>
              )}
            </div>
          ),
        }}
      />

      {/* Produce message modal */}
      <Modal
        title={`写入数据 - ${topicName}`}
        open={produceModalOpen}
        onOk={handleProduce}
        onCancel={() => setProduceModalOpen(false)}
        okText="发送"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={produceForm} layout="vertical" size="small">
          <Form.Item name="key" label="Key">
            <Input placeholder="消息键（可选）" />
          </Form.Item>
          <Form.Item
            name="value"
            label="Value"
            rules={[{ required: true, message: '请输入消息内容' }]}
          >
            <TextArea rows={6} placeholder="消息内容" />
          </Form.Item>
          <Form.Item name="headers" label="Headers (JSON)">
            <TextArea rows={3} placeholder='{"key": "value"}' />
          </Form.Item>
          <Form.Item name="partition" label="分区（可选）">
            <Input type="number" placeholder="自动分配" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
