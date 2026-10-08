const { test } = require('node:test');
const assert = require('node:assert/strict');
test('new time blocks start at the next quarter hour, including midnight rollover', async () => {
  const { nextQuarterHour, localInput } = await import('../src/domain/calendar.ts');
  assert.equal(localInput(nextQuarterHour(new Date('2026-10-08T20:55:00'))), '2026-10-08T21:00');
  assert.equal(localInput(nextQuarterHour(new Date('2026-10-08T23:59:59'))), '2026-10-09T00:00');
  assert.equal(localInput(nextQuarterHour(new Date('2026-10-08T10:15:01'))), '2026-10-08T10:30');
});
test('recurrence respects range, month ends and repeat limit', async () => {
  const { occurrences } = await import('../src/domain/calendar.ts');
  const e = {
    id: 'a',
    title: 'Daily',
    start: '2026-09-01T10:00',
    end: '2026-09-01T11:00',
    recurrence: 'daily',
    repeatUntil: '2026-09-22',
  };
  const list = occurrences([e], new Date('2026-09-20T00:00'), new Date('2026-09-27T00:00'));
  assert.equal(list.length, 3);
  assert.equal(list[0].start, '2026-09-20T10:00');
  const m = occurrences(
    [
      {
        ...e,
        start: '2026-01-31T10:00',
        end: '2026-01-31T11:00',
        recurrence: 'monthly',
        repeatUntil: '',
      },
    ],
    new Date('2026-02-01'),
    new Date('2026-04-01'),
  );
  assert.equal(m[0].start, '2026-02-28T10:00');
  assert.equal(m[1].start, '2026-03-31T10:00');
});
test('reject invalid calendar interval', async () => {
  const { validateEvent } = await import('../src/domain/calendar.ts');
  assert.throws(() =>
    validateEvent({
      id: 'x',
      title: 'Invalid',
      start: '2026-09-20T11:00',
      end: '2026-09-20T10:00',
    }),
  );
});
test('calendar splits overnight blocks and assigns visible lanes for overlapping events', async () => {
  const { layoutDay } = await import('../src/domain/calendar.ts');
  const rows = layoutDay(
    [
      { id: 'a', title: 'Overnight', start: '2026-09-19T23:00', end: '2026-09-20T01:00' },
      { id: 'b', title: 'Overlap', start: '2026-09-20T00:30', end: '2026-09-20T02:00' },
    ],
    new Date('2026-09-20T00:00'),
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].top, 0);
  assert.equal(rows[0].height, 60);
  assert.equal(rows[0].lanes, 2);
  assert.equal(rows[1].lane, 1);
});
