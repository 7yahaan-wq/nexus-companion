const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const testRoot = path.resolve(__dirname, '../.test-data');
async function testDirectory(prefix) {
  await fs.mkdir(testRoot, { recursive: true });
  return fs.mkdtemp(path.join(testRoot, prefix));
}
const { Store } = require('../electron/storage/index.cjs');
const {
  scheduleLocation,
  resolveLocation,
  readLocation,
} = require('../electron/storage/location.cjs');
test('data relocation preserves records, active timer, assets and original; refuses collisions', async () => {
  const base = await testDirectory('location-');
  const source = path.join(base, 'source');
  const parent = path.join(base, 'destination');
  await fs.mkdir(parent);
  const store = new Store(path.join(source, 'nexus.sqlite'));
  await store.save('notes', { id: 'a', title: 'Keep me', content: '中文笔记' });
  await store.save('settings', { id: 'active-focus', deadline: 123 });
  await fs.mkdir(path.join(source, 'assets'));
  await fs.writeFile(path.join(source, 'assets', 'example.txt'), 'asset');
  await assert.rejects(scheduleLocation(source, source, source), /以外/);
  const target = await scheduleLocation(source, source, parent);
  // Writes after scheduling must be included on next start.
  await store.save('tasks', { id: 'later', title: 'Last write', status: 'Inbox' });
  await store.close();
  assert.equal(await resolveLocation(source), target);
  assert.equal(await resolveLocation(source), target);
  const moved = new Store(path.join(target, 'nexus.sqlite'));
  const old = new Store(path.join(source, 'nexus.sqlite'));
  try {
    assert.deepEqual(await moved.snapshot(), await old.snapshot());
    assert.equal(await fs.readFile(path.join(target, 'assets', 'example.txt'), 'utf8'), 'asset');
    assert.equal((await readLocation(source)).pending, undefined);
    await assert.rejects(scheduleLocation(source, source, parent), /已有/);
  } finally {
    await moved.close();
    await old.close();
  }
});
test('failed migration retains source pointer and does not overwrite target', async () => {
  const base = await testDirectory('location-failure-');
  const source = path.join(base, 'source');
  const parent = path.join(base, 'target');
  await fs.mkdir(parent);
  const store = new Store(path.join(source, 'nexus.sqlite'));
  await store.save('notes', { id: 'n', title: 'safe' });
  await store.close();
  const target = await scheduleLocation(source, source, parent);
  await fs.mkdir(target);
  await fs.writeFile(path.join(target, 'sentinel'), 'untouched');
  await assert.rejects(resolveLocation(source), /EEXIST/);
  assert.equal((await readLocation(source)).active, source);
  assert.equal((await readLocation(source)).pending, undefined);
  assert.equal(await fs.readFile(path.join(target, 'sentinel'), 'utf8'), 'untouched');
});
