const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { Store } = require('../electron/storage/index.cjs');
const { createBackup, restoreBackup, validateBackup } = require('../electron/services/backup.cjs');
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
