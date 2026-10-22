/// Opens the WebView developer tools. Available in debug builds and in release
/// builds compiled with the `devtools` feature.
#[tauri::command]
pub fn open_devtools(window: tauri::WebviewWindow) -> Result<(), String> {
    window.open_devtools();
    Ok(())
}
