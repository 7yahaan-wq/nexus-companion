const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { Store } = require('../electron/storage/index.cjs');
const { FocusService } = require('../electron/services/focus.cjs');

async function fixture(
  t,
  task = { id: 'task', title: 'Ship the project', status: 'Planned', actualTime: 7 },
) {
  const file = path.join(__dirname, '../.test-data', `focus-${randomUUID()}.sqlite`);
  let store = new Store(file),
    now = 0,
    notifications = 0;
  if (task) await store.save('tasks', task);
  const service = () =>
    new FocusService(
      store,
      () => notifications++,
      () => now,
    );
  let focus = service();
  t.after(() => store.close());
  return {
    file,
    get store() {
      return store;
    },
    get focus() {
      return focus;
    },
    get notifications() {
      return notifications;
    },
    at(time) {
      now = time;
    },
    async reload() {
      await store.close();
      store = new Store(file);
      focus = service();
      await focus.init();
    },
  };
}

test('completed focus survives reload, excludes pauses and credits manual task time exactly once', async (t) => {
  const f = await fixture(t);
  await f.focus.start(1, 'task', 'test');
  f.at(15000);
  await f.focus.pause();
  f.at(35000);
  await f.reload();
  assert.equal(f.focus.state().paused, true);
  assert.equal(f.focus.state().remainingSeconds, 45);
  await f.focus.pause();
  f.at(80000);
  await Promise.all([f.focus.tick(), f.focus.tick(), f.focus.finish(false)]);
  assert.equal((await f.store.list('focus')).length, 1);
  assert.equal((await f.store.list('focus'))[0].actualSeconds, 60);
  assert.equal((await f.store.list('tasks'))[0].actualTime, 8);
  assert.equal((await f.store.list('tasks'))[0].status, 'Planned');
  assert.equal(f.notifications, 1);
  assert.equal(f.focus.state(), null);
  await f.reload();
  assert.equal(f.focus.state(), null);
  assert.equal((await f.store.list('tasks'))[0].actualTime, 8);
  assert.equal(f.notifications, 1);
});

test('stopped focus credits fractional minutes without paused or idle time, and subsequent sessions add to them', async (t) => {
  const f = await fixture(t);
  await f.focus.start(25, 'task', 'short session');
  f.at(30000);
  await f.focus.pause();
  f.at(120000);
  const record = await f.focus.finish(false);
  assert.equal(record.status, 'stopped');
  assert.equal(record.actualSeconds, 30);
  assert.equal((await f.store.list('tasks'))[0].actualTime, 7.5);
  assert.equal(f.notifications, 0);
  await f.focus.start(25, 'task', 'next session');
  f.at(135000);
  await f.focus.finish(false);
  assert.equal((await f.store.list('tasks'))[0].actualTime, 7.75);
});

test('atomic finish retry after an uncertain response cannot double-credit task time', async (t) => {
  const f = await fixture(t);
  await f.focus.start(1, 'task', 'retry');
  f.at(30000);
  const realFinish = f.store.finishFocus.bind(f.store);
  f.store.finishFocus = async (record) => {
    await realFinish(record);
    throw Error('response interrupted after commit');
  };
  await assert.rejects(f.focus.finish(false), /response interrupted/);
  assert.equal((await f.store.list('tasks'))[0].actualTime, 7.5);
  f.store.finishFocus = realFinish;
  f.at(45000);
  const record = await f.focus.finish(false);
  assert.equal(record.actualSeconds, 30);
  assert.equal((await f.store.list('tasks'))[0].actualTime, 7.5);
  assert.equal(f.focus.state(), null);
});

test('failed SQLite write rolls back the task increment and retains the active session', async (t) => {
  const f = await fixture(t);
  await f.focus.start(1, 'task', 'retry');
  f.at(30000);
  const db = new DatabaseSync(f.file);
  t.after(() => db.close());
  db.exec(
    "CREATE TRIGGER fail_focus BEFORE INSERT ON records WHEN NEW.kind='focus' BEGIN SELECT RAISE(ABORT, 'simulated disk write failure'); END",
  );
  await assert.rejects(f.focus.finish(false), /simulated disk write failure/);
  assert.equal((await f.store.list('focus')).length, 0);
  assert.equal((await f.store.list('tasks'))[0].actualTime, 7);
  assert.ok((await f.store.list('settings')).find((s) => s.id === 'active-focus').session);
  db.exec('DROP TRIGGER fail_focus');
  await f.focus.finish(false);
  assert.equal((await f.store.list('tasks'))[0].actualTime, 7.5);
});

test('repeated pauses preserve fractional seconds across restart without timer drift', async (t) => {
  const f = await fixture(t);
  await f.focus.start(1, 'task', 'fractional timing');
  f.at(750);
  await f.focus.pause();
  await f.reload();
  f.at(10000);
  await f.focus.pause();
  f.at(10750);
  await f.focus.pause();
  f.at(20000);
  const record = await f.focus.finish(false);
  assert.equal(record.actualSeconds, 1);
  assert.ok(Math.abs((await f.store.list('tasks'))[0].actualTime - (7 + 1 / 60)) < 1e-10);
});

