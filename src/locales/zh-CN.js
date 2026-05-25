if (window.i18n && window.i18n.lang === 'zh-CN') {
  window.i18n.messages = {
    // Toolbar
    'search.placeholder': '搜索项目 / 平台 / 包名',
    'btn.toggle_theme': '切换主题',
    'btn.settings': '设置',
    'btn.scanning': '扫描中',
    'btn.scan': '扫描项目',
    'btn.toggle_lang': '切换语言',

    // Stats
    'stats.projects': '项目',
    'stats.cloud': '云平台',
    'stats.packages': 'npm 包',

    // ProjectCard
    'badge.no_version': '无版本',
    'detail.package': '包名',
    'detail.version': '版本',
    'detail.image': '镜像',
    'btn.ssh_deploy': 'SSH 部署',
    'btn.publish_vercel': '发布到 Vercel',
    'btn.publish_cloudflare': '发布到 Cloudflare',
    'btn.publish_firebase': '发布到 Firebase',
    'btn.publish_netlify': '发布到 Netlify',
    'btn.publish_flyio': '发布到 Fly.io',

    // Empty state
    'empty.scanning': '正在扫描项目',
    'empty.no_match': '没有匹配的发布目标',

    // ActionModal
    'modal.publish_title': '发布 {name}',
    'modal.btn_cancel': '取消',
    'modal.btn_confirm': '确认发布',
    'modal.field.image_name': '镜像名',
    'modal.field.tag': 'Tag',
    'modal.field.full_image': '完整镜像',
    'modal.field.platform': '平台',
    'modal.field.push_after_build': '构建后推送',
    'modal.field.ssh_host': 'SSH 主机',
    'modal.field.sync_compose': '同步 compose 并执行 docker compose up -d',

    // VersionBumpOptions
    'version.title': '版本管理',
    'version.current': '当前版本 v{version}',
    'version.not_detected': '未检测到版本',
    'version.no_file': '未检测到版本文件',
    'version.no_change': '不修改版本',
    'version.recommended': '推荐',

    // SettingsModal
    'settings.title': '设置',
    'settings.base_dir': '项目根目录',
    'settings.ssh_hosts': 'SSH 主机',
    'settings.btn_add': '添加',
    'settings.btn_save': '保存',
    'settings.ph.name': '名称',

    // LogPanel
    'log.title': '操作日志',
    'log.count': '{count} 条',
    'log.no_logs': '暂无日志',
    'log.expand': '展开',
    'log.collapse': '收起',
    'log.clear': '清空',

    // Action labels/titles
    'action.docker_ssh_label': 'SSH 部署',
    'action.docker_ssh': 'SSH 部署 Docker 镜像',

    // COMMANDS titles & confirms
    'cmd.compose.title': 'Docker Compose',
    'cmd.compose.confirm': '在本机执行 docker compose up -d',
    'cmd.vercel.title': '发布到 Vercel',
    'cmd.vercel.confirm': '执行 vercel --prod',
    'cmd.cf_workers.title': '发布到 Cloudflare Workers',
    'cmd.cf_workers.confirm': '执行 wrangler deploy',
    'cmd.cf_pages.title': '发布到 Cloudflare Pages',
    'cmd.cf_pages.confirm': '执行 wrangler pages deploy',
    'cmd.npm.confirm': '执行 npm publish',
    'cmd.firebase.title': '发布到 Firebase',
    'cmd.firebase.confirm': '执行 firebase deploy',
    'cmd.netlify.title': '发布到 Netlify',
    'cmd.netlify.confirm': '执行 netlify deploy --prod',
    'cmd.flyio.title': '发布到 Fly.io',
    'cmd.flyio.confirm': '执行 flyctl deploy',

    // Dynamic log messages
    'log.scan_done': '扫描完成: {count} 个可发布项目',
    'log.scan_fail': '扫描失败: {error}',
    'log.action_start': '开始: {name} / {action}',
    'log.version_bump': '{name}: v{old} → v{new}',
    'log.action_result': '{name}: {status}',
    'log.done': '完成',
    'log.failed': '失败',
  };
}
