const { _electron: electron } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
(async () => {
  const root = path.join(__dirname, '..');
  const dataDir = path.join(root, '.test-data', 'polish-' + Date.now());
  const codex = await require('./support/codex-fixture.cjs')(dataDir);
  const app = await electron.launch({
    args: [root],
    env: { ...process.env, NEXUS_TEST_MODE: '1', NEXUS_DATA_DIR: dataDir, CODEX_HOME: codex },
  });
  try {
    const p = await app.firstWindow();
    await p.locator('h1').waitFor();
    await p.evaluate(() =>
      window.nexus.call('save', 'tasks', {
        id: 'drag-test',
        title: 'Board drag acceptance',
        status: 'Inbox',
        priority: 'High',
      }),
    );
    await p.reload();
    await p.locator('[data-page="Tasks"]').click();
    await p
      .locator('.task-card')
      .filter({ hasText: 'Board drag acceptance' })
      .dragTo(p.locator('.kanban-column').nth(2));
    await p.waitForFunction(
      async () => (await window.nexus.call('list', 'tasks')).data[0]?.status === 'In Progress',
    );
    await p.locator('[data-page="Settings"]').click();
    const file = path.join(dataDir, 'backup.nexus');
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, file);
    await p.getByRole('button', { name: '导出本地备份' }).click();
    await p.getByRole('status').filter({ hasText: '备份已导出' }).waitFor();
    assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).format, 'nexus-companion-backup');
    await p.evaluate(() => window.nexus.call('delete', 'tasks', 'drag-test'));
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
    }, file);
    await p.getByRole('button', { name: '导入备份', exact: true }).click();
    await p.getByRole('button', { name: '确认恢复' }).click();
    await p.waitForFunction(async () =>
      (await window.nexus.call('list', 'tasks')).data.some((t) => t.id === 'drag-test'),
    );
    await p.locator('[data-page="Agents"]').click();
    await p.locator('.agent-card').first().waitFor({ timeout: 60000 });
    await p.locator('.agent-card').first().click();
    await p.getByRole('button', { name: '标注角色 / 置顶' }).click();
    await p.getByLabel('显示名称', { exact: true }).fill('My Programmer');
    await p.getByLabel('角色', { exact: true }).selectOption('Programmer');
    await p.getByLabel('置顶', { exact: true }).selectOption('yes');
    await p.getByRole('button', { name: '保存', exact: true }).click();
    await p.locator('.agent-card').first().filter({ hasText: 'My Programmer' }).waitFor();
    assert.ok((await p.locator('.agent-card').first().innerText()).includes('★'));
    console.log(
      'PASS polish: task board drag, backup export/preview/restore, isolated session role labels and pinning',
    );
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
