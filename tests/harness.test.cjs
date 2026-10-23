const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { runStages, createPlan } = require('../scripts/verification-runner.cjs');

async function fixture() {
  const base = path.resolve('.test-data');
  await fs.mkdir(base, { recursive: true });
  const root = await fs.mkdtemp(path.join(base, 'harness-unit-'));
  await fs.writeFile(path.join(root, 'input.txt'), 'controlled source');
  let calls = 0;
  let clock = Date.parse('2026-10-23T08:00:00Z');
  const options = {
    root,
    stages: [
      {
        id: 'check',
        name: 'controlled check',
        args: ['fixture'],
        inputs: ['input.txt'],
        outputs: [],
      },
    ],
    reportPath: '.test-data/result.json',
    toolchain: { node: 'controlled-v1' },
    env: { CONTROLLED_SETTING: 'one' },
    now: () => clock,
    onEvent: () => {},
    execute: async () => {
      calls++;
      return { status: 0, stdout: 'controlled pass\n', stderr: '' };
    },
  };
  return {
    root,
    options,
    get calls() {
      return calls;
    },
    advance(ms) {
      clock += ms;
    },
    run: (extra = {}) => runStages({ ...options, ...extra }),
    write: (name, value) => fs.writeFile(path.join(root, name), value),
    read: async (name) => JSON.parse(await fs.readFile(path.join(root, name), 'utf8')),
  };
}

test('fresh executes, explicit resume reuses original evidence, and fresh never silently skips', async () => {
  const f = await fixture();
  const first = await f.run();
  assert.equal(first.passed, true);
  assert.equal(first.results[0].executed, true);
  f.advance(1000);
  const resumed = await f.run({ resume: true });
  assert.equal(f.calls, 1);
  assert.equal(resumed.results[0].reused, true);
  assert.equal(resumed.results[0].passedAt, first.results[0].passedAt);
  assert.equal(resumed.results[0].log.path, first.results[0].log.path);
  await f.run();
  assert.equal(f.calls, 2);
});

test('old reports, corrupt cache, expired records, and missing or changed logs cannot be reused', async () => {
  const f = await fixture();
  await fs.mkdir(path.join(f.root, '.test-data'), { recursive: true });
  await f.write(
    '.test-data/verification.json',
    JSON.stringify({ results: [{ name: 'controlled check', passed: true }] }),
  );
  let report = await f.run({ resume: true });
  assert.equal(f.calls, 1);
  await f.write('.test-data/verification-cache.json', '{broken');
  report = await f.run({ resume: true });
  assert.equal(f.calls, 2);
  f.advance(24 * 60 * 60 * 1000 + 1);
  report = await f.run({ resume: true });
  assert.equal(f.calls, 3);
  await fs.unlink(path.join(f.root, report.results[0].log.path));
  report = await f.run({ resume: true });
  assert.equal(f.calls, 4);
  await f.write(report.results[0].log.path, 'changed evidence');
  await f.run({ resume: true });
  assert.equal(f.calls, 5);
});

test('source, command, toolchain, and effective environment changes each invalidate a pass', async () => {
  const f = await fixture();
  await f.run();
  await f.write('input.txt', 'changed source');
  await f.run({ resume: true });
  assert.equal(f.calls, 2);
  f.options.stages[0].args = ['fixture', '--changed'];
  await f.run({ resume: true });
  assert.equal(f.calls, 3);
  f.options.toolchain = { node: 'controlled-v2' };
  await f.run({ resume: true });
  assert.equal(f.calls, 4);
  f.options.env = { CONTROLLED_SETTING: 'two', PRIVATE_TOKEN: 'never-persist-this-value' };
  await f.run({ resume: true });
  assert.equal(f.calls, 5);
  const cache = await fs.readFile(path.join(f.root, '.test-data/verification-cache.json'), 'utf8');
  assert.equal(cache.includes('never-persist-this-value'), false);
});

test('different tool call IDs reuse the same npm workflow and are not passed to actual children', async () => {
  const f = await fixture();
  f.options.stages[0].args = [
    '-e',
    'process.stdout.write(process.env.CODEX_TOOL_CALL_ID === undefined ? "absent" : "present")',
  ];
  const original = { ...f.options.env, CODEX_TOOL_CALL_ID: 'controlled-fresh-call' };
  const first = await f.run({ execute: undefined, env: original });
  assert.equal(first.passed, true);
  assert.equal(await fs.readFile(path.join(f.root, first.results[0].log.path), 'utf8'), 'absent');
  assert.equal(
    original.CODEX_TOOL_CALL_ID,
    'controlled-fresh-call',
    'Do not mutate the caller environment',
  );
  const resumed = await f.run({
    execute: undefined,
    resume: true,
    env: { ...original, CODEX_TOOL_CALL_ID: 'controlled-resume-call' },
  });
  assert.equal(resumed.results[0].reused, true);
  assert.equal(resumed.results[0].inputFingerprint, first.results[0].inputFingerprint);
  assert.deepEqual(resumed.excludedEnvironmentKeys, ['CODEX_TOOL_CALL_ID']);
});

