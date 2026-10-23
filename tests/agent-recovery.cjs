const { _electron: electron, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { Store } = require('../electron/storage/index.cjs');

const root = path.resolve(__dirname, '..');
const base = path.join(root, '.test-data', 'agent-recovery-' + Date.now());
const codexRoot = path.join(base, 'codex');
const sessions = path.join(codexRoot, 'sessions');
const unavailableSessions = path.join(codexRoot, 'sessions-unavailable');
const profile = path.join(base, 'profile');
const titles = ['Recovery Alpha', 'Recovery Beta'];
const button = (p, name) => p.getByRole('button', { name, exact: true });
const navigate = (p, page) => p.locator(`[data-page="${page}"]`).click();
const empty = (p) => p.getByTestId('agent-empty-state');
const connection = (p) => p.getByTestId('codex-connection-settings');
async function ipc(p, method, ...args) {
  const result = await p.evaluate(({ method, args }) => window.nexus.call(method, ...args), {
    method,
    args,
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.data;
}
async function seed() {
  await fs.mkdir(sessions, { recursive: true });
  const store = new Store(path.join(profile, 'nexus.sqlite'));
  try {
    await store.save('settings', {
      id: 'appearance',
      onboarded: true,
      language: 'zh-CN',
      notifications: { completed: false, failed: false, approval: false, calendar: false },
    });
    await store.save('notes', { id: 'preserve-me', title: 'Keep this note', content: 'Original' });
  } finally {
    await store.close();
  }
}
async function seedSessions() {
  const timestamp = new Date().toISOString();
  const records = titles.map((title, index) => ({ id: `recovery-${index}`, title }));
  for (const [index, { id, title }] of records.entries()) {
    const events = [
      { timestamp, type: 'session_meta', payload: { id, cwd: base, source: 'cli' } },
      { timestamp, type: 'event_msg', payload: { type: 'task_started', turn_id: id } },
      {
        timestamp,
        type: 'event_msg',
        payload: { type: 'agent_message', message: title + ' output' },
      },
      {
        timestamp,
        type: 'event_msg',
        payload: {
          type: 'token_count',
          info: {
            total_token_usage: { input_tokens: 90, output_tokens: 10, total_tokens: 100 },
            last_token_usage: { input_tokens: 45, output_tokens: 5, total_tokens: 50 },
          },
        },
      },
      { timestamp, type: 'event_msg', payload: { type: index ? 'task_failed' : 'task_complete' } },
    ];
    await fs.writeFile(
      path.join(sessions, id + '.jsonl'),
      events.map(JSON.stringify).join('\n') + '\n',
    );
  }
  await fs.writeFile(
    path.join(codexRoot, 'session_index.jsonl'),
    records.map(({ id, title }) => JSON.stringify({ id, thread_name: title })).join('\n') + '\n',
  );
}
async function installControls(app) {
  // Gate real local operations, not production UI state. No real CLI/network query is allowed.
  await app.evaluate(({ app: electronApp }) => {
    const { createRequire } = process.getBuiltinModule('node:module');
    const requireFromMain = createRequire(electronApp.getAppPath() + '/electron/main.cjs');
    const { handlers } = requireFromMain('./main.cjs');
    const state = {
      holdReads: false,
      pendingReads: [],
      holdEnable: false,
      pendingEnable: [],
      enableCalls: 0,
      officialCalls: 0,
    };
    globalThis.__nexusRecoveryFixture = state;
    const originalAgents = handlers.agents;
    const originalConfigure = handlers.configureConnection;
    handlers.agents = async (...args) => {
      if (state.holdReads) await new Promise((resolve) => state.pendingReads.push(resolve));
      return originalAgents(...args);
    };
    handlers.configureConnection = async (mode) => {
      if (mode === 'enable') {
        state.enableCalls++;
        if (state.holdEnable)
          await new Promise((resolve, reject) => state.pendingEnable.push({ resolve, reject }));
      }
      return originalConfigure(mode);
    };
    for (const method of ['codexQuota', 'codexTaskUsage'])
      handlers[method] = () => {
        state.officialCalls++;
        throw Error('Official usage queries must remain manual');
      };
  });
}
async function fixtureState(app) {
  return app.evaluate(() => {
    const state = globalThis.__nexusRecoveryFixture;
    return {
      pendingReads: state.pendingReads.length,
      pendingEnable: state.pendingEnable.length,
      enableCalls: state.enableCalls,
      officialCalls: state.officialCalls,
    };
  });
}
async function capture(app, p, name) {
  await p.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  const png = await app.evaluate(async ({ BrowserWindow }) =>
    (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'),
  );
  await fs.writeFile(path.join(base, name + '.png'), Buffer.from(png, 'base64'));
}
async function expectTargetedSettings(p) {
  await expect(connection(p)).toBeFocused();
  await expect(p.getByTestId('connection-root')).toHaveText(codexRoot);
  const bounds = await connection(p).boundingBox();
  const height = await p.evaluate(() => innerHeight);
  assert.ok(bounds.y >= 0 && bounds.y < height / 2, JSON.stringify(bounds));
}
async function persistentRecords(p) {
  const result = {};
  for (const kind of ['tasks', 'notes', 'projects', 'events', 'settings'])
    result[kind] = await ipc(p, 'list', kind);
  return result;
}
async function moveFixtureDirectory(from, to) {
  // Only our known generated fixture directory may be moved; never follow an external link.
  const canonicalBase = await fs.realpath(base);
  const canonicalFrom = await fs.realpath(from);
  assert.equal(canonicalFrom, path.resolve(from));
  for (const target of [canonicalFrom, path.resolve(to)]) {
    const relative = path.relative(canonicalBase, target);
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), target);
  }
  assert.equal((await fs.lstat(from)).isDirectory(), true);
  assert.equal((await fs.lstat(from)).isSymbolicLink(), false);
  await assert.rejects(fs.access(to), { code: 'ENOENT' });
  await fs.rename(from, to);
}

(async () => {
  await seed();
  const app = await electron.launch({
    ...(process.env.NEXUS_PACKAGED_EXE
      ? { executablePath: process.env.NEXUS_PACKAGED_EXE, args: [] }
      : { args: [root] }),
    env: {
      ...process.env,
      NEXUS_TEST_MODE: '1',
      NEXUS_DATA_DIR: profile,
      CODEX_HOME: codexRoot,
      NEXUS_DEV_URL: '',
    },
  });
  const errors = [];
  let moved = false;
  try {
    await installControls(app);
    const p = await app.firstWindow();
    p.setDefaultTimeout(15000);
    p.on('pageerror', (error) => errors.push(error.message));
    // Wait for the initial loadFile to finish before reloading to test loading state.
    await p.waitForURL(/\/index\.html$/);
    await p.waitForLoadState('load');
    await p.waitForFunction(async () => (await window.nexus.call('info')).data.ready);
    await p.locator('.hero').waitFor();

    // A: actual provider response is pending, so never show a misleading empty result.
    await app.evaluate(() => {
      globalThis.__nexusRecoveryFixture.holdReads = true;
    });
    await p.reload();
    await p.locator('.hero').waitFor();
    await navigate(p, 'Agents');
    await expect(empty(p)).toHaveAttribute('data-state', 'loading');
    await expect(empty(p)).toHaveAttribute('aria-busy', 'true');
    await expect(empty(p).getByRole('button')).toHaveCount(0);
    await expect.poll(async () => (await fixtureState(app)).pendingReads).toBeGreaterThan(0);
    await app.evaluate(() => {
      const state = globalThis.__nexusRecoveryFixture;
      state.holdReads = false;
      for (const resolve of state.pendingReads.splice(0)) resolve();
    });

    // D/F: readable first-use empty state has context and a focused Settings destination.
    await expect(empty(p)).toHaveAttribute('data-state', 'no-records');
    await expect(empty(p)).toContainText('还没有本地会话记录');
    await expect(p.getByTestId('agent-connection-meta')).toContainText(codexRoot);
    await expect(p.getByTestId('agent-connection-meta').locator('time')).toHaveCount(1);
    await capture(app, p, '01-readable-empty');
    await p.getByTestId('agent-open-connections').click();
    await expectTargetedSettings(p);
    await expect(connection(p).getByRole('status')).toContainText('目录可读取');
    await capture(app, p, '02-targeted-connection');
    await navigate(p, 'Home');
    await navigate(p, 'Settings');
    await expect.poll(() => p.evaluate(() => window.scrollY)).toBe(0);
    await expect(connection(p)).not.toBeFocused();
    await navigate(p, 'Agents');
    await p.getByTestId('agent-open-connections').click();
    await expectTargetedSettings(p);

    // E: search and status are recoverable together and do not mutate user records.
    await seedSessions();
    await navigate(p, 'Agents');
    await button(p, '刷新 Agent').click();
    await expect(p.locator('.agent-card')).toHaveCount(2);
    const before = await persistentRecords(p);
    await p.getByLabel('搜索 Agent、任务或项目', { exact: true }).fill('Recovery Alpha');
    await p.getByLabel('Agent 状态过滤', { exact: true }).selectOption('FAILED');
    await expect(empty(p)).toHaveAttribute('data-state', 'filtered');
    await expect(empty(p)).toContainText('已读取 2 个会话');
    await p.getByTestId('agent-clear-filters').click();
    await expect(p.getByLabel('搜索 Agent、任务或项目', { exact: true })).toHaveValue('');
    await expect(p.getByLabel('Agent 状态过滤', { exact: true })).toHaveValue('');
    await expect(p.locator('.agent-card')).toHaveCount(2);
    assert.deepEqual(await persistentRecords(p), before);
    await p
      .locator('.agent-card')
      .filter({ has: p.getByRole('heading', { name: titles[0], exact: true }) })
      .click();
    await expect(p.getByTestId('agent-usage-detail')).toBeVisible();
    await expect(p.locator('[data-token-field="totalTokens"] td').first()).toHaveText('100');
    await expect(p.locator('dialog[open]')).toContainText(titles[0] + ' output');
    await p.keyboard.press('Escape');
    await expect(p.locator('dialog[open]')).toHaveCount(0);

    // B: paused reading can resume in place; a failed request stays paused and is retryable.
    await navigate(p, 'Settings');
    await connection(p).getByRole('button', { name: '暂停读取', exact: true }).click();
    await connection(p).getByRole('button', { name: '启用读取', exact: true }).waitFor();
    await navigate(p, 'Agents');
    await expect(empty(p)).toHaveAttribute('data-state', 'paused');
    await app.evaluate(() => {
      globalThis.__nexusRecoveryFixture.holdEnable = true;
    });
    await p.getByTestId('agent-enable-reading').click();
    await expect(p.getByTestId('agent-enable-reading')).toBeDisabled();
    await expect(empty(p)).toHaveAttribute('aria-busy', 'true');
    await p.getByTestId('agent-enable-reading').evaluate((el) => {
      el.click();
      el.click();
    });
    await expect.poll(async () => (await fixtureState(app)).pendingEnable).toBe(1);
    assert.equal((await fixtureState(app)).enableCalls, 1);
    await app.evaluate(() => {
      globalThis.__nexusRecoveryFixture.pendingEnable
        .shift()
        .reject(Error('Controlled enable failure'));
    });
    await expect(empty(p).getByRole('alert')).toContainText('未能启用读取');
    await expect(empty(p)).toHaveAttribute('data-state', 'paused');
    assert.equal((await ipc(p, 'connectionInfo')).enabled, false);
    await expect(p.getByTestId('agent-enable-reading')).toBeEnabled();
    await capture(app, p, '03-retry-enable');
    await p.getByTestId('agent-enable-reading').click();
    await expect.poll(async () => (await fixtureState(app)).pendingEnable).toBe(1);
    await app.evaluate(() => {
      const state = globalThis.__nexusRecoveryFixture;
      state.holdEnable = false;
      state.pendingEnable.shift().resolve();
    });
    await expect(p.locator('.agent-card')).toHaveCount(2);
    await expect(empty(p)).toHaveCount(0);
    assert.equal((await fixtureState(app)).enableCalls, 2);
    assert.equal((await ipc(p, 'connectionInfo')).enabled, true);

    // C: a missing actual sessions directory is distinct from a readable empty one.
    await moveFixtureDirectory(sessions, unavailableSessions);
    moved = true;
    await button(p, '刷新 Agent').click();
    await expect(empty(p)).toHaveAttribute('data-state', 'unavailable');
    await expect(empty(p)).toContainText('暂时无法读取本地会话');
    await expect(p.getByTestId('agent-connection-meta')).toContainText(codexRoot);
    await p.getByTestId('agent-open-connections').click();
    await expectTargetedSettings(p);
    await expect(connection(p).getByRole('status')).toContainText('当前目录不可读取');

    // G: English, light appearance and minimum-width window keep the recovery action usable.
    await navigate(p, 'Home');
    await navigate(p, 'Settings');
    await p.getByLabel('Language / 语言').selectOption('en');
    await p.getByLabel('主题', { exact: true }).selectOption('light');
    await p.waitForFunction(() => document.querySelector('.app')?.dataset.theme === 'light');
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.unmaximize();
      win.setSize(1060, 760);
    });
    await p.waitForFunction(() => innerWidth <= 1060);
    await navigate(p, 'Agents');
    await expect(empty(p)).toContainText('Local sessions are unavailable');
    await expect(p.getByTestId('agent-open-connections')).toHaveText('Open connection settings');
    await p.getByTestId('agent-open-connections').scrollIntoViewIfNeeded();
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await capture(app, p, '04-english-light-recovery');
    await p.getByTestId('agent-open-connections').click();
    await expectTargetedSettings(p);
    await expect(connection(p)).toContainText('Only a manual usage-query click');
    await expect(connection(p)).toContainText('The current directory cannot be read');
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await capture(app, p, '05-english-light-connection');
    assert.equal((await fixtureState(app)).officialCalls, 0);
    assert.deepEqual(errors, []);
    console.log(
      'PASS Agent recovery A–G: pending, paused/retry, unavailable, empty, filters, focused settings, English/light/narrow; no official queries. ' +
        base,
    );
  } finally {
    await app.close();
    if (moved) await moveFixtureDirectory(unavailableSessions, sessions);
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
