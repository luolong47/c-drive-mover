use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Read;
use std::path::Path;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use sysinfo::Disks;
use tauri::{AppHandle, Manager, State, Emitter};
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
    pub is_junction: bool,
    pub target_path: Option<String>,
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
    pub common_prefix: String,
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
    pub webdav_url: Option<String>,
    pub webdav_username: Option<String>,
    pub webdav_password: Option<String>,
    pub webdav_folder: Option<String>,
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
            webdav_url: None,
            webdav_username: None,
            webdav_password: None,
            webdav_folder: Some("c-drive-mover".to_string()),
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
    path.push("c-drive-mover.db");
    path
}

#[tauri::command]
fn get_settings(db: State<DbState>) -> AppSettings {
    let conn = db.0.lock().unwrap();
    let stmt = conn
        .prepare("SELECT value FROM settings WHERE key = 'app_settings'")
        .ok();

    if let Some(mut stmt) = stmt {
        let settings_json: Option<String> = stmt
            .query_row([], |row| row.get(0))
            .ok();

        if let Some(json) = settings_json {
            if let Ok(settings) = serde_json::from_str(&json) {
                return settings;
            }
        }
    }
    AppSettings::default()
}

#[tauri::command]
fn save_settings(db: State<DbState>, settings: AppSettings) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let json = serde_json::to_string(&settings).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO settings (key, value) VALUES ('app_settings', ?1)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        params![json],
    )
    .map_err(|e| e.to_string())?;
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

fn is_blacklisted(path: &Path, blacklist: &[String]) -> bool {
    let path_str = path.to_string_lossy().to_lowercase();
    let path_fixed = path_str.replace("/", "\\");
    let path_norm = PathBuf::from(path_fixed);

    blacklist.iter().any(|b| {
        let b_fixed = b.to_lowercase().replace("/", "\\");
        let b_norm = PathBuf::from(b_fixed);
        path_norm == b_norm || path_norm.starts_with(&b_norm)
    })
}

#[tauri::command]
fn scan_directory(db: State<DbState>, path: String) -> Result<Vec<FileEntry>, String> {
    let settings = get_settings(db);
    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;
    let mut result = Vec::new();

    for entry in entries.flatten() {
        let entry_path = entry.path();
        
        if is_blacklisted(&entry_path, &settings.blacklist) {
            continue;
        }

        // 使用 symlink_metadata 避免跟随链接
        let metadata = fs::symlink_metadata(&entry_path).ok();
        if let Some(meta) = metadata {
            let is_dir = meta.is_dir();
            let is_junction = junction::exists(&entry_path).unwrap_or(false);
            
            // 如果是 Junction，它在 Windows 上元数据中 is_dir 也是 true
            // 或者如果是符号链接且指向目录，我们也认为它是目录
            if is_dir || is_junction {
                let target_path = if is_junction {
                    std::fs::read_link(&entry_path).ok().map(|p| p.to_string_lossy().into_owned())
                } else {
                    None
                };
                result.push(FileEntry {
                    name: entry.file_name().to_string_lossy().into_owned(),
                    path: entry_path.to_string_lossy().into_owned(),
                    is_dir: true,
                    is_junction,
                    target_path,
                    size: 0,
                });
            }
        }
    }
    Ok(result)
}

