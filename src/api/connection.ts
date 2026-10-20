import type { KafkaConnection, TestConnectionResult } from '../types/connection';
import { invokeLogged } from '../utils/logger';

export async function getConnections(): Promise<KafkaConnection[]> {
  return invokeLogged('get_connections');
}

export async function saveConnection(connection: KafkaConnection): Promise<KafkaConnection> {
  return invokeLogged('save_connection', { connection });
}

export async function deleteConnection(id: string): Promise<void> {
  return invokeLogged('delete_connection', { id });
}

export async function testConnection(
  connection: KafkaConnection,
  requestId: number
): Promise<TestConnectionResult> {
  return invokeLogged('test_connection', { connection, requestId });
}
