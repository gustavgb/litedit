use std::sync::Mutex;
use tauri::{Emitter, Manager};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};

/// Holds the file path passed as a CLI argument (or via file-manager association).
struct AppState {
    initial_file: Mutex<Option<String>>,
}

/// Called by the frontend on startup to retrieve and consume the initial file path.
#[tauri::command]
fn get_initial_file(state: tauri::State<AppState>) -> Option<String> {
    state.initial_file.lock().unwrap().take()
}

/// Sets the window title.
/// On Wayland, tao/wry have a bug where set_title() doesn't update the GTK
/// header bar. Workaround: directly update the HeaderBar widget on the main thread.
#[tauri::command]
fn set_title(app: tauri::AppHandle, title: String) {
    let app2 = app.clone();
    app.run_on_main_thread(move || {
        if let Some(win) = app2.get_webview_window("main") {
            win.set_title(&title).ok();
            // Wayland: also patch the GTK HeaderBar directly.
            #[cfg(target_os = "linux")]
            if let Ok(gtk_win) = win.gtk_window() {
                use gtk::prelude::{BinExt, Cast, GtkWindowExt, WidgetExt};
                if let Some(titlebar) = gtk_win.titlebar() {
                    match titlebar.dynamic_cast::<gtk::EventBox>() {
                        Ok(eb) => {
                            if let Some(child) = BinExt::child(&eb) {
                                if let Ok(hb) = child.dynamic_cast::<gtk::HeaderBar>() {
                                    gtk::prelude::HeaderBarExt::set_title(&hb, Some(&title));
                                }
                            }
                        }
                        Err(titlebar) => {
                            if let Ok(hb) = titlebar.dynamic_cast::<gtk::HeaderBar>() {
                                gtk::prelude::HeaderBarExt::set_title(&hb, Some(&title));
                            }
                        }
                    }
                }
                // Force a full GTK window redraw so the WebKit compositing layer
                // is properly repainted — prevents cursor ghost marks left by
                // partial repaints triggered by the HeaderBar title update.
                gtk_win.queue_draw();
            }
        }
    }).ok();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // On Wayland, WebKit's DMA-BUF renderer doesn't properly clear previous
    // frame content (cursor positions, etc.), causing ghost marks. Disabling
    // it forces a simpler software compositing path that repaints cleanly.
    #[cfg(target_os = "linux")]
    if std::env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    // Capture the CLI file argument before the event loop starts.
    let initial_file = std::env::args()
        .skip(1)
        .find(|a| !a.starts_with('-'));

    tauri::Builder::default()
        .manage(AppState {
            initial_file: Mutex::new(initial_file),
        })
        .invoke_handler(tauri::generate_handler![get_initial_file, set_title])
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Build the native menu in Rust so GTK registers the accel groups
            // synchronously — before the window is shown. This is the only
            // reliable way to intercept Ctrl+W / Ctrl+Q before WebKitGTK does.
            let open_i    = MenuItem::with_id(app, "open",    "Open\u{2026}",    true, Some("CmdOrCtrl+O"))?;
            let save_i    = MenuItem::with_id(app, "save",    "Save",            true, Some("CmdOrCtrl+S"))?;
            let save_as_i = MenuItem::with_id(app, "save_as", "Save As\u{2026}", true, Some("CmdOrCtrl+Shift+S"))?;
            let close_i   = MenuItem::with_id(app, "close",   "Close",           true, Some("CmdOrCtrl+W"))?;
            let sep       = PredefinedMenuItem::separator(app)?;
            let quit_i    = MenuItem::with_id(app, "quit",    "Quit",            true, Some("CmdOrCtrl+Q"))?;

            let file_menu = Submenu::with_items(
                app, "File", true,
                &[&open_i, &save_i, &save_as_i, &close_i, &sep, &quit_i],
            )?;

            let help_i    = MenuItem::with_id(app, "help", "Keyboard Shortcuts", true, Some("F1"))?;
            let help_menu = Submenu::with_items(app, "Help", true, &[&help_i])?;

            let menu = Menu::with_items(app, &[&file_menu, &help_menu])?;
            app.set_menu(menu)?;

            // Handle menu events in Rust. Quit exits directly (no IPC round-trip).
            // Other actions are forwarded to the frontend as "menu-action" events.
            app.on_menu_event(|app, event| {
                match event.id().as_ref() {
                    "quit" => app.exit(0),
                    id => { app.emit("menu-action", id).ok(); }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
