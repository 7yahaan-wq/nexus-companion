const { randomUUID } = require('node:crypto');
class FocusService {
  constructor(store, onFinish = () => {}, now = Date.now) {
    this.store = store;
    this.onFinish = onFinish;
    this.now = now;
    this.active = null;
    this.queue = Promise.resolve();
  }
  serialize(action) {
    const result = this.queue.then(action);
    this.queue = result.catch(() => {});
    return result;
  }
  init() {
    return this.serialize(async () => {
      this.active =
        (await this.store.list('settings')).find((x) => x.id === 'active-focus')?.session || null;
      if (this.active && !this.active.paused && this.remaining() <= 0)
        await this.finishActive(true);
    });
  }
  remainingMilliseconds() {
    if (!this.active) return 0;
    return this.active.paused
      ? (this.active.remainingMs ?? this.active.remainingSeconds * 1000)
      : Math.max(0, this.active.deadline - this.now());
  }
  remaining() {
    return Math.ceil(this.remainingMilliseconds() / 1000);
  }
  state() {
    return this.active ? { ...this.active, remainingSeconds: this.remaining() } : null;
  }
  async persist(session) {
    await this.store.save('settings', { id: 'active-focus', session });
    this.active = session;
    return this.state();
  }
  start(minutes, task, title) {
    return this.serialize(async () => {
      if (this.active) throw Error('已有专注计时，请先结束当前计时');
      if (!Number.isFinite(minutes) || minutes < 1 || minutes > 480)
        throw Error('专注时长应为 1–480 分钟');
      return this.persist({
        id: randomUUID(),
        task: typeof task === 'string' ? task : '',
        title: String(title || '自由专注').slice(0, 200),
        startTime: new Date(this.now()).toISOString(),
        plannedSeconds: Math.round(minutes * 60),
        deadline: this.now() + Math.round(minutes * 60000),
        paused: false,
        remainingSeconds: Math.round(minutes * 60),
      });
    });
  }
  pause() {
    return this.serialize(async () => {
      if (!this.active) throw Error('没有正在进行的专注');
      const remainingMs = this.remainingMilliseconds();
      if (remainingMs <= 0) {
        await this.finishActive(true);
        return null;
      }
      return this.persist({
        ...this.active,
        paused: !this.active.paused,
        remainingSeconds: Math.ceil(remainingMs / 1000),
        remainingMs,
        deadline: this.now() + remainingMs,
      });
    });
  }
  finish(completed = false) {
    return this.serialize(() => this.finishActive(completed));
  }
  async finishActive(completed) {
    if (!this.active) return null;
    const record = {
      ...this.active,
      status: completed ? 'completed' : 'stopped',
      endTime: new Date(this.now()).toISOString(),
      actualSeconds: completed
        ? this.active.plannedSeconds
        : Math.max(0, Math.floor(this.active.plannedSeconds - this.remainingMilliseconds() / 1000)),
    };
    const result = await this.store.finishFocus(record);
    this.active = null;
    if (completed && result.created) await this.onFinish(result.record);
    return result.record;
  }
  tick() {
    return this.serialize(async () => {
      if (this.active && !this.active.paused && this.remaining() <= 0)
        await this.finishActive(true);
    });
  }
}
module.exports = { FocusService };
