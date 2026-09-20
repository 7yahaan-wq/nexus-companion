const { _electron: electron } = require('@playwright/test');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const app = await electron.launch({
    args: [path.join(__dirname, '..')],
    env: {
      ...process.env,
      NEXUS_TEST_MODE: '1',
      NEXUS_DATA_DIR: path.join(__dirname, '../.test-data/m4-' + Date.now()),
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
    assert.ok(r.data.runs.length > 0);
    assert.equal(r.data.capabilities.live, false);
    await p.locator('.agent-card').first().click();
    await p.locator('.virtual-log').waitFor();
    assert.ok(await p.getByRole('button', { name: '停止 · Unsupported' }).isDisabled());
    await p.screenshot({ path: path.join(__dirname, '../.test-data/m4-agents.png') });
    console.log(
      `PASS M4: ${r.data.runs.length} real local sessions, bounded log UI, unsupported controls disabled`,
    );
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
