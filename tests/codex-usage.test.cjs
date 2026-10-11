const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { parseRun, parseLines, CodexProvider } = require('../electron/providers/codex.cjs');

const options = {
  file: 'controlled-session.jsonl',
  mtime: '2026-10-10T10:00:00Z',
  now: Date.parse('2026-10-10T10:05:00Z'),
};
const meta = { id: 'controlled-session', cwd: 'D:/controlled-project' };
const at = (minute) => `2026-10-10T10:${String(minute).padStart(2, '0')}:00.000Z`;
const tokens = (input = 100, output = 20) => ({
  input_tokens: input,
  cached_input_tokens: 40,
  cache_write_input_tokens: 10,
  output_tokens: output,
  reasoning_output_tokens: 5,
  total_tokens: input + output,
});
const tokenEvent = (minute, total, last = total, rateLimits = null) => ({
  timestamp: at(minute),
  type: 'event_msg',
  payload: {
    type: 'token_count',
    info:
      total || last
        ? {
            total_token_usage: total,
            last_token_usage: last,
            model_context_window: 200000,
          }
        : null,
    rate_limits: rateLimits,
  },
});
const quota = (used = 20, limitId = 'codex') => ({
  limit_id: limitId,
  limit_name: 'Controlled quota',
  primary: { used_percent: used, window_minutes: 300, resets_at: 1791630000 },
  secondary: { used_percent: 30, window_minutes: 10080, resets_at: 1792000000 },
  credits: { has_credits: false, unlimited: false, balance: '0' },
  plan_type: 'controlled-plan',
});

test('session totals replace snapshots, and quota-only repeats do not add tokens or refresh token time', () => {
  const r = parseRun(
    meta,
    [
      { type: 'turn_context', payload: { model: 'controlled-model' } },
      tokenEvent(0, tokens()),
      tokenEvent(1, tokens(300, 50), tokens(200, 30)),
      tokenEvent(2, tokens(300, 50), tokens(200, 30), quota(40)),
      tokenEvent(3, null, null, quota(41)),
    ],
    options,
  );
  assert.equal(r.usage?.total.totalTokens, 350);
  assert.equal(r.usage.lastRequest.totalTokens, 230);
  assert.equal(r.usage.total.cachedInputTokens, 40);
  assert.equal(r.usage.total.cacheWriteInputTokens, 10);
  assert.equal(r.usage.total.reasoningOutputTokens, 5);
  assert.equal(r.usage.observedAt, at(1));
  assert.equal(r.usage.model, 'controlled-model');
  assert.equal(r.usage.modelContextWindow, 200000);
  assert.equal(r.usage.coverage, 'full');
  assert.equal(r.accountQuota.observedAt, at(3));
  assert.equal(r.accountQuota.buckets[0].primary.usedPercent, 41);
});

test('missing usage is unknown, zero is valid, and malformed newer snapshots cannot erase valid counts', () => {
  assert.equal(parseRun(meta, [], options).usage, null);
  const r = parseRun(
    meta,
    [
      tokenEvent(0, { total_tokens: 0 }, null),
      tokenEvent(1, { input_tokens: -1, total_tokens: NaN }, { total_tokens: '100' }),
      tokenEvent(2, null, null, { primary: { used_percent: -1 } }),
    ],
    options,
  );
  assert.equal(r.usage.total.totalTokens, 0);
  assert.equal(r.usage.total.inputTokens, null);
  assert.equal(r.usage.lastRequest, null);
  assert.equal(r.usage.observedAt, at(0));
  assert.equal(r.accountQuota, null);
});

test('latest reported counter wins after a reset, without adding parent or previous snapshots', () => {
  const r = parseRun(
    { ...meta, forked_from_id: 'controlled-parent' },
    [tokenEvent(0, tokens(1000, 100)), tokenEvent(1, tokens(50, 10))],
    options,
  );
  assert.equal(r.usage.total.totalTokens, 60);
  assert.equal(r.usage.forkedFromSession, true);
  assert.equal(parseRun(meta, [tokenEvent(0, tokens())], options).usage.forkedFromSession, false);
});

test('usage without event timestamps stays undated, while quota never borrows the file mtime', () => {
  const record = tokenEvent(0, tokens(), tokens(), quota());
  delete record.timestamp;
  const r = parseRun(meta, [record], options);
  assert.equal(r.usage.total.totalTokens, 120);
  assert.equal(r.usage.observedAt, null);
  assert.equal(r.accountQuota, null);
});

