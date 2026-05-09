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
  broker_count?: number;
}
