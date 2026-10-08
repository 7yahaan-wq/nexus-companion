const { _electron: electron } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { Store } = require('../electron/storage/index.cjs');
const root = path.join(__dirname, '..');
const base = path.join(root, '.test-data', `focus-flow-${Date.now()}`);
const profile = path.join(base, 'profile');
const taskId = 'focus-flow-task';
const errors = [];
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
  const page = await app.firstWindow();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.waitForFunction(async () => (await window.nexus.call('info')).data.ready);
  await page.locator('[data-page="Home"]').waitFor();
  return { app, page };
}
async function savedTask(page) {
  return page.evaluate(
    async (id) => (await window.nexus.call('list', 'tasks')).data.find((item) => item.id === id),
    taskId,
  );
}
(async () => {
  await fs.mkdir(path.join(base, 'codex/sessions'), { recursive: true });
  const store = new Store(path.join(profile, 'nexus.sqlite'));
  await store.save('settings', {
    id: 'appearance',
    onboarded: true,
    language: 'zh-CN',
    notifications: { focus: true },
  });
  await store.save('tasks', {
    id: taskId,
    title: '关联任务专注验收',
    status: 'Planned',
    actualTime: 7,
    dueDate: new Date().toLocaleDateString('sv-SE'),
  });
  await store.close();
  let { app, page: p } = await launch();
  try {
    await p.locator('[data-page="Tasks"]').click();
    await p.getByRole('button', { name: '专注 关联任务专注验收', exact: true }).click();
    assert.equal(await p.getByLabel('专注任务', { exact: true }).inputValue(), taskId);
    assert.equal(
      (await p.evaluate(() => window.nexus.call('focusState'))).data,
      null,
      'Selecting a task does not auto-start the timer',
    );
    await p.getByLabel('自定义专注分钟').fill('1');
    await p.getByRole('button', { name: '开始专注', exact: true }).click();
    await p.getByRole('button', { name: '暂停', exact: true }).waitFor();
    await p.getByRole('button', { name: '← 返回工作台 · Esc', exact: true }).click();
    const bar = p.locator('.focus-bar');
    await bar.waitFor();
    assert.match(await bar.innerText(), /关联任务专注验收/);
    await p.waitForFunction(
      async () => (await window.nexus.call('focusState')).data.remainingSeconds <= 57,
    );
    await bar.getByRole('button', { name: '暂停', exact: true }).click();
    await bar.getByRole('button', { name: '继续', exact: true }).waitFor();
    const pausedState = (await p.evaluate(() => window.nexus.call('focusState'))).data;
    assert.equal(pausedState.paused, true);
    await app.close();
    ({ app, page: p } = await launch());
    await p.locator('.focus-bar').getByRole('button', { name: '继续', exact: true }).waitFor();
    assert.equal(
      (await p.evaluate(() => window.nexus.call('focusState'))).data.remainingSeconds,
      pausedState.remainingSeconds,
    );
    await p.locator('.focus-bar').getByRole('button', { name: '继续', exact: true }).click();
    await p.locator('.focus-bar').getByRole('button', { name: '暂停', exact: true }).waitFor();
    await p.locator('.focus-bar').getByRole('button', { name: '结束并记录', exact: true }).click();
    await p.locator('.focus-completion').waitFor();
    let records = (await p.evaluate(() => window.nexus.call('list', 'focus'))).data;
    assert.equal(records.length, 1);
    assert.equal(records[0].status, 'stopped');
    const stoppedTask = await savedTask(p);
    assert.ok(Math.abs(stoppedTask.actualTime - (7 + records[0].actualSeconds / 60)) < 1e-10);
    assert.equal(stoppedTask.status, 'Planned', 'Finishing focus never auto-completes a task');
    await p
      .locator('.focus-completion')
      .getByRole('button', { name: '再来一轮', exact: true })
      .click();
    await p.locator('.focus-page').getByRole('button', { name: '暂停', exact: true }).waitFor();
    assert.equal((await p.evaluate(() => window.nexus.call('focusState'))).data.task, taskId);
    await p.locator('.focus-page').getByRole('button', { name: '结束并记录', exact: true }).click();
    await p.locator('.focus-completion').getByRole('button', { name: '休息', exact: true }).click();
    await p.locator('.focus-completion').waitFor({ state: 'detached' });
    await app.close();

    // Restore a valid in-progress session near its deadline, then let the real
    // main-process timer finish it. No renderer clock changes or test-only IPC.
    const seed = new Store(path.join(profile, 'nexus.sqlite'));
    const now = Date.now();
    await seed.save('settings', {
      id: 'active-focus',
      session: {
        id: 'restored-completion',
        task: taskId,
        title: '关联任务专注验收',
        startTime: new Date(now - 48000).toISOString(),
        plannedSeconds: 60,
        deadline: now + 12000,
        paused: false,
        remainingSeconds: 12,
      },
    });
    const beforeCompletion = (await seed.list('tasks'))[0].actualTime;
    await seed.close();
    ({ app, page: p } = await launch());
    await p.locator('.focus-bar').waitFor();
    await p.locator('.focus-completion').waitFor({ timeout: 20000 });
    assert.match(await p.locator('.focus-completion').innerText(), /专注完成，辛苦了/);
    const completedTask = await savedTask(p);
    assert.equal(completedTask.actualTime, beforeCompletion + 1);
    assert.equal(completedTask.status, 'Planned');
    await p
      .locator('.focus-completion')
      .getByRole('button', { name: '完成任务', exact: true })
      .click();
    await p.locator('.focus-completion').waitFor({ state: 'detached' });
    assert.equal((await savedTask(p)).status, 'Done');
    await app.close();
    ({ app, page: p } = await launch());
    assert.equal(
      await p.locator('.focus-completion').count(),
      0,
      'Old completions are not replayed on launch',
    );
    assert.equal((await savedTask(p)).actualTime, beforeCompletion + 1);
    assert.deepEqual(errors, []);
    console.log(
      'PASS focus flow: task selection, persistent compact timer, pause/restart/resume, stopped + completed task time, explicit completion, another round/break, no historical replay; zero renderer errors',
    );
    console.log(`Evidence profile: ${base}`);
  } finally {
    await app.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
