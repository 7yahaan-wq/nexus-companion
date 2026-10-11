const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough, Writable } = require('node:stream');
const { readQuota, readTaskUsage } = require('../electron/services/codex-account.cjs');

function fixture(overrides = {}, afterReply = () => {}) {
  const requests = [];
  let killed = false;
  const replies = {
    initialize: { userAgent: 'fixture-cli' },
    'account/read': {
      account: { type: 'chatgpt', email: 'fixture@example.test', planType: 'plus' },
    },
    'account/rateLimits/read': {
      rateLimits: { primary: { usedPercent: 25, windowDurationMins: 300, resetsAt: 2000000000 } },
    },
    'account/usage/read': {
      summary: {},
      threadUsage: {
        threadId: 'fixture-thread',
        estimatedUsageCreditsMicros: 1250000,
        estimatedUsageUsdMicros: 25000,
        groups: [
          {
            model: 'fixture-model',
            inputTokens: 100,
            cachedInputTokens: 50,
            outputTokens: 20,
            totalTokens: 120,
            estimatedUsageCreditsMicros: 1250000,
          },
        ],
      },
    },
    ...overrides,
  };
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = new Writable({
    write(chunk, encoding, done) {
      for (const line of String(chunk).trim().split('\n')) {
        const request = JSON.parse(line);
        requests.push(request);
        if (request.id === undefined || replies[request.method] === undefined) continue;
        queueMicrotask(() => {
          const value = replies[request.method];
          child.stdout.write(
            JSON.stringify(
              value?.error
                ? { id: request.id, error: value.error }
                : { id: request.id, result: value },
            ) + '\n',
          );
          afterReply(child, request);
        });
      }
      done();
    },
  });
  child.kill = () => {
    killed = true;
    return true;
  };
  return {
    requests,
    child,
    options: {
      executable: 'C:/fixture/codex.exe',
      spawnProcess: (command, args, options) => {
        assert.equal(command, 'C:/fixture/codex.exe');
        assert.deepEqual(args, ['app-server', '--stdio', '-c', 'analytics.enabled=false']);
        assert.equal(options.shell, false);
        assert.equal(options.windowsHide, true);
        assert.equal(options.env.CODEX_HOME, 'C:/fixture/codex-home');
        return child;
      },
      timeoutMs: 1000,
    },
    assertClosed() {
      assert.equal(killed, true);
    },
  };
}

test('quota queries only the logged-in account and preserves exact window semantics', async () => {
  const f = fixture();
  const result = await readQuota('C:/fixture/codex-home', f.options);
  assert.equal(result.status, 'AVAILABLE');
  assert.equal(result.accountLabel, 'fixture@example.test');
  assert.equal(result.quota.buckets[0].primary.usedPercent, 25);
  assert.equal(result.quota.buckets[0].primary.windowMinutes, 300);
  assert.equal(result.quota.source, 'app-server');
  assert.deepEqual(
    f.requests.map((r) => r.method),
    ['initialize', 'initialized', 'account/read', 'account/rateLimits/read'],
  );
  assert.equal(f.requests[0].params.clientInfo.name, 'nexus_companion');
  assert.equal(f.requests[0].params.capabilities.explicitGatewayOauth, true);
  assert.deepEqual(f.requests[2].params, { refreshToken: false });
  f.assertClosed();
});

test('task Credits come from official thread estimates rather than token pricing or account totals', async () => {
  const f = fixture();
  const result = await readTaskUsage('C:/fixture/codex-home', 'fixture-thread', f.options);
  assert.equal(result.status, 'AVAILABLE');
  assert.equal(result.threadUsage.estimatedCredits, 1.25);
  assert.equal(result.threadUsage.groups[0].estimatedCredits, 1.25);
  assert.equal(result.threadUsage.groups[0].totalTokens, 120);
  assert.equal('estimatedUsageUsdMicros' in result.threadUsage, false);
  assert.deepEqual(f.requests.at(-1).params, { threadId: 'fixture-thread' });
  f.assertClosed();
});

test('API key and logged-out accounts never query subscription usage', async () => {
  for (const account of [null, { type: 'apiKey' }]) {
    const f = fixture({ 'account/read': { account } });
    const result = await readQuota('C:/fixture/codex-home', f.options);
    assert.equal(result.status, 'UNAVAILABLE');
    assert.equal(result.reason, 'CHATGPT_REQUIRED');
    assert.equal(f.requests.length, 3);
    f.assertClosed();
  }
});

