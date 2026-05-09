use std::time::Duration;

use rdkafka::consumer::Consumer;

use crate::error::{AppError, AppResult};
use crate::kafka::client::KafkaClientManager;
use crate::project::config::ConnectionConfig;

pub fn list_topics(
    client_manager: &KafkaClientManager,
    conn: &ConnectionConfig,
) -> AppResult<Vec<String>> {
    let consumer = client_manager.get_or_create_consumer(conn)?;
    let metadata = consumer
        .fetch_metadata(None, Duration::from_secs(10))
        .map_err(|e| AppError::Kafka(e.to_string()))?;

    let mut topics: Vec<String> = metadata
        .topics()
        .iter()
        .map(|t| t.name().to_string())
        .filter(|name| !name.starts_with("__"))
        .collect();
    topics.sort();
    Ok(topics)
}

pub fn get_topic_status(
    client_manager: &KafkaClientManager,
    conn: &ConnectionConfig,
    topic_name: &str,
) -> AppResult<serde_json::Value> {
    let consumer = client_manager.get_or_create_consumer(conn)?;
    let metadata = consumer
        .fetch_metadata(Some(topic_name), Duration::from_secs(10))
        .map_err(|e| AppError::Kafka(e.to_string()))?;

    let topic_metadata = metadata
        .topics()
        .iter()
        .find(|t| t.name() == topic_name)
        .ok_or_else(|| AppError::Kafka(format!("Topic '{}' not found", topic_name)))?;

    let partitions: Vec<serde_json::Value> = topic_metadata
        .partitions()
        .iter()
        .map(|p| {
            let (low, high) = consumer
                .fetch_watermarks(topic_name, p.id(), Duration::from_secs(5))
                .unwrap_or((-1, -1));

            serde_json::json!({
                "partition": p.id(),
                "leader": p.leader(),
                "replicas": p.replicas(),
                "isr": p.isr(),
                "beginning_offset": low,
                "end_offset": high
            })
        })
        .collect();

    let replication_factor = topic_metadata
        .partitions()
        .first()
        .map(|p| p.replicas().len())
        .unwrap_or(0);

    Ok(serde_json::json!({
        "info": {
            "name": topic_name,
            "partitions": topic_metadata.partitions().len(),
            "replication_factor": replication_factor,
            "configs": {}
        },
        "partitions": partitions
    }))
}
