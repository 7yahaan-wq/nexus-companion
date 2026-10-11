const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');

const failure = (reason) => Object.assign(new Error(reason), { reason });
const integer = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : null);
const label = (value) =>
  typeof value === 'string' ? value.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 256) : null;

async function executablePath() {
  const name = process.platform === 'win32' ? 'codex.exe' : 'codex';
  const candidates = [];
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    const base = path.join(process.env.LOCALAPPDATA, 'OpenAI', 'Codex', 'bin');
    try {
      const entries = await fs.readdir(base, { withFileTypes: true });
      const folders = await Promise.all(
        entries
          .filter((entry) => entry.isDirectory())
          .map(async (entry) => {
            const directory = path.join(base, entry.name);
            return { directory, modified: (await fs.stat(directory)).mtimeMs };
          }),
      );
      folders.sort((a, b) => b.modified - a.modified);
      candidates.push(...folders.slice(0, 20).map(({ directory }) => path.join(directory, name)));
    } catch {}
  }
  for (const directory of (process.env.PATH || '').split(path.delimiter)) {
    if (path.isAbsolute(directory)) candidates.push(path.join(directory, name));
  }
  for (const candidate of candidates) {
    try {
      if ((await fs.stat(candidate)).isFile()) return await fs.realpath(candidate);
    } catch {}
  }
  throw failure('CLI_UNAVAILABLE');
}

function threadEstimate(raw, threadId) {
  const value = raw?.threadUsage;
  const micros = integer(value?.estimatedUsageCreditsMicros);
  if (
    !value ||
    value.threadId !== threadId ||
    micros === null ||
    !Array.isArray(value.groups) ||
    value.groups.length > 1000
  )
    return null;
  return {
    threadId,
    estimatedCredits: micros / 1_000_000,
    observedAt: new Date().toISOString(),
    groups: value.groups.flatMap((group) => {
      const credits = integer(group?.estimatedUsageCreditsMicros);
      if (credits === null) return [];
      return [
        {
          model: label(group.model),
          speed: label(group.speed),
          reasoningEffort: label(group.reasoningEffort),
          inputTokens: integer(group.inputTokens),
          cachedInputTokens: integer(group.cachedInputTokens),
          outputTokens: integer(group.outputTokens),
          totalTokens: integer(group.totalTokens),
          estimatedCredits: credits / 1_000_000,
        },
      ];
    }),
  };
}

async function query(root, threadId, options) {
  let child;
  let timer;
  let closed = false;
  let terminalError = null;
  let accountLabel = null;
  const pending = new Map();
  const resultKey = threadId === null ? 'quota' : 'threadUsage';
  const failAll = (error) => {
    if (closed) return;
    terminalError ||= error;
    for (const { reject } of pending.values()) reject(terminalError);
    pending.clear();
  };
  try {
    const executable = options.executable || (await executablePath());
    child = (options.spawnProcess || spawn)(
      executable,
      ['app-server', '--stdio', '-c', 'analytics.enabled=false'],
      {
        shell: false,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, CODEX_HOME: root },
      },
    );
    timer = setTimeout(() => failAll(failure('TIMEOUT')), options.timeoutMs || 20000);
    let nextId = 0;
    let output = '';
    let outputBytes = 0;
    let errorBytes = 0;
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      if (closed || terminalError) return;
      outputBytes += Buffer.byteLength(chunk);
      if (outputBytes > 2 * 1024 * 1024) {
        failAll(failure('INVALID_RESPONSE'));
        return;
      }
      output += chunk;
      let end;
      while ((end = output.indexOf('\n')) >= 0) {
        const line = output.slice(0, end);
        output = output.slice(end + 1);
        if (!line.trim()) continue;
        let message;
        try {
          message = JSON.parse(line);
        } catch {
          failAll(failure('INVALID_RESPONSE'));
          return;
        }
        const request = pending.get(message?.id);
        if (!request) continue;
        pending.delete(message.id);
        if (message.error) {
          request.reject(
            failure([-32601, -32602].includes(message.error.code) ? 'UNSUPPORTED' : 'QUERY_FAILED'),
          );
        } else if (Object.hasOwn(message, 'result')) request.resolve(message.result);
        else request.reject(failure('INVALID_RESPONSE'));
      }
    });
    // Drain diagnostics without storing or returning potentially sensitive upstream text.
    child.stderr.on('data', (chunk) => {
      if (closed || terminalError) return;
      errorBytes += chunk.length;
      if (errorBytes > 1024 * 1024) failAll(failure('INVALID_RESPONSE'));
    });
    child.on('error', (error) =>
      failAll(failure(error.code === 'ENOENT' ? 'CLI_UNAVAILABLE' : 'QUERY_FAILED')),
    );
    child.on('exit', () => {
      if (!closed) failAll(failure('QUERY_FAILED'));
    });
    child.stdin.on('error', () => {
      if (!closed) failAll(failure('QUERY_FAILED'));
    });
    const send = (method, params, notification = false) => {
      if (terminalError || closed) throw terminalError || failure('QUERY_FAILED');
      const id = ++nextId;
      if (notification) {
        child.stdin.write(JSON.stringify({ method, params }) + '\n');
        return;
      }
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        child.stdin.write(
          JSON.stringify({ id, method, ...(params === undefined ? {} : { params }) }) + '\n',
        );
      }).then((result) => {
        // A reply may be followed by a fatal stream error in the same event-loop turn.
        // Validate again before its continuation can return data or issue another RPC.
        if (terminalError || closed) throw terminalError || failure('QUERY_FAILED');
        return result;
      });
    };
    await send('initialize', {
      clientInfo: {
        name: 'nexus_companion',
        title: 'Nexus Companion',
        version: require('../../package.json').version,
      },
      capabilities: { explicitGatewayOauth: true, experimentalApi: true },
    });
    send('initialized', {}, true);
    const account = (await send('account/read', { refreshToken: false }))?.account;
    if (account?.type !== 'chatgpt') throw failure('CHATGPT_REQUIRED');
    accountLabel = label(account.email);
    if (threadId === null) {
      const raw = await send('account/rateLimits/read');
      const quota = require('../providers/usage.cjs').normalizeQuota(
        raw,
        new Date().toISOString(),
        'app-server',
      );
      if (!quota) throw failure('INVALID_RESPONSE');
      return { status: 'AVAILABLE', accountLabel, quota, reason: null };
    }
    const raw = await send('account/usage/read', { threadId });
    if (raw?.threadUsage === null) throw failure('NO_TASK_USAGE');
    const threadUsage = threadEstimate(raw, threadId);
    if (!threadUsage) throw failure('INVALID_RESPONSE');
    return { status: 'AVAILABLE', accountLabel, threadUsage, reason: null };
  } catch (error) {
    return {
      status: 'UNAVAILABLE',
      accountLabel,
      [resultKey]: null,
      reason: error.reason || 'QUERY_FAILED',
    };
  } finally {
    closed = true;
    clearTimeout(timer);
    if (child) {
      child.stdin.end();
      child.kill();
    }
  }
}

// Only these read operations are exposed. No generic RPC, login, prompt or thread execution.
async function readQuota(root, options = {}) {
  return query(root, null, options);
}
async function readTaskUsage(root, threadId, options = {}) {
  if (typeof threadId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(threadId))
    return {
      status: 'UNAVAILABLE',
      accountLabel: null,
      threadUsage: null,
      reason: 'INVALID_REQUEST',
    };
  return query(root, threadId, options);
}
module.exports = { readQuota, readTaskUsage };
