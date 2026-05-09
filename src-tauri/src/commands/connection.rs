use tauri::{AppHandle, Emitter, State};

use crate::commands::runtime::run_blocking_command;
use crate::kafka::client::KafkaClientManager;
use crate::project::config::ConnectionConfig;
use crate::project::manager::ProjectManager;

fn emit_test_progress(
    app: &AppHandle,
    request_id: u64,
    connection_id: &str,
    step: &str,
    message: &str,
) {
    if let Err(error) = app.emit(
        "connection-test-progress",
        serde_json::json!({
            "request_id": request_id,
            "connection_id": connection_id,
            "step": step,
            "message": message,
        }),
    ) {
        log::warn!(
            "Failed to emit test progress for connection '{}': {}",
            connection_id,
            error
        );
    }
}

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
pub fn delete_connection(id: &str, manager: State<'_, ProjectManager>) -> Result<(), String> {
    log::info!("Deleting Kafka connection '{}'", id);
    manager.delete_connection(id).map_err(|e| {
        log::error!("Failed to delete Kafka connection '{}': {}", id, e);
        e.to_string()
    })
}

#[tauri::command]
pub async fn test_connection(
    app: AppHandle,
    connection: ConnectionConfig,
    request_id: u64,
) -> Result<serde_json::Value, String> {
    let connection_name = connection.name.clone();
    let connection_id = connection.id.clone();
    let brokers = connection.brokers.clone();

    log::info!(
        "Testing Kafka connection '{}' against brokers '{}'",
        connection_name,
        brokers
    );

    emit_test_progress(&app, request_id, &connection_id, "starting", "开始测试连接");

    run_blocking_command("test_connection", move || {
        let result = KafkaClientManager::test_connection(&connection, |step, message| {
            emit_test_progress(&app, request_id, &connection_id, step, message);
        })
        .map_err(|e| e.to_string());

        match &result {
            Ok(_) => emit_test_progress(&app, request_id, &connection_id, "completed", "测试完成"),
            Err(error) => emit_test_progress(
                &app,
                request_id,
                &connection_id,
                "failed",
                &format!("测试失败: {}", error),
            ),
        }

        result
    })
    .await
    .map_err(|e| {
        log::error!(
            "Kafka connection test failed for '{}': {}",
            connection_name,
            e
        );
        e
    })
}
