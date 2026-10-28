const { _electron: electron, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Store } = require('../electron/storage/index.cjs');

const root = path.resolve(__dirname, '..');
const base = path.join(root, '.test-data', 'review-navigation-' + Date.now());
const profile = path.join(base, 'profile');
const codexRoot = path.join(base, 'codex');
const exported = path.join(base, 'daily-report.md');
const today = new Date().toLocaleDateString('sv-SE');
function relativeDay(offset) {
  const day = new Date(today + 'T12:00');
  day.setDate(day.getDate() + offset);
  return day.toLocaleDateString('sv-SE');
}
const yesterday = relativeDay(-1);
const unknownDay = relativeDay(-2);
const reflection =
  'REVIEW TODAY: finished the local workflow.\nNext first step: verify the export boundary.';
const yesterdayReflection =
  'REVIEW YESTERDAY: kept a separate plan.\nYesterday only: investigate the oldest task.';
const retryReflection =
  'REVIEW RETRY: keep this draft after a failed save.\nNext: retry the same daily report entry.';
const errors = [];
const checks = [];
const screenshots = [];
const button = (page, name) => page.getByRole('button', { name, exact: true });
const dateInput = (page) => page.getByLabel('动态日期', { exact: true });
const report = (page) => page.getByTestId('daily-report');
const copy = (page) =>
  page.getByRole('button', { name: /^(复制 Markdown|已复制|Copy Markdown|Copied)$/ });
const exportButton = (page) =>
  page.getByRole('button', { name: /^(导出 Markdown|Export Markdown)$/ });
const projectFilter = (page) => page.getByLabel('项目过滤', { exact: true });
const search = (page) => page.locator('.search-field input');

