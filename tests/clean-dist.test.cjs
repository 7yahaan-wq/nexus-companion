const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { cleanDistribution, parseArguments } = require('../scripts/clean-dist.cjs');
const { createPlan, runStages } = require('../scripts/verification-runner.cjs');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const current = '0.5.3',
  rollback = '0.5.2';
function fixture() {
  // Keep these tiny controlled inputs; never recursively delete test directories.
  const root = path.resolve(__dirname, '../.test-data', 'clean-dist-' + randomUUID());
  fs.mkdirSync(path.join(root, 'dist/docs'), { recursive: true });
  fs.mkdirSync(path.join(root, '.test-data'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: current }));
  const write = (name, data = name) => fs.writeFileSync(path.join(root, name), data);
  const bundle = (version) => {
    const artifacts = ['Setup', 'Portable'].map((kind) => {
      const name = `NexusCompanion-${kind}-${version}.exe`;
      const bytes = Buffer.from('controlled executable ' + name);
      write('dist/' + name, bytes);
      return { path: name, bytes: bytes.length, sha256: hash(bytes) };
    });
    write(`dist/NexusCompanion-Setup-${version}.exe.blockmap`);
    write(`dist/docs/RELEASE_${version}.md`);
    write(
      `dist/SHA256SUMS-${version}.txt`,
      artifacts.map((a) => `${a.sha256}  ${a.path}`).join('\n') + '\n',
    );
    return artifacts;
  };
  const artifacts = bundle(current);
  bundle(rollback);
  const report = {
    version: current,
    passed: true,
    results: createPlan(root, 'packaged').stages.map((s) => ({ id: s.id, passed: true })),
  };
  const audit = { version: current, archiveVersion: current, passed: true, artifacts };
  const saveReports = () => {
    write('.test-data/release-audit.json', JSON.stringify(audit));
    const agreement = report.results.find((result) => result.id === 'packaged:agreement');
    if (agreement)
      agreement.outputFingerprint = hash(
        ['.test-data/release-audit.json', `dist/SHA256SUMS-${current}.txt`]
          .map((name) =>
            JSON.stringify(['file', name, hash(fs.readFileSync(path.join(root, name)))]),
          )
          .join(''),
      );
    write('.test-data/packaged-verification.json', JSON.stringify(report));
  };
  saveReports();
  const run = (options = {}) =>
    cleanDistribution(root, current, {
      keepVersion: rollback,
      log: () => {},
      runningPaths: [],
      ...options,
    });
  return { root, write, report, audit, saveReports, run, dist: path.join(root, 'dist') };
}
test('release cleanup previews by default and requires an explicit rollback version', () => {
  const f = fixture();
  const old = 'NexusCompanion-Setup-0.4.9.exe';
  f.write('dist/' + old);
  assert.deepEqual(f.run(), [path.join(f.dist, old)]);
  assert.ok(fs.existsSync(path.join(f.dist, old)));
  assert.throws(() => cleanDistribution(f.root, current, { log: () => {} }), /keep|rollback/i);
  for (const keepVersion of [current, '0.5.4', '../escape', ''])
    assert.throws(() => f.run({ keepVersion }), /keep|rollback|version/i);
});
test('applied cleanup retains current and rollback bundles, unknown files, directories, and differing docs', () => {
  const f = fixture();
  const stale = [
    'NexusCompanion-Portable-0.4.0.exe',
    'NexusCompanion-Setup-0.4.0.exe.blockmap',
    'SHA256SUMS-0.4.0.txt',
    'docs/RELEASE_0.4.0.md',
    'USER_GUIDE.md',
  ];
  for (const name of stale) f.write('dist/' + name);
  f.write('dist/docs/USER_GUIDE.md', 'dist/USER_GUIDE.md');
  f.write('dist/DEVELOPMENT_HANDOFF.md', 'user additions');
  f.write('dist/docs/DEVELOPMENT_HANDOFF.md', 'different replacement');
  f.write('dist/unrecognized.exe');
  f.write('dist/my-notes.md');
  fs.mkdirSync(path.join(f.dist, 'NexusCompanion-Setup-0.1.0.exe'));
  f.write('dist/NexusCompanion-Setup-0.1.0.exe/keep.txt');
  const preserved = [
    'NexusCompanion-Portable-' + current + '.exe',
    'NexusCompanion-Setup-' + rollback + '.exe',
    'SHA256SUMS-' + rollback + '.txt',
    'docs/RELEASE_' + rollback + '.md',
    'unrecognized.exe',
    'my-notes.md',
    'DEVELOPMENT_HANDOFF.md',
    'NexusCompanion-Setup-0.1.0.exe/keep.txt',
  ];
  const before = preserved.map((name) => fs.readFileSync(path.join(f.dist, name)));
  assert.deepEqual(
    f.run({ apply: true }).sort(),
    stale.map((name) => path.join(f.dist, name)).sort(),
  );
  for (const name of stale) assert.equal(fs.existsSync(path.join(f.dist, name)), false, name);
  for (let i = 0; i < preserved.length; i++)
    assert.deepEqual(fs.readFileSync(path.join(f.dist, preserved[i])), before[i]);
  assert.deepEqual(f.run({ apply: true }), []);
});
test('missing, incomplete, failed, or wrong-version packaged evidence prevents deletion', () => {
  for (const change of [
    (f) => {
      f.report.passed = false;
    },
    (f) => {
      f.report.version = rollback;
    },
    (f) => {
      f.report.results[0].passed = false;
    },
    (f) => {
      f.report.results.pop();
    },
    (f) => {
      f.report.results.push(f.report.results[0]);
    },
    (f) => {
      f.audit.passed = false;
    },
    (f) => {
      f.audit.version = rollback;
    },
    (f) => {
      f.audit.artifacts[0].sha256 = '0'.repeat(64);
    },
  ]) {
    const f = fixture();
    f.write('dist/NexusCompanion-Setup-0.4.9.exe', 'keep until verified');
    change(f);
    f.saveReports();
    assert.throws(() => f.run({ apply: true }), /verif|audit|evidence|hash/i);
    assert.equal(
      fs.readFileSync(path.join(f.dist, 'NexusCompanion-Setup-0.4.9.exe'), 'utf8'),
      'keep until verified',
    );
  }
  const f = fixture();
  fs.unlinkSync(path.join(f.root, '.test-data/packaged-verification.json'));
  assert.throws(() => f.run({ apply: true }));
});
test('changed executable or incomplete rollback bundle prevents cleanup', () => {
  for (const name of [
    `NexusCompanion-Portable-${current}.exe`,
    `NexusCompanion-Setup-${rollback}.exe`,
  ]) {
    const f = fixture();
    f.write('dist/' + name, 'modified after verification');
    assert.throws(() => f.run({ apply: true }), /hash|checksum/i);
  }
  const f = fixture();
  fs.unlinkSync(path.join(f.dist, `NexusCompanion-Setup-${rollback}.exe.blockmap`));
  assert.throws(() => f.run({ apply: true }), /bundle|file|ENOENT/i);
});
test('same-version repackage cannot reuse agreement evidence from the preceding build', async () => {
  const f = fixture();
  const old = path.join(f.dist, 'NexusCompanion-Setup-0.4.9.exe');
  f.write('dist/NexusCompanion-Setup-0.4.9.exe', 'preserve until current build verified');
  const agreement = createPlan(f.root, 'packaged').stages.find(
    (s) => s.id === 'packaged:agreement',
  );
  const verifyAgreement = async () => {
    const result = await runStages({
      root: f.root,
      version: current,
      stages: [{ ...agreement, inputs: [], args: ['controlled-release-audit'] }],
      reportPath: '.test-data/controlled-agreement.json',
      env: {},
      toolchain: { node: 'controlled' },
      onEvent: () => {},
      execute: async () => ({ status: 0, stdout: '', stderr: '' }),
    });
    assert.equal(result.passed, true);
    return result.results[0];
  };
  const first = await verifyAgreement();
  const saved = f.report.results.find((s) => s.id === agreement.id);
  assert.equal(saved.outputFingerprint, first.outputFingerprint);
  Object.assign(saved, first);
  f.write('.test-data/packaged-verification.json', JSON.stringify(f.report));
  const rebuilt = f.audit.artifacts[0];
  const bytes = Buffer.from('same-version replacement executable');
  f.write('dist/' + rebuilt.path, bytes);
  Object.assign(rebuilt, { bytes: bytes.length, sha256: hash(bytes) });
  f.write('.test-data/release-audit.json', JSON.stringify(f.audit));
  f.write(
    `dist/SHA256SUMS-${current}.txt`,
    f.audit.artifacts.map((a) => `${a.sha256}  ${a.path}`).join('\n') + '\n',
  );
  assert.throws(() => f.run({ apply: true }), /fingerprint|agreement|evidence/i);
  assert.ok(fs.existsSync(old));
  const fresh = await verifyAgreement();
  assert.notEqual(fresh.outputFingerprint, first.outputFingerprint);
  Object.assign(saved, fresh);
  f.write('.test-data/packaged-verification.json', JSON.stringify(f.report));
  assert.deepEqual(f.run({ apply: true }), [old]);
});
test('agreement fingerprint is required and binds exact audit and checksum bytes', () => {
  for (const change of [
    (f) => {
      delete f.report.results.find((s) => s.id === 'packaged:agreement').outputFingerprint;
      f.write('.test-data/packaged-verification.json', JSON.stringify(f.report));
    },
    (f) => {
      f.audit.time = 'new audit of the same executable';
      f.write('.test-data/release-audit.json', JSON.stringify(f.audit));
    },
    (f) => fs.appendFileSync(path.join(f.dist, `SHA256SUMS-${current}.txt`), '\n'),
  ]) {
    const f = fixture();
    f.write('dist/NexusCompanion-Setup-0.4.9.exe');
    change(f);
    assert.throws(() => f.run({ apply: true }), /fingerprint|agreement|evidence/i);
    assert.ok(fs.existsSync(path.join(f.dist, 'NexusCompanion-Setup-0.4.9.exe')));
  }
});
test('redirected documentation is rejected before any artifact is removed', () => {
  const f = fixture();
  const external = path.join(f.root, 'controlled-external');
  fs.renameSync(path.join(f.dist, 'docs'), external);
  fs.symlinkSync(
    external,
    path.join(f.dist, 'docs'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  f.write('dist/NexusCompanion-Setup-0.4.9.exe', 'preserve');
  assert.throws(() => f.run({ apply: true }), /outside|redirect|link/i);
  assert.ok(fs.existsSync(path.join(f.dist, 'NexusCompanion-Setup-0.4.9.exe')));
  assert.ok(fs.existsSync(path.join(external, `RELEASE_${rollback}.md`)));
});
test('a running distribution executable blocks applying a reviewed cleanup', () => {
  const f = fixture();
  f.write('dist/NexusCompanion-Setup-0.4.9.exe');
  assert.throws(
    () =>
      f.run({
        apply: true,
        runningPaths: [path.join(f.dist, `NexusCompanion-Portable-${rollback}.exe`)],
      }),
    /running/i,
  );
  assert.ok(fs.existsSync(path.join(f.dist, 'NexusCompanion-Setup-0.4.9.exe')));
});
test('CLI requires explicit keep-version and apply is opt-in', () => {
  assert.deepEqual(parseArguments(['--keep-version', rollback]), {
    keepVersion: rollback,
    apply: false,
  });
  assert.deepEqual(parseArguments(['--apply', '--keep-version', rollback]), {
    keepVersion: rollback,
    apply: true,
  });
  for (const args of [
    [],
    ['--apply'],
    ['--keep-version'],
    ['--keep-version', rollback, '--force'],
    ['--keep-version', rollback, '--keep-version', current],
  ])
    assert.throws(() => parseArguments(args));
});

test(
  'Windows process inspection permits cleanup of an unused controlled release file',
  { skip: process.platform !== 'win32' },
  () => {
    const f = fixture();
    const name = 'NexusCompanion-Setup-0.4.9.exe';
    f.write('dist/' + name);
    assert.deepEqual(f.run({ apply: true, runningPaths: undefined }), [path.join(f.dist, name)]);
    assert.equal(fs.existsSync(path.join(f.dist, name)), false);
  },
);
