import type { ConsumerGroupInfo } from '../types/consumer-group';
import { invokeLogged } from '../utils/logger';

export async function listConsumerGroups(connectionId: string): Promise<string[]> {
  return invokeLogged('list_consumer_groups', { connectionId });
}

export async function getConsumerGroupStatus(
  connectionId: string,
  groupId: string
): Promise<ConsumerGroupInfo> {
  return invokeLogged('get_consumer_group_status', { connectionId, groupId });
}

export async function resetConsumerGroupOffsets(
  connectionId: string,
  groupId: string,
  topic: string,
  offsets: Record<number, number>
): Promise<void> {
  return invokeLogged('reset_consumer_group_offsets', { connectionId, groupId, topic, offsets });
}
