const { _electron: electron } = require('@playwright/test');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const app = await electron.launch({
    args: [path.join(__dirname, '..')],
    env: {
      ...process.env,
      NEXUS_TEST_MODE: '1',
      NEXUS_DATA_DIR: path.join(__dirname, '../.test-data/m7-' + Date.now()),
    },
  });
  try {
    const p = await app.firstWindow();
    await p.locator('h1').waitFor();
    await p.keyboard.press('Control+Shift+Space');
    await p.getByLabel('快速记录内容').fill('TODO Capture acceptance');
    await p.getByRole('button', { name: '保存记录' }).click();
    await p.keyboard.press('Control+k');
    await p.getByLabel('全局搜索').fill('Capture acceptance');
    await p.getByRole('button', { name: 'Capture acceptance tasks' }).click();
    await p.getByLabel('任务标题', { exact: true }).waitFor();
    await p.getByRole('button', { name: '取消', exact: true }).click();
    await p.getByRole('button', { name: '进入专注模式', exact: true }).click();
    await p.getByRole('button', { name: '开始专注', exact: true }).first().click();
    await p.getByRole('button', { name: '暂停', exact: true }).waitFor();
    await p.getByRole('button', { name: '暂停', exact: true }).click();
    await p.getByRole('button', { name: '继续', exact: true }).waitFor();
    await p.getByRole('button', { name: '结束并记录' }).click();
    assert.equal((await p.evaluate(() => window.nexus.call('list', 'focus'))).data.length, 1);
    console.log(
      'PASS M7: keyboard capture, cross-entity search, focus start/pause/stop persistence',
    );
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
