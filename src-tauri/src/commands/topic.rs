use tauri::State;

use crate::kafka::client::KafkaClientManager;
use crate::kafka::topic as kafka_topic;
use crate::kafka::producer;
use crate::project::manager::ProjectManager;

#[tauri::command]
pub fn list_topics(
    connection_id: &str,
    manager: State<'_, ProjectManager>,
    kafka: State<'_, KafkaClientManager>,
) -> Result<Vec<String>, String> {
    let connections = manager.get_connections();
    let conn = connections
        .iter()
        .find(|c| c.id == connection_id)
        .ok_or_else(|| format!("Connection '{}' not found", connection_id))?;

    kafka_topic::list_topics(&kafka, conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_topic_status(
    connection_id: &str,
    topic: &str,
    manager: State<'_, ProjectManager>,
    kafka: State<'_, KafkaClientManager>,
) -> Result<serde_json::Value, String> {
    let connections = manager.get_connections();
    let conn = connections
        .iter()
        .find(|c| c.id == connection_id)
        .ok_or_else(|| format!("Connection '{}' not found", connection_id))?;

    kafka_topic::get_topic_status(&kafka, conn, topic).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fetch_messages(
    connection_id: &str,
    topic: &str,
    filter: serde_json::Value,
    manager: State<'_, ProjectManager>,
    kafka: State<'_, KafkaClientManager>,
) -> Result<Vec<serde_json::Value>, String> {
    let connections = manager.get_connections();
    let conn = connections
        .iter()
        .find(|c| c.id == connection_id)
        .ok_or_else(|| format!("Connection '{}' not found", connection_id))?;

    let consumer = kafka.get_or_create_consumer(conn).map_err(|e| e.to_string())?;

    use rdkafka::consumer::Consumer;
    use rdkafka::message::Headers;
    use rdkafka::topic_partition_list::TopicPartitionList;
    use rdkafka::Message;
    use std::time::Duration;

    // Fetch metadata to get partition count
    let metadata = consumer
        .fetch_metadata(Some(topic), Duration::from_secs(10))
        .map_err(|e| e.to_string())?;

    let topic_metadata = metadata
        .topics()
        .iter()
        .find(|t| t.name() == topic)
        .ok_or_else(|| format!("Topic '{}' not found", topic))?;

    // Determine start from filter
    let start_from = filter.get("start_from").and_then(|s| s.get("type")).and_then(|t| t.as_str()).unwrap_or("latest");
    let count = filter.get("start_from").and_then(|s| s.get("count")).and_then(|c| c.as_i64()).unwrap_or(100);

    let mut tpl = TopicPartitionList::new();

    for p in topic_metadata.partitions() {
        match start_from {
            "beginning" => {
                tpl.add_partition_offset(topic, p.id(), rdkafka::Offset::Beginning)
                    .map_err(|e| e.to_string())?;
            }
            "last_n" => {
                let (_, high) = consumer
                    .fetch_watermarks(topic, p.id(), Duration::from_secs(5))
                    .map_err(|e| e.to_string())?;
                let start = (high - count).max(0);
                tpl.add_partition_offset(topic, p.id(), rdkafka::Offset::Offset(start))
                    .map_err(|e| e.to_string())?;
            }
            _ => {
                // "latest" - get last N messages
                let (_, high) = consumer
                    .fetch_watermarks(topic, p.id(), Duration::from_secs(5))
                    .map_err(|e| e.to_string())?;
                let start = (high - 100).max(0);
                tpl.add_partition_offset(topic, p.id(), rdkafka::Offset::Offset(start))
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
            Some(Ok(msg)) => {
                let key = msg.key().map(|k| String::from_utf8_lossy(k).to_string());
                let value = msg.payload().map(|v| String::from_utf8_lossy(v).to_string());
                let timestamp = msg.timestamp().to_millis().unwrap_or(0);

                let mut headers = serde_json::Map::new();
                if let Some(h) = msg.headers() {
                    for header in h.iter() {
                        if let Some(val) = header.value {
                            headers.insert(
                                header.key.to_string(),
                                serde_json::Value::String(String::from_utf8_lossy(val).to_string()),
                            );
                        }
                    }
                }

                // Apply client-side filters
                let key_filter = filter.get("key_filter");
                let value_filter = filter.get("value_filter");

                let key_str = key.as_deref().unwrap_or("");
                let value_str = value.as_deref().unwrap_or("");

                let key_match = match key_filter {
                    Some(f) => {
                        let mode = f.get("mode").and_then(|m| m.as_str()).unwrap_or("");
                        let pattern = f.get("value").and_then(|v| v.as_str()).unwrap_or("");
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
                    Some(f) => {
                        let mode = f.get("mode").and_then(|m| m.as_str()).unwrap_or("");
                        let pattern = f.get("value").and_then(|v| v.as_str()).unwrap_or("");
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
                        "topic": msg.topic(),
                        "partition": msg.partition(),
                        "offset": msg.offset(),
                        "key": key,
                        "value": value,
                        "headers": headers,
                        "timestamp": timestamp
                    }));
                }
            }
            Some(Err(e)) => {
                log::warn!("Error consuming message: {}", e);
            }
            None => {
                // No message available, check if we should stop
                if messages.len() > 0 {
                    break;
                }
            }
        }
    }

    // Sort by timestamp descending
    messages.sort_by(|a, b| {
        let ta = a.get("timestamp").and_then(|t| t.as_i64()).unwrap_or(0);
        let tb = b.get("timestamp").and_then(|t| t.as_i64()).unwrap_or(0);
        tb.cmp(&ta)
    });

    Ok(messages)
}

fn regex_match(text: &str, pattern: &str) -> bool {
    // Simple contains-based match as fallback if regex crate not available
    text.contains(pattern)
}

#[tauri::command]
pub fn produce_message(
    request: serde_json::Value,
    manager: State<'_, ProjectManager>,
) -> Result<(), String> {
    let connection_id = request.get("connection_id").and_then(|v| v.as_str()).ok_or("Missing connection_id")?;
    let topic = request.get("topic").and_then(|v| v.as_str()).ok_or("Missing topic")?;
    let value = request.get("value").and_then(|v| v.as_str()).ok_or("Missing value")?;
    let key = request.get("key").and_then(|v| v.as_str());
    let partition = request.get("partition").and_then(|v| v.as_i64()).map(|p| p as i32);

    let connections = manager.get_connections();
    let conn = connections
        .iter()
        .find(|c| c.id == connection_id)
        .ok_or_else(|| format!("Connection '{}' not found", connection_id))?;

    producer::produce_message(conn, topic, key, value, partition).map_err(|e| e.to_string())
}
