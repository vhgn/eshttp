use dirs::config_dir;
use glob::Pattern;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::ErrorKind;
use std::path::Component;
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

fn canonicalize_existing_dir(path: &Path, label: &str) -> Result<PathBuf, String> {
    let canonical = fs::canonicalize(path)
        .map_err(|error| format!("Failed to resolve {} {}: {}", label, path.display(), error))?;
    let metadata = fs::metadata(&canonical).map_err(|error| {
        format!(
            "Failed to stat {} {}: {}",
            label,
            canonical.display(),
            error
        )
    })?;
    if !metadata.is_dir() {
        return Err(format!(
            "{} is not a directory: {}",
            label,
            canonical.display()
        ));
    }

    Ok(canonical)
}

fn ensure_within_root(root: &Path, candidate: &Path) -> Result<(), String> {
    if candidate == root || candidate.starts_with(root) {
        return Ok(());
    }

    Err(format!(
        "Resolved path is outside scope root. root={}, resolved={}",
        root.display(),
        candidate.display()
    ))
}

fn parse_relative_path(relative_path: &str) -> Result<PathBuf, String> {
    let trimmed = relative_path.trim();
    if trimmed.is_empty() {
        return Err("Relative path is empty".to_string());
    }

    let mut parsed = PathBuf::new();
    for component in Path::new(trimmed).components() {
        match component {
            Component::CurDir => {}
            Component::Normal(segment) => parsed.push(segment),
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err(format!(
                    "Invalid relative path '{}': parent and absolute segments are not allowed",
                    relative_path
                ))
            }
        }
    }

    if parsed.as_os_str().is_empty() {
        return Err(format!("Invalid relative path '{}'", relative_path));
    }

    Ok(parsed)
}

fn resolve_scoped_read_path(root: &Path, relative_path: &str) -> Result<PathBuf, String> {
    let parsed_relative = parse_relative_path(relative_path)?;
    let target = root.join(parsed_relative);

    let metadata = match fs::symlink_metadata(&target) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(target),
        Err(error) => {
            return Err(format!(
                "Failed to stat scoped read path {}: {}",
                target.display(),
                error
            ))
        }
    };

    if metadata.file_type().is_symlink() || metadata.is_file() {
        let resolved = fs::canonicalize(&target).map_err(|error| {
            format!(
                "Failed to resolve scoped read path {}: {}",
                target.display(),
                error
            )
        })?;
        ensure_within_root(root, &resolved)?;
        return Ok(resolved);
    }

    Ok(target)
}

fn resolve_scoped_write_path(root: &Path, relative_path: &str) -> Result<PathBuf, String> {
    let parsed_relative = parse_relative_path(relative_path)?;
    let segments: Vec<String> = parsed_relative
        .iter()
        .map(|segment| segment.to_string_lossy().to_string())
        .collect();

    let (file_name, parent_segments) = match segments.split_last() {
        Some((file_name, parent_segments)) => (file_name, parent_segments),
        None => return Err("Target file name is missing".to_string()),
    };

    let mut current = root.to_path_buf();
    for segment in parent_segments {
        let next = current.join(segment);
        match fs::symlink_metadata(&next) {
            Ok(metadata) => {
                if metadata.file_type().is_symlink() {
                    return Err(format!(
                        "Refusing to write through symlinked directory {}",
                        next.display()
                    ));
                }
                if !metadata.is_dir() {
                    return Err(format!(
                        "Path segment is not a directory: {}",
                        next.display()
                    ));
                }
            }
            Err(error) if error.kind() == ErrorKind::NotFound => {
                fs::create_dir(&next).map_err(|create_error| {
                    format!("Failed to create {}: {}", next.display(), create_error)
                })?;
            }
            Err(error) => {
                return Err(format!(
                    "Failed to inspect path segment {}: {}",
                    next.display(),
                    error
                ))
            }
        }

        let resolved = fs::canonicalize(&next).map_err(|error| {
            format!("Failed to resolve directory {}: {}", next.display(), error)
        })?;
        ensure_within_root(root, &resolved)?;
        current = resolved;
    }

    let target = current.join(file_name);
    match fs::symlink_metadata(&target) {
        Ok(metadata) => {
            if metadata.file_type().is_symlink() {
                let resolved = fs::canonicalize(&target).map_err(|error| {
                    format!(
                        "Failed to resolve scoped write path {}: {}",
                        target.display(),
                        error
                    )
                })?;
                ensure_within_root(root, &resolved)?;
            } else if metadata.is_dir() {
                return Err(format!("Target path is a directory: {}", target.display()));
            } else if !metadata.is_file() {
                return Err(format!(
                    "Target path is not a regular file: {}",
                    target.display()
                ));
            }
        }
        Err(error) if error.kind() == ErrorKind::NotFound => {}
        Err(error) => {
            return Err(format!(
                "Failed to inspect scoped write path {}: {}",
                target.display(),
                error
            ))
        }
    }

    Ok(target)
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
        let Ok(file_type) = entry.file_type() else {
            continue;
        };

        if !file_type.is_dir() || file_type.is_symlink() {
            continue;
        }

        let entry_path = entry.path();
        if let Ok(canonical) = fs::canonicalize(entry_path) {
            result.push(canonical);
        }
    }

    result
}