test('unsupported official usage methods return a safe unavailable result without upstream secrets', async () => {
  const f = fixture({
    'account/usage/read': { error: { code: -32601, message: 'sensitive-upstream-body' } },
  });
  const result = await readTaskUsage('C:/fixture/codex-home', 'fixture-thread', f.options);
  assert.equal(result.status, 'UNAVAILABLE');
  assert.equal(result.reason, 'UNSUPPORTED');
  assert.equal(JSON.stringify(result).includes('sensitive-upstream-body'), false);
  f.assertClosed();
});

test('another thread, missing estimate and unsafe estimates are never reported as zero usage', async () => {
  for (const threadUsage of [
    null,
    { threadId: 'other', estimatedUsageCreditsMicros: 5, groups: [] },
    { threadId: 'fixture-thread', estimatedUsageCreditsMicros: -1, groups: [] },
    {
      threadId: 'fixture-thread',
      estimatedUsageCreditsMicros: Number.MAX_SAFE_INTEGER + 1,
      groups: [],
    },
  ]) {
    const f = fixture({ 'account/usage/read': { summary: {}, threadUsage } });
    const result = await readTaskUsage('C:/fixture/codex-home', 'fixture-thread', f.options);
    assert.equal(result.status, 'UNAVAILABLE');
    assert.equal(result.threadUsage, null);
    assert.equal(result.reason, threadUsage === null ? 'NO_TASK_USAGE' : 'INVALID_RESPONSE');
    f.assertClosed();
  }
  const f = fixture({
    'account/usage/read': {
      summary: {},
      threadUsage: { threadId: 'fixture-thread', estimatedUsageCreditsMicros: 0, groups: [] },
    },
  });
  assert.equal(
    (await readTaskUsage('C:/fixture/codex-home', 'fixture-thread', f.options)).threadUsage
      .estimatedCredits,
    0,
  );
});

test('a stalled CLI has a bounded timeout and is always terminated', async () => {
  const f = fixture({ initialize: undefined });
  const result = await readQuota('C:/fixture/codex-home', { ...f.options, timeoutMs: 25 });
  assert.equal(result.status, 'UNAVAILABLE');
  assert.equal(result.reason, 'TIMEOUT');
  f.assertClosed();
});

test('invalid task identifiers are rejected before starting any subprocess', async () => {
  const f = fixture();
  const result = await readTaskUsage('C:/fixture/codex-home', '../auth.json', f.options);
  assert.equal(result.status, 'UNAVAILABLE');
  assert.equal(result.reason, 'INVALID_REQUEST');
  assert.equal(f.requests.length, 0);
});

for (const [name, inject, reason] of [
  ['malformed stdout', (child) => child.stdout.write('not-json\n'), 'INVALID_RESPONSE'],
  [
    'stdout limit',
    (child) => child.stdout.write('x'.repeat(2 * 1024 * 1024 + 1)),
    'INVALID_RESPONSE',
  ],
  ['stderr limit', (child) => child.stderr.write('x'.repeat(1024 * 1024 + 1)), 'INVALID_RESPONSE'],
  ['process exit', (child) => child.emit('exit', 1), 'QUERY_FAILED'],
]) {
  test(`${name} between RPC replies is terminal and cannot send another request`, async () => {
    const f = fixture({}, (child, request) => {
      if (request.method === 'initialize') inject(child);
    });
    const result = await readQuota('C:/fixture/codex-home', f.options);
    assert.equal(result.status, 'UNAVAILABLE');
    assert.equal(result.reason, reason);
    assert.deepEqual(
      f.requests.map((request) => request.method),
      ['initialize'],
    );
    f.assertClosed();
  });
}

test('a malformed line immediately following the final response cannot become a successful query', async () => {
  const f = fixture({}, (child, request) => {
    if (request.method === 'account/rateLimits/read') child.stdout.write('not-json\n');
  });
  const result = await readQuota('C:/fixture/codex-home', f.options);
  assert.equal(result.status, 'UNAVAILABLE');
  assert.equal(result.reason, 'INVALID_RESPONSE');
  assert.equal(result.quota, null);
  f.assertClosed();
});
