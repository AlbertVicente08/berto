use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use windows_sys::Win32::Foundation::POINT;
use windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos;

#[derive(Default, Clone, Copy, serde::Serialize, serde::Deserialize, Debug)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Default, Clone, Copy, serde::Serialize, serde::Deserialize, Debug)]
pub struct InteractiveBounds {
    pub capsule: Rect,
    pub avatar: Option<Rect>,
}

#[derive(Default)]
pub struct AppState {
    pub interactive_bounds: Mutex<Option<InteractiveBounds>>,
    pub ignoring_cursor: Mutex<bool>,
    pub python_child: Mutex<Option<std::process::Child>>,
    pub tray_menu: Mutex<Option<Menu<tauri::Wry>>>,
    pub tray_icon: Mutex<Option<tauri::tray::TrayIcon<tauri::Wry>>>,
}

#[tauri::command]
fn update_interactive_bounds(
    state: tauri::State<'_, Arc<AppState>>,
    capsule: Rect,
    avatar: Option<Rect>,
) {
    let mut bounds = state.interactive_bounds.lock().unwrap();
    *bounds = Some(InteractiveBounds { capsule, avatar });
}

#[tauri::command]
fn clear_interactive_bounds(state: tauri::State<'_, Arc<AppState>>) {
    let mut bounds = state.interactive_bounds.lock().unwrap();
    *bounds = None;
}

#[tauri::command]
fn hide_window(window: WebviewWindow, state: tauri::State<'_, Arc<AppState>>) {
    let _ = window.hide();
    let mut bounds = state.interactive_bounds.lock().unwrap();
    *bounds = None;
    let mut ignoring = state.ignoring_cursor.lock().unwrap();
    *ignoring = true;
    let _ = window.set_ignore_cursor_events(true);
}

#[derive(Clone, serde::Serialize, serde::Deserialize, Debug)]
pub struct AvatarInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    pub author: String,
    pub description: String,
    pub avatar_type: String, // "code" | "glb"
    pub entry: Option<String>,
    pub source: String, // "builtin" | "custom"
    pub local_path: Option<String>,
}

fn get_avatars_dir() -> std::path::PathBuf {
    if let Ok(appdata) = std::env::var("APPDATA") {
        std::path::PathBuf::from(appdata).join("Berto").join("avatars")
    } else {
        std::path::PathBuf::from("data").join("avatars")
    }
}

#[tauri::command]
fn get_appdata_avatars_path() -> String {
    let dir = get_avatars_dir();
    let _ = std::fs::create_dir_all(&dir);
    dir.to_string_lossy().to_string()
}

#[tauri::command]
fn is_debug_mode() -> bool {
    // 1. Variable de entorno del sistema
    if let Ok(v) = std::env::var("BERTO_DEBUG") {
        return v == "1" || v.eq_ignore_ascii_case("true");
    }
    // 2. Archivo .env en la raíz del proyecto
    for path in ["../../.env", "../.env", ".env"] {
        if let Ok(content) = std::fs::read_to_string(path) {
            for line in content.lines() {
                let trimmed = line.trim();
                if let Some(val) = trimmed.strip_prefix("BERTO_DEBUG=") {
                    let val = val.trim().trim_matches('"').trim_matches('\'');
                    return val == "1" || val.eq_ignore_ascii_case("true");
                }
            }
        }
    }
    false
}

