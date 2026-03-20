use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use sysinfo::Disks;
use tauri::{AppHandle, Manager, State};
use walkdir::WalkDir;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DiskInfo {
    pub name: String,
    pub mount_point: String,
    pub total_space: u64,
    pub available_space: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TaskSource {
    pub path: String,
    pub size: u64,
}

fn now_timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MoveTask {
    pub id: String,
    pub name: String,
    pub target_base: String,
    pub sources: Vec<TaskSource>,
    pub status: String, // "pending", "running", "success", "failed"
    pub error: Option<String>,
    pub created_at: i64,
    pub finished_at: Option<i64>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppSettings {
    pub default_target_base: String,
    pub silent_check: bool,
    pub blacklist: Vec<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            default_target_base: "D:\\Cdrive-Mover".to_string(),
            silent_check: true,
            blacklist: vec![
                "C:\\Windows".to_string(),
                "C:\\Program Files".to_string(),
                "C:\\Program Files (x86)".to_string(),
            ],
        }
    }
}

pub struct DbState(Mutex<Connection>);

fn get_config_dir(app_handle: &AppHandle) -> PathBuf {
    let path = app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    if !path.exists() {
        fs::create_dir_all(&path).ok();
    }
    path
}

fn get_db_path(app_handle: &AppHandle) -> PathBuf {
    let mut path = get_config_dir(app_handle);
    path.push("tasks.db");
    path
}

fn get_settings_file(app_handle: &AppHandle) -> PathBuf {
    let mut path = get_config_dir(app_handle);
    path.push("settings.json");
    path
}

#[tauri::command]
fn get_settings(app: AppHandle) -> AppSettings {
    let path = get_settings_file(&app);
    if !path.exists() {
        return AppSettings::default();
    }
    let content = fs::read_to_string(path).unwrap_or_default();
    serde_json::from_str(&content).unwrap_or_else(|_| AppSettings::default())
}

#[tauri::command]
fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    let content = serde_json::to_string(&settings).map_err(|e| e.to_string())?;
    fs::write(get_settings_file(&app), content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_disk_info() -> Vec<DiskInfo> {
    let disks = Disks::new_with_refreshed_list();
    disks
        .iter()
        .map(|disk| DiskInfo {
            name: disk.name().to_string_lossy().into_owned(),
            mount_point: disk.mount_point().to_string_lossy().into_owned(),
            total_space: disk.total_space(),
            available_space: disk.available_space(),
        })
        .collect()
}

#[tauri::command]
fn scan_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let home_dir = dirs::home_dir().unwrap_or_default();
    let temp_exclude = home_dir.join("AppData").join("Local").join("Temp");
    let temp_exclude_str = temp_exclude.to_string_lossy().to_lowercase();

    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;
    let mut result = Vec::new();

    for entry in entries {
        if let Ok(entry) = entry {
            let entry_path = entry.path();
            let entry_path_str = entry_path.to_string_lossy().to_lowercase();

            if entry_path_str == temp_exclude_str {
                continue;
            }

            let metadata = entry.metadata().ok();
            let is_dir = metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false);

            if is_dir {
                result.push(FileEntry {
                    name: entry.file_name().to_string_lossy().into_owned(),
                    path: entry_path.to_string_lossy().into_owned(),
                    is_dir,
                    size: 0,
                });
            }
        }
    }
    Ok(result)
}

#[tauri::command]
async fn get_folder_size(path: String) -> u64 {
    let mut total_size = 0;
    for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
        if let Ok(metadata) = entry.metadata() {
            if metadata.is_file() {
                total_size += metadata.len();
            }
        }
    }
    total_size
}

#[tauri::command]
fn get_tasks(db: State<DbState>) -> Result<Vec<MoveTask>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, target_base, status, error, created_at, finished_at FROM tasks ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let task_iter = stmt
        .query_map([], |row| {
            Ok(MoveTask {
                id: row.get(0)?,
                name: row.get(1)?,
                target_base: row.get(2)?,
                status: row.get(3)?,
                error: row.get(4)?,
                created_at: row.get(5)?,
                finished_at: row.get(6)?,
                sources: Vec::new(),
            })
        })
        .map_err(|e| e.to_string())?;

    let mut tasks = Vec::new();
    for task in task_iter {
        let mut task = task.map_err(|e| e.to_string())?;
        let mut source_stmt = conn
            .prepare("SELECT path, size FROM task_sources WHERE task_id = ?")
            .map_err(|e| e.to_string())?;

        let source_iter = source_stmt
            .query_map([&task.id], |row| {
                Ok(TaskSource {
                    path: row.get(0)?,
                    size: row.get(1)?,
                })
            })
            .map_err(|e| e.to_string())?;

        for source in source_iter {
            task.sources.push(source.map_err(|e| e.to_string())?);
        }
        tasks.push(task);
    }
    Ok(tasks)
}

