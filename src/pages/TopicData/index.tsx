import { Fragment, useCallback, useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Filter,
  Send,
  TableProperties,
} from 'lucide-react';
import { toast } from 'sonner';
import * as topicApi from '@/api/topic';
import { AutoRefreshControls, RefreshButton } from '@/components/AutoRefresh';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { type RefreshInterval, useAutoRefresh } from '@/hooks/useAutoRefresh';
import type { DataFilter, KafkaMessage } from '@/types/topic';

interface TopicDataProps {
  connectionId: string;
  connectionName: string;
  topicName: string;
}

type FilterMode = 'equals' | 'not_equals' | 'contains' | 'regex';

const FILTER_MODES: { label: string; value: FilterMode }[] = [
  { label: '等于', value: 'equals' },
  { label: '不等于', value: 'not_equals' },
  { label: '包含', value: 'contains' },
  { label: '正则', value: 'regex' },
];

const START_FROM_OPTIONS: { label: string; value: DataFilter['start_from']['type'] }[] = [
  { label: '最新', value: 'latest' },
  { label: '从开头', value: 'beginning' },
  { label: '最新N条', value: 'last_n' },
];

const PAGE_SIZE_OPTIONS = [20, 50, 100];

const selectClass =
  'h-9 rounded-[10px] border border-border bg-white px-3 text-sm text-foreground outline-none focus-visible:border-[color:var(--ring)]';

const initialProduceForm = { key: '', value: '', headers: '', partition: '' };

const messageKey = (message: KafkaMessage) => `${message.partition}-${message.offset}`;

