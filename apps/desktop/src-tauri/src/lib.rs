mod voice;

use tauri::{
  Manager,
  menu::{Menu, MenuItem},
  tray::TrayIconBuilder,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    // abre URLs no navegador do sistema (usado pelo OAuth do Spotify)
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_autostart::init(
      tauri_plugin_autostart::MacosLauncher::LaunchAgent,
      None,
    ))
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // ── System Tray ──
      let show = MenuItem::with_id(app, "show", "Mostrar Jarvis", true, None::<&str>)?;
      let quit = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
      let menu = Menu::with_items(app, &[&show, &quit])?;

      TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip("Jarvis AI")
        .on_menu_event(|app, event| {
          match event.id.as_ref() {
            "show" => {
              if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.unminimize();
                let _ = w.set_focus();
              }
            }
            "quit" => {
              app.exit(0);
            }
            _ => {}
          }
        })
        .on_tray_icon_event(|tray, event| {
          if let tauri::tray::TrayIconEvent::DoubleClick { .. } = event {
            if let Some(w) = tray.app_handle().get_webview_window("main") {
              let _ = w.show();
              let _ = w.unminimize();
              let _ = w.set_focus();
            }
          }
        })
        .build(app)?;

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      voice::transcribe,
      voice::speak,
      voice::voice_check,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
