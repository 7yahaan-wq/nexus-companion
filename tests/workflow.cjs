const { _electron: electron } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Store } = require('../electron/storage/index.cjs');
const root = path.resolve(__dirname, '..');
const base = path.join(root, '.test-data', 'workflow-' + Date.now());
const profile = path.join(base, 'profile');
const errors = [];
const button = (p, name) => p.getByRole('button', { name, exact: true });
async function launch() {
  const app = await electron.launch({
    ...(process.env.NEXUS_PACKAGED_EXE
      ? { executablePath: process.env.NEXUS_PACKAGED_EXE, args: [] }
      : { args: [root] }),
    env: {
      ...process.env,
      NEXUS_TEST_MODE: '1',
      NEXUS_DATA_DIR: profile,
      CODEX_HOME: path.join(base, 'codex'),
    },
  });
  const p = await app.firstWindow();
  p.setDefaultTimeout(15000);
  p.on('pageerror', (e) => errors.push(e.message));
  await p.waitForFunction(async () => (await window.nexus.call('info')).data.ready);
  await p.locator('.hero').waitFor();
  return { app, p };
}
async function capture(app, p, name, size) {
  await app.evaluate(({ BrowserWindow }, size) => {
    const w = BrowserWindow.getAllWindows()[0];
    w.unmaximize();
    w.setSize(...size);
    w.show();
    w.focus();
  }, size);
  await p.waitForFunction((width) => Math.abs(innerWidth - width) < 30, size[0]);
  await p.evaluate(() => window.scrollTo(0, 0));
  const png = await app.evaluate(async ({ BrowserWindow }) =>
    (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'),
  );
  await fs.writeFile(path.join(base, name + '.png'), Buffer.from(png, 'base64'));
  const overlap = await p.evaluate(() => {
    const main = document.querySelector('main').getBoundingClientRect(),
      rail = document.querySelector('.companion-rail').getBoundingClientRect();
    return {
      overlap: Math.max(0, Math.min(main.right, rail.right) - Math.max(main.left, rail.left)),
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  assert.equal(overlap.overlap, 0, JSON.stringify(overlap));
  assert.equal(overlap.overflow, false);
}
(async () => {
  await fs.mkdir(path.join(base, 'codex/sessions'), { recursive: true });
  const store = new Store(path.join(profile, 'nexus.sqlite'));
  await store.save('settings', {
    id: 'appearance',
    onboarded: true,
    language: 'zh-CN',
    theme: 'dark',
  });
  await store.close();
  let { app, p } = await launch();
  try {
    await p.keyboard.press('Control+Shift+Space');
    await button(p, '灵感').waitFor();
    assert.equal(await button(p, '灵感').getAttribute('aria-pressed'), 'true');
    await p.getByLabel('快速记录内容').fill('快捷草稿恢复');
    await p.keyboard.press('Escape');
    await p.waitForFunction(() => !document.querySelector('dialog[open]'));
    await app.close();
    ({ app, p } = await launch());
    await p.keyboard.press('Control+Shift+Space');
    await p.waitForFunction(
      () => document.querySelector('[aria-label="快速记录内容"]')?.value === '快捷草稿恢复',
    );
    await button(p, '保存记录').click();
    await p.getByRole('heading', { name: '快捷草稿恢复', exact: true }).waitFor();
    await p.waitForFunction(() => !document.querySelector('dialog[open]'));
    await p.keyboard.press('Control+Shift+Space');
    await p.locator('.capture-kind').getByRole('button', { name: '任务', exact: true }).click();
    await p.getByLabel('快速记录内容').fill('快捷任务');
    await button(p, '保存记录').click();
    await p.waitForFunction(() => !document.querySelector('dialog[open]'));
    await p.keyboard.press('Control+Shift+Space');
    await p.waitForFunction(
      () => document.querySelector('.capture-kind [aria-pressed="true"]')?.textContent === '任务',
    );
    await p.keyboard.press('Escape');
    await p.waitForFunction(() => !document.querySelector('dialog[open]'));
    await button(p, '快捷任务').click();
    assert.equal(await p.getByLabel('关联 Agent Task ID', { exact: true }).isVisible(), false);
    assert.equal(
      await p
        .getByLabel('任务标题', { exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    const save = await button(p, '保存').boundingBox();
    assert.ok(save.y + save.height < (await p.evaluate(() => innerHeight)));
    await p.keyboard.press('Escape');
    await p.waitForFunction(() => !document.querySelector('dialog[open]'));
    const before = Date.now();
    await button(p, '安排 快捷任务').click();
    const start = await p.getByLabel('开始时间', { exact: true }).inputValue();
    assert.ok(new Date(start).getTime() >= before - 1000, start);
    await p.keyboard.press('Escape');
    await p.waitForFunction(() => !document.querySelector('dialog[open]'));
    await p.locator('[data-page="Home"]').click();
    await capture(app, p, 'home-dark-wide', [1366, 900]);
    await button(p, '收起伙伴').click();
    await p.waitForFunction(
      () => document.querySelector('.app').dataset.companionCompact === 'true',
    );
    await capture(app, p, 'home-dark-compact', [1366, 900]);
    await button(p, '展开伙伴').click();
    await capture(app, p, 'home-dark-narrow', [1060, 720]);
    await p.locator('[data-page="Settings"]').click();
    await p.getByLabel('主题', { exact: true }).selectOption('light');
    await p.getByLabel('Language / 语言').selectOption('en');
    await p.locator('[data-page="Home"]').click();
    await capture(app, p, 'home-light-narrow', [1060, 720]);
    await button(p, 'Capture an idea').click();
    await p.getByLabel('Note title', { exact: true }).fill('English draft');
    await p.keyboard.press('Escape');
    await p.waitForFunction(() => !document.querySelector('dialog[open]'));
    await button(p, 'View ideas').click();
    await capture(app, p, 'notes-light-narrow', [1060, 720]);
    assert.deepEqual(errors, []);
    await fs.writeFile(
      path.join(base, 'result.json'),
      JSON.stringify({ passed: true, errors, screenshots: base }, null, 2),
    );
    console.log(
      'PASS workflow: capture type + restart draft + destination, compact task form + autofocus, future time blocks, companion geometry in dark/light/wide/narrow; screenshots ' +
        base,
    );
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
