const { test } = require('node:test');
const assert = require('node:assert/strict');

test('daily work retains overdue and started work, excludes completed and future work', async () => {
  const { workForDay } = await import('../src/domain/planning.ts');
  const tasks = [
    { id: 'future', status: 'Planned', dueDate: '2026-10-09' },
    { id: 'today', status: 'Planned', dueDate: '2026-10-08' },
    { id: 'overdue', status: 'Planned', dueDate: '2026-10-07' },
    { id: 'done', status: 'Done', dueDate: '2026-10-06' },
    { id: 'cancelled', status: 'Cancelled', dueDate: '2026-10-06' },
    { id: 'started', status: 'Planned', startDate: '2026-10-07' },
    { id: 'active', status: 'In Progress' },
    { id: 'chosen', status: 'Inbox' },
  ];
  const before = structuredClone(tasks);
  assert.deepEqual(
    workForDay(tasks, '2026-10-08', ['chosen']).map((t) => t.id),
    ['overdue', 'chosen', 'today', 'started', 'active'],
  );
  assert.deepEqual(tasks, before, 'Showing yesterday work must not silently rewrite dates');
});

test('daily plans normalize unique top three and count only unfinished work estimates', async () => {
  const { dailyPlan, planLoad } = await import('../src/domain/planning.ts');
  const plan = dailyPlan('2026-10-08', {
    topTaskIds: ['a', 'a', 'b', 1, 'c', 'd'],
    capacityMinutes: -1,
  });
  assert.equal(plan.id, 'daily-plan:2026-10-08');
  assert.deepEqual(plan.topTaskIds, ['a', 'b', 'c']);
  assert.equal(plan.capacityMinutes, 240);
  assert.deepEqual(
    planLoad(
      [
        { id: 'a', estimatedTime: 30, status: 'Planned' },
        { id: 'b', estimatedTime: 90, status: 'Done' },
        { id: 'c', estimatedTime: '', status: 'Inbox' },
        { id: 'd', estimatedTime: 100, status: 'Planned' },
      ],
      plan.topTaskIds,
    ),
    { minutes: 30, unestimated: 1 },
  );
});