#[tauri::command]
fn save_task(db: State<DbState>, task: MoveTask) -> Result<(), String> {
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT INTO tasks (id, name, target_base, status, error, created_at, finished_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(id) DO UPDATE SET
            name=excluded.name,
            target_base=excluded.target_base,
            status=excluded.status,
            error=excluded.error,
            finished_at=excluded.finished_at",
        params![
            task.id,
            task.name,
            task.target_base,
            task.status,
            task.error,
            task.created_at,
            task.finished_at,
        ],
    )
    .map_err(|e| e.to_string())?;

    tx.execute("DELETE FROM task_sources WHERE task_id = ?", [&task.id])
        .map_err(|e| e.to_string())?;

    for source in &task.sources {
        tx.execute(
            "INSERT INTO task_sources (task_id, path, size) VALUES (?, ?, ?)",
            params![task.id, source.path, source.size],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn run_migration(db: State<'_, DbState>, task_id: String) -> Result<(), String> {
    let task = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id, name, target_base, status, error, created_at, finished_at FROM tasks WHERE id = ?")
            .map_err(|e| e.to_string())?;

        let mut task = stmt.query_row([&task_id], |row| {
            Ok(MoveTask {
                id: row.get(0)?,
                name: row.get(1)?,
                target_base: row.get(2)?,
                status: row.get(3)?,
                error: row.get(4)?,
                created_at: row.get(5)?,
                finished_at: row.get(6)?,
                sources: Vec::new(),
            })
        }).map_err(|_| "Task not found".to_string())?;

        let mut source_stmt = conn
            .prepare("SELECT path, size FROM task_sources WHERE task_id = ?")
            .map_err(|e| e.to_string())?;

        let source_iter = source_stmt
            .query_map([&task_id], |row| {
                Ok(TaskSource {
                    path: row.get(0)?,
                    size: row.get(1)?,
                })
            })
            .map_err(|e| e.to_string())?;

        for source in source_iter {
            task.sources.push(source.map_err(|e| e.to_string())?);
        }
        task
    };

    {
        let mut running_task = task.clone();
        running_task.status = "running".to_string();
        save_task(db.clone(), running_task)?;
    }

    let target_root = Path::new(&task.target_base).join(&task.name);
    let mut has_error = false;
    let mut error_msg = String::new();

    for source in &task.sources {
        let source_path = Path::new(&source.path);
        let folder_name = source_path.file_name().ok_or("Invalid source path")?;
        let target_path = target_root.join(folder_name);

        if let Some(parent) = target_path.parent() {
            if let Err(e) = fs::create_dir_all(parent) {
                has_error = true;
                error_msg = format!("Failed to create target parent: {}", e);
                break;
            }
        }

        let options = fs_extra::dir::CopyOptions::new().content_only(false);
        if let Err(e) = fs_extra::dir::move_dir(source_path, &target_root, &options) {
            has_error = true;
            error_msg = format!("无法移动目录 {}: {}", source.path, e);
            break;
        }

        #[cfg(windows)]
        {
            if let Err(e) = junction::create(&target_path, source_path) {
                has_error = true;
                error_msg = format!("无法为 {} 创建目录联接: {}", source.path, e);
                break;
            }
        }
    }

    let mut final_task = task.clone();
    if has_error {
        final_task.status = "failed".to_string();
        final_task.error = Some(error_msg.clone());
    } else {
        final_task.status = "success".to_string();
        final_task.finished_at = Some(now_timestamp());
    }
    save_task(db, final_task)?;

    if has_error {
        Err(error_msg)
    } else {
        Ok(())
    }
}

#[tauri::command]
async fn restore_task(db: State<'_, DbState>, task_id: String) -> Result<(), String> {
    let task = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id, name, target_base, status, error, created_at, finished_at FROM tasks WHERE id = ?")
            .map_err(|e| e.to_string())?;

        let mut task = stmt.query_row([&task_id], |row| {
            Ok(MoveTask {
                id: row.get(0)?,
                name: row.get(1)?,
                target_base: row.get(2)?,
                status: row.get(3)?,
                error: row.get(4)?,
                created_at: row.get(5)?,
                finished_at: row.get(6)?,
                sources: Vec::new(),
            })
        }).map_err(|_| "找不到任务".to_string())?;

        let mut source_stmt = conn
            .prepare("SELECT path, size FROM task_sources WHERE task_id = ?")
            .map_err(|e| e.to_string())?;

        let source_iter = source_stmt
            .query_map([&task_id], |row| {
                Ok(TaskSource {
                    path: row.get(0)?,
                    size: row.get(1)?,
                })
            })
            .map_err(|e| e.to_string())?;

        for source in source_iter {
            task.sources.push(source.map_err(|e| e.to_string())?);
        }
        task
    };

    let target_root = Path::new(&task.target_base).join(&task.name);
    let mut has_error = false;
    let mut error_msg = String::new();

    for source in &task.sources {
        let source_path = Path::new(&source.path);
        let folder_name = source_path.file_name().ok_or("Invalid path")?;
        let target_path = target_root.join(folder_name);

        #[cfg(windows)]
        {
            if source_path.exists() {
                if junction::exists(source_path).unwrap_or(false) {
                    if let Err(e) = std::fs::remove_dir(source_path) {
                        has_error = true;
                        error_msg = format!("无法删除联接 {}: {}", source.path, e);
                        break;
                    }
                } else {
                    has_error = true;
                    error_msg = format!("路径 {} 已存在且不是联接，无法还原", source.path);
                    break;
                }
            }
        }

        if target_path.exists() {
            let options = fs_extra::dir::CopyOptions::new().content_only(false);
            let parent = source_path.parent().unwrap();
            if let Err(e) = fs_extra::dir::move_dir(&target_path, parent, &options) {
                has_error = true;
                error_msg = format!("无法移回数据 {}: {}", source.path, e);
                break;
            }
        }
    }

    let mut final_task = task.clone();
    if has_error {
        final_task.status = "failed".to_string();
        final_task.error = Some(format!("还原失败: {}", error_msg));
    } else {
        final_task.status = "pending".to_string();
        final_task.error = None;
        final_task.finished_at = None;

        if target_root.exists() {
            let _ = std::fs::remove_dir(&target_root);
        }
    }
    save_task(db, final_task)?;

    if has_error {
        Err(error_msg)
    } else {
        Ok(())
    }
}

#[tauri::command]
fn get_home_dir() -> String {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|| "C:\\Users".to_string())
}

