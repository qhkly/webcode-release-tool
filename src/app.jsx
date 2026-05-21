const { useEffect, useMemo, useRef, useState } = React;

const TYPE_META = {
  docker: { label: "Docker", cls: "docker" },
  compose: { label: "Compose", cls: "compose" },
  vercel: { label: "Vercel", cls: "vercel" },
  cf_workers: { label: "CF Workers", cls: "cloudflare" },
  cf_pages: { label: "CF Pages", cls: "cloudflare" },
  npm: { label: "npm", cls: "npm" },
  firebase: { label: "Firebase", cls: "firebase" },
  netlify: { label: "Netlify", cls: "netlify" },
  flyio: { label: "Fly.io", cls: "flyio" },
};

const COMMANDS = {
  compose: { title: "Docker Compose", action: "composeUp", confirm: "在本机执行 docker compose up -d" },
  vercel: { title: "发布到 Vercel", action: "vercelDeploy", confirm: "执行 vercel --prod" },
  cf_workers: { title: "发布到 Cloudflare Workers", action: "cloudflareDeploy", confirm: "执行 wrangler deploy" },
  cf_pages: { title: "发布到 Cloudflare Pages", action: "cloudflareDeploy", confirm: "执行 wrangler pages deploy" },
  npm: { title: "npm publish", action: "npmPublish", confirm: "执行 npm publish" },
  firebase: { title: "发布到 Firebase", action: "firebaseDeploy", confirm: "执行 firebase deploy" },
  netlify: { title: "发布到 Netlify", action: "netlifyDeploy", confirm: "执行 netlify deploy --prod" },
  flyio: { title: "发布到 Fly.io", action: "flyioDeploy", confirm: "执行 flyctl deploy" },
};

function nowTime() {
  return new Date().toTimeString().slice(0, 8);
}

function shortPath(path) {
  return String(path || "").replace(/^\/Users\/[^/]+/, "~");
}

function defaultTag() {
  return "latest";
}

function actionLabel(type) {
  const labels = {
    docker_build: "Docker Build",
    docker_buildx: "Docker Buildx",
    docker_push: "Docker Push",
    docker_ssh: "SSH 部署",
  };
  return labels[type] || TYPE_META[type]?.label || COMMANDS[type]?.title || type;
}

function bumpVersion(version, type) {
  if (!version || type === "none") return version || "";
  const parts = String(version).replace(/^v/, "").split(".").map((n) => Number(n));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return version;
  if (type === "patch") parts[2] += 1;
  if (type === "minor") {
    parts[1] += 1;
    parts[2] = 0;
  }
  if (type === "major") {
    parts[0] += 1;
    parts[1] = 0;
    parts[2] = 0;
  }
  return parts.join(".");
}

function versionFileLabel(type) {
  return {
    package_json: "package.json",
    tauri_conf: "tauri.conf.json",
    cargo_toml: "Cargo.toml",
    version_file: "VERSION",
  }[type] || "未检测到版本文件";
}

