use serde::{Deserialize, Serialize};
use std::{
    env, fs,
    path::{Path, PathBuf},
    process::Stdio,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter};
use tokio::{
    io::{AsyncBufReadExt, BufReader},
    process::Command,
};

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct ProjectInfo {
    pub name: String,
    pub path: String,
    pub deploy_types: Vec<String>,
    pub dockerfile_path: Option<String>,
    pub has_compose: bool,
    pub suggested_image: String,
    pub wrangler_type: Option<String>,
    pub npm_name: Option<String>,
    pub version: Option<String>,
    pub version_file: Option<String>,
    pub version_file_type: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct VersionResult {
    pub old_version: String,
    pub new_version: String,
    pub file: String,
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct SshHost {
    pub name: String,
    pub host: String,
    pub user: String,
    pub port: u16,
    pub key_path: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Settings {
    pub base_dir: String,
    pub ssh_hosts: Vec<SshHost>,
}

#[derive(Serialize, Deserialize)]
pub struct OpResult {
    pub success: bool,
    pub output: String,
}

#[derive(Serialize, Clone)]
pub struct LogEvent {
    pub message: String,
    pub level: String,
    pub ts: String,
}

#[derive(Clone)]
struct ExecSpec {
    program: String,
    args: Vec<String>,
    shell: bool,
}

struct VersionInfo {
    version: String,
    file: PathBuf,
    kind: String,
}

#[tauri::command]
pub fn release_scan_projects(base_dir: String) -> Vec<ProjectInfo> {
    let mut projects = Vec::new();
    let root = PathBuf::from(expand_home(&base_dir));
    let Ok(entries) = fs::read_dir(root) else {
        return projects;
    };

    for entry in entries.flatten() {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if !file_type.is_dir() {
            continue;
        }

        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || name == "node_modules" || name == "target" {
            continue;
        }

        let mut deploy_types = Vec::new();
        let dockerfile_path = find_file_case(&path, &["Dockerfile", "dockerfile"]);
        if dockerfile_path.is_some() {
            deploy_types.push("docker".to_string());
        }

        let has_compose = has_any(&path, &["docker-compose.yml", "docker-compose.yaml"]);
        if has_compose {
            deploy_types.push("compose".to_string());
        }

        if has_any(&path, &["vercel.json"]) || path.join(".vercel/project.json").exists() {
            deploy_types.push("vercel".to_string());
        }

        let wrangler = read_wrangler(&path);
        if let Some((kind, _output_dir)) = &wrangler {
            if kind == "pages" {
                deploy_types.push("cf_pages".to_string());
            } else {
                deploy_types.push("cf_workers".to_string());
            }
        }

        let npm_name = detect_npm(&path, &mut deploy_types);

        if has_any(&path, &["firebase.json", ".firebaserc"]) {
            deploy_types.push("firebase".to_string());
        }
        if has_any(&path, &["netlify.toml"]) || path.join(".netlify").is_dir() {
            deploy_types.push("netlify".to_string());
        }
        if has_any(&path, &["fly.toml"]) {
            deploy_types.push("flyio".to_string());
        }

        if deploy_types.is_empty() {
            continue;
        }

        deploy_types.sort();
        deploy_types.dedup();
        let version_info = detect_version(&path);

        projects.push(ProjectInfo {
            name: name.clone(),
            path: path.to_string_lossy().to_string(),
            deploy_types,
            dockerfile_path: dockerfile_path.map(|p| p.to_string_lossy().to_string()),
            has_compose,
            suggested_image: suggested_image(&name),
            wrangler_type: wrangler.map(|(kind, _)| kind),
            npm_name,
            version: version_info.as_ref().map(|v| v.version.clone()),
            version_file: version_info
                .as_ref()
                .map(|v| v.file.to_string_lossy().to_string()),
            version_file_type: version_info.as_ref().map(|v| v.kind.clone()),
        });
    }

    projects.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    projects
}

#[tauri::command]
pub async fn release_docker_build(
    project_path: String,
    image_name: String,
    tag: String,
    app_handle: AppHandle,
) -> OpResult {
    let image_tag = format_image_tag(&image_name, &tag);
    run_streaming(
        ExecSpec {
            program: "docker".to_string(),
            args: vec!["build".into(), "-t".into(), image_tag, ".".into()],
            shell: false,
        },
        Some(project_path),
        app_handle,
    )
    .await
}

#[tauri::command]
pub async fn release_docker_buildx(
    project_path: String,
    image_name: String,
    tag: String,
    platforms: String,
    push_flag: bool,
    app_handle: AppHandle,
) -> OpResult {
    let image_tag = format_image_tag(&image_name, &tag);
    let mut args = vec![
        "buildx".to_string(),
        "build".to_string(),
        "--platform".to_string(),
        platforms,
        "-t".to_string(),
        image_tag,
    ];
    if push_flag {
        args.push("--push".to_string());
    }
    args.push(".".to_string());

    run_streaming(
        ExecSpec {
            program: "docker".to_string(),
            args,
            shell: false,
        },
        Some(project_path),
        app_handle,
    )
    .await
}

#[tauri::command]
pub async fn release_docker_push(image: String, app_handle: AppHandle) -> OpResult {
    run_streaming(
        ExecSpec {
            program: "docker".to_string(),
            args: vec!["push".into(), image],
            shell: false,
        },
        None,
        app_handle,
    )
    .await
}

#[tauri::command]
pub async fn release_docker_ssh_deploy(
    image: String,
    project_path: String,
    ssh_host: SshHost,
    run_compose: bool,
    app_handle: AppHandle,
) -> OpResult {
    let key = shell_quote(&expand_home(&ssh_host.key_path));
    let target = format!("{}@{}", ssh_host.user, ssh_host.host);
    let load_cmd = format!(
        "docker save {} | gzip | ssh -i {} -p {} {} 'docker load'",
        shell_quote(&image),
        key,
        ssh_host.port,
        shell_quote(&target)
    );

    let first = run_streaming(
        ExecSpec {
            program: load_cmd,
            args: vec![],
            shell: true,
        },
        Some(project_path.clone()),
        app_handle.clone(),
    )
    .await;
    if !first.success || !run_compose || !find_compose(&PathBuf::from(&project_path)).is_some() {
        return first;
    }

    let project_name = PathBuf::from(&project_path)
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "release".to_string());
    let remote_dir = format!("/tmp/compose-{}", safe_name(&project_name));
    let compose_path = find_compose(&PathBuf::from(&project_path)).unwrap();
    let compose_cmd = format!(
        "ssh -i {key} -p {port} {target} 'mkdir -p {remote_dir}' && scp -i {key} -P {port} {compose} {target}:{remote_dir}/docker-compose.yml && ssh -i {key} -p {port} {target} 'cd {remote_dir} && docker compose up -d'",
        key = key,
        port = ssh_host.port,
        target = shell_quote(&target),
        remote_dir = shell_quote(&remote_dir),
        compose = shell_quote(&compose_path.to_string_lossy()),
    );

    run_streaming(
        ExecSpec {
            program: compose_cmd,
            args: vec![],
            shell: true,
        },
        Some(project_path),
        app_handle,
    )
    .await
}

#[tauri::command]
pub async fn release_compose_up(project_path: String, app_handle: AppHandle) -> OpResult {
    run_streaming(
        ExecSpec {
            program: "docker".to_string(),
            args: vec!["compose".into(), "up".into(), "-d".into()],
            shell: false,
        },
        Some(project_path),
        app_handle,
    )
    .await
}

#[tauri::command]
pub async fn release_vercel_deploy(project_path: String, app_handle: AppHandle) -> OpResult {
    run_tool(find_node_tool("vercel", "vercel"), vec!["--prod".into()], project_path, app_handle).await
}

#[tauri::command]
pub async fn release_cloudflare_deploy(project_path: String, app_handle: AppHandle) -> OpResult {
    let (_kind, output_dir) = read_wrangler(&PathBuf::from(&project_path))
        .unwrap_or_else(|| ("workers".to_string(), None));
    let args = if let Some(dir) = output_dir {
        vec!["pages".into(), "deploy".into(), dir]
    } else {
        vec!["deploy".into()]
    };
    run_tool(find_node_tool("wrangler", "wrangler"), args, project_path, app_handle).await
}

#[tauri::command]
pub async fn release_npm_publish(project_path: String, app_handle: AppHandle) -> OpResult {
    if package_has_build_script(&PathBuf::from(&project_path)) {
        emit_log(&app_handle, "检测到 build 脚本，先执行 npm run build", "info");
        let build = run_streaming(
            ExecSpec {
                program: "npm".to_string(),
                args: vec!["run".into(), "build".into()],
                shell: false,
            },
            Some(project_path.clone()),
            app_handle.clone(),
        )
        .await;
        if !build.success {
            emit_log(&app_handle, "build 失败，已取消 npm publish", "error");
            return build;
        }
    }

    run_streaming(
        ExecSpec {
            program: "npm".to_string(),
            args: vec!["publish".into()],
            shell: false,
        },
        Some(project_path),
        app_handle,
    )
    .await
}

#[tauri::command]
pub async fn release_firebase_deploy(project_path: String, app_handle: AppHandle) -> OpResult {
    run_tool(find_node_tool("firebase", "firebase-tools"), vec!["deploy".into()], project_path, app_handle).await
}

#[tauri::command]
pub async fn release_netlify_deploy(project_path: String, app_handle: AppHandle) -> OpResult {
    run_tool(
        find_node_tool("netlify", "netlify-cli"),
        vec!["deploy".into(), "--prod".into()],
        project_path,
        app_handle,
    )
    .await
}

#[tauri::command]
pub async fn release_flyio_deploy(project_path: String, app_handle: AppHandle) -> OpResult {
    let spec = if Path::new("/opt/homebrew/bin/flyctl").exists() {
        ExecSpec {
            program: "/opt/homebrew/bin/flyctl".into(),
            args: vec!["deploy".into()],
            shell: false,
        }
    } else if Path::new("/usr/local/bin/flyctl").exists() {
        ExecSpec {
            program: "/usr/local/bin/flyctl".into(),
            args: vec!["deploy".into()],
            shell: false,
        }
    } else {
        ExecSpec {
            program: "flyctl".into(),
            args: vec!["deploy".into()],
            shell: false,
        }
    };
    run_streaming(spec, Some(project_path), app_handle).await
}

#[tauri::command]
pub fn release_bump_version(project_path: String, bump_type: String) -> Result<VersionResult, String> {
    let project = PathBuf::from(expand_home(&project_path));
    let info = detect_version(&project).ok_or_else(|| "未找到可更新的版本文件".to_string())?;
    let new_version = bump_semver(&info.version, &bump_type)?;

    match info.kind.as_str() {
        "package_json" => {
            write_json_version(&info.file, &new_version)?;
            let tauri_conf = project.join("src-tauri/tauri.conf.json");
            if tauri_conf.exists() {
                write_json_version(&tauri_conf, &new_version)?;
            }
        }
        "tauri_conf" => write_json_version(&info.file, &new_version)?,
        "cargo_toml" => write_cargo_version(&info.file, &new_version)?,
        "version_file" => fs::write(&info.file, format!("{}\n", new_version)).map_err(|e| e.to_string())?,
        _ => return Err(format!("不支持的版本文件类型: {}", info.kind)),
    }

    Ok(VersionResult {
        old_version: info.version,
        new_version,
        file: info.file.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn release_load_settings() -> Settings {
    let path = settings_path();
    if let Ok(raw) = fs::read_to_string(path) {
        if let Ok(settings) = serde_json::from_str::<Settings>(&raw) {
            return settings;
        }
    }
    default_settings()
}

#[tauri::command]
pub fn release_save_settings(settings: Settings) -> Result<(), String> {
    let path = settings_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let raw = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(path, raw).map_err(|e| e.to_string())
}

async fn run_tool(
    tool: ExecSpec,
    extra_args: Vec<String>,
    project_path: String,
    app_handle: AppHandle,
) -> OpResult {
    let mut spec = tool;
    spec.args.extend(extra_args);
    run_streaming(spec, Some(project_path), app_handle).await
}

async fn run_streaming(spec: ExecSpec, cwd: Option<String>, app_handle: AppHandle) -> OpResult {
    emit_log(&app_handle, format!("$ {}", display_command(&spec)), "info");

    let mut command = if spec.shell {
        let mut cmd = Command::new("sh");
        cmd.arg("-c").arg(&spec.program);
        cmd
    } else {
        let mut cmd = Command::new(&spec.program);
        cmd.args(&spec.args);
        cmd
    };

    if let Some(path) = cwd {
        command.current_dir(expand_home(&path));
    }
    command.env("PATH", get_enhanced_path());
    command.stdout(Stdio::piped()).stderr(Stdio::piped());

    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(err) => {
            let message = format!("启动失败: {}", err);
            emit_log(&app_handle, &message, "error");
            return OpResult {
                success: false,
                output: message,
            };
        }
    };

    let mut stdout = child.stdout.take().map(BufReader::new);
    let mut stderr = child.stderr.take().map(BufReader::new);
    let out_app = app_handle.clone();
    let err_app = app_handle.clone();

    let out_task = tokio::spawn(async move {
        let mut lines = Vec::new();
        if let Some(reader) = stdout.as_mut() {
            let mut stream = reader.lines();
            while let Ok(Some(line)) = stream.next_line().await {
                emit_log(&out_app, &line, "info");
                lines.push(line);
                trim_lines(&mut lines);
            }
        }
        lines
    });

    let err_task = tokio::spawn(async move {
        let mut lines = Vec::new();
        if let Some(reader) = stderr.as_mut() {
            let mut stream = reader.lines();
            while let Ok(Some(line)) = stream.next_line().await {
                emit_log(&err_app, &line, "error");
                lines.push(line);
                trim_lines(&mut lines);
            }
        }
        lines
    });

    let status = child.wait().await;
    let mut lines = out_task.await.unwrap_or_default();
    lines.extend(err_task.await.unwrap_or_default());
    trim_lines(&mut lines);

    match status {
        Ok(status) if status.success() => {
            emit_log(&app_handle, "完成", "success");
            OpResult {
                success: true,
                output: lines.join("\n"),
            }
        }
        Ok(status) => {
            let message = format!("退出码: {}", status.code().unwrap_or(-1));
            emit_log(&app_handle, &message, "error");
            OpResult {
                success: false,
                output: lines.join("\n"),
            }
        }
        Err(err) => {
            let message = format!("等待进程失败: {}", err);
            emit_log(&app_handle, &message, "error");
            OpResult {
                success: false,
                output: message,
            }
        }
    }
}

fn emit_log(app_handle: &AppHandle, message: impl Into<String>, level: &str) {
    let _ = app_handle.emit(
        "release_log",
        LogEvent {
            message: message.into(),
            level: level.to_string(),
            ts: current_time(),
        },
    );
}

fn current_time() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() % 86_400)
        .unwrap_or(0);
    format!("{:02}:{:02}:{:02}", secs / 3600, (secs % 3600) / 60, secs % 60)
}

fn trim_lines(lines: &mut Vec<String>) {
    if lines.len() > 240 {
        lines.drain(0..lines.len() - 240);
    }
}

fn find_node_tool(name: &str, npx_package: &str) -> ExecSpec {
    let homebrew = format!("/opt/homebrew/bin/{}", name);
    let npm_global = dirs::home_dir()
        .map(|home| home.join(".npm-global/bin").join(name))
        .unwrap_or_default();
    if Path::new(&homebrew).exists() {
        ExecSpec {
            program: homebrew,
            args: vec![],
            shell: false,
        }
    } else if npm_global.exists() {
        ExecSpec {
            program: npm_global.to_string_lossy().to_string(),
            args: vec![],
            shell: false,
        }
    } else {
        ExecSpec {
            program: "npx".to_string(),
            args: vec![npx_package.to_string()],
            shell: false,
        }
    }
}

fn get_enhanced_path() -> String {
    let current = env::var("PATH").unwrap_or_default();
    let mut parts = vec!["/opt/homebrew/bin".to_string(), "/usr/local/bin".to_string()];

    if let Some(home) = dirs::home_dir() {
        let node_root = home.join(".nvm/versions/node");
        if let Ok(entries) = fs::read_dir(node_root) {
            let mut bins: Vec<PathBuf> = entries
                .flatten()
                .map(|e| e.path().join("bin"))
                .filter(|p| p.is_dir())
                .collect();
            bins.sort_by(|a, b| b.cmp(a));
            if let Some(bin) = bins.first() {
                parts.push(bin.to_string_lossy().to_string());
            }
        }
        parts.push(home.join(".npm-global/bin").to_string_lossy().to_string());
    }

    parts.push(current);
    parts.join(":")
}

fn read_wrangler(path: &Path) -> Option<(String, Option<String>)> {
    let toml = path.join("wrangler.toml");
    if toml.exists() {
        let raw = fs::read_to_string(toml).ok()?;
        let output = parse_pages_output_text(&raw);
        return Some(if output.is_some() {
            ("pages".to_string(), output)
        } else {
            ("workers".to_string(), None)
        });
    }

    let json = path.join("wrangler.json");
    if json.exists() {
        let raw = fs::read_to_string(json).ok()?;
        let parsed: serde_json::Value = serde_json::from_str(&raw).ok()?;
        let output = parsed
            .get("pages_build_output_dir")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        return Some(if output.is_some() {
            ("pages".to_string(), output)
        } else {
            ("workers".to_string(), None)
        });
    }

    None
}

fn parse_pages_output_text(raw: &str) -> Option<String> {
    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('#') || !trimmed.starts_with("pages_build_output_dir") {
            continue;
        }
        let value = trimmed.split_once('=')?.1.trim();
        return Some(value.trim_matches('"').trim_matches('\'').to_string());
    }
    None
}

fn detect_npm(path: &Path, deploy_types: &mut Vec<String>) -> Option<String> {
    let pkg_path = path.join("package.json");
    let raw = fs::read_to_string(pkg_path).ok()?;
    let pkg: serde_json::Value = serde_json::from_str(&raw).ok()?;
    let private = pkg
        .get("private")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let has_publish_config = pkg.get("publishConfig").is_some();
    let has_publish_script = pkg
        .get("scripts")
        .and_then(|v| v.get("publish"))
        .is_some();
    if !private || has_publish_config || has_publish_script {
        deploy_types.push("npm".to_string());
    }
    pkg.get("name").and_then(|v| v.as_str()).map(|s| s.to_string())
}

fn detect_version(path: &Path) -> Option<VersionInfo> {
    let package_json = path.join("package.json");
    if let Some(version) = read_json_version(&package_json) {
        return Some(VersionInfo {
            version,
            file: package_json,
            kind: "package_json".to_string(),
        });
    }

    let tauri_conf = path.join("src-tauri/tauri.conf.json");
    if let Some(version) = read_json_version(&tauri_conf) {
        return Some(VersionInfo {
            version,
            file: tauri_conf,
            kind: "tauri_conf".to_string(),
        });
    }

    let cargo_toml = path.join("Cargo.toml");
    if let Some(version) = read_cargo_version(&cargo_toml) {
        return Some(VersionInfo {
            version,
            file: cargo_toml,
            kind: "cargo_toml".to_string(),
        });
    }

    let version_file = path.join("VERSION");
    if version_file.exists() {
        let raw = fs::read_to_string(&version_file).ok()?;
        let version = raw.lines().next()?.trim().trim_start_matches('v').to_string();
        if is_semver(&version) {
            return Some(VersionInfo {
                version,
                file: version_file,
                kind: "version_file".to_string(),
            });
        }
    }

    None
}

fn read_json_version(path: &Path) -> Option<String> {
    let raw = fs::read_to_string(path).ok()?;
    let parsed: serde_json::Value = serde_json::from_str(&raw).ok()?;
    let version = parsed.get("version")?.as_str()?.trim().trim_start_matches('v').to_string();
    if is_semver(&version) {
        Some(version)
    } else {
        None
    }
}

fn read_cargo_version(path: &Path) -> Option<String> {
    let raw = fs::read_to_string(path).ok()?;
    let mut in_package = false;
    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            in_package = trimmed == "[package]";
            continue;
        }
        if in_package && is_version_assignment(trimmed) {
            let (_, value) = trimmed.split_once('=')?;
            let version = value
                .trim()
                .trim_matches('"')
                .trim_matches('\'')
                .trim_start_matches('v')
                .to_string();
            if is_semver(&version) {
                return Some(version);
            }
        }
    }
    None
}

