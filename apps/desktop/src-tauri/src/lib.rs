use dirs::config_dir;
use glob::Pattern;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Workspace {
    id: String,
    name: String,
    uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Collection {
    id: String,
    workspace_id: String,
    name: String,
    uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RequestFile {
    id: String,
    collection_id: String,
    title: String,
    uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct DiscoveryConfig {
    #[serde(default)]
    entries: Vec<String>,
    #[serde(default)]
    include: Vec<String>,
    #[serde(default)]
    exclude: Vec<String>,
}

#[derive(Debug, Clone)]
struct ActiveConfig {
    origin_dir: PathBuf,
    config: DiscoveryConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SendHttpRequest {
    method: String,
    url: String,
    headers: HashMap<String, String>,
    body: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SendHttpResponse {
    status: u16,
    status_text: String,
    headers: HashMap<String, String>,
    body: String,
}

fn normalize_path(input: &str) -> String {
    input.replace('\\', "/")
}

fn make_id(prefix: &str, value: &str) -> String {
    format!("{}:{}", prefix, normalize_path(value))
}

fn relative_path(base: &Path, path: &Path) -> String {
    if let Ok(relative) = path.strip_prefix(base) {
        let value = relative.to_string_lossy().to_string();
        if value.is_empty() {
            ".".to_string()
        } else {
            normalize_path(&value)
        }
    } else {
        ".".to_string()
    }
}

fn glob_match(pattern: &str, candidate: &str) -> bool {
    Pattern::new(pattern)
        .map(|glob| glob.matches(candidate))
        .unwrap_or(false)
}

fn path_included(config: &DiscoveryConfig, relative: &str) -> bool {
    if config
        .exclude
        .iter()
        .any(|pattern| glob_match(pattern, relative))
    {
        return false;
    }

    if config.include.is_empty() {
        return true;
    }

    config
        .include
        .iter()
        .any(|pattern| glob_match(pattern, relative))
}

fn matches_entries(config: &DiscoveryConfig, relative: &str) -> bool {
    if config.entries.is_empty() {
        return true;
    }

    config
        .entries
        .iter()
        .any(|pattern| glob_match(pattern, relative))
}

fn read_discovery_config(dir: &Path) -> Result<Option<DiscoveryConfig>, String> {
    let config_path = dir.join(".eshttp.json");
    if !config_path.exists() {
        return Ok(None);
    }

    let raw = fs::read_to_string(&config_path)
        .map_err(|error| format!("Failed to read {}: {}", config_path.display(), error))?;

    let parsed: DiscoveryConfig = serde_json::from_str(&raw)
        .map_err(|error| format!("Failed to parse {}: {}", config_path.display(), error))?;

    Ok(Some(parsed))
}

fn get_workspace_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();

    if let Ok(cwd) = std::env::current_dir() {
        roots.push(cwd.join(".eshttp").join("workspaces"));
    }

    if let Some(config) = config_dir() {
        roots.push(config.join("eshttp").join("workspaces"));
    }

    roots
}

fn read_dirs(path: &Path) -> Vec<PathBuf> {
    let mut result = Vec::new();
    let entries = match fs::read_dir(path) {
        Ok(entries) => entries,
        Err(_) => return result,
    };

    for entry in entries.flatten() {
        let entry_path = entry.path();
        if entry_path.is_dir() {
            result.push(entry_path);
        }
    }

    result
}

fn find_collections(
    workspace: &Workspace,
    workspace_path: &Path,
    dir: &Path,
    active: Option<ActiveConfig>,
    out: &mut Vec<Collection>,
) -> Result<(), String> {
    let local_config = read_discovery_config(dir)?;

    let effective = if let Some(config) = local_config {
        Some(ActiveConfig {
            origin_dir: dir.to_path_buf(),
            config,
        })
    } else {
        active
    };

    let relative_workspace = relative_path(workspace_path, dir);
    if let Some(active_config) = &effective {
        if !path_included(&active_config.config, &relative_workspace) {
            return Ok(());
        }
    }

    let mut has_http_files = false;
    let entries = fs::read_dir(dir)
        .map_err(|error| format!("Failed to read directory {}: {}", dir.display(), error))?;

    let mut subdirs = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            if let Some(name) = path.file_name().and_then(|name| name.to_str()) {
                if name.ends_with(".http") {
                    has_http_files = true;
                }
            }
        } else if path.is_dir() {
            subdirs.push(path);
        }
    }

    if has_http_files {
        let matches_entry = if let Some(active_config) = &effective {
            let rel_to_origin = relative_path(&active_config.origin_dir, dir);
            matches_entries(&active_config.config, &rel_to_origin)
        } else {
            true
        };

        if matches_entry {
            let name = if relative_workspace == "." {
                workspace.name.clone()
            } else {
                relative_workspace.clone()
            };

            out.push(Collection {
                id: make_id(
                    "collection",
                    &format!("{}/{}", workspace.id, relative_workspace),
                ),
                workspace_id: workspace.id.clone(),
                name,
                uri: dir.to_string_lossy().to_string(),
            });
        }
    }

    for subdir in subdirs {
        find_collections(workspace, workspace_path, &subdir, effective.clone(), out)?;
    }

    Ok(())
}

#[tauri::command]
fn list_workspaces() -> Vec<Workspace> {
    let mut workspaces = Vec::new();

    for root in get_workspace_roots() {
        for workspace_path in read_dirs(&root) {
            if let Some(name) = workspace_path.file_name().and_then(|name| name.to_str()) {
                let uri = workspace_path.to_string_lossy().to_string();
                workspaces.push(Workspace {
                    id: make_id("workspace", &uri),
                    name: name.to_string(),
                    uri,
                });
            }
        }
    }

    let mut unique = HashMap::new();
    for workspace in workspaces {
        unique.entry(workspace.uri.clone()).or_insert(workspace);
    }

    unique.into_values().collect()
}

#[tauri::command]
fn discover_collections(workspace: Workspace) -> Result<Vec<Collection>, String> {
    let workspace_path = PathBuf::from(&workspace.uri);
    if !workspace_path.exists() {
        return Ok(Vec::new());
    }

    let mut results = Vec::new();
    find_collections(
        &workspace,
        &workspace_path,
        &workspace_path,
        None,
        &mut results,
    )?;

    results.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(results)
}

#[tauri::command]
fn list_requests(collection: Collection) -> Result<Vec<RequestFile>, String> {
    let collection_path = PathBuf::from(&collection.uri);
    let entries = fs::read_dir(&collection_path)
        .map_err(|error| format!("Failed to read {}: {}", collection.uri, error))?;

    let mut requests = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let Some(file_name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };

        if !file_name.ends_with(".http") {
            continue;
        }

        let title = file_name.trim_end_matches(".http").to_string();
        let uri = path.to_string_lossy().to_string();

        requests.push(RequestFile {
            id: make_id("request", &uri),
            collection_id: collection.id.clone(),
            title,
            uri,
        });
    }

    requests.sort_by(|a, b| a.title.cmp(&b.title));
    Ok(requests)
}

#[tauri::command]
fn read_request_text(request: RequestFile) -> Result<String, String> {
    fs::read_to_string(request.uri)
        .map_err(|error| format!("Failed to read request file: {}", error))
}

#[tauri::command]
fn read_text_file(path: String) -> Result<Option<String>, String> {
    let target = PathBuf::from(path);
    if !target.exists() {
        return Ok(None);
    }

    let value = fs::read_to_string(&target)
        .map_err(|error| format!("Failed to read {}: {}", target.display(), error))?;
    Ok(Some(value))
}

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    let target = PathBuf::from(path);
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create {}: {}", parent.display(), error))?;
    }

    fs::write(&target, contents)
        .map_err(|error| format!("Failed to write {}: {}", target.display(), error))
}

