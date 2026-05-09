import { create } from 'zustand';
import type { KafkaConnection } from '../types/connection';

interface ConnectionStore {
  connections: KafkaConnection[];
  setConnections: (connections: KafkaConnection[]) => void;
  addConnection: (connection: KafkaConnection) => void;
  updateConnection: (connection: KafkaConnection) => void;
  removeConnection: (id: string) => void;

  // Tree data for sidebar
  topicsByConnection: Record<string, string[]>;
  consumerGroupsByConnection: Record<string, string[]>;
  setTopics: (connectionId: string, topics: string[]) => void;
  setConsumerGroups: (connectionId: string, groups: string[]) => void;
}

export const useConnectionStore = create<ConnectionStore>((set) => ({
  connections: [],
  topicsByConnection: {},
  consumerGroupsByConnection: {},

  setConnections: (connections) => set({ connections }),
  addConnection: (connection) =>
    set((s) => ({ connections: [...s.connections, connection] })),
  updateConnection: (connection) =>
    set((s) => ({
      connections: s.connections.map((c) => (c.id === connection.id ? connection : c)),
    })),
  removeConnection: (id) =>
    set((s) => ({ connections: s.connections.filter((c) => c.id !== id) })),
  setTopics: (connectionId, topics) =>
    set((s) => ({ topicsByConnection: { ...s.topicsByConnection, [connectionId]: topics } })),
  setConsumerGroups: (connectionId, groups) =>
    set((s) => ({
      consumerGroupsByConnection: { ...s.consumerGroupsByConnection, [connectionId]: groups },
    })),
}));
