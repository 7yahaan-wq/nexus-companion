const { test } = require('node:test');
const assert = require('node:assert/strict');
test('daily report counts real completion dates, clipped runtimes and focus', async () => {
  const { makeReport } = await import('../src/domain/report.ts');
  const data = {
    tasks: [
      { id: 'a', title: 'Completed today', status: 'Done', completedAt: '2026-09-20T12:00:00' },
      { id: 'b', title: 'Old completed', status: 'Done', completedAt: '2026-09-19T12:00:00' },
    ],
    projects: [],
    notes: [],
    timeline: [],
    focus: [{ id: 'f', endTime: '2026-09-20T12:00:00', actualSeconds: 1500 }],
  };
  const md = makeReport('2026-09-20', data, []);
  assert.match(md, /Completed today/);
  assert.doesNotMatch(md, /Old completed/);
  assert.match(md, /25 分钟/);
  assert.match(md, /Unavailable/);
});
