use rdkafka::config::ClientConfig;
use rdkafka::producer::{BaseProducer, BaseRecord, Producer};

use crate::error::{AppError, AppResult};
use crate::kafka::client::KafkaClientManager;
use crate::project::config::ConnectionConfig;

pub fn produce_message(
    conn: &ConnectionConfig,
    topic: &str,
    key: Option<&str>,
    value: &str,
    partition: Option<i32>,
) -> AppResult<()> {
    // Fail fast (at most three attempts) instead of letting librdkafka retry forever.
    KafkaClientManager::ensure_broker_reachable(conn)?;

    let mut config = ClientConfig::new();
    config.set("bootstrap.servers", &conn.brokers);
    config.set("message.timeout.ms", "5000");
    // Retry at most three times before giving up.
    config.set("message.send.max.retries", "3");
    config.set("retry.backoff.ms", "300");

    match conn.auth.auth_type.as_str() {
        "sasl_plain" | "sasl_scram_256" | "sasl_scram_512" => {
            let mechanism = match conn.auth.auth_type.as_str() {
                "sasl_plain" => "PLAIN",
                "sasl_scram_256" => "SCRAM-SHA-256",
                "sasl_scram_512" => "SCRAM-SHA-512",
                _ => "PLAIN",
            };
            config.set("security.protocol", "SASL_PLAINTEXT");
            config.set("sasl.mechanism", mechanism);
            if let Some(ref u) = conn.auth.username {
                config.set("sasl.username", u);
            }
            if let Some(ref p) = conn.auth.password {
                config.set("sasl.password", p);
            }
        }
        "ssl" => {
            config.set("security.protocol", "SSL");
        }
        _ => {}
    }

    let producer: BaseProducer = config
        .create()
        .map_err(|e| AppError::Kafka(e.to_string()))?;

    let mut record = BaseRecord::to(topic).payload(value);
    if let Some(k) = key {
        record = record.key(k);
    }
    if let Some(p) = partition {
        record = record.partition(p);
    }

    producer
        .send(record)
        .map_err(|(e, _)| AppError::Kafka(e.to_string()))?;

    producer
        .flush(std::time::Duration::from_secs(5))
        .map_err(|e| AppError::Kafka(e.to_string()))?;

    Ok(())
}
