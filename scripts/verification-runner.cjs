const fs = require('node:fs/promises');
const syncFs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const SCHEMA = 1;
const MAX_AGE = 24 * 60 * 60 * 1000;
const EXCLUDED_ENVIRONMENT_KEYS = ['CODEX_TOOL_CALL_ID'];
const DEFAULT_LIMITS = {
  totalTimeoutMs: 900000,
  stepTimeoutMs: 180000,
  maxOutputBytes: 2097152,
  maxStages: 32,
};
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
const problem = (reason) => Object.assign(new Error(reason), { reason });
const canonical = (value) =>
  JSON.stringify(value, (_, entry) =>
    entry && typeof entry === 'object' && !Array.isArray(entry)
      ? Object.fromEntries(
          Object.keys(entry)
            .sort()
            .map((key) => [key, entry[key]]),
        )
      : entry,
  );
const signature = (stat) => [stat.size, stat.mtimeNs, stat.ctimeNs, stat.ino, stat.dev].join(':');

async function fileHash(file, memo, check) {
  check();
  const before = syncFs.statSync(file, { bigint: true });
  const stamp = signature(before);
  if (memo.get(file)?.stamp === stamp) return memo.get(file).hash;
  const hash = crypto.createHash('sha256');
  const handle = syncFs.openSync(file, 'r');
  const buffer = Buffer.allocUnsafe(Math.max(1, Math.min(Number(before.size), 1024 * 1024)));
  let chunks = 0;
  try {
    let bytes;
    while ((bytes = syncFs.readSync(handle, buffer, 0, buffer.length, null)) > 0) {
      check();
      hash.update(buffer.subarray(0, bytes));
      if (++chunks % 8 === 0) await new Promise((resolve) => setImmediate(resolve));
    }
  } finally {
    syncFs.closeSync(handle);
  }
  if (signature(syncFs.statSync(file, { bigint: true })) !== stamp) throw problem('INPUT_CHANGED');
  const value = hash.digest('hex');
  memo.set(file, { stamp, hash: value });
  return value;
}

async function snapshot(root, inputs, memo, check) {
  const hash = crypto.createHash('sha256');
  const missing = [];
  let files = 0;
  async function visit(file, label) {
    check();
    let stat;
    try {
      stat = syncFs.lstatSync(file);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      missing.push(label);
      hash.update(canonical(['missing', label]));
      return;
    }
    if (stat.isSymbolicLink()) throw problem('SYMLINK_INPUT');
    if (stat.isDirectory()) {
      hash.update(canonical(['directory', label]));
      const entries = syncFs.readdirSync(file).sort();
      for (const name of entries) await visit(path.join(file, name), label + '/' + name);
    } else if (stat.isFile()) {
      files++;
      hash.update(canonical(['file', label, await fileHash(file, memo, check)]));
      if (files % 64 === 0) await new Promise((resolve) => setImmediate(resolve));
    } else throw problem('UNSUPPORTED_INPUT');
  }
  for (const input of [...new Set(inputs)].sort())
    await visit(path.resolve(root, input), input.replaceAll('\\', '/'));
  return { hash: hash.digest('hex'), missing, files };
}

async function jsonRead(file) {
  try {
    if ((await fs.stat(file)).size > 2 * 1024 * 1024) return null;
    const value = JSON.parse(await fs.readFile(file, 'utf8'));
    return value?.schema === SCHEMA &&
      value.entries &&
      typeof value.entries === 'object' &&
      !Array.isArray(value.entries)
      ? value
      : null;
  } catch {
    return null;
  }
}

async function jsonWrite(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = file + '.' + process.pid + '.tmp';
  await fs.writeFile(temporary, JSON.stringify(value, null, 2) + '\n');
  await fs.rename(temporary, file);
}

