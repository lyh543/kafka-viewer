use tauri::State;

use crate::kafka::client::KafkaClientManager;
use crate::project::config::ConnectionConfig;
use crate::project::manager::ProjectManager;

#[tauri::command]
pub fn get_connections(
    manager: State<'_, ProjectManager>,
) -> Result<Vec<ConnectionConfig>, String> {
    Ok(manager.get_connections())
}

#[tauri::command]
pub fn save_connection(
    connection: ConnectionConfig,
    manager: State<'_, ProjectManager>,
) -> Result<ConnectionConfig, String> {
    manager.save_connection(connection).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_connection(
    id: &str,
    manager: State<'_, ProjectManager>,
) -> Result<(), String> {
    manager.delete_connection(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn test_connection(connection: ConnectionConfig) -> Result<serde_json::Value, String> {
    KafkaClientManager::test_connection(&connection).map_err(|e| e.to_string())
}