async function ipc(page, method, ...args) {
  const result = await page.evaluate(({ method, args }) => window.nexus.call(method, ...args), {
    method,
    args,
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.data;
}
const read = (page, kind) => ipc(page, 'list', kind);
async function settle(page) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}
async function capture(app, page, name) {
  await settle(page);
  const png = await app.evaluate(async ({ BrowserWindow }) =>
    (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'),
  );
  const destination = path.join(base, name + '.png');
  await fs.writeFile(destination, Buffer.from(png, 'base64'));
  screenshots.push(destination);
}
async function control(app, values) {
  await app.evaluate((_, patch) => Object.assign(globalThis.__reviewNavigation, patch), values);
}
async function state(app) {
  return app.evaluate(() => {
    const value = globalThis.__reviewNavigation;
    return {
      pendingLoads: value.pendingLoads.length,
      pendingSaves: value.pendingSaves.length,
      finishedLoads: value.finishedLoads,
      officialCalls: value.officialCalls,
      saveAttempts: value.saveAttempts,
    };
  });
}
async function releaseLoad(app, index) {
  await app.evaluate((_, index) => {
    const resolve = globalThis.__reviewNavigation.pendingLoads[index];
    if (!resolve) throw Error('Missing controlled load ' + index);
    resolve();
  }, index);
}
async function releaseSaves(app) {
  await app.evaluate(() => {
    const fixture = globalThis.__reviewNavigation;
    fixture.holdSaves = false;
    for (const resolve of fixture.pendingSaves.splice(0)) resolve();
  });
}
async function installControls(app) {
  await app.evaluate(({ app: electronApp, dialog }, destination) => {
    const { createRequire } = process.getBuiltinModule('node:module');
    const requireFromMain = createRequire(electronApp.getAppPath() + '/electron/main.cjs');
    const { handlers } = requireFromMain('./main.cjs');
    const fixture = {
      holdLoads: false,
      holdSaves: false,
      failLoads: false,
      failSaves: false,
      pendingLoads: [],
      pendingSaves: [],
      finishedLoads: 0,
      officialCalls: 0,
      saveAttempts: 0,
    };
    globalThis.__reviewNavigation = fixture;
    const list = handlers.list;
    handlers.list = async (kind) => {
      if (kind !== 'settings') return list(kind);
      if (fixture.failLoads) throw Error('受控日报读取失败');
      // Read before holding so a delayed reply is a real older snapshot.
      const rows = await list(kind);
      if (fixture.holdLoads) {
        await new Promise((resolve) => fixture.pendingLoads.push(resolve));
        fixture.finishedLoads++;
      }
      return rows;
    };
    const save = handlers.save;
    handlers.save = async (kind, value, ...args) => {
      if (kind === 'settings' && value?.id?.startsWith('daily-plan:')) {
        fixture.saveAttempts++;
        if (fixture.holdSaves) await new Promise((resolve) => fixture.pendingSaves.push(resolve));
        if (fixture.failSaves) throw Error('受控日报保存失败');
      }
      return save(kind, value, ...args);
    };
    for (const method of ['codexQuota', 'codexTaskUsage'])
      handlers[method] = () => {
        fixture.officialCalls++;
        throw Error('The daily review journey must not query an account');
      };
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: destination });
  }, exported);
}
async function installClipboard(page) {
  await page.evaluate(() => {
    window.__reviewCopies = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__reviewCopies.push(text);
        },
      },
    });
  });
}
async function reportReady(page, day, text) {
  await expect(dateInput(page)).toHaveValue(day);
  await expect(page.getByTestId('report-loading')).toHaveCount(0);
  await expect(page.getByTestId('report-error')).toHaveCount(0);
  await expect(report(page)).toContainText(day);
  if (text) for (const line of text.split('\n')) await expect(report(page)).toContainText(line);
  await expect(copy(page)).toBeEnabled();
  await expect(exportButton(page)).toBeEnabled();
}
async function reportUnavailable(page, kind) {
  await expect(page.getByTestId(kind)).toBeVisible();
  await expect(copy(page)).toBeDisabled();
  await expect(exportButton(page)).toBeDisabled();
}
async function seed() {
  await fs.mkdir(path.join(codexRoot, 'sessions'), { recursive: true });
  const store = new Store(path.join(profile, 'nexus.sqlite'));
  try {
    await store.save('settings', {
      id: 'appearance',
      onboarded: true,
      language: 'zh-CN',
      theme: 'dark',
      notifications: {
        completed: false,
        failed: false,
        approval: false,
        calendar: false,
        focus: false,
      },
    });
    for (const [id, name] of [
      ['p', 'Review Project P'],
      ['q', 'Review Project Q'],
      ['empty', 'Empty review project'],
    ]) {
      const projectPath = path.join(base, 'projects', id);
      await fs.mkdir(projectPath, { recursive: true });
      await store.save('projects', { id: 'project-' + id, name, projectPath, color: '#a6a2f5' });
    }
    for (let index = 0; index < 9; index++)
      await store.save('tasks', {
        id: 'review-task-' + index,
        title: 'Review task ' + (index + 1),
        project: 'project-p',
        status: index === 3 ? 'Done' : 'Planned',
        priority: 'Medium',
        dueDate: today,
        estimatedTime: 30 + index,
        order: index,
        description: 'Preserve original details ' + index,
        createdAt: new Date(Date.now() - 100000 - index * 1000).toISOString(),
        updatedAt: new Date(Date.now() - index * 1000).toISOString(),
        ...(index === 3 ? { completedAt: new Date().toISOString() } : {}),
      });
    await store.save('tasks', {
      id: 'other-project-task',
      title: 'Other project visible only in all tasks',
      project: 'project-q',
      status: 'Planned',
      priority: 'Medium',
      dueDate: today,
      order: 10,
    });
    await store.save('settings', {
      id: 'daily-plan:' + today,
      date: today,
      topTaskIds: ['review-task-0', 'review-task-1', 'review-task-2'],
      capacityMinutes: 137,
      startedAt: new Date().toISOString(),
      closedAt: null,
      reflection: '',
    });
    await store.save('settings', {
      id: 'daily-plan:' + yesterday,
      date: yesterday,
      topTaskIds: ['review-task-8'],
      capacityMinutes: 83,
      startedAt: yesterday + 'T09:00:00',
      closedAt: yesterday + 'T18:00:00',
      reflection: yesterdayReflection,
    });
  } finally {
    await store.close();
  }
}