fn package_has_build_script(path: &Path) -> bool {
    let pkg_path = path.join("package.json");
    let Ok(raw) = fs::read_to_string(pkg_path) else {
        return false;
    };
    let Ok(pkg) = serde_json::from_str::<serde_json::Value>(&raw) else {
        return false;
    };
    pkg.get("scripts")
        .and_then(|scripts| scripts.get("build"))
        .and_then(|script| script.as_str())
        .map(|script| !script.trim().is_empty())
        .unwrap_or(false)
}

fn bump_semver(version: &str, bump_type: &str) -> Result<String, String> {
    let clean = version.trim().trim_start_matches('v');
    let parts: Vec<&str> = clean.split('.').collect();
    if parts.len() != 3 {
        return Err(format!("版本不是 x.y.z 格式: {}", version));
    }
    let mut major = parts[0].parse::<u64>().map_err(|_| format!("无效版本: {}", version))?;
    let mut minor = parts[1].parse::<u64>().map_err(|_| format!("无效版本: {}", version))?;
    let mut patch = parts[2].parse::<u64>().map_err(|_| format!("无效版本: {}", version))?;

    match bump_type {
        "patch" => patch += 1,
        "minor" => {
            minor += 1;
            patch = 0;
        }
        "major" => {
            major += 1;
            minor = 0;
            patch = 0;
        }
        _ => return Err(format!("不支持的版本类型: {}", bump_type)),
    }

    Ok(format!("{}.{}.{}", major, minor, patch))
}