test('effective environment variables including npm configuration still invalidate cached passes', async () => {
  const f = await fixture();
  await f.run();
  for (const key of [
    'PATH',
    'TZ',
    'NODE_OPTIONS',
    'NODE_ENV',
    'CODEX_HOME',
    'ELECTRON_OVERRIDE_DIST_PATH',
    'npm_config_pwdebug',
    'PSModulePath',
  ]) {
    f.options.env[key] = 'controlled changed value';
    const report = await f.run({ resume: true });
    assert.equal(report.results[0].executed, true, key);
    assert.equal(report.results[0].reused, false, key);
  }
});

test('optional build configuration additions, edits, and removals each invalidate a cached pass', async () => {
  const f = await fixture();
  f.options.stages[0].optionalInputs = ['controlled.env'];
  await f.run();
  const unchanged = await f.run({ resume: true });
  assert.equal(unchanged.results[0].reused, true);
  await f.write('controlled.env', 'CONTROLLED_VALUE=one');
  await f.run({ resume: true });
  assert.equal(f.calls, 2);
  await f.write('controlled.env', 'CONTROLLED_VALUE=two');
  await f.run({ resume: true });
  assert.equal(f.calls, 3);
  await fs.unlink(path.join(f.root, 'controlled.env'));
  await f.run({ resume: true });
  assert.equal(f.calls, 4);
});

test('adding optional build configuration while a command runs invalidates its reported success', async () => {
  const f = await fixture();
  f.options.stages[0].optionalInputs = ['controlled.env'];
  const report = await f.run({
    execute: async () => {
      await f.write('controlled.env', 'CONTROLLED_VALUE=created-during-build');
      return { status: 0, stdout: 'reported success' };
    },
  });
  assert.equal(report.passed, false);
  assert.equal(report.results[0].reason, 'INPUT_CHANGED');
});

test('build reuse requires actual output files with matching hashes', async () => {
  const f = await fixture();
  f.options.stages[0].outputs = ['compiled.js'];
  let executions = 0;
  f.options.execute = async () => {
    executions++;
    await f.write('compiled.js', 'generated output');
    return { status: 0, stdout: 'build passed', stderr: '' };
  };
  await f.run();
  await f.run({ resume: true });
  assert.equal(executions, 1);
  await f.write('compiled.js', 'tampered output');
  await f.run({ resume: true });
  assert.equal(executions, 2);
  await fs.unlink(path.join(f.root, 'compiled.js'));
  await f.run({ resume: true });
  assert.equal(executions, 3);
});

test('a failed fresh execution blocks reuse of an older success while preserving its evidence', async () => {
  const f = await fixture();
  const success = await f.run();
  let failedCalls = 0;
  const fail = async () => {
    failedCalls++;
    return { status: 1, stdout: '', stderr: 'controlled failure' };
  };
  const failure = await f.run({ execute: fail });
  assert.equal(failure.passed, false);
  assert.equal((await f.read('.test-data/result.json')).results[0].passed, false);
  await f.run({
    resume: true,
    execute: fail,
    env: { ...f.options.env, CODEX_TOOL_CALL_ID: 'another-call-after-failure' },
  });
  assert.equal(failedCalls, 2);
  const ledger = await f.read('.test-data/verification-last-passing.json');
  assert.equal(ledger.entries.check.log.path, success.results[0].log.path);
  assert.equal(
    await fs.readFile(path.join(f.root, success.results[0].log.path), 'utf8'),
    'controlled pass\n',
  );
});

test('source changes during a passing command fail verification and are never cached as passed', async () => {
  const f = await fixture();
  const report = await f.run({
    execute: async () => {
      await f.write('input.txt', 'changed while running');
      return { status: 0, stdout: 'reported pass', stderr: '' };
    },
  });
  assert.equal(report.passed, false);
  assert.equal(report.results[0].reason, 'INPUT_CHANGED');
  assert.equal((await f.read('.test-data/verification-cache.json')).entries.check.status, 'failed');
  const next = await f.run({ resume: true });
  assert.equal(next.results[0].executed, true);
});

test('failure stops the fixed stage list, writes a partial report, and never retries automatically', async () => {
  const f = await fixture();
  f.options.stages.push({ ...f.options.stages[0], id: 'second', name: 'never reached' });
  let calls = 0;
  const report = await f.run({
    execute: async () => {
      calls++;
      return { status: 1, stderr: 'failed' };
    },
  });
  assert.equal(calls, 1);
  assert.equal(report.results.length, 1);
  assert.equal(report.passed, false);
  assert.equal((await f.read('.test-data/result.json')).results.length, 1);
});

