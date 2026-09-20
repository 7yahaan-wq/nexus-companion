const { occurrences } = require('../generated/calendar.cjs');
class NotificationService {
  constructor(store, send, now = Date.now) {
    this.store = store;
    this.send = send;
    this.now = now;
    this.ledger = new Set();
    this.previous = new Map();
    this.initialized = false;
    this.busy = false;
  }
  async init() {
    const saved = (await this.store.list('settings')).find((s) => s.id === 'notification-ledger');
    this.ledger = new Set(saved?.keys || []);
  }
  async notify(key, type, title, body, settings) {
    if (settings?.notifications?.[type] === false || this.ledger.has(key)) return false;
    this.ledger.add(key);
    while (this.ledger.size > 1000) this.ledger.delete(this.ledger.values().next().value);
    await this.store.save('settings', { id: 'notification-ledger', keys: [...this.ledger] });
    this.send(title, body);
    return true;
  }
  async agents(runs) {
    const settings = (await this.store.list('settings')).find((s) => s.id === 'appearance');
    for (const r of runs) {
      const before = this.previous.get(r.id);
      if (this.initialized && before && before !== r.status) {
        const type = { COMPLETED: 'completed', FAILED: 'failed', WAITING_APPROVAL: 'approval' }[
          r.status
        ];
        if (type)
          await this.notify(
            `${r.id}:${r.status}:${r.lastEvent || r.observedAt}`,
            type,
            `${r.agentName} · ${r.status}`,
            r.taskName,
            settings,
          );
      }
      this.previous.set(r.id, r.status);
    }
    this.initialized = true;
  }
  async calendar() {
    if (this.busy) return;
    this.busy = true;
    try {
      const [events, settings] = await Promise.all([
        this.store.list('events'),
        this.store.list('settings'),
      ]);
      const now = this.now();
      const list = occurrences(events, new Date(now - 30000), new Date(now + 60000));
      for (const e of list) {
        const start = new Date(e.start).getTime();
        if (start >= now - 30000 && start <= now + 60000)
          await this.notify(
            `event:${e.id}:${e.start}`,
            'calendar',
            '日程即将开始',
            e.title,
            settings.find((s) => s.id === 'appearance'),
          );
      }
    } finally {
      this.busy = false;
    }
  }
}
module.exports = { NotificationService };