fn find_collections(
    workspace: &Workspace,
    workspace_root: &Path,
    dir: &Path,
    active: Option<ActiveConfig>,
    visited: &mut HashSet<PathBuf>,
    out: &mut Vec<Collection>,
) -> Result<(), String> {
    if !visited.insert(dir.to_path_buf()) {
        return Ok(());
    }

    ensure_within_root(workspace_root, dir)?;

    let local_config = read_discovery_config(dir)?;

    let effective = if let Some(config) = local_config {
        Some(ActiveConfig {
            origin_dir: dir.to_path_buf(),
            config,
        })
    } else {
        active
    };

    let relative_workspace = relative_path(workspace_root, dir);
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
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if file_type.is_symlink() {
            continue;
        }

        let path = entry.path();
        if file_type.is_file() {
            if let Some(name) = path.file_name().and_then(|name| name.to_str()) {
                if name.ends_with(".http") {
                    has_http_files = true;
                }
            }
            continue;
        }

        if !file_type.is_dir() {
            continue;
        }

        let Ok(canonical_subdir) = fs::canonicalize(&path) else {
            continue;
        };
        if ensure_within_root(workspace_root, &canonical_subdir).is_err() {
            continue;
        }

        subdirs.push(canonical_subdir);
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
                uri: if relative_workspace == "." {
                    workspace.uri.clone()
                } else {
                    PathBuf::from(&workspace.uri)
                        .join(&relative_workspace)
                        .to_string_lossy()
                        .to_string()
                },
            });
        }
    }

    for subdir in subdirs {
        find_collections(
            workspace,
            workspace_root,
            &subdir,
            effective.clone(),
            visited,
            out,
        )?;
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
    let workspace_root = canonicalize_existing_dir(&workspace_path, "workspace")?;

    let mut results = Vec::new();
    let mut visited = HashSet::new();
    find_collections(
        &workspace,
        &workspace_root,
        &workspace_root,
        None,
        &mut visited,
        &mut results,
    )?;

    results.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(results)
}

