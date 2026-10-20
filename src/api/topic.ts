import type { TopicStatus, KafkaMessage, DataFilter, ProduceMessageRequest } from '../types/topic';
import { invokeLogged } from '../utils/logger';

export async function listTopics(connectionId: string): Promise<string[]> {
  return invokeLogged('list_topics', { connectionId });
}

export async function getTopicStatus(connectionId: string, topic: string): Promise<TopicStatus> {
  return invokeLogged('get_topic_status', { connectionId, topic });
}

export async function createTopic(
  connectionId: string,
  name: string,
  partitions: number,
  replicationFactor: number
): Promise<void> {
  return invokeLogged('create_topic', { connectionId, name, partitions, replicationFactor });
}

export async function deleteTopic(connectionId: string, topic: string): Promise<void> {
  return invokeLogged('delete_topic', { connectionId, topic });
}

export async function fetchMessages(
  connectionId: string,
  topic: string,
  filter: DataFilter
): Promise<KafkaMessage[]> {
  return invokeLogged('fetch_messages', { connectionId, topic, filter });
}

export async function produceMessage(request: ProduceMessageRequest): Promise<void> {
  return invokeLogged('produce_message', { request });
}
