const { _electron: electron } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..'),
  dataDir = path.join(root, '.test-data/e2e-' + Date.now());
async function launch() {
  return electron.launch({
    ...(process.env.NEXUS_PACKAGED_EXE
      ? { executablePath: process.env.NEXUS_PACKAGED_EXE, args: [] }
      : { args: [root] }),
    env: { ...process.env, NEXUS_DATA_DIR: dataDir },
  });
}
(async () => {
  await fs.mkdir(dataDir, { recursive: true });
  let app = await launch();
  try {
    let p = await app.firstWindow();
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.getByRole('heading', { name: '欢迎使用 Nexus' }).waitFor();
    await p.getByRole('button', { name: '继续', exact: true }).click();
    await app.evaluate(({ dialog }, root) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [root] });
    }, root);
    await p.getByRole('button', { name: '选择文件夹', exact: true }).click();
    await p.getByRole('button', { name: '继续', exact: true }).click();
    await p.getByLabel('首个项目名称').fill('Nexus acceptance');
    await p.getByRole('button', { name: '继续', exact: true }).click();
    await p.getByRole('button', { name: '继续', exact: true }).click();
    await p.getByRole('button', { name: '进入工作台', exact: true }).click();
    await p.waitForFunction(() => !document.querySelector('dialog[open]'));
    await p.keyboard.press('Control+Shift+Space');
    await p.getByLabel('快速记录内容').fill('TODO Drag calendar acceptance');
    await p.getByRole('button', { name: '保存记录' }).click();
    await p.locator('[data-page="Calendar"]').click();
    await p.locator('.calendar-task').first().dragTo(p.locator('.hour-slot').nth(10));
    await p.getByLabel('日程标题', { exact: true }).waitFor();
    assert.equal(
      await p.getByLabel('日程标题', { exact: true }).inputValue(),
      'Drag calendar acceptance',
    );
    await p.getByRole('button', { name: '保存', exact: true }).click();
    await p.locator('.calendar-event').first().waitFor();
    let events = (await p.evaluate(() => window.nexus.call('list', 'events'))).data;
    assert.equal(events.length, 1);
    assert.ok(events[0].relatedTask);
    await p.locator('[data-page="Settings"]').click();
    await app.evaluate(
      ({ dialog }, file) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
      },
      path.join(root, 'public/assets/nia.png'),
    );
    await p.getByLabel('背景类型').selectOption('image');
    await p.getByRole('button', { name: '选择 PNG / JPG / WEBP' }).click();
    await p.waitForFunction(() =>
      document.querySelector('.app-background').style.backgroundImage.includes('data:image'),
    );
    const packDir = path.join(dataDir, 'pack');
    await fs.mkdir(packDir, { recursive: true });
    await fs.copyFile(path.join(root, 'public/assets/nia.png'), path.join(packDir, 'nia.png'));
    await fs.writeFile(
      path.join(packDir, 'avatar.json'),
      JSON.stringify({
        name: 'Acceptance Nia',
        states: Object.fromEntries(
          ['idle', 'working', 'thinking', 'happy', 'warning', 'error', 'sleepy', 'celebrate'].map(
            (s) => [s, 'nia.png'],
          ),
        ),
      }),
    );
    await app.evaluate(
      ({ dialog }, file) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
      },
      path.join(packDir, 'avatar.json'),
    );
    await p.getByRole('button', { name: '导入 Avatar Pack' }).click();
    await p.waitForFunction(() =>
      document.querySelector('.companion-rail .avatar-render img')?.src.startsWith('data:image'),
    );
    await p.getByLabel('主题', { exact: true }).selectOption('light');
    await p.waitForFunction(() => document.querySelector('.app').dataset.theme === 'light');
    await p.screenshot({ path: path.join(root, '.test-data/appearance-light.png') });
    await p.getByLabel('主题', { exact: true }).selectOption('dark');
    await p.getByLabel('背景类型').selectOption('gradient');
    await p.locator('[data-page="Timeline"]').click();
    await p.getByRole('button', { name: '每日总结', exact: true }).click();
    const reportFile = path.join(dataDir, 'report.md');
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, reportFile);
    await p.getByRole('button', { name: '导出 Markdown' }).click();
    await p.waitForTimeout(300);
    assert.match(await fs.readFile(reportFile, 'utf8'), /Daily Development Report/);
    const denied = await p.evaluate(() => window.nexus.call('arbitrary-shell', 'whoami'));
    assert.equal(denied.ok, false);
    await p.locator('[data-page="Home"]').click();
    await p.screenshot({ path: path.join(root, '.test-data/home-final.png'), fullPage: true });
    assert.deepEqual(errors, []);
    await app.close();
    app = await launch();
    p = await app.firstWindow();
    await p.waitForTimeout(500);
    assert.equal(await p.locator('dialog[open]').count(), 0);
    const saved = await p.evaluate(() => window.nexus.call('list', 'tasks'));
    assert.equal(saved.data.length, 1);
    assert.equal((await p.evaluate(() => window.nexus.call('list', 'events'))).data.length, 1);
    console.log(
      'PASS E2E: onboarding + project, real drag task→calendar, background/pack import, themes, report export, denied IPC, restart persistence; zero renderer errors',
    );
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
