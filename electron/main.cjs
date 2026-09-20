const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  Tray,
  Menu,
  nativeImage,
  globalShortcut,
  Notification,
} = require('electron');
app.setName('Nexus Companion');
const path = require('node:path');
const fs = require('node:fs/promises');
const { Store } = require('./storage/index.cjs');
const { validate } = require('./storage/validation.cjs');
const { FocusService } = require('./services/focus.cjs');
const { NotificationService } = require('./services/notifications.cjs');
let focus, notifications;
let startupReady = false;
const projects = require('./services/projects.cjs');
const assets = require('./services/assets.cjs');
const backup = require('./services/backup.cjs');
let pendingBackup = null;
const { ProviderClient } = require('./providers/client.cjs');
const codex = new ProviderClient();
let agentRead = null;
let agentCache = null,
  agentCacheAt = 0;
const storedObservations = new Map();
let connection = { enabled: true, root: null };
const defaultCodexRoot = process.env.CODEX_HOME || path.join(require('node:os').homedir(), '.codex');
async function saveActivities(run, projectRows) {
  if (storedObservations.get(run.id) === run.observedAt) return;
  for (const activity of run.activities || []) {
    const hash = require('node:crypto')
      .createHash('sha256')
      .update(`${run.id}:${activity.time}:${activity.title}`)
      .digest('hex')
      .slice(0, 32);
    await store.save('timeline', {
      id: `activity:${hash}`,
      time: activity.time,
      kind: 'agents',
      agent: run.agentName,
      project:
        projectRows.find(
          (p) => p.projectPath?.toLowerCase() === run.workingDirectory?.toLowerCase(),
        )?.id || run.project,
      entityId: run.id,
      title: `${run.agentName} · ${activity.title}`,
    });
  }
  storedObservations.set(run.id, run.observedAt);
}
async function readAgents() {
  if (!connection.enabled)
    return {
      runs: [],
      availability: 'DISABLED',
      message: '已在设置中暂停 Codex 本地读取',
      root: connection.root || defaultCodexRoot,
      scannedAt: new Date().toISOString(),
      capabilities: { stop: false, retry: false, live: false },
    };
  if (agentCache && Date.now() - agentCacheAt < 10000) return agentCache;
  const result = await codex.list();
  const projectRows = await store.list('projects');
  const profiles =
    (await store.list('settings')).find((s) => s.id === 'agent-profiles')?.profiles || {};
  result.runs = result.runs
    .map((r) => ({
      ...r,
      providerAgentName: r.agentName,
      agentName: profiles[r.id]?.displayName || r.agentName,
      role: profiles[r.id]?.role || '',
      pinned: !!profiles[r.id]?.pinned,
    }))
    .sort(
      (a, b) => Number(b.pinned) - Number(a.pinned) || b.observedAt.localeCompare(a.observedAt),
    );
  for (const run of result.runs) {
    await store.save('agents', run);
    await saveActivities(run, projectRows);
    if (run.lastEvent)
      await store.save('timeline', {
        id: `agent:${run.id}:${run.lastEvent}`,
        time: run.lastEvent,
        kind: 'agents',
        agent: run.agentName,
        project:
          projectRows.find(
            (p) => p.projectPath?.toLowerCase() === run.workingDirectory?.toLowerCase(),
          )?.id || run.project,
        entityId: run.id,
        title: `${run.agentName} · ${run.taskName} · ${run.status}`,
      });
  }
  await notifications?.agents(result.runs);
  agentCache = result;
  agentCacheAt = Date.now();
  return result;
}
let win,
  store,
  tray,
  quitting = false;
const smoke = process.argv.includes('--smoke');
if (process.env.NEXUS_DATA_DIR) app.setPath('userData', path.resolve(process.env.NEXUS_DATA_DIR));
if (smoke && !process.env.NEXUS_DATA_DIR)
  app.setPath('userData', path.join(app.getPath('temp'), 'NexusCompanion-Smoke'));
