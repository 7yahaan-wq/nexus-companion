const { Worker } = require('node:worker_threads');
const path = require('node:path');
class Store {
  constructor(file) {
    this.seq = 0;
    this.pending = new Map();
    this.worker = new Worker(path.join(__dirname, 'worker.cjs'), { workerData: { path: file } });
    this.worker.on('message', (m) => {
      const p = this.pending.get(m.id);
      if (p) {
        this.pending.delete(m.id);
        m.error ? p.reject(Error(m.error)) : p.resolve(m.result);
      }
    });
    this.worker.on('error', (e) => {
      for (const p of this.pending.values()) p.reject(e);
      this.pending.clear();
    });
  }
  call(op, kind, value) {
    return new Promise((resolve, reject) => {
      const id = ++this.seq;
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, op, kind, value });
    });
  }
  list(kind) {
    return this.call('list', kind);
  }
  save(kind, value) {
    return this.call('save', kind, value);
  }
  delete(kind, id) {
    return this.call('delete', kind, id);
  }
  snapshot() {
    return this.call('snapshot', 'settings');
  }
  merge(records) {
    return this.call('merge', 'settings', records);
  }
  integrity() {
    return this.call('integrity', 'settings');
  }
  close() {
    return this.worker.terminate();
  }
}
module.exports = { Store };
