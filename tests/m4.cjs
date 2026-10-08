const { _electron: electron } = require('@playwright/test');
const path = require('node:path');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
(async () => {
  const base = path.join(__dirname, '../.test-data/m4-' + Date.now());
  const codex = path.join(base, 'codex');
  await fs.mkdir(path.join(codex, 'sessions'), { recursive: true });
  const timestamp = new Date().toISOString();
  await fs.writeFile(
    path.join(codex, 'sessions', 'fixture.jsonl'),
    [
      {
        timestamp,
        type: 'session_meta',
        payload: { id: 'harness-agent', cwd: path.resolve(__dirname, '..'), source: 'cli' },
      },
      { timestamp, type: 'event_msg', payload: { type: 'task_started', turn_id: 'harness-turn' } },
      {
        timestamp,
        type: 'event_msg',
        payload: { type: 'user_message', message: 'Review the isolated harness fixture' },
      },
      {
        timestamp,
        type: 'event_msg',
        payload: { type: 'agent_message', message: 'Fixture response for bounded log rendering.' },
      },
      { timestamp, type: 'event_msg', payload: { type: 'task_complete' } },
    ]
      .map((record) => JSON.stringify(record))
      .join('\n') + '\n',
  );
  const app = await electron.launch({
    args: [path.join(__dirname, '..')],
    env: {
      ...process.env,
      NEXUS_TEST_MODE: '1',
      NEXUS_DATA_DIR: path.join(base, 'profile'),
      CODEX_HOME: codex,
    },
  });
  try {
    const p = await app.firstWindow();
    await p.locator('[data-page="Agents"]').click();
    await p.waitForFunction(
      () => document.querySelector('.provider-banner')?.textContent.includes('LOCAL_ONLY'),
      null,
      { timeout: 60000 },
    );
    const r = await p.evaluate(() => window.nexus.call('agents'));
    assert.equal(r.data.runs.length, 1);
    assert.equal(r.data.capabilities.live, false);
    await p.locator('.agent-card').first().click();
    await p.locator('.virtual-log').waitFor();
    assert.ok(await p.getByRole('button', { name: '停止 · Unsupported' }).isDisabled());
    await p.screenshot({ path: path.join(__dirname, '../.test-data/m4-agents.png') });
    console.log(
      `PASS M4: ${r.data.runs.length} isolated local session fixture, bounded log UI, unsupported controls disabled`,
    );
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