fn is_semver(version: &str) -> bool {
    let parts: Vec<&str> = version.split('.').collect();
    parts.len() == 3 && parts.iter().all(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_digit()))
}

fn write_json_version(path: &Path, version: &str) -> Result<(), String> {
    let raw = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let mut parsed: serde_json::Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    let Some(object) = parsed.as_object_mut() else {
        return Err(format!("不是 JSON 对象: {}", path.to_string_lossy()));
    };
    object.insert("version".to_string(), serde_json::Value::String(version.to_string()));
    let updated = serde_json::to_string_pretty(&parsed).map_err(|e| e.to_string())?;
    fs::write(path, format!("{}\n", updated)).map_err(|e| e.to_string())
}

fn write_cargo_version(path: &Path, version: &str) -> Result<(), String> {
    let raw = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let mut in_package = false;
    let mut changed = false;
    let mut lines = Vec::new();

    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            in_package = trimmed == "[package]";
        }
        if in_package && !changed && is_version_assignment(trimmed) {
            let leading = line.chars().take_while(|c| c.is_whitespace()).collect::<String>();
            lines.push(format!("{}version = \"{}\"", leading, version));
            changed = true;
        } else {
            lines.push(line.to_string());
        }
    }

    if !changed {
        return Err(format!("未在 [package] 中找到 version: {}", path.to_string_lossy()));
    }

    fs::write(path, format!("{}\n", lines.join("\n"))).map_err(|e| e.to_string())
}

