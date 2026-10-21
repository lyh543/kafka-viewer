import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Database,
  Eye,
  FolderTree,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  TableProperties,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import * as consumerGroupApi from '@/api/consumer-group';
import * as topicApi from '@/api/topic';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTabNavigation } from '@/hooks/useTabNavigation';
import { useConnectionStore } from '@/stores/connection';
import { notifyError } from '@/utils/notify';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

type ContextItem = {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
};

function TruncatedLabel({ text, className }: { text: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={className ? `${className} truncate` : 'truncate'}>{text}</span>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const connections = useConnectionStore((state) => state.connections);
  const topicsByConnection = useConnectionStore((state) => state.topicsByConnection);
  const consumerGroupsByConnection = useConnectionStore((state) => state.consumerGroupsByConnection);
  const setTopics = useConnectionStore((state) => state.setTopics);
  const setConsumerGroups = useConnectionStore((state) => state.setConsumerGroups);
  const { openConsumerGroupStatus, openTopicData, openTopicStatus } = useTabNavigation();
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [topicsLoading, setTopicsLoading] = useState<Record<string, boolean>>({});
  const [consumerGroupsLoading, setConsumerGroupsLoading] = useState<Record<string, boolean>>({});
  const [contextMenu, setContextMenu] = useState<{
    key: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    window.addEventListener('contextmenu', closeMenu);

    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('contextmenu', closeMenu);
    };
  }, [contextMenu]);

  const copyText = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label}已复制`);
    } catch (error) {
      notifyError(`复制失败: ${String(error)}`, error, 'sidebar');
    }
  }, []);

  const loadTopics = useCallback(
    async (connectionId: string, force = false) => {
      if (topicsLoading[connectionId]) {
        return;
      }

      if (!force && topicsByConnection[connectionId] !== undefined) {
        return;
      }

      setTopicsLoading((state) => ({ ...state, [connectionId]: true }));

      try {
        const topics = await topicApi.listTopics(connectionId);
        setTopics(connectionId, topics);
      } catch (error) {
        notifyError(`加载主题列表失败: ${String(error)}`, error, 'sidebar');
      } finally {
        setTopicsLoading((state) => ({ ...state, [connectionId]: false }));
      }
    },
    [setTopics, topicsByConnection, topicsLoading]
  );

  const loadConsumerGroups = useCallback(
    async (connectionId: string, force = false) => {
      if (consumerGroupsLoading[connectionId]) {
        return;
      }

      if (!force && consumerGroupsByConnection[connectionId] !== undefined) {
        return;
      }

      setConsumerGroupsLoading((state) => ({ ...state, [connectionId]: true }));

      try {
        const groups = await consumerGroupApi.listConsumerGroups(connectionId);
        setConsumerGroups(connectionId, groups);
      } catch (error) {
        notifyError(`加载消费者组列表失败: ${String(error)}`, error, 'sidebar');
      } finally {
        setConsumerGroupsLoading((state) => ({ ...state, [connectionId]: false }));
      }
    },
    [consumerGroupsByConnection, consumerGroupsLoading, setConsumerGroups]
  );

  const toggleExpanded = async (key: string) => {
    const nextExpanded = !expandedKeys[key];
    setExpandedKeys((state) => ({ ...state, [key]: nextExpanded }));

    if (!nextExpanded) {
      return;
    }

    const parts = key.split('::');
    const connectionId = parts[1];

    if (!connectionId) {
      return;
    }

    if (parts[2] === 'topics') {
      await loadTopics(connectionId);
    }

    if (parts[2] === 'consumer-groups') {
      await loadConsumerGroups(connectionId);
    }
  };

  const refreshAllLoaded = async () => {
    await Promise.all(
      connections.flatMap((connection) => [
        loadTopics(connection.id, true),
        loadConsumerGroups(connection.id, true),
      ])
    );
  };

  const contextItems = useMemo<ContextItem[]>(() => {
    if (!contextMenu) {
      return [];
    }

    const parts = contextMenu.key.split('::');
    const connectionId = parts[1];
    const connection = connections.find((item) => item.id === connectionId);

    if (parts.length === 2 && parts[0] === 'conn') {
      return [
        {
          label: '刷新',
          icon: <RefreshCw className="h-3.5 w-3.5" />,
          onClick: () => {
            void loadTopics(connectionId, true);
            void loadConsumerGroups(connectionId, true);
          },
        },
        {
          label: '复制连接信息',
          icon: <Copy className="h-3.5 w-3.5" />,
          onClick: () => {
            if (connection) {
              void copyText(`${connection.name} ${connection.brokers}`, '连接信息');
            }
          },
        },
      ];
    }

    if (parts[2] === 'topics') {
      return [
        {
          label: '刷新主题列表',
          icon: <RefreshCw className="h-3.5 w-3.5" />,
          onClick: () => {
            void loadTopics(connectionId, true);
          },
        },
      ];
    }

    if (parts[2] === 'topic') {
      const topicName = parts[3];

      return [
        {
          label: '查看详情',
          icon: <Eye className="h-3.5 w-3.5" />,
          onClick: () => openTopicStatus(connectionId, connection?.name ?? '', topicName),
        },
        {
          label: '查看数据',
          icon: <TableProperties className="h-3.5 w-3.5" />,
          onClick: () => openTopicData(connectionId, connection?.name ?? '', topicName),
        },
        {
          label: '复制主题名',
          icon: <Copy className="h-3.5 w-3.5" />,
          onClick: () => {
            void copyText(topicName, '主题名');
          },
        },
      ];
    }

    if (parts[2] === 'consumer-groups') {
      return [
        {
          label: '刷新消费者组列表',
          icon: <RefreshCw className="h-3.5 w-3.5" />,
          onClick: () => {
            void loadConsumerGroups(connectionId, true);
          },
        },
      ];
    }

    if (parts[2] === 'consumer-group') {
      const groupId = parts[3];

      return [
        {
          label: '查看详情',
          icon: <Eye className="h-3.5 w-3.5" />,
          onClick: () => openConsumerGroupStatus(connectionId, connection?.name ?? '', groupId),
        },
        {
          label: '复制消费者组名',
          icon: <Copy className="h-3.5 w-3.5" />,
          onClick: () => {
            void copyText(groupId, '消费者组名');
          },
        },
      ];
    }

    return [];
  }, [
    connections,
    contextMenu,
    copyText,
    loadConsumerGroups,
    loadTopics,
    openConsumerGroupStatus,
    openTopicData,
    openTopicStatus,
  ]);

  const renderLeaf = (
    key: string,
    label: string,
    icon: React.ReactNode,
    onOpen: () => void,
    onOpenData?: () => void
  ) => (
    <button
      className="flex w-full items-center gap-1 rounded-[4px] px-1.5 py-0 text-left font-light leading-4 text-foreground transition-colors hover:bg-surface-soft"
      key={key}
      onClick={onOpen}
      onContextMenu={(event) => {
        event.preventDefault();
        setContextMenu({ key, x: event.clientX, y: event.clientY });
      }}
      onDoubleClick={onOpenData}
      type="button"
    >
      <span className="shrink-0 text-muted">{icon}</span>
      <TruncatedLabel className="min-w-0 flex-1 text-left text-[14px] font-light text-muted" text={label} />
    </button>
  );

  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center gap-3 p-1.5">
        <Button onClick={onToggle} size="icon" variant="ghost">
          <PanelLeftOpen className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
        <div>
          <p className="text-[16px] uppercase tracking-[0.1em] text-muted">Connections</p>
        </div>
        <div className="flex items-center gap-0.5">
          <Button onClick={() => void refreshAllLoaded()} size="icon" variant="ghost">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button onClick={onToggle} size="icon" variant="ghost">
            <PanelLeftClose className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-1.5 overflow-auto p-1.5">
        {connections.length === 0 ? (
          <div className="rounded-[6px] border border-dashed border-border-strong bg-surface-soft px-2 py-3 text-xs leading-5 text-body">
            暂无连接。打开连接管理器创建或选择一条连接后，再回来浏览主题与消费者组。
          </div>
        ) : (
          connections.map((connection) => {
            const connectionKey = `conn::${connection.id}`;
            const topicsKey = `conn::${connection.id}::topics`;
            const groupsKey = `conn::${connection.id}::consumer-groups`;
            const isConnectionExpanded = expandedKeys[connectionKey] ?? true;
            const isTopicsExpanded = expandedKeys[topicsKey] ?? false;
            const isGroupsExpanded = expandedKeys[groupsKey] ?? false;

            return (
              <div className="rounded-[6px] border border-border bg-white" key={connection.id}>
                <button
                  className="flex w-full items-start gap-1.5 px-1.5 py-1 text-left"
                  onClick={() => void toggleExpanded(connectionKey)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setContextMenu({ key: connectionKey, x: event.clientX, y: event.clientY });
                  }}
                  type="button"
                >
                  <span className="mt-0.5 shrink-0 text-muted">
                    {isConnectionExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </span>
                  <span className="mt-0.5 shrink-0 text-muted">
                    <Database className="h-3 w-3" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <TruncatedLabel className="block text-[14px] leading-4 text-foreground" text={connection.name} />
                  </span>
                </button>

                {isConnectionExpanded ? (
                  <div className="space-y-0.5 px-1.5 pb-1.5">
                    <div className="pl-3">
                      <button
                        className="flex w-full items-center gap-1 rounded-[4px] px-1.5 py-0 text-left text-[11px] font-extralight leading-4 text-foreground transition-colors hover:bg-surface-soft"
                        onClick={() => void toggleExpanded(topicsKey)}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          setContextMenu({ key: topicsKey, x: event.clientX, y: event.clientY });
                        }}
                        type="button"
                      >
                        {isTopicsExpanded ? <ChevronDown className="h-3 w-3 text-muted" /> : <ChevronRight className="h-3 w-3 text-muted" />}
                        <FolderTree className="h-3 w-3 text-muted" />
                        <span className='text-[14px]'>主题</span>
                      </button>

                      {isTopicsExpanded ? (
                        <div className="mt-0 space-y-0 pl-4">
                          {topicsLoading[connection.id] && topicsByConnection[connection.id] === undefined ? (
                            <div className="rounded-[4px] bg-surface-soft px-1.5 py-0.5 text-[14px] text-muted">加载中...</div>
                          ) : (topicsByConnection[connection.id] ?? []).length > 0 ? (
                            (topicsByConnection[connection.id] ?? []).map((topic) =>
                              renderLeaf(
                                `conn::${connection.id}::topic::${topic}`,
                                topic,
                                <TableProperties className="h-3 w-3" />,
                                () => openTopicStatus(connection.id, connection.name, topic),
                                () => openTopicData(connection.id, connection.name, topic)
                              )
                            )
                          ) : (
                            <div className="rounded-[4px] bg-surface-soft px-1.5 py-0.5 text-[14px]-muted">暂无主题</div>
                          )}
                        </div>
                      ) : null}
                    </div>

                    <div className="pl-3">
                      <button
                        className="flex w-full items-center gap-1 rounded-[4px] px-1.5 py-0 text-left text-[11px] font-extralight leading-4 text-foreground transition-colors hover:bg-surface-soft"
                        onClick={() => void toggleExpanded(groupsKey)}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          setContextMenu({ key: groupsKey, x: event.clientX, y: event.clientY });
                        }}
                        type="button"
                      >
                        {isGroupsExpanded ? <ChevronDown className="h-3 w-3 text-muted" /> : <ChevronRight className="h-3 w-3 text-muted" />}
                        <Users className="h-3 w-3 text-muted" />
                        <span className='text-[14px]'>消费者组</span>
                      </button>

                      {isGroupsExpanded ? (
                        <div className="mt-0 space-y-0 pl-3">
                          {consumerGroupsLoading[connection.id] && consumerGroupsByConnection[connection.id] === undefined ? (
                            <div className="rounded-[4px] bg-surface-soft px-1.5 py-0.5 text-[11px] text-muted">加载中...</div>
                          ) : (consumerGroupsByConnection[connection.id] ?? []).length > 0 ? (
                            (consumerGroupsByConnection[connection.id] ?? []).map((group) =>
                              renderLeaf(
                                `conn::${connection.id}::consumer-group::${group}`,
                                group,
                                <Eye className="h-3 w-3" />,
                                () => openConsumerGroupStatus(connection.id, connection.name, group),
                                () => openConsumerGroupStatus(connection.id, connection.name, group)
                              )
                            )
                          ) : (
                            <div className="rounded-[4px] bg-surface-soft px-1.5 py-0.5 text-[11px] text-muted">暂无消费者组</div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {contextMenu && contextItems.length > 0 ? (
        <div
          className="fixed z-50 min-w-40 rounded-[6px] border border-border bg-white p-1 shadow-[0_16px_48px_rgba(24,29,38,0.16)]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextItems.map((item) => (
            <button
              className="flex w-full items-center gap-2 rounded-[4px] px-2 py-1 text-left text-xs text-foreground transition-colors hover:bg-surface-soft"
              key={item.label}
              onClick={() => {
                setContextMenu(null);
                item.onClick();
              }}
              type="button"
            >
              {item.icon ? <span className="text-muted">{item.icon}</span> : null}
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}