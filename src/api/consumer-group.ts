import { invoke } from '@tauri-apps/api/core';
import type { ConsumerGroupInfo } from '../types/consumer-group';

export async function listConsumerGroups(connectionId: string): Promise<string[]> {
  return invoke('list_consumer_groups', { connectionId });
}

export async function getConsumerGroupStatus(
  connectionId: string,
  groupId: string
): Promise<ConsumerGroupInfo> {
  return invoke('get_consumer_group_status', { connectionId, groupId });
}

export async function resetConsumerGroupOffsets(
  connectionId: string,
  groupId: string,
  topic: string,
  offsets: Record<number, number>
): Promise<void> {
  return invoke('reset_consumer_group_offsets', { connectionId, groupId, topic, offsets });
}