#[tauri::command]
fn list_requests(collection: Collection) -> Result<Vec<RequestFile>, String> {
    let collection_path = canonicalize_existing_dir(Path::new(&collection.uri), "collection")?;
    let entries = fs::read_dir(&collection_path)
        .map_err(|error| format!("Failed to read {}: {}", collection.uri, error))?;

    let mut requests = Vec::new();

    for entry in entries.flatten() {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if file_type.is_symlink() || !file_type.is_file() {
            continue;
        }

        let path = entry.path();
        let Some(file_name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };

        if !file_name.ends_with(".http") {
            continue;
        }
        let canonical_file = fs::canonicalize(&path).map_err(|error| {
            format!(
                "Failed to resolve request file {}: {}",
                path.display(),
                error
            )
        })?;
        ensure_within_root(&collection_path, &canonical_file)?;

        let title = file_name.trim_end_matches(".http").to_string();
        let uri = canonical_file.to_string_lossy().to_string();

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
fn read_scoped_text_file(root: String, relative_path: String) -> Result<Option<String>, String> {
    let scope_root = canonicalize_existing_dir(Path::new(&root), "scope root")?;
    let target = resolve_scoped_read_path(&scope_root, &relative_path)?;
    if !target.exists() {
        return Ok(None);
    }

    let metadata = fs::metadata(&target)
        .map_err(|error| format!("Failed to stat {}: {}", target.display(), error))?;
    if !metadata.is_file() {
        return Err(format!(
            "Target is not a regular file: {}",
            target.display()
        ));
    }

    let value = fs::read_to_string(&target)
        .map_err(|error| format!("Failed to read {}: {}", target.display(), error))?;
    Ok(Some(value))
}

#[tauri::command]
fn write_scoped_text_file(
    root: String,
    relative_path: String,
    contents: String,
) -> Result<(), String> {
    let scope_root = canonicalize_existing_dir(Path::new(&root), "scope root")?;
    let target = resolve_scoped_write_path(&scope_root, &relative_path)?;

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

        if normalized.contains('\0') {
            continue;
        }

        if normalized
            .split('/')
            .any(|segment| segment.is_empty() || segment == ".")
        {
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

fn to_literal_pathspec(path: &str) -> String {
    format!(":(literal){}", path)
}

#[tauri::command]
fn git_commit_paths(repo_root: String, paths: Vec<String>, message: String) -> Result<(), String> {
    let canonical_repo_root = canonicalize_existing_dir(Path::new(&repo_root), "repository root")?;
    let sanitized = sanitize_commit_paths(paths);
    if sanitized.is_empty() {
        return Ok(());
    }
    let literal_paths: Vec<String> = sanitized
        .iter()
        .map(|path| to_literal_pathspec(path))
        .collect();

    let mut add_args = vec![
        "-C".to_string(),
        canonical_repo_root.to_string_lossy().to_string(),
        "add".to_string(),
        "--".to_string(),
    ];
    add_args.extend(literal_paths.clone());

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
        canonical_repo_root.to_string_lossy().to_string(),
        "diff".to_string(),
        "--cached".to_string(),
        "--quiet".to_string(),
        "--".to_string(),
    ];
    has_staged_args.extend(literal_paths.clone());

    let staged_output = Command::new("git")
        .args(has_staged_args)
        .output()
        .map_err(|error| format!("Failed to check staged git changes: {}", error))?;

    if staged_output.status.success() {
        return Ok(());
    }

    let mut commit_args = vec![
        "-C".to_string(),
        canonical_repo_root.to_string_lossy().to_string(),
        "commit".to_string(),
        "-m".to_string(),
        message,
        "--no-verify".to_string(),
        "--".to_string(),
    ];
    commit_args.extend(literal_paths);

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
    if env_name.is_empty() {
        return Err("Environment name is empty".to_string());
    }
    if !env_name
        .chars()
        .all(|char| char.is_ascii_alphanumeric() || char == '_' || char == '-' || char == '.')
    {
        return Err(format!("Invalid environment name: {}", env_name));
    }

    read_scoped_text_file(scope_uri, format!(".env.{}", env_name))
}

#[tauri::command]
fn pick_directory() -> Option<String> {
    let picked = rfd::FileDialog::new().pick_folder()?;
    let canonical = fs::canonicalize(&picked).unwrap_or(picked);
    Some(canonical.to_string_lossy().to_string())
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
            read_scoped_text_file,
            write_scoped_text_file,
            detect_git_repo,
            git_commit_paths,
            read_environment_file,
            pick_directory,
            send_http
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_temp_dir(name: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        std::env::temp_dir().join(format!("eshttp-{}-{}-{}", name, std::process::id(), nanos))
    }

    #[test]
    fn parse_relative_path_rejects_parent_and_absolute_paths() {
        assert!(parse_relative_path("../secret").is_err());
        assert!(parse_relative_path("/etc/passwd").is_err());
        assert!(parse_relative_path("a/../../b").is_err());
        assert!(parse_relative_path("  ").is_err());
    }

    #[test]
    fn sanitize_commit_paths_removes_unsafe_entries() {
        let sanitized = sanitize_commit_paths(vec![
            "safe/file.http".to_string(),
            "safe/file.http".to_string(),
            "/abs/path.http".to_string(),
            "../escape.http".to_string(),
            "nested/./file.http".to_string(),
            "nested//file.http".to_string(),
        ]);

        assert_eq!(sanitized, vec!["safe/file.http".to_string()]);
        assert_eq!(
            to_literal_pathspec("safe/file.http"),
            ":(literal)safe/file.http"
        );
    }

    #[cfg(unix)]
    #[test]
    fn scoped_read_rejects_symlink_escape() {
        use std::os::unix::fs::symlink;

        let root_dir = unique_temp_dir("scoped-read-root");
        let external_dir = unique_temp_dir("scoped-read-external");
        fs::create_dir_all(&root_dir).expect("create root dir");
        fs::create_dir_all(&external_dir).expect("create external dir");

        let external_file = external_dir.join("outside.http");
        fs::write(&external_file, "GET https://example.com").expect("write external file");

        let linked_file = root_dir.join("linked.http");
        symlink(&external_file, &linked_file).expect("create symlink");

        let root_canonical = fs::canonicalize(&root_dir).expect("canonicalize root");
        let result = resolve_scoped_read_path(&root_canonical, "linked.http");
        assert!(result.is_err(), "expected symlink escape to be rejected");

        let _ = fs::remove_dir_all(&root_dir);
        let _ = fs::remove_dir_all(&external_dir);
    }

    #[cfg(unix)]
    #[test]
    fn scoped_write_rejects_symlink_parent_escape() {
        use std::os::unix::fs::symlink;

        let root_dir = unique_temp_dir("scoped-write-root");
        let external_dir = unique_temp_dir("scoped-write-external");
        fs::create_dir_all(&root_dir).expect("create root dir");
        fs::create_dir_all(&external_dir).expect("create external dir");

        let linked_dir = root_dir.join("linked");
        symlink(&external_dir, &linked_dir).expect("create linked dir");

        let root_canonical = fs::canonicalize(&root_dir).expect("canonicalize root");
        let result = resolve_scoped_write_path(&root_canonical, "linked/new.http");
        assert!(result.is_err(), "expected symlinked parent to be rejected");

        let _ = fs::remove_dir_all(&root_dir);
        let _ = fs::remove_dir_all(&external_dir);
    }

    #[test]
    fn scoped_write_allows_regular_path_within_root() {
        let root_dir = unique_temp_dir("scoped-write-ok");
        fs::create_dir_all(&root_dir).expect("create root dir");

        write_scoped_text_file(
            root_dir.to_string_lossy().to_string(),
            "nested/request.http".to_string(),
            "GET https://example.com".to_string(),
        )
        .expect("write scoped file");

        let written = fs::read_to_string(root_dir.join("nested").join("request.http"))
            .expect("read written file");
        assert_eq!(written, "GET https://example.com");

        let _ = fs::remove_dir_all(&root_dir);
    }

    #[cfg(unix)]
    #[test]
    fn discover_collections_ignores_symlink_files_and_dirs() {
        use std::os::unix::fs::symlink;

        let workspace_root = unique_temp_dir("discover-symlink-root");
        let outside_dir = unique_temp_dir("discover-symlink-outside");
        fs::create_dir_all(&workspace_root).expect("create workspace root");
        fs::create_dir_all(&outside_dir).expect("create outside dir");

        let outside_file = outside_dir.join("outside.http");
        fs::write(&outside_file, "GET https://example.com").expect("write outside request");
        symlink(&outside_file, workspace_root.join("linked.http")).expect("create file symlink");
        symlink(&workspace_root, workspace_root.join("loop")).expect("create loop symlink");

        let workspace = Workspace {
            id: "workspace:test".to_string(),
            name: "test".to_string(),
            uri: workspace_root.to_string_lossy().to_string(),
        };

        let collections = discover_collections(workspace).expect("discover collections");
        assert!(
            collections.is_empty(),
            "symlinked .http files should not produce collections"
        );

        let _ = fs::remove_dir_all(&workspace_root);
        let _ = fs::remove_dir_all(&outside_dir);
    }
}
