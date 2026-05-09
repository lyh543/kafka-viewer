import { invoke } from '@tauri-apps/api/core';
import type { TopicStatus, KafkaMessage, DataFilter, ProduceMessageRequest } from '../types/topic';

export async function listTopics(connectionId: string): Promise<string[]> {
  return invoke('list_topics', { connectionId });
}

export async function getTopicStatus(connectionId: string, topic: string): Promise<TopicStatus> {
  return invoke('get_topic_status', { connectionId, topic });
}

export async function createTopic(
  connectionId: string,
  name: string,
  partitions: number,
  replicationFactor: number
): Promise<void> {
  return invoke('create_topic', { connectionId, name, partitions, replicationFactor });
}

export async function deleteTopic(connectionId: string, topic: string): Promise<void> {
  return invoke('delete_topic', { connectionId, topic });
}

export async function fetchMessages(
  connectionId: string,
  topic: string,
  filter: DataFilter
): Promise<KafkaMessage[]> {
  return invoke('fetch_messages', { connectionId, topic, filter });
}

export async function produceMessage(request: ProduceMessageRequest): Promise<void> {
  return invoke('produce_message', { request });
}
