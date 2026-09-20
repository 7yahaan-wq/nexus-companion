const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseRun, CodexProvider } = require('../electron/providers/codex.cjs');
const options = {
  file: 'test.jsonl',
  mtime: '2026-09-20T10:00:00Z',
  now: Date.parse('2026-09-20T10:00:30Z'),
};
const meta = { id: 'abc', cwd: 'D:/project' };
test('Codex observation never guesses completion or stale liveness', () => {
  const records = [
    { timestamp: options.mtime, type: 'event_msg', payload: { type: 'task_started' } },
  ];
  assert.equal(parseRun(meta, records, options).status, 'RUNNING');
  assert.equal(
    parseRun(meta, records, { ...options, now: options.now + 180000 }).status,
    'UNAVAILABLE',
  );
  assert.equal(parseRun(meta, [], options).status, 'UNAVAILABLE');
  records.push({
    timestamp: '2026-09-20T10:01:00Z',
    type: 'event_msg',
    payload: { type: 'task_complete' },
  });
  const r = parseRun(meta, records, options);
  assert.equal(r.status, 'COMPLETED');
  assert.equal(r.duration, 60000);
  assert.equal(r.progress, null);
});
test('Codex missing directory produces unavailable, not fabricated data', async () => {
  const r = await new CodexProvider('D:/friend/.test-data/no-codex').list();
  assert.equal(r.availability, 'UNAVAILABLE');
  assert.deepEqual(r.runs, []);
  assert.equal(r.capabilities.stop, false);
});
test('Codex Unix-second start times normalize to ISO instead of 1970', () => {
  const r = parseRun(
    meta,
    [
      {
        timestamp: '2026-09-20T10:00:00Z',
        type: 'event_msg',
        payload: { type: 'task_started', started_at: Date.parse('2026-09-20T10:00:00Z') / 1000 },
      },
      { timestamp: '2026-09-20T10:01:00Z', type: 'event_msg', payload: { type: 'task_complete' } },
    ],
    options,
  );
  assert.equal(r.startTime, '2026-09-20T10:00:00.000Z');
  assert.equal(r.duration, 60000);
  assert.equal(r.observedAt, '2026-09-20T10:01:00.000Z');
});
test('desktop PascalCase file-change maps preserve real file activity', () => {
  const r = parseRun(
    meta,
    [
      {
        timestamp: options.mtime,
        type: 'event_msg',
        payload: {
          type: 'item_completed',
          item: {
            type: 'FileChange',
            status: 'Completed',
            changes: { 'D:/project/a.ts': { type: 'update' } },
          },
        },
      },
    ],
    options,
  );
  assert.deepEqual(r.changedFiles, ['D:/project/a.ts']);
  assert.match(r.activities[0].title, /a.ts/);
});
