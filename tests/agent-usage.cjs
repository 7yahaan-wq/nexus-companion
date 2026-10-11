const { _electron: electron, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { Store } = require('../electron/storage/index.cjs');

const root = path.resolve(__dirname, '..');
const base = path.join(root, '.test-data', 'agent-usage-' + Date.now());
const codexRoot = path.join(base, 'codex');
const profile = path.join(base, 'profile');
const ids = {
  a: '11111111-1111-4111-8111-111111111111',
  b: '22222222-2222-4222-8222-222222222222',
};
const titles = { a: 'Usage fixture A', b: 'Usage fixture B' };
const files = Object.fromEntries(
  Object.entries(ids).map(([key, id]) => [key, path.join(codexRoot, 'sessions', id + '.jsonl')]),
);
const now = Date.now();
const at = (delta = 0) => new Date(now + delta).toISOString();
const event = (payload, timestamp = at()) => ({ timestamp, type: 'event_msg', payload });
const tokens = (input, output, cached = 0) => ({
  input_tokens: input,
  cached_input_tokens: cached,
  output_tokens: output,
  reasoning_output_tokens: 0,
  total_tokens: input + output,
});
const usage = (total, last = total, rateLimits = null, timestamp = at()) =>
  event(
    {
      type: 'token_count',
      info: {
        total_token_usage: total,
        last_token_usage: last,
        model_context_window: 200000,
      },
      rate_limits: rateLimits,
    },
    timestamp,
  );
const localQuota = {
  limit_id: 'codex',
  limit_name: 'Fixture quota',
  primary: { used_percent: 25, window_minutes: 300, resets_at: Math.floor(now / 1000) + 3600 },
  secondary: {
    used_percent: 80,
    window_minutes: 10080,
    resets_at: Math.floor(now / 1000) + 604800,
  },
  credits: { has_credits: true, unlimited: false, balance: '12.5' },
  plan_type: 'plus',
};

async function append(key, records) {
  await fs.appendFile(
    files[key],
    records.map((record) => JSON.stringify(record)).join('\n') + '\n',
  );
}
async function seed() {
  await fs.mkdir(path.join(codexRoot, 'sessions'), { recursive: true });
  const duplicate = usage(tokens(1000, 250, 100), tokens(200, 50, 0), localQuota);
  for (const key of ['a', 'b']) {
    const records = [
      {
        timestamp: at(-30000),
        type: 'session_meta',
        payload: { id: ids[key], cwd: base, source: 'cli' },
      },
      { timestamp: at(-20000), type: 'turn_context', payload: { model: 'fixture-model' } },
      event({ type: 'task_started', turn_id: `fixture-turn-${key}` }, at(-20000)),
      event({ type: 'agent_message', message: `INITIAL_${key.toUpperCase()}_LOG` }, at(-10000)),
      ...(key === 'a' ? [duplicate, duplicate] : []),
      event({ type: 'task_complete' }),
    ];
    await fs.writeFile(
      files[key],
      records.map((record) => JSON.stringify(record)).join('\n') + '\n',
    );
  }
  await fs.writeFile(
    path.join(codexRoot, 'session_index.jsonl'),
    ['a', 'b'].map((key) => JSON.stringify({ id: ids[key], thread_name: titles[key] })).join('\n') +
      '\n',
  );
  const store = new Store(path.join(profile, 'nexus.sqlite'));
  await store.save('settings', { id: 'appearance', onboarded: true, language: 'zh-CN' });
  await store.close();
}

async function installControlledQueries(app) {
  // Replace the actual imported service object in the main process. Both source
  // and asar builds use this path relative to electron/main.cjs. No production
  // test switch, auth file, CLI child process, or external service is involved.
  await app.evaluate(({ app: electronApp }) => {
    const { createRequire } = process.getBuiltinModule('node:module');
    const requireFromMain = createRequire(electronApp.getAppPath() + '/electron/main.cjs');
    const service = requireFromMain('./services/codex-account.cjs');
    const { ProviderClient } = requireFromMain('./providers/client.cjs');
    const state = {
      quotaCalls: [],
      taskCalls: [],
      quotaMode: 'available',
      taskMode: 'available',
      pendingQuotas: [],
      pendingTasks: [],
      pendingLogs: [],
      holdLogId: null,
    };
    globalThis.__nexusUsageFixture = state;
    const quota = () => {
      const observedAt = new Date().toISOString();
      return {
        status: 'AVAILABLE',
        accountLabel: 'tester@example.test',
        reason: null,
        quota: {
          source: 'app-server',
          observedAt,
          buckets: [
            {
              limitId: 'codex',
              limitName: 'Fixture CLI quota',
              primary: {
                usedPercent: 40,
                windowMinutes: 300,
                resetsAt: new Date(Date.now() + 3600000).toISOString(),
              },
              secondary: null,
              credits: { hasCredits: true, unlimited: false, balance: '42.5' },
              planType: 'plus',
              source: 'app-server',
              observedAt,
            },
          ],
        },
      };
    };
    state.taskResult = (threadId) => ({
      status: 'AVAILABLE',
      accountLabel: 'tester@example.test',
      reason: null,
      threadUsage: {
        threadId,
        estimatedCredits: 1.25,
        observedAt: new Date().toISOString(),
        groups: [
          {
            model: 'fixture-model',
            speed: 'standard',
            reasoningEffort: 'high',
            inputTokens: 1000,
            cachedInputTokens: 300,
            outputTokens: 400,
            totalTokens: 1400,
            estimatedCredits: 1.25,
          },
        ],
      },
    });
    service.readQuota = async (directory) => {
      state.quotaCalls.push(directory);
      if (state.quotaMode === 'hold')
        return new Promise((resolve) => state.pendingQuotas.push(() => resolve(quota())));
      return state.quotaMode === 'available'
        ? quota()
        : { status: 'UNAVAILABLE', accountLabel: null, quota: null, reason: 'UNSUPPORTED' };
    };
    service.readTaskUsage = async (directory, threadId) => {
      state.taskCalls.push({ directory, threadId });
      if (state.taskMode === 'hold')
        return new Promise((resolve) => state.pendingTasks.push({ threadId, resolve }));
      if (state.taskMode === 'unavailable')
        return {
          status: 'UNAVAILABLE',
          accountLabel: null,
          threadUsage: null,
          reason: 'NO_TASK_USAGE',
        };
      return state.taskResult(threadId);
    };
    const originalLogs = ProviderClient.prototype.logs;
    ProviderClient.prototype.logs = function (id) {
      if (id === state.holdLogId)
        return new Promise((resolve) => state.pendingLogs.push({ id, resolve }));
      return originalLogs.call(this, id);
    };
  });
}

async function state(app) {
  return app.evaluate(() => {
    const fixture = globalThis.__nexusUsageFixture;
    return {
      quotaCalls: fixture.quotaCalls,
      taskCalls: fixture.taskCalls,
      pendingQuotas: fixture.pendingQuotas.length,
      pendingTasks: fixture.pendingTasks.length,
      pendingLogs: fixture.pendingLogs.length,
    };
  });
}
const button = (p, name) => p.getByRole('button', { name, exact: true });
const ipc = (p, method, ...args) =>
  p.evaluate(({ method, args }) => window.nexus.call(method, ...args), { method, args });
function unavailable(result, field) {
  assert.equal(result.ok, true);
  assert.equal(result.data.status, 'UNAVAILABLE');
  assert.equal(result.data.reason, 'INVALID_REQUEST');
  assert.equal(result.data[field], null);
  assert.equal(result.data.accountLabel, null);
}
const card = (p, key) =>
  p
    .locator('.agent-card')
    .filter({ has: p.getByRole('heading', { name: titles[key], exact: true }) });
const dialog = (p) => p.locator('dialog[open]');
async function open(p, key) {
  await card(p, key).click();
  await expect(dialog(p).getByRole('heading', { name: titles[key], exact: true })).toBeVisible();
}
async function close(p) {
  await p.keyboard.press('Escape');
  await expect(dialog(p)).toHaveCount(0);
}
async function settleRenderer(p) {
  await p.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}
async function tokenValues(p, key) {
  const cells = await p
    .getByTestId('agent-usage-detail')
    .locator(`[data-token-field="${key}"] td`)
    .allTextContents();
  return cells.map((cell) => cell.trim().replaceAll(',', ''));
}
async function capture(app, name) {
  const png = await app.evaluate(async ({ BrowserWindow }) =>
    (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'),
  );
  await fs.writeFile(path.join(base, name + '.png'), Buffer.from(png, 'base64'));
}

(async () => {
  await seed();
  const app = await electron.launch({
    ...(process.env.NEXUS_PACKAGED_EXE
      ? { executablePath: process.env.NEXUS_PACKAGED_EXE, args: [] }
      : { args: [root] }),
    env: { ...process.env, NEXUS_TEST_MODE: '1', NEXUS_DATA_DIR: profile, CODEX_HOME: codexRoot },
  });
  const errors = [];
  try {
    await installControlledQueries(app);
    const p = await app.firstWindow();
    p.setDefaultTimeout(15000);
    p.on('pageerror', (error) => errors.push(error.message));
    await p.waitForFunction(async () => (await window.nexus.call('info')).data.ready);
    await p.locator('[data-page="Agents"]').click();
    await expect(card(p, 'a')).toBeVisible();
    await expect(card(p, 'b')).toBeVisible();
    await expect(card(p, 'a').getByTestId('agent-token-summary').locator('strong')).toHaveText(
      '1,250',
    );
    await expect(card(p, 'b').getByTestId('agent-token-summary').locator('strong')).toHaveText('—');
    await expect(p.getByTestId('account-quota')).toContainText('75%');
    await expect(p.getByTestId('account-quota')).toContainText('20%');
    assert.deepEqual(await state(app), {
      quotaCalls: [],
      taskCalls: [],
      pendingQuotas: 0,
      pendingTasks: 0,
      pendingLogs: 0,
    });
    // IPC validation also applies when a caller bypasses the UI. Omitted or
    // null task IDs must not accidentally select the separate quota endpoint.
    for (const args of [[], [null], [{}], ['../invalid'], ['undiscovered-session']])
      unavailable(await ipc(p, 'codexTaskUsage', ...args), 'threadUsage');
    assert.equal((await state(app)).quotaCalls.length, 0);
    assert.equal((await state(app)).taskCalls.length, 0);

    await open(p, 'a');
    await expect(p.locator('.virtual-log')).toContainText('INITIAL_A_LOG');
    assert.deepEqual(
      await tokenValues(p, 'totalTokens'),
      ['1250', '250'],
      'Duplicate cumulative events must not be summed',
    );
    assert.deepEqual(await tokenValues(p, 'cachedInputTokens'), ['100', '0']);
    const absent = await tokenValues(p, 'cacheWriteInputTokens');
    assert.deepEqual(absent, ['—', '—'], 'Missing token fields must remain unknown');
    await capture(app, 'usage-detail-zh');
    await close(p);
    await open(p, 'b');
    await expect(p.getByTestId('agent-usage-detail')).toContainText(/未记录|不可用|未知|没有可用/);
    await close(p);

    // Add a genuine all-zero usage snapshot; it must differ from the absent one.
    await append('b', [usage(tokens(0, 0), tokens(0, 0), null, at(1000))]);
    await button(p, '刷新 Agent').click();
    await open(p, 'b');
    await expect.poll(() => tokenValues(p, 'totalTokens')).toEqual(['0', '0']);
    await close(p);

    // Refresh while the detail stays open: both the log and token snapshot change.
    await open(p, 'a');
    await append('a', [
      usage(tokens(1600, 400, 300), tokens(600, 150, 200), null, at(2000)),
      event({ type: 'agent_message', message: 'REFRESHED_A_LOG' }, at(2000)),
    ]);
    await p.getByTestId('agent-detail-refresh').click();
    await expect.poll(() => tokenValues(p, 'totalTokens')).toEqual(['2000', '750']);
    await expect(p.locator('.virtual-log')).toContainText('REFRESHED_A_LOG');
    assert.equal(
      (await state(app)).quotaCalls.length,
      0,
      'Local refresh must not query the account',
    );
    assert.equal(
      (await state(app)).taskCalls.length,
      0,
      'Opening details must not query paid-usage estimates',
    );

    await button(p, '查询此任务额度').click();
    await expect(p.getByTestId('task-credit-usage')).toContainText('1.25');
    await expect(p.getByTestId('task-credit-usage')).toContainText('Credits');
    assert.equal((await state(app)).taskCalls[0].threadId, ids.a);
    await close(p);

    await button(p, '查询当前套餐额度').click();
    await expect(p.getByTestId('account-quota')).toContainText('60%');
    await expect(p.getByTestId('account-quota')).toContainText('42.5');
    await expect(p.getByTestId('account-quota')).toContainText('tester@example.test');
    assert.equal((await state(app)).quotaCalls.length, 1);

    await app.evaluate(() => {
      globalThis.__nexusUsageFixture.quotaMode = 'unavailable';
    });
    await button(p, '查询当前套餐额度').click();
    await expect(p.getByTestId('account-quota').getByRole('alert')).toContainText('尚未提供此查询');
    await expect(p.getByTestId('account-quota')).toContainText('60%');
    await expect(p.getByTestId('account-quota')).toContainText('先前观测');

    await app.evaluate(() => {
      globalThis.__nexusUsageFixture.taskMode = 'unavailable';
    });
    await open(p, 'b');
    await button(p, '查询此任务额度').click();
    await expect(p.getByTestId('task-credit-usage').getByRole('status')).toContainText(
      '尚未提供此会话',
    );
    await expect(p.getByTestId('task-credit-usage')).not.toContainText('1.25');
    await close(p);

    // Delay A's account response, close it, and open B. A must never populate B.
    await app.evaluate(() => {
      globalThis.__nexusUsageFixture.taskMode = 'hold';
    });
    await open(p, 'a');
    await button(p, '查询此任务额度').evaluate((element) => {
      element.click();
      element.click();
    });
    await expect.poll(async () => (await state(app)).pendingTasks).toBe(1);
    assert.equal(
      (await state(app)).taskCalls.length,
      3,
      'Busy queries must ignore duplicate clicks',
    );
    await close(p);
    await open(p, 'b');
    await app.evaluate(() => {
      const fixture = globalThis.__nexusUsageFixture;
      for (const request of fixture.pendingTasks.splice(0))
        request.resolve(fixture.taskResult(request.threadId));
      fixture.taskMode = 'available';
    });
    await settleRenderer(p);
    await expect(p.getByTestId('task-credit-usage')).not.toContainText('1.25');
    await close(p);

    // The equivalent stale-response regression for local logs.
    await app.evaluate((_, id) => {
      globalThis.__nexusUsageFixture.holdLogId = id;
    }, ids.a);
    await open(p, 'a');
    await expect.poll(async () => (await state(app)).pendingLogs).toBeGreaterThan(0);
    await close(p);
    await open(p, 'b');
    await expect(p.locator('.virtual-log')).toContainText('INITIAL_B_LOG');
    await app.evaluate(() => {
      const fixture = globalThis.__nexusUsageFixture;
      for (const request of fixture.pendingLogs.splice(0)) request.resolve(['DELAYED_A_LOG']);
      fixture.holdLogId = null;
    });
    await settleRenderer(p);
    await expect(p.locator('.virtual-log')).toContainText('INITIAL_B_LOG');
    await expect(p.locator('.virtual-log')).not.toContainText('DELAYED_A_LOG');
    await close(p);

    // An expired server reset is still a historical observation, never an
    // invented replenishment to 100%. Clear the separate CLI result via the
    // same connection-change event used by Settings before checking local data.
    await append('a', [
      event(
        {
          type: 'token_count',
          info: null,
          rate_limits: {
            ...localQuota,
            primary: {
              used_percent: 90,
              window_minutes: 300,
              resets_at: Math.floor(now / 1000) - 60,
            },
            secondary: null,
          },
        },
        at(3000),
      ),
    ]);
    await p.evaluate(() => window.dispatchEvent(new Event('nexus-connection-changed')));
    await expect(p.getByTestId('account-quota')).toContainText(/过期|已过重置时间|待更新/);
    await expect(p.getByTestId('account-quota')).not.toContainText('100%');

    await p.locator('[data-page="Settings"]').click();
    await p.getByLabel('Language / 语言').selectOption('en');
    await p.locator('[data-page="Agents"]').click();
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.unmaximize();
      win.setSize(1060, 760);
    });
    await p.waitForFunction(() => innerWidth <= 1060);
    await expect(button(p, 'Check current plan quota')).toBeVisible();
    await open(p, 'a');
    await expect(button(p, 'Check this task usage')).toBeVisible();
    await button(p, 'Check this task usage').click();
    await expect(p.getByTestId('task-credit-usage')).toContainText('1.25');
    await expect(p.getByTestId('agent-usage-detail')).toContainText(/Session|Total/);
    const layout = await p.evaluate(() => {
      const modal = document.querySelector('dialog[open]');
      const rect = modal.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        width: innerWidth,
        overflow: modal.scrollWidth > modal.clientWidth + 1,
      };
    });
    assert.ok(layout.left >= 0 && layout.right <= layout.width + 1, JSON.stringify(layout));
    assert.equal(layout.overflow, false, JSON.stringify(layout));
    await capture(app, 'usage-detail-en-narrow');
    assert.equal(
      (await state(app)).quotaCalls.length,
      2,
      'Polling, navigation and language changes must not query the account',
    );
    assert.equal((await state(app)).taskCalls.length, 4);
    await close(p);

    // Pausing local Codex access must block direct account IPC as well as the
    // visible buttons, without entering the service or losing the selected root.
    const beforePause = await state(app);
    assert.equal((await ipc(p, 'configureConnection', 'disable')).data, true);
    unavailable(await ipc(p, 'codexQuota'), 'quota');
    unavailable(await ipc(p, 'codexTaskUsage', ids.a), 'threadUsage');
    assert.deepEqual(await state(app), beforePause);
    assert.equal((await ipc(p, 'configureConnection', 'enable')).data, true);
    await app.evaluate(() => {
      globalThis.__nexusUsageFixture.quotaMode = 'available';
    });
    assert.equal((await ipc(p, 'codexQuota')).data.status, 'AVAILABLE');
    assert.equal((await ipc(p, 'codexTaskUsage', ids.a)).data.status, 'AVAILABLE');

    // A result requested before a connection change cannot be accepted under
    // the new connection generation, even when the connection is enabled again.
    await app.evaluate(() => {
      globalThis.__nexusUsageFixture.quotaMode = 'hold';
    });
    await p.evaluate(() => {
      window.__nexusHeldQuota = window.nexus.call('codexQuota');
    });
    await expect.poll(async () => (await state(app)).pendingQuotas).toBe(1);
    assert.equal((await ipc(p, 'configureConnection', 'disable')).data, true);
    assert.equal((await ipc(p, 'configureConnection', 'enable')).data, true);
    await app.evaluate(() => {
      const fixture = globalThis.__nexusUsageFixture;
      fixture.quotaMode = 'available';
      for (const resolve of fixture.pendingQuotas.splice(0)) resolve();
    });
    unavailable(await p.evaluate(() => window.__nexusHeldQuota), 'quota');
    assert.equal((await ipc(p, 'codexQuota')).data.status, 'AVAILABLE');
    assert.deepEqual(errors, []);
    console.log(
      'PASS agent usage: cumulative/zero/missing tokens, quota freshness, selected-detail refresh, explicit controlled account queries, unavailable estimates, stale-response isolation and narrow English layout',
    );
    console.log('Artifacts: ' + base);
  } finally {
    await app.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