test('deleted tasks and free focus still produce persistent records', async (t) => {
  const f = await fixture(t);
  await f.focus.start(1, 'task', 'deleted task');
  await f.store.delete('tasks', 'task');
  f.at(60000);
  await f.focus.tick();
  await f.focus.start(1, '', 'free focus');
  f.at(120000);
  await f.focus.tick();
  assert.equal((await f.store.list('focus')).length, 2);
  assert.deepEqual(await f.store.list('tasks'), []);
});

test('legacy finished records are not retroactively credited after interrupted old-version cleanup', async (t) => {
  const f = await fixture(t);
  const active = await f.focus.start(1, 'task', 'legacy');
  await f.store.save('focus', {
    ...active,
    status: 'completed',
    actualSeconds: 60,
    endTime: new Date(60000).toISOString(),
  });
  f.at(60000);
  await f.reload();
  assert.equal((await f.store.list('focus')).length, 1);
  assert.equal((await f.store.list('tasks'))[0].actualTime, 7);
  assert.equal(f.notifications, 0);
  assert.equal(f.focus.state(), null);
});

test('concurrent starts create only one session and invalid duration creates none', async (t) => {
  const f = await fixture(t);
  await assert.rejects(f.focus.start(0, '', ''), /1–480/);
  assert.equal(f.focus.state(), null);
  const starts = await Promise.allSettled([
    f.focus.start(1, 'task', 'first'),
    f.focus.start(1, 'task', 'second'),
  ]);
  assert.equal(starts.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(
    (await f.store.list('settings')).find((s) => s.id === 'active-focus').session.id,
    f.focus.state().id,
  );
});

test('saving an editor opened before focus finishes preserves the new increment and applies manual time edits', async (t) => {
  const f = await fixture(t);
  const editedTask = (await f.store.list('tasks'))[0];
  await f.focus.start(1, 'task', 'during editing');
  f.at(60000);
  await f.focus.tick();
  await f.store.save('tasks', {
    ...editedTask,
    title: 'Renamed',
    actualTimeBaseline: 7,
    actualTimeEditId: 'editor',
    actualTimeEditRevision: 0,
    actualTime: 9,
  });
  const task = (await f.store.list('tasks'))[0];
  assert.equal(task.title, 'Renamed');
  assert.equal(task.actualTime, 10);
  assert.equal(Object.hasOwn(task, 'actualTimeBaseline'), false);
});

test('manual time edits remain retry-idempotent across distinct edits, focus and restart', async (t) => {
  const f = await fixture(t);
  const original = (await f.store.list('tasks'))[0];
  const first = {
    ...original,
    actualTimeBaseline: 7,
    actualTime: 12,
    actualTimeEditId: 'editor-A',
    actualTimeEditRevision: 0,
  };
  await f.store.save('tasks', first);
  await f.reload();
  await f.store.save('tasks', first);
  assert.equal((await f.store.list('tasks'))[0].actualTime, 12);
  const intermediate = (await f.store.list('tasks'))[0];
  await f.store.save('tasks', {
    ...intermediate,
    actualTimeBaseline: 12,
    actualTime: 14,
    actualTimeEditId: 'editor-B',
  });
  await f.focus.start(1, 'task', 'between retries');
  f.at(60000);
  await f.focus.tick();
  await f.store.save('tasks', first);
  assert.equal(
    (await f.store.list('tasks'))[0].actualTime,
    15,
    'Retry A preserves edit B and completed focus',
  );
  await f.store.save('tasks', { ...first, actualTime: 13 });
  assert.equal(
    (await f.store.list('tasks'))[0].actualTime,
    16,
    'Changing A intent from +5 to +6 applies only +1',
  );
  await f.store.save('tasks', { ...first, actualTime: 13 });
  assert.equal((await f.store.list('tasks'))[0].actualTime, 16);
});

test('bounded time-edit receipts reject evicted old retries rather than double count them', async (t) => {
  const f = await fixture(t);
  const original = (await f.store.list('tasks'))[0];
  const old = {
    ...original,
    actualTimeBaseline: 7,
    actualTime: 8,
    actualTimeEditId: 'editor-0',
    actualTimeEditRevision: 0,
  };
  await f.store.save('tasks', old);
  for (let i = 1; i <= 40; i++) {
    const current = (await f.store.list('tasks'))[0];
    await f.store.save('tasks', {
      ...current,
      actualTimeBaseline: current.actualTime,
      actualTime: current.actualTime + 1,
      actualTimeEditId: `editor-${i}`,
    });
  }
  const before = (await f.store.list('tasks'))[0];
  assert.equal(before.actualTimeEdits.length, 32);
  assert.equal(before.actualTime, 48);
  await assert.rejects(f.store.save('tasks', old), /已过期/);
  assert.equal((await f.store.list('tasks'))[0].actualTime, 48);
});
