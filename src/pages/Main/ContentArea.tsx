import { PanelTopOpen, X } from 'lucide-react';
import { useTabsStore } from '@/stores/tabs';
import ConsumerGroupStatus from '@/pages/ConsumerGroupStatus';
import TopicData from '@/pages/TopicData';
import TopicStatus from '@/pages/TopicStatus';

export default function ContentArea() {
  const tabs = useTabsStore((state) => state.tabs);
  const activeTabId = useTabsStore((state) => state.activeTabId);
  const setActiveTab = useTabsStore((state) => state.setActiveTab);
  const removeTab = useTabsStore((state) => state.removeTab);

  if (tabs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-white p-6">
        <div className="w-full max-w-3xl rounded-[12px] border border-dashed border-border-strong bg-surface-soft px-8 py-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-foreground">
            <PanelTopOpen className="h-5 w-5" />
          </div>
          <h2 className="mt-5 text-2xl font-normal text-foreground">双击左侧主题或消费者组以打开标签页</h2>
          <p className="mt-4 text-sm leading-6 text-body">
            侧栏树已经接回主导航流。打开资源后，内容区会在这里切换对应的数据面板。
          </p>
        </div>
      </div>
    );
  }

  const currentTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];

  const renderTabContent = () => {
    switch (currentTab.type) {
      case 'topic_status':
        return (
          <TopicStatus
            connectionId={currentTab.connectionId}
            connectionName={currentTab.connectionName}
            topicName={currentTab.resourceName}
          />
        );
      case 'topic_data':
        return (
          <TopicData
            connectionId={currentTab.connectionId}
            connectionName={currentTab.connectionName}
            topicName={currentTab.resourceName}
          />
        );
      case 'consumer_group_status':
        return (
          <ConsumerGroupStatus
            connectionId={currentTab.connectionId}
            connectionName={currentTab.connectionName}
            groupId={currentTab.resourceName}
          />
        );
    }
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center gap-2 overflow-x-auto border-b border-border px-3 py-2">
        {tabs.map((tab) => {
          const isActive = tab.id === currentTab.id;

          return (
            <button
              className={isActive
                ? 'flex items-center gap-2 rounded-[10px] border border-border bg-surface-soft px-3 py-2 text-sm text-foreground'
                : 'flex items-center gap-2 rounded-[10px] border border-transparent px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-soft hover:text-foreground'}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              <span className="truncate">{tab.title}</span>
              <span
                className="rounded-full p-0.5 transition-colors hover:bg-white"
                onClick={(event) => {
                  event.stopPropagation();
                  removeTab(tab.id);
                }}
                role="button"
                tabIndex={0}
              >
                <X className="h-3.5 w-3.5" />
              </span>
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">{renderTabContent()}</div>
    </div>
  );
}