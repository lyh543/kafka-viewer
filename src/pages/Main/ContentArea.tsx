import { Tabs, Empty } from 'antd';
import { useTabsStore } from '../../stores/tabs';
import TopicStatus from '../TopicStatus';
import TopicData from '../TopicData';
import ConsumerGroupStatus from '../ConsumerGroupStatus';

export default function ContentArea() {
  const tabs = useTabsStore((s) => s.tabs);
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const setActiveTab = useTabsStore((s) => s.setActiveTab);
  const removeTab = useTabsStore((s) => s.removeTab);

  if (tabs.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Empty description="双击左侧主题或消费者组以打开标签页" />
      </div>
    );
  }

  const renderTabContent = (tab: (typeof tabs)[0]) => {
    switch (tab.type) {
      case 'topic_status':
        return (
          <TopicStatus
            connectionId={tab.connectionId}
            connectionName={tab.connectionName}
            topicName={tab.resourceName}
          />
        );
      case 'topic_data':
        return (
          <TopicData
            connectionId={tab.connectionId}
            connectionName={tab.connectionName}
            topicName={tab.resourceName}
          />
        );
      case 'consumer_group_status':
        return (
          <ConsumerGroupStatus
            connectionId={tab.connectionId}
            connectionName={tab.connectionName}
            groupId={tab.resourceName}
          />
        );
    }
  };

  return (
    <Tabs
      className="content-tabs"
      type="editable-card"
      hideAdd
      activeKey={activeTabId || undefined}
      onChange={setActiveTab}
      onEdit={(key, action) => {
        if (action === 'remove') removeTab(key as string);
      }}
      style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
      items={tabs.map((tab) => ({
        key: tab.id,
        label: tab.title,
        children: (
          <div style={{ height: '100%', overflow: 'auto', padding: 12 }}>
            {renderTabContent(tab)}
          </div>
        ),
      }))}
    />
  );
}
