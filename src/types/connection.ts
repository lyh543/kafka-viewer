// Connection types
export interface KafkaConnection {
  id: string;
  name: string;
  brokers: string;
  auth: AuthConfig;
  created_at: string;
  updated_at: string;
}

export interface AuthConfig {
  type: 'none' | 'sasl_plain' | 'sasl_scram_256' | 'sasl_scram_512' | 'ssl';
  username?: string;
  password?: string;
  ssl_ca_path?: string;
  ssl_cert_path?: string;
  ssl_key_path?: string;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  ping_ms?: number;
  broker_count?: number;
  topic_count?: number;
  partition_count?: number;
  brokers?: Array<{
    id: number;
    host: string;
    port: number;
  }>;
}

export interface TestConnectionProgress {
  request_id: number;
  connection_id: string;
  step: 'starting' | 'measuring_ping' | 'creating_consumer' | 'fetching_metadata' | 'processing_metadata' | 'completed' | 'failed';
  message: string;
}
