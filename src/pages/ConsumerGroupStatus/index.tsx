import { useCallback, useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import * as consumerGroupApi from '@/api/consumer-group';
import { AutoRefreshControls, RefreshButton } from '@/components/AutoRefresh';
import { Badge } from '@/components/ui/badge';
import { type RefreshInterval, useAutoRefresh } from '@/hooks/useAutoRefresh';
import type {
  ConsumerGroupInfo,
  ConsumerGroupMember,
  ConsumerGroupOffset,
} from '@/types/consumer-group';
import { notifyError } from '@/utils/notify';

interface ConsumerGroupStatusProps {
  connectionId: string;
  connectionName: string;
  groupId: string;
}

const thClass =
  'px-2 py-1 text-left text-[10px] font-medium uppercase tracking-[0.16em] text-muted';

const lagVariant = (lag: number) => {
  if (lag > 1000) return 'danger' as const;
  if (lag > 100) return 'warning' as const;
  return 'success' as const;
};

export default function ConsumerGroupStatus({
  connectionId,
  connectionName,
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
    } catch (error) {
      notifyError(`加载消费者组状态失败: ${String(error)}`, error, 'consumer-group');
    } finally {
      setInitialLoading(false);
    }
  }, [connectionId, groupId]);

  const { loading, lastRefreshed, refresh } = useAutoRefresh(fetchData, {
    enabled: autoRefreshEnabled,
    intervalSecs: refreshInterval,
  });

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const renderMemberRow = (member: ConsumerGroupMember) => (
    <tr className="border-t border-border" key={member.member_id}>
      <td className="max-w-[16rem] truncate px-2 py-1 text-xs text-foreground">{member.member_id}</td>
      <td className="px-2 py-1 text-xs text-body">{member.client_id}</td>
      <td className="px-2 py-1 text-xs text-body">{member.host}</td>
      <td className="px-2 py-1 text-xs text-body">
        {member.assignments?.map((assignment) => `${assignment.topic}[${assignment.partitions.join(',')}]`).join('; ') ||
          '-'}
      </td>
    </tr>
  );

  const renderOffsetRow = (offset: ConsumerGroupOffset) => (
    <tr className="border-t border-border" key={`${offset.topic}-${offset.partition}`}>
      <td className="px-2 py-1 text-xs text-foreground">{offset.topic}</td>
      <td className="px-2 py-1 text-xs text-foreground">{offset.partition}</td>
      <td className="px-2 py-1 text-xs text-body">{offset.current_offset}</td>
      <td className="px-2 py-1 text-xs text-body">{offset.log_end_offset}</td>
      <td className="px-2 py-1 text-xs">
        <Badge variant={lagVariant(offset.lag)}>{offset.lag}</Badge>
      </td>
    </tr>
  );

  return (
    <section className="space-y-2">
      <div className="rounded-[8px] bg-signature-mint/35 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-foreground">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted">Consumer Group</p>
            <h2 className="text-lg leading-tight text-foreground">{groupId}</h2>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-[8px] border border-border bg-white px-2 py-1.5">
        <RefreshButton loading={loading} onRefresh={() => void refresh()} />

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
        <div className="space-y-1 rounded-[8px] border border-border bg-white p-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="h-5 animate-pulse rounded-[4px] bg-surface-soft" key={index} />
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid gap-2 md:grid-cols-4">
            <div className="rounded-[8px] border border-border bg-white p-2.5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted">消费者组</p>
              <p className="mt-0.5 truncate text-xs font-normal text-foreground">{data.group_id}</p>
            </div>
            <div className="rounded-[8px] border border-border bg-white p-2.5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted">状态</p>
              <p className="mt-0.5">
                <Badge variant={data.state === 'Stable' ? 'success' : 'warning'}>{data.state}</Badge>
              </p>
            </div>
            <div className="rounded-[8px] border border-border bg-white p-2.5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted">协议类型</p>
              <p className="mt-0.5 text-xs font-medium text-foreground">{data.protocol_type}</p>
            </div>
            <div className="rounded-[8px] border border-border bg-white p-2.5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted">成员数</p>
              <p className="mt-0.5 text-xs font-medium text-foreground">{data.members.length}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-[8px] border border-border bg-white">
            <div className="border-b border-border px-2 py-1.5">
              <h3 className="text-xs font-medium text-foreground">成员列表</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead className="bg-surface-soft">
                  <tr>
                    <th className={thClass}>成员 ID</th>
                    <th className={thClass}>客户端 ID</th>
                    <th className={thClass}>主机</th>
                    <th className={thClass}>分配的分区</th>
                  </tr>
                </thead>
                <tbody>
                  {data.members.length === 0 ? (
                    <tr>
                      <td className="px-2 py-4 text-center text-xs text-body" colSpan={4}>
                        暂无活跃成员
                      </td>
                    </tr>
                  ) : (
                    data.members.map(renderMemberRow)
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden rounded-[8px] border border-border bg-white">
            <div className="border-b border-border px-2 py-1.5">
              <h3 className="text-xs font-medium text-foreground">偏移量信息</h3>
            </div>
            <div className="max-h-[22rem] overflow-auto">
              <table className="min-w-full border-collapse">
                <thead className="sticky top-0 bg-surface-soft">
                  <tr>
                    <th className={thClass}>主题</th>
                    <th className={thClass}>分区</th>
                    <th className={thClass}>当前偏移量</th>
                    <th className={thClass}>Log End Offset</th>
                    <th className={thClass}>Lag</th>
                  </tr>
                </thead>
                <tbody>
                  {data.offsets.length === 0 ? (
                    <tr>
                      <td className="px-2 py-4 text-center text-xs text-body" colSpan={5}>
                        暂无偏移量信息
                      </td>
                    </tr>
                  ) : (
                    data.offsets.map(renderOffsetRow)
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-[8px] border border-dashed border-border-strong bg-white px-2 py-3 text-xs leading-5 text-body">
          未能加载消费者组状态。
        </div>
      )}
    </section>
  );
}