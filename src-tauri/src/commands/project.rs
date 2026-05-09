use tauri::State;

use crate::project::manager::ProjectManager;

#[tauri::command]
pub fn create_project(
    name: &str,
    path: &str,
    manager: State<'_, ProjectManager>,
) -> Result<serde_json::Value, String> {
    log::info!("Creating project '{}' at '{}'", name, path);
    manager.create_project(name, path).map_err(|e| {
        log::error!("Failed to create project '{}' at '{}': {}", name, path, e);
        e.to_string()
    })
}

#[tauri::command]
pub fn open_project(
    path: &str,
    manager: State<'_, ProjectManager>,
) -> Result<serde_json::Value, String> {
    log::info!("Opening project at '{}'", path);
    manager.open_project(path).map_err(|e| {
        log::error!("Failed to open project at '{}': {}", path, e);
        e.to_string()
    })
}

#[tauri::command]
pub fn close_project(manager: State<'_, ProjectManager>) -> Result<(), String> {
    log::info!("Closing current project");
    manager.close_project().map_err(|e| {
        log::error!("Failed to close current project: {}", e);
        e.to_string()
    })
}

#[tauri::command]
pub fn get_recent_projects(
    manager: State<'_, ProjectManager>,
) -> Result<Vec<crate::project::config::RecentProject>, String> {
    let recent_projects = manager.get_recent_projects();
    log::debug!("Loaded {} recent project(s)", recent_projects.len());
    Ok(recent_projects)
}

#[tauri::command]
pub fn remove_recent_project(
    path: &str,
    manager: State<'_, ProjectManager>,
) -> Result<(), String> {
    log::info!("Removing recent project entry '{}'", path);
    manager.remove_recent_project(path).map_err(|e| {
        log::error!("Failed to remove recent project entry '{}': {}", path, e);
        e.to_string()
    })
}
