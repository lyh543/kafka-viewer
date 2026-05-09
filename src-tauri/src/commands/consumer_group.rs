use tauri::State;

use crate::kafka::client::KafkaClientManager;
use crate::kafka::consumer_group as kafka_cg;
use crate::project::manager::ProjectManager;

#[tauri::command]
pub fn list_consumer_groups(
    connection_id: &str,
    manager: State<'_, ProjectManager>,
    kafka: State<'_, KafkaClientManager>,
) -> Result<Vec<String>, String> {
    let connections = manager.get_connections();
    let conn = connections
        .iter()
        .find(|c| c.id == connection_id)
        .ok_or_else(|| format!("Connection '{}' not found", connection_id))?;

    kafka_cg::list_consumer_groups(&kafka, conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_consumer_group_status(
    connection_id: &str,
    group_id: &str,
    manager: State<'_, ProjectManager>,
    kafka: State<'_, KafkaClientManager>,
) -> Result<serde_json::Value, String> {
    let connections = manager.get_connections();
    let conn = connections
        .iter()
        .find(|c| c.id == connection_id)
        .ok_or_else(|| format!("Connection '{}' not found", connection_id))?;

    kafka_cg::get_consumer_group_status(&kafka, conn, group_id).map_err(|e| e.to_string())
}
