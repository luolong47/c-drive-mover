use std::path::Path;

#[cfg(windows)]
pub fn get_locking_processes(path: &Path) -> Result<Vec<String>, String> {
    use std::os::windows::ffi::OsStrExt;
    use sysinfo::System;
    use windows::core::{PCWSTR, PWSTR};
    use windows::Win32::Foundation::{ERROR_MORE_DATA, ERROR_SUCCESS};
    use windows::Win32::System::RestartManager::{
        RmEndSession, RmGetList, RmRegisterResources, RmStartSession, CCH_RM_SESSION_KEY,
        RM_PROCESS_INFO,
    };
    use std::fs::OpenOptions;
    #[cfg(windows)]
    use std::os::windows::fs::OpenOptionsExt;

    let mut session_handle: u32 = 0;
    let mut session_key = [0u16; CCH_RM_SESSION_KEY as usize + 1];

    let mut files_to_check = Vec::new();
    if path.is_dir() {
        for entry in walkdir::WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() {
                let p = entry.path();
                let mut opts = OpenOptions::new();
                opts.write(true);
                #[cfg(windows)]
                opts.share_mode(0); // 要求独占访问，如果别人在用就会抛错

                if opts.open(p).is_err() {
                    files_to_check.push(p.to_path_buf());
                    if files_to_check.len() > 50 {
                        break;
                    }
                }
            }
        }
    } else {
        files_to_check.push(path.to_path_buf());
    }

    if files_to_check.is_empty() {
        return Ok(Vec::new());
    }

    unsafe {
        let res = RmStartSession(
            &mut session_handle,
            None,
            PWSTR(session_key.as_mut_ptr()),
        );
        if res != ERROR_SUCCESS {
            return Err(format!("RmStartSession failed: {:?}", res));
        }

        let path_u16_vecs: Vec<Vec<u16>> = files_to_check
            .iter()
            .map(|p| {
                let mut v: Vec<u16> = p.as_os_str().encode_wide().collect();
                v.push(0);
                v
            })
            .collect();

        let files: Vec<PCWSTR> = path_u16_vecs.iter().map(|v| PCWSTR(v.as_ptr())).collect();
        let res = RmRegisterResources(session_handle, Some(&files), None, None);
        if res != ERROR_SUCCESS {
            let _ = RmEndSession(session_handle);
            return Err(format!("RmRegisterResources failed: {:?}", res));
        }

        let mut n_proc_info_needed: u32 = 0;
        let mut n_proc_info: u32 = 0;
        let mut lpdwrebootreasons: u32 = 0;

        // First call to get the required array size
        let mut res = RmGetList(
            session_handle,
            &mut n_proc_info_needed,
            &mut n_proc_info,
            None,
            &mut lpdwrebootreasons,
        );

        let mut process_info_array = Vec::new();

        if res == ERROR_MORE_DATA || res == ERROR_SUCCESS {
            n_proc_info = n_proc_info_needed;
            if n_proc_info > 0 {
                process_info_array.resize(n_proc_info as usize, RM_PROCESS_INFO::default());
                res = RmGetList(
                    session_handle,
                    &mut n_proc_info_needed,
                    &mut n_proc_info,
                    Some(process_info_array.as_mut_ptr()),
                    &mut lpdwrebootreasons,
                );
            }
        }

        let _ = RmEndSession(session_handle);

        if res != ERROR_SUCCESS && n_proc_info > 0 {
            return Err(format!("RmGetList failed: {:?}", res));
        }

        let mut sys = System::new();
        // Refresh only processes to be lightweight
        sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

        let mut processes = Vec::new();
        for info in process_info_array.iter().take(n_proc_info as usize) {
            let pid = info.Process.dwProcessId;
            let sysinfo_pid = sysinfo::Pid::from_u32(pid);
            if let Some(process) = sys.process(sysinfo_pid) {
                let name = process.name().to_string_lossy().to_string();
                if !processes.contains(&name) {
                    processes.push(name);
                }
            } else {
                // If we can't find it in sysinfo, use strAppName as fallback
                let name_len = info.strAppName.iter().position(|&c| c == 0).unwrap_or(256);
                if name_len > 0 {
                    let name = String::from_utf16_lossy(&info.strAppName[..name_len]);
                    if !processes.contains(&name) {
                        processes.push(name);
                    }
                } else {
                    processes.push(format!("Unknown Process (PID: {})", pid));
                }
            }
        }

        Ok(processes)
    }
}

#[cfg(not(windows))]
pub fn get_locking_processes(_path: &Path) -> Result<Vec<String>, String> {
    Ok(Vec::new())
}