function executeStep({ command, args, cwd, env, timeoutMs, maxOutputBytes, signal }) {
  return new Promise((resolve) => {
    let child, timer, killTimer, killFallback, killer;
    let settled = false,
      reason = null,
      bytes = 0;
    const chunks = [];
    const finished = (status, error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(killTimer);
      clearTimeout(killFallback);
      signal?.removeEventListener('abort', cancelled);
      killer?.kill();
      resolve({
        status,
        reason: reason || (error ? 'PROCESS_ERROR' : null),
        stdout: Buffer.concat(chunks).toString('utf8'),
        stderr: '',
      });
    };
    const stop = (why) => {
      if (reason || settled) return;
      reason = why;
      const remaining = Math.max(1, Math.min(2000, timeoutMs / 4));
      if (child?.pid && process.platform === 'win32') {
        // Kill the test's Electron children as well as its Node parent.
        killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
          windowsHide: true,
          shell: false,
          stdio: 'ignore',
        });
        killer.on('error', () => child.kill());
      } else child?.kill('SIGKILL');
      killFallback = setTimeout(() => child?.kill('SIGKILL'), Math.max(1, remaining / 2));
      killTimer = setTimeout(() => finished(null), remaining);
    };
    const cancelled = () => stop('CANCELLED');
    if (signal?.aborted) {
      reason = 'CANCELLED';
      finished(null);
      return;
    }
    try {
      child = spawn(command, args, {
        cwd,
        env,
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const output = (chunk) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        const available = Math.max(0, maxOutputBytes - bytes);
        if (available) chunks.push(buffer.subarray(0, available));
        bytes += buffer.length;
        if (bytes > maxOutputBytes) stop('OUTPUT_LIMIT');
      };
      child.stdout.on('data', output);
      child.stderr.on('data', output);
      child.on('error', (error) => finished(null, error));
      child.on('close', (status) => finished(status));
      // Reserve bounded time for terminating the process tree within the step limit.
      timer = setTimeout(
        () => stop('TIMEOUT'),
        Math.max(1, timeoutMs - Math.min(2000, timeoutMs / 4)),
      );
      signal?.addEventListener('abort', cancelled, { once: true });
    } catch (error) {
      finished(null, error);
    }
  });
}