function icon(name) {
  const common = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    scan: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
    gear: <><path d="M4 7h10" /><circle cx="17" cy="7" r="2" /><path d="M20 17H10" /><circle cx="7" cy="17" r="2" /></>,
    moon: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" /></>,
    play: <path d="m8 5 11 7-11 7V5Z" />,
    package: <><path d="m21 8-9-5-9 5 9 5 9-5Z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></>,
    upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 20h16" /></>,
    terminal: <><path d="m4 17 6-5-6-5" /><path d="M12 19h8" /></>,
    trash: <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="m6 6 1 15h10l1-15" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function App() {
  const [settings, setSettings] = useState({ base_dir: "/Users/jiayiqiu/智能体/webcode", ssh_hosts: [] });
  const [projects, setProjects] = useState([]);
  const [logs, setLogs] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [running, setRunning] = useState({});
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState(localStorage.getItem("release-theme") || "dark");
  const [modal, setModal] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const logRef = useRef(null);

  useEffect(() => {
    Bridge.loadSettings().then((s) => {
      setSettings(s);
      scan(s.base_dir);
    });
    Bridge.onLog((event) => {
      setLogs((items) => [...items.slice(-599), event]);
    });
  }, []);

  useEffect(() => {
    localStorage.setItem("release-theme", theme);
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = 0;
  }, [logs, logOpen]);

  async function scan(baseDir = settings.base_dir) {
    setScanning(true);
    try {
      const found = await Bridge.scanProjects(baseDir);
      setProjects(found);
      pushLog(`扫描完成: ${found.length} 个可发布项目`, "success");
    } catch (err) {
      pushLog(`扫描失败: ${err.message || err}`, "error");
    } finally {
      setScanning(false);
    }
  }

  function pushLog(message, level = "info") {
    setLogs((items) => [...items.slice(-599), { message, level, ts: nowTime() }]);
  }

  async function saveSettings(next) {
    await Bridge.saveSettings(next);
    setSettings(next);
    setSettingsOpen(false);
    scan(next.base_dir);
  }

  async function runAction(project, type, form = {}) {
    const key = `${project.path}:${type}`;
    setRunning((r) => ({ ...r, [key]: true }));
    pushLog(`开始: ${project.name} / ${actionLabel(type)}`, "info");
    try {
      let activeProject = project;
      if (form.bumpType && form.bumpType !== "none") {
        const versionResult = await Bridge.bumpVersion(project.path, form.bumpType);
        activeProject = {
          ...project,
          version: versionResult.new_version,
          version_file: versionResult.file,
        };
        setProjects((items) => items.map((item) => item.path === project.path ? activeProject : item));
        pushLog(`${project.name}: v${versionResult.old_version} → v${versionResult.new_version}`, "success");
      }

      let result;
      if (type === "docker_build") {
        result = await Bridge.dockerBuild({
          projectPath: activeProject.path,
          imageName: form.imageName,
          tag: form.tag,
        });
      } else if (type === "docker_buildx") {
        result = await Bridge.dockerBuildx({
          projectPath: activeProject.path,
          imageName: form.imageName,
          tag: form.tag,
          platforms: form.platforms,
          pushFlag: !!form.pushFlag,
        });
      } else if (type === "docker_push") {
        result = await Bridge.dockerPush({ image: form.image });
      } else if (type === "docker_ssh") {
        result = await Bridge.dockerSshDeploy({
          image: form.image,
          projectPath: activeProject.path,
          sshHost: form.sshHost,
          runCompose: !!form.runCompose,
        });
      } else {
        const config = COMMANDS[type];
        result = await Bridge[config.action]({ projectPath: activeProject.path });
      }
      pushLog(`${activeProject.name}: ${result.success ? "完成" : "失败"}`, result.success ? "success" : "error");
    } catch (err) {
      pushLog(`${project.name}: ${err.message || err}`, "error");
    } finally {
      setRunning((r) => ({ ...r, [key]: false }));
      setModal(null);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => `${p.name} ${p.path} ${p.deploy_types.join(" ")} ${p.npm_name || ""} ${p.version || ""}`.toLowerCase().includes(q));
  }, [projects, query]);

  const counts = useMemo(() => {
    const allTypes = projects.flatMap((p) => p.deploy_types);
    return {
      projects: projects.length,
      docker: allTypes.filter((t) => t === "docker").length,
      cloud: allTypes.filter((t) => t.startsWith("cf_") || t === "vercel").length,
      packages: allTypes.filter((t) => t === "npm").length,
    };
  }, [projects]);

  return (
    <div className={`app ${theme}`}>
      <Toolbar
        settings={settings}
        scanning={scanning}
        query={query}
        setQuery={setQuery}
        theme={theme}
        setTheme={setTheme}
        onScan={() => scan()}
        onSettings={() => setSettingsOpen(true)}
      />
      <Stats counts={counts} />
      <main className="workspace">
        {filtered.length ? (
          <div className="project-grid">
            {filtered.map((project) => (
              <ProjectCard
                key={project.path}
                project={project}
                settings={settings}
                running={running}
                onOpenAction={(type) => setModal({ type, project })}
              />
            ))}
          </div>
        ) : (
          <div className="empty">
            <div className="empty-title">{scanning ? "正在扫描项目" : "没有匹配的发布目标"}</div>
            <div className="empty-sub">{shortPath(settings.base_dir)}</div>
          </div>
        )}
      </main>
      <LogPanel logs={logs} open={logOpen} setOpen={setLogOpen} onClear={() => setLogs([])} logRef={logRef} />
      {modal && <ActionModal modal={modal} settings={settings} onClose={() => setModal(null)} onRun={runAction} />}
      {settingsOpen && <SettingsModal settings={settings} onClose={() => setSettingsOpen(false)} onSave={saveSettings} />}
    </div>
  );
}