const location = require('./storage/location.cjs');
let dataRoot = app.getPath('userData');
const root = () => dataRoot;
async function log(level, message) {
  await fs.mkdir(path.join(root(), 'logs'), { recursive: true });
  await fs
    .appendFile(
      path.join(root(), 'logs', 'app.log'),
      `${new Date().toISOString()} ${level} ${message}\n`,
    )
    .catch(() => {});
}
const handlers = {
  connectionInfo: async () => {
    const result = await handlers.agents(true);
    return {
      enabled: connection.enabled,
      root: result.root || connection.root,
      availability: result.availability,
      count: result.runs.length,
      scannedAt: result.scannedAt,
    };
  },
  configureConnection: async (mode) => {
    if (!['choose', 'default', 'disable', 'enable'].includes(mode)) throw Error('无效连接操作');
    let selected;
    if (mode === 'choose') {
      const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
      if (r.canceled) return false;
      selected = await fs.realpath(r.filePaths[0]);
      if (!(await fs.stat(path.join(selected, 'sessions'))).isDirectory())
        throw Error('该目录没有 sessions 文件夹');
    }
    if (agentRead) await agentRead;
    connection = {
      ...connection,
      ...(mode === 'choose'
        ? { root: selected, enabled: true }
        : mode === 'default'
          ? { root: null, enabled: true }
          : { enabled: mode === 'enable' }),
    };
    await store.save('settings', { id: 'codex-connection', ...connection });
    await codex.call('configure', connection.root);
    agentCache = null;
    storedObservations.clear();
    return true;
  },
  chooseDataLocation: async () => {
    const r = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory'],
    });
    if (r.canceled) return null;
    return location.scheduleLocation(app.getPath('userData'), root(), r.filePaths[0]);
  },
  restart: () => {
    app.relaunch();
    quitting = true;
    app.quit();
  },
  cancelDataLocation: async () => {
    const config = await location.readLocation(app.getPath('userData'));
    await location.writeLocation(app.getPath('userData'), { active: config.active || root() });
    return true;
  },
  backupExport: async () => {
    const r = await dialog.showSaveDialog(win, {
      defaultPath: `Nexus-Backup-${new Date().toLocaleDateString('sv-SE')}.nexus`,
      filters: [{ name: 'Nexus Backup', extensions: ['nexus'] }],
    });
    if (r.canceled) return false;
    const bundle = await backup.createBackup(store, path.join(root(), 'assets'));
    await fs.writeFile(r.filePath, JSON.stringify(bundle));
    return true;
  },
  backupPreview: async () => {
    const r = await dialog.showOpenDialog(win, {
      filters: [{ name: 'Nexus Backup', extensions: ['nexus'] }],
      properties: ['openFile'],
    });
    if (r.canceled) return null;
    if ((await fs.stat(r.filePaths[0])).size > 100 * 1024 * 1024) throw Error('备份超过 100 MB');
    pendingBackup = backup.validateBackup(JSON.parse(await fs.readFile(r.filePaths[0], 'utf8')));
    return {
      createdAt: pendingBackup.createdAt,
      count: pendingBackup.data.records.length,
      sha256: pendingBackup.sha256,
    };
  },
  backupRestore: async (sha) => {
    if (!pendingBackup || pendingBackup.sha256 !== sha) throw Error('请重新选择备份');
    const dir = path.join(root(), 'backups');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, `before-restore-${Date.now()}.nexus`),
      JSON.stringify(await backup.createBackup(store, path.join(root(), 'assets'))),
    );
    const count = await backup.restoreBackup(store, pendingBackup, path.join(root(), 'assets'));
    pendingBackup = null;
    agentCache = null;
    return count;
  },
  integrity: () => store.integrity(),
  clientError: (message) => log('ERROR', String(message).slice(0, 8000)),
  focusState: () => focus.state(),
  focusStart: (minutes, task, title) => focus.start(minutes, task, title),
  focusPause: () => focus.pause(),
  focusStop: () => focus.finish(false),
  asset: (id) => assets.getAsset(id, path.join(root(), 'assets')),
  importBackground: async () => {
    const r = await dialog.showOpenDialog(win, {
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      properties: ['openFile'],
    });
    return r.canceled
      ? null
      : assets.importImage(r.filePaths[0], path.join(root(), 'assets'), nativeImage);
  },
  importAvatar: async () => {
    const r = await dialog.showOpenDialog(win, {
      filters: [{ name: 'Avatar Pack', extensions: ['json'] }],
      properties: ['openFile'],
    });
    return r.canceled
      ? null
      : assets.importPack(r.filePaths[0], path.join(root(), 'assets'), nativeImage);
  },
  agents: (force = false) => {
    if (force) agentCacheAt = 0;
    if (!agentRead)
      agentRead = readAgents().finally(() => {
        agentRead = null;
      });
    return agentRead;
  },
  agentLogs: (id) => codex.logs(id),
  exportMarkdown: async (text, name) => {
    if (typeof text !== 'string' || text.length > 2000000) throw Error('Invalid report');
    const r = await dialog.showSaveDialog(win, {
      defaultPath: path.basename(name || 'Report.md'),
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    });
    if (r.canceled) return false;
    await fs.writeFile(r.filePath, text, 'utf8');
    return true;
  },
  projectInspect: projects.inspect,
  projectOpen: (value, action) => projects.openProject(shell, value, action),
  openUrl: async (value) => {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw Error('只支持 HTTP/HTTPS 仓库链接');
    await shell.openExternal(url.href);
    return true;
  },
  openDocument: async (value, file) => {
    const cwd = await projects.directory(value);
    if (typeof file !== 'string' || path.basename(file) !== file || !/\.(md|txt|pdf)$/i.test(file))
      throw Error('Unsupported document');
    const result = await shell.openPath(path.join(cwd, file));
    if (result) throw Error(result);
    return true;
  },
  list: (kind) => store.list(kind),
  save: async (kind, value) => {
    validate(kind, value);
    if (kind === 'settings' && value.id === 'agent-profiles') agentCacheAt = 0;
    const result = await store.save(kind, value);
    if (['tasks', 'projects', 'events', 'notes'].includes(kind))
      await store.save('timeline', {
        id: require('node:crypto').randomUUID(),
        time: new Date().toISOString(),
        kind,
        entityId: value.id,
        project: value.project || value.id,
        title: `${kind} · ${value.title || value.name || 'Updated'}`,
      });
    return result;
  },
  delete: (kind, id) => store.delete(kind, id),
  chooseDirectory: async () => {
    const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
    return r.canceled ? null : r.filePaths[0];
  },
  info: async () => ({
    ready: startupReady,
    dataPath: root(),
    pendingDataPath: (await location.readLocation(app.getPath('userData'))).pending || null,
    version: app.getVersion(),
    electron: process.versions.electron,
    shortcut: globalShortcut.isRegistered('CommandOrControl+Shift+Space'),
    notifications: Notification.isSupported(),
  }),
  openLogs: async () => {
    await fs.mkdir(path.join(root(), 'logs'), { recursive: true });
    return shell.openPath(path.join(root(), 'logs'));
  },
  notify: (title, body) => {
    if (Notification.isSupported())
      new Notification({
        title: String(title).slice(0, 100),
        body: String(body).slice(0, 300),
      }).show();
    return Notification.isSupported();
  },
};
function show(command) {
  win.show();
  win.focus();
  if (command) win.webContents.send('command', command);
}
async function start() {
  app.setAppUserModelId('com.nexus.companion');
  try {
    dataRoot = await location.resolveLocation(app.getPath('userData'));
  } catch (e) {
    dataRoot =
      (await location.readLocation(app.getPath('userData'))).active || app.getPath('userData');
    await fs.access(path.join(dataRoot, 'nexus.sqlite'));
    dialog.showErrorBox(
      '数据目录迁移未完成',
      `${e.message}\n原数据已保留，本次继续使用：${dataRoot}`,
    );
  }
  store = new Store(path.join(root(), 'nexus.sqlite'));
  const savedConnection = (await store.list('settings')).find((s) => s.id === 'codex-connection');
  if (savedConnection)
    connection = { enabled: savedConnection.enabled !== false, root: savedConnection.root || null };
  await codex.call('configure', connection.root);
  if (
    !app.isPackaged &&
    process.env.NEXUS_TEST_MODE === '1' &&
    !(await store.list('settings')).some((s) => s.id === 'appearance')
  )
    await store.save('settings', { id: 'appearance', onboarded: true });
  focus = new FocusService(store, async (record) => {
    const settings = (await store.list('settings')).find((s) => s.id === 'appearance');
    if (settings?.notifications?.focus !== false && Notification.isSupported())
      new Notification({
        title: '专注完成 · Nexus',
        body: `${record.title} · ${Math.round(record.actualSeconds / 60)} 分钟，休息一下吧。`,
      }).show();
  });
  await focus.init();
  notifications = new NotificationService(store, (title, body) => {
    if (Notification.isSupported()) {
      const n = new Notification({ title, body });
      n.on('click', () => show());
      n.show();
    }
  });
  await notifications.init();
  setInterval(() => focus.tick().catch((e) => log('ERROR', e.message)), 1000).unref();
  setInterval(() => {
    handlers.agents().catch((e) => log('WARNING', e.message));
    notifications.calendar().catch((e) => log('ERROR', e.message));
  }, 15000).unref();
  ipcMain.handle('nexus', async (event, method, ...args) => {
    try {
      if (event.sender !== win.webContents || !Object.hasOwn(handlers, method))
        throw Error('Unsupported operation');
      return { ok: true, data: await handlers[method](...args) };
    } catch (e) {
      await log('ERROR', `${method}: ${e.message}`);
      return { ok: false, error: e.message };
    }
  });
  win = new BrowserWindow({
    width: 1480,
    height: 960,
    minWidth: 1060,
    minHeight: 720,
    backgroundColor: '#10131c',
    title: 'Nexus Companion',
    icon: path.join(__dirname, '../build/assets/icon.png'),
    show: !smoke,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) =>
    callback(false),
  );
  win.webContents.session.setPermissionCheckHandler(() => false);
  win.webContents.on('will-navigate', (e, url) => {
    if (url !== win.webContents.getURL()) e.preventDefault();
  });
  win.on('close', (e) => {
    if (!quitting && !smoke) {
      e.preventDefault();
      win.hide();
    }
  });
  if (process.env.NEXUS_DEV_URL) await win.loadURL(process.env.NEXUS_DEV_URL);
  else await win.loadFile(path.join(__dirname, '../build/index.html'));
  if (smoke) {
    await new Promise((r) => setTimeout(r, 1200));
    const result = await win.webContents.executeJavaScript(
      `({title:document.title,text:document.body.innerText,bridge:!!window.nexus})`,
    );
    await fs.mkdir(root(), { recursive: true });
    await fs.writeFile(path.join(root(), 'smoke.json'), JSON.stringify(result, null, 2));
    await fs.writeFile(
      path.join(root(), 'smoke.png'),
      (await win.webContents.capturePage()).toPNG(),
    );
    quitting = true;
    app.quit();
    return;
  }
  const icon = nativeImage
    .createFromPath(path.join(__dirname, '../build/assets/icon.png'))
    .resize({ width: 24, height: 24 });
  tray = new Tray(icon);
  tray.setToolTip('Nexus Companion');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Nexus', click: () => show() },
      { label: 'Running Agents', click: () => show('Agents') },
      { label: 'Quick Capture', click: () => show('capture') },
      { label: 'Start Focus', click: () => show('Focus') },
      { type: 'separator' },
      {
        label: 'Exit',
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on('double-click', () => show());
  if (!globalShortcut.register('CommandOrControl+Shift+Space', () => show('capture')))
    await log('WARNING', 'Quick Capture shortcut unavailable');
  startupReady = true;
  await log('INFO', 'Application started');
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => win && show());
  app
    .whenReady()
    .then(start)
    .catch(async (e) => {
      await log('ERROR', e.stack);
      dialog.showErrorBox('Nexus startup error', e.message);
      app.quit();
    });
}
app.on('before-quit', () => {
  quitting = true;
  globalShortcut.unregisterAll();
  store?.close();
  codex.close();
});
module.exports = { handlers };
