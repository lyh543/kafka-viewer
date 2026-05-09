use std::time::Duration;

use rdkafka::consumer::Consumer;

use crate::error::{AppError, AppResult};
use crate::kafka::client::KafkaClientManager;
use crate::project::config::ConnectionConfig;

pub fn list_consumer_groups(
    client_manager: &KafkaClientManager,
    conn: &ConnectionConfig,
) -> AppResult<Vec<String>> {
    let consumer = client_manager.get_or_create_consumer(conn)?;
    let groups = consumer
        .fetch_group_list(None, Duration::from_secs(10))
        .map_err(|e| AppError::Kafka(e.to_string()))?;

    let mut group_names: Vec<String> = groups
        .groups()
        .iter()
        .map(|g| g.name().to_string())
        .filter(|name| !name.starts_with("kafka-viewer-"))
        .collect();
    group_names.sort();
    Ok(group_names)
}

pub fn get_consumer_group_status(
    client_manager: &KafkaClientManager,
    conn: &ConnectionConfig,
    group_id: &str,
) -> AppResult<serde_json::Value> {
    let consumer = client_manager.get_or_create_consumer(conn)?;
    let groups = consumer
        .fetch_group_list(Some(group_id), Duration::from_secs(10))
        .map_err(|e| AppError::Kafka(e.to_string()))?;

    let group = groups
        .groups()
        .iter()
        .find(|g| g.name() == group_id)
        .ok_or_else(|| AppError::Kafka(format!("Consumer group '{}' not found", group_id)))?;

    let members: Vec<serde_json::Value> = group
        .members()
        .iter()
        .map(|m| {
            serde_json::json!({
                "member_id": m.id(),
                "client_id": m.client_id(),
                "host": m.client_host(),
                "assignments": []
            })
        })
        .collect();

    Ok(serde_json::json!({
        "group_id": group.name(),
        "state": group.state(),
        "protocol_type": group.protocol_type(),
        "coordinator": 0,
        "members": members,
        "offsets": []
    }))
}
