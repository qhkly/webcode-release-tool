(function () {
  const tauriInvoke = window.__TAURI__?.core?.invoke;
  const tauriListen = window.__TAURI__?.event?.listen;
  const fallbackSettings = {
    base_dir: "/Users/jiayiqiu/智能体/webcode",
    ssh_hosts: [],
  };

  function invoke(command, args) {
    if (!tauriInvoke) {
      if (command === "release_load_settings") return Promise.resolve(fallbackSettings);
      if (command === "release_save_settings") return Promise.resolve();
      if (command === "release_scan_projects") return Promise.resolve([]);
      if (command === "release_bump_version") return Promise.reject(new Error("Tauri bridge is unavailable"));
      return Promise.resolve({ success: false, output: "Tauri bridge is unavailable" });
    }
    return tauriInvoke(command, args);
  }

  window.Bridge = {
    scanProjects: (baseDir) => invoke("release_scan_projects", { baseDir }),
    bumpVersion: (projectPath, bumpType) => invoke("release_bump_version", { projectPath, bumpType }),
    dockerBuild: (p) => invoke("release_docker_build", p),
    dockerBuildx: (p) => invoke("release_docker_buildx", p),
    dockerPush: (p) => invoke("release_docker_push", p),
    dockerSshDeploy: (p) => invoke("release_docker_ssh_deploy", p),
    composeUp: (p) => invoke("release_compose_up", p),
    vercelDeploy: (p) => invoke("release_vercel_deploy", p),
    cloudflareDeploy: (p) => invoke("release_cloudflare_deploy", p),
    npmPublish: (p) => invoke("release_npm_publish", p),
    firebaseDeploy: (p) => invoke("release_firebase_deploy", p),
    netlifyDeploy: (p) => invoke("release_netlify_deploy", p),
    flyioDeploy: (p) => invoke("release_flyio_deploy", p),
    loadSettings: () => invoke("release_load_settings"),
    saveSettings: (settings) => invoke("release_save_settings", { settings }),
    onLog: (cb) => {
      if (!tauriListen) return Promise.resolve(() => {});
      return tauriListen("release_log", (event) => cb(event.payload));
    },
  };
})();
