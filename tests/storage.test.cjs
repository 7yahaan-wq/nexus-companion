const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Store } = require('../electron/storage/index.cjs');
test('SQLite persists CRUD across restarts and rejects invalid collection', async () => {
  const file = path.join(__dirname, '../.test-data', `store-${Date.now()}.sqlite`);
  let s = new Store(file);
  try {
    await s.save('tasks', { id: 'one', title: '真实持久化' });
    assert.equal((await s.list('tasks'))[0].title, '真实持久化');
    await assert.rejects(s.list('bad'));
    await s.close();
    s = new Store(file);
    assert.equal((await s.list('tasks')).length, 1);
    await s.delete('tasks', 'one');
    assert.deepEqual(await s.list('tasks'), []);
  } finally {
    await s.close();
  }
});
