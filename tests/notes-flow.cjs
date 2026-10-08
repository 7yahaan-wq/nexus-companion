const { _electron: electron } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { Store } = require('../electron/storage/index.cjs');
const root = path.join(__dirname, '..');
const base = path.join(root, '.test-data/notes-flow-' + Date.now());
const errors = [];

async function launch() {
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
  page.on('pageerror', (error) => errors.push(error.message));
  await page.waitForFunction(async () => (await window.nexus.call('info')).data.ready);
  await page.locator('[data-page="Home"]').waitFor();
  return { app, page };
}
const list = async (page, kind) =>
  (await page.evaluate((kind) => window.nexus.call('list', kind), kind)).data;
const button = (page, name) => page.getByRole('button', { name, exact: true });
const closed = (page) => page.waitForFunction(() => !document.querySelector('dialog[open]'));
async function newIdea(page) {
  await page.locator('[data-page="Home"]').click();
  await button(page, '记录灵感').click();
  await page.getByLabel('笔记标题', { exact: true }).waitFor();
  await page.waitForFunction(() => !document.querySelector('.entity-fields').disabled);
}
async function save(page) {
  await button(page, '保存').click();
  await closed(page);
}

(async () => {
  await fs.mkdir(path.join(base, 'codex/sessions'), { recursive: true });
  // Use the same persisted fixture for development and packaged apps. A one-off
  // isVisible check races the asynchronous initial settings/onboarding load.
  const store = new Store(path.join(base, 'profile', 'nexus.sqlite'));
  await store.save('settings', { id: 'appearance', onboarded: true, language: 'zh-CN' });
  await store.close();
  let { app, page: p } = await launch();
  try {
    await newIdea(p);
    assert.equal(
      await p.evaluate(() => document.activeElement?.getAttribute('aria-label')),
      '笔记标题',
    );
    await p.getByLabel('笔记标题', { exact: true }).fill('跨入口草稿');
    await p.getByLabel('内容（Markdown）', { exact: true }).fill('按 Esc 后依然保留的内容');
    await p.keyboard.press('Escape');
    await closed(p);
    await p.locator('[data-page="Notes"]').click();
    await button(p, '新建笔记').click();
    await p.waitForFunction(
      () => document.querySelector('input[aria-label="笔记标题"]')?.value === '跨入口草稿',
    );
    assert.equal(
      await p.getByLabel('内容（Markdown）', { exact: true }).inputValue(),
      '按 Esc 后依然保留的内容',
    );
    await p.getByLabel('内容（Markdown）', { exact: true }).fill('关闭应用时尚未保存的内容');
    await p.waitForFunction(async () =>
      (await window.nexus.call('list', 'settings')).data.some(
        (row) => row.id === 'draft:note:new' && row.value.content === '关闭应用时尚未保存的内容',
      ),
    );
    await app.close();
    ({ app, page: p } = await launch());
    await newIdea(p);
    await p.waitForFunction(
      () =>
        document.querySelector('textarea[aria-label="内容（Markdown）"]')?.value ===
        '关闭应用时尚未保存的内容',
    );
    await button(p, '丢弃草稿').click();
    await closed(p);
    assert.equal(
      (await list(p, 'settings')).some((row) => row.id === 'draft:note:new'),
      false,
    );

    await newIdea(p);
    await p.getByLabel('笔记标题', { exact: true }).fill('原始灵感 A');
    await p.getByLabel('内容（Markdown）', { exact: true }).fill('A 的原始正文');
    await save(p);
    await p.getByRole('heading', { name: '原始灵感 A', exact: true }).waitFor();
    const original = (await list(p, 'notes')).find((note) => note.title === '原始灵感 A');
    await button(p, '编辑').click();
    await p.getByLabel('内容（Markdown）', { exact: true }).fill('A 单独保留的编辑草稿');
    await p.keyboard.press('Escape');
    await closed(p);
    assert.equal(
      (await list(p, 'settings')).find((row) => row.id === `draft:note:${original.id}`).value
        .content,
      'A 单独保留的编辑草稿',
    );

    // Reproduce the old selection bug: keep an old note selected and create through Nia.
    await p.getByLabel('搜索灵感', { exact: true }).fill('原始灵感 A');
    await button(p, 'Nia 快捷操作').click();
    await button(p, '快速笔记').click();
    await p.getByLabel('笔记标题', { exact: true }).fill('X'.repeat(1001));
    await p.getByLabel('内容（Markdown）', { exact: true }).fill('转换任务时保留此正文');
    await p.getByLabel('标签（逗号分隔）', { exact: true }).fill('设计,实现');
    await button(p, '保存').click();
    await p.getByRole('alert').filter({ hasText: '1000' }).waitFor();
    assert.equal(
      await p.getByLabel('内容（Markdown）', { exact: true }).inputValue(),
      '转换任务时保留此正文',
    );
    assert.ok((await list(p, 'settings')).some((row) => row.id === 'draft:note:new'));
    await p.getByLabel('笔记标题', { exact: true }).fill('新灵感 B');
    // Duplicate submit events must not produce duplicate timeline records or save requests.
    await button(p, '保存').evaluate((element) => {
      element.click();
      element.click();
    });
    await closed(p);
    await p.getByRole('heading', { name: '新灵感 B', exact: true }).waitFor();
    assert.equal(await p.getByLabel('搜索灵感', { exact: true }).inputValue(), '');
    const notes = await list(p, 'notes');
    const converted = notes.find((note) => note.title === '新灵感 B');
    assert.ok(converted);
    assert.equal(
      (await list(p, 'timeline')).filter((row) => row.entityId === converted.id).length,
      1,
    );
    const drafts = await list(p, 'settings');
    assert.equal(
      drafts.some((row) => row.id === 'draft:note:new'),
      false,
    );
    assert.ok(drafts.some((row) => row.id === `draft:note:${original.id}`));

    await button(p, '转为任务').click();
    await p.getByLabel('任务标题', { exact: true }).waitFor();
    assert.equal(await p.getByLabel('任务标题', { exact: true }).inputValue(), '新灵感 B');
    const tasks = await list(p, 'tasks');
    const linked = tasks.find((task) => task.sourceNote === converted.id);
    assert.ok(linked);
    assert.equal(linked.description, converted.content);
    assert.equal(linked.tags, converted.tags);
    assert.equal(linked.project, converted.project || '');
    await button(p, '取消').click();
    await closed(p);
    await button(p, '查看关联任务').click();
    await p.getByLabel('任务标题', { exact: true }).waitFor();
    assert.equal(
      (await list(p, 'tasks')).filter((task) => task.sourceNote === converted.id).length,
      1,
    );
    await button(p, '取消').click();
    await closed(p);
    assert.equal((await list(p, 'notes')).length, 2);

    await p.locator('.note-item').filter({ hasText: '原始灵感 A' }).click();
    await button(p, '编辑').click();
    await p.waitForFunction(
      () =>
        document.querySelector('textarea[aria-label="内容（Markdown）"]')?.value ===
        'A 单独保留的编辑草稿',
    );
    await button(p, '丢弃草稿').click();
    await closed(p);
    assert.equal(
      (await list(p, 'notes')).find((note) => note.id === original.id).content,
      'A 的原始正文',
    );
    assert.equal(
      (await list(p, 'settings')).some((row) => row.id.startsWith('draft:note:')),
      false,
    );

    // Invalid imported/corrupted drafts must never change which existing note is saved.
    for (const invalid of [
      { id: converted.id, revision: 'mismatched-note' },
      { id: original.id, revision: '' },
    ]) {
      await p.evaluate(
        ({ original, invalid }) =>
          window.nexus.call('save', 'settings', {
            id: `draft:note:${original.id}`,
            value: { id: invalid.id, title: 'Invalid draft' },
            revision: invalid.revision,
          }),
        { original, invalid },
      );
      await button(p, '编辑').click();
      await p.getByRole('alert').filter({ hasText: '本地草稿无效' }).waitFor();
      assert.ok(await button(p, '保存').isDisabled());
      await p.keyboard.press('Escape');
      await closed(p);
      await p.evaluate(
        (id) => window.nexus.call('delete', 'settings', `draft:note:${id}`),
        original.id,
      );
    }
    assert.equal(
      (await list(p, 'notes')).find((note) => note.id === original.id).content,
      'A 的原始正文',
    );
    assert.equal(
      (await list(p, 'notes')).find((note) => note.id === converted.id).title,
      '新灵感 B',
    );

    // Saving the currently selected note through global search must clear its old title filter.
    await p.getByLabel('搜索灵感', { exact: true }).fill('原始灵感 A');
    await p.keyboard.press('Control+k');
    await p.getByLabel('全局搜索', { exact: true }).fill('原始灵感 A');
    await p.locator('.command-results button').filter({ hasText: '原始灵感 A' }).click();
    await p.getByLabel('笔记标题', { exact: true }).fill('重命名后的灵感 A');
    await save(p);
    await p.getByRole('heading', { name: '重命名后的灵感 A', exact: true }).waitFor();
    assert.equal(await p.getByLabel('搜索灵感', { exact: true }).inputValue(), '');
    assert.equal(
      (await list(p, 'notes')).find((note) => note.id === original.id).title,
      '重命名后的灵感 A',
    );

    // Hotkey capture must accept typing immediately after asynchronous draft restoration.
    await p.keyboard.press('Control+Shift+Space');
    await p.waitForFunction(
      () => document.activeElement?.getAttribute('aria-label') === '快速记录内容',
    );
    await p.keyboard.insertText('键盘直接输入的灵感');
    await p.keyboard.press('Escape');
    await closed(p);
    await p.keyboard.press('Control+Shift+Space');
    await p.waitForFunction(
      () => document.activeElement?.getAttribute('aria-label') === '快速记录内容',
    );
    assert.equal(await p.getByLabel('快速记录内容').inputValue(), '键盘直接输入的灵感');
    await button(p, '保存记录').click();
    await closed(p);
    await p.getByRole('heading', { name: '键盘直接输入的灵感', exact: true }).waitFor();

    // The renderer must also restrict the collection if a local draft was corrupted.
    await p.evaluate(() =>
      window.nexus.call('save', 'settings', {
        id: 'draft:capture',
        revision: 'corrupt-kind',
        value: { id: 'capture-kind-guard', kind: 'settings', text: '恢复为可见灵感' },
      }),
    );
    await p.keyboard.press('Control+Shift+Space');
    await p.waitForFunction(
      () => document.querySelector('[aria-label="快速记录内容"]')?.value === '恢复为可见灵感',
    );
    assert.equal(await button(p, '灵感').getAttribute('aria-pressed'), 'true');
    await button(p, '保存记录').click();
    await closed(p);
    await p.getByRole('heading', { name: '恢复为可见灵感', exact: true }).waitFor();
    assert.ok((await list(p, 'notes')).some((note) => note.id === 'capture-kind-guard'));
    assert.equal(
      (await list(p, 'settings')).some((row) => row.id === 'capture-kind-guard'),
      false,
    );

    // Forms without autosave protect dirty edits but never prompt for untouched forms.
    await p.locator('[data-page="Tasks"]').click();
    await button(p, '新建任务').click();
    await p.keyboard.press('Escape');
    await closed(p);
    await button(p, '新建任务').click();
    await p.getByLabel('任务标题', { exact: true }).fill('明确放弃的任务');
    await p.keyboard.press('Escape');
    await button(p, '继续编辑').waitFor();
    assert.equal(await p.getByLabel('任务标题', { exact: true }).inputValue(), '明确放弃的任务');
    await button(p, '继续编辑').click();
    await p.keyboard.press('Escape');
    await button(p, '放弃修改').click();
    await closed(p);
    assert.equal(
      (await list(p, 'tasks')).some((task) => task.title === '明确放弃的任务'),
      false,
    );
    assert.deepEqual(errors, []);
    console.log(
      'PASS notes flow: cross-entry/restart drafts, explicit discard, failed-save recovery, note selection, linked task without duplicates, dirty-close protection, autofocus and duplicate-submit guard',
    );
  } finally {
    await app.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
