mod cache;
mod commands;
mod error;
mod kafka;
mod logging;
mod menu;
mod project;

use cache::message_cache::MessageCache;
use kafka::client::KafkaClientManager;
use project::manager::ProjectManager;

/// Initializes the logger so backend and frontend logs are both printed to
/// stdout and buffered for the in-app log viewer.
pub fn init_logging() {
    logging::init();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    log::info!("Starting Kafka Viewer backend");
    let project_manager = ProjectManager::new().expect("Failed to initialize project manager");
    let kafka_client_manager = KafkaClientManager::new();
    let message_cache = MessageCache::new(200); // 200MB default

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let native_menu = menu::build(app.handle())?;
            app.set_menu(native_menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            menu::handle_event(app, event.id().as_ref());
        })
        .manage(project_manager)
        .manage(kafka_client_manager)
        .manage(message_cache)
        .invoke_handler(tauri::generate_handler![
            // Project commands
            commands::project::create_project,
            commands::project::open_project,
            commands::project::close_project,
            commands::project::get_recent_projects,
            commands::project::remove_recent_project,
            // Connection commands
            commands::connection::get_connections,
            commands::connection::save_connection,
            commands::connection::delete_connection,
            commands::connection::test_connection,
            // Topic commands
            commands::topic::list_topics,
            commands::topic::get_topic_status,
            commands::topic::fetch_messages,
            commands::topic::produce_message,
            // Consumer group commands
            commands::consumer_group::list_consumer_groups,
            commands::consumer_group::get_consumer_group_status,
            // Logging commands
            commands::logging::log_frontend,
            commands::logging::get_recent_logs,
            // Developer tools
            commands::devtools::open_devtools,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
