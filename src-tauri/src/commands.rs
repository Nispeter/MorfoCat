use serde_json::Value;
use std::io::Write;
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
