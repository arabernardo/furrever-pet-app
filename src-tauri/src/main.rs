// Hides the extra console window on Windows release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(debug_assertions)]
use tauri::Manager;

use tauri::{Emitter, WebviewWindow};
use tauri_plugin_autostart::MacosLauncher;

/// Returns the global mouse cursor position in PHYSICAL pixels, relative to the top-left of the
/// window that called this command, or `None` if the cursor is outside that window.
///
/// Why Rust: the pet window is click-through, so the browser never receives mouse events and
/// JavaScript has no way to know where the cursor is. The frontend polls this every ~50 ms and
/// checks the sprite's alpha at that point (see README, "Click-through").
#[tauri::command]
fn cursor_in_window(window: WebviewWindow) -> Option<(f64, f64)> {
    // Global cursor position (whole desktop, physical px).
    let cursor = window.cursor_position().ok()?;
    // Top-left of the drawable area and its size, so we return canvas-aligned coordinates.
    let origin = window.inner_position().ok()?;
    let size = window.inner_size().ok()?;

    let x = cursor.x - f64::from(origin.x);
    let y = cursor.y - f64::from(origin.y);
    let inside = x >= 0.0 && y >= 0.0 && x < f64::from(size.width) && y < f64::from(size.height);

    // `then_some` gives Some((x, y)) when inside, otherwise None.
    inside.then_some((x, y))
}

/// Quits the whole app. `app.exit(0)` runs Tauri's normal shutdown, so the tray icon and
/// webviews are cleaned up and no process is left behind.
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

fn main() {
    tauri::Builder::default()
        // Single instance. Must be the FIRST plugin. When a second copy is launched, this callback
        // runs in the already-running copy and asks the pet window to show itself. The second
        // copy exits on its own.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = app.emit_to("pet", "show-pet", ());
        }))
        // Saves settings to a JSON file in the app data dir.
        .plugin(tauri_plugin_store::Builder::new().build())
        // "Launch at startup": registry Run key on Windows, LaunchAgent on macOS.
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .invoke_handler(tauri::generate_handler![cursor_in_window, quit_app])
        // Dev only: opens devtools for the pet window so console errors are visible.
        // `#[cfg(debug_assertions)]` removes the code entirely from release builds, so the
        // installer doesn't need the `devtools` feature and ships without devtools.
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                if let Some(win) = app.get_webview_window("pet") {
                    win.open_devtools();
                }
            }
            // Avoids an "unused variable" warning in release builds, where the block above is gone.
            let _ = app;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Furrever Pet");
}