#[tauri::command]
fn search_everything(query: String) -> Result<Vec<FileEntry>, String> {
    use everything_sdk::{global, RequestFlags};

    let home_dir = dirs::home_dir()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|| "C:\\Users".to_string());

    let results = (|| -> Result<Vec<FileEntry>, String> {
        let mut everything = global()
            .try_lock()
            .map_err(|_| "Service not running".to_string())?;

        if !everything.is_db_loaded().map_err(|e| e.to_string())? {
            return Err("DB not loaded".to_string());
        }

        let mut searcher = everything.searcher();
        let temp_exclude = format!("{}\\AppData\\Local\\Temp", home_dir);

        searcher
            .set_search(&format!(
                "\"{}\" !\"{}\" folder: *{}*",
                home_dir, temp_exclude, query
            ))
            .set_max(100)
            .set_request_flags(
                RequestFlags::EVERYTHING_REQUEST_FILE_NAME | RequestFlags::EVERYTHING_REQUEST_PATH,
            );

        let query_results = searcher.query();
        let mut result = Vec::new();
        for item in query_results.iter() {
            let name = item
                .filename()
                .map_err(|e| e.to_string())?
                .to_string_lossy()
                .into_owned();
            let path = item
                .path()
                .map_err(|e| e.to_string())?
                .to_string_lossy()
                .into_owned();
            let full_path = format!("{}\\{}", path, name);

            result.push(FileEntry {
                name,
                path: full_path,
                is_dir: true,
                size: 0,
            });
        }
        Ok(result)
    })();

    match results {
        Ok(res) if !res.is_empty() => Ok(res),
        _ => Ok(search_fallback(&home_dir, &query)),
    }
}

