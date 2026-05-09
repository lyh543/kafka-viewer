import { invoke } from '@tauri-apps/api/core';
import type { KafkaConnection, TestConnectionResult } from '../types/connection';

export async function getConnections(): Promise<KafkaConnection[]> {
  return invoke('get_connections');
}

export async function saveConnection(connection: KafkaConnection): Promise<KafkaConnection> {
  return invoke('save_connection', { connection });
}

export async function deleteConnection(id: string): Promise<void> {
  return invoke('delete_connection', { id });
}

export async function testConnection(connection: KafkaConnection): Promise<TestConnectionResult> {
  return invoke('test_connection', { connection });
}
