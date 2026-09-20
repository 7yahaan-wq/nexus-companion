const { Worker } = require('node:worker_threads');
const path = require('node:path');
class ProviderClient {
  constructor() {
    this.seq = 0;
    this.pending = new Map();
    this.worker = new Worker(path.join(__dirname, 'worker.cjs'));
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
  call(method, ...args) {
    return new Promise((resolve, reject) => {
      const id = ++this.seq;
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, method, args });
    });
  }
  list() {
    return this.call('list');
  }
  logs(id) {
    return this.call('logs', id);
  }
  close() {
    return this.worker.terminate();
  }
}
module.exports = { ProviderClient };
