const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { Store } = require('../electron/storage/index.cjs');
const { createBackup, restoreBackup, validateBackup } = require('../electron/services/backup.cjs');
test('malformed imported drafts cannot overwrite another note or omit revision ownership', () => {
  const { checksum } = require('../electron/services/backup.cjs');
  for (const value of [
    { id: 'draft:note:a', value: { id: 'b', title: 'Wrong target' }, revision: 'r1' },
    { id: 'draft:note:new', value: { id: 'a' }, revision: '' },
    {
      id: 'draft:capture',
      value: { id: 'a', kind: 'settings', text: 'Misrouted capture' },
      revision: 'r1',
    },
    {
      id: 'draft:capture',
      value: { id: 'a', kind: 'notes', text: { unexpected: true } },
      revision: 'r1',
    },
  ]) {
    const data = { records: [{ kind: 'settings', value }], assets: {} };
    assert.throws(
      () =>
        validateBackup({
          format: 'nexus-companion-backup',
          version: 1,
          data,
          sha256: checksum(data),
        }),
      /草稿/,
    );
  }
});
test('backup keeps daily plans and drafts but excludes active timer and connection credentials', async () => {
  const root = path.join(__dirname, '../.test-data/backup-workflow-' + Date.now());
  const source = new Store(path.join(root, 'source.sqlite'));
  const dest = new Store(path.join(root, 'dest.sqlite'));
  try {
    await source.save('settings', {
      id: 'daily-plan:2026-10-08',
      date: '2026-10-08',
      topTaskIds: ['a'],
      capacityMinutes: 120,
    });
    await source.save('settings', {
      id: 'draft:note:new',
      value: { id: 'draft-id', title: '未保存', content: '保留草稿' },
      revision: 'r1',
      updatedAt: new Date().toISOString(),
    });
    await source.save('settings', { id: 'capture-preferences', kind: 'notes' });
    await source.save('settings', {
      id: 'draft:capture',
      value: { id: 'capture-draft', kind: 'tasks', text: '恢复后继续记录' },
      revision: 'r2',
    });
    await source.save('settings', { id: 'active-focus', session: { id: 'running' } });
    await source.save('settings', { id: 'codex-connection', directory: 'private' });
    const bundle = await createBackup(source, path.join(root, 'assets'));
    await restoreBackup(dest, bundle, path.join(root, 'assets'));
    const rows = await dest.list('settings');
    assert.deepEqual(rows.map((r) => r.id).sort(), [
      'capture-preferences',
      'daily-plan:2026-10-08',
      'draft:capture',
      'draft:note:new',
    ]);
    assert.equal(rows.find((r) => r.id === 'draft:note:new').value.content, '保留草稿');
    assert.equal(rows.find((r) => r.id === 'draft:capture').value.text, '恢复后继续记录');
  } finally {
    await source.close();
    await dest.close();
  }
});
test('backup checksum, transaction restore and integrity preserve existing unrelated data', async () => {
  const root = path.join(__dirname, '../.test-data/backup-' + Date.now());
  const source = new Store(path.join(root, 'source.sqlite')),
    dest = new Store(path.join(root, 'dest.sqlite'));
  try {
    await source.save('tasks', { id: 'a', title: 'Preserve me', status: 'Planned' });
    const bundle = await createBackup(source, path.join(root, 'assets'));
    await dest.save('notes', { id: 'existing', title: 'Keep existing note' });
    await restoreBackup(dest, bundle, path.join(root, 'assets'));
    assert.equal((await dest.list('tasks'))[0].title, 'Preserve me');
    assert.equal((await dest.list('notes')).length, 1);
    assert.equal((await dest.integrity()).quick_check, 'ok');
    bundle.data.records[0].value.title = 'Tampered';
    assert.throws(() => validateBackup(bundle), /校验失败/);
  } finally {
    await source.close();
    await dest.close();
  }
});
