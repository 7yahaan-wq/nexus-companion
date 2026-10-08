"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/domain/calendar.ts
var calendar_exports = {};
__export(calendar_exports, {
  addDays: () => addDays,
  dateKey: () => dateKey,
  layoutDay: () => layoutDay,
  localInput: () => localInput,
  nextQuarterHour: () => nextQuarterHour,
  occurrences: () => occurrences,
  validateEvent: () => validateEvent
});
module.exports = __toCommonJS(calendar_exports);
function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function localInput(date) {
  return `${dateKey(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
function nextQuarterHour(date = /* @__PURE__ */ new Date()) {
  const next = new Date(date);
  const minutes = next.getMinutes() + (next.getSeconds() || next.getMilliseconds() ? 1 : 0);
  next.setMinutes(Math.ceil(minutes / 15) * 15, 0, 0);
  return next;
}
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function occurrences(events, from, to) {
  const result = [];
  for (const e of events) {
    const base = new Date(e.start), end = new Date(e.end), duration = end.getTime() - base.getTime();
    if (!Number.isFinite(duration) || duration <= 0) continue;
    const until = e.repeatUntil ? /* @__PURE__ */ new Date(e.repeatUntil + "T23:59:59") : to;
    let start = new Date(base);
    if (e.recurrence === "daily" || e.recurrence === "weekly") {
      const step = e.recurrence === "weekly" ? 7 : 1;
      const skip = Math.max(
        0,
        Math.floor((from.getTime() - base.getTime() - duration) / 864e5 / step) - 1
      );
      start = addDays(base, skip * step);
    }
    let count = 0;
    while (start < to && start <= until && count++ < 5e3) {
      const finish = new Date(start.getTime() + duration);
      if (finish > from)
        result.push({
          ...e,
          start: localInput(start),
          end: localInput(finish),
          seriesId: e.id,
          occurrenceId: e.id + ":" + localInput(start)
        });
      if (!e.recurrence || e.recurrence === "none") break;
      if (e.recurrence === "daily") start = addDays(start, 1);
      else if (e.recurrence === "weekly") start = addDays(start, 7);
      else if (e.recurrence === "monthly") {
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
function validateEvent(e) {
  if (!e.title?.trim()) throw Error("\u8BF7\u586B\u5199\u65E5\u7A0B\u6807\u9898");
  const start = new Date(e.start), end = new Date(e.end);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start)
    throw Error("\u7ED3\u675F\u65F6\u95F4\u5FC5\u987B\u665A\u4E8E\u5F00\u59CB\u65F6\u95F4");
  if (e.repeatUntil && e.repeatUntil < dateKey(start)) throw Error("\u91CD\u590D\u7ED3\u675F\u65E5\u671F\u4E0D\u80FD\u65E9\u4E8E\u5F00\u59CB\u65E5\u671F");
  return e;
}
function layoutDay(events, day) {
  const from = new Date(day);
  from.setHours(0, 0, 0, 0);
  const to = addDays(from, 1);
  const rows = events.filter((e) => new Date(e.start) < to && new Date(e.end) > from).map((event) => {
    const s = new Date(Math.max(from.getTime(), new Date(event.start).getTime())), e = new Date(Math.min(to.getTime(), new Date(event.end).getTime()));
    const top = s.getHours() * 60 + s.getMinutes();
    const end = e.getTime() === to.getTime() ? 1440 : e.getHours() * 60 + e.getMinutes();
    return { event, top, height: Math.max(15, end - top), end, lane: 0, lanes: 1 };
  }).sort((a, b) => a.top - b.top || b.height - a.height);
  let group = [], laneEnds = [], groupEnd = -1;
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  addDays,
  dateKey,
  layoutDay,
  localInput,
  nextQuarterHour,
  occurrences,
  validateEvent
});
