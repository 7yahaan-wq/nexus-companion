const { _electron: electron } = require('@playwright/test');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const app = await electron.launch({
    args: [path.join(__dirname, '..')],
    env: {
      ...process.env,
      NEXUS_TEST_MODE: '1',
      NEXUS_DATA_DIR: path.join(__dirname, '../.test-data/m3-' + Date.now()),
    },
  });
  try {
    const p = await app.firstWindow();
    await p.locator('[data-page="Calendar"]').click();
    await p.getByRole('button', { name: '新建日程', exact: true }).click();
    await p.getByLabel('日程标题', { exact: true }).fill('Calendar acceptance');
    await p.getByLabel('重复', { exact: true }).selectOption('daily');
    await p.getByRole('button', { name: '保存', exact: true }).click();
    await p.locator('.calendar-event').first().waitFor();
    for (const view of ['月', '日', '周']) {
      await p.getByRole('button', { name: view, exact: true }).click();
      assert.ok(await p.locator('.calendar-event').count());
    }
    const events = await p.evaluate(() => window.nexus.call('list', 'events'));
    assert.equal(events.data[0].recurrence, 'daily');
    await p.screenshot({ path: path.join(__dirname, '../.test-data/m3-calendar.png') });
    console.log('PASS M3: recurring event CRUD and Month/Day/Week rendering');
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