#[tauri::command]
fn detect_git_repo(path: String) -> Result<Option<String>, String> {
    let output = Command::new("git")
        .args(["-C", &path, "rev-parse", "--show-toplevel"])
        .output()
        .map_err(|error| format!("Failed to run git for {}: {}", path, error))?;

    if output.status.success() {
        let root = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if root.is_empty() {
            return Ok(None);
        }

        return Ok(Some(root));
    }

    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    if stderr.contains("not a git repository") {
        return Ok(None);
    }

    Err(format!(
        "Failed to detect git repository for {}: {}",
        path,
        stderr.trim()
    ))
}

fn sanitize_commit_paths(paths: Vec<String>) -> Vec<String> {
    let mut sanitized = Vec::new();

    for path in paths {
        let normalized = path.replace('\\', "/").trim().to_string();
        if normalized.is_empty() {
            continue;
        }

        if normalized.starts_with('/') {
            continue;
        }

        if normalized.split('/').any(|segment| segment == "..") {
            continue;
        }

        if !sanitized.iter().any(|entry| entry == &normalized) {
            sanitized.push(normalized);
        }
    }

    sanitized
}

#[tauri::command]
fn git_commit_paths(repo_root: String, paths: Vec<String>, message: String) -> Result<(), String> {
    let sanitized = sanitize_commit_paths(paths);
    if sanitized.is_empty() {
        return Ok(());
    }

    let mut add_args = vec![
        "-C".to_string(),
        repo_root.clone(),
        "add".to_string(),
        "--".to_string(),
    ];
    add_args.extend(sanitized.clone());

    let add_output = Command::new("git")
        .args(add_args)
        .output()
        .map_err(|error| format!("Failed to run git add: {}", error))?;

    if !add_output.status.success() {
        let stderr = String::from_utf8_lossy(&add_output.stderr).to_string();
        return Err(format!("git add failed: {}", stderr.trim()));
    }

    let mut has_staged_args = vec![
        "-C".to_string(),
        repo_root.clone(),
        "diff".to_string(),
        "--cached".to_string(),
        "--quiet".to_string(),
        "--".to_string(),
    ];
    has_staged_args.extend(sanitized.clone());

    let staged_output = Command::new("git")
        .args(has_staged_args)
        .output()
        .map_err(|error| format!("Failed to check staged git changes: {}", error))?;

    if staged_output.status.success() {
        return Ok(());
    }

    let mut commit_args = vec![
        "-C".to_string(),
        repo_root,
        "commit".to_string(),
        "-m".to_string(),
        message,
        "--".to_string(),
    ];
    commit_args.extend(sanitized);

    let commit_output = Command::new("git")
        .args(commit_args)
        .output()
        .map_err(|error| format!("Failed to run git commit: {}", error))?;

    if !commit_output.status.success() {
        let stderr = String::from_utf8_lossy(&commit_output.stderr).to_string();
        return Err(format!("git commit failed: {}", stderr.trim()));
    }

    Ok(())
}

