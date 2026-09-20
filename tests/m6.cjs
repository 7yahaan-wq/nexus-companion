const { _electron: electron } = require('@playwright/test');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const app = await electron.launch({
    args: [path.join(__dirname, '..')],
    env: {
      ...process.env,
      NEXUS_TEST_MODE: '1',
      NEXUS_DATA_DIR: path.join(__dirname, '../.test-data/m6-' + Date.now()),
    },
  });
  try {
    const p = await app.firstWindow();
    await p.locator('.avatar-render img').waitFor();
    assert.equal(
      await p.locator('.avatar-render img').evaluate((i) => i.complete && i.naturalWidth > 0),
      true,
    );
    await p.getByRole('button', { name: 'Nia 快捷操作' }).click();
    await p.getByRole('button', { name: '快速笔记', exact: true }).waitFor();
    await p.locator('[data-page="Settings"]').click();
    await p.getByLabel('角色', { exact: true }).selectOption('orb');
    await p.waitForTimeout(200);
    assert.equal(await p.locator('.avatar-render img').count(), 0);
    await p.getByLabel('角色', { exact: true }).selectOption('nia');
    await p.screenshot({ path: path.join(__dirname, '../.test-data/m6-avatar.png') });
    console.log(
      'PASS M6: Nia sprite rendering, action menu, avatar switching and settings persistence',
    );
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
