use serde::Serialize;
use serde_json::Value;
use std::{
    env,
    fs::{self, File, OpenOptions},
    io::{Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    process::{Command, Stdio},
};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LoaderInfo {
    found: bool,
    root: String,
    loader_version: Option<String>,
    minecraft: Option<String>,
    minecraft_display: Option<String>,
    minimum_java: Option<u64>,
    error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ModInfo {
    file: String,
    id: Option<String>,
    name: Option<String>,
    version: Option<String>,
    enabled: bool,
    error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LaunchResult {
    pid: u32,
    log: String,
}

fn clean_root(raw: &str) -> Result<PathBuf, String> {
    let trimmed = raw.trim().trim_matches('"');
    if trimmed.is_empty() {
        return Err("Choose the CodaLoader folder first.".into());
    }
    Ok(PathBuf::from(trimmed))
}

fn java_program() -> PathBuf {
    if let Ok(home) = env::var("JAVA_HOME") {
        let candidate = PathBuf::from(home)
            .join("bin")
            .join(if cfg!(windows) { "java.exe" } else { "java" });
        if candidate.is_file() {
            return candidate;
        }
    }
    PathBuf::from("java")
}

fn hidden_java() -> Command {
    let mut command = Command::new(java_program());
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    command
}

#[tauri::command]
fn default_install_root() -> String {
    if let Ok(root) = env::var("CODALOADER_HOME") {
        return root;
    }

    env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(Path::to_path_buf))
        .unwrap_or_else(|| PathBuf::from("."))
        .to_string_lossy()
        .to_string()
}

#[tauri::command]
fn inspect_install(install_root: String) -> LoaderInfo {
    let root = match clean_root(&install_root) {
        Ok(root) => root,
        Err(error) => {
            return LoaderInfo {
                found: false,
                root: install_root,
                loader_version: None,
                minecraft: None,
                minecraft_display: None,
                minimum_java: None,
                error: Some(error),
            };
        }
    };

    let jar = root.join("CodaLoader.jar");
    if !jar.is_file() {
        return LoaderInfo {
            found: false,
            root: root.to_string_lossy().to_string(),
            loader_version: None,
            minecraft: None,
            minecraft_display: None,
            minimum_java: None,
            error: Some("CodaLoader.jar was not found in this folder.".into()),
        };
    }

    let output = hidden_java()
        .arg("-jar")
        .arg(&jar)
        .arg("--version-json")
        .current_dir(&root)
        .output();

    match output {
        Ok(output) if output.status.success() => {
            let parsed: Result<Value, _> =
                serde_json::from_slice(output.stdout.as_slice());
            match parsed {
                Ok(value) => LoaderInfo {
                    found: true,
                    root: root.to_string_lossy().to_string(),
                    loader_version: value
                        .get("loader")
                        .and_then(Value::as_str)
                        .map(str::to_string),
                    minecraft: value
                        .get("minecraft")
                        .and_then(Value::as_str)
                        .map(str::to_string),
                    minecraft_display: value
                        .get("minecraftDisplay")
                        .and_then(Value::as_str)
                        .map(str::to_string),
                    minimum_java: value.get("minimumJava").and_then(Value::as_u64),
                    error: None,
                },
                Err(error) => LoaderInfo {
                    found: true,
                    root: root.to_string_lossy().to_string(),
                    loader_version: None,
                    minecraft: None,
                    minecraft_display: None,
                    minimum_java: None,
                    error: Some(format!("CodaLoader returned unreadable version data: {error}")),
                },
            }
        }
        Ok(output) => LoaderInfo {
            found: true,
            root: root.to_string_lossy().to_string(),
            loader_version: None,
            minecraft: None,
            minecraft_display: None,
            minimum_java: None,
            error: Some(String::from_utf8_lossy(&output.stderr).trim().to_string()),
        },
        Err(error) => LoaderInfo {
            found: true,
            root: root.to_string_lossy().to_string(),
            loader_version: None,
            minecraft: None,
            minecraft_display: None,
            minimum_java: None,
            error: Some(format!("Could not run Java: {error}")),
        },
    }
}

fn string_field(value: &Value, name: &str) -> Option<String> {
    value.get(name).and_then(Value::as_str).map(str::to_string)
}

fn inspect_mod(path: &Path, enabled: bool) -> ModInfo {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("unknown")
        .to_string();

    let opened = File::open(path)
        .map_err(|error| error.to_string())
        .and_then(|file| zip::ZipArchive::new(file).map_err(|error| error.to_string()));

    match opened {
        Ok(mut archive) => {
            let metadata = archive
                .by_name("coda.mod.json")
                .map_err(|error| error.to_string())
                .and_then(|mut entry| {
                    let mut text = String::new();
                    entry
                        .read_to_string(&mut text)
                        .map_err(|error| error.to_string())?;
                    serde_json::from_str::<Value>(&text).map_err(|error| error.to_string())
                });

            match metadata {
                Ok(value) => ModInfo {
                    file: file_name,
                    id: string_field(&value, "id"),
                    name: string_field(&value, "name"),
                    version: string_field(&value, "version"),
                    enabled,
                    error: None,
                },
                Err(error) => ModInfo {
                    file: file_name,
                    id: None,
                    name: None,
                    version: None,
                    enabled,
                    error: Some(format!("No readable coda.mod.json: {error}")),
                },
            }
        }
        Err(error) => ModInfo {
            file: file_name,
            id: None,
            name: None,
            version: None,
            enabled,
            error: Some(error),
        },
    }
}

#[tauri::command]
fn list_mods(install_root: String) -> Result<Vec<ModInfo>, String> {
    let root = clean_root(&install_root)?;
    let mods = root.join("run").join("mods");
    if !mods.is_dir() {
        return Ok(Vec::new());
    }

    let mut result = Vec::new();
    for entry in fs::read_dir(mods).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let name = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();

        if name.ends_with(".jar") {
            result.push(inspect_mod(&path, true));
        } else if name.ends_with(".jar.disabled") {
            result.push(inspect_mod(&path, false));
        }
    }

    result.sort_by(|a, b| a.file.to_ascii_lowercase().cmp(&b.file.to_ascii_lowercase()));
    Ok(result)
}

fn tail_file(path: &Path, max_bytes: u64) -> Result<String, String> {
    let mut file = File::open(path).map_err(|error| error.to_string())?;
    let len = file.metadata().map_err(|error| error.to_string())?.len();
    let start = len.saturating_sub(max_bytes);
    file.seek(SeekFrom::Start(start))
        .map_err(|error| error.to_string())?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)
        .map_err(|error| error.to_string())?;
    Ok(String::from_utf8_lossy(&bytes).to_string())
}

