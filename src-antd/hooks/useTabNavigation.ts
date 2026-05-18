import { useTabsStore } from '../stores/tabs';
import type { Tab } from '../stores/tabs';

export function useTabNavigation() {
  const openOrSwitchTab = useTabsStore((s) => s.openOrSwitchTab);

  const openTopicStatus = (connectionId: string, connectionName: string, topicName: string) => {
    const tab: Tab = {
      id: `${connectionId}::topic::${topicName}::status`,
      type: 'topic_status',
      connectionId,
      connectionName,
      title: `${topicName} - 状态`,
      resourceName: topicName,
    };
    openOrSwitchTab(tab);
  };

  const openTopicData = (connectionId: string, connectionName: string, topicName: string) => {
    const tab: Tab = {
      id: `${connectionId}::topic::${topicName}::data`,
      type: 'topic_data',
      connectionId,
      connectionName,
      title: `${topicName} - 数据`,
      resourceName: topicName,
    };
    openOrSwitchTab(tab);
  };

  const openConsumerGroupStatus = (
    connectionId: string,
    connectionName: string,
    groupId: string
  ) => {
    const tab: Tab = {
      id: `${connectionId}::consumer_group::${groupId}::status`,
      type: 'consumer_group_status',
      connectionId,
      connectionName,
      title: `${groupId} - 状态`,
      resourceName: groupId,
    };
    openOrSwitchTab(tab);
  };

  return { openTopicStatus, openTopicData, openConsumerGroupStatus };
}
