import { useCallback, useEffect, useState } from 'react';
import { Database, TableProperties } from 'lucide-react';
import * as topicApi from '@/api/topic';
import { AutoRefreshControls, RefreshButton } from '@/components/AutoRefresh';
import { Button } from '@/components/ui/button';
import { type RefreshInterval, useAutoRefresh } from '@/hooks/useAutoRefresh';
import { useTabNavigation } from '@/hooks/useTabNavigation';
import type { PartitionStatus, TopicStatus as TopicStatusType } from '@/types/topic';

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

  const { loading, lastRefreshed, refresh } = useAutoRefresh(fetchData, {
    enabled: autoRefreshEnabled,
    intervalSecs: refreshInterval,
  });

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const renderPartitionRow = (partition: PartitionStatus) => (
    <tr className="border-t border-border" key={partition.partition}>
      <td className="px-4 py-3 text-sm text-foreground">{partition.partition}</td>
      <td className="px-4 py-3 text-sm text-foreground">{partition.leader}</td>
      <td className="px-4 py-3 text-sm text-body">{partition.replicas.join(', ')}</td>
      <td className="px-4 py-3 text-sm text-body">{partition.isr.join(', ')}</td>
      <td className="px-4 py-3 text-sm text-body">{partition.beginning_offset}</td>
      <td className="px-4 py-3 text-sm text-body">{partition.end_offset}</td>
    </tr>
  );

  return (
    <section className="space-y-6">
      <div className="rounded-[12px] bg-signature-cream p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-foreground">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted">Topic Status</p>
            <h2 className="mt-2 text-2xl font-medium text-foreground">{topicName}</h2>
            <p className="mt-2 text-sm leading-6 text-body">
              当前连接: {connectionName} · {connectionId}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-border bg-white px-4 py-3">
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
        <div className="rounded-[12px] border border-border bg-white px-6 py-10 text-sm leading-6 text-body">
          正在加载主题状态...
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-[12px] border border-border bg-white p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">主题名称</p>
              <p className="mt-2 text-sm font-medium text-foreground">{data.info.name}</p>
            </div>
            <div className="rounded-[12px] border border-border bg-white p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">分区数</p>
              <p className="mt-2 text-sm font-medium text-foreground">{data.info.partitions}</p>
            </div>
            <div className="rounded-[12px] border border-border bg-white p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">副本因子</p>
              <p className="mt-2 text-sm font-medium text-foreground">{data.info.replication_factor}</p>
            </div>
            <div className="rounded-[12px] border border-border bg-white p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">分区总数</p>
              <p className="mt-2 text-sm font-medium text-foreground">{data.partitions.length}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-[12px] border border-border bg-white">
            <div className="border-b border-border px-5 py-4">
              <h3 className="text-sm font-medium text-foreground">Partition 状态</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead className="bg-surface-soft">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-muted">分区</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-muted">Leader</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-muted">副本</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-muted">ISR</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-muted">起始偏移量</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-muted">Log End Offset</th>
                  </tr>
                </thead>
                <tbody>{data.partitions.map(renderPartitionRow)}</tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-[12px] border border-dashed border-border-strong bg-white px-6 py-10 text-sm leading-6 text-body">
          未能加载主题状态。
        </div>
      )}
    </section>
  );
}