import { useCallback, useEffect, useState } from 'react';
import { Database, TableProperties } from 'lucide-react';
import * as topicApi from '@/api/topic';
import { AutoRefreshControls, RefreshButton } from '@/components/AutoRefresh';
import { Button } from '@/components/ui/button';
import { type RefreshInterval, useAutoRefresh } from '@/hooks/useAutoRefresh';
import { useTabNavigation } from '@/hooks/useTabNavigation';
import type { PartitionStatus, TopicStatus as TopicStatusType } from '@/types/topic';
import { notifyError } from '@/utils/notify';

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
    } catch (error) {
      notifyError(`加载主题状态失败: ${String(error)}`, error, 'topic-status');
    } finally {
      setInitialLoading(false);
    }
  }, [connectionId, topicName]);

  const { loading, lastRefreshed, refresh } = useAutoRefresh(fetchData, {
    enabled: autoRefreshEnabled,
    intervalSecs: refreshInterval,
  });

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const renderPartitionRow = (partition: PartitionStatus) => (
    <tr className="border-t border-border" key={partition.partition}>
      <td className="px-2 py-1 text-xs text-foreground">{partition.partition}</td>
      <td className="px-2 py-1 text-xs text-foreground">{partition.leader}</td>
      <td className="px-2 py-1 text-xs text-body">{partition.replicas.join(', ')}</td>
      <td className="px-2 py-1 text-xs text-body">{partition.isr.join(', ')}</td>
      <td className="px-2 py-1 text-xs text-body">{partition.beginning_offset}</td>
      <td className="px-2 py-1 text-xs text-body">{partition.end_offset}</td>
    </tr>
  );

  return (
    <section className="space-y-2">
      <div className="rounded-[8px] bg-signature-cream p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-foreground">
            <Database className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted">Topic Status</p>
            <h2 className="text-lg leading-tight text-foreground">{topicName}</h2>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-[8px] border border-border bg-white px-2 py-1.5">
        <RefreshButton loading={loading} onRefresh={() => void refresh()} />
        <Button onClick={() => openTopicData(connectionId, connectionName, topicName)} size="sm" variant="outline">
          <TableProperties className="h-4 w-4" />
          查看数据
        </Button>

        <AutoRefreshControls
          className="ml-auto"
          enabled={autoRefreshEnabled}
          intervalSecs={refreshInterval}
          lastRefreshed={lastRefreshed}
          onEnabledChange={setAutoRefreshEnabled}
          onIntervalChange={setRefreshInterval}
        />
      </div>

      {initialLoading ? (
        <div className="rounded-[8px] border border-border bg-white px-2 py-3 text-xs leading-5 text-body">
          正在加载主题状态...
        </div>
      ) : data ? (
        <>
          <div className="grid gap-2 md:grid-cols-4">
            <div className="rounded-[8px] border border-border bg-white p-2.5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted">主题名称</p>
              <p className="mt-0.5 truncate text-xs font-normal text-foreground">{data.info.name}</p>
            </div>
            <div className="rounded-[8px] border border-border bg-white p-2.5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted">分区数</p>
              <p className="mt-0.5 text-xs font-medium text-foreground">{data.info.partitions}</p>
            </div>
            <div className="rounded-[8px] border border-border bg-white p-2.5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted">副本因子</p>
              <p className="mt-0.5 text-xs font-medium text-foreground">{data.info.replication_factor}</p>
            </div>
            <div className="rounded-[8px] border border-border bg-white p-2.5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted">分区总数</p>
              <p className="mt-0.5 text-xs font-medium text-foreground">{data.partitions.length}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-[8px] border border-border bg-white">
            <div className="border-b border-border px-2 py-1.5">
              <h3 className="text-xs font-medium text-foreground">Partition 状态</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead className="bg-surface-soft">
                  <tr>
                    <th className="px-2 py-1 text-left text-[10px] font-medium uppercase tracking-[0.16em] text-muted">分区</th>
                    <th className="px-2 py-1 text-left text-[10px] font-medium uppercase tracking-[0.16em] text-muted">Leader</th>
                    <th className="px-2 py-1 text-left text-[10px] font-medium uppercase tracking-[0.16em] text-muted">副本</th>
                    <th className="px-2 py-1 text-left text-[10px] font-medium uppercase tracking-[0.16em] text-muted">ISR</th>
                    <th className="px-2 py-1 text-left text-[10px] font-medium uppercase tracking-[0.16em] text-muted">起始偏移量</th>
                    <th className="px-2 py-1 text-left text-[10px] font-medium uppercase tracking-[0.16em] text-muted">Log End Offset</th>
                  </tr>
                </thead>
                <tbody>{data.partitions.map(renderPartitionRow)}</tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-[8px] border border-dashed border-border-strong bg-white px-2 py-3 text-xs leading-5 text-body">
          未能加载主题状态。
        </div>
      )}
    </section>
  );
}