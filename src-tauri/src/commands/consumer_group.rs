use tauri::State;

use crate::commands::runtime::run_blocking_command;
use crate::kafka::client::KafkaClientManager;
use crate::kafka::consumer_group as kafka_cg;
use crate::project::manager::ProjectManager;

#[tauri::command]
pub async fn list_consumer_groups(
    connection_id: &str,
    manager: State<'_, ProjectManager>,
) -> Result<Vec<String>, String> {
    log::info!("Listing consumer groups for connection '{}'", connection_id);
    let connections = manager.get_connections();
    let conn = connections
        .iter()
        .find(|c| c.id == connection_id)
        .cloned()
        .ok_or_else(|| format!("Connection '{}' not found", connection_id))?;

    run_blocking_command("list_consumer_groups", move || {
        let kafka = KafkaClientManager::new();
        kafka_cg::list_consumer_groups(&kafka, &conn).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| {
        log::error!(
            "Failed to list consumer groups for connection '{}': {}",
            connection_id,
            e
        );
        e
    })
}

#[tauri::command]
pub async fn get_consumer_group_status(
    connection_id: &str,
    group_id: &str,
    manager: State<'_, ProjectManager>,
) -> Result<serde_json::Value, String> {
    log::info!(
        "Fetching consumer group '{}' for connection '{}'",
        group_id,
        connection_id
    );
    let connections = manager.get_connections();
    let conn = connections
        .iter()
        .find(|c| c.id == connection_id)
        .cloned()
        .ok_or_else(|| format!("Connection '{}' not found", connection_id))?;

    let group_id = group_id.to_string();
    let group_id_for_log = group_id.clone();

    run_blocking_command("get_consumer_group_status", move || {
        let kafka = KafkaClientManager::new();
        kafka_cg::get_consumer_group_status(&kafka, &conn, &group_id).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| {
        log::error!(
            "Failed to fetch consumer group '{}' for connection '{}': {}",
            group_id_for_log,
            connection_id,
            e
        );
        e
    })
}