#[tauri::command]
fn get_folder_size(path: String) -> u64 {
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
fn delete_task(db: State<DbState>, task_id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM tasks WHERE id = ?", [&task_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_tasks(db: State<DbState>) -> Result<Vec<MoveTask>, String> {
    get_tasks_impl(&db)
}

fn get_tasks_impl(db: &DbState) -> Result<Vec<MoveTask>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, target_base, common_prefix, status, error, created_at, finished_at FROM tasks ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let task_iter = stmt
        .query_map([], |row| {
            Ok(MoveTask {
                id: row.get(0)?,
                name: row.get(1)?,
                target_base: row.get(2)?,
                common_prefix: row.get(3)?,
                status: row.get(4)?,
                error: row.get(5)?,
                created_at: row.get(6)?,
                finished_at: row.get(7)?,
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

fn replace_user_dir(path: &str, current_home: &str) -> String {
    let lower_path = path.to_lowercase();
    if lower_path.starts_with("c:\\users\\") {
        let parts: Vec<&str> = path.splitn(4, '\\').collect();
        if parts.len() >= 3 {
            if parts.len() == 4 {
                return format!("{}\\{}", current_home, parts[3]);
            } else {
                return current_home.to_string();
            }
        }
    }
    path.to_string()
}

#[tauri::command]
fn check_plans(db: State<'_, DbState>) -> Result<usize, String> {
    let tasks = get_tasks_impl(&db)?;
    let mut updated_count = 0;
    
    for task in tasks.into_iter().filter(|t| t.status == "success") {
        let mut needs_migration = false;
        
        let target_root = std::path::Path::new(&task.target_base).join(&task.name);

        for source in &task.sources {
            let source_path = std::path::Path::new(&source.path);
            
            let rel_path = if !task.common_prefix.is_empty() && source.path.starts_with(&task.common_prefix) {
                &source.path[task.common_prefix.len()..]
            } else {
                source_path.file_name().and_then(|n| n.to_str()).unwrap_or("")
            };
            let rel_path = rel_path.trim_start_matches('\\').trim_start_matches('/');
            let target_path = target_root.join(rel_path);

            let is_junction = {
                #[cfg(windows)]
                {
                    junction::exists(source_path).unwrap_or(false)
                }
                #[cfg(not(windows))]
                {
                    source_path.read_link().is_ok()
                }
            };

            if (!source_path.exists() || !is_junction) && target_path.exists() {
                needs_migration = true;
                break;
            }
        }
        
        if needs_migration {
            let conn = db.0.lock().map_err(|e| e.to_string())?;
            conn.execute(
                "UPDATE tasks SET status = 'pending' WHERE id = ?",
                [&task.id],
            ).map_err(|e| e.to_string())?;
            updated_count += 1;
        }
    }
    
    Ok(updated_count)
}

#[tauri::command]
fn fix_user_directories(db: State<'_, DbState>) -> Result<usize, String> {
    let home_dir = dirs::home_dir().ok_or("无法获取当前用户目录")?;
    let current_home = home_dir.to_string_lossy().to_string();
    
    let tasks = get_tasks_impl(&db)?;
    let mut updated_count = 0;
    
    for mut task in tasks {
        let mut modified = false;
        
        let new_prefix = replace_user_dir(&task.common_prefix, &current_home);
        if new_prefix != task.common_prefix {
            task.common_prefix = new_prefix;
            modified = true;
        }
        
        for source in &mut task.sources {
            let new_path = replace_user_dir(&source.path, &current_home);
            if new_path != source.path {
                // Update source path in DB
                let conn = db.0.lock().map_err(|e| e.to_string())?;
                conn.execute(
                    "UPDATE task_sources SET path = ? WHERE task_id = ? AND path = ?",
                    params![new_path, task.id, source.path],
                ).map_err(|e| e.to_string())?;
                source.path = new_path;
                modified = true;
            }
        }
        
        if modified {
            let conn = db.0.lock().map_err(|e| e.to_string())?;
            conn.execute(
                "UPDATE tasks SET common_prefix = ? WHERE id = ?",
                params![task.common_prefix, task.id],
            ).map_err(|e| e.to_string())?;
            updated_count += 1;
        }
    }
    
    Ok(updated_count)
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LogEntry {
    pub id: i64,
    pub task_id: String,
    pub msg: String,
    pub event_type: String,
    pub created_at: i64,
}

#[tauri::command]
fn get_task_logs(db: State<DbState>, task_id: String) -> Result<Vec<LogEntry>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, task_id, msg, event_type, created_at FROM task_logs WHERE task_id = ? ORDER BY created_at ASC")
        .map_err(|e| e.to_string())?;

    let log_iter = stmt
        .query_map([&task_id], |row| {
            Ok(LogEntry {
                id: row.get(0)?,
                task_id: row.get(1)?,
                msg: row.get(2)?,
                event_type: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut logs = Vec::new();
    for log in log_iter {
        logs.push(log.map_err(|e| e.to_string())?);
    }
    Ok(logs)
}

#[tauri::command]
fn save_task(db: State<DbState>, task: MoveTask) -> Result<(), String> {
    _save_task(&db, task)
}

fn _save_task(db: &DbState, task: MoveTask) -> Result<(), String> {
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT INTO tasks (id, name, target_base, common_prefix, status, error, created_at, finished_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(id) DO UPDATE SET
            name=excluded.name,
            target_base=excluded.target_base,
            common_prefix=excluded.common_prefix,
            status=excluded.status,
            error=excluded.error,
            finished_at=excluded.finished_at",
        params![
            task.id,
            task.name,
            task.target_base,
            task.common_prefix,
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

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MigrationEvent {
    pub msg: String,
    pub event_type: String, // "info", "warn", "error", "success"
}

fn emit_log(app_handle: &AppHandle, db: Option<&DbState>, task_id: &str, msg: String, event_type: &str) {
    let now = now_timestamp();
    let _ = app_handle.emit(
        "migration-log",
        MigrationEvent {
            msg: msg.clone(),
            event_type: event_type.to_string(),
        },
    );

    if let Some(db_state) = db {
        if let Ok(conn) = db_state.0.lock() {
            let _ = conn.execute(
                "INSERT INTO task_logs (task_id, msg, event_type, created_at) VALUES (?, ?, ?, ?)",
                params![task_id, msg, event_type, now],
            );
        }
    }
}

#[tauri::command]
fn run_migration(
    app_handle: AppHandle,
    db: State<'_, DbState>,
    task_id: String,
) -> Result<(), String> {
    // 清除旧日志
    {
        if let Ok(conn) = db.0.lock() {
            let _ = conn.execute("DELETE FROM task_logs WHERE task_id = ?", [&task_id]);
        }
    }

    emit_log(&app_handle, Some(&db), &task_id, format!("开始执行任务: {}", task_id), "info");
    log::info!("Starting migration for task ID: {}", task_id);
    let task = {
        let conn = db.0.lock().map_err(|e| {
            log::error!("Database lock failed: {}", e);
            e.to_string()
        })?;
        let mut stmt = conn
            .prepare("SELECT id, name, target_base, common_prefix, status, error, created_at, finished_at FROM tasks WHERE id = ?")
            .map_err(|e| e.to_string())?;

        let mut task = stmt.query_row([&task_id], |row| {
            Ok(MoveTask {
                id: row.get(0)?,
                name: row.get(1)?,
                target_base: row.get(2)?,
                common_prefix: row.get(3)?,
                status: row.get(4)?,
                error: row.get(5)?,
                created_at: row.get(6)?,
                finished_at: row.get(7)?,
                sources: Vec::new(),
            })
        })
.map_err(|e| {
            log::error!("Task {} not found in database: {}", task_id, e);
            "找不到指定的迁移任务".to_string()
        })?;

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

    emit_log(
        &app_handle,
        Some(&db),
        &task_id,
        format!("任务准备就绪: {}, 源目录数: {}", task.name, task.sources.len()),
        "info",
    );

    log::info!("Updating task status to 'running'...");
    {
        let mut running_task = task.clone();
        running_task.status = "running".to_string();
        running_task.error = None;
        _save_task(&db, running_task).map_err(|e| {
            log::error!("Failed to save 'running' status: {}", e);
            e
        })?;
    }

    let target_root = Path::new(&task.target_base).join(&task.name);
    log::info!("Target root directory: {:?}", target_root);

    let mut has_error = false;
    let mut error_msg = String::new();

    for source in &task.sources {
        let source_path = Path::new(&source.path);
        
        // 计算相对路径：如果定义了公共前缀，则保留前缀之后的层级；否则仅使用文件夹名
        let rel_path = if !task.common_prefix.is_empty() && source.path.starts_with(&task.common_prefix) {
            &source.path[task.common_prefix.len()..]
        } else {
            source_path.file_name().ok_or("无效的源路径")?.to_str().ok_or("路径编码错误")?
        };
        
        // 清理相对路径开头的斜杠
        let rel_path = rel_path.trim_start_matches('\\').trim_start_matches('/');
        let target_path = target_root.join(rel_path);

        emit_log(
            &app_handle,
            Some(&db),
            &task_id,
            format!("正在处理: {}", source.path),
            "info",
        );
        log::info!("Processing source: {:?} -> {:?}", source_path, target_path);

        #[cfg(windows)]
        {
            if source_path.exists() && junction::exists(source_path).unwrap_or(false) {
                emit_log(&app_handle, Some(&db), &task_id, format!("目录已经是联接，跳过: {}", source.path), "info");
                log::info!("Directory is already a junction, skipping: {:?}", source_path);
                continue;
            }
        }

        if let Some(parent) = target_path.parent() {
            if !parent.exists() {
                log::info!("Creating target parent directory: {:?}", parent);
                if let Err(e) = fs::create_dir_all(parent) {
                    has_error = true;
                    error_msg = format!("无法创建目标父目录 {:?}: {}", parent, e);
                    emit_log(&app_handle, Some(&db), &task_id, error_msg.clone(), "error");
                    log::error!("{}", error_msg);
                    break;
                }
            }
        }

        if source_path.exists() {
            if target_path.exists() {
                has_error = true;
                error_msg = format!("目标目录已存在，迁移中止以防止数据覆盖: {:?}", target_path);
                emit_log(&app_handle, Some(&db), &task_id, error_msg.clone(), "error");
                log::error!("{}", error_msg);
                break;
            }

            emit_log(&app_handle, Some(&db), &task_id, "正在移动目录文件...".to_string(), "info");
            log::info!("Moving directory...");
            let options = fs_extra::dir::CopyOptions::new().content_only(false);
            
            // 注意：fs_extra::move_dir(src, dest, options) 会将 src 移动到 dest 目录下
            // 所以我们需要移动到 target_path 的父目录
            let target_parent = target_path.parent().ok_or("无效的目标路径")?;
            if let Err(e) = fs_extra::dir::move_dir(source_path, target_parent, &options) {
                has_error = true;
                error_msg = format!("无法移动目录 {}: {}. 请确保没有程序正在使用该目录。", source.path, e);
                emit_log(&app_handle, Some(&db), &task_id, error_msg.clone(), "error");
                log::error!("{}", error_msg);
                break;
            }
        } else {
            emit_log(&app_handle, Some(&db), &task_id, format!("源目录不存在，准备直接创建联接: {}", source.path), "info");
            log::info!("Source directory does not exist, checking target directly: {:?}", source_path);
            if !target_path.exists() {
                log::info!("Creating target directory: {:?}", target_path);
                if let Err(e) = fs::create_dir_all(&target_path) {
                    has_error = true;
                    error_msg = format!("无法创建目标目录 {:?}: {}", target_path, e);
                    emit_log(&app_handle, Some(&db), &task_id, error_msg.clone(), "error");
                    log::error!("{}", error_msg);
                    break;
                }
            }
        }

        if let Some(source_parent) = source_path.parent() {
            if !source_parent.exists() {
                log::info!("Creating source parent directory: {:?}", source_parent);
                if let Err(e) = fs::create_dir_all(source_parent) {
                    has_error = true;
                    error_msg = format!("无法创建源父目录 {:?}: {}", source_parent, e);
                    emit_log(&app_handle, Some(&db), &task_id, error_msg.clone(), "error");
                    log::error!("{}", error_msg);
                    break;
                }
            }
        }

        #[cfg(windows)]
        {
            emit_log(&app_handle, Some(&db), &task_id, "创建 Windows 目录联接 (Junction)...".to_string(), "info");
            log::info!("Creating junction point at {:?}", source_path);
            if let Err(e) = junction::create(&target_path, source_path) {
                has_error = true;
                error_msg = format!("无法为 {} 创建目录联接: {}. 迁移已完成但联接失败。", source.path, e);
                emit_log(&app_handle, Some(&db), &task_id, error_msg.clone(), "error");
                log::error!("{}", error_msg);
                break;
            }
        }
        emit_log(&app_handle, Some(&db), &task_id, format!("已成功迁移: {}", source.path), "success");
    }

    let mut final_task = task.clone();
    if has_error {
        log::warn!("Migration finished with error: {}", error_msg);
        final_task.status = "failed".to_string();
        final_task.error = Some(error_msg.clone());
        emit_log(&app_handle, Some(&db), &task_id, "迁移任务失败".to_string(), "error");
    } else {
        log::info!("Migration completed successfully!");
        final_task.status = "success".to_string();
        final_task.finished_at = Some(now_timestamp());
        final_task.error = None;
        emit_log(&app_handle, Some(&db), &task_id, "所有目录迁移成功完成！".to_string(), "success");
    }

    if let Err(e) = _save_task(&db, final_task) {
        log::error!("Failed to save final task status: {}", e);
        emit_log(&app_handle, Some(&db), &task_id, "任务已执行但保存状态失败".to_string(), "warn");
        return Err(format!("任务已执行但保存状态失败: {}", e));
    }

    if has_error {
        Err(error_msg)
    } else {
        Ok(())
    }
}

#[tauri::command]
fn restore_task(
    app_handle: AppHandle,
    db: State<'_, DbState>,
    task_id: String,
) -> Result<(), String> {
    // 清除旧日志
    {
        if let Ok(conn) = db.0.lock() {
            let _ = conn.execute("DELETE FROM task_logs WHERE task_id = ?", [&task_id]);
        }
    }

    emit_log(&app_handle, Some(&db), &task_id, format!("开始还原任务: {}", task_id), "info");
    log::info!("Starting restore for task ID: {}", task_id);
    let task = {
        let conn = db.0.lock().map_err(|e| {
            log::error!("Database lock failed: {}", e);
            e.to_string()
        })?;
        let mut stmt = conn
            .prepare("SELECT id, name, target_base, common_prefix, status, error, created_at, finished_at FROM tasks WHERE id = ?")
            .map_err(|e| e.to_string())?;

        let mut task = stmt.query_row([&task_id], |row| {
            Ok(MoveTask {
                id: row.get(0)?,
                name: row.get(1)?,
                target_base: row.get(2)?,
                common_prefix: row.get(3)?,
                status: row.get(4)?,
                error: row.get(5)?,
                created_at: row.get(6)?,
                finished_at: row.get(7)?,
                sources: Vec::new(),
            })
        })
.map_err(|e| {
            log::error!("Task {} not found: {}", task_id, e);
            "找不到指定的迁移任务".to_string()
        })?;

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

    log::info!("Updating task status to 'running' for restore...");
    {
        let mut running_task = task.clone();
        running_task.status = "running".to_string();
        _save_task(&db, running_task).map_err(|e| {
            log::error!("Failed to save status: {}", e);
            e
        })?;
    }

    let target_root = Path::new(&task.target_base).join(&task.name);
    let mut has_error = false;
    let mut error_msg = String::new();

    for source in &task.sources {
        let source_path = Path::new(&source.path);
        
        // 计算相对路径：如果定义了公共前缀，则保留前缀之后的层级；否则仅使用文件夹名
        let rel_path = if !task.common_prefix.is_empty() && source.path.starts_with(&task.common_prefix) {
            &source.path[task.common_prefix.len()..]
        } else {
            source_path.file_name().ok_or("无效的源路径")?.to_str().ok_or("路径编码错误")?
        };
        
        // 清理相对路径开头的斜杠
        let rel_path = rel_path.trim_start_matches('\\').trim_start_matches('/');
        let target_path = target_root.join(rel_path);

        emit_log(&app_handle, Some(&db), &task_id, format!("正在还原: {}", source.path), "info");
        log::info!("Restoring source: {:?} <- {:?}", source_path, target_path);

        #[cfg(windows)]
        {
            if source_path.exists() {
                log::info!("Checking if {:?} is a junction...", source_path);
                if junction::exists(source_path).unwrap_or(false) {
                    log::info!("Removing junction point at {:?}", source_path);
                    if let Err(e) = std::fs::remove_dir(source_path) {
                        has_error = true;
                        error_msg = format!("无法删除目录联接 {}: {}. 请检查权限或是否被占用。", source.path, e);
                        emit_log(&app_handle, Some(&db), &task_id, error_msg.clone(), "error");
                        log::error!("{}", error_msg);
                        break;
                    }
                } else {
                    has_error = true;
                    error_msg = format!("路径 {} 已存在且不是联接点，还原中止以防止数据覆盖。", source.path);
                    emit_log(&app_handle, Some(&db), &task_id, error_msg.clone(), "error");
                    log::error!("{}", error_msg);
                    break;
                }
            }
        }

        if target_path.exists() {
            emit_log(&app_handle, Some(&db), &task_id, "正在将数据移回 C 盘...".to_string(), "info");
            log::info!("Moving directory back to C drive...");
            let options = fs_extra::dir::CopyOptions::new().content_only(false);
            let parent = source_path.parent().ok_or("无法获取源路径父目录")?;
            if let Err(e) = fs_extra::dir::move_dir(&target_path, parent, &options) {
                has_error = true;
                error_msg = format!("无法将数据移回 {}: {}. 请确保目标位置可写。", source.path, e);
                emit_log(&app_handle, Some(&db), &task_id, error_msg.clone(), "error");
                log::error!("{}", error_msg);
                break;
            }
        } else {
            log::warn!("Target directory {:?} does not exist, skipping move.", target_path);
        }
        emit_log(&app_handle, Some(&db), &task_id, format!("已成功还原: {}", source.path), "success");
    }

    let mut final_task = task.clone();
    if has_error {
        log::error!("Restore failed: {}", error_msg);
        final_task.status = "failed".to_string();
        final_task.error = Some(format!("还原失败: {}", error_msg));
        emit_log(&app_handle, Some(&db), &task_id, "还原任务失败".to_string(), "error");
    } else {
        log::info!("Restore completed successfully!");
        final_task.status = "pending".to_string();
        final_task.error = None;
        final_task.finished_at = None;
        emit_log(&app_handle, Some(&db), &task_id, "所有目录还原成功完成！".to_string(), "success");

        if target_root.exists() {
            let _ = std::fs::remove_dir(&target_root);
        }
    }

    if let Err(e) = _save_task(&db, final_task) {
        log::error!("Failed to save final status: {}", e);
        emit_log(&app_handle, Some(&db), &task_id, "还原操作已执行但状态保存失败".to_string(), "warn");
        return Err(format!("还原操作已执行但状态保存失败: {}", e));
    }

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
fn search_everything(db: State<DbState>, query: String) -> Result<Vec<FileEntry>, String> {
    use everything_sdk::{global, RequestFlags};

    let settings = get_settings(db.clone());
    let home_dir = get_home_dir();

    let results = (|| -> Result<Vec<FileEntry>, String> {
        let mut everything = global()
            .try_lock()
            .map_err(|_| "Service not running".to_string())?;

        if !everything.is_db_loaded().map_err(|e| e.to_string())? {
            return Err("DB not loaded".to_string());
        }

        let mut searcher = everything.searcher();
        
        let mut exclude_clause = String::new();
        for b in &settings.blacklist {
            exclude_clause.push_str(&format!(" !\"{}\"", b));
        }

        searcher
            .set_search(format!(
                "\"{}\"{} folder: *{}*",
                home_dir, exclude_clause, query
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
            let is_junction = junction::exists(&full_path).unwrap_or(false);
            // 这里 Everything 搜索出来的全是 folder
            if is_junction || true { // it's already a folder search
                let target_path = if is_junction {
                    std::fs::read_link(&full_path).ok().map(|p| p.to_string_lossy().into_owned())
                } else {
                    None
                };
                result.push(FileEntry {
                    name,
                    path: full_path,
                    is_dir: true,
                    is_junction,
                    target_path,
                    size: 0,
                });
            }
        }
        Ok(result)
    })();

    match results {
        Ok(res) if !res.is_empty() => Ok(res),
        _ => Ok(search_fallback(db, &home_dir, &query)),
    }
}

fn search_fallback(db: State<DbState>, home_dir: &str, query: &str) -> Vec<FileEntry> {
    let settings = get_settings(db);
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
                if is_blacklisted(path, &settings.blacklist) {
                    continue;
                }
                if let Some(name) = path.file_name() {
                    let is_junction = junction::exists(line).unwrap_or(false);
                    let target_path = if is_junction {
                        std::fs::read_link(line).ok().map(|p| p.to_string_lossy().into_owned())
                    } else {
                        None
                    };
                    result.push(FileEntry {
                        name: name.to_string_lossy().into_owned(),
                        path: line.to_string(),
                        is_dir: true,
                        is_junction,
                        target_path,
                        size: 0,
                    });
                }
            }
            if !result.is_empty() {
                return result;
            }
        }
    }

    WalkDir::new(home_dir)
        .max_depth(4)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.file_type().is_dir() && !is_blacklisted(e.path(), &settings.blacklist)
        })
        .filter(|e| {
            e.file_name()
                .to_string_lossy()
                .to_lowercase()
                .contains(&query_lower)
        })
        .take(100)
        .map(|e| {
            let path_str = e.path().to_string_lossy().into_owned();
            let is_junction = junction::exists(e.path()).unwrap_or(false);
            let target_path = if is_junction {
                std::fs::read_link(e.path()).ok().map(|p| p.to_string_lossy().into_owned())
            } else {
                None
            };
            FileEntry {
                name: e.file_name().to_string_lossy().into_owned(),
                path: path_str,
                is_dir: true,
                is_junction,
                target_path,
                size: 0,
            }
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
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;

    conn.execute("PRAGMA foreign_keys = ON;", [])
        .map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            target_base TEXT NOT NULL,
            common_prefix TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL,
            error TEXT,
            created_at INTEGER NOT NULL,
            finished_at INTEGER
        )",
        [],
    )
    .map_err(|e| e.to_string())?;

    // Check if common_prefix column exists, if not, add it
    {
        let mut stmt = conn.prepare("PRAGMA table_info(tasks)").map_err(|e| e.to_string())?;
        let mut has_common_prefix = false;
        let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
        while let Some(row) = rows.next().map_err(|e| e.to_string())? {
            let name: String = row.get(1).map_err(|e| e.to_string())?;
            if name == "common_prefix" {
                has_common_prefix = true;
                break;
            }
        }
        if !has_common_prefix {
            conn.execute("ALTER TABLE tasks ADD COLUMN common_prefix TEXT NOT NULL DEFAULT ''", []).map_err(|e| e.to_string())?;
        }
    }

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

    conn.execute(
        "CREATE TABLE IF NOT EXISTS task_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id TEXT NOT NULL,
            msg TEXT NOT NULL,
            event_type TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
        )",
        [],
    )
    .map_err(|e| e.to_string())?;

    // --- Data Migration Logic ---
    let app_data_dir = app_handle.path().app_data_dir().unwrap_or_default();
    let exe_dir = std::env::current_exe().ok().and_then(|p| p.parent().map(|p| p.to_path_buf())).unwrap_or_default();

    // 1. Migrate from old tasks.db to current c-drive-mover.db
    let old_db_path = app_data_dir.join("tasks.db");
    if old_db_path.exists() {
        let old_conn = Connection::open(&old_db_path).ok();
        if let Some(old_conn) = old_conn {
             let stmt = old_conn.prepare("SELECT id, name, target_base, status, error, created_at, finished_at FROM tasks").ok();
             if let Some(mut stmt) = stmt {
                 let tasks_iter = stmt.query_map([], |row| {
                    Ok(MoveTask {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        target_base: row.get(2)?,
                        common_prefix: String::new(), // 旧数据默认为空
                        status: row.get(3)?,
                        error: row.get(4)?,
                        created_at: row.get(5)?,
                        finished_at: row.get(6)?,
                        sources: Vec::new(),
                    })
                 }).ok();
                 
                 if let Some(iter) = tasks_iter {
                     for task in iter.filter_map(|t| t.ok()) {
                         // Insert task
                         conn.execute("INSERT OR IGNORE INTO tasks (id, name, target_base, common_prefix, status, error, created_at, finished_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                            params![task.id, task.name, task.target_base, task.common_prefix, task.status, task.error, task.created_at, task.finished_at]).ok();
                         
                         // Migrate sources
                         let src_stmt = old_conn.prepare("SELECT path, size FROM task_sources WHERE task_id = ?").ok();
                         if let Some(mut src_stmt) = src_stmt {
                             let src_iter = src_stmt.query_map([&task.id], |r| Ok((r.get::<_, String>(0)?, r.get::<_, u64>(1)?))).ok();
                             if let Some(src_iter) = src_iter {
                                 for src in src_iter.filter_map(|s| s.ok()) {
                                     conn.execute("INSERT INTO task_sources (task_id, path, size) VALUES (?, ?, ?)", params![task.id, src.0, src.1]).ok();
                                 }
                             }
                         }
                     }
                 }
             }
        }
        let _ = fs::rename(&old_db_path, app_data_dir.join("tasks.db.bak"));
    }

    // 2. Migrate settings from JSON (AppData or ExeDir)
    let json_paths = vec![app_data_dir.join("settings.json"), exe_dir.join("Data").join("settings.json")];
    for jp in json_paths {
        if jp.exists() {
            if let Ok(content) = fs::read_to_string(&jp) {
                if let Ok(settings) = serde_json::from_str::<AppSettings>(&content) {
                    let json = serde_json::to_string(&settings).unwrap();
                    conn.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('app_settings', ?)", [json]).ok();
                }
            }
            let _ = fs::rename(&jp, jp.with_extension("json.bak"));
        }
    }

    app_handle.manage(DbState(Mutex::new(conn)));
    Ok(())
}

#[tauri::command]
async fn test_webdav_connection(settings: AppSettings) -> Result<(), String> {
    let url = settings.webdav_url.as_deref().ok_or("WebDAV URL 未配置")?;
    let username = settings.webdav_username.as_deref().ok_or("WebDAV 用户名未配置")?;
    let password = settings.webdav_password.as_deref().ok_or("WebDAV 密码未配置")?;
    let folder = settings.webdav_folder.as_deref().filter(|f| !f.trim().is_empty());

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| format!("无法初始化客户端: {}", e))?;

    let base_url = url.trim_end_matches('/');

    if let Some(folder_name) = folder {
        let folder_url = format!("{}/{}", base_url, folder_name.trim_matches('/'));
        
        // 1. 尝试创建文件夹 (MKCOL)
        let mkcol_res = client.request(reqwest::Method::from_bytes(b"MKCOL").unwrap(), &folder_url)
            .basic_auth(username, Some(password))
            .send()
            .await
            .map_err(|e| format!("MKCOL 请求失败: {}", e))?;

        let status = mkcol_res.status();
        if !status.is_success() && status != reqwest::StatusCode::METHOD_NOT_ALLOWED && status != reqwest::StatusCode::FORBIDDEN {
             let body = mkcol_res.text().await.unwrap_or_default();
             return Err(format!("创建目录失败 (HTTP {})\nURL: {}\n响应: {}", status, folder_url, body));
        }
        
        // 2. 验证路径是否可用
        let prop_res = client.request(reqwest::Method::from_bytes(b"PROPFIND").unwrap(), &folder_url)
            .basic_auth(username, Some(password))
            .header("Depth", "0")
            .send()
            .await
            .map_err(|e| format!("验证目录失败: {}", e))?;

        if !prop_res.status().is_success() {
            let status = prop_res.status();
            let body = prop_res.text().await.unwrap_or_default();
            return Err(format!("远程目录验证失败 (HTTP {})\n请检查文件夹名是否包含无效字符。\nURL: {}\n响应: {}", status, folder_url, body));
        }
    } else {
        let res = client.request(reqwest::Method::from_bytes(b"PROPFIND").unwrap(), base_url)
            .basic_auth(username, Some(password))
            .header("Depth", "0")
            .send()
            .await
            .map_err(|e| format!("连接基础 URL 失败: {}", e))?;

        if !res.status().is_success() {
            let status = res.status();
            let body = res.text().await.unwrap_or_default();
            return Err(format!("认证失败或服务器不可用 (HTTP {})\nURL: {}\n响应: {}", status, base_url, body));
        }
    }

    Ok(())
}

#[tauri::command]
async fn webdav_backup(app_handle: AppHandle, settings: AppSettings) -> Result<(), String> {
    let url = settings.webdav_url.as_deref().ok_or("WebDAV URL 未配置")?;
    let username = settings.webdav_username.as_deref().ok_or("WebDAV 用户名未配置")?;
    let password = settings.webdav_password.as_deref().ok_or("WebDAV 密码未配置")?;
    let folder = settings.webdav_folder.as_deref().filter(|f| !f.trim().is_empty());

    let db_path = get_db_path(&app_handle);
    if !db_path.exists() {
        return Err("找不到数据库文件".to_string());
    }

    let mut file = fs::File::open(&db_path).map_err(|e| e.to_string())?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer).map_err(|e| e.to_string())?;

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    let base_url = url.trim_end_matches('/');

    // 预检：确保文件夹存在
    if let Some(f) = folder {
        let folder_url = format!("{}/{}", base_url, f.trim_matches('/'));
        let _ = client.request(reqwest::Method::from_bytes(b"MKCOL").unwrap(), &folder_url)
            .basic_auth(username, Some(password))
            .send()
            .await;
    }

    let target_url = if let Some(f) = folder {
        format!("{}/{}/c-drive-mover.db", base_url, f.trim_matches('/'))
    } else {
        format!("{}/c-drive-mover.db", base_url)
    };

    let res = client.put(&target_url)
        .basic_auth(username, Some(password))
        .body(buffer)
        .send()
        .await
        .map_err(|e| format!("PUT 请求发送失败: {}", e))?;

    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        return Err(format!("WebDAV 备份上传失败 (HTTP {})\n目标 URL: {}\n后端视角下的目录名: {:?}\n响应: {}", 
            status, target_url, folder, body));
    }

    Ok(())
}

#[tauri::command]
async fn webdav_restore(app_handle: AppHandle, db: State<'_, DbState>) -> Result<(), String> {
    let settings = get_settings(db.clone());
    let url = settings.webdav_url.as_deref().ok_or("WebDAV URL 未配置")?;
    let username = settings.webdav_username.as_deref().ok_or("WebDAV 用户名未配置")?;
    let password = settings.webdav_password.as_deref().ok_or("WebDAV 密码未配置")?;
    let folder = settings.webdav_folder.as_deref().filter(|f| !f.trim().is_empty());

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    let base_url = url.trim_end_matches('/');
    let target_url = if let Some(f) = folder {
        format!("{}/{}/c-drive-mover.db", base_url, f.trim_matches('/'))
    } else {
        format!("{}/c-drive-mover.db", base_url)
    };

    let res = client.get(&target_url)
        .basic_auth(username, Some(password))
        .send()
        .await
        .map_err(|e| format!("GET 请求发送失败: {}", e))?;

    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        return Err(format!("WebDAV 恢复下载失败 (HTTP {})\n目标 URL: {}\n响应: {}", status, target_url, body));
    }

    let buffer = res.bytes().await.map_err(|e| e.to_string())?;
    
    let db_path = get_db_path(&app_handle);
    let tmp_path = db_path.with_extension("db.tmp");

    // 先写入临时文件，确保下载完整
    fs::write(&tmp_path, buffer).map_err(|e| e.to_string())?;

    // 只有临时文件写入成功后，才关闭数据库连接并覆盖
    {
        let mut conn = db.0.lock().map_err(|e| e.to_string())?;
        // 暂时替换为内存数据库以释放原文件句柄
        *conn = Connection::open_in_memory().map_err(|e| e.to_string())?;
    }

    // 执行覆盖操作
    fs::rename(&tmp_path, &db_path).map_err(|e| e.to_string())?;

    // 重启应用
    app_handle.restart();

    #[allow(unreachable_code)]
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            get_disk_info,
            scan_directory,
            get_folder_size,
            delete_task,
            get_tasks,
            check_plans,
            fix_user_directories,
            get_task_logs,
            save_task,
            run_migration,
            restore_task,
            get_home_dir,
            search_everything,
            select_directory,
            get_settings,
            save_settings,
            webdav_backup,
            webdav_restore,
            test_webdav_connection
        ])
        .setup(|app| {
            init_db(app.handle())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
