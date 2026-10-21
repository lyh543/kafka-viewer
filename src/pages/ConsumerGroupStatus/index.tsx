import { useCallback, useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { toast } from 'sonner';
import * as consumerGroupApi from '@/api/consumer-group';
import { AutoRefreshControls, RefreshButton } from '@/components/AutoRefresh';
import { Badge } from '@/components/ui/badge';
import { type RefreshInterval, useAutoRefresh } from '@/hooks/useAutoRefresh';
import type {
  ConsumerGroupInfo,
  ConsumerGroupMember,
  ConsumerGroupOffset,
} from '@/types/consumer-group';

interface ConsumerGroupStatusProps {
  connectionId: string;
  connectionName: string;
  groupId: string;
}

const thClass =
  'px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-muted';

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
      toast.error(`加载消费者组状态失败: ${String(error)}`);
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
      <td className="max-w-[16rem] truncate px-4 py-3 text-sm text-foreground">{member.member_id}</td>
      <td className="px-4 py-3 text-sm text-body">{member.client_id}</td>
      <td className="px-4 py-3 text-sm text-body">{member.host}</td>
      <td className="px-4 py-3 text-sm text-body">
        {member.assignments?.map((assignment) => `${assignment.topic}[${assignment.partitions.join(',')}]`).join('; ') ||
          '-'}
      </td>
    </tr>
  );

  const renderOffsetRow = (offset: ConsumerGroupOffset) => (
    <tr className="border-t border-border" key={`${offset.topic}-${offset.partition}`}>
      <td className="px-4 py-3 text-sm text-foreground">{offset.topic}</td>
      <td className="px-4 py-3 text-sm text-foreground">{offset.partition}</td>
      <td className="px-4 py-3 text-sm text-body">{offset.current_offset}</td>
      <td className="px-4 py-3 text-sm text-body">{offset.log_end_offset}</td>
      <td className="px-4 py-3 text-sm">
        <Badge variant={lagVariant(offset.lag)}>{offset.lag}</Badge>
      </td>
    </tr>
  );

  return (
    <section className="space-y-6">
      <div className="rounded-[12px] bg-signature-mint/35 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-foreground">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted">Consumer Group</p>
            <h2 className="mt-2 text-2xl font-medium text-foreground">{groupId}</h2>
            <p className="mt-2 text-sm leading-6 text-body">
              当前连接: {connectionName} · {connectionId}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-border bg-white px-4 py-3">
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
        <div className="space-y-2 rounded-[12px] border border-border bg-white p-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="h-8 animate-pulse rounded-[6px] bg-surface-soft" key={index} />
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-[12px] border border-border bg-white p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">消费者组</p>
              <p className="mt-2 truncate text-sm font-medium text-foreground">{data.group_id}</p>
            </div>
            <div className="rounded-[12px] border border-border bg-white p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">状态</p>
              <p className="mt-2">
                <Badge variant={data.state === 'Stable' ? 'success' : 'warning'}>{data.state}</Badge>
              </p>
            </div>
            <div className="rounded-[12px] border border-border bg-white p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">协议类型</p>
              <p className="mt-2 text-sm font-medium text-foreground">{data.protocol_type}</p>
            </div>
            <div className="rounded-[12px] border border-border bg-white p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">成员数</p>
              <p className="mt-2 text-sm font-medium text-foreground">{data.members.length}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-[12px] border border-border bg-white">
            <div className="border-b border-border px-5 py-4">
              <h3 className="text-sm font-medium text-foreground">成员列表</h3>
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
                      <td className="px-4 py-10 text-center text-sm text-body" colSpan={4}>
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

          <div className="overflow-hidden rounded-[12px] border border-border bg-white">
            <div className="border-b border-border px-5 py-4">
              <h3 className="text-sm font-medium text-foreground">偏移量信息</h3>
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
                      <td className="px-4 py-10 text-center text-sm text-body" colSpan={5}>
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
        <div className="rounded-[12px] border border-dashed border-border-strong bg-white px-6 py-10 text-sm leading-6 text-body">
          未能加载消费者组状态。
        </div>
      )}
    </section>
  );
}