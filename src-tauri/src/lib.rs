use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use sysinfo::Disks;
use walkdir::WalkDir;
use std::time::{SystemTime, UNIX_EPOCH};

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

fn get_tasks_file() -> PathBuf {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("c-drive-mover");
    if !path.exists() {
        fs::create_dir_all(&path).ok();
    }
    path.push("tasks.json");
    path
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

            // 排除 Temp 目录
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
fn get_tasks() -> Result<Vec<MoveTask>, String> {
    let path = get_tasks_file();
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let tasks: Vec<MoveTask> = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(tasks)
}

#[tauri::command]
fn save_task(task: MoveTask) -> Result<(), String> {
    let mut tasks = get_tasks().unwrap_or_default();
    
    // Replace if exists, otherwise add
    if let Some(index) = tasks.iter().position(|t| t.id == task.id) {
        tasks[index] = task;
    } else {
        tasks.push(task);
    }

    let content = serde_json::to_string(&tasks).map_err(|e| e.to_string())?;
    fs::write(get_tasks_file(), content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn run_migration(task_id: String) -> Result<(), String> {
    let mut tasks = get_tasks()?;
    let task_index = tasks.iter().position(|t| t.id == task_id).ok_or("Task not found")?;
    
    // Mark as running
    tasks[task_index].status = "running".to_string();
    save_task(tasks[task_index].clone())?;

    let task = tasks[task_index].clone();
    let target_root = Path::new(&task.target_base).join(&task.name);
    
    // Process sources
    let mut has_error = false;
    let mut error_msg = String::new();

    for source in &task.sources {
        let source_path = Path::new(&source.path);
        let folder_name = source_path.file_name().unwrap();
        let target_path = target_root.join(folder_name);

        // Ensure parent exists
        if let Some(parent) = target_path.parent() {
            if let Err(e) = fs::create_dir_all(parent) {
                has_error = true;
                error_msg = format!("Failed to create target parent: {}", e);
                break;
            }
        }

        // 1. 移动实际目录
        // 注意：fs_extra::dir::move_dir(from, to, options) 会将 from 移动到 to 目录下
        // 假设 source_path 是 C:\Game, target_root 是 D:\Backup\MyTask
        // 移动后会变成 D:\Backup\MyTask\Game
        let options = fs_extra::dir::CopyOptions::new().content_only(false);
        if let Err(e) = fs_extra::dir::move_dir(source_path, &target_root, &options) {
             has_error = true;
             error_msg = format!("无法移动目录 {}: {}", source.path, e);
             break;
        }

        // 2. 在原位置创建 Junction
        // 逻辑：在 C:\Game (已消失) 创建联接，指向 D:\Backup\MyTask\Game
        #[cfg(windows)]
        {
            if let Err(e) = junction::create(&target_path, source_path) {
                has_error = true;
                error_msg = format!("无法为 {} 创建目录联接: {}", source.path, e);
                break;
            }
        }
    }

    // Refresh tasks for update
    let mut tasks = get_tasks()?;
    if has_error {
        tasks[task_index].status = "failed".to_string();
        tasks[task_index].error = Some(error_msg.clone());
    } else {
        tasks[task_index].status = "success".to_string();
        tasks[task_index].finished_at = Some(now_timestamp());
    }
    save_task(tasks[task_index].clone())?;

    if has_error {
        Err(error_msg)
    } else {
        Ok(())
    }
}

#[tauri::command]
async fn restore_task(task_id: String) -> Result<(), String> {
    let tasks = get_tasks()?;
    let task_index = tasks.iter().position(|t| t.id == task_id).ok_or("找不到任务")?;
    
    let task = tasks[task_index].clone();
    let target_root = Path::new(&task.target_base).join(&task.name);

    let mut has_error = false;
    let mut error_msg = String::new();

    for source in &task.sources {
        let source_path = Path::new(&source.path);
        let folder_name = source_path.file_name().unwrap();
        let target_path = target_root.join(folder_name);

        // 1. 删除原位置的 Junction
        #[cfg(windows)]
        {
            if source_path.exists() {
                // 确保它是一个联接
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

        // 2. 将数据移回 C 盘
        if target_path.exists() {
            let options = fs_extra::dir::CopyOptions::new().content_only(false);
            // target_path 是 D:\Backup\MyTask\Game, parent 是 C:\
            let parent = source_path.parent().unwrap();
            if let Err(e) = fs_extra::dir::move_dir(&target_path, parent, &options) {
                has_error = true;
                error_msg = format!("无法移回数据 {}: {}", source.path, e);
                break;
            }
        }
    }

    // 更新任务状态
    let mut tasks = get_tasks()?;
    if has_error {
        tasks[task_index].status = "failed".to_string();
        tasks[task_index].error = Some(format!("还原失败: {}", error_msg));
    } else {
        tasks[task_index].status = "pending".to_string(); // 重置为待处理
        tasks[task_index].error = None;
        tasks[task_index].finished_at = None;
        
        // 清理目标根目录（如果为空）
        if target_root.exists() {
            let _ = std::fs::remove_dir(&target_root);
        }
    }
    save_task(tasks[task_index].clone())?;

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

    // 获取用户主目录作为搜索基准
    let home_dir = dirs::home_dir()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|| "C:\\Users".to_string());

    // 获取 Everything 全局锁
    let mut everything = global().try_lock().map_err(|_| "无法获取 Everything 锁，请检查是否已启动 Everything 且没有其他查询正在运行")?;
    
    // 检查数据库是否加载
    if !everything.is_db_loaded().map_err(|e| e.to_string())? {
        return Err("Everything 数据库尚未加载完成".to_string());
    }

    let mut searcher = everything.searcher();
    
    let temp_exclude = format!("{}\\AppData\\Local\\Temp", home_dir);

    // 限制在主目录下搜索文件夹，并排除 Temp 目录
    searcher.set_search(&format!("\"{}\" !\"{}\" folder: {}", home_dir, temp_exclude, query))
            .set_max(100)
            .set_request_flags(RequestFlags::EVERYTHING_REQUEST_FILE_NAME | RequestFlags::EVERYTHING_REQUEST_PATH);
    
    // 执行搜索
    let results = searcher.query();

    let mut result = Vec::new();
    for item in results.iter() {
        let name = item.filename().map_err(|e| e.to_string())?.to_string_lossy().into_owned();
        let path = item.path().map_err(|e| e.to_string())?.to_string_lossy().into_owned();
        let full_path = format!("{}\\{}", path, name);

        result.push(FileEntry {
            name,
            path: full_path,
            is_dir: true,
            size: 0,
        });
    }
    Ok(result)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
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
        search_everything
    ])
    .setup(|_app| {
        Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