#[tauri::command]
fn list_available_avatars() -> Vec<AvatarInfo> {
    let mut avatars: Vec<AvatarInfo> = Vec::new();
    let mut custom_ids = std::collections::HashSet::new();

    // 1. Avatares en %APPDATA%\Berto\avatars (tienen prioridad y reemplazan integrados)
    let avatars_dir = get_avatars_dir();
    let _ = std::fs::create_dir_all(&avatars_dir);

    if let Ok(entries) = std::fs::read_dir(&avatars_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let manifest_path = path.join("avatar.json");
                if manifest_path.exists() {
                    if let Ok(content) = std::fs::read_to_string(&manifest_path) {
                        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                            let id = val.get("id").and_then(|v| v.as_str()).unwrap_or_else(|| {
                                path.file_name().and_then(|f| f.to_str()).unwrap_or("custom-avatar")
                            }).to_string();
                            let name = val.get("name").and_then(|v| v.as_str()).unwrap_or(&id).to_string();
                            let version = val.get("version").and_then(|v| v.as_str()).unwrap_or("1.0.0").to_string();
                            let author = val.get("author").and_then(|v| v.as_str()).unwrap_or("Comunidad").to_string();
                            let description = val.get("description").and_then(|v| v.as_str()).unwrap_or("").to_string();
                            let entry_file = val.get("entry").and_then(|v| v.as_str()).unwrap_or("model.glb").to_string();
                            let glb_file_path = path.join(&entry_file);

                            custom_ids.insert(id.clone());
                            avatars.push(AvatarInfo {
                                id,
                                name,
                                version,
                                author,
                                description,
                                avatar_type: "glb".to_string(),
                                entry: Some(glb_file_path.to_string_lossy().to_string()),
                                source: "custom".to_string(),
                                local_path: Some(glb_file_path.to_string_lossy().to_string()),
                            });
                        }
                    }
                }
            }
        }
    }

    // 2. Avatares integrados por defecto (solo si no existen en %APPDATA%)
    let builtin = vec![
        AvatarInfo {
            id: "berto-classic".to_string(),
            name: "Berto Clásico".to_string(),
            version: "1.0.0".to_string(),
            author: "Equipo Berto".to_string(),
            description: "Robot procedural nativo en Three.js con cabeza blanco perla y ojos aqua".to_string(),
            avatar_type: "code".to_string(),
            entry: None,
            source: "builtin".to_string(),
            local_path: None,
        },
        AvatarInfo {
            id: "cube-bot".to_string(),
            name: "Cube Bot".to_string(),
            version: "1.0.0".to_string(),
            author: "Comunidad Berto".to_string(),
            description: "Avatar cúbico de prueba en formato .glb estándar".to_string(),
            avatar_type: "glb".to_string(),
            entry: Some("/avatars/cube-bot/model.glb".to_string()),
            source: "builtin".to_string(),
            local_path: None,
        },
    ];

    for b in builtin {
        if !custom_ids.contains(&b.id) {
            avatars.push(b);
        }
    }

    // Ordenar: Berto Clásico siempre primero, luego por nombre
    avatars.sort_by(|a, b| {
        if a.id == "berto-classic" {
            std::cmp::Ordering::Less
        } else if b.id == "berto-classic" {
            std::cmp::Ordering::Greater
        } else {
            a.name.cmp(&b.name)
        }
    });

    avatars
}

#[tauri::command]
fn read_avatar_glb_bytes(file_path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&file_path).map_err(|e| format!("Failed to read avatar GLB file: {}", e))
}

#[tauri::command]
fn toggle_window(window: WebviewWindow) {
    if let Ok(is_visible) = window.is_visible() {
        if is_visible {
            let _ = window.emit("request-hide", ());
        } else {
            position_window_at_top(&window);
            let _ = window.show();
            let _ = window.set_focus();
            let _ = window.emit("request-show", ());
        }
    }
}

/// Posiciona la ventana centrada horizontalmente y pegada al borde superior del monitor activo
fn position_window_at_top(window: &WebviewWindow) {
    let mut pt = POINT { x: 0, y: 0 };
    let cursor_pos = if unsafe { GetCursorPos(&mut pt) } != 0 {
        Some(PhysicalPosition::new(pt.x, pt.y))
    } else {
        None
    };

    // Buscar monitor donde esté el cursor, o monitor actual
    let target_monitor = if let Some(pos) = cursor_pos {
        window
            .available_monitors()
            .ok()
            .and_then(|monitors| {
                monitors.into_iter().find(|m| {
                    let m_pos = m.position();
                    let m_size = m.size();
                    pos.x >= m_pos.x
                        && pos.x < m_pos.x + m_size.width as i32
                        && pos.y >= m_pos.y
                        && pos.y < m_pos.y + m_size.height as i32
                })
            })
            .or_else(|| window.current_monitor().ok().flatten())
    } else {
        window.current_monitor().ok().flatten()
    };

    if let Some(monitor) = target_monitor {
        let m_pos = monitor.position();
        let m_size = monitor.size();
        let w_size = window.outer_size().unwrap_or(PhysicalSize::new(800, 600));

        let center_x = m_pos.x + ((m_size.width as i32 - w_size.width as i32) / 2);
        let top_y = m_pos.y; // Pegado al borde superior del monitor

        let _ = window.set_position(PhysicalPosition::new(center_x, top_y));
    }
}

