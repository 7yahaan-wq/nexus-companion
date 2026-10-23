const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { Store } = require('../electron/storage/index.cjs');

async function fixture(t, tasks) {
  const file = path.join(__dirname, '../.test-data', `task-move-${randomUUID()}.sqlite`);
  let store = new Store(file);
  t.after(() => store.close());
  for (const task of tasks)
    await store.save('tasks', {
      title: task.id,
      status: 'Planned',
      updatedAt: '2026-10-01T00:00:00.000Z',
      ...task,
    });
  return {
    file,
    get store() {
      return store;
    },
    async reopen() {
      await store.close();
      store = new Store(file);
    },
  };
}

async function column(store, status = 'Planned') {
  return (await store.list('tasks'))
    .filter((task) => task.status === status)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

test('moving against one visible anchor preserves hidden tasks and normalizes the entire target column', async (t) => {
  const f = await fixture(t, [
    { id: 'a-hidden', order: 0, project: 'hidden' },
    { id: 'b-visible', order: 0, project: 'visible' },
    { id: 'c-hidden', order: 1, project: 'hidden' },
    { id: 'd-anchor', order: 3, project: 'visible' },
    { id: 'e-hidden', order: 3, project: 'hidden' },
    { id: 'moving', status: 'Inbox', order: 0, project: 'visible', actualTime: 12 },
  ]);
  const result = await f.store.moveTask({ id: 'moving', status: 'Planned', beforeId: 'd-anchor' });
  assert.equal(result.changed, true);
  assert.equal(result.task.status, 'Planned');
  const expected = ['a-hidden', 'b-visible', 'c-hidden', 'moving', 'd-anchor', 'e-hidden'];
  const tasks = await column(f.store);
  assert.deepEqual(
    tasks.map((task) => task.id),
    expected,
  );
  assert.deepEqual(
    tasks.map((task) => task.order),
    [0, 1, 2, 3, 4, 5],
  );
  for (const task of tasks.filter((task) => task.id !== 'moving'))
    assert.equal(task.updatedAt, '2026-10-01T00:00:00.000Z');
  const activities = await f.store.list('timeline');
  assert.equal(activities.length, 1);
  assert.equal(activities[0].kind, 'tasks');
  assert.equal(activities[0].entityId, 'moving');
  assert.equal(activities[0].project, 'visible');
  assert.match(activities[0].title, /Inbox.*Planned/);
  await f.reopen();
  assert.deepEqual(
    (await column(f.store)).map((task) => task.id),
    expected,
  );
  assert.deepEqual(await f.store.list('timeline'), activities);
});

test('same-column ordering patches preserve latest focus time, edit receipts, and unrelated fields', async (t) => {
  const receipts = [{ id: 'editor', delta: 2, revision: 3 }];
  const f = await fixture(t, [
    { id: 'a', order: 0 },
    { id: 'b', order: 1 },
    {
      id: 'c',
      order: 2,
      actualTime: 8,
      actualTimeEdits: receipts,
      actualTimeEditRevision: 3,
      actualTimeEditFloor: 1,
      description: 'Keep me',
      tags: 'keep',
      relatedAgent: 'agent',
      custom: { nested: ['preserved'] },
    },
  ]);
  await f.store.finishFocus({
    id: 'latest-focus',
    task: 'c',
    status: 'completed',
    actualSeconds: 90,
    endTime: '2026-10-24T00:00:00.000Z',
  });
  const before = (await f.store.list('tasks')).find((task) => task.id === 'c');
  const result = await f.store.moveTask({ id: 'c', status: 'Planned', beforeId: 'a' });
  const after = (await f.store.list('tasks')).find((task) => task.id === 'c');
  assert.equal(result.changed, true);
  assert.equal(after.actualTime, 9.5);
  for (const key of Object.keys(before).filter(
    (key) => !['order', 'updatedAt', 'completedAt'].includes(key),
  ))
    assert.deepEqual(after[key], before[key], key);
  assert.deepEqual(
    (await column(f.store)).map((task) => task.id),
    ['c', 'a', 'b'],
  );
  const activities = await f.store.list('timeline');
  assert.equal(activities.length, 1);
  assert.match(activities[0].title, /排序|reorder/i);
});

test('Done transitions set, preserve, and clear completion time without changing unrelated cards', async (t) => {
  const f = await fixture(t, [
    { id: 'moving', order: 0, completedAt: '2026-09-01T00:00:00.000Z' },
    { id: 'done', status: 'Done', order: 0, completedAt: '2026-10-10T00:00:00.000Z' },
  ]);
  const first = await f.store.moveTask({ id: 'moving', status: 'Done', beforeId: 'done' });
  assert.ok(Number.isFinite(Date.parse(first.task.completedAt)));
  assert.notEqual(first.task.completedAt, '2026-09-01T00:00:00.000Z');
  const reordered = await f.store.moveTask({ id: 'moving', status: 'Done' });
  assert.equal(reordered.task.completedAt, first.task.completedAt);
  const reopened = await f.store.moveTask({ id: 'moving', status: 'Waiting', beforeId: null });
  assert.equal(reopened.task.completedAt, null);
  const done = (await f.store.list('tasks')).find((task) => task.id === 'done');
  assert.equal(done.completedAt, '2026-10-10T00:00:00.000Z');
  assert.equal(done.updatedAt, '2026-10-01T00:00:00.000Z');
  assert.equal((await f.store.list('timeline')).length, 3);
});

test('self anchors, existing positions, and already-last cards are no-ops without timeline writes', async (t) => {
  const f = await fixture(t, [
    { id: 'a', order: 0 },
    { id: 'b', order: 1 },
  ]);
  const before = await f.store.snapshot();
  for (const request of [
    { id: 'a', status: 'Planned', beforeId: 'a' },
    { id: 'a', status: 'Planned', beforeId: 'b' },
    { id: 'b', status: 'Planned', beforeId: null },
    { id: 'b', status: 'Planned' },
  ])
    assert.equal((await f.store.moveTask(request)).changed, false);
  assert.deepEqual(await f.store.snapshot(), before);
});

test('deleted tasks and missing or departed anchors reject atomically without resurrecting records', async (t) => {
  const f = await fixture(t, [
    { id: 'moving', status: 'Inbox' },
    { id: 'anchor', order: 0 },
    { id: 'departed', status: 'Waiting' },
  ]);
  const before = await f.store.snapshot();
  for (const beforeId of ['missing', 'departed'])
    await assert.rejects(f.store.moveTask({ id: 'moving', status: 'Planned', beforeId }));
  assert.deepEqual(await f.store.snapshot(), before);
  await f.store.delete('tasks', 'moving');
  await assert.rejects(f.store.moveTask({ id: 'moving', status: 'Planned', beforeId: 'anchor' }));
  assert.equal(
    (await f.store.list('tasks')).some((task) => task.id === 'moving'),
    false,
  );
  assert.equal((await f.store.list('timeline')).length, 0);
});

test('task moves reject malformed requests, extra entity fields, invalid ids and statuses', async (t) => {
  const f = await fixture(t, [{ id: 'task', order: 0 }]);
  const before = await f.store.snapshot();
  for (const request of [
    null,
    [],
    'task',
    {},
    { id: 'task' },
    { status: 'Done' },
    { id: '', status: 'Done' },
    { id: '   ', status: 'Done' },
    { id: 1, status: 'Done' },
    { id: 'x'.repeat(201), status: 'Done' },
    { id: 'task', status: 'finished' },
    { id: 'task', status: ['Done'] },
    { id: 'task', status: 'Done', beforeId: '' },
    { id: 'task', status: 'Done', beforeId: 7 },
    { id: 'task', status: 'Done', beforeId: 'x'.repeat(201) },
    { id: 'task', status: 'Done', actualTime: 0 },
    { id: 'task', status: 'Done', title: 'Do not overwrite' },
  ])
    await assert.rejects(f.store.moveTask(request));
  assert.deepEqual(await f.store.snapshot(), before);
});

test('a timeline write failure rolls back task status and every changed order before a successful retry', async (t) => {
  const f = await fixture(t, [
    { id: 'a', order: 0 },
    { id: 'b', order: 1 },
    { id: 'moving', status: 'Inbox' },
  ]);
  const before = await f.store.snapshot();
  const db = new DatabaseSync(f.file);
  t.after(() => db.close());
  db.exec(
    "CREATE TRIGGER fail_move BEFORE INSERT ON records WHEN NEW.kind='timeline' BEGIN SELECT RAISE(ABORT, 'controlled activity write failure'); END",
  );
  await assert.rejects(
    f.store.moveTask({ id: 'moving', status: 'Planned', beforeId: 'a' }),
    /controlled activity write failure/,
  );
  assert.deepEqual(await f.store.snapshot(), before);
  db.exec('DROP TRIGGER fail_move');
  await f.store.moveTask({ id: 'moving', status: 'Planned', beforeId: 'a' });
  assert.deepEqual(
    (await column(f.store)).map((task) => task.id),
    ['moving', 'a', 'b'],
  );
  assert.equal((await f.store.list('timeline')).length, 1);
});

test('missing manual orders retain the original record order and queued moves use current database state', async (t) => {
  const f = await fixture(t, [
    { id: 'a' },
    { id: 'b' },
    { id: 'c' },
    { id: 'first', status: 'Inbox' },
    { id: 'second', status: 'Inbox' },
  ]);
  const original = (await column(f.store)).map((task) => task.id);
  await Promise.all([
    f.store.moveTask({ id: 'first', status: 'Planned' }),
    f.store.moveTask({ id: 'second', status: 'Planned' }),
  ]);
  const tasks = await column(f.store);
  assert.deepEqual(
    tasks.map((task) => task.id),
    [...original, 'first', 'second'],
  );
  assert.deepEqual(
    tasks.map((task) => task.order),
    [0, 1, 2, 3, 4],
  );
  assert.equal((await f.store.list('timeline')).length, 2);
});
