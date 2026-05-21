# Webcode Release Tool

One-click software release dashboard for the local Webcode workspace.

The app scans project subdirectories, detects deploy targets from config files, shows each project as a release card, and streams deployment output into the bottom log panel.

## Stack

- Tauri 2
- Rust + Tokio backend
- React via local vendor files
- Babel CDN-style runtime transform, no frontend build step
- Vanilla CSS

## Run

```bash
npm install
npm run dev
```

Build the desktop app:

```bash
npm run build
```

Rust check:

```bash
cd src-tauri
cargo check
```

## Supported Targets

- Docker build, buildx, push, SSH load, and docker compose
- Vercel
- Cloudflare Workers and Pages
- npm publish
- Firebase
- Netlify
- Fly.io

## Project Detection

The scanner checks immediate subdirectories of the configured base directory.

Detected files map to deploy types:

- `Dockerfile` or `dockerfile`: Docker
- `docker-compose.yml` or `docker-compose.yaml`: Docker Compose
- `vercel.json` or `.vercel/project.json`: Vercel
- `wrangler.toml` or `wrangler.json`: Cloudflare Workers or Pages
- `package.json`: npm publish when publishable
- `firebase.json` or `.firebaserc`: Firebase
- `netlify.toml` or `.netlify/`: Netlify
- `fly.toml`: Fly.io

## Version Management

Version detection priority:

1. `package.json`
2. `src-tauri/tauri.conf.json`
3. `Cargo.toml`
4. `VERSION`

Before each deploy, the modal offers:

- Patch
- Minor
- Major
- No version change

For Tauri projects that have both `package.json` and `src-tauri/tauri.conf.json`, bumping the version updates both files.

## Settings

Settings are stored at:

```text
~/.config/webcode-release-tool/settings.json
```

Settings include:

- `base_dir`
- SSH hosts for Docker SSH deploy

## Notes

Deployment buttons run real local commands such as `docker`, `vercel`, `wrangler`, `npm`, `firebase`, `netlify`, and `flyctl`. Use the version bump and publish actions carefully on real projects.