#[tauri::command]
fn read_environment_file(scope_uri: String, env_name: String) -> Result<Option<String>, String> {
    let env_path = PathBuf::from(scope_uri).join(format!(".env.{}", env_name));
    if !env_path.exists() {
        return Ok(None);
    }

    let value = fs::read_to_string(&env_path)
        .map_err(|error| format!("Failed to read {}: {}", env_path.display(), error))?;

    Ok(Some(value))
}

#[tauri::command]
fn pick_directory() -> Option<String> {
    rfd::FileDialog::new()
        .pick_folder()
        .map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
async fn send_http(request: SendHttpRequest) -> Result<SendHttpResponse, String> {
    let method = request
        .method
        .parse::<reqwest::Method>()
        .map_err(|error| format!("Invalid method: {}", error))?;

    let mut headers = HeaderMap::new();
    for (key, value) in request.headers {
        let name = HeaderName::from_bytes(key.as_bytes())
            .map_err(|error| format!("Invalid header name: {}", error))?;
        let header_value = HeaderValue::from_str(&value)
            .map_err(|error| format!("Invalid header value: {}", error))?;
        headers.insert(name, header_value);
    }

    let client = reqwest::Client::new();
    let mut builder = client.request(method, request.url).headers(headers);

    if let Some(body) = request.body {
        builder = builder.body(body);
    }

    let response = builder
        .send()
        .await
        .map_err(|error| format!("Request failed: {}", error))?;

    let status = response.status();
    let status_text = status
        .canonical_reason()
        .unwrap_or("Unknown Status")
        .to_string();

    let mut response_headers = HashMap::new();
    for (name, value) in response.headers() {
        let value = value.to_str().unwrap_or_default().to_string();
        response_headers.insert(name.to_string(), value);
    }

    let body = response
        .text()
        .await
        .map_err(|error| format!("Failed to read response body: {}", error))?;

    Ok(SendHttpResponse {
        status: status.as_u16(),
        status_text,
        headers: response_headers,
        body,
    })
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            list_workspaces,
            discover_collections,
            list_requests,
            read_request_text,
            read_text_file,
            write_text_file,
            detect_git_repo,
            git_commit_paths,
            read_environment_file,
            pick_directory,
            send_http
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
