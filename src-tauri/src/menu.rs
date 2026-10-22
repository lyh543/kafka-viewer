use tauri::menu::{Menu, MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Manager, Runtime};

pub const MENU_MANAGE_CONNECTIONS: &str = "menu:manage-connections";
pub const MENU_CLOSE_PROJECT: &str = "menu:close-project";
pub const MENU_OPEN_DEVTOOLS: &str = "menu:open-devtools";
pub const MENU_CHECK_UPDATE: &str = "menu:check-update";
pub const MENU_ABOUT: &str = "menu:about";

/// Builds the native application menu (global menubar on macOS, window menu on
/// Windows/Linux). Items that need UI state are forwarded to the frontend as
/// events; devtools is handled directly by the backend.
pub fn build<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let check_update = MenuItemBuilder::with_id(MENU_CHECK_UPDATE, "检查更新")
        .enabled(false)
        .build(app)?;

    let file_menu = SubmenuBuilder::new(app, "文件")
        .text(MENU_MANAGE_CONNECTIONS, "管理连接")
        .separator()
        .text(MENU_CLOSE_PROJECT, "关闭项目")
        .build()?;

    let help_menu = SubmenuBuilder::new(app, "帮助")
        .text(MENU_OPEN_DEVTOOLS, "打开开发者工具")
        .separator()
        .item(&check_update)
        .separator()
        .text(MENU_ABOUT, "关于 kafka-viewer")
        .build()?;

    #[cfg(target_os = "macos")]
    {
        let app_menu = SubmenuBuilder::new(app, "kafka-viewer")
            .hide()
            .hide_others()
            .show_all()
            .separator()
            .quit()
            .build()?;

        let edit_menu = SubmenuBuilder::new(app, "编辑")
            .undo()
            .redo()
            .separator()
            .cut()
            .copy()
            .paste()
            .select_all()
            .build()?;

        let window_menu = SubmenuBuilder::new(app, "窗口")
            .minimize()
            .close_window()
            .build()?;

        MenuBuilder::new(app)
            .items(&[&app_menu, &file_menu, &edit_menu, &help_menu, &window_menu])
            .build()
    }

    #[cfg(not(target_os = "macos"))]
    {
        MenuBuilder::new(app)
            .items(&[&file_menu, &help_menu])
            .build()
    }
}

/// Dispatches a native menu item click to the frontend or backend.
pub fn handle_event<R: Runtime>(app: &AppHandle<R>, id: &str) {
    match id {
        MENU_MANAGE_CONNECTIONS | MENU_CLOSE_PROJECT | MENU_ABOUT => {
            if let Err(error) = app.emit(id, ()) {
                log::error!("Failed to emit menu event '{}': {}", id, error);
            }
        }
        MENU_OPEN_DEVTOOLS => match app.get_webview_window("main") {
            Some(window) => window.open_devtools(),
            None => log::warn!("Cannot open devtools: main window not found"),
        },
        MENU_CHECK_UPDATE => {}
        other => log::debug!("Unhandled menu event: {}", other),
    }
}