test('total budget, per-step budget, and cancellation cannot save success', async () => {
  for (const mode of ['total', 'step', 'cancel']) {
    const f = await fixture();
    const abort = new AbortController();
    const report = await f.run({
      limits: { totalTimeoutMs: 1000, stepTimeoutMs: 500 },
      signal: abort.signal,
      execute: async () => {
        if (mode === 'cancel') abort.abort();
        else f.advance(mode === 'total' ? 1001 : 501);
        return { status: 0, stdout: 'not a valid pass' };
      },
    });
    assert.equal(report.passed, false, mode);
    assert.equal(
      report.results[0].reason,
      { total: 'TOTAL_TIMEOUT', step: 'TIMEOUT', cancel: 'CANCELLED' }[mode],
    );
  }
});

test('more than 32 stages is rejected before executing any command', async () => {
  const f = await fixture();
  const report = await f.run({
    stages: Array.from({ length: 33 }, (_, n) => ({ ...f.options.stages[0], id: `stage-${n}` })),
  });
  assert.equal(f.calls, 0);
  assert.equal(report.passed, false);
  assert.equal(report.reason, 'STAGE_LIMIT');
});

test('controlled real subprocesses enforce timeout and combined output bounds without a shell', async () => {
  for (const [args, limits, reason] of [
    [['-e', 'setInterval(() => {}, 1000)'], { stepTimeoutMs: 300 }, 'TIMEOUT'],
    [['-e', 'process.stdout.write("x".repeat(4096))'], { maxOutputBytes: 128 }, 'OUTPUT_LIMIT'],
  ]) {
    const f = await fixture();
    f.options.stages[0].args = args;
    const report = await f.run({ execute: undefined, limits });
    assert.equal(report.passed, false);
    assert.equal(report.results[0].reason, reason);
    const log = await fs.readFile(path.join(f.root, report.results[0].log.path));
    assert.ok(log.length <= (limits.maxOutputBytes || 2 * 1024 * 1024));
  }
});

test('fixed plans keep original desktop coverage, new journeys, domain ordering, and package agreement', async () => {
  const root = path.resolve(__dirname, '..');
  const full = createPlan(root, 'full');
  assert.deepEqual(full.stages.find((stage) => stage.id === 'source:renderer').optionalInputs, [
    '.env',
    '.env.local',
    '.env.production',
    '.env.production.local',
  ]);
  assert.equal(full.stages.filter((stage) => stage.id === 'source:contract').length, 1);
  assert.equal(full.stages.filter((stage) => stage.id.startsWith('source:desktop:')).length, 19);
  assert.ok(full.stages.length <= 32);
  const core = createPlan(root, 'core');
  assert.ok(
    core.stages.findIndex((s) => s.id === 'source:domain') <
      core.stages.findIndex((s) => s.id === 'source:unit'),
  );
  assert.equal(core.stages.filter((stage) => stage.id.startsWith('source:desktop:')).length, 1);
  const packaged = createPlan(root, 'packaged');
  assert.equal(packaged.stages[0].id, 'packaged:agreement');
  assert.ok(packaged.stages[0].outputs.includes(`dist/SHA256SUMS-${packaged.version}.txt`));
  assert.ok(packaged.stages.some((stage) => stage.id === 'packaged:agent-recovery'));
  assert.ok(packaged.stages.some((stage) => stage.id === 'packaged:calendar-navigation'));
  assert.equal(packaged.stages.at(-1).id, 'packaged:portable');
  assert.deepEqual(packaged.stages.at(-1).outputs, [
    '.test-data/portable-smoke.png',
    '.test-data/portable-result.json',
  ]);
  assert.equal(packaged.stages.length, 12);
});

test('verification plans cannot load an inherited live development server or old executable', () => {
  const previousUrl = process.env.NEXUS_DEV_URL,
    previousExe = process.env.NEXUS_PACKAGED_EXE;
  try {
    process.env.NEXUS_DEV_URL = 'http://127.0.0.1:19999';
    process.env.NEXUS_PACKAGED_EXE = 'C:/controlled-old.exe';
    const root = path.resolve(__dirname, '..');
    for (const mode of ['core', 'full', 'packaged']) {
      const plan = createPlan(root, mode);
      assert.equal(plan.env.NEXUS_DEV_URL, undefined);
      assert.notEqual(plan.env.NEXUS_PACKAGED_EXE, 'C:/controlled-old.exe');
      assert.ok(plan.env.CODEX_HOME.startsWith(path.join(root, '.test-data')));
      assert.ok(plan.env.NEXUS_DATA_DIR.startsWith(path.join(root, '.test-data')));
    }
  } finally {
    if (previousUrl === undefined) delete process.env.NEXUS_DEV_URL;
    else process.env.NEXUS_DEV_URL = previousUrl;
    if (previousExe === undefined) delete process.env.NEXUS_PACKAGED_EXE;
    else process.env.NEXUS_PACKAGED_EXE = previousExe;
  }
});
