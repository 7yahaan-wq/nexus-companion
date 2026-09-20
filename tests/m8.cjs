const { _electron: electron } = require('@playwright/test');
const path = require('node:path');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
(async () => {
  const app = await electron.launch({
    args: [path.join(__dirname, '..')],
    env: {
      ...process.env,
      NEXUS_TEST_MODE: '1',
      NEXUS_DATA_DIR: path.join(__dirname, '../.test-data/m8-' + Date.now()),
    },
  });
  try {
    const p = await app.firstWindow();
    await p.locator('h1').waitFor();
    await p.waitForFunction(async () => (await window.nexus.call('info')).data.ready);
    const state = await app.evaluate(({ app, globalShortcut, Notification }) => ({
      version: process.versions.electron,
      shortcut: globalShortcut.isRegistered('CommandOrControl+Shift+Space'),
      notifications: Notification.isSupported(),
    }));
    assert.equal(state.version, '39.8.10');
    if (!state.shortcut) {
      const info = (await p.evaluate(() => window.nexus.call('info'))).data;
      assert.match(await fs.readFile(path.join(info.dataPath, 'logs', 'app.log'), 'utf8'), /Quick Capture shortcut unavailable/);
      await p.keyboard.press('Control+Shift+Space');
      await p.getByLabel('快速记录内容').waitFor();
      await p.getByRole('button', { name: '关闭', exact: true }).click();
    }
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    assert.equal(
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()),
      false,
    );
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0];
      w.show();
      w.webContents.send('command', 'capture');
    });
    await p.getByLabel('快速记录内容').waitFor();
    await p.getByRole('button', { name: '关闭', exact: true }).click();
    const result = await p.evaluate(() =>
      window.nexus.call('notify', 'Nexus 验收测试', 'Windows 通知服务已调用。'),
    );
    assert.equal(result.ok, true);
    console.log(
      `PASS M8: Electron, shortcut ${state.shortcut ? 'registered' : 'occupied: warning + in-window fallback verified'}, close-to-tray/restore, native notification supported:`,
      state.notifications,
    );
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