export default function TopicData({ connectionId, connectionName, topicName }: TopicDataProps) {
  const [messages, setMessages] = useState<KafkaMessage[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<RefreshInterval>(10);
  const [produceModalOpen, setProduceModalOpen] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [produceForm, setProduceForm] = useState(initialProduceForm);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  // Filter state
  const [filter, setFilter] = useState<DataFilter>({
    start_from: { type: 'last_n', count: 100 },
  });

  const fetchData = useCallback(async () => {
    try {
      const data = await topicApi.fetchMessages(connectionId, topicName, filter);
      setMessages(data);
    } catch (error) {
      toast.error(`加载消息失败: ${String(error)}`);
    } finally {
      setInitialLoading(false);
    }
  }, [connectionId, topicName, filter]);

  const { loading, lastRefreshed, refresh } = useAutoRefresh(fetchData, {
    enabled: autoRefreshEnabled,
    intervalSecs: refreshInterval,
  });

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(0);
  }, [filter, pageSize]);

  const handleProduce = async () => {
    if (!produceForm.value.trim()) {
      toast.error('请输入消息内容');
      return;
    }

    try {
      const headers: Record<string, string> = {};
      if (produceForm.headers.trim()) {
        try {
          Object.assign(headers, JSON.parse(produceForm.headers));
        } catch {
          // ignore parse errors
        }
      }
      await topicApi.produceMessage({
        connection_id: connectionId,
        topic: topicName,
        key: produceForm.key || undefined,
        value: produceForm.value,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        partition: produceForm.partition !== '' ? Number(produceForm.partition) : undefined,
      });
      toast.success('消息已发送');
      setProduceModalOpen(false);
      setProduceForm(initialProduceForm);
      void refresh();
    } catch (error) {
      toast.error(`发送失败: ${String(error)}`);
    }
  };

  const handleProduceOpenChange = (open: boolean) => {
    setProduceModalOpen(open);
    if (!open) {
      setProduceForm(initialProduceForm);
    }
  };

  const toggleExpanded = (key: string) => {
    setExpandedRows((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const totalPages = Math.max(1, Math.ceil(messages.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pagedMessages = messages.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  const startFromCount = filter.start_from.type === 'last_n' ? filter.start_from.count : 0;

  return (
    <section className="space-y-6">
      <div className="rounded-[12px] bg-signature-peach/35 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-foreground">
            <TableProperties className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted">Topic Data</p>
            <h2 className="mt-2 text-2xl font-medium text-foreground">{topicName}</h2>
            <p className="mt-2 text-sm leading-6 text-body">
              当前连接: {connectionName} · {connectionId}
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-border bg-white px-4 py-3">
        <RefreshButton loading={loading} onRefresh={() => void refresh()} />
        <Button onClick={() => setProduceModalOpen(true)} size="sm" variant="outline">
          <Send className="h-4 w-4" />
          写入数据
        </Button>
        <Button
          onClick={() => setFilterVisible((visible) => !visible)}
          size="sm"
          variant={filterVisible ? 'default' : 'outline'}
        >
          <Filter className="h-4 w-4" />
          筛选
        </Button>

        <AutoRefreshControls
          className="ml-auto"
          enabled={autoRefreshEnabled}
          intervalSecs={refreshInterval}
          lastRefreshed={lastRefreshed}
          onEnabledChange={setAutoRefreshEnabled}
          onIntervalChange={setRefreshInterval}
        >
          <Badge>{messages.length} 条消息</Badge>
        </AutoRefreshControls>
      </div>

      {/* Filter panel */}
      {filterVisible ? (
        <div className="flex flex-wrap items-center gap-4 rounded-[12px] border border-border bg-surface-soft px-4 py-4 text-sm text-body">
          <div className="flex items-center gap-2">
            <span className="text-muted">起点:</span>
            <select
              className={selectClass}
              onChange={(event) => {
                const nextType = event.target.value as DataFilter['start_from']['type'];
                if (nextType === 'last_n') {
                  setFilter((previous) => ({ ...previous, start_from: { type: 'last_n', count: 100 } }));
                } else {
                  setFilter((previous) => ({
                    ...previous,
                    start_from: { type: nextType } as DataFilter['start_from'],
                  }));
                }
              }}
              value={filter.start_from.type}
            >
              {START_FROM_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {filter.start_from.type === 'last_n' ? (
              <Input
                className="h-9 w-20 rounded-[10px] px-3"
                min={1}
                onChange={(event) =>
                  setFilter((previous) => ({
                    ...previous,
                    start_from: { type: 'last_n', count: Number(event.target.value) || 100 },
                  }))
                }
                type="number"
                value={startFromCount}
              />
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted">Key 筛选:</span>
            <select
              className={selectClass}
              onChange={(event) => {
                const mode = event.target.value as FilterMode | '';
                setFilter((previous) => ({
                  ...previous,
                  key_filter: mode
                    ? { mode, value: previous.key_filter?.value ?? '' }
                    : undefined,
                }));
              }}
              value={filter.key_filter?.mode ?? ''}
            >
              <option value="">全部</option>
              {FILTER_MODES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {filter.key_filter ? (
              <Input
                className="h-9 w-32 rounded-[10px] px-3"
                onChange={(event) =>
                  setFilter((previous) => ({
                    ...previous,
                    key_filter: { mode: previous.key_filter!.mode, value: event.target.value },
                  }))
                }
                placeholder="值"
                value={filter.key_filter.value}
              />
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted">Value 筛选:</span>
            <select
              className={selectClass}
              onChange={(event) => {
                const mode = event.target.value as FilterMode | '';
                setFilter((previous) => ({
                  ...previous,
                  value_filter: mode
                    ? { mode, value: previous.value_filter?.value ?? '' }
                    : undefined,
                }));
              }}
              value={filter.value_filter?.mode ?? ''}
            >
              <option value="">全部</option>
              {FILTER_MODES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {filter.value_filter ? (
              <Input
                className="h-9 w-32 rounded-[10px] px-3"
                onChange={(event) =>
                  setFilter((previous) => ({
                    ...previous,
                    value_filter: { mode: previous.value_filter!.mode, value: event.target.value },
                  }))
                }
                placeholder="值"
                value={filter.value_filter.value}
              />
            ) : null}
          </div>

          <Button onClick={() => void refresh()} size="sm">
            应用
          </Button>
        </div>
      ) : null}

      {/* Messages table */}
      {initialLoading ? (
        <div className="space-y-2 rounded-[12px] border border-border bg-white p-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div className="h-8 animate-pulse rounded-[6px] bg-surface-soft" key={index} />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[12px] border border-border bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="bg-surface-soft">
                <tr>
                  <th className="w-10 px-4 py-3" />
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-muted">分区</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-muted">偏移量</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-muted">时间</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-muted">Key</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-muted">Value</th>
                </tr>
              </thead>
              <tbody>
                {pagedMessages.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center text-sm text-body" colSpan={6}>
                      暂无消息
                    </td>
                  </tr>
                ) : (
                  pagedMessages.map((message) => {
                    const key = messageKey(message);
                    const isExpanded = expandedRows.has(key);

                    return (
                      <Fragment key={key}>
                        <tr className="border-t border-border">
                          <td className="px-4 py-3">
                            <button
                              aria-label={isExpanded ? '收起详情' : '展开详情'}
                              className="rounded-[6px] p-1 text-muted transition-colors hover:bg-surface-soft hover:text-foreground"
                              onClick={() => toggleExpanded(key)}
                              type="button"
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground">{message.partition}</td>
                          <td className="px-4 py-3 text-sm text-foreground">{message.offset}</td>
                          <td className="px-4 py-3 text-sm text-body">
                            {message.timestamp ? new Date(message.timestamp).toLocaleString() : '-'}
                          </td>
                          <td className="max-w-[12rem] truncate px-4 py-3 text-sm text-body">
                            {message.key ?? <span className="text-muted">null</span>}
                          </td>
                          <td className="max-w-[22rem] truncate px-4 py-3 text-sm text-body">
                            {message.value ?? <span className="text-muted">null</span>}
                          </td>
                        </tr>
                        {isExpanded ? (
                          <tr className="border-t border-border bg-surface-soft">
                            <td className="px-4 py-4" colSpan={6}>
                              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Value</p>
                              <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-all rounded-[6px] border border-border bg-white p-3 text-xs leading-5 text-body">
                                {message.value}
                              </pre>
                              {message.headers && Object.keys(message.headers).length > 0 ? (
                                <>
                                  <p className="mt-4 text-xs font-medium uppercase tracking-[0.18em] text-muted">
                                    Headers
                                  </p>
                                  <pre className="mt-2 overflow-auto rounded-[6px] border border-border bg-white p-3 text-xs leading-5 text-body">
                                    {JSON.stringify(message.headers, null, 2)}
                                  </pre>
                                </>
                              ) : null}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3 text-sm text-body">
            <span>
              第 {currentPage + 1} / {totalPages} 页 · 共 {messages.length} 条
            </span>
            <div className="ml-auto flex items-center gap-2">
              <select
                className={selectClass}
                onChange={(event) => setPageSize(Number(event.target.value))}
                value={pageSize}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size} 条/页
                  </option>
                ))}
              </select>
              <Button
                disabled={currentPage === 0}
                onClick={() => setPage((previous) => Math.max(0, previous - 1))}
                size="sm"
                variant="outline"
              >
                上一页
              </Button>
              <Button
                disabled={currentPage >= totalPages - 1}
                onClick={() => setPage((previous) => Math.min(totalPages - 1, previous + 1))}
                size="sm"
                variant="outline"
              >
                下一页
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Produce message dialog */}
      <Dialog onOpenChange={handleProduceOpenChange} open={produceModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>写入数据 · {topicName}</DialogTitle>
            <DialogDescription>向当前主题发送一条消息，Headers 需为 JSON 对象。</DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm text-foreground" htmlFor="produce-key">
                Key
              </label>
              <Input
                id="produce-key"
                onChange={(event) => setProduceForm((previous) => ({ ...previous, key: event.target.value }))}
                placeholder="消息键（可选）"
                value={produceForm.key}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-foreground" htmlFor="produce-value">
                Value
              </label>
              <textarea
                className="flex min-h-[8rem] w-full rounded-[10px] border border-border bg-white px-4 py-2 text-sm text-foreground outline-none placeholder:text-placeholder focus-visible:border-[color:var(--ring)] focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]/20"
                id="produce-value"
                onChange={(event) => setProduceForm((previous) => ({ ...previous, value: event.target.value }))}
                placeholder="消息内容"
                value={produceForm.value}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-foreground" htmlFor="produce-headers">
                Headers (JSON)
              </label>
              <textarea
                className="flex min-h-[4.5rem] w-full rounded-[10px] border border-border bg-white px-4 py-2 text-sm text-foreground outline-none placeholder:text-placeholder focus-visible:border-[color:var(--ring)] focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]/20"
                id="produce-headers"
                onChange={(event) => setProduceForm((previous) => ({ ...previous, headers: event.target.value }))}
                placeholder='{"key": "value"}'
                value={produceForm.headers}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-foreground" htmlFor="produce-partition">
                分区（可选）
              </label>
              <Input
                id="produce-partition"
                onChange={(event) => setProduceForm((previous) => ({ ...previous, partition: event.target.value }))}
                placeholder="自动分配"
                type="number"
                value={produceForm.partition}
              />
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => handleProduceOpenChange(false)} variant="outline">
              取消
            </Button>
            <Button onClick={() => void handleProduce()}>发送</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}