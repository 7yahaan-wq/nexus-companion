const { _electron: electron } = require('@playwright/test');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const app = await electron.launch({
    args: [path.join(__dirname, '..')],
    env: {
      ...process.env,
      NEXUS_TEST_MODE: '1',
      NEXUS_DATA_DIR: path.join(__dirname, '../.test-data/m5-' + Date.now()),
    },
  });
  try {
    const p = await app.firstWindow();
    await p.locator('[data-page="Notes"]').click();
    await p.getByRole('button', { name: '新建笔记', exact: true }).click();
    await p.getByLabel('笔记标题', { exact: true }).fill('Design journal');
    await p
      .getByLabel('内容（Markdown）', { exact: true })
      .fill('## Real note\nA persistent idea.');
    await p.getByRole('button', { name: '保存', exact: true }).click();
    await p.getByRole('heading', { name: 'Real note' }).waitFor();
    await p.locator('[data-page="Timeline"]').click();
    await p.getByRole('button', { name: '每日总结', exact: true }).click();
    await p.getByRole('heading', { name: 'Focus Time' }).waitFor();
    assert.ok((await p.locator('.markdown').innerText()).includes('Design journal'));
    console.log('PASS M5: Markdown note persistence, timeline and daily report generation');
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
