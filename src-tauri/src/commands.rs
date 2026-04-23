use serde_json::Value;
use std::io::{Read, Write};
use std::process::{Command, Stdio};

fn sidecar_path() -> String {
    // CARGO_MANIFEST_DIR is the absolute path to src-tauri/ at compile time.
    // This makes the dev-mode path reliable regardless of runtime CWD.
    let manifest = env!("CARGO_MANIFEST_DIR");
    format!("{}/../python/sidecar.py", manifest)
}

fn sidecar_program() -> (String, Vec<String>) {
    if cfg!(debug_assertions) {
        let python = if cfg!(target_os = "windows") { "python" } else { "python3" };
        (python.to_string(), vec![sidecar_path()])
    } else {
        ("morfocat-sidecar".to_string(), vec![])
    }
}

#[tauri::command]
pub async fn run_analysis(method: String, params: Value) -> Result<Value, String> {
    let request = serde_json::json!({ "method": method, "params": params });
    let request_bytes = serde_json::to_vec(&request).map_err(|e| e.to_string())?;

    let (prog, args) = sidecar_program();

    let mut child = Command::new(&prog)
        .args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start Python sidecar '{}' (args: {:?}): {}", prog, args, e))?;

    child
        .stdin
        .as_mut()
        .unwrap()
        .write_all(&request_bytes)
        .map_err(|e| e.to_string())?;

    let output = child.wait_with_output().map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Sidecar error: {}", stderr));
    }

    serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse sidecar response: {}\nRaw: {}", e, String::from_utf8_lossy(&output.stdout)))
}

// ── File I/O helpers (used by Digitizer / Export) ────────────────────────────

fn b64_encode(bytes: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = Vec::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let b = [chunk[0], if chunk.len() > 1 { chunk[1] } else { 0 }, if chunk.len() > 2 { chunk[2] } else { 0 }];
        let n = ((b[0] as u32) << 16) | ((b[1] as u32) << 8) | (b[2] as u32);
        out.push(CHARS[((n >> 18) & 63) as usize]);
        out.push(CHARS[((n >> 12) & 63) as usize]);
        out.push(if chunk.len() > 1 { CHARS[((n >> 6) & 63) as usize] } else { b'=' });
        out.push(if chunk.len() > 2 { CHARS[(n & 63) as usize] } else { b'=' });
    }
    String::from_utf8(out).unwrap()
}

/// Read any file and return its contents as a base64 string (for image display).
#[tauri::command]
pub async fn read_file_b64(path: String) -> Result<String, String> {
    let mut f = std::fs::File::open(&path).map_err(|e| format!("Cannot open '{}': {}", path, e))?;
    let mut buf = Vec::new();
    f.read_to_end(&mut buf).map_err(|e| e.to_string())?;
    Ok(b64_encode(&buf))
}

/// Write UTF-8 text to an absolute path, creating parent directories as needed.
#[tauri::command]
pub async fn write_text_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, content).map_err(|e| format!("Cannot write '{}': {}", path, e))
}

/// Create a directory (and all parents) at the given absolute path.
#[tauri::command]
pub async fn ensure_dir(path: String) -> Result<(), String> {
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())
}
