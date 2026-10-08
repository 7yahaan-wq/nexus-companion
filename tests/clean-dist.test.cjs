const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { cleanDistribution } = require('../scripts/clean-dist.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nia-release-cleanup-'));
  t.after(() => {
    assert.ok(root.startsWith(path.join(os.tmpdir(), 'nia-release-cleanup-')));
    assert.equal(fs.realpathSync(root), root);
    fs.rmSync(root, { recursive: true, force: true });
  });
  return root;
}

test('release cleanup removes known stale files and replaced documentation only', (t) => {
  const root = fixture(t);
  const dist = path.join(root, 'dist');
  fs.mkdirSync(path.join(dist, 'docs'), { recursive: true });
  const stale = [
    'NexusCompanion-Portable-0.4.0.exe',
    'NexusCompanion-Setup-0.4.0.exe.blockmap',
    'SHA256SUMS-0.4.0.txt',
    'RELEASE_0.4.0.md',
    'docs/RELEASE_0.3.11.md',
    'USER_GUIDE.md',
  ];
  const preserved = [
    'NexusCompanion-Portable-0.4.1.exe',
    'NexusCompanion-Setup-0.4.1.exe.blockmap',
    'SHA256SUMS-0.4.1.txt',
    'docs/RELEASE_0.4.1.md',
    'docs/USER_GUIDE.md',
    'DEVELOPMENT_HANDOFF.md', // No replacement exists yet.
    'README.md',
    'AGENTS.md',
    'my-notes.md',
    'unrecognized.exe',
  ];
  for (const name of [...stale, ...preserved]) fs.writeFileSync(path.join(dist, name), name);
  // A directory with a release-like name must never be traversed or deleted.
  fs.mkdirSync(path.join(dist, 'NexusCompanion-Setup-0.1.0.exe'));
  fs.writeFileSync(path.join(dist, 'NexusCompanion-Setup-0.1.0.exe', 'keep.txt'), 'keep');
  const removed = cleanDistribution(root, '0.4.1', () => {});
  assert.equal(removed.length, stale.length);
  for (const name of stale) assert.equal(fs.existsSync(path.join(dist, name)), false, name);
  for (const name of preserved) assert.equal(fs.readFileSync(path.join(dist, name), 'utf8'), name);
  assert.equal(
    fs.readFileSync(path.join(dist, 'NexusCompanion-Setup-0.1.0.exe', 'keep.txt'), 'utf8'),
    'keep',
  );
  assert.deepEqual(
    cleanDistribution(root, '0.4.1', () => {}),
    [],
  );
});

test('release cleanup rejects redirected documentation before deleting any artifact', (t) => {
  const root = fixture(t);
  const dist = path.join(root, 'dist');
  const external = path.join(root, 'external');
  fs.mkdirSync(dist);
  fs.mkdirSync(external);
  const oldArtifact = path.join(dist, 'NexusCompanion-Setup-0.4.0.exe');
  fs.writeFileSync(oldArtifact, 'old artifact');
  fs.writeFileSync(path.join(external, 'RELEASE_0.4.0.md'), 'protected');
  fs.symlinkSync(
    external,
    path.join(dist, 'docs'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  assert.throws(() => cleanDistribution(root, '0.4.1', () => {}), /resolves outside/);
  assert.equal(fs.readFileSync(oldArtifact, 'utf8'), 'old artifact');
  assert.equal(fs.readFileSync(path.join(external, 'RELEASE_0.4.0.md'), 'utf8'), 'protected');
});
