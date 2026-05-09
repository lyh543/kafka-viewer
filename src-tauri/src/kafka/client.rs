use std::net::{TcpStream, ToSocketAddrs};
use std::time::{Duration, Instant};

use rdkafka::config::ClientConfig;
use rdkafka::consumer::{BaseConsumer, Consumer, DefaultConsumerContext};

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

    fn measure_bootstrap_ping_ms(brokers: &str) -> Option<u128> {
        const PING_TIMEOUT: Duration = Duration::from_secs(3);

        brokers
            .split(',')
            .map(str::trim)
            .filter(|broker| !broker.is_empty())
            .find_map(|broker| {
                let addresses = broker.to_socket_addrs().ok()?;

                addresses.into_iter().find_map(|address| {
                    let started_at = Instant::now();
                    TcpStream::connect_timeout(&address, PING_TIMEOUT)
                        .ok()
                        .map(|stream| {
                            let _ = stream.shutdown(std::net::Shutdown::Both);
                            started_at.elapsed().as_millis()
                        })
                })
            })
    }

    pub fn get_or_create_consumer(
        &self,
        conn: &ConnectionConfig,
    ) -> AppResult<BaseConsumer<DefaultConsumerContext>> {
        let mut config = Self::build_config(conn);
        config.set("group.id", &format!("kafka-viewer-{}", conn.id));
        config.create().map_err(|e| AppError::Kafka(e.to_string()))
    }

    pub fn test_connection<F>(
        conn: &ConnectionConfig,
        mut on_progress: F,
    ) -> AppResult<serde_json::Value>
    where
        F: FnMut(&str, &str),
    {
        let mut config = Self::build_config(conn);
        on_progress("measuring_ping", "正在测量 bootstrap broker 网络延迟");
        let ping_ms = Self::measure_bootstrap_ping_ms(&conn.brokers);

        on_progress("creating_consumer", "正在初始化 Kafka consumer");
        let consumer: BaseConsumer<DefaultConsumerContext> = config
            .set("group.id", "kafka-viewer-test")
            .create()
            .map_err(|e| AppError::Connection(format!("Failed to create consumer: {}", e)))?;

        on_progress("fetching_metadata", "正在拉取集群 metadata");
        let metadata = consumer
            .fetch_metadata(None, Duration::from_secs(10))
            .map_err(|e| AppError::Connection(format!("Failed to fetch metadata: {}", e)))?;

        on_progress("processing_metadata", "正在整理 metadata 返回结果");
        let broker_count = metadata.brokers().len();
        let topic_count = metadata.topics().len();
        let partition_count: usize = metadata
            .topics()
            .iter()
            .map(|topic| topic.partitions().len())
            .sum();
        let brokers: Vec<_> = metadata
            .brokers()
            .iter()
            .map(|broker| {
                serde_json::json!({
                    "id": broker.id(),
                    "host": broker.host(),
                    "port": broker.port(),
                })
            })
            .collect();

        Ok(serde_json::json!({
            "success": true,
            "message": "连接成功",
            "ping_ms": ping_ms,
            "broker_count": broker_count,
            "topic_count": topic_count,
            "partition_count": partition_count,
            "brokers": brokers,
        }))
    }
}