#[tauri::command]
fn read_logs(install_root: String) -> Result<String, String> {
    let root = clean_root(&install_root)?;
    let candidates = [
        ("CodaLauncher", root.join("run").join("logs").join("codalauncher-launch.log")),
        ("Minecraft", root.join("run").join("game").join("logs").join("latest.log")),
    ];

    let mut output = String::new();
    for (label, path) in candidates {
        if path.is_file() {
            output.push_str(&format!("===== {label}: {} =====\n", path.display()));
            output.push_str(&tail_file(&path, 220_000)?);
            output.push_str("\n\n");
        }
    }

    if output.is_empty() {
        output.push_str("No launcher or Minecraft logs have been created yet.");
    }
    Ok(output)
}

#[tauri::command]
fn launch_game(install_root: String) -> Result<LaunchResult, String> {
    let root = clean_root(&install_root)?;
    let jar = root.join("CodaLoader.jar");
    if !jar.is_file() {
        return Err("CodaLoader.jar was not found in the selected folder.".into());
    }

    let log_dir = root.join("run").join("logs");
    fs::create_dir_all(&log_dir).map_err(|error| error.to_string())?;
    let log_path = log_dir.join("codalauncher-launch.log");

    let stdout = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .map_err(|error| error.to_string())?;
    let stderr = stdout.try_clone().map_err(|error| error.to_string())?;

    let mut command = hidden_java();
    command
        .arg("-jar")
        .arg(&jar)
        .current_dir(&root)
        .env("CODALAUNCHER_ACTIVE", "1")
        .stdout(Stdio::from(stdout))
        .stderr(Stdio::from(stderr));

    let child = command.spawn().map_err(|error| error.to_string())?;
    Ok(LaunchResult {
        pid: child.id(),
        log: log_path.to_string_lossy().to_string(),
    })
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            default_install_root,
            inspect_install,
            list_mods,
            read_logs,
            launch_game
        ])
        .run(tauri::generate_context!())
        .expect("error while running CodaLauncher");
}
