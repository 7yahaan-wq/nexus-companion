const { parentPort, workerData } = require('node:worker_threads');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
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
parentPort.on('message', ({ id, op, kind, value }) => {
  try {
    if (!kinds.has(kind)) throw Error('Unknown collection');
    let result;
    if (op === 'snapshot') {
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
    } else if (op === 'integrity') result = db.prepare('PRAGMA quick_check').get();
    else if (op === 'list')
      result = db
        .prepare('SELECT data FROM records WHERE kind=?')
        .all(kind)
        .map((r) => JSON.parse(r.data));
    else if (op === 'save') {
      if (!value || typeof value.id !== 'string' || value.id.length > 200)
        throw Error('Invalid record');
      const data = JSON.stringify(value);
      if (data.length > 2_000_000) throw Error('Record too large');
      db.prepare(
        'INSERT INTO records VALUES (?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data',
      ).run(kind, value.id, data);
      result = value;
    } else if (op === 'delete') {
      db.prepare('DELETE FROM records WHERE kind=? AND id=?').run(kind, value);
      result = true;
    } else throw Error('Unknown operation');
    parentPort.postMessage({ id, result });
  } catch (e) {
    parentPort.postMessage({ id, error: e.message });
  }
});
