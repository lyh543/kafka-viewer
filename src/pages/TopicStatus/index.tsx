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
} from 'antd';
import {
  ReloadOutlined,
  TableOutlined,
} from '@ant-design/icons';
import * as topicApi from '../../api/topic';
import { useAutoRefresh, REFRESH_OPTIONS, type RefreshInterval } from '../../hooks/useAutoRefresh';
import { useTabNavigation } from '../../hooks/useTabNavigation';
import type { TopicStatus as TopicStatusType, PartitionStatus } from '../../types/topic';

const { Text } = Typography;

interface TopicStatusProps {
  connectionId: string;
  connectionName: string;
  topicName: string;
}

export default function TopicStatus({ connectionId, connectionName, topicName }: TopicStatusProps) {
  const [data, setData] = useState<TopicStatusType | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<RefreshInterval>(10);
  const { openTopicData } = useTabNavigation();

  const fetchData = useCallback(async () => {
    try {
      const status = await topicApi.getTopicStatus(connectionId, topicName);
      setData(status);
    } finally {
      setInitialLoading(false);
    }
  }, [connectionId, topicName]);

  const { loading, refresh } = useAutoRefresh(fetchData, {
    enabled: autoRefreshEnabled,
    intervalSecs: refreshInterval,
  });

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns = [
    { title: '分区', dataIndex: 'partition', key: 'partition', width: 60 },
    { title: 'Leader', dataIndex: 'leader', key: 'leader', width: 70 },
    {
      title: '副本',
      dataIndex: 'replicas',
      key: 'replicas',
      render: (v: number[]) => v?.join(', '),
    },
    {
      title: 'ISR',
      dataIndex: 'isr',
      key: 'isr',
      render: (v: number[]) => v?.join(', '),
    },
    { title: '起始偏移量', dataIndex: 'beginning_offset', key: 'beginning_offset', width: 100 },
    { title: 'Log End Offset', dataIndex: 'end_offset', key: 'end_offset', width: 120 },
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
        <Tooltip title="查看数据">
          <Button
            size="small"
            icon={<TableOutlined />}
            onClick={() => openTopicData(connectionId, connectionName, topicName)}
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

      {/* Topic info */}
      {data && (
        <>
          <Descriptions
            size="small"
            bordered
            column={4}
            style={{ marginBottom: 12 }}
          >
            <Descriptions.Item label="主题名称">{data.info.name}</Descriptions.Item>
            <Descriptions.Item label="分区数">{data.info.partitions}</Descriptions.Item>
            <Descriptions.Item label="副本因子">
              {data.info.replication_factor}
            </Descriptions.Item>
            <Descriptions.Item label="分区总数">{data.partitions.length}</Descriptions.Item>
          </Descriptions>

          {/* Partition table */}
          <Table<PartitionStatus>
            size="small"
            dataSource={data.partitions}
            columns={columns}
            rowKey="partition"
            pagination={false}
            scroll={{ y: 400 }}
            bordered
          />
        </>
      )}
    </div>
  );
}
