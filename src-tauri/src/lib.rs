mod commands;

use commands::release_commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            release_scan_projects,
            release_docker_build,
            release_docker_buildx,
            release_docker_push,
            release_docker_ssh_deploy,
            release_compose_up,
            release_vercel_deploy,
            release_cloudflare_deploy,
            release_npm_publish,
            release_firebase_deploy,
            release_netlify_deploy,
            release_flyio_deploy,
            release_bump_version,
            release_load_settings,
            release_save_settings,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, _event| {});
}