function Toolbar({ settings, scanning, query, setQuery, theme, setTheme, onScan, onSettings }) {
  return (
    <header className="toolbar">
      <div className="brand">
        <div className="brand-mark">{icon("upload")}</div>
        <div>
          <div className="brand-title">Release Dashboard</div>
          <button className="path-button" onClick={onSettings}>{shortPath(settings.base_dir)}</button>
        </div>
      </div>
      <div className="toolbar-center">
        <div className="search">{icon("scan")}<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索项目 / 平台 / 包名" /></div>
      </div>
      <div className="toolbar-actions">
        <button className="icon-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title="切换主题">{icon(theme === "dark" ? "sun" : "moon")}</button>
        <button className="icon-button" onClick={onSettings} title="设置">{icon("gear")}</button>
        <button className="primary-button" onClick={onScan} disabled={scanning}>{icon("scan")}<span>{scanning ? "扫描中" : "扫描项目"}</span></button>
      </div>
    </header>
  );
}

function Stats({ counts }) {
  return (
    <section className="stats">
      <div><strong>{counts.projects}</strong><span>项目</span></div>
      <div><strong>{counts.docker}</strong><span>Docker</span></div>
      <div><strong>{counts.cloud}</strong><span>云平台</span></div>
      <div><strong>{counts.packages}</strong><span>npm 包</span></div>
    </section>
  );
}

function ProjectCard({ project, settings, running, onOpenAction }) {
  const busy = Object.keys(running).some((key) => key.startsWith(`${project.path}:`) && running[key]);
  return (
    <article className={`project-card ${busy ? "busy" : ""}`}>
      <div className="card-head">
        <div>
          <div className="card-title-line">
            <h2>{project.name}</h2>
            <span className={`version-badge ${project.version ? "" : "empty"}`}>{project.version ? `v${project.version}` : "无版本"}</span>
          </div>
          <p>{shortPath(project.path)}</p>
        </div>
        <span className="status-dot" />
      </div>
      <div className="badges">
        {project.deploy_types.map((type) => <span key={type} className={`badge ${TYPE_META[type]?.cls || ""}`}>{TYPE_META[type]?.label || type}</span>)}
      </div>
      <div className="details">
        {project.npm_name && <span>包名 <b>{project.npm_name}</b></span>}
        {project.version_file_type && <span>版本 <b>{versionFileLabel(project.version_file_type)}</b></span>}
        {project.dockerfile_path && <span>镜像 <b>{project.suggested_image}</b></span>}
        {project.wrangler_type && <span>Wrangler <b>{project.wrangler_type}</b></span>}
      </div>
      <div className="actions">
        {project.deploy_types.includes("docker") && (
          <div className="action-row">
            <button onClick={() => onOpenAction("docker_build")}>Build</button>
            <button onClick={() => onOpenAction("docker_buildx")}>Buildx</button>
            <button onClick={() => onOpenAction("docker_push")}>Push</button>
            <button onClick={() => onOpenAction("docker_ssh")} disabled={!settings.ssh_hosts.length}>SSH部署</button>
          </div>
        )}
        {project.deploy_types.includes("compose") && <button onClick={() => onOpenAction("compose")}>Compose Up</button>}
        {project.deploy_types.includes("vercel") && <button onClick={() => onOpenAction("vercel")}>发布到 Vercel</button>}
        {project.deploy_types.includes("cf_workers") && <button onClick={() => onOpenAction("cf_workers")}>发布到 Cloudflare</button>}
        {project.deploy_types.includes("cf_pages") && <button onClick={() => onOpenAction("cf_pages")}>发布到 Cloudflare</button>}
        {project.deploy_types.includes("npm") && <button onClick={() => onOpenAction("npm")}>npm publish</button>}
        {project.deploy_types.includes("firebase") && <button onClick={() => onOpenAction("firebase")}>发布到 Firebase</button>}
        {project.deploy_types.includes("netlify") && <button onClick={() => onOpenAction("netlify")}>发布到 Netlify</button>}
        {project.deploy_types.includes("flyio") && <button onClick={() => onOpenAction("flyio")}>发布到 Fly.io</button>}
      </div>
    </article>
  );
}

