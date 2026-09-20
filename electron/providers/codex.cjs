const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
async function readSlice(file, tail, max = 2 * 1024 * 1024) {
  const h = await fs.open(file, 'r');
  try {
    const stat = await h.stat();
    const start = tail ? Math.max(0, stat.size - max) : 0;
    const b = Buffer.alloc(Math.min(stat.size, max));
    const { bytesRead } = await h.read(b, 0, b.length, start);
    const text = b.subarray(0, bytesRead).toString('utf8');
    return {
      text: start ? text.slice(text.indexOf('\n') + 1) : text,
      mtime: stat.mtime.toISOString(),
      size: stat.size,
    };
  } finally {
    await h.close();
  }
}
function parseLines(text) {
  return text.split('\n').flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
}
function timestamp(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d+(\.\d+)?$/.test(value)
        ? Number(value)
        : null;
  const d = new Date(numeric !== null ? (numeric < 1e11 ? numeric * 1000 : numeric) : value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : fallback;
}
function parseRun(meta, records, { file, mtime, title, now = Date.now() }) {
  const id = meta.id || meta.session_id || path.basename(file, '.jsonl');
  let status = 'UNAVAILABLE',
    startTime = null,
    endTime = null,
    lastMessage = '',
    currentStep = '未观察到当前轮次状态';
  const logs = [],
    activities = [];
  const changedFiles = new Set();
  let lastEvent = null,
    observedAt = null;
  for (const r of records) {
    const p = r.payload || {};
    const time = timestamp(r.timestamp, timestamp(p.timestamp, mtime));
    if (!observedAt || time > observedAt) observedAt = time;
    const type = p.type;
    if (r.type === 'event_msg') {
      if (['task_started', 'turn_started'].includes(type)) {
        status = 'RUNNING';
        startTime = timestamp(p.started_at, time);
        endTime = null;
        currentStep = '本地记录：轮次已开始';
        lastEvent = time;
      }
      if (['task_complete', 'task_completed', 'turn_completed'].includes(type)) {
        status = 'COMPLETED';
        endTime = time;
        currentStep = '本地记录：轮次已完成';
        lastEvent = time;
      }
      if (['task_failed', 'turn_failed'].includes(type)) {
        status = 'FAILED';
        endTime = time;
        currentStep = '本地记录：执行失败';
        lastEvent = time;
      }
      if (['turn_aborted', 'task_cancelled'].includes(type)) {
        status = 'CANCELLED';
        endTime = time;
        currentStep = '本地记录：已取消';
        lastEvent = time;
      }
      if (type === 'agent_message' && typeof p.message === 'string') {
        lastMessage = p.message;
        logs.push(`[${time}] ${p.message}`);
      }
      if (
        [
          'task_started',
          'task_complete',
          'task_completed',
          'turn_aborted',
          'task_failed',
          'turn_failed',
        ].includes(type)
      ) {
        logs.push(`[${time}] ${type}`);
        activities.push({ time, title: type, status });
      }
      const item = p.item;
      if (type === 'item_completed' && item) {
        if (['fileChange', 'FileChange'].includes(item.type)) {
          const changes = Array.isArray(item.changes)
            ? item.changes.map((c) => c.path).filter(Boolean)
            : Object.keys(item.changes || {});
          for (const file of changes) {
            changedFiles.add(file);
            activities.push({ time, title: 'Modified ' + file, status: item.status || 'observed' });
          }
        }
        if (['commandExecution', 'CommandExecution'].includes(item.type))
          activities.push({
            time,
            title: 'Command ' + String(item.command || '').slice(0, 180),
            status: item.status || 'observed',
          });
        if (['agentMessage', 'AgentMessage'].includes(item.type) && item.text) {
          lastMessage = item.text;
          logs.push(`[${time}] ${item.text}`);
        }
        if (['fileChange', 'FileChange'].includes(item.type) && Array.isArray(item.changes)) {
          for (const c of item.changes) if (c.path) changedFiles.add(c.path);
        }
        if (['commandExecution', 'CommandExecution'].includes(item.type))
          logs.push(
            `[${time}] command ${item.status || ''}: ${String(item.command || '').slice(0, 300)}`,
          );
      }
    }
    if (r.type === 'response_item' && p.type === 'message' && p.role === 'assistant') {
      const text = (p.content || [])
        .filter((x) => x.type === 'output_text')
        .map((x) => x.text)
        .join('\n');
      if (text) {
        lastMessage = text;
        logs.push(`[${time}] ${text}`);
      }
    }
  }
  observedAt = observedAt || mtime;
  const stale = now - new Date(observedAt).getTime() > 120000;
  if (status === 'RUNNING' && stale) {
    status = 'UNAVAILABLE';
    currentStep = '记录超过 2 分钟未更新，实时状态未知';
  }
  const duration =
    startTime && endTime && new Date(endTime) >= new Date(startTime)
      ? new Date(endTime) - new Date(startTime)
      : null;
  return {
    id,
    taskId: id,
    agentName: meta.agent_nickname || 'Codex',
    agentType: meta.source === 'cli' ? 'CLI' : 'Codex',
    project: path.basename(meta.cwd || ''),
    taskName: title || `Codex · ${id.slice(0, 8)}`,
    status,
    startTime,
    endTime,
    duration,
    progress: null,
    currentStep,
    lastMessage: lastMessage.slice(-3000),
    workingDirectory: meta.cwd || '',
    changedFiles: [...changedFiles],
    logs: logs.slice(-1500),
    activities: activities.slice(-200),
    error: status === 'FAILED' ? lastMessage : null,
    provider: 'codex-local',
    observedAt,
    lastEvent,
    source: '本地会话记录（非实时 API）',
  };
}
class CodexProvider {
  constructor(root = process.env.CODEX_HOME || path.join(os.homedir(), '.codex')) {
    this.root = root;
    this.id = 'codex-local';
    this.capabilities = { stop: false, retry: false, live: false };
    this.cache = new Map();
    this.files = new Map();
  }
  async discover() {
    const root = path.join(this.root, 'sessions');
    const found = [];
    const walk = async (dir, depth) => {
      if (depth > 4 || found.length >= 120) return;
      const names = await fs.readdir(dir, { withFileTypes: true });
      names.sort((a, b) => b.name.localeCompare(a.name));
      for (const entry of names) {
        if (found.length >= 120) break;
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) await walk(p, depth + 1);
        else if (entry.isFile() && entry.name.endsWith('.jsonl')) found.push(p);
      }
    };
    await walk(root, 0);
    return found;
  }
  async list() {
    try {
      const files = await this.discover();
      let titles = new Map();
      try {
        const index = await readSlice(path.join(this.root, 'session_index.jsonl'), true);
        for (const r of parseLines(index.text)) titles.set(r.id, r.thread_name || r.title);
      } catch {}
      const runs = [];
      for (const file of files) {
        try {
          const stat = await fs.stat(file);
          let cached = this.cache.get(file);
          if (!cached || cached.size !== stat.size || cached.mtime !== stat.mtimeMs) {
            const [head, tail] = await Promise.all([
              readSlice(file, false, 256 * 1024),
              readSlice(file, true),
            ]);
            const meta =
              parseLines(head.text).find((r) => r.type === 'session_meta')?.payload || {};
            const records = parseLines(tail.text);
            cached = { size: stat.size, mtime: stat.mtimeMs, meta, records };
            this.cache.set(file, cached);
          }
          const run = parseRun(cached.meta, cached.records, {
            file,
            mtime: stat.mtime.toISOString(),
            title: titles.get(cached.meta.id),
          });
          const existing = runs.findIndex((r) => r.id === run.id);
          if (existing < 0 || runs[existing].observedAt < run.observedAt) {
            this.files.set(run.id, file);
            if (existing >= 0) runs.splice(existing, 1);
            runs.push({ ...run, logs: [] });
          }
        } catch {}
      }
      runs.sort((a, b) => b.observedAt.localeCompare(a.observedAt));
      return {
        runs,
        capabilities: this.capabilities,
        availability: 'LOCAL_ONLY',
        message:
          '只读本地会话记录；运行状态为最近观测，实时审批 / 进度 / 停止 / 重试 Unsupported。最多展示最近 120 个会话，日志读取末尾 2 MB。',
        root: this.root,
        scannedAt: new Date().toISOString(),
      };
    } catch (e) {
      return {
        runs: [],
        capabilities: this.capabilities,
        availability: 'UNAVAILABLE',
        message: `Unavailable · 无法读取 Codex 会话目录：${e.code || e.message}`,
        root: this.root,
        scannedAt: new Date().toISOString(),
      };
    }
  }
  async logs(id) {
    const file = this.files.get(id);
    if (!file) throw Error('会话尚未加载或不存在');
    const c = this.cache.get(file);
    const tail = await readSlice(file, true);
    return parseRun(c?.meta || {}, parseLines(tail.text), { file, mtime: tail.mtime }).logs;
  }
}
module.exports = { CodexProvider, parseRun, parseLines };
