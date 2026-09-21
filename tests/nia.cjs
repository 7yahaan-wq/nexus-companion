const { _electron: electron } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const base = path.join(root, '.test-data/nia-' + Date.now());
const errors = [];
async function launch(first = true) {
  const app = await electron.launch({
    ...(process.env.NEXUS_PACKAGED_EXE
      ? { executablePath: process.env.NEXUS_PACKAGED_EXE, args: [] }
      : { args: [root] }),
    env: {
      ...process.env,
      NEXUS_TEST_MODE: '1',
      NEXUS_DATA_DIR: path.join(base, 'profile'),
      CODEX_HOME: path.join(base, 'codex'),
    },
  });
  const page = await app.firstWindow();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.waitForFunction(async () => (await window.nexus.call('info')).data.ready);
  if (process.env.NEXUS_PACKAGED_EXE && first) {
    await page.getByRole('heading', { name: '欢迎使用 Nexus' }).waitFor();
    await page.getByRole('button', { name: '关闭', exact: true }).click();
  }
  await page.locator('.hero').waitFor();
  return { app, page };
}

(async () => {
  await fs.mkdir(path.join(base, 'codex/sessions'), { recursive: true });
  let { app, page: p } = await launch();
  try {
    assert.equal(
      await p.getByRole('button', { name: /进入专注模式|开始一段专注|返回专注/ }).count(),
      1,
    );
    await p.getByRole('button', { name: '进入专注模式', exact: true }).click();
    await p.getByRole('button', { name: '开始专注', exact: true }).waitFor();
    await p.getByRole('button', { name: '← 返回工作台 · Esc', exact: true }).click();
    const idea = p.getByRole('button', { name: '记录灵感', exact: true });
    assert.ok(await idea.isVisible());
    await idea.click();
    await p.getByRole('button', { name: '取消', exact: true }).click();
    await p.locator('.hero').waitFor();
    await idea.click();
    await p.getByLabel('笔记标题', { exact: true }).fill('主页灵感验收');
    await p
      .getByLabel('内容（Markdown）', { exact: true })
      .fill('## 一个及时保存的想法\n让 Nia 多一些表情。');
    await p.getByRole('button', { name: '保存', exact: true }).click();
    await p.waitForFunction(() => !document.querySelector('dialog[open]'));
    await p.getByRole('heading', { name: '灵感笔记', exact: true }).waitFor();
    assert.ok(await p.getByRole('button', { name: '灵感笔记', exact: true }).isVisible());
    await p.getByRole('heading', { name: '一个及时保存的想法', exact: true }).waitFor();
    await p.locator('[data-page="Home"]').click();
    await p.getByRole('button', { name: '查看灵感', exact: true }).click();
    await p.getByRole('heading', { name: '一个及时保存的想法', exact: true }).waitFor();
    await p.locator('[data-page="Home"]').click();
    await p.screenshot({ path: path.join(root, '.test-data/v031-home.png') });
    await p.locator('[data-page="Settings"]').click();
    const preview = p.locator('.nia-preview-stage .avatar-render');
    const sprite = preview.locator('.nia-sprite');
    await p.emulateMedia({ reducedMotion: 'reduce' });
    for (const state of [
      'idle',
      'working',
      'thinking',
      'happy',
      'warning',
      'error',
      'sleepy',
      'celebrate',
    ]) {
      await p.locator(`[data-preview-state="${state}"]`).click();
      assert.equal(await preview.getAttribute('data-state'), state);
      assert.equal(await preview.getAttribute('data-motion'), 'still');
      await sprite.locator('img').evaluate(async (img) => img.decode());
      assert.ok(await sprite.locator('img').evaluate((img) => img.naturalWidth >= 1024));
      await p.locator('.nia-preview').screenshot({ path: path.join(base, `preview-${state}.png`) });
    }
    await p.locator('[data-preview-state="working"]').click();
    await p.emulateMedia({ reducedMotion: 'no-preference' });
    await p.waitForFunction(
      () =>
        document.querySelector('.nia-preview-stage .avatar-render').dataset.motion === 'playing',
    );
    const frame = await sprite.getAttribute('data-frame');
    await p.waitForFunction(
      (frame) => document.querySelector('.nia-preview-stage .nia-sprite').dataset.frame !== frame,
      frame,
    );
    await p.emulateMedia({ reducedMotion: 'reduce' });
    await p.waitForFunction(
      () => document.querySelector('.nia-preview-stage .avatar-render').dataset.motion === 'still',
    );
    const still = await sprite.getAttribute('data-frame');
    await p.waitForTimeout(800);
    assert.equal(await sprite.getAttribute('data-frame'), still);
    await p.emulateMedia({ reducedMotion: 'no-preference' });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].hide());
    assert.equal(
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()),
      false,
    );
    await p.waitForFunction(
      () => document.querySelector('.nia-preview-stage .avatar-render').dataset.motion === 'still',
    );
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].show());
    await p.waitForFunction(
      () =>
        document.querySelector('.nia-preview-stage .avatar-render').dataset.motion === 'playing',
    );
    await p.getByLabel('角色动画', { exact: true }).click();
    await p.waitForFunction(() => !document.querySelector('input[aria-label="角色动画"]').checked);
    await p.waitForFunction(
      () => document.querySelector('.nia-preview-stage .avatar-render').dataset.motion === 'still',
    );
    await p.getByLabel('主题', { exact: true }).selectOption('light');
    await p.waitForFunction(() => document.querySelector('.app').dataset.theme === 'light');
    await p
      .locator('.nia-preview')
      .screenshot({ path: path.join(root, '.test-data/v030-nia-light.png') });
    await p.getByLabel('Language / 语言').selectOption('en');
    await p.locator('[data-page="Home"]').click();
    await p.getByRole('button', { name: 'Capture an idea', exact: true }).waitFor();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1060, 760));
    const box = await p.getByRole('button', { name: 'Capture an idea', exact: true }).boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= (await p.evaluate(() => innerWidth)));
    assert.ok(await p.getByRole('button', { name: 'View ideas', exact: true }).isVisible());
    await p.screenshot({ path: path.join(root, '.test-data/v031-home-narrow.png') });
    await p.getByRole('button', { name: 'View ideas', exact: true }).click();
    await p.getByRole('heading', { name: 'Ideas & notes', exact: true }).waitFor();
    await p.getByRole('heading', { name: '一个及时保存的想法', exact: true }).waitFor();
    await app.close();
    ({ app, page: p } = await launch(false));
    const notes = (await p.evaluate(() => window.nexus.call('list', 'notes'))).data;
    assert.equal(notes.length, 1);
    assert.equal(notes[0].title, '主页灵感验收');
    await p.getByRole('button', { name: 'View ideas', exact: true }).click();
    await p.getByRole('heading', { name: '一个及时保存的想法', exact: true }).waitFor();
    const appearance = (await p.evaluate(() => window.nexus.call('list', 'settings'))).data.find(
      (s) => s.id === 'appearance',
    );
    assert.equal(appearance.avatarMotion, false);
    await p.waitForFunction(
      () => document.querySelector('.companion-rail .avatar-render').dataset.motion === 'still',
    );
    assert.deepEqual(errors, []);
    console.log(
      'PASS Nia: save-to-notes navigation, view ideas + restart, single focus entry, eight states, frame advance, reduced/disabled/hidden motion, light/English/narrow layout; zero renderer errors',
    );
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