function ActionModal({ modal, settings, onClose, onRun }) {
  const { type, project } = modal;
  const [imageName, setImageName] = useState(project.suggested_image || "");
  const [tag, setTag] = useState(project.version || defaultTag());
  const [image, setImage] = useState(`${project.suggested_image || ""}:${project.version || defaultTag()}`);
  const [platforms, setPlatforms] = useState("linux/amd64,linux/arm64");
  const [pushFlag, setPushFlag] = useState(true);
  const [hostName, setHostName] = useState(settings.ssh_hosts[0]?.name || "");
  const [runCompose, setRunCompose] = useState(project.has_compose);
  const [bumpType, setBumpType] = useState(project.version ? "patch" : "none");
  const host = settings.ssh_hosts.find((h) => h.name === hostName) || settings.ssh_hosts[0];
  const isDockerConfig = type.startsWith("docker_");
  const title = {
    docker_build: "Docker Build",
    docker_buildx: "Docker Buildx",
    docker_push: "Docker Push",
    docker_ssh: "SSH 部署 Docker 镜像",
  }[type] || COMMANDS[type]?.title;

  function submit() {
    const nextVersion = project.version && bumpType !== "none" ? bumpVersion(project.version, bumpType) : project.version;
    const effectiveTag = project.version && tag === project.version && nextVersion ? nextVersion : tag;
    const oldImage = `${project.suggested_image || ""}:${project.version || defaultTag()}`;
    const effectiveImage = project.version && image === oldImage && nextVersion ? `${project.suggested_image || ""}:${nextVersion}` : image;
    const form = {
      imageName,
      tag: effectiveTag,
      image: effectiveImage,
      platforms,
      pushFlag,
      sshHost: host,
      runCompose,
      bumpType,
    };
    onRun(project, type, form);
  }

  return (
    <Modal title={`发布 ${project.name}`} onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" onClick={submit} disabled={type === "docker_ssh" && !host}>{icon("play")}<span>确认发布</span></button></>}>
      <div className="modal-project">{title}<span>{shortPath(project.path)}</span></div>
      <VersionBumpOptions project={project} bumpType={bumpType} setBumpType={setBumpType} />
      {isDockerConfig ? (
        <div className="form-grid">
          {(type === "docker_build" || type === "docker_buildx") && (
            <>
              <Field label="镜像名"><input value={imageName} onChange={(e) => setImageName(e.target.value)} /></Field>
              <Field label="Tag"><input value={tag} onChange={(e) => setTag(e.target.value)} /></Field>
            </>
          )}
          {(type === "docker_push" || type === "docker_ssh") && <Field label="完整镜像"><input value={image} onChange={(e) => setImage(e.target.value)} /></Field>}
          {type === "docker_buildx" && (
            <>
              <Field label="平台"><input value={platforms} onChange={(e) => setPlatforms(e.target.value)} /></Field>
              <label className="check"><input type="checkbox" checked={pushFlag} onChange={(e) => setPushFlag(e.target.checked)} /> 构建后推送</label>
            </>
          )}
          {type === "docker_ssh" && (
            <>
              <Field label="SSH 主机">
                <select value={hostName} onChange={(e) => setHostName(e.target.value)}>
                  {settings.ssh_hosts.map((h) => <option key={h.name} value={h.name}>{h.name} · {h.user}@{h.host}:{h.port}</option>)}
                </select>
              </Field>
              {project.has_compose && <label className="check"><input type="checkbox" checked={runCompose} onChange={(e) => setRunCompose(e.target.checked)} /> 同步 compose 并执行 docker compose up -d</label>}
            </>
          )}
        </div>
      ) : (
        <div className="confirm-copy">{COMMANDS[type]?.confirm}</div>
      )}
    </Modal>
  );
}

