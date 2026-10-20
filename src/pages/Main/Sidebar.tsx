import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
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
import { useTabNavigation } from '@/hooks/useTabNavigation';
import { useConnectionStore } from '@/stores/connection';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
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
        toast.error(`加载主题列表失败: ${String(error)}`);
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
        toast.error(`加载消费者组列表失败: ${String(error)}`);
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

  const contextItems = useMemo(() => {
    if (!contextMenu) {
      return [] as Array<{ label: string; onClick: () => void }>;
    }

    const parts = contextMenu.key.split('::');
    const connectionId = parts[1];
    const connection = connections.find((item) => item.id === connectionId);

    if (parts.length === 2 && parts[0] === 'conn') {
      return [
        {
          label: '刷新',
          onClick: () => {
            void loadTopics(connectionId, true);
            void loadConsumerGroups(connectionId, true);
          },
        },
      ];
    }

    if (parts[2] === 'topics') {
      return [
        {
          label: '刷新主题列表',
          onClick: () => {
            void loadTopics(connectionId, true);
          },
        },
      ];
    }

    if (parts[2] === 'topic') {
      return [
        {
          label: '查看主题状态',
          onClick: () => openTopicStatus(connectionId, connection?.name ?? '', parts[3]),
        },
        {
          label: '查看主题数据',
          onClick: () => openTopicData(connectionId, connection?.name ?? '', parts[3]),
        },
      ];
    }

    if (parts[2] === 'consumer-groups') {
      return [
        {
          label: '刷新消费者组列表',
          onClick: () => {
            void loadConsumerGroups(connectionId, true);
          },
        },
      ];
    }

    if (parts[2] === 'consumer-group') {
      return [
        {
          label: '查看消费者组状态',
          onClick: () => openConsumerGroupStatus(connectionId, connection?.name ?? '', parts[3]),
        },
      ];
    }

    return [];
  }, [connections, contextMenu, loadConsumerGroups, loadTopics, openConsumerGroupStatus, openTopicData, openTopicStatus]);

  const renderLeaf = (
    key: string,
    label: string,
    icon: React.ReactNode,
    onDoubleClick: () => void
  ) => (
    <button
      className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-surface-soft"
      onContextMenu={(event) => {
        event.preventDefault();
        setContextMenu({ key, x: event.clientX, y: event.clientY });
      }}
      onDoubleClick={onDoubleClick}
      type="button"
    >
      <span className="text-muted">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );

  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center gap-3 p-2">
        <Button onClick={onToggle} size="icon" variant="ghost">
          <PanelLeftOpen className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted">Navigator</p>
          <h2 className="mt-1 text-sm font-medium text-foreground">Connections</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button onClick={() => void refreshAllLoaded()} size="icon" variant="ghost">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={onToggle} size="icon" variant="ghost">
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-auto p-4">
        {connections.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-border-strong bg-surface-soft px-4 py-5 text-sm leading-6 text-body">
            暂无连接。下一步会把原来的树形导航和右键菜单迁过来。
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
              <div className="rounded-[12px] border border-border bg-white" key={connection.id}>
                <button
                  className="flex w-full items-start gap-3 px-4 py-3 text-left"
                  onClick={() => void toggleExpanded(connectionKey)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setContextMenu({ key: connectionKey, x: event.clientX, y: event.clientY });
                  }}
                  type="button"
                >
                  <span className="mt-0.5 text-muted">
                    {isConnectionExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </span>
                  <span className="mt-0.5 text-muted">
                    <Database className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{connection.name}</span>
                    <span className="mt-1 block truncate text-xs text-muted">{connection.brokers}</span>
                  </span>
                </button>

                {isConnectionExpanded ? (
                  <div className="space-y-1 px-3 pb-3">
                    <div className="pl-6">
                      <button
                        className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-surface-soft"
                        onClick={() => void toggleExpanded(topicsKey)}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          setContextMenu({ key: topicsKey, x: event.clientX, y: event.clientY });
                        }}
                        type="button"
                      >
                        {isTopicsExpanded ? <ChevronDown className="h-4 w-4 text-muted" /> : <ChevronRight className="h-4 w-4 text-muted" />}
                        <FolderTree className="h-4 w-4 text-muted" />
                        <span>主题</span>
                      </button>

                      {isTopicsExpanded ? (
                        <div className="mt-1 space-y-1 pl-6">
                          {topicsLoading[connection.id] && topicsByConnection[connection.id] === undefined ? (
                            <div className="rounded-[10px] bg-surface-soft px-3 py-2 text-sm text-muted">加载中...</div>
                          ) : (topicsByConnection[connection.id] ?? []).length > 0 ? (
                            (topicsByConnection[connection.id] ?? []).map((topic) =>
                              renderLeaf(
                                `conn::${connection.id}::topic::${topic}`,
                                topic,
                                <TableProperties className="h-4 w-4" />,
                                () => openTopicStatus(connection.id, connection.name, topic)
                              )
                            )
                          ) : (
                            <div className="rounded-[10px] bg-surface-soft px-3 py-2 text-sm text-muted">暂无主题</div>
                          )}
                        </div>
                      ) : null}
                    </div>

                    <div className="pl-6">
                      <button
                        className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-surface-soft"
                        onClick={() => void toggleExpanded(groupsKey)}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          setContextMenu({ key: groupsKey, x: event.clientX, y: event.clientY });
                        }}
                        type="button"
                      >
                        {isGroupsExpanded ? <ChevronDown className="h-4 w-4 text-muted" /> : <ChevronRight className="h-4 w-4 text-muted" />}
                        <Users className="h-4 w-4 text-muted" />
                        <span>消费者组</span>
                      </button>

                      {isGroupsExpanded ? (
                        <div className="mt-1 space-y-1 pl-6">
                          {consumerGroupsLoading[connection.id] && consumerGroupsByConnection[connection.id] === undefined ? (
                            <div className="rounded-[10px] bg-surface-soft px-3 py-2 text-sm text-muted">加载中...</div>
                          ) : (consumerGroupsByConnection[connection.id] ?? []).length > 0 ? (
                            (consumerGroupsByConnection[connection.id] ?? []).map((group) =>
                              renderLeaf(
                                `conn::${connection.id}::consumer-group::${group}`,
                                group,
                                <Eye className="h-4 w-4" />,
                                () => openConsumerGroupStatus(connection.id, connection.name, group)
                              )
                            )
                          ) : (
                            <div className="rounded-[10px] bg-surface-soft px-3 py-2 text-sm text-muted">暂无消费者组</div>
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
          className="fixed z-50 min-w-44 rounded-[12px] border border-border bg-white p-1 shadow-[0_24px_80px_rgba(24,29,38,0.16)]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextItems.map((item) => (
            <button
              className="flex w-full items-center rounded-[10px] px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-surface-soft"
              key={item.label}
              onClick={() => {
                setContextMenu(null);
                item.onClick();
              }}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}