import { useEffect, useCallback } from 'react';
import { Tree, Button, Dropdown, message } from 'antd';
import type { MenuProps } from 'antd';
import {
  DatabaseOutlined,
  UnorderedListOutlined,
  TeamOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useConnectionStore } from '../../stores/connection';
import { useTabNavigation } from '../../hooks/useTabNavigation';
import * as topicApi from '../../api/topic';
import * as consumerGroupApi from '../../api/consumer-group';
import type { DataTreeNode } from './types';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const connections = useConnectionStore((s) => s.connections);
  const topicsByConnection = useConnectionStore((s) => s.topicsByConnection);
  const consumerGroupsByConnection = useConnectionStore((s) => s.consumerGroupsByConnection);
  const setTopics = useConnectionStore((s) => s.setTopics);
  const setConsumerGroups = useConnectionStore((s) => s.setConsumerGroups);
  const { openTopicStatus, openConsumerGroupStatus } = useTabNavigation();

  const loadTopics = useCallback(
    async (connectionId: string) => {
      try {
        const topics = await topicApi.listTopics(connectionId);
        setTopics(connectionId, topics);
      } catch (e) {
        message.error(`加载主题列表失败: ${e}`);
      }
    },
    [setTopics]
  );

  const loadConsumerGroups = useCallback(
    async (connectionId: string) => {
      try {
        const groups = await consumerGroupApi.listConsumerGroups(connectionId);
        setConsumerGroups(connectionId, groups);
      } catch (e) {
        message.error(`加载消费者组列表失败: ${e}`);
      }
    },
    [setConsumerGroups]
  );

  useEffect(() => {
    connections.forEach((conn) => {
      if (!topicsByConnection[conn.id]) loadTopics(conn.id);
      if (!consumerGroupsByConnection[conn.id]) loadConsumerGroups(conn.id);
    });
  }, [connections, topicsByConnection, consumerGroupsByConnection, loadTopics, loadConsumerGroups]);

  const buildTreeData = (): DataTreeNode[] => {
    return connections.map((conn) => ({
      key: `conn::${conn.id}`,
      title: conn.name,
      icon: <DatabaseOutlined />,
      children: [
        {
          key: `conn::${conn.id}::topics`,
          title: '主题',
          icon: <UnorderedListOutlined />,
          children: (topicsByConnection[conn.id] || []).map((topic) => ({
            key: `conn::${conn.id}::topic::${topic}`,
            title: topic,
            isLeaf: true,
          })),
        },
        {
          key: `conn::${conn.id}::consumer-groups`,
          title: '消费者组',
          icon: <TeamOutlined />,
          children: (consumerGroupsByConnection[conn.id] || []).map((group) => ({
            key: `conn::${conn.id}::consumer-group::${group}`,
            title: group,
            isLeaf: true,
          })),
        },
      ],
    }));
  };

  const getContextMenu = (nodeKey: string): MenuProps['items'] => {
    const parts = nodeKey.split('::');

    if (parts.length === 2 && parts[0] === 'conn') {
      // Connection node
      return [
        { key: 'refresh', label: '刷新', icon: <ReloadOutlined />, onClick: () => {
          loadTopics(parts[1]);
          loadConsumerGroups(parts[1]);
        }},
        { key: 'edit', label: '编辑连接' },
        { key: 'remove', label: '移除连接', danger: true },
      ];
    }

    if (parts[2] === 'topics') {
      return [
        { key: 'refresh', label: '刷新主题列表', icon: <ReloadOutlined />, onClick: () => loadTopics(parts[1]) },
        { key: 'create', label: '创建主题' },
      ];
    }

    if (parts[2] === 'topic') {
      const conn = connections.find((c) => c.id === parts[1]);
      return [
        { key: 'view-status', label: '查看主题状态', onClick: () => openTopicStatus(parts[1], conn?.name || '', parts[3]) },
        { key: 'view-data', label: '查看主题数据' },
      ];
    }

    if (parts[2] === 'consumer-groups') {
      return [
        { key: 'refresh', label: '刷新消费者组列表', icon: <ReloadOutlined />, onClick: () => loadConsumerGroups(parts[1]) },
      ];
    }

    if (parts[2] === 'consumer-group') {
      const conn = connections.find((c) => c.id === parts[1]);
      return [
        { key: 'view-status', label: '查看消费者组状态', onClick: () => openConsumerGroupStatus(parts[1], conn?.name || '', parts[3]) },
        { key: 'reset-offsets', label: '重置偏移量' },
      ];
    }

    return [];
  };

  const handleDoubleClick = (_e: React.MouseEvent, node: { key: string }) => {
    const key = node.key as string;
    const parts = key.split('::');
    if (parts[2] === 'topic' && parts[3]) {
      const conn = connections.find((c) => c.id === parts[1]);
      openTopicStatus(parts[1], conn?.name || '', parts[3]);
    } else if (parts[2] === 'consumer-group' && parts[3]) {
      const conn = connections.find((c) => c.id === parts[1]);
      openConsumerGroupStatus(parts[1], conn?.name || '', parts[3]);
    }
  };

  if (collapsed) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 8 }}>
        <Button
          type="text"
          size="small"
          icon={<MenuUnfoldOutlined />}
          onClick={onToggle}
        />
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '4px 8px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <Button type="text" size="small" icon={<MenuFoldOutlined />} onClick={onToggle} />
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
        {connections.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: '#999', fontSize: 13 }}>
            暂无连接，请在"文件 → 管理连接"中添加
          </div>
        ) : (
          <Tree
            className="sidebar-tree"
            showIcon
            treeData={buildTreeData()}
            onDoubleClick={handleDoubleClick as never}
            titleRender={(node) => {
              const menuItems = getContextMenu(node.key as string);
              if (!menuItems?.length) return <span>{node.title as string}</span>;
              return (
                <Dropdown menu={{ items: menuItems }} trigger={['contextMenu']}>
                  <span>{node.title as string}</span>
                </Dropdown>
              );
            }}
          />
        )}
      </div>
    </div>
  );
}
