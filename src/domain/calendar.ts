export interface CalendarEntry {
  id: string;
  title: string;
  start: string;
  end: string;
  recurrence?: string;
  repeatUntil?: string;
  [key: string]: any;
}
export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function localInput(date: Date) {
  return `${dateKey(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
export function addDays(date: Date, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
export function occurrences(events: CalendarEntry[], from: Date, to: Date) {
  const result: CalendarEntry[] = [];
  for (const e of events) {
    const base = new Date(e.start),
      end = new Date(e.end),
      duration = end.getTime() - base.getTime();
    if (!Number.isFinite(duration) || duration <= 0) continue;
    const until = e.repeatUntil ? new Date(e.repeatUntil + 'T23:59:59') : to;
    let start = new Date(base);
    if (e.recurrence === 'daily' || e.recurrence === 'weekly') {
      const step = e.recurrence === 'weekly' ? 7 : 1;
      const skip = Math.max(
        0,
        Math.floor((from.getTime() - base.getTime() - duration) / 86400000 / step) - 1,
      );
      start = addDays(base, skip * step);
    }
    let count = 0;
    while (start < to && start <= until && count++ < 5000) {
      const finish = new Date(start.getTime() + duration);
      if (finish > from)
        result.push({
          ...e,
          start: localInput(start),
          end: localInput(finish),
          seriesId: e.id,
          occurrenceId: e.id + ':' + localInput(start),
        });
      if (!e.recurrence || e.recurrence === 'none') break;
      if (e.recurrence === 'daily') start = addDays(start, 1);
      else if (e.recurrence === 'weekly') start = addDays(start, 7);
      else if (e.recurrence === 'monthly') {
        const month = start.getMonth() + 1;
        const next = new Date(start);
        next.setDate(1);
        next.setMonth(month);
        const days = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
        next.setDate(Math.min(base.getDate(), days));
        start = next;
      } else break;
    }
  }
  return result.sort((a, b) => a.start.localeCompare(b.start));
}
export function validateEvent(e: CalendarEntry) {
  if (!e.title?.trim()) throw Error('请填写日程标题');
  const start = new Date(e.start),
    end = new Date(e.end);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start)
    throw Error('结束时间必须晚于开始时间');
  if (e.repeatUntil && e.repeatUntil < dateKey(start)) throw Error('重复结束日期不能早于开始日期');
  return e;
}
export function layoutDay(events: CalendarEntry[], day: Date) {
  const from = new Date(day);
  from.setHours(0, 0, 0, 0);
  const to = addDays(from, 1);
  const rows = events
    .filter((e) => new Date(e.start) < to && new Date(e.end) > from)
    .map((event) => {
      const s = new Date(Math.max(from.getTime(), new Date(event.start).getTime())),
        e = new Date(Math.min(to.getTime(), new Date(event.end).getTime()));
      const top = s.getHours() * 60 + s.getMinutes();
      const end = e.getTime() === to.getTime() ? 1440 : e.getHours() * 60 + e.getMinutes();
      return { event, top, height: Math.max(15, end - top), end, lane: 0, lanes: 1 };
    })
    .sort((a, b) => a.top - b.top || b.height - a.height);
  let group: typeof rows = [],
    laneEnds: number[] = [],
    groupEnd = -1;
  function flush() {
    for (const row of group) row.lanes = laneEnds.length;
    group = [];
    laneEnds = [];
  }
  for (const row of rows) {
    if (row.top >= groupEnd) {
      flush();
      groupEnd = -1;
    }
    let lane = laneEnds.findIndex((end) => end <= row.top);
    if (lane < 0) lane = laneEnds.length;
    row.lane = lane;
    laneEnds[lane] = row.end;
    groupEnd = Math.max(groupEnd, row.end);
    group.push(row);
  }
  flush();
  return rows;
}