async function runStages(options) {
  const { root, stages, reportPath, resume = false, signal } = options;
  const now = options.now || Date.now;
  const env = { ...(options.env || process.env) };
  // Tool invocation identity is not test input; remove it from both hashing and children.
  for (const key of EXCLUDED_ENVIRONMENT_KEYS) delete env[key];
  const notify = options.onEvent || ((message) => console.log(message));
  const execute = options.execute || executeStep;
  const limits = Object.fromEntries(
    Object.entries(DEFAULT_LIMITS).map(([key, maximum]) => [
      key,
      Math.max(1, Math.min(maximum, options.limits?.[key] ?? maximum)),
    ]),
  );
  const started = now(),
    runId = crypto.randomUUID();
  const report = {
    schema: SCHEMA,
    runId,
    version: options.version || null,
    mode: resume ? 'resume' : 'fresh',
    excludedEnvironmentKeys: [...EXCLUDED_ENVIRONMENT_KEYS],
    startedAt: new Date(started).toISOString(),
    time: new Date(started).toISOString(),
    passed: false,
    results: [],
  };
  const cachePath = path.join(root, '.test-data/verification-cache.json');
  const ledgerPath = path.join(root, '.test-data/verification-last-passing.json');
  const oldCache = await jsonRead(cachePath),
    oldLedger = await jsonRead(ledgerPath);
  const cache = oldCache || { schema: SCHEMA, entries: {} };
  const ledger = oldLedger || { schema: SCHEMA, entries: {} };
  const memo = new Map();
  const environmentFingerprint = digest(canonical(env));
  let stageDeadline = Infinity;
  const check = () => {
    if (signal?.aborted) throw problem('CANCELLED');
    if (now() - started >= limits.totalTimeoutMs) throw problem('TOTAL_TIMEOUT');
    if (now() >= stageDeadline) throw problem('TIMEOUT');
  };
  const saveReport = async () => {
    report.time = new Date(now()).toISOString();
    await jsonWrite(path.resolve(root, reportPath), report);
  };
  if (
    stages.length > limits.maxStages ||
    new Set(stages.map((stage) => stage.id)).size !== stages.length
  ) {
    report.reason = 'STAGE_LIMIT';
    await saveReport();
    return report;
  }
  const identity = async (stage) => {
    check();
    const executor = await fileHash(__filename, memo, check);
    const inputs = await snapshot(root, stage.inputs || [], memo, check);
    if (inputs.missing.length) throw problem('MISSING_INPUT');
    // Missing optional files are fingerprinted too, so later creation invalidates a pass.
    const optionalInputs = await snapshot(root, stage.optionalInputs || [], memo, check);
    const toolchain = options.toolchain || {
      node: process.versions.node,
      platform: process.platform,
      arch: process.arch,
      files: (await snapshot(root, [process.execPath, 'node_modules'], memo, check)).hash,
    };
    return digest(
      canonical({
        schema: SCHEMA,
        executor,
        root: path.resolve(root),
        toolchain,
        environmentFingerprint,
        id: stage.id,
        command: process.execPath,
        args: stage.args,
        inputs: inputs.hash,
        optionalInputs: optionalInputs.hash,
        outputs: stage.outputs || [],
        limits,
      }),
    );
  };
  await saveReport();
  for (const stage of stages) {
    const begin = now();
    stageDeadline = begin + limits.stepTimeoutMs;
    const result = {
      name: stage.name,
      id: stage.id,
      passed: false,
      executed: false,
      reused: false,
      status: 'running',
      durationMs: 0,
      inputFingerprint: null,
      passedAt: null,
      log: null,
    };
    report.results.push(result);
    let fingerprint = null;
    try {
      fingerprint = await identity(stage);
      result.inputFingerprint = fingerprint;
      const latest = oldCache?.entries[stage.id],
        previous = oldLedger?.entries[stage.id];
      const passedTime = Date.parse(previous?.passedAt);
      const safeLog =
        typeof previous?.log?.path === 'string' &&
        /^\.test-data\/verification-logs\/[A-Za-z0-9_.-]+\.log$/.test(previous.log.path);
      const samePass =
        latest?.status === 'passed' &&
        latest.inputFingerprint === fingerprint &&
        previous?.inputFingerprint === fingerprint &&
        latest.passedAt === previous.passedAt;
      if (
        resume &&
        stage.cacheable !== false &&
        samePass &&
        safeLog &&
        Number.isFinite(passedTime) &&
        now() >= passedTime &&
        now() - passedTime <= MAX_AGE
      ) {
        let valid = false;
        try {
          const outputs = await snapshot(root, stage.outputs || [], memo, check);
          valid =
            outputs.missing.length === 0 &&
            outputs.hash === previous.outputFingerprint &&
            (await fileHash(path.join(root, previous.log.path), memo, check)) ===
              previous.log.sha256;
        } catch (error) {
          if (['CANCELLED', 'TOTAL_TIMEOUT'].includes(error.reason)) throw error;
        }
        if (valid) {
          // Recheck inputs after validating evidence; concurrent edits cannot silently reuse it.
          if ((await identity(stage)) !== fingerprint) throw problem('INPUT_CHANGED');
          Object.assign(result, {
            passed: true,
            reused: true,
            status: 'passed',
            passedAt: previous.passedAt,
            log: previous.log,
            outputFingerprint: previous.outputFingerprint,
            durationMs: now() - begin,
          });
          notify(`REUSED ${stage.name} · original pass ${result.passedAt}`);
          await saveReport();
          continue;
        }
      }
      check();
      result.executed = true;
      cache.entries[stage.id] = { status: 'running', inputFingerprint: fingerprint, runId };
      await jsonWrite(cachePath, cache);
      await saveReport();
      notify(`EXECUTED ${stage.name}`);
      const executionStart = now();
      const timeoutMs = Math.min(
        stageDeadline - executionStart,
        limits.totalTimeoutMs - (executionStart - started),
      );
      const execution = await execute({
        command: process.execPath,
        args: stage.args,
        cwd: root,
        env,
        timeoutMs,
        maxOutputBytes: limits.maxOutputBytes,
        signal,
      });
      const output = Buffer.from((execution.stdout || '') + (execution.stderr || ''));
      const logPath = `.test-data/verification-logs/${stage.id.replace(/[^A-Za-z0-9_-]/g, '_')}-${runId}.log`;
      await fs.mkdir(path.dirname(path.join(root, logPath)), { recursive: true });
      const boundedOutput = output.subarray(0, limits.maxOutputBytes);
      await fs.writeFile(path.join(root, logPath), boundedOutput);
      result.log = { path: logPath, sha256: digest(boundedOutput) };
      check();
      if (now() - executionStart > timeoutMs) throw problem('TIMEOUT');
      if (execution.reason) throw problem(execution.reason);
      if (output.length > limits.maxOutputBytes) throw problem('OUTPUT_LIMIT');
      if (execution.status !== 0) throw problem('CHECK_FAILED');
      if ((await identity(stage)) !== fingerprint) throw problem('INPUT_CHANGED');
      const outputs = await snapshot(root, stage.outputs || [], memo, check);
      if (outputs.missing.length || ((stage.outputs || []).length && !outputs.files))
        throw problem('MISSING_OUTPUT');
      check();
      Object.assign(result, {
        passed: true,
        status: 'passed',
        passedAt: new Date(now()).toISOString(),
        outputFingerprint: outputs.hash,
        durationMs: now() - begin,
      });
      const evidence = {
        inputFingerprint: fingerprint,
        outputFingerprint: outputs.hash,
        passedAt: result.passedAt,
        log: result.log,
      };
      ledger.entries[stage.id] = evidence;
      cache.entries[stage.id] = { ...evidence, status: 'passed', runId };
      await jsonWrite(ledgerPath, ledger);
      await jsonWrite(cachePath, cache);
      const tail = boundedOutput.toString('utf8').trim().slice(-1200);
      if (tail) notify(tail);
    } catch (error) {
      Object.assign(result, {
        passed: false,
        status: 'failed',
        reason: error.reason || 'RUNNER_ERROR',
        durationMs: now() - begin,
      });
      cache.entries[stage.id] = {
        status: 'failed',
        inputFingerprint: fingerprint,
        reason: result.reason,
        runId,
      };
      await jsonWrite(cachePath, cache);
      notify(`FAIL ${stage.name} · ${result.reason}${result.log ? ' · ' + result.log.path : ''}`);
      await saveReport();
      break;
    }
    await saveReport();
  }
  report.passed =
    report.results.length === stages.length && report.results.every((result) => result.passed);
  report.executed = report.results.filter((result) => result.executed).length;
  report.reused = report.results.filter((result) => result.reused).length;
  await saveReport();
  notify(
    `${report.passed ? 'PASS' : 'FAIL'} verification · executed ${report.executed}, reused ${report.reused}`,
  );
  return report;
}

