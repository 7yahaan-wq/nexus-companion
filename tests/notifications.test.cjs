const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NotificationService } = require('../electron/services/notifications.cjs');
test('notifications deduplicate across restart and do not replay old agent completions', async () => {
  const settings = [{ id: 'appearance', notifications: { calendar: true, completed: true } }],
    events = [{ id: 'e', title: 'Review', start: '2026-09-20T10:00', end: '2026-09-20T11:00' }],
    sent = [];
  const store = {
    list: async (k) => (k === 'events' ? events : settings),
    save: async (k, v) => {
      const i = settings.findIndex((s) => s.id === v.id);
      if (i >= 0) settings[i] = v;
      else settings.push(v);
    },
  };
  const now = () => new Date('2026-09-20T09:59:30').getTime();
  let s = new NotificationService(store, (...a) => sent.push(a), now);
  await s.init();
  await s.calendar();
  await s.calendar();
  assert.equal(sent.length, 1);
  s = new NotificationService(store, (...a) => sent.push(a), now);
  await s.init();
  await s.calendar();
  assert.equal(sent.length, 1);
  await s.agents([{ id: 'a', status: 'COMPLETED' }]);
  assert.equal(sent.length, 1);
  await s.agents([{ id: 'b', status: 'RUNNING' }]);
  await s.agents([
    { id: 'b', agentName: 'Codex', taskName: 'Done', status: 'COMPLETED', lastEvent: '1' },
  ]);
  assert.equal(sent.length, 2);
  await s.agents([{ id: 'b', status: 'COMPLETED', lastEvent: '1' }]);
  assert.equal(sent.length, 2);
});