(async () => {
  await seed();
  const app = await electron.launch({
    ...(process.env.NEXUS_PACKAGED_EXE
      ? { executablePath: process.env.NEXUS_PACKAGED_EXE, args: [] }
      : { args: [root] }),
    env: {
      ...process.env,
      NEXUS_TEST_MODE: '1',
      NEXUS_DATA_DIR: profile,
      CODEX_HOME: codexRoot,
      NEXUS_DEV_URL: '',
    },
  });
  let completed = false;
  try {
    await installControls(app);
    const page = await app.firstWindow();
    page.setDefaultTimeout(15000);
    page.on('pageerror', (error) => errors.push(error.message));
    await page.waitForLoadState('load');
    await page.waitForFunction(async () =>
      Boolean(window.nexus && (await window.nexus.call('info')).data.ready),
    );
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.unmaximize();
      win.setSize(1366, 900);
      win.show();
      win.focus();
    });
    await installClipboard(page);
    await button(page, '每日计划与回顾').click();
    const reflectionInput = page.getByLabel('今天的收获 / 下次第一步', { exact: true });
    await expect(reflectionInput).toHaveValue('');

    // The latest keystrokes must be committed before a report opens, even when
    // the user's next click arrives while the automatic write is still pending.
    await control(app, { holdSaves: true });
    await reflectionInput.fill(reflection);
    await button(page, '查看日报 ↗').click();
    await expect.poll(async () => (await state(app)).pendingSaves).toBeGreaterThan(0);
    await expect(page.getByLabel('每日计划', { exact: true })).toBeVisible();
    await expect(report(page)).toHaveCount(0);
    await releaseSaves(app);
    await reportReady(page, today, reflection);
    await expect(page.locator('.segmented .active')).toHaveText('每日总结');
    for (const title of ['Review task 1', 'Review task 2', 'Review task 3'])
      await expect(report(page)).toContainText(title);
    await expect(report(page)).toContainText('137');
    assert.equal(
      (await read(page, 'settings')).find((value) => value.id === 'daily-plan:' + today).reflection,
      reflection,
    );
    await copy(page).click();
    const markdown = await page.evaluate(() => window.__reviewCopies.at(-1));
    assert.ok(
      markdown.includes(reflection),
      'Copied review must preserve the exact multiline input',
    );
    await exportButton(page).click();
    await expect.poll(async () => fs.readFile(exported, 'utf8').catch(() => null)).toBe(markdown);
    checks.push(
      'Latest Home draft is persisted before direct daily-report navigation; copy equals actual exported file, with exact multiline reflection and three priorities/budget.',
    );

    await dateInput(page).fill(yesterday);
    await reportReady(page, yesterday, yesterdayReflection);
    await expect(report(page)).toContainText('Review task 9');
    await expect(report(page)).toContainText('83');
    await expect(report(page)).not.toContainText('REVIEW TODAY');
    await dateInput(page).fill(unknownDay);
    await reportReady(page, unknownDay);
    await expect(report(page)).toContainText(/未记录|未保存|没有.*计划|No .*plan/i);
    await expect(report(page)).not.toContainText('REVIEW TODAY');
    await expect(report(page)).not.toContainText('REVIEW YESTERDAY');
    await dateInput(page).fill(today);
    await reportReady(page, today, reflection);

    // Resolve an obsolete request first, then a newer one. Loading must remain
    // honest and stale content must never be offered for copying or exporting.
    await control(app, { holdLoads: true, pendingLoads: [], finishedLoads: 0 });
    await dateInput(page).fill(yesterday);
    await expect.poll(async () => (await state(app)).pendingLoads).toBe(1);
    await reportUnavailable(page, 'report-loading');
    await dateInput(page).fill(today);
    await expect.poll(async () => (await state(app)).pendingLoads).toBe(2);
    await releaseLoad(app, 0);
    await expect.poll(async () => (await state(app)).finishedLoads).toBe(1);
    await settle(page);
    await reportUnavailable(page, 'report-loading');
    await releaseLoad(app, 1);
    await control(app, { holdLoads: false });
    await reportReady(page, today, reflection);
    await expect(report(page)).not.toContainText('REVIEW YESTERDAY');

    // Also finish the current date first, then the obsolete response last.
    await control(app, { holdLoads: true, pendingLoads: [], finishedLoads: 0 });
    await dateInput(page).fill(yesterday);
    await expect.poll(async () => (await state(app)).pendingLoads).toBe(1);
    await dateInput(page).fill(today);
    await expect.poll(async () => (await state(app)).pendingLoads).toBe(2);
    await releaseLoad(app, 1);
    await reportReady(page, today, reflection);
    await releaseLoad(app, 0);
    await expect.poll(async () => (await state(app)).finishedLoads).toBe(2);
    await control(app, { holdLoads: false });
    await settle(page);
    await reportReady(page, today, reflection);
    await expect(report(page)).not.toContainText('REVIEW YESTERDAY');

    await control(app, { failLoads: true });
    await dateInput(page).fill(yesterday);
    await reportUnavailable(page, 'report-error');
    await expect(page.getByTestId('report-error')).toContainText('受控日报读取失败');
    await control(app, { failLoads: false });
    await button(page, '重试读取').click();
    await reportReady(page, yesterday, yesterdayReflection);
    checks.push(
      'Date-specific reviews/budgets, explicit missing-plan state, both response-order races, disabled actions on loading/error and successful read retry.',
    );

    await page.locator('[data-page="Home"]').click();
    await button(page, '每日计划与回顾').click();
    await expect(reflectionInput).toHaveValue(reflection);
    await control(app, { failSaves: true });
    await reflectionInput.fill(retryReflection);
    await button(page, '查看日报 ↗').click();
    await expect(page.getByText('受控日报保存失败', { exact: false }).first()).toBeVisible();
    await expect(reflectionInput).toHaveValue(retryReflection);
    await expect(report(page)).toHaveCount(0);
    assert.equal(
      (await read(page, 'settings')).find((value) => value.id === 'daily-plan:' + today).reflection,
      reflection,
    );
    await control(app, { failSaves: false });
    await button(page, '查看日报 ↗').click();
    await reportReady(page, today, retryReflection);
    checks.push(
      'Failed save retains Home and the draft; the same report entry retries without silently exporting unsaved content.',
    );

    // A deliberate project entry replaces conflicting filters, then exposes
    // old and completed tasks without changing their stored project or details.
    await page.locator('[data-page="Tasks"]').click();
    await projectFilter(page).selectOption('project-q');
    await search(page).fill('stale keyword with no match');
    await page.locator('[data-page="Projects"]').click();
    await button(page, 'Review Project P').click();
    const detail = page.locator('.project-detail');
    await expect(detail).toBeVisible();
    await detail.getByRole('button', { name: '查看全部任务（9）', exact: true }).click();
    await expect(projectFilter(page)).toHaveValue('project-p');
    await expect(search(page)).toHaveValue('');
    await expect(page.locator('.task-card')).toHaveCount(9);
    await expect(button(page, 'Review task 4')).toBeVisible();
    await button(page, 'Review task 9').click();
    const dialog = page.locator('dialog[open]');
    await expect(dialog.getByLabel('任务标题', { exact: true })).toHaveValue('Review task 9');
    await expect(dialog.getByLabel('项目', { exact: true })).toHaveValue('project-p');
    await dialog.getByLabel('任务标题', { exact: true }).fill('Review task 9 updated');
    await dialog.getByRole('button', { name: '保存', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(button(page, 'Review task 9 updated')).toBeVisible();
    const edited = (await read(page, 'tasks')).find((task) => task.id === 'review-task-8');
    assert.equal(edited.title, 'Review task 9 updated');
    assert.equal(edited.project, 'project-p');
    assert.equal(edited.description, 'Preserve original details 8');

    await page.locator('[data-page="Projects"]').click();
    await button(page, 'Empty review project').click();
    await detail.getByRole('button', { name: '查看全部任务（0）', exact: true }).click();
    await expect(projectFilter(page)).toHaveValue('project-empty');
    await expect(page.locator('.task-card')).toHaveCount(0);
    await button(page, '新建任务').click();
    await expect(dialog.getByLabel('项目', { exact: true })).toHaveValue('project-empty');
    await dialog.getByLabel('任务标题', { exact: true }).fill('First task in empty project');
    await dialog.getByRole('button', { name: '保存', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(button(page, 'First task in empty project')).toBeVisible();
    assert.equal(
      (await read(page, 'tasks')).find((task) => task.title === 'First task in empty project')
        .project,
      'project-empty',
    );
    await page.locator('[data-page="Projects"]').click();
    await button(page, 'Empty review project').click();
    await expect(
      detail.getByRole('button', { name: '查看全部任务（1）', exact: true }),
    ).toBeVisible();
    await page.locator('[data-page="Home"]').click();
    await button(page, '查看全部任务').click();
    await expect(projectFilter(page)).toHaveValue('');
    await expect(search(page)).toHaveValue('');
    await expect(page.locator('.task-card')).toHaveCount(11);
    await expect(button(page, 'Other project visible only in all tasks')).toBeVisible();
    checks.push(
      'Project count/complete navigation clears stale filters, edits the ninth task, supports empty-project creation and fresh counts; Home all-tasks clears project filtering.',
    );

    await page.locator('[data-page="Settings"]').click();
    await page.getByLabel('主题', { exact: true }).selectOption('light');
    await page.getByLabel('Language / 语言', { exact: true }).selectOption('en');
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.unmaximize();
      win.setSize(1060, 760);
    });
    await page.waitForFunction(() => Math.abs(outerWidth - 1060) < 30);
    await page.locator('[data-page="Home"]').click();
    await button(page, 'View daily report ↗').click();
    await reportReady(page, today, retryReflection);
    await expect(button(page, 'Copy Markdown')).toBeVisible();
    await expect(button(page, 'Export Markdown')).toBeVisible();
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      'English report fits the minimum window width',
    );
    await capture(app, page, '01-report-en-light-narrow');
    await page.locator('[data-page="Projects"]').click();
    await button(page, 'Review Project P').click();
    await expect(
      detail.getByRole('button', { name: 'View all tasks (9)', exact: true }),
    ).toBeVisible();
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      'English project detail fits the minimum window width',
    );
    await capture(app, page, '02-project-en-light-narrow');
    await detail.getByRole('button', { name: 'View all tasks (9)', exact: true }).click();
    await expect(projectFilter(page)).toHaveValue('project-p');
    await expect(button(page, 'Review task 9 updated')).toBeVisible();
    checks.push(
      'English/light/minimum-width report and project entry remain usable; two screenshots retained for actual visual inspection.',
    );
    assert.deepEqual(errors, []);
    assert.equal((await state(app)).officialCalls, 0);
    completed = true;
    console.log(
      'PASS daily review/report persistence, isolation, response ordering, error recovery and complete project task navigation',
    );
    console.log('Evidence: ' + base);
  } finally {
    await app.close();
    await fs.writeFile(
      path.join(base, 'result.json'),
      JSON.stringify(
        { completed, checks, errors, screenshots, exported, electronClosed: true },
        null,
        2,
      ),
    );
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
