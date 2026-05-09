use tauri::State;

use crate::commands::runtime::run_blocking_command;
use crate::kafka::client::KafkaClientManager;
use crate::kafka::topic as kafka_topic;
use crate::kafka::producer;
use crate::project::manager::ProjectManager;

#[tauri::command]
pub async fn list_topics(
    connection_id: &str,
    manager: State<'_, ProjectManager>,
) -> Result<Vec<String>, String> {
    log::info!("Listing topics for connection '{}'", connection_id);
    let connections = manager.get_connections();
    let conn = connections
        .iter()
        .find(|c| c.id == connection_id)
        .cloned()
        .ok_or_else(|| format!("Connection '{}' not found", connection_id))?;

    run_blocking_command("list_topics", move || {
        let kafka = KafkaClientManager::new();
        kafka_topic::list_topics(&kafka, &conn).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| {
        log::error!("Failed to list topics for connection '{}': {}", connection_id, e);
        e
    })
}

#[tauri::command]
pub async fn get_topic_status(
    connection_id: &str,
    topic: &str,
    manager: State<'_, ProjectManager>,
) -> Result<serde_json::Value, String> {
    log::info!(
        "Fetching topic status for '{}' on connection '{}'",
        topic,
        connection_id
    );
    let connections = manager.get_connections();
    let conn = connections
        .iter()
        .find(|c| c.id == connection_id)
        .cloned()
        .ok_or_else(|| format!("Connection '{}' not found", connection_id))?;

    let topic = topic.to_string();
    let topic_for_log = topic.clone();

    run_blocking_command("get_topic_status", move || {
        let kafka = KafkaClientManager::new();
        kafka_topic::get_topic_status(&kafka, &conn, &topic).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| {
        log::error!(
            "Failed to fetch topic status for '{}' on connection '{}': {}",
            topic_for_log,
            connection_id,
            e
        );
        e
    })
}

#[tauri::command]
pub async fn fetch_messages(
    connection_id: &str,
    topic: &str,
    filter: serde_json::Value,
    manager: State<'_, ProjectManager>,
) -> Result<Vec<serde_json::Value>, String> {
    log::info!(
        "Fetching messages for topic '{}' on connection '{}' with filter {}",
        topic,
        connection_id,
        filter
    );
    let connections = manager.get_connections();
    let conn = connections
        .iter()
        .find(|c| c.id == connection_id)
        .cloned()
        .ok_or_else(|| format!("Connection '{}' not found", connection_id))?;

    let topic = topic.to_string();
    let topic_for_log = topic.clone();

    run_blocking_command("fetch_messages", move || fetch_messages_blocking(conn, topic, filter))
        .await
        .map_err(|e| {
            log::error!(
                "Failed to fetch messages for topic '{}' on connection '{}': {}",
                topic_for_log,
                connection_id,
                e
            );
            e
        })
}

fn regex_match(text: &str, pattern: &str) -> bool {
    // Simple contains-based match as fallback if regex crate not available
    text.contains(pattern)
}

#[tauri::command]
pub async fn produce_message(
    request: serde_json::Value,
    manager: State<'_, ProjectManager>,
) -> Result<(), String> {
    let connection_id = request.get("connection_id").and_then(|v| v.as_str()).ok_or("Missing connection_id")?;
    let topic = request.get("topic").and_then(|v| v.as_str()).ok_or("Missing topic")?;
    let value = request.get("value").and_then(|v| v.as_str()).ok_or("Missing value")?;
    let key = request.get("key").and_then(|v| v.as_str());
    let partition = request.get("partition").and_then(|v| v.as_i64()).map(|p| p as i32);

    log::info!(
        "Producing message to topic '{}' on connection '{}' (key: {}, value_len: {}, partition: {:?})",
        topic,
        connection_id,
        key.unwrap_or("<none>"),
        value.len(),
        partition
    );

    let connections = manager.get_connections();
    let conn = connections
        .iter()
        .find(|c| c.id == connection_id)
        .cloned()
        .ok_or_else(|| format!("Connection '{}' not found", connection_id))?;

    let topic_name = topic.to_string();
    let key = key.map(str::to_string);
    let value = value.to_string();

    run_blocking_command("produce_message", move || {
        producer::produce_message(&conn, &topic_name, key.as_deref(), &value, partition)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| {
        log::error!(
            "Failed to produce message to topic '{}' on connection '{}': {}",
            topic,
            connection_id,
            e
        );
        e
    })
}

fn fetch_messages_blocking(
    conn: crate::project::config::ConnectionConfig,
    topic: String,
    filter: serde_json::Value,
) -> Result<Vec<serde_json::Value>, String> {
    let kafka = KafkaClientManager::new();
    let consumer = kafka.get_or_create_consumer(&conn).map_err(|e| e.to_string())?;

    use rdkafka::consumer::Consumer;
    use rdkafka::message::Headers;
    use rdkafka::topic_partition_list::TopicPartitionList;
    use rdkafka::Message;
    use std::time::Duration;

    let metadata = consumer
        .fetch_metadata(Some(&topic), Duration::from_secs(10))
        .map_err(|e| e.to_string())?;

    let topic_metadata = metadata
        .topics()
        .iter()
        .find(|topic_metadata| topic_metadata.name() == topic)
        .ok_or_else(|| format!("Topic '{}' not found", topic))?;

    let start_from = filter
        .get("start_from")
        .and_then(|start| start.get("type"))
        .and_then(|value| value.as_str())
        .unwrap_or("latest");
    let count = filter
        .get("start_from")
        .and_then(|start| start.get("count"))
        .and_then(|value| value.as_i64())
        .unwrap_or(100);

    let mut tpl = TopicPartitionList::new();

    for partition in topic_metadata.partitions() {
        match start_from {
            "beginning" => {
                tpl.add_partition_offset(&topic, partition.id(), rdkafka::Offset::Beginning)
                    .map_err(|e| e.to_string())?;
            }
            "last_n" => {
                let (_, high) = consumer
                    .fetch_watermarks(&topic, partition.id(), Duration::from_secs(5))
                    .map_err(|e| e.to_string())?;
                let start = (high - count).max(0);
                tpl.add_partition_offset(&topic, partition.id(), rdkafka::Offset::Offset(start))
                    .map_err(|e| e.to_string())?;
            }
            _ => {
                let (_, high) = consumer
                    .fetch_watermarks(&topic, partition.id(), Duration::from_secs(5))
                    .map_err(|e| e.to_string())?;
                let start = (high - 100).max(0);
                tpl.add_partition_offset(&topic, partition.id(), rdkafka::Offset::Offset(start))
                    .map_err(|e| e.to_string())?;
            }
        }
    }

    consumer.assign(&tpl).map_err(|e| e.to_string())?;

    let mut messages = Vec::new();
    let max_messages = count as usize;
    let timeout = Duration::from_secs(5);
    let start_time = std::time::Instant::now();

    while messages.len() < max_messages && start_time.elapsed() < timeout {
        match consumer.poll(Duration::from_millis(100)) {
            Some(Ok(message)) => {
                let key = message
                    .key()
                    .map(|value| String::from_utf8_lossy(value).to_string());
                let value = message
                    .payload()
                    .map(|payload| String::from_utf8_lossy(payload).to_string());
                let timestamp = message.timestamp().to_millis().unwrap_or(0);

                let mut headers = serde_json::Map::new();
                if let Some(all_headers) = message.headers() {
                    for header in all_headers.iter() {
                        if let Some(header_value) = header.value {
                            headers.insert(
                                header.key.to_string(),
                                serde_json::Value::String(
                                    String::from_utf8_lossy(header_value).to_string(),
                                ),
                            );
                        }
                    }
                }

                let key_filter = filter.get("key_filter");
                let value_filter = filter.get("value_filter");

                let key_str = key.as_deref().unwrap_or("");
                let value_str = value.as_deref().unwrap_or("");

                let key_match = match key_filter {
                    Some(filter) => {
                        let mode = filter.get("mode").and_then(|value| value.as_str()).unwrap_or("");
                        let pattern = filter
                            .get("value")
                            .and_then(|value| value.as_str())
                            .unwrap_or("");
                        match mode {
                            "equals" => key_str == pattern,
                            "not_equals" => key_str != pattern,
                            "contains" => key_str.contains(pattern),
                            "regex" => regex_match(key_str, pattern),
                            _ => true,
                        }
                    }
                    None => true,
                };

                let value_match = match value_filter {
                    Some(filter) => {
                        let mode = filter.get("mode").and_then(|value| value.as_str()).unwrap_or("");
                        let pattern = filter
                            .get("value")
                            .and_then(|value| value.as_str())
                            .unwrap_or("");
                        match mode {
                            "equals" => value_str == pattern,
                            "not_equals" => value_str != pattern,
                            "contains" => value_str.contains(pattern),
                            "regex" => regex_match(value_str, pattern),
                            _ => true,
                        }
                    }
                    None => true,
                };

                if key_match && value_match {
                    messages.push(serde_json::json!({
                        "topic": message.topic(),
                        "partition": message.partition(),
                        "offset": message.offset(),
                        "key": key,
                        "value": value,
                        "headers": headers,
                        "timestamp": timestamp
                    }));
                }
            }
            Some(Err(error)) => {
                log::warn!("Error consuming message: {}", error);
            }
            None => {
                if !messages.is_empty() {
                    break;
                }
            }
        }
    }

    messages.sort_by(|left, right| {
        let left_timestamp = left.get("timestamp").and_then(|value| value.as_i64()).unwrap_or(0);
        let right_timestamp = right.get("timestamp").and_then(|value| value.as_i64()).unwrap_or(0);
        right_timestamp.cmp(&left_timestamp)
    });

    log::info!("Fetched {} message(s) for topic '{}'", messages.len(), topic);

    Ok(messages)
}