test('last-request-only records remain distinct from cumulative usage and can report corrections', () => {
  const r = parseRun(
    meta,
    [tokenEvent(0, null, tokens(200, 30)), tokenEvent(1, null, tokens(180, 20))],
    options,
  );
  assert.equal(r.usage.total, null);
  assert.equal(r.usage.lastRequest.totalTokens, 200);
  assert.equal(r.usage.observedAt, at(1));
});

test('normalization preserves partial valid counts without inventing or double-counting totals', () => {
  const r = parseRun(
    meta,
    [
      tokenEvent(
        0,
        {
          input_tokens: 100,
          cached_input_tokens: 80,
          cache_write_input_tokens: Infinity,
          output_tokens: 20,
          reasoning_output_tokens: 5,
          total_tokens: Number.MAX_SAFE_INTEGER + 1,
        },
        null,
      ),
    ],
    options,
  );
  assert.deepEqual(r.usage.total, {
    inputTokens: 100,
    cachedInputTokens: 80,
    cacheWriteInputTokens: null,
    outputTokens: 20,
    reasoningOutputTokens: 5,
    totalTokens: null,
  });
});

test('quota buckets are independent and newest observations win without inventing freshness', () => {
  const r = parseRun(
    meta,
    [
      tokenEvent(1, null, null, quota(10, 'codex')),
      tokenEvent(3, null, null, quota(60, 'review')),
      tokenEvent(2, null, null, quota(20, 'codex')),
      tokenEvent(0, null, null, quota(1, 'codex')),
      { timestamp: at(4), type: 'event_msg', payload: { type: 'task_complete' } },
    ],
    options,
  );
  assert.equal(r.usage, null);
  assert.equal(r.accountQuota.observedAt, at(3));
  assert.equal(r.accountQuota.source, 'session-log');
  const buckets = new Map(r.accountQuota.buckets.map((bucket) => [bucket.limitId, bucket]));
  assert.equal(buckets.size, 2);
  assert.equal(buckets.get('codex').primary.usedPercent, 20);
  assert.equal(buckets.get('codex').observedAt, at(2));
  assert.equal(buckets.get('review').primary.usedPercent, 60);
});

test('official camelCase responses and keyed quota maps normalize to the same safe contract', () => {
  const { normalizeQuota } = require('../electron/providers/usage.cjs');
  const result = normalizeQuota(
    {
      rateLimits: { primary: { usedPercent: 90 } },
      rateLimitsByLimitId: {
        codex: {
          primary: { usedPercent: 25.5, windowDurationMins: 300, resetsAt: 1791630000 },
          secondary: null,
          credits: { hasCredits: true, unlimited: false, balance: '12.50' },
          planType: 'controlled-plan',
        },
        review: { limitId: 'review', primary: { usedPercent: 110, windowMinutes: 60 } },
      },
    },
    at(1),
    'app-server',
  );
  assert.equal(result.source, 'app-server');
  assert.equal(result.buckets.length, 2);
  const main = result.buckets.find((bucket) => bucket.limitId === 'codex');
  assert.equal(main.primary.usedPercent, 25.5);
  assert.equal(main.primary.windowMinutes, 300);
  assert.equal(main.primary.resetsAt, new Date(1791630000 * 1000).toISOString());
  assert.equal(main.credits.balance, '12.50');
  assert.equal(main.credits.hasCredits, true);
  assert.equal(
    result.buckets.find((bucket) => bucket.limitId === 'review').primary.usedPercent,
    110,
  );
});

test('quota normalization rejects arbitrary strings and invalid values, and preserves unknown reset times', () => {
  const { normalizeQuota } = require('../electron/providers/usage.cjs');
  assert.equal(normalizeQuota({}, at(0)), null);
  assert.equal(normalizeQuota({ limit_id: 'codex', primary: { used_percent: '20' } }, at(0)), null);
  assert.equal(normalizeQuota({ credits: { balance: 'untrusted free text' } }, at(0)), null);
  assert.equal(normalizeQuota(quota(), 'invalid time'), null);
  const result = normalizeQuota(
    {
      primary: { used_percent: 0, window_minutes: -1, resets_at: 'invalid time' },
      credits: { has_credits: true, unlimited: true, balance: null },
    },
    at(0),
  );
  assert.equal(result.buckets[0].limitId, 'codex');
  assert.deepEqual(result.buckets[0].primary, {
    usedPercent: 0,
    windowMinutes: null,
    resetsAt: null,
  });
  assert.equal(result.buckets[0].credits.unlimited, true);
});

