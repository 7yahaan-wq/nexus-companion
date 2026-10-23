const { _electron: electron, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Store } = require('../electron/storage/index.cjs');

const root = path.resolve(__dirname, '..');
const base = path.join(root, '.test-data', 'tasks-flow-' + Date.now());
const profile = path.join(base, 'profile');
const codexRoot = path.join(base, 'codex');
const errors = [];
const button = (page, name) => page.getByRole('button', { name, exact: true });
const card = (page, title) => page.locator('.task-card').filter({ has: button(page, title) });
const status = (page, title) => page.getByLabel('任务状态 ' + title, { exact: true });
const search = (page) => page.locator('.search-field input');
const project = (page) => page.getByLabel('项目过滤', { exact: true });
const sort = (page) => page.getByLabel('任务排序', { exact: true });
const fixtures = [
  ['hidden-start', 'Hidden first', 'project-q', 0, 'Low', '2026-10-25'],
  ['visible-a', 'Visible Alpha', 'project-p', 10, 'High', '2026-10-26'],
  ['hidden-mid', 'Hidden middle', 'project-q', 20, 'Medium', '2026-10-27'],
  ['visible-b', 'Visible Beta', 'project-p', 30, 'Low', '2026-10-28'],
  ['hidden-end', 'Hidden last', 'project-q', 40, 'Urgent', '2026-10-29'],
].map(([id, title, project, order, priority, dueDate]) => ({
  id,
  title,
  project,
  order,
  priority,
  dueDate,
  status: 'Planned',
  description: 'Preserve details for ' + id,
  tags: 'controlled-fixture',
  actualTime: 3.5,
  estimatedTime: 45,
  createdAt: '2026-10-20T08:00:00.000Z',
  updatedAt: '2026-10-20T08:00:00.000Z',
  ...(id === 'visible-a' ? { sourceNote: 'source-idea' } : {}),
}));

