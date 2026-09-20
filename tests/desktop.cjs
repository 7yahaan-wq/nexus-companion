const { _electron: electron } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
(async () => {
  const app = await electron.launch({
    args: [path.join(__dirname, '..')],
    env: {
      ...process.env,
      NEXUS_TEST_MODE: '1',
      NEXUS_DATA_DIR: path.join(__dirname, '../.test-data/desktop-' + Date.now()),
    },
  });
  try {
    const page = await app.firstWindow();
    await page.waitForSelector('h1');
    assert.equal(await page.title(), 'Nexus Companion');
    await page.locator('[data-page="Settings"]').click();
    await page.getByLabel('主题', { exact: true }).selectOption('light');
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.app').getAttribute('data-theme'), 'light');
    const settings = await page.evaluate(() => window.nexus.call('list', 'settings'));
    assert.equal(settings.data[0].theme, 'light');
    await page.getByLabel('主题', { exact: true }).selectOption('dark');
    await page.locator('[data-page="Home"]').click();
    await fs.mkdir(path.join(__dirname, '../.test-data'), { recursive: true });
    await page.screenshot({ path: path.join(__dirname, '../.test-data/m1-desktop.png') });
    console.log('PASS: Electron launch, navigation, theme IPC/SQLite persistence and screenshot');
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
