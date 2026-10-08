const { _electron: electron } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const base = path.join(root, '.test-data/usability-' + Date.now());
const data = path.join(base, 'profile');
const destination = path.join(base, 'destination');
async function launch() {
  return electron.launch({
    ...(process.env.NEXUS_PACKAGED_EXE
      ? { executablePath: process.env.NEXUS_PACKAGED_EXE, args: [] }
      : { args: [root] }),
    env: { ...process.env, NEXUS_DATA_DIR: data },
  });
}
function luminance(rgb) {
  const values = rgb
    .match(/[\d.]+/g)
    .slice(0, 3)
    .map(Number)
    .map((v) => {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}
(async () => {
  await fs.mkdir(destination, { recursive: true });
  let app = await launch();
  const errors = [];
  try {
    let p = await app.firstWindow();
    p.on('pageerror', (e) => errors.push(e.message));
    await p.getByRole('heading', { name: '欢迎使用 Nexus' }).waitFor();
    await p.getByRole('button', { name: '关闭', exact: true }).click();
    await p.waitForFunction(() => !document.querySelector('dialog[open]'));
    await p.locator('[data-page="Settings"]').click();
    await p.getByRole('button', { name: '重新打开欢迎引导' }).click();
    await p.locator('dialog[open]').waitFor();
    await p.keyboard.press('Escape');
    await p.waitForFunction(() => !document.querySelector('dialog[open]'));
    await p.getByLabel('Language / 语言').selectOption('en');
    await p.getByRole('button', { name: 'Tasks', exact: true }).waitFor();
    await p.getByLabel('Language / 语言').selectOption('zh-CN');
    await p.getByRole('button', { name: '任务', exact: true }).waitFor();
    await p.getByLabel('主题', { exact: true }).selectOption('light');
    await p.waitForFunction(() => document.querySelector('.app').dataset.theme === 'light');
    await p.locator('[data-page="Home"]').click();
    const colors = await p.locator('.hero').evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        color: style.color,
        muted: getComputedStyle(el.querySelector('p')).color,
        bg: getComputedStyle(document.querySelector('.app')).backgroundColor,
      };
    });
    assert.ok(
      (luminance(colors.bg) + 0.05) / (luminance(colors.color) + 0.05) >= 7,
      JSON.stringify(colors),
    );
    assert.ok(
      (luminance(colors.bg) + 0.05) / (luminance(colors.muted) + 0.05) >= 4.5,
      JSON.stringify(colors),
    );
    await p.screenshot({ path: path.join(root, '.test-data/v020-morning.png') });
    await p.getByRole('button', { name: '添加今日任务', exact: true }).first().click();
    await p.getByLabel('任务标题', { exact: true }).fill('Dialog closure regression');
    await p.keyboard.press('Escape');
    await p.getByRole('button', { name: '放弃修改', exact: true }).click();
    await p.waitForFunction(() => !document.querySelector('dialog[open]'));
    await p.getByRole('button', { name: '进入专注模式' }).click();
    await p.getByRole('button', { name: '开始专注', exact: true }).click();
    await p.getByRole('button', { name: '结束并记录' }).waitFor();
    await p.getByRole('button', { name: '← 返回工作台 · Esc' }).click();
    assert.ok((await p.evaluate(() => window.nexus.call('focusState'))).data);
    await p.locator('.sidebar-bottom').getByRole('button', { name: '返回专注' }).click();
    await p.keyboard.press('Escape');
    await p.locator('.hero').waitFor();
    await p.locator('[data-page="Settings"]').click();
    await p.getByRole('button', { name: '暂停读取', exact: true }).click();
    await p.getByRole('button', { name: '启用读取', exact: true }).waitFor();
    assert.equal((await p.evaluate(() => window.nexus.call('agents', true))).data.runs.length, 0);
    await p.evaluate(() =>
      window.nexus.call('save', 'notes', {
        id: 'migrate-me',
        title: '迁移保留',
        content: '中文内容',
      }),
    );
    await app.evaluate(({ dialog }, directory) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] });
    }, destination);
    await p.getByRole('button', { name: '选择数据保存位置' }).click();
    await p.getByRole('button', { name: '重启并迁移数据' }).waitFor();
    await app.close();
    app = await launch();
    p = await app.firstWindow();
    await p.waitForFunction(() => document.querySelector('.app')?.dataset.theme === 'light');
    const info = (await p.evaluate(() => window.nexus.call('info'))).data;
    assert.equal(info.dataPath, path.join(destination, 'NexusCompanion-Data'));
    assert.equal(info.pendingDataPath, null);
    assert.equal(
      (await p.evaluate(() => window.nexus.call('list', 'notes'))).data[0].content,
      '中文内容',
    );
    assert.ok((await p.evaluate(() => window.nexus.call('focusState'))).data);
    assert.equal((await p.evaluate(() => window.nexus.call('connectionInfo'))).data.enabled, false);
    await fs.access(path.join(data, 'nexus.sqlite'));
    await p.evaluate(() => window.nexus.call('focusStop'));
    assert.deepEqual(errors, []);
    console.log(
      'PASS usability: modal close/Esc, focus navigation with continuing timer, language, Morning contrast, pause connection, migration and restart persistence',
    );
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