function VersionBumpOptions({ project, bumpType, setBumpType }) {
  const options = [
    { id: "patch", label: "Patch", hint: "推荐" },
    { id: "minor", label: "Minor" },
    { id: "major", label: "Major" },
    { id: "none", label: "不修改版本" },
  ];
  return (
    <section className="version-box">
      <div className="version-box-head">
        <span>版本管理</span>
        <b className={project.version ? "" : "empty"}>
          {project.version ? `当前版本 v${project.version}` : "未检测到版本"}
        </b>
      </div>
      <div className="version-file-hint">{versionFileLabel(project.version_file_type)}</div>
      <div className="version-options">
        {options.map((option) => {
          const disabled = option.id !== "none" && !project.version;
          const next = option.id === "none" ? "" : bumpVersion(project.version, option.id);
          return (
            <label key={option.id} className={`version-option ${bumpType === option.id ? "on" : ""} ${disabled ? "disabled" : ""}`}>
              <input
                type="radio"
                name="bump-type"
                value={option.id}
                checked={bumpType === option.id}
                disabled={disabled}
                onChange={(e) => setBumpType(e.target.value)}
              />
              <span>{option.label}</span>
              {next && <code>→ v{next}</code>}
              {option.hint && project.version && <em>{option.hint}</em>}
            </label>
          );
        })}
      </div>
    </section>
  );
}

function SettingsModal({ settings, onClose, onSave }) {
  const [baseDir, setBaseDir] = useState(settings.base_dir || "");
  const [hosts, setHosts] = useState(settings.ssh_hosts || []);

  function updateHost(index, patch) {
    setHosts((items) => items.map((h, i) => i === index ? { ...h, ...patch } : h));
  }

  function addHost() {
    setHosts((items) => [...items, { name: "server", host: "", user: "root", port: 22, key_path: "~/.ssh/id_rsa" }]);
  }

  return (
    <Modal title="设置" onClose={onClose} wide footer={<><button className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" onClick={() => onSave({ base_dir: baseDir, ssh_hosts: hosts })}>{icon("upload")}<span>保存</span></button></>}>
      <div className="form-stack">
        <Field label="项目根目录"><input value={baseDir} onChange={(e) => setBaseDir(e.target.value)} /></Field>
        <div className="settings-head"><span>SSH 主机</span><button className="secondary-button small" onClick={addHost}>{icon("plus")}<span>添加</span></button></div>
        <div className="host-list">
          {hosts.map((host, index) => (
            <div className="host-row" key={index}>
              <input placeholder="名称" value={host.name} onChange={(e) => updateHost(index, { name: e.target.value })} />
              <input placeholder="host" value={host.host} onChange={(e) => updateHost(index, { host: e.target.value })} />
              <input placeholder="user" value={host.user} onChange={(e) => updateHost(index, { user: e.target.value })} />
              <input placeholder="port" type="number" value={host.port} onChange={(e) => updateHost(index, { port: Number(e.target.value) || 22 })} />
              <input placeholder="key path" value={host.key_path} onChange={(e) => updateHost(index, { key_path: e.target.value })} />
              <button className="icon-button" onClick={() => setHosts((items) => items.filter((_, i) => i !== index))}>{icon("trash")}</button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function Modal({ title, children, footer, onClose, wide }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className={`modal ${wide ? "wide" : ""}`} onMouseDown={(e) => e.stopPropagation()}>
        <header><h3>{title}</h3><button className="icon-button" onClick={onClose}>{icon("x")}</button></header>
        <div className="modal-body">{children}</div>
        <footer>{footer}</footer>
      </section>
    </div>
  );
}

function LogPanel({ logs, open, setOpen, onClear, logRef }) {
  const last = logs[logs.length - 1] || { ts: "--:--:--", message: "暂无日志", level: "info" };
  return (
    <section className={`log-panel ${open ? "open" : ""}`}>
      <header onClick={() => setOpen(!open)}>
        <div className="log-title">
          {icon("terminal")}
          <span>操作日志</span>
          <b>{logs.length} 条</b>
        </div>
        {!open && (
          <div className={`log-recent ${last.level}`}>
            <span>{last.ts}</span>
            <code>{last.message}</code>
          </div>
        )}
        <div className="log-tools">
          <button className="log-toggle" onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>{open ? "收起" : "展开"}</button>
          {open && <button className="log-toggle" onClick={(e) => { e.stopPropagation(); onClear(); }}>清空</button>}
        </div>
      </header>
      {open && (
        <div className="log-lines" ref={logRef}>
          {logs.slice().reverse().map((line, index) => (
            <div key={index} className={`log-line ${line.level}`}><span>{line.ts}</span><i /><code>{line.message}</code></div>
          ))}
        </div>
      )}
    </section>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