fn is_autostart_enabled() -> bool {
    let output = std::process::Command::new("reg")
        .args(["query", r#"HKCU\Software\Microsoft\Windows\CurrentVersion\Run"#, "/v", "Berto"])
        .output();
    if let Ok(out) = output {
        out.status.success()
    } else {
        false
    }
}

fn set_autostart(enable: bool) -> bool {
    if enable {
        if let Ok(exe_path) = std::env::current_exe() {
            let path_str = exe_path.to_string_lossy().to_string();
            let val = format!("\"{}\" --hidden", path_str);
            let status = std::process::Command::new("reg")
                .args(["add", r#"HKCU\Software\Microsoft\Windows\CurrentVersion\Run"#, "/v", "Berto", "/t", "REG_SZ", "/d", &val, "/f"])
                .status();
            return status.map(|s| s.success()).unwrap_or(false);
        }
        false
    } else {
        let status = std::process::Command::new("reg")
            .args(["delete", r#"HKCU\Software\Microsoft\Windows\CurrentVersion\Run"#, "/v", "Berto", "/f"])
            .status();
        status.map(|s| s.success()).unwrap_or(false)
    }
}

#[tauri::command]
fn get_autostart_status() -> bool {
    is_autostart_enabled()
}

#[tauri::command]
fn set_autostart_status(enabled: bool) -> bool {
    set_autostart(enabled)
}

fn get_shutdown_token() -> Option<String> {
    for p in ["data/shutdown_token.txt", "../data/shutdown_token.txt", "../../data/shutdown_token.txt"] {
        if let Ok(tok) = std::fs::read_to_string(p) {
            let trimmed = tok.trim().to_string();
            if !trimmed.is_empty() {
                return Some(trimmed);
            }
        }
    }
    None
}

fn terminate_app(app: &tauri::AppHandle, state: &Arc<AppState>) {
    // 1. Matar proceso hijo de Python si Berto lo arrancó
    if let Ok(mut lock) = state.python_child.lock() {
        if let Some(mut child) = lock.take() {
            let _ = child.kill();
        }
    }

    // 2. Notificar /shutdown a FastAPI de forma segura con el token de autenticación
    if let Some(token) = get_shutdown_token() {
        let ps_cmd = format!(
            "try {{ Invoke-RestMethod -Uri 'http://127.0.0.1:8765/shutdown' -Method Post -Headers @{{ 'X-Shutdown-Token' = '{}' }} -TimeoutSec 1 }} catch {{}}",
            token
        );
        let _ = std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", &ps_cmd])
            .output();
    }

    // 3. Salir de la app Tauri de forma definitiva
    app.exit(0);
    std::process::exit(0);
}

#[tauri::command]
fn exit_app(app: tauri::AppHandle, state: tauri::State<'_, Arc<AppState>>) {
    terminate_app(&app, &state);
}

fn find_project_root() -> Option<std::path::PathBuf> {
    // 1. Desde current_dir
    if let Ok(cwd) = std::env::current_dir() {
        let mut cur = cwd;
        for _ in 0..5 {
            if cur.join("agent").join("berto").join("server.py").exists() {
                return Some(cur);
            }
            if !cur.pop() {
                break;
            }
        }
    }
    // 2. Desde current_exe
    if let Ok(exe) = std::env::current_exe() {
        let mut cur = exe;
        for _ in 0..6 {
            if cur.join("agent").join("berto").join("server.py").exists() {
                return Some(cur);
            }
            if !cur.pop() {
                break;
            }
        }
    }
    None
}

fn ensure_python_backend(state: Arc<AppState>) {
    thread::spawn(move || {
        // Comprobar rpidamente si el puerto 8765 ya est escuchando (TCP stream ultra-rpido)
        let is_running = std::net::TcpStream::connect_timeout(
            &"127.0.0.1:8765".parse().unwrap(),
            Duration::from_millis(300),
        ).is_ok();

        if !is_running {
            if let Some(root) = find_project_root() {
                let script = root.join("agent").join("berto").join("server.py");
                let venv_py = root.join("agent").join(".venv").join("Scripts").join("python.exe");
                let root_venv_py = root.join(".venv").join("Scripts").join("python.exe");

                let py_exe = if venv_py.exists() {
                    venv_py
                } else if root_venv_py.exists() {
                    root_venv_py
                } else {
                    std::path::PathBuf::from("python")
                };

                if script.exists() {
                    let mut cmd = std::process::Command::new(&py_exe);
                    cmd.arg(&script);
                    cmd.current_dir(&root);
                    #[cfg(windows)]
                    {
                        use std::os::windows::process::CommandExt;
                        // 0x08000000 = CREATE_NO_WINDOW
                        cmd.creation_flags(0x08000000);
                    }
                    if let Ok(child) = cmd.spawn() {
                        let mut lock = state.python_child.lock().unwrap();
                        *lock = Some(child);
                    }
                }
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = Arc::new(AppState::default());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(app_state.clone())
        .invoke_handler(tauri::generate_handler![
            update_interactive_bounds,
            clear_interactive_bounds,
            hide_window,
            toggle_window,
            get_appdata_avatars_path,
            list_available_avatars,
            read_avatar_glb_bytes,
            is_debug_mode,
            get_autostart_status,
            set_autostart_status,
            exit_app
        ])
        .setup(move |app| {
            let window = app.get_webview_window("main").expect("main window not found");

            // Posicionamiento inicial en el monitor activo
            position_window_at_top(&window);

            let start_hidden = std::env::var("BERTO_START_HIDDEN").map(|v| v == "1").unwrap_or(false)
                || std::env::args().any(|a| a == "--hidden");
            if start_hidden {
                let _ = window.hide();
                let _ = window.set_ignore_cursor_events(true);
            }

            // Iniciar Python backend si no estuviera corriendo
            ensure_python_backend(app_state.clone());

            // Configurar bandeja del sistema (Tray Icon)
            let toggle_item = MenuItem::with_id(app, "toggle", "Mostrar / Ocultar", true, None::<&str>)?;
            let settings_item = MenuItem::with_id(app, "settings", "Ajustes", true, None::<&str>)?;
            let autostart_item = CheckMenuItem::with_id(
                app,
                "autostart",
                "Iniciar con Windows",
                true,
                is_autostart_enabled(),
                None::<&str>,
            )?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", "Salir", true, None::<&str>)?;

            let menu = Menu::with_items(
                app,
                &[
                    &toggle_item,
                    &settings_item,
                    &autostart_item,
                    &separator,
                    &quit_item,
                ],
            )?;

            // Guardar menú en AppState para que nunca se destruya durante la vida de la app
            *app_state.tray_menu.lock().unwrap() = Some(menu.clone());

            let state_for_tray = app_state.clone();
            let win_for_menu = window.clone();
            let win_for_tray_click = window.clone();
            let autostart_item_clone = autostart_item.clone();

            let mut tray_builder = TrayIconBuilder::with_id("berto_tray")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "toggle" => {
                        toggle_window(win_for_menu.clone());
                    }
                    "settings" => {
                        if let Ok(false) = win_for_menu.is_visible() {
                            position_window_at_top(&win_for_menu);
                            let _ = win_for_menu.show();
                            let _ = win_for_menu.set_focus();
                            let _ = win_for_menu.emit("request-show", ());
                        }
                        let _ = win_for_menu.emit("open-settings", ());
                    }
                    "autostart" => {
                        let current = is_autostart_enabled();
                        let new_state = !current;
                        if set_autostart(new_state) {
                            let _ = autostart_item_clone.set_checked(new_state);
                        }
                    }
                    "quit" => {
                        terminate_app(app, &state_for_tray);
                    }
                    _ => {}
                })
                .on_tray_icon_event(move |_tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_window(win_for_tray_click.clone());
                    }
                });

            // Cargar explícitamente el icono de Berto (cabeza blanco y aqua)
            let berto_tray_icon = tauri::image::Image::from_bytes(include_bytes!("../icons/berto-tray.png"))
                .or_else(|_| tauri::image::Image::from_bytes(include_bytes!("../icons/berto-tray.ico")))
                .ok();

            if let Some(icon) = berto_tray_icon {
                tray_builder = tray_builder.icon(icon);
            } else if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            let tray = tray_builder.build(app)?;
            *app_state.tray_icon.lock().unwrap() = Some(tray);

            // Registrar atajo global por defecto Ctrl+Alt+B (o desde BERTO_HOTKEY)
            let hotkey_str = std::env::var("BERTO_HOTKEY").unwrap_or_else(|_| "Ctrl+Alt+B".to_string());
            if let Ok(shortcut) = hotkey_str.parse::<Shortcut>() {
                let win_clone = window.clone();
                let _ = app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        if let Ok(is_visible) = win_clone.is_visible() {
                            if is_visible {
                                // Emitir evento para animar salida antes de ocultar
                                let _ = win_clone.emit("request-hide", ());
                            } else {
                                position_window_at_top(&win_clone);
                                let _ = win_clone.show();
                                let _ = win_clone.set_focus();
                                let _ = win_clone.emit("request-show", ());
                            }
                        }
                    }
                });
            }

            // Al perder el foco (blur), animar salida antes de ocultar solo si el ratón está fuera
            let win_blur = window.clone();
            let state_blur = app_state.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::Focused(false) = event {
                    let ignoring = *state_blur.ignoring_cursor.lock().unwrap();
                    // Solo ocultamos si el ratón está fuera del popup. Si está interactuando con Berto, NO ocultar.
                    if ignoring && win_blur.is_visible().unwrap_or(false) {
                        let _ = win_blur.emit("request-hide", ());
                    }
                }
            });

            // Hilo en segundo plano para sondeo del cursor global (Click-through y LookAt)
            let state_clone = app_state.clone();
            let win_loop = window.clone();
            thread::spawn(move || {
                let mut pt = POINT { x: 0, y: 0 };
                loop {
                    thread::sleep(Duration::from_millis(25)); // ~40 FPS

                    // Si la ventana no está visible, dormimos más tiempo y no consumimos CPU
                    if !win_loop.is_visible().unwrap_or(false) {
                        thread::sleep(Duration::from_millis(150));
                        continue;
                    }

                    if unsafe { GetCursorPos(&mut pt) } != 0 {
                        if let (Ok(win_pos), Ok(scale_factor)) =
                            (win_loop.outer_position(), win_loop.scale_factor())
                        {
                            // Coordenadas del cursor relativas a la ventana en píxeles lógicos
                            let rel_x = (pt.x as f64 - win_pos.x as f64) / scale_factor;
                            let rel_y = (pt.y as f64 - win_pos.y as f64) / scale_factor;

                            let is_inside = if let Some(bounds) = *state_clone.interactive_bounds.lock().unwrap() {
                                let in_capsule = rel_x >= bounds.capsule.x
                                    && rel_x <= (bounds.capsule.x + bounds.capsule.width)
                                    && rel_y >= bounds.capsule.y
                                    && rel_y <= (bounds.capsule.y + bounds.capsule.height);
                                let in_avatar = if let Some(av) = bounds.avatar {
                                    rel_x >= av.x
                                        && rel_x <= (av.x + av.width)
                                        && rel_y >= av.y
                                        && rel_y <= (av.y + av.height)
                                } else {
                                    false
                                };
                                in_capsule || in_avatar
                            } else {
                                false
                            };

                            // Control de click-through
                            let should_ignore = !is_inside;
                            let mut ignoring = state_clone.ignoring_cursor.lock().unwrap();
                            if *ignoring != should_ignore {
                                let _ = win_loop.set_ignore_cursor_events(should_ignore);
                                *ignoring = should_ignore;
                            }

                            // Emitir coordenadas para orientar los ojos del avatar
                            let _ = win_loop.emit(
                                "cursor-moved",
                                serde_json::json!({
                                    "rel_x": rel_x,
                                    "rel_y": rel_y,
                                    "screen_x": pt.x,
                                    "screen_y": pt.y,
                                    "is_inside": is_inside
                                }),
                            );
                        }
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
