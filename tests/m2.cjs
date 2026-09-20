const { _electron: electron } = require('@playwright/test');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const app = await electron.launch({
    args: [path.join(__dirname, '..')],
    env: {
      ...process.env,
      NEXUS_TEST_MODE: '1',
      NEXUS_DATA_DIR: path.join(__dirname, '../.test-data/m2-' + Date.now()),
    },
  });
  try {
    const p = await app.firstWindow();
    await p.locator('[data-page="Projects"]').click();
    await p.getByRole('button', { name: '新建项目', exact: true }).click();
    await p.getByLabel('项目名称').fill('Integration Project');
    await p.getByLabel('项目目录').fill(path.join(__dirname, '..'));
    await p.getByRole('button', { name: '保存', exact: true }).click();
    await p.getByRole('button', { name: 'Integration Project' }).waitFor();
    await p.locator('[data-page="Tasks"]').click();
    await p.getByRole('button', { name: '新建任务', exact: true }).click();
    await p.getByLabel('任务标题').fill('Build acceptance');
    await p.getByLabel('状态', { exact: true }).selectOption('In Progress');
    await p.getByRole('button', { name: '保存', exact: true }).click();
    await p.getByRole('button', { name: 'Build acceptance', exact: true }).waitFor();
    const tasks = await p.evaluate(() => window.nexus.call('list', 'tasks'));
    assert.equal(tasks.data[0].status, 'In Progress');
    await p.getByRole('button', { name: 'Build acceptance', exact: true }).click();
    await p.getByLabel('状态', { exact: true }).selectOption('Done');
    await p.getByRole('button', { name: '保存', exact: true }).click();
    await p.waitForTimeout(200);
    assert.ok((await p.evaluate(() => window.nexus.call('list', 'tasks'))).data[0].completedAt);
    console.log(
      'PASS M2: project creation/path validation, task creation/edit and completion persistence',
    );
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
