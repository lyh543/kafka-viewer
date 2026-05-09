use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;

use rdkafka::admin::AdminClient;
use rdkafka::client::DefaultClientContext;
use rdkafka::config::ClientConfig;
use rdkafka::consumer::{BaseConsumer, DefaultConsumerContext, Consumer};

use crate::error::{AppError, AppResult};
use crate::project::config::ConnectionConfig;

pub struct KafkaClientManager {
    _placeholder: (),
}

impl KafkaClientManager {
    pub fn new() -> Self {
        Self { _placeholder: () }
    }

    fn build_config(conn: &ConnectionConfig) -> ClientConfig {
        let mut config = ClientConfig::new();
        config.set("bootstrap.servers", &conn.brokers);
        config.set("session.timeout.ms", "10000");
        config.set("enable.auto.commit", "false");

        match conn.auth.auth_type.as_str() {
            "sasl_plain" => {
                config.set("security.protocol", "SASL_PLAINTEXT");
                config.set("sasl.mechanism", "PLAIN");
                if let Some(ref u) = conn.auth.username {
                    config.set("sasl.username", u);
                }
                if let Some(ref p) = conn.auth.password {
                    config.set("sasl.password", p);
                }
            }
            "sasl_scram_256" => {
                config.set("security.protocol", "SASL_PLAINTEXT");
                config.set("sasl.mechanism", "SCRAM-SHA-256");
                if let Some(ref u) = conn.auth.username {
                    config.set("sasl.username", u);
                }
                if let Some(ref p) = conn.auth.password {
                    config.set("sasl.password", p);
                }
            }
            "sasl_scram_512" => {
                config.set("security.protocol", "SASL_PLAINTEXT");
                config.set("sasl.mechanism", "SCRAM-SHA-512");
                if let Some(ref u) = conn.auth.username {
                    config.set("sasl.username", u);
                }
                if let Some(ref p) = conn.auth.password {
                    config.set("sasl.password", p);
                }
            }
            "ssl" => {
                config.set("security.protocol", "SSL");
                if let Some(ref ca) = conn.auth.ssl_ca_path {
                    config.set("ssl.ca.location", ca);
                }
                if let Some(ref cert) = conn.auth.ssl_cert_path {
                    config.set("ssl.certificate.location", cert);
                }
                if let Some(ref key) = conn.auth.ssl_key_path {
                    config.set("ssl.key.location", key);
                }
            }
            _ => {} // "none"
        }

        config
    }

    pub fn get_or_create_consumer(
        &self,
        conn: &ConnectionConfig,
    ) -> AppResult<BaseConsumer<DefaultConsumerContext>> {
        let mut config = Self::build_config(conn);
        config.set("group.id", &format!("kafka-viewer-{}", conn.id));
        config
            .create()
            .map_err(|e| AppError::Kafka(e.to_string()))
    }

    pub fn test_connection(conn: &ConnectionConfig) -> AppResult<serde_json::Value> {
        let mut config = Self::build_config(conn);
        let consumer: BaseConsumer<DefaultConsumerContext> = config
            .set("group.id", "kafka-viewer-test")
            .create()
            .map_err(|e| AppError::Connection(format!("Failed to create consumer: {}", e)))?;

        let metadata = consumer
            .fetch_metadata(None, Duration::from_secs(10))
            .map_err(|e| AppError::Connection(format!("Failed to fetch metadata: {}", e)))?;

        let broker_count = metadata.brokers().len();

        Ok(serde_json::json!({
            "success": true,
            "message": format!("连接成功 ({} brokers)", broker_count),
            "broker_count": broker_count
        }))
    }
}
