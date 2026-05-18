import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Descriptions,
  Button,
  Space,
  Select,
  Switch,
  Skeleton,
  Tooltip,
  Typography,
  Tag,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import * as consumerGroupApi from '../../api/consumer-group';
import { useAutoRefresh, REFRESH_OPTIONS, type RefreshInterval } from '../../hooks/useAutoRefresh';
import type { ConsumerGroupInfo, ConsumerGroupMember, ConsumerGroupOffset } from '../../types/consumer-group';

const { Text } = Typography;

interface ConsumerGroupStatusProps {
  connectionId: string;
  connectionName: string;
  groupId: string;
}

export default function ConsumerGroupStatus({
  connectionId,
  connectionName: _connectionName,
  groupId,
}: ConsumerGroupStatusProps) {
  const [data, setData] = useState<ConsumerGroupInfo | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<RefreshInterval>(10);

  const fetchData = useCallback(async () => {
    try {
      const info = await consumerGroupApi.getConsumerGroupStatus(connectionId, groupId);
      setData(info);
    } finally {
      setInitialLoading(false);
    }
  }, [connectionId, groupId]);

  const { loading, refresh } = useAutoRefresh(fetchData, {
    enabled: autoRefreshEnabled,
    intervalSecs: refreshInterval,
  });

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const memberColumns = [
    { title: '成员ID', dataIndex: 'member_id', key: 'member_id', ellipsis: true },
    { title: '客户端ID', dataIndex: 'client_id', key: 'client_id', width: 150 },
    { title: '主机', dataIndex: 'host', key: 'host', width: 150 },
    {
      title: '分配的分区',
      dataIndex: 'assignments',
      key: 'assignments',
      render: (v: ConsumerGroupMember['assignments']) =>
        v
          ?.map((a) => `${a.topic}[${a.partitions.join(',')}]`)
          .join('; ') || '-',
    },
  ];

  const offsetColumns = [
    { title: '主题', dataIndex: 'topic', key: 'topic' },
    { title: '分区', dataIndex: 'partition', key: 'partition', width: 60 },
    { title: '当前偏移量', dataIndex: 'current_offset', key: 'current_offset', width: 100 },
    { title: 'Log End Offset', dataIndex: 'log_end_offset', key: 'log_end_offset', width: 120 },
    {
      title: 'Lag',
      dataIndex: 'lag',
      key: 'lag',
      width: 80,
      render: (v: number) => (
        <Tag color={v > 1000 ? 'red' : v > 100 ? 'orange' : 'green'}>{v}</Tag>
      ),
    },
  ];

  if (initialLoading) {
    return <Skeleton active paragraph={{ rows: 8 }} />;
  }

  return (
    <div>
      {/* Toolbar */}
      <Space style={{ marginBottom: 12 }} size={8}>
        <Tooltip title="刷新">
          <Button
            size="small"
            icon={<ReloadOutlined spin={loading} />}
            onClick={refresh}
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
      </Space>

      {data && (
        <>
          <Descriptions size="small" bordered column={4} style={{ marginBottom: 12 }}>
            <Descriptions.Item label="消费者组">{data.group_id}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={data.state === 'Stable' ? 'green' : 'orange'}>{data.state}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="协议类型">{data.protocol_type}</Descriptions.Item>
            <Descriptions.Item label="成员数">{data.members.length}</Descriptions.Item>
          </Descriptions>

          <Text strong style={{ fontSize: 13, marginBottom: 8, display: 'block' }}>
            成员列表
          </Text>
          <Table<ConsumerGroupMember>
            size="small"
            dataSource={data.members}
            columns={memberColumns}
            rowKey="member_id"
            pagination={false}
            bordered
            style={{ marginBottom: 16 }}
          />

          <Text strong style={{ fontSize: 13, marginBottom: 8, display: 'block' }}>
            偏移量信息
          </Text>
          <Table<ConsumerGroupOffset>
            size="small"
            dataSource={data.offsets}
            columns={offsetColumns}
            rowKey={(r) => `${r.topic}-${r.partition}`}
            pagination={false}
            scroll={{ y: 300 }}
            bordered
          />
        </>
      )}
    </div>
  );
}