async function ipc(page, method, ...args) {
  const result = await page.evaluate(({ method, args }) => window.nexus.call(method, ...args), {
    method,
    args,
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.data;
}
const read = (page, kind = 'tasks') => ipc(page, 'list', kind);
const getTask = async (page, id) => (await read(page)).find((task) => task.id === id);
const ordered = (tasks, value = 'Planned') =>
  tasks.filter((task) => task.status === value).sort((a, b) => a.order - b.order);
const withoutOrder = ({ order, ...task }) => task;

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
  await fs.writeFile(path.join(base, name + '.png'), Buffer.from(png, 'base64'));
}
async function installControls(app) {
  await app.evaluate(({ app: electronApp }) => {
    const { createRequire } = process.getBuiltinModule('node:module');
    const requireFromMain = createRequire(electronApp.getAppPath() + '/electron/main.cjs');
    const { handlers } = requireFromMain('./main.cjs');
    const state = {
      moves: [],
      taskSaves: 0,
      officialCalls: 0,
      hold: false,
      failNext: false,
      failRefreshAfterMove: false,
      failTaskListOnce: false,
      pending: [],
    };
    globalThis.__nexusTaskFixture = state;
    const move = handlers.taskMove;
    const save = handlers.save;
    const list = handlers.list;
    handlers.taskMove = async (...args) => {
      state.moves.push(args);
      if (state.hold) await new Promise((resolve) => state.pending.push(resolve));
      if (state.failNext) {
        state.failNext = false;
        throw Error('受控任务移动失败');
      }
      const result = await move(...args);
      if (state.failRefreshAfterMove) {
        state.failRefreshAfterMove = false;
        state.failTaskListOnce = true;
      }
      return result;
    };
    handlers.list = async (kind) => {
      if (kind === 'tasks' && state.failTaskListOnce) {
        state.failTaskListOnce = false;
        throw Error('受控列表刷新失败');
      }
      return list(kind);
    };
    handlers.save = async (kind, ...args) => {
      if (kind === 'tasks') state.taskSaves++;
      return save(kind, ...args);
    };
    for (const method of ['codexQuota', 'codexTaskUsage'])
      handlers[method] = () => {
        state.officialCalls++;
        throw Error('This local task journey must not query an account');
      };
  });
}
async function controlState(app) {
  return app.evaluate(() => {
    const state = globalThis.__nexusTaskFixture;
    return {
      moves: state.moves,
      taskSaves: state.taskSaves,
      officialCalls: state.officialCalls,
      pending: state.pending.length,
    };
  });
}
async function resetCounts(app) {
  await app.evaluate(() => {
    globalThis.__nexusTaskFixture.moves = [];
    globalThis.__nexusTaskFixture.taskSaves = 0;
  });
}
async function launch() {
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
  await installControls(app);
  const page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.waitForLoadState('load');
  await page.waitForFunction(async () =>
    Boolean(window.nexus && (await window.nexus.call('info')).data.ready),
  );
  await page.locator('[data-page="Tasks"]').click();
  return { app, page };
}
async function moveBySelect(page, title, target) {
  await status(page, title).selectOption(target);
  await expect(status(page, title)).toHaveValue(target);
  await expect(status(page, title)).toBeEnabled();
}
async function nativeBefore(page, from, before) {
  await card(page, from).dragTo(card(page, before), {
    sourcePosition: { x: 20, y: 12 },
    targetPosition: { x: 20, y: 12 },
  });
}

(async () => {
  await fs.mkdir(path.join(codexRoot, 'sessions'), { recursive: true });
  for (const id of ['p', 'q', 'empty'])
    await fs.mkdir(path.join(base, 'projects', id), { recursive: true });
  const store = new Store(path.join(profile, 'nexus.sqlite'));
  try {
    await store.save('settings', {
      id: 'appearance',
      onboarded: true,
      language: 'zh-CN',
      theme: 'dark',
      notifications: { completed: false, failed: false, approval: false, calendar: false },
    });
    for (const [id, name] of [
      ['p', 'Project P'],
      ['q', 'Project Q'],
      ['empty', 'Empty project'],
    ])
      await store.save('projects', {
        id: 'project-' + id,
        name,
        projectPath: path.join(base, 'projects', id),
        color: '#a6a2f5',
      });
    await store.save('notes', {
      id: 'source-idea',
      title: 'Sorting source idea',
      content: 'Return to the same task view.',
      project: 'project-p',
    });
  } finally {
    await store.close();
  }

  let { app, page } = await launch();
  try {
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.unmaximize();
      win.setSize(1366, 900);
      win.show();
      win.focus();
    });
    await page.waitForFunction(() => Math.abs(outerWidth - 1366) < 30);
    await expect(page.getByTestId('tasks-empty')).toBeVisible();
    await expect(page.getByTestId('tasks-empty')).toContainText(/任务/);
    await expect(page.locator('.kanban-column')).toHaveCount(0);
    await expect(button(page, '新建任务').first()).toBeEnabled();
    for (const task of fixtures) await ipc(page, 'save', 'tasks', task);
    await page.reload();
    await page.locator('[data-page="Tasks"]').click();
    await expect(page.locator('.task-card')).toHaveCount(fixtures.length);

    // A filtered view must be a safe place to add a task to its selected project.
    await project(page).selectOption('project-p');
    await button(page, '新建任务').click();
    await expect(page.getByLabel('项目', { exact: true })).toHaveValue('project-p');
    await page.getByLabel('任务标题', { exact: true }).fill('Created inside project P');
    await button(page, '保存').click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(card(page, 'Created inside project P')).toBeVisible();
    const created = (await read(page)).find((task) => task.title === 'Created inside project P');
    assert.equal(created.project, 'project-p');

    await search(page).fill('query with no matching task');
    await expect(page.getByTestId('tasks-empty')).toBeVisible();
    await expect(page.getByTestId('tasks-empty')).toContainText(/搜索|筛选|匹配/);
    await expect(page.locator('.kanban-column')).toHaveCount(0);
    await button(page, '清除筛选').click();
    await expect(search(page)).toHaveValue('');
    await expect(project(page)).toHaveValue('');
    await expect(page.locator('.task-card')).toHaveCount(fixtures.length + 1);
    await project(page).selectOption('project-empty');
    await expect(page.getByTestId('tasks-empty')).toBeVisible();
    await expect(page.getByTestId('tasks-empty')).toContainText(/项目|筛选/);
    await button(page, '清除筛选').click();

    // Native drag must make a single structural move, with hidden tasks preserved.
    await project(page).selectOption('project-p');
    await search(page).fill('Visible');
    const beforeDrag = await read(page);
    const hiddenBefore = ordered(beforeDrag).filter((task) => task.id.startsWith('hidden-'));
    const timelineBefore = (await read(page, 'timeline')).length;
    await resetCounts(app);
    await nativeBefore(page, 'Visible Beta', 'Visible Alpha');
    await expect
      .poll(async () =>
        ordered(await read(page))
          .filter((task) => task.project === 'project-p')
          .map((task) => task.id),
      )
      .toEqual(['visible-b', 'visible-a']);
    await expect(status(page, 'Visible Beta')).toBeEnabled();
    const afterDrag = await read(page);
    const planned = ordered(afterDrag);
    assert.equal(
      new Set(planned.map((task) => task.order)).size,
      planned.length,
      'Full-column order values must remain unique',
    );
    assert.ok(planned.every((task) => Number.isFinite(task.order)));
    const hiddenAfter = planned.filter((task) => task.id.startsWith('hidden-'));
    assert.deepEqual(
      hiddenAfter.map((task) => task.id),
      hiddenBefore.map((task) => task.id),
    );
    assert.deepEqual(
      hiddenAfter.map(withoutOrder),
      hiddenBefore.map(withoutOrder),
      'Reordering visible cards must preserve hidden task content',
    );
    assert.equal(
      (await controlState(app)).moves.length,
      1,
      'One native drag must issue exactly one taskMove',
    );
    assert.equal((await controlState(app)).taskSaves, 0, 'Moving must not save every task entity');
    assert.equal(
      (await read(page, 'timeline')).length - timelineBefore,
      1,
      'One move must not create activity for untouched cards',
    );
    await button(page, '清除筛选').click();
    const shownPlanned = await page
      .locator('.kanban-column[data-status="Planned"] .task-title')
      .allTextContents();
    assert.deepEqual(
      shownPlanned,
      planned.map((task) => task.title),
    );
    await capture(app, page, '01-manual-order-hidden-tasks');

    // Pending local write: retain the old state and block competing user actions.
    await resetCounts(app);
    const beforeHeld = await getTask(page, 'visible-a');
    await app.evaluate(() => {
      globalThis.__nexusTaskFixture.hold = true;
    });
    await status(page, 'Visible Alpha').selectOption('In Progress');
    await expect.poll(async () => (await controlState(app)).pending).toBe(1);
    await expect(status(page, 'Visible Alpha')).toHaveValue('Planned');
    for (const element of await page.locator('select[aria-label^="任务状态 "]').all())
      await expect(element).toBeDisabled();
    await expect(project(page)).toBeDisabled();
    await expect(sort(page)).toBeDisabled();
    await expect(search(page)).toBeDisabled();
    await expect(button(page, '新建任务')).toBeDisabled();
    await expect(button(page, 'Visible Beta')).toBeDisabled();
    await expect(card(page, 'Visible Beta')).toHaveAttribute('draggable', 'false');
    assert.deepEqual(await getTask(page, 'visible-a'), beforeHeld);
    await settle(page);
    assert.equal((await controlState(app)).moves.length, 1);
    await app.evaluate(() => {
      const state = globalThis.__nexusTaskFixture;
      state.hold = false;
      for (const resolve of state.pending.splice(0)) resolve();
    });
    await expect(status(page, 'Visible Alpha')).toHaveValue('In Progress');
    await expect(status(page, 'Visible Beta')).toBeEnabled();

    // A rejected request leaves both persisted and visible state unchanged, then retries normally.
    const beforeFailure = await getTask(page, 'visible-a');
    await app.evaluate(() => {
      globalThis.__nexusTaskFixture.failNext = true;
    });
    await status(page, 'Visible Alpha').selectOption('Done');
    await expect(page.locator('.task-move-error[role="alert"]')).toContainText('受控任务移动失败');
    await expect(status(page, 'Visible Alpha')).toBeEnabled();
    await expect(status(page, 'Visible Alpha')).toHaveValue('In Progress');
    assert.deepEqual(await getTask(page, 'visible-a'), beforeFailure);
    await moveBySelect(page, 'Visible Alpha', 'Done');
    const done = await getTask(page, 'visible-a');
    assert.ok(
      Number.isFinite(Date.parse(done.completedAt)),
      'Entering Done records a completion time',
    );
    assert.equal(done.actualTime, 3.5);
    assert.equal(done.project, 'project-p');
    await expect(page.locator('.task-move-error')).toHaveCount(0);
    await capture(app, page, '02-status-update-and-retry');
    const persisted = await read(page);
    assert.equal((await controlState(app)).officialCalls, 0);
    await app.close();
    ({ app, page } = await launch());
    assert.deepEqual(
      await read(page),
      persisted,
      'Ordering and completion must survive a real app restart',
    );
    await expect(status(page, 'Visible Alpha')).toHaveValue('Done');
    await moveBySelect(page, 'Visible Alpha', 'Planned');
    assert.equal(
      (await getTask(page, 'visible-a')).completedAt,
      null,
      'Leaving Done clears completion time',
    );

    // Opening a linked idea and returning must preserve this session's task view.
    await project(page).selectOption('project-p');
    await search(page).fill('Visible');
    await sort(page).selectOption('due');
    await button(page, '来源灵感 Visible Alpha').click();
    await expect(page.locator('.notes-layout .markdown')).toContainText(
      'Return to the same task view.',
    );
    await page.locator('[data-page="Tasks"]').click();
    await expect(project(page)).toHaveValue('project-p');
    await expect(search(page)).toHaveValue('Visible');
    await expect(sort(page)).toHaveValue('due');

    for (const mode of ['due', 'priority']) {
      await sort(page).selectOption(mode);
      await expect(page.getByTestId('task-sort-hint')).toBeVisible();
      await expect(page.getByTestId('task-sort-hint')).toContainText(/状态/);
      const before = await read(page);
      await resetCounts(app);
      await nativeBefore(page, 'Visible Beta', 'Visible Alpha');
      await settle(page);
      assert.deepEqual(
        await read(page),
        before,
        'Same-column drag must not silently change manual order in ' + mode + ' mode',
      );
      assert.equal((await controlState(app)).moves.length, 0);
      assert.equal((await controlState(app)).taskSaves, 0);
    }
    await card(page, 'Visible Beta').dragTo(
      page.locator('.kanban-column[data-status="Waiting"] h3'),
      { sourcePosition: { x: 20, y: 12 }, targetPosition: { x: 20, y: 10 } },
    );
    await expect(status(page, 'Visible Beta')).toHaveValue('Waiting');
    await expect(status(page, 'Visible Beta')).toBeEnabled();
    assert.equal(
      (await getTask(page, 'visible-b')).status,
      'Waiting',
      'Dragging in priority sort changes status without pretending to reorder the column',
    );

    // A committed move whose refresh fails is not a displayed success. Retrying
    // the same target must refresh even when the backend correctly returns no-op.
    const beforeRefreshFailure = (await read(page, 'timeline')).length;
    await resetCounts(app);
    await app.evaluate(() => {
      globalThis.__nexusTaskFixture.failRefreshAfterMove = true;
    });
    await status(page, 'Visible Beta').selectOption('Done');
    await expect(page.locator('.task-move-error[role="alert"]')).toContainText('列表刷新失败');
    await expect(page.locator('.task-move-error[role="alert"]')).toContainText('受控列表刷新失败');
    await expect(status(page, 'Visible Beta')).toBeEnabled();
    await expect(status(page, 'Visible Beta')).toHaveValue('Waiting');
    await expect(page.locator('.task-board-feedback [role="status"]')).not.toContainText(
      '任务已更新',
    );
    const committed = await getTask(page, 'visible-b');
    assert.equal(committed.status, 'Done');
    assert.ok(Number.isFinite(Date.parse(committed.completedAt)));
    assert.equal((await read(page, 'timeline')).length, beforeRefreshFailure + 1);
    await moveBySelect(page, 'Visible Beta', 'Done');
    await expect(page.locator('.task-move-error')).toHaveCount(0);
    assert.deepEqual(await getTask(page, 'visible-b'), committed);
    assert.equal(
      (await read(page, 'timeline')).length,
      beforeRefreshFailure + 1,
      'Retrying a committed move must not duplicate activity',
    );
    assert.equal((await controlState(app)).moves.length, 2);

    // Ordinary page changes retain filters, but explicit quick-task creation
    // must reveal its newly saved task even when it does not match those filters.
    await expect(project(page)).toHaveValue('project-p');
    await expect(search(page)).toHaveValue('Visible');
    await page.keyboard.press('Control+Shift+Space');
    await page.waitForFunction(() => {
      const input = document.querySelector('[aria-label="快速记录内容"]');
      return (
        input &&
        !input.disabled &&
        input === document.activeElement &&
        input.closest('dialog')?.open
      );
    });
    await page.locator('.capture-kind').getByRole('button', { name: '任务', exact: true }).click();
    await page
      .getByLabel('快速记录内容', { exact: true })
      .fill('Explicit quick task outside project');
    await button(page, '保存记录').click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(card(page, 'Explicit quick task outside project')).toBeVisible();
    await expect(project(page)).toHaveValue('');
    await expect(search(page)).toHaveValue('');
    const quickTask = (await read(page)).find(
      (task) => task.title === 'Explicit quick task outside project',
    );
    assert.ok(quickTask && !quickTask.project);

    await page.locator('[data-page="Settings"]').click();
    await page.getByLabel('主题', { exact: true }).selectOption('light');
    await page.getByLabel('Language / 语言', { exact: true }).selectOption('en');
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.unmaximize();
      win.setSize(1060, 760);
    });
    await page.waitForFunction(() => Math.abs(outerWidth - 1060) < 30);
    await page.locator('[data-page="Tasks"]').click();
    await expect(page.locator('.app')).toHaveAttribute('data-theme', 'light');
    await expect(page.getByTestId('task-sort-hint')).toContainText(/status/i);
    await expect(status(page, 'Visible Alpha').locator('option[value="Done"]')).toHaveText('Done');
    await expect(status(page, 'Visible Alpha')).toBeVisible();
    const layout = await page.evaluate(() => ({
      viewport: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      clipped: [...document.querySelectorAll('.task-card select')].some((element) => {
        const box = element.getBoundingClientRect();
        return box.left < 0 || box.right > innerWidth || box.width < 70;
      }),
    }));
    assert.ok(layout.scrollWidth <= layout.viewport + 1 && !layout.clipped, JSON.stringify(layout));
    await capture(app, page, '03-english-light-minimum-window');
    await search(page).fill('no matching English task');
    await expect(page.getByTestId('tasks-empty')).toContainText(/search|filter|match/i);
    await button(page, 'Clear filters').click();
    await expect(page.locator('.task-card')).toHaveCount(fixtures.length + 2);
    assert.equal((await controlState(app)).officialCalls, 0);
    assert.deepEqual(errors, []);
    console.log(
      'PASS tasks flow: scoped creation, empty recovery, single native move, hidden order, busy/failure/retry, committed-refresh recovery, completion/restart, view restoration and explicit capture, sort semantics, English/light/narrow layout',
    );
    console.log('Evidence: ' + base);
  } finally {
    await app.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