const DESKTOP = [
  'desktop',
  'm2',
  'm3',
  'm4',
  'm5',
  'm6',
  'm7',
  'm8',
  'e2e',
  'polish',
  'usability',
  'nia',
  'notes-flow',
  'focus-flow',
  'planning-flow',
  'workflow',
  'agent-usage',
  'agent-recovery',
  'calendar-navigation',
  'tasks-flow',
];
const PACKAGED = [
  'e2e',
  'usability',
  'nia',
  'notes-flow',
  'focus-flow',
  'planning-flow',
  'workflow',
  'agent-usage',
  'agent-recovery',
  'calendar-navigation',
  'tasks-flow',
  'portable',
];

function createPlan(root, mode) {
  const version = JSON.parse(syncFs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  const common = [
    'package.json',
    'package-lock.json',
    'scripts/harness.cjs',
    'scripts/verify.cjs',
    'scripts/verify-packaged.cjs',
  ];
  const source = ['src', 'public', 'electron'];
  const codexHome = path.join(
    root,
    '.test-data',
    mode === 'packaged' ? 'packaged-codex' : 'verify-codex',
  );
  const env = {
    ...process.env,
    CODEX_HOME: codexHome,
    NEXUS_DATA_DIR: path.join(root, '.test-data', 'verification-profile'),
  };
  delete env.NEXUS_PACKAGED_EXE;
  delete env.NEXUS_DEV_URL;
  const stage = (id, name, args, inputs, outputs = []) => ({
    id,
    name,
    args,
    inputs: [...common, ...inputs],
    outputs,
  });
  let stages;
  if (mode === 'packaged') {
    env.NEXUS_PACKAGED_EXE = path.join(root, 'dist/win-unpacked/Nexus Companion.exe');
    const packagedInputs = [
      'dist/win-unpacked',
      `dist/NexusCompanion-Portable-${version}.exe`,
      `dist/NexusCompanion-Setup-${version}.exe`,
    ];
    stages = [
      stage(
        'packaged:agreement',
        'package/source agreement',
        ['scripts/verify-release.cjs'],
        ['scripts/verify-release.cjs', 'build', 'electron', ...packagedInputs],
        ['.test-data/release-audit.json', `dist/SHA256SUMS-${version}.txt`],
      ),
      ...PACKAGED.map((name) =>
        stage(
          `packaged:${name}`,
          name,
          [`tests/${name}.cjs`],
          [...source, 'build', ...packagedInputs, `tests/${name}.cjs`, 'tests/support'],
          name === 'portable'
            ? ['.test-data/portable-smoke.png', '.test-data/portable-result.json']
            : [],
        ),
      ),
    ];
  } else {
    const units = syncFs
      .readdirSync(path.join(root, 'tests'))
      .filter((name) => name.endsWith('.test.cjs'))
      .sort()
      .map((name) => 'tests/' + name);
    stages = [
      {
        ...stage(
          'source:environment',
          'environment',
          ['scripts/doctor.cjs'],
          ['scripts/doctor.cjs'],
        ),
        cacheable: false,
      },
      stage(
        'source:contract',
        'project contract',
        ['scripts/check-project.cjs'],
        [
          'scripts/check-project.cjs',
          'scripts/normalize-nia.ps1',
          'scripts/build-nia-24.py',
          'art',
          'res',
          'public',
          'src/domain/avatar.ts',
          'src/avatar/AvatarManager.tsx',
          `docs/RELEASE_${version}.md`,
        ],
      ),
      stage(
        'source:typescript',
        'TypeScript',
        ['node_modules/typescript/bin/tsc', '--noEmit'],
        ['src', 'tsconfig.json'],
      ),
      stage(
        'source:domain',
        'domain build',
        ['scripts/build-domain.cjs'],
        ['scripts/build-domain.cjs', 'src/domain'],
        ['electron/generated/calendar.cjs'],
      ),
      {
        ...stage(
          'source:renderer',
          'renderer build',
          ['node_modules/vite/bin/vite.js', 'build'],
          ['src', 'public', 'index.html', 'vite.config.ts', 'tsconfig.json'],
          ['build'],
        ),
        optionalInputs: ['.env', '.env.local', '.env.production', '.env.production.local'],
      },
      stage(
        'source:unit',
        'unit tests',
        ['--test', ...units],
        [...source, 'scripts', 'tests/support', ...units],
      ),
      ...(mode === 'full' ? DESKTOP : ['nia']).map((name) =>
        stage(
          `source:desktop:${name}`,
          name,
          [`tests/${name}.cjs`],
          [...source, 'build', `tests/${name}.cjs`, 'tests/support'],
        ),
      ),
    ];
  }
  return {
    root,
    stages,
    env,
    version,
    codexHome,
    reportPath:
      mode === 'packaged'
        ? '.test-data/packaged-verification.json'
        : mode === 'full'
          ? '.test-data/verification.json'
          : '.test-data/harness.json',
  };
}

async function runCli(mode, allowedArguments = ['--resume']) {
  const args = process.argv.slice(2);
  if (args.some((arg) => !allowedArguments.includes(arg)))
    throw Error('Unsupported verification argument');
  const root = path.resolve(__dirname, '..');
  const plan = createPlan(root, mode);
  await fs.mkdir(path.join(plan.codexHome, 'sessions'), { recursive: true });
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  try {
    const report = await runStages({
      ...plan,
      resume: args.includes('--resume'),
      signal: controller.signal,
    });
    if (!report.passed) process.exitCode = 1;
  } finally {
    process.removeListener('SIGINT', cancel);
    process.removeListener('SIGTERM', cancel);
  }
}

module.exports = { runStages, createPlan, runCli };