fn is_version_assignment(line: &str) -> bool {
    line.strip_prefix("version")
        .map(|rest| rest.trim_start().starts_with('='))
        .unwrap_or(false)
}

fn has_any(path: &Path, names: &[&str]) -> bool {
    names.iter().any(|name| path.join(name).exists())
}

fn find_file_case(path: &Path, names: &[&str]) -> Option<PathBuf> {
    names.iter().map(|name| path.join(name)).find(|p| p.exists())
}

fn find_compose(path: &Path) -> Option<PathBuf> {
    find_file_case(path, &["docker-compose.yml", "docker-compose.yaml"])
}

fn suggested_image(name: &str) -> String {
    let mut base = name.to_lowercase();
    for suffix in ["-docker", "_docker"] {
        if base.ends_with(suffix) {
            base.truncate(base.len() - suffix.len());
        }
    }
    format!("land007/{}", base.replace('_', "-"))
}

fn format_image_tag(image_name: &str, tag: &str) -> String {
    let image = image_name.trim();
    let tag = tag.trim();
    if tag.is_empty() || image.contains(':') {
        image.to_string()
    } else {
        format!("{}:{}", image, tag)
    }
}

fn settings_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("webcode-release-tool/settings.json")
}

fn default_settings() -> Settings {
    let base_dir = dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("/Users/jiayiqiu"))
        .join("智能体/webcode")
        .to_string_lossy()
        .to_string();
    Settings {
        base_dir,
        ssh_hosts: Vec::new(),
    }
}

fn expand_home(path: &str) -> String {
    if let Some(rest) = path.strip_prefix("~/") {
        if let Some(home) = dirs::home_dir() {
            return home.join(rest).to_string_lossy().to_string();
        }
    }
    path.to_string()
}

fn safe_name(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .collect()
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

fn display_command(spec: &ExecSpec) -> String {
    if spec.shell {
        spec.program.clone()
    } else {
        std::iter::once(spec.program.clone())
            .chain(spec.args.clone())
            .collect::<Vec<_>>()
            .join(" ")
    }
}
