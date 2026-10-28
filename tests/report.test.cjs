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

test('daily report includes only its own saved review, capacity and priority order', async () => {
  const { makeReport } = await import('../src/domain/report.ts');
  const data = {
    tasks: [
      { id: 'a', title: 'First focus' },
      { id: 'b', title: 'Second focus' },
    ],
    projects: [],
    notes: [],
    timeline: [],
    focus: [],
  };
  const plan = {
    id: 'daily-plan:2026-10-28',
    date: '2026-10-28',
    capacityMinutes: 0,
    topTaskIds: ['b', 'a', 'deleted'],
    reflection: 'Delivered the task.\nNext: review the export.',
    startedAt: null,
    closedAt: '2026-10-28T18:00:00',
  };
  const md = makeReport('2026-10-28', data, [], plan);
  assert.ok(
    md.includes(plan.reflection),
    'saved multiline reflection must reach the exported Markdown',
  );
  assert.match(md, /可用时间：0 分钟/);
  assert.match(md, /已收工/);
  assert.ok(md.indexOf('Second focus') < md.indexOf('First focus'));
  assert.match(md, /已删除或不可用/);
  const historical = makeReport('2026-10-27', data, [], plan);
  assert.ok(!historical.includes(plan.reflection));
  assert.match(historical, /当天没有已保存的计划/);
});

test('missing or mismatched plans do not invent a review or a time budget', async () => {
  const { makeReport } = await import('../src/domain/report.ts');
  const data = { tasks: [], projects: [], notes: [], timeline: [], focus: [] };
  for (const plan of [
    undefined,
    null,
    {
      id: 'daily-plan:2026-10-27',
      date: '2026-10-28',
      reflection: 'wrong key',
      capacityMinutes: 240,
    },
  ]) {
    const md = makeReport('2026-10-28', data, [], plan);
    assert.match(md, /当天没有已保存的计划/);
    assert.doesNotMatch(md, /wrong key|可用时间：240/);
  }
});

test('an open day with an empty review remains explicitly empty and never auto-completes priorities', async () => {
  const { makeReport } = await import('../src/domain/report.ts');
  const data = {
    tasks: [{ id: 'open', title: 'Still working', status: 'In Progress' }],
    projects: [],
    notes: [],
    timeline: [],
    focus: [],
  };
  const plan = {
    id: 'daily-plan:2026-10-28',
    date: '2026-10-28',
    capacityMinutes: 90,
    topTaskIds: ['open'],
    startedAt: '2026-10-28T09:00:00',
    closedAt: null,
    reflection: '',
  };
  const before = JSON.stringify({ data, plan });
  const md = makeReport('2026-10-28', data, [], plan);
  assert.match(md, /已开工|尚未收工/);
  assert.match(md, /当天尚未填写回顾/);
  assert.equal(JSON.stringify({ data, plan }), before);
  assert.doesNotMatch(md.split('## Agent Activity')[0], /Completed Tasks\n- Still working/);
});
