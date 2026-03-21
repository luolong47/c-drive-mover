use std::path::Path;
use std::fs::OpenOptions;

fn main() {
    let path = Path::new("C:\\Users\\LuoLong\\AppData\\LocalLow\\Tencent");
    let mut locked_files = Vec::new();
    for entry in walkdir::WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            let p = entry.path();
            if let Err(e) = OpenOptions::new().write(true).open(p) {
                // permission denied or sharing violation
                if e.kind() == std::io::ErrorKind::PermissionDenied {
                   println!("Locked: {:?}", p);
                   locked_files.push(p.to_path_buf());
                }
            }
        }
    }
    println!("Total locked files: {}", locked_files.len());
}
