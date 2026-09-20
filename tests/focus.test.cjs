const { test } = require('node:test');
const assert = require('node:assert/strict');
const { FocusService } = require('../electron/services/focus.cjs');
test('focus timer survives reload, excludes pauses and completes exactly once', async () => {
  const rows = { settings: [], focus: [] };
  const store = {
    list: async (k) => rows[k],
    save: async (k, v) => {
      rows[k] = rows[k].filter((x) => x.id !== v.id).concat(v);
    },
  };
  let now = 0,
    notifications = 0;
  let f = new FocusService(
    store,
    () => notifications++,
    () => now,
  );
  await f.start(1, 'task', 'test');
  now = 15000;
  await f.pause();
  now = 35000;
  assert.equal(f.state().remainingSeconds, 45);
  f = new FocusService(
    store,
    () => notifications++,
    () => now,
  );
  await f.init();
  assert.equal(f.state().paused, true);
  await f.pause();
  now = 80000;
  await f.tick();
  await f.tick();
  assert.equal(rows.focus.length, 1);
  assert.equal(rows.focus[0].actualSeconds, 60);
  assert.equal(notifications, 1);
  assert.equal(f.state(), null);
});
