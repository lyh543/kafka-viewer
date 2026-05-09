// Topic types
export interface TopicInfo {
  name: string;
  partitions: number;
  replication_factor: number;
  configs: Record<string, string>;
}

export interface TopicStatus {
  info: TopicInfo;
  partitions: PartitionStatus[];
}

export interface PartitionStatus {
  partition: number;
  leader: number;
  replicas: number[];
  isr: number[];
  beginning_offset: number;
  end_offset: number;
}

export interface KafkaMessage {
  topic: string;
  partition: number;
  offset: number;
  key: string | null;
  value: string | null;
  headers: Record<string, string>;
  timestamp: number;
}

export interface DataFilter {
  key_type?: string;
  value_type?: string;
  key_filter?: { mode: 'equals' | 'not_equals' | 'contains' | 'regex'; value: string };
  value_filter?: { mode: 'equals' | 'not_equals' | 'contains' | 'regex'; value: string };
  start_from: StartFrom;
  limit?: DataLimit;
}

export type StartFrom =
  | { type: 'latest' }
  | { type: 'beginning' }
  | { type: 'last_n'; count: number }
  | { type: 'timestamp'; ts: number }
  | { type: 'consumer_group'; group_id: string };

export type DataLimit =
  | { type: 'count'; value: number }
  | { type: 'timestamp'; ts: number }
  | { type: 'size_mb'; value: number };

export interface ProduceMessageRequest {
  connection_id: string;
  topic: string;
  key?: string;
  value: string;
  headers?: Record<string, string>;
  partition?: number;
}
