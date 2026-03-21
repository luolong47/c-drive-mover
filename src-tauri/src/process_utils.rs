use std::process::Command;

#[tauri::command]
pub fn kill_processes(process_names: Vec<String>) -> Result<(), String> {
    #[cfg(windows)]
    {
        for name in process_names {
            let _ = Command::new("taskkill")
                .args(["/F", "/IM", &name])
                .output();
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        Err("Not supported on this OS".to_string())
    }
}
