const { parentPort, workerData } = require('node:worker_threads');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
fs.mkdirSync(path.dirname(workerData.path), { recursive: true });
const db = new DatabaseSync(workerData.path);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(kind,id));
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY,value TEXT); INSERT OR IGNORE INTO meta VALUES ('schema','1');`);
const kinds = new Set([
  'projects',
  'tasks',
  'events',
  'notes',
  'settings',
  'focus',
  'timeline',
  'reports',
  'agents',
]);
const taskStates = new Set(['Inbox', 'Planned', 'In Progress', 'Waiting', 'Done', 'Cancelled']);
function moveTask(request) {
  const validId = (value) =>
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= 200 &&
    !/[\u0000-\u001f\u007f]/.test(value);
  if (
    !request ||
    typeof request !== 'object' ||
    Array.isArray(request) ||
    Object.getPrototypeOf(request) !== Object.prototype ||
    Object.keys(request).some((key) => !['id', 'status', 'beforeId'].includes(key)) ||
    !validId(request.id) ||
    !taskStates.has(request.status) ||
    (request.beforeId != null && !validId(request.beforeId))
  )
    throw Error('无效任务移动请求');
  db.exec('BEGIN IMMEDIATE');
  try {
    // Match list()'s record order, then use a stable manual-order sort. The client
    // sends only an anchor; filtered-out tasks remain part of this transaction.
    const tasks = db
      .prepare('SELECT data FROM records WHERE kind=?')
      .all('tasks')
      .map((row) => JSON.parse(row.data));
    const task = tasks.find((record) => record.id === request.id);
    if (!task) throw Error('任务已不存在，请刷新后重试');
    const beforeId = request.beforeId ?? null;
    const anchor = beforeId === null ? null : tasks.find((record) => record.id === beforeId);
    if (beforeId !== null && (!anchor || anchor.status !== request.status))
      throw Error('目标任务已移动或删除，请刷新后重试');
    const order = (record) => (Number.isFinite(Number(record.order)) ? Number(record.order) : 0);
    const current = tasks
      .filter((record) => record.status === request.status)
      .sort((a, b) => order(a) - order(b));
    const next = current.filter((record) => record.id !== task.id);
    const at = beforeId === null ? next.length : next.findIndex((record) => record.id === beforeId);
    if (beforeId !== task.id) next.splice(at, 0, task);
    const sameStatus = task.status === request.status;
    if (
      beforeId === task.id ||
      (sameStatus && current.every((record, index) => record.id === next[index]?.id))
    ) {
      db.exec('COMMIT');
      return { changed: false, task };
    }
    const time = new Date().toISOString();
    const moved = {
      ...task,
      status: request.status,
      order: at,
      updatedAt: time,
      ...(!sameStatus ? { completedAt: request.status === 'Done' ? time : null } : {}),
    };
    const update = db.prepare("UPDATE records SET data=? WHERE kind='tasks' AND id=?");
    for (let index = 0; index < next.length; index++) {
      const record = next[index];
      if (record.id !== task.id && record.order === index) continue;
      const value = record.id === task.id ? moved : { ...record, order: index };
      if (update.run(JSON.stringify(value), record.id).changes !== 1)
        throw Error('任务已不存在，请刷新后重试');
    }
    const activity = {
      id: randomUUID(),
      time,
      kind: 'tasks',
      entityId: task.id,
      project: task.project || '',
      title: sameStatus
        ? `任务排序 · ${task.title || task.id}`
        : `任务移动 · ${task.title || task.id} · ${task.status} → ${request.status}`,
    };
    db.prepare('INSERT INTO records VALUES (?,?,?)').run(
      'timeline',
      activity.id,
      JSON.stringify(activity),
    );
    db.exec('COMMIT');
    return { changed: true, task: moved };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
parentPort.on('message', ({ id, op, kind, value }) => {
  try {
    if (!kinds.has(kind)) throw Error('Unknown collection');
    let result;
    if (op === 'moveTask') result = moveTask(value);
    else if (op === 'snapshot') {
      db.exec('BEGIN');
      try {
        result = db
          .prepare('SELECT kind,data FROM records')
          .all()
          .map((r) => ({ kind: r.kind, value: JSON.parse(r.data) }));
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    } else if (op === 'merge') {
      if (!Array.isArray(value)) throw Error('Invalid snapshot');
      db.exec('BEGIN IMMEDIATE');
      try {
        const statement = db.prepare(
          'INSERT INTO records VALUES (?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data',
        );
        for (const r of value) {
          if (!kinds.has(r.kind)) throw Error('Unknown collection');
          statement.run(r.kind, r.value.id, JSON.stringify(r.value));
        }
        db.exec('COMMIT');
        result = true;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    } else if (op === 'finishFocus') {
      if (
        !value ||
        typeof value.id !== 'string' ||
        value.id.length > 200 ||
        !['completed', 'stopped'].includes(value.status) ||
        !Number.isFinite(value.actualSeconds) ||
        value.actualSeconds < 0 ||
        value.actualSeconds > 480 * 60
      )
        throw Error('Invalid focus record');
      if (JSON.stringify(value).length > 2_000_000) throw Error('Record too large');
      // The receipt, task increment and active timer must commit together. Retrying the
      // same session (including recovery after a lost worker response) is a no-op.
      db.exec('BEGIN IMMEDIATE');
      try {
        const get = (collection, recordId) => {
          const row = db
            .prepare('SELECT data FROM records WHERE kind=? AND id=?')
            .get(collection, recordId);
          return row ? JSON.parse(row.data) : null;
        };
        const put = (collection, record) =>
          db
            .prepare(
              'INSERT INTO records VALUES (?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data',
            )
            .run(collection, record.id, JSON.stringify(record));
        const existing = get('focus', value.id);
        let record = existing;
        if (!existing) {
          const task = value.task ? get('tasks', value.task) : null;
          if (task) {
            const manualAndPreviousMinutes = Number(task.actualTime);
            put('tasks', {
              ...task,
              actualTime:
                (Number.isFinite(manualAndPreviousMinutes) ? manualAndPreviousMinutes : 0) +
                value.actualSeconds / 60,
              updatedAt: value.endTime,
            });
          }
          record = { ...value, taskTimeCreditedSeconds: task ? value.actualSeconds : 0 };
          put('focus', record);
        }
        const active = get('settings', 'active-focus');
        if (active?.session?.id === value.id) put('settings', { ...active, session: null });
        db.exec('COMMIT');
        result = { record, created: !existing };
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    } else if (op === 'integrity') result = db.prepare('PRAGMA quick_check').get();
    else if (op === 'list')
      result = db
        .prepare('SELECT data FROM records WHERE kind=?')
        .all(kind)
        .map((r) => JSON.parse(r.data));
    else if (op === 'save') {
      if (!value || typeof value.id !== 'string' || value.id.length > 200)
        throw Error('Invalid record');
      let data = JSON.stringify(value);
      if (data.length > 2_000_000) throw Error('Record too large');
      db.exec('BEGIN IMMEDIATE');
      try {
        if (kind === 'tasks' && Object.hasOwn(value, 'actualTimeBaseline')) {
          const { actualTimeBaseline, actualTimeEditId, actualTimeEditRevision, ...task } = value;
          if (!Number.isFinite(actualTimeBaseline) || !Number.isFinite(Number(task.actualTime)))
            throw Error('Invalid actual task time');
          const currentRow = db
            .prepare('SELECT data FROM records WHERE kind=? AND id=?')
            .get(kind, task.id);
          const current = currentRow ? JSON.parse(currentRow.data) : null;
          const minutes = Number(current?.actualTime) || 0;
          const desiredDelta = Number(task.actualTime) - actualTimeBaseline;
          let adjustment = desiredDelta;
          let receipts = Array.isArray(current?.actualTimeEdits) ? current.actualTimeEdits : [];
          let revision = Number(current?.actualTimeEditRevision) || 0;
          let floor = Number(current?.actualTimeEditFloor) || 0;
          if (actualTimeEditId !== undefined) {
            if (
              typeof actualTimeEditId !== 'string' ||
              !actualTimeEditId ||
              actualTimeEditId.length > 200
            )
              throw Error('Invalid task edit receipt');
            const baselineRevision = actualTimeEditRevision ?? 0;
            if (!Number.isSafeInteger(baselineRevision) || baselineRevision < 0)
              throw Error('Invalid task edit revision');
            const previous = receipts.find((receipt) => receipt.id === actualTimeEditId);
            // A single editor can retry, or change its submitted value after an
            // uncertain response. Apply only the difference from its last intent.
            if (!previous && baselineRevision < floor)
              throw Error('这个任务编辑窗口已过期，请重新打开任务后保存。');
            adjustment -= previous?.delta || 0;
            if (!previous || previous.delta !== desiredDelta) revision++;
            const receipt = {
              id: actualTimeEditId,
              delta: desiredDelta,
              revision: previous?.revision || revision,
            };
            receipts = receipts.filter((item) => item.id !== actualTimeEditId).concat(receipt);
            // Bound per-task metadata. The revision floor rejects an evicted
            // receipt instead of silently counting an old retry again.
            for (const evicted of receipts.slice(0, -32)) floor = Math.max(floor, evicted.revision);
            receipts = receipts.slice(-32);
          } else if (desiredDelta !== 0) {
            throw Error('请重新打开任务后修改实际时长。');
          }
          task.actualTime = Math.max(0, current ? minutes + adjustment : Number(task.actualTime));
          task.actualTimeEdits = receipts;
          task.actualTimeEditRevision = revision;
          task.actualTimeEditFloor = floor;
          value = task;
          data = JSON.stringify(value);
        }
        db.prepare(
          'INSERT INTO records VALUES (?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data',
        ).run(kind, value.id, data);
        db.exec('COMMIT');
        result = value;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    } else if (op === 'delete') {
      db.prepare('DELETE FROM records WHERE kind=? AND id=?').run(kind, value);
      result = true;
    } else throw Error('Unknown operation');
    parentPort.postMessage({ id, result });
  } catch (e) {
    parentPort.postMessage({ id, error: e.message });
  }
});