async function fixture(t) {
  const base = path.resolve('.test-data');
  await fs.mkdir(base, { recursive: true });
  const root = await fs.mkdtemp(path.join(base, 'codex-usage-'));
  const sessions = path.join(root, 'sessions');
  await fs.mkdir(sessions);
  const files = [];
  t.after(async () => {
    for (const file of files) await fs.unlink(file);
    await fs.rmdir(sessions);
    await fs.rmdir(root);
  });
  return {
    root,
    async write(name, records, suffix = '') {
      const file = path.join(sessions, `${name}.jsonl`);
      if (!files.includes(file)) files.push(file);
      await fs.writeFile(file, records.map((r) => JSON.stringify(r)).join('\n') + '\n' + suffix);
      return file;
    },
  };
}

test('provider combines newest quota per bucket across sessions and tolerates a partial final line', async (t) => {
  const data = await fixture(t);
  await data.write(
    'a',
    [
      { type: 'session_meta', payload: { id: 'fixture-a' } },
      tokenEvent(0, tokens(), tokens(), quota(15, 'codex')),
    ],
    '{"type":"event_msg","payload":',
  );
  await data.write('b', [
    { type: 'session_meta', payload: { id: 'fixture-b' } },
    tokenEvent(2, null, null, quota(45, 'codex')),
    tokenEvent(3, null, null, quota(10, 'review')),
  ]);
  const result = await new CodexProvider(data.root).list();
  assert.equal(result.runs.length, 2);
  assert.equal(result.runs.find((run) => run.id === 'fixture-a').usage.total.totalTokens, 120);
  assert.equal(result.runs.find((run) => run.id === 'fixture-b').usage, null);
  assert.equal(result.accountQuota.observedAt, at(3));
  assert.equal(result.accountQuota.buckets.length, 2);
  assert.equal(
    result.accountQuota.buckets.find((bucket) => bucket.limitId === 'codex').primary.usedPercent,
    45,
  );
});

test('large sessions report tail coverage and do not invent missing model or token observations', async (t) => {
  const data = await fixture(t);
  await data.write('large', [
    { type: 'session_meta', payload: { id: 'fixture-large' } },
    { type: 'turn_context', payload: { model: 'old-model-before-unread-region' } },
    tokenEvent(0, tokens(1000, 100)),
    { type: 'fixture_padding', payload: { data: 'x'.repeat(2 * 1024 * 1024 + 100) } },
    tokenEvent(3, tokens(5000, 200)),
  ]);
  const result = await new CodexProvider(data.root).list();
  assert.equal(result.runs.length, 1);
  assert.equal(result.runs[0].usage.total.totalTokens, 5200);
  assert.equal(result.runs[0].usage.coverage, 'tail');
  assert.equal(result.runs[0].usage.model, null);
});

test('provider refreshes cached files without changing usage freshness for unrelated events', async (t) => {
  const data = await fixture(t);
  const records = [
    { type: 'session_meta', payload: { id: 'fixture-cache' } },
    tokenEvent(0, tokens(), tokens(), quota(15)),
  ];
  await data.write('cache', records);
  const provider = new CodexProvider(data.root);
  const first = await provider.list();
  records.push({ timestamp: at(3), type: 'event_msg', payload: { type: 'task_complete' } });
  await data.write('cache', records);
  const second = await provider.list();
  assert.equal(second.runs[0].status, 'COMPLETED');
  assert.deepEqual(second.runs[0].usage, first.runs[0].usage);
  assert.deepEqual(second.accountQuota, first.accountQuota);
  assert.deepEqual((await provider.list()).accountQuota, first.accountQuota);
});

test('a tail without usage stays unknown instead of presenting a stale head snapshot as current', async (t) => {
  const data = await fixture(t);
  await data.write('missing-tail-usage', [
    { type: 'session_meta', payload: { id: 'fixture-missing-tail-usage' } },
    tokenEvent(0, tokens(), tokens(), quota()),
    { type: 'fixture_padding', payload: { data: 'x'.repeat(2 * 1024 * 1024 + 100) } },
    { timestamp: at(3), type: 'event_msg', payload: { type: 'task_complete' } },
  ]);
  const result = await new CodexProvider(data.root).list();
  assert.equal(result.runs.length, 1);
  assert.equal(result.runs[0].usage, null);
  assert.equal(result.accountQuota, null);
});

test('malformed JSONL values are skipped without discarding a session or fabricating metadata', () => {
  const records = parseLines(
    'null\n[]\n7\n"text"\n{"type":"event_msg","payload":null}\n' +
      JSON.stringify(tokenEvent(0, tokens())) +
      '\n{"incomplete":',
  );
  const r = parseRun(meta, records, options);
  assert.equal(r.usage.total.totalTokens, 120);
  assert.equal(r.accountQuota, null);
});
