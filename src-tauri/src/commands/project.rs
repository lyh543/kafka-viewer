use tauri::State;

use crate::error::AppResult;
use crate::project::manager::ProjectManager;

#[tauri::command]
pub fn create_project(
    name: &str,
    path: &str,
    manager: State<'_, ProjectManager>,
) -> Result<serde_json::Value, String> {
    manager.create_project(name, path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_project(
    path: &str,
    manager: State<'_, ProjectManager>,
) -> Result<serde_json::Value, String> {
    manager.open_project(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn close_project(manager: State<'_, ProjectManager>) -> Result<(), String> {
    manager.close_project().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_recent_projects(
    manager: State<'_, ProjectManager>,
) -> Result<Vec<crate::project::config::RecentProject>, String> {
    Ok(manager.get_recent_projects())
}

#[tauri::command]
pub fn remove_recent_project(
    path: &str,
    manager: State<'_, ProjectManager>,
) -> Result<(), String> {
    manager.remove_recent_project(path).map_err(|e| e.to_string())
}
