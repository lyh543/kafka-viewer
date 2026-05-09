use tauri::State;

use crate::commands::runtime::run_blocking_command;
use crate::kafka::client::KafkaClientManager;
use crate::project::config::ConnectionConfig;
use crate::project::manager::ProjectManager;

#[tauri::command]
pub fn get_connections(
    manager: State<'_, ProjectManager>,
) -> Result<Vec<ConnectionConfig>, String> {
    log::debug!("Loading saved Kafka connections");
    let connections = manager.get_connections();
    log::info!("Loaded {} saved Kafka connection(s)", connections.len());
    Ok(connections)
}

#[tauri::command]
pub fn save_connection(
    connection: ConnectionConfig,
    manager: State<'_, ProjectManager>,
) -> Result<ConnectionConfig, String> {
    let connection_name = connection.name.clone();
    let connection_id = connection.id.clone();
    log::info!(
        "Saving Kafka connection '{}' ({})",
        connection_name,
        connection_id
    );

    manager.save_connection(connection).map_err(|e| {
        log::error!(
            "Failed to save Kafka connection '{}' ({}): {}",
            connection_name,
            connection_id,
            e
        );
        e.to_string()
    })
}

#[tauri::command]
pub fn delete_connection(
    id: &str,
    manager: State<'_, ProjectManager>,
) -> Result<(), String> {
    log::info!("Deleting Kafka connection '{}'", id);
    manager.delete_connection(id).map_err(|e| {
        log::error!("Failed to delete Kafka connection '{}': {}", id, e);
        e.to_string()
    })
}

#[tauri::command]
pub async fn test_connection(connection: ConnectionConfig) -> Result<serde_json::Value, String> {
    let connection_name = connection.name.clone();
    let brokers = connection.brokers.clone();

    log::info!(
        "Testing Kafka connection '{}' against brokers '{}'",
        connection_name,
        brokers
    );

    run_blocking_command("test_connection", move || {
        KafkaClientManager::test_connection(&connection).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| {
        log::error!("Kafka connection test failed for '{}': {}", connection_name, e);
        e
    })
}
