const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { createPlan } = require('./verification-runner.cjs');
const recognized = [
  /^NexusCompanion-(?:Setup|Portable)-(\d+\.\d+\.\d+)\.exe(?:\.blockmap)?$/,
  /^SHA256SUMS-(\d+\.\d+\.\d+)\.txt$/,
  /^RELEASE_(\d+\.\d+\.\d+)\.md$/,
];
const documentation = [
  'USER_GUIDE',
  'DEVELOPMENT_HANDOFF',
  'DEVELOPMENT_LOOP',
  'PROJECT_STATUS',
  'VERIFICATION',
  'ARCHITECTURE',
  'AVATAR_PACK',
  'NIA_ANIMATION',
  'OPEN_SOURCE_RESEARCH',
  'START_ON_NEW_PC',
];
const validVersion = (value) =>
  typeof value === 'string' && /^\d{1,5}\.\d{1,5}\.\d{1,5}$/.test(value);
function older(a, b) {
  const left = a.split('.').map(Number),
    right = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] < right[i];
  return false;
}
function safePath(root, target, directory = false) {
  const absolute = path.resolve(target);
  if (absolute !== root && !absolute.startsWith(root + path.sep))
    throw Error('release path resolves outside the repository: ' + absolute);
  const stat = fs.lstatSync(absolute);
  if (
    stat.isSymbolicLink() ||
    fs.realpathSync(absolute) !== absolute ||
    (directory ? !stat.isDirectory() : !stat.isFile())
  )
    throw Error(
      'release path is redirected or not a regular ' +
        (directory ? 'directory: ' : 'file: ') +
        absolute,
    );
  return absolute;
}
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function checkedBundle(root, dist, version) {
  const sums = fs.readFileSync(
    safePath(root, path.join(dist, `SHA256SUMS-${version}.txt`)),
    'utf8',
  );
  const entries = new Map();
  for (const line of sums.trim().split(/\r?\n/)) {
    const match = /^([a-f\d]{64}) {2}([^\\/]+)$/.exec(line);
    if (!match || entries.has(match[2])) throw Error('Invalid release checksum file');
    entries.set(match[2], match[1]);
  }
  const hashes = new Map();
  for (const kind of ['Setup', 'Portable']) {
    const name = `NexusCompanion-${kind}-${version}.exe`;
    const actual = sha256(safePath(root, path.join(dist, name)));
    if (entries.get(name) !== actual) throw Error('Release checksum mismatch: ' + name);
    hashes.set(name, actual);
  }
  safePath(root, path.join(dist, `NexusCompanion-Setup-${version}.exe.blockmap`));
  safePath(root, path.join(dist, 'docs', `RELEASE_${version}.md`));
  return hashes;
}
function verifiedCurrent(root, version, hashes) {
  safePath(root, path.join(root, '.test-data'), true);
  const read = (name) =>
    JSON.parse(fs.readFileSync(safePath(root, path.join(root, '.test-data', name)), 'utf8'));
  const report = read('packaged-verification.json');
  const plan = createPlan(root, 'packaged');
  const expected = plan.stages.map((stage) => stage.id).sort();
  if (
    report.version !== version ||
    report.passed !== true ||
    !Array.isArray(report.results) ||
    report.results.some((result) => result.passed !== true) ||
    JSON.stringify(report.results.map((result) => result.id).sort()) !== JSON.stringify(expected)
  )
    throw Error(
      'Complete current packaged verification evidence is required before release cleanup',
    );
  const agreement = plan.stages.find((stage) => stage.id === 'packaged:agreement');
  const outputs = [...(agreement?.outputs || [])].sort();
  if (
    JSON.stringify(outputs) !==
    JSON.stringify(['.test-data/release-audit.json', `dist/SHA256SUMS-${version}.txt`])
  )
    throw Error('Unsupported packaged agreement evidence contract');
  const fingerprint = crypto.createHash('sha256');
  for (const output of outputs) {
    // Match verification-runner snapshot's canonical array records, including exact file bytes.
    fingerprint.update(
      JSON.stringify(['file', output, sha256(safePath(root, path.resolve(root, output)))]),
    );
  }
  if (
    report.results.find((result) => result.id === agreement.id).outputFingerprint !==
    fingerprint.digest('hex')
  )
    throw Error('Current packaged agreement evidence fingerprint mismatch; verify this build');
  const audit = read('release-audit.json');
  if (
    audit.passed !== true ||
    audit.version !== version ||
    audit.archiveVersion !== version ||
    !Array.isArray(audit.artifacts)
  )
    throw Error('Current release audit evidence is required before release cleanup');
  for (const [name, hash] of hashes) {
    const matches = audit.artifacts.filter((artifact) => artifact.path === name);
    if (matches.length !== 1 || matches[0].sha256 !== hash)
      throw Error('Current release audit hash mismatch: ' + name);
  }
}
function runningExecutables(dist) {
  if (process.platform !== 'win32')
    throw Error('Applying release cleanup requires Windows process inspection');
  const script = [
    '$ErrorActionPreference = "Stop"',
    '[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)',
    'Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($env:NEXUS_CLEANUP_DIST, [StringComparison]::OrdinalIgnoreCase) } | Select-Object -ExpandProperty ExecutablePath | ConvertTo-Json -Compress',
  ].join('; ');
  const output = execFileSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    {
      env: { ...process.env, NEXUS_CLEANUP_DIST: dist + path.sep },
      windowsHide: true,
      timeout: 10000,
      maxBuffer: 1024 * 1024,
      encoding: 'utf8',
    },
  ).trim();
  const values = output ? JSON.parse(output) : [];
  const paths = typeof values === 'string' ? [values] : values;
  if (!Array.isArray(paths) || paths.some((value) => typeof value !== 'string'))
    throw Error('Could not inspect running release executables');
  return paths;
}
function cleanDistribution(root, version, options = {}) {
  const { keepVersion, apply = false, log = console.log } = options;
  if (!validVersion(version) || !validVersion(keepVersion) || !older(keepVersion, version))
    throw Error('Explicit --keep-version must name an older rollback version');
  root = path.resolve(root);
  safePath(root, root, true);
  const dist = safePath(root, path.join(root, 'dist'), true);
  const documents = safePath(root, path.join(dist, 'docs'), true);
  const currentHashes = checkedBundle(root, dist, version);
  checkedBundle(root, dist, keepVersion);
  verifiedCurrent(root, version, currentHashes);
  const targets = [];
  for (const directory of [dist, documents]) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      // Never follow or remove links, directories or unrecognized artifacts.
      if (!entry.isFile()) continue;
      const target = path.join(directory, entry.name);
      const match = recognized.map((pattern) => entry.name.match(pattern)).find(Boolean);
      const oldRelease = match && older(match[1], keepVersion);
      const replacement = path.join(documents, entry.name);
      let duplicate = false;
      if (
        directory === dist &&
        documentation.some((name) => entry.name === name + '.md') &&
        fs.existsSync(replacement)
      ) {
        const stat = fs.lstatSync(replacement);
        if (stat.isFile() && !stat.isSymbolicLink()) {
          safePath(root, replacement);
          duplicate = fs.readFileSync(target).equals(fs.readFileSync(replacement));
        }
      }
      if (!oldRelease && !duplicate) continue;
      targets.push(safePath(root, target));
    }
  }
  for (const target of targets)
    log(
      (apply
        ? 'Removing reviewed generated release file: '
        : 'Preview generated release cleanup: ') + target,
    );
  if (apply && targets.length) {
    const running = options.runningPaths ?? runningExecutables(dist);
    if (!Array.isArray(running) || running.some((value) => typeof value !== 'string'))
      throw Error('Invalid running executable evidence');
    if (
      running.some((value) =>
        path
          .resolve(value)
          .toLowerCase()
          .startsWith((dist + path.sep).toLowerCase()),
      )
    )
      throw Error('A distribution executable is running; release cleanup was not applied');
    // Revalidate all exact targets before the first deletion, including parent junctions.
    safePath(root, dist, true);
    safePath(root, documents, true);
    for (const target of targets) safePath(root, target);
    for (const target of targets) fs.unlinkSync(target);
  }
  log(
    `${apply ? 'Applied' : 'Preview only'}: ${targets.length} files; keeping ${version} and rollback ${keepVersion}`,
  );
  return targets;
}
function parseArguments(args) {
  let keepVersion,
    apply = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--apply' && !apply) apply = true;
    else if (args[i] === '--keep-version' && keepVersion === undefined && validVersion(args[i + 1]))
      keepVersion = args[++i];
    else throw Error('Usage: node scripts/clean-dist.cjs --keep-version VERSION [--apply]');
  }
  if (!keepVersion) throw Error('Explicit --keep-version is required');
  return { keepVersion, apply };
}
if (require.main === module) {
  try {
    cleanDistribution(
      path.resolve(__dirname, '..'),
      require('../package.json').version,
      parseArguments(process.argv.slice(2)),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { cleanDistribution, parseArguments };
