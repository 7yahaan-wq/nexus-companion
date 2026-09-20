const { randomUUID } = require('node:crypto');
class FocusService {
  constructor(store, onFinish = () => {}, now = Date.now) {
    this.store = store;
    this.onFinish = onFinish;
    this.now = now;
    this.active = null;
    this.busy = false;
  }
  async init() {
    this.active =
      (await this.store.list('settings')).find((x) => x.id === 'active-focus')?.session || null;
    await this.tick();
  }
  remaining() {
    if (!this.active) return 0;
    return this.active.paused
      ? this.active.remainingSeconds
      : Math.max(0, Math.ceil((this.active.deadline - this.now()) / 1000));
  }
  state() {
    return this.active ? { ...this.active, remainingSeconds: this.remaining() } : null;
  }
  async persist() {
    await this.store.save('settings', { id: 'active-focus', session: this.active });
    return this.state();
  }
  async start(minutes, task, title) {
    if (this.active) throw Error('已有专注计时，请先结束当前计时');
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 480)
      throw Error('专注时长应为 1–480 分钟');
    this.active = {
      id: randomUUID(),
      task: typeof task === 'string' ? task : '',
      title: String(title || '自由专注').slice(0, 200),
      startTime: new Date(this.now()).toISOString(),
      plannedSeconds: Math.round(minutes * 60),
      deadline: this.now() + Math.round(minutes * 60000),
      paused: false,
      remainingSeconds: Math.round(minutes * 60),
    };
    return this.persist();
  }
  async pause() {
    if (!this.active) throw Error('没有正在进行的专注');
    const remaining = this.remaining();
    this.active = {
      ...this.active,
      paused: !this.active.paused,
      remainingSeconds: remaining,
      deadline: this.now() + remaining * 1000,
    };
    return this.persist();
  }
  async finish(completed = false) {
    if (!this.active || this.busy) return null;
    this.busy = true;
    try {
      const record = {
        ...this.active,
        status: completed ? 'completed' : 'stopped',
        endTime: new Date(this.now()).toISOString(),
        actualSeconds: completed
          ? this.active.plannedSeconds
          : Math.max(0, this.active.plannedSeconds - this.remaining()),
      };
      await this.store.save('focus', record);
      this.active = null;
      await this.persist();
      if (completed) await this.onFinish(record);
      return record;
    } finally {
      this.busy = false;
    }
  }
  async tick() {
    if (this.active && !this.active.paused && this.remaining() <= 0) await this.finish(true);
  }
}
module.exports = { FocusService };