fn search_fallback(home_dir: &str, query: &str) -> Vec<FileEntry> {
    let mut result = Vec::new();
    let query_lower = query.to_lowercase();

    let mut command = std::process::Command::new("busybox");
    command.args([
        "find",
        home_dir,
        "-maxdepth",
        "4",
        "-type",
        "d",
        "-iname",
        &format!("*{}*", query),
    ]);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let output = command.output();

    if let Ok(output) = output {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines().take(100) {
                let path = Path::new(line);
                if let Some(name) = path.file_name() {
                    result.push(FileEntry {
                        name: name.to_string_lossy().into_owned(),
                        path: line.to_string(),
                        is_dir: true,
                        size: 0,
                    });
                }
            }
            if !result.is_empty() {
                return result;
            }
        }
    }

    let temp_exclude = format!("{}\\AppData\\Local\\Temp", home_dir).to_lowercase();

    WalkDir::new(home_dir)
        .max_depth(4)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            let path_str = e.path().to_string_lossy().to_lowercase();
            e.file_type().is_dir() && !path_str.starts_with(&temp_exclude)
        })
        .filter(|e| {
            e.file_name()
                .to_string_lossy()
                .to_lowercase()
                .contains(&query_lower)
        })
        .take(100)
        .map(|e| FileEntry {
            name: e.file_name().to_string_lossy().into_owned(),
            path: e.path().to_string_lossy().into_owned(),
            is_dir: true,
            size: 0,
        })
        .collect()
}

#[tauri::command]
fn select_directory() -> Option<String> {
    rfd::FileDialog::new()
        .set_title("选择目标基础路径")
        .pick_folder()
        .map(|p| p.to_string_lossy().into_owned())
}

fn init_db(app_handle: &AppHandle) -> Result<(), String> {
    let db_path = get_db_path(app_handle);
    let mut conn = Connection::open(db_path).map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            target_base TEXT NOT NULL,
            status TEXT NOT NULL,
            error TEXT,
            created_at INTEGER NOT NULL,
            finished_at INTEGER
        )",
        [],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS task_sources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id TEXT NOT NULL,
            path TEXT NOT NULL,
            size INTEGER NOT NULL,
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
        )",
        [],
    )
    .map_err(|e| e.to_string())?;

    // 尝试从原本位于可执行文件旁的 Data 目录迁移（如果有）
    let old_data_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .map(|mut p| {
            p.push("Data");
            p
        });

    if let Some(old_dir) = old_data_dir {
        let old_db = old_dir.join("tasks.db");
        if old_db.exists() && old_db != get_db_path(app_handle) {
            // 如果旧位置有数据库且不是当前位置，则尝试简单合并或提示（此处简单处理：如果新数据库为空则移动过来）
            // 注意：由于 Connection 已打开，此处不适合直接移动文件。
            // 实际上对于开发环境，只要指向了 AppData，以后就不会再被清理。
        }

        // 兼容旧的 JSON 迁移
        let tasks_json_path = old_dir.join("tasks.json");
        if tasks_json_path.exists() {
            if let Ok(content) = fs::read_to_string(&tasks_json_path) {
                if let Ok(tasks) = serde_json::from_str::<Vec<MoveTask>>(&content) {
                    let tx = conn.transaction().map_err(|e| e.to_string())?;
                    for task in tasks {
                        tx.execute(
                            "INSERT OR IGNORE INTO tasks (id, name, target_base, status, error, created_at, finished_at)
                             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                            params![
                                task.id,
                                task.name,
                                task.target_base,
                                task.status,
                                task.error,
                                task.created_at,
                                task.finished_at,
                            ],
                        ).ok();
                        for source in task.sources {
                            tx.execute(
                                "INSERT INTO task_sources (task_id, path, size) VALUES (?, ?, ?)",
                                params![task.id, source.path, source.size],
                            ).ok();
                        }
                    }
                    tx.commit().ok();
                }
            }
            let _ = fs::rename(&tasks_json_path, old_dir.join("tasks.json.bak"));
        }
    }

    app_handle.manage(DbState(Mutex::new(conn)));
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_log::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            get_disk_info,
            scan_directory,
            get_folder_size,
            get_tasks,
            save_task,
            run_migration,
            restore_task,
            get_home_dir,
            search_everything,
            select_directory,
            get_settings,
            save_settings
        ])
        .setup(|app| {
            init_db(app.handle())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
