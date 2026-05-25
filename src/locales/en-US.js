if (window.i18n && window.i18n.lang === 'en-US') {
  window.i18n.messages = {
    // Toolbar
    'search.placeholder': 'Search project / platform / package',
    'btn.toggle_theme': 'Toggle theme',
    'btn.settings': 'Settings',
    'btn.scanning': 'Scanning...',
    'btn.scan': 'Scan Projects',
    'btn.toggle_lang': 'Switch language',

    // Stats
    'stats.projects': 'Projects',
    'stats.cloud': 'Cloud',
    'stats.packages': 'npm Packages',

    // ProjectCard
    'badge.no_version': 'No version',
    'detail.package': 'Package',
    'detail.version': 'Version',
    'detail.image': 'Image',
    'btn.ssh_deploy': 'SSH Deploy',
    'btn.publish_vercel': 'Deploy to Vercel',
    'btn.publish_cloudflare': 'Deploy to Cloudflare',
    'btn.publish_firebase': 'Deploy to Firebase',
    'btn.publish_netlify': 'Deploy to Netlify',
    'btn.publish_flyio': 'Deploy to Fly.io',

    // Empty state
    'empty.scanning': 'Scanning projects...',
    'empty.no_match': 'No matching deploy targets',

    // ActionModal
    'modal.publish_title': 'Deploy {name}',
    'modal.btn_cancel': 'Cancel',
    'modal.btn_confirm': 'Confirm Deploy',
    'modal.field.image_name': 'Image name',
    'modal.field.tag': 'Tag',
    'modal.field.full_image': 'Full image',
    'modal.field.platform': 'Platform',
    'modal.field.push_after_build': 'Push after build',
    'modal.field.ssh_host': 'SSH Host',
    'modal.field.sync_compose': 'Sync compose and run docker compose up -d',

    // VersionBumpOptions
    'version.title': 'Version Management',
    'version.current': 'Current v{version}',
    'version.not_detected': 'No version detected',
    'version.no_file': 'No version file detected',
    'version.no_change': 'No change',
    'version.recommended': 'Recommended',

    // SettingsModal
    'settings.title': 'Settings',
    'settings.base_dir': 'Projects root',
    'settings.ssh_hosts': 'SSH Hosts',
    'settings.btn_add': 'Add',
    'settings.btn_save': 'Save',
    'settings.ph.name': 'Name',

    // LogPanel
    'log.title': 'Operation Log',
    'log.count': '{count} entries',
    'log.no_logs': 'No logs',
    'log.expand': 'Expand',
    'log.collapse': 'Collapse',
    'log.clear': 'Clear',

    // Action labels/titles
    'action.docker_ssh_label': 'SSH Deploy',
    'action.docker_ssh': 'SSH Deploy Docker Image',

    // COMMANDS titles & confirms
    'cmd.compose.title': 'Docker Compose',
    'cmd.compose.confirm': 'Run docker compose up -d locally',
    'cmd.vercel.title': 'Deploy to Vercel',
    'cmd.vercel.confirm': 'Run vercel --prod',
    'cmd.cf_workers.title': 'Deploy to Cloudflare Workers',
    'cmd.cf_workers.confirm': 'Run wrangler deploy',
    'cmd.cf_pages.title': 'Deploy to Cloudflare Pages',
    'cmd.cf_pages.confirm': 'Run wrangler pages deploy',
    'cmd.npm.confirm': 'Run npm publish',
    'cmd.firebase.title': 'Deploy to Firebase',
    'cmd.firebase.confirm': 'Run firebase deploy',
    'cmd.netlify.title': 'Deploy to Netlify',
    'cmd.netlify.confirm': 'Run netlify deploy --prod',
    'cmd.flyio.title': 'Deploy to Fly.io',
    'cmd.flyio.confirm': 'Run flyctl deploy',

    // Dynamic log messages
    'log.scan_done': 'Scan complete: {count} deployable projects',
    'log.scan_fail': 'Scan failed: {error}',
    'log.action_start': 'Start: {name} / {action}',
    'log.version_bump': '{name}: v{old} → v{new}',
    'log.action_result': '{name}: {status}',
    'log.done': 'Done',
    'log.failed': 'Failed',
  };
}
