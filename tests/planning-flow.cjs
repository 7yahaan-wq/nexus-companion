const { _electron: electron, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const base = path.join(root, '.test-data', 'planning-flow-' + Date.now());
const profile = path.join(base, 'profile');
const projectPath = path.join(base, 'project');
const codexPath = path.join(base, 'codex');
const dayKey = (date) => date.toLocaleDateString('sv-SE');
const dateInput = (date) =>
  `${dayKey(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
async function launch() {
  return electron.launch({
    ...(process.env.NEXUS_PACKAGED_EXE
      ? { executablePath: process.env.NEXUS_PACKAGED_EXE, args: [] }
      : { args: [root] }),
    env: { ...process.env, NEXUS_DATA_DIR: profile, CODEX_HOME: codexPath },
  });
}
async function capture(app, name) {
  const page = await app.firstWindow();
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  const data = await app.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    win.show();
    win.focus();
    return (await win.webContents.capturePage()).toPNG().toString('base64');
  });
  await fs.writeFile(path.join(base, name + '.png'), Buffer.from(data, 'base64'));
}
(async () => {
  await fs.mkdir(projectPath, { recursive: true });
  await fs.mkdir(path.join(codexPath, 'sessions'), { recursive: true });
  const now = new Date();
  const today = dayKey(now);
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(now.getDate() - 1);
  const yesterday = dayKey(yesterdayDate);
  const futureDate = new Date(now);
  futureDate.setDate(now.getDate() + 3);
  const future = dayKey(futureDate);
  const tasks = [
    {
      id: 'overdue',
      title: 'Yesterday still matters',
      status: 'Planned',
      dueDate: yesterday,
      estimatedTime: 60,
      project: 'project',
    },
    {
      id: 'today',
      title: 'Plan today',
      status: 'Planned',
      dueDate: today,
      estimatedTime: 45,
      project: 'project',
    },
    {
      id: 'priority',
      title: 'Undated priority',
      status: 'Inbox',
      estimatedTime: 30,
      project: 'project',
    },
    { id: 'fourth', title: 'Fourth choice', status: 'Inbox', estimatedTime: 15 },
    { id: 'future', title: 'Future not yet', status: 'Planned', dueDate: future },
    { id: 'done', title: 'Finished yesterday', status: 'Done', dueDate: yesterday },
  ];
  const errors = [];
  let app = await launch();
  try {
    let page = await app.firstWindow();
    page.on('pageerror', (error) => errors.push(error.message));
    page.setDefaultTimeout(12000);
    await page.waitForFunction(() => Boolean(window.nexus));
    const fixtures = [
      ['settings', { id: 'appearance', onboarded: true, language: 'zh-CN' }],
      [
        'settings',
        {
          id: 'daily-plan:' + yesterday,
          date: yesterday,
          topTaskIds: ['priority'],
          capacityMinutes: 240,
          closedAt: yesterday + 'T19:00:00',
          reflection: 'Yesterday review',
        },
      ],
      ['projects', { id: 'project', name: 'Planning fixture', projectPath, color: '#a6a2f5' }],
      [
        'notes',
        {
          id: 'project-note',
          title: 'Linked idea',
          content: 'A place to resume',
          project: 'project',
        },
      ],
      ...tasks.map((task) => ['tasks', task]),
      [
        'events',
        {
          id: 'next',
          title: 'Next design block',
          start: dateInput(new Date(now.getTime() + 30 * 60000)),
          end: dateInput(new Date(now.getTime() + 60 * 60000)),
          type: 'Work',
        },
      ],
    ];
    await page.evaluate(async (rows) => {
      for (const [kind, value] of rows) {
        const result = await window.nexus.call('save', kind, value);
        if (!result.ok) throw Error(result.error);
      }
    }, fixtures);
    await page.reload();
    await page
      .locator('.today-work')
      .getByRole('button', { name: 'Yesterday still matters', exact: false })
      .first()
      .waitFor();
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.unmaximize();
      win.setSize(1366, 900);
      win.show();
      win.focus();
    });
    await page.waitForFunction(() => Math.abs(window.outerWidth - 1366) < 30);
    await page.evaluate(() => window.scrollTo(0, 0));
    const positions = await page.evaluate(() => ({
      height: innerHeight,
      tasks: document.querySelector('.today-work').getBoundingClientRect().top,
      next: document.querySelector('.next-agenda').getBoundingClientRect().top,
      firstTask: document.querySelector('.home-task').getBoundingClientRect().bottom,
      agents: document.querySelector('.home-agents').getBoundingClientRect().top,
    }));
    assert.ok(positions.firstTask < positions.height, JSON.stringify(positions));
    assert.ok(
      positions.next < positions.height && positions.tasks < positions.agents,
      JSON.stringify(positions),
    );
    await expect(page.locator('.today-work')).not.toContainText('Finished yesterday');
    await expect(page.locator('.today-work')).not.toContainText('Future not yet');
    await expect(page.locator('.next-agenda')).toContainText('Next design block');
    await capture(app, '01-home-work-first');
    const read = async (kind) =>
      (await page.evaluate((k) => window.nexus.call('list', k), kind)).data;
    assert.equal((await read('tasks')).find((task) => task.id === 'overdue').dueDate, yesterday);
    await page.getByRole('button', { name: '开始今天', exact: true }).click();
    await page.getByLabel('每日计划', { exact: true }).waitFor();
    await expect
      .poll(() => page.locator('.daily-planning').evaluate((el) => el.getBoundingClientRect().top))
      .toBeLessThan(100);
    await expect(page.locator('.leftover-row')).toHaveCount(2);
    for (const id of ['overdue', 'today', 'priority']) {
      await page.getByLabel('加入今日重点', { exact: true }).selectOption(id);
      await expect
        .poll(async () =>
          (
            (await read('settings')).find((setting) => setting.id === 'daily-plan:' + today)
              ?.topTaskIds || []
          ).includes(id),
        )
        .toBe(true);
    }
    await expect(page.getByLabel('加入今日重点', { exact: true })).toBeDisabled();
    await page.getByLabel('今天可专注的分钟数', { exact: true }).fill('90');
    await expect(page.locator('.daily-planning')).toContainText('超过今天的余量了');
    await page
      .getByLabel('今天的收获 / 下次第一步', { exact: true })
      .fill('Next: verify the movement feel');
    // No explicit Save: a normal navigation must retain the latest typed review.
    await page.locator('[data-page="Tasks"]').click();
    await page.locator('[data-page="Home"]').click();
    await page.getByRole('button', { name: '每日计划与回顾', exact: true }).click();
    await expect(page.getByLabel('今天的收获 / 下次第一步', { exact: true })).toHaveValue(
      'Next: verify the movement feel',
    );
    await expect(page.getByLabel('今天可专注的分钟数', { exact: true })).toHaveValue('90');
    await page.getByRole('button', { name: '收工并保存', exact: true }).click();
    await expect(page.getByRole('button', { name: '重新开工', exact: true })).toBeVisible();
    let plan = (await read('settings')).find((setting) => setting.id === 'daily-plan:' + today);
    assert.deepEqual(plan.topTaskIds, ['overdue', 'today', 'priority']);
    assert.equal(plan.capacityMinutes, 90);
    assert.ok(plan.startedAt && plan.closedAt);
    assert.equal(plan.reflection, 'Next: verify the movement feel');
    assert.equal((await read('tasks')).find((task) => task.id === 'overdue').dueDate, yesterday);
    assert.equal((await read('tasks')).find((task) => task.id === 'priority').status, 'Inbox');
    await capture(app, '02-plan-and-review');
    await page
      .getByRole('button', { name: '移到今天：Yesterday still matters', exact: true })
      .click();
    await expect
      .poll(async () => (await read('tasks')).find((task) => task.id === 'overdue').dueDate)
      .toBe(today);
    await page.locator('[data-page="Projects"]').click();
    await page.getByRole('button', { name: 'Planning fixture', exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const detail = document.querySelector('.project-detail');
          const step = document.querySelector('.project-next-step textarea');
          return (
            !!detail &&
            !!step &&
            detail.getBoundingClientRect().top >= 0 &&
            step.getBoundingClientRect().bottom < innerHeight
          );
        }),
      )
      .toBe(true);
    await page
      .getByLabel('下次第一步', { exact: true })
      .fill('Tune acceleration before adding effects');
    await page.locator('[data-page="Home"]').click();
    await page.locator('[data-page="Projects"]').click();
    await page.getByRole('button', { name: 'Planning fixture', exact: true }).click();
    await expect(page.getByLabel('下次第一步', { exact: true })).toHaveValue(
      'Tune acceleration before adding effects',
    );
    await expect(page.locator('.project-links')).toContainText('Linked idea');
    await page
      .locator('.project-links')
      .getByRole('button', { name: 'Linked idea', exact: true })
      .click();
    await expect(page.locator('.notes-layout .markdown')).toContainText('A place to resume');
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    page.on('pageerror', (error) => errors.push(error.message));
    page.setDefaultTimeout(12000);
    await page.getByRole('button', { name: '每日计划与回顾', exact: true }).click();
    await expect(page.getByLabel('今天的收获 / 下次第一步', { exact: true })).toHaveValue(
      'Next: verify the movement feel',
    );
    await expect(page.getByRole('button', { name: '重新开工', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '重新开工', exact: true }).click();
    await expect
      .poll(
        async () =>
          (await read('settings')).find((setting) => setting.id === 'daily-plan:' + today)
            ?.closedAt,
      )
      .toBe(null);
    // A deleted priority must free its slot rather than strand an invisible selection.
    await page.evaluate(() => window.nexus.call('delete', 'tasks', 'priority'));
    await page.reload();
    await page.getByRole('button', { name: '每日计划与回顾', exact: true }).click();
    await expect(page.getByLabel('加入今日重点', { exact: true })).toBeEnabled();
    await page.getByLabel('加入今日重点', { exact: true }).selectOption('fourth');
    await expect
      .poll(
        async () =>
          (await read('settings')).find((setting) => setting.id === 'daily-plan:' + today)
            ?.topTaskIds,
      )
      .toEqual(['overdue', 'today', 'fourth']);
    await page.locator('[data-page="Projects"]').click();
    await page.getByRole('button', { name: 'Planning fixture', exact: true }).click();
    await expect(page.getByLabel('下次第一步', { exact: true })).toHaveValue(
      'Tune acceleration before adding effects',
    );
    await capture(app, '03-project-resume');
    await page.locator('[data-page="Home"]').click();
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.unmaximize();
      win.setSize(1060, 720);
      win.show();
      win.focus();
    });
    await page.waitForFunction(() => Math.abs(window.outerWidth - 1060) < 30);
    await page.evaluate(() => window.scrollTo(0, 0));
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      'No horizontal overflow at minimum window size',
    );
    await capture(app, '04-home-minimum-window');
    assert.deepEqual(errors, []);
    console.log(
      'PASS planning workflow: visible overdue/next-event, no silent reschedule, three priorities/capacity, start/close/reopen persistence, project next-step and linked idea navigation',
    );
    console.log('Evidence: ' + base);
  } finally {
    await app.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
