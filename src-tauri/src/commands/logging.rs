#[tauri::command]
pub fn log_frontend(level: &str, message: &str, scope: Option<&str>) -> Result<(), String> {
    let scope_prefix = scope
        .filter(|value| !value.is_empty())
        .map(|value| format!("[{value}] "))
        .unwrap_or_default();

    match level.to_ascii_lowercase().as_str() {
        "debug" => log::debug!(target: "frontend", "{}{}", scope_prefix, message),
        "warn" => log::warn!(target: "frontend", "{}{}", scope_prefix, message),
        "error" => log::error!(target: "frontend", "{}{}", scope_prefix, message),
        _ => log::info!(target: "frontend", "{}{}", scope_prefix, message),
    }

    Ok(())
}