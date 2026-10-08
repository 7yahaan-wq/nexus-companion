const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const asar = require('@electron/asar');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const archivePath = path.join(dist, 'win-unpacked/resources/app.asar');
const reportPath = path.join(root, '.test-data/release-audit.json');
const report = {
  startedAt: new Date().toISOString(),
  version: null,
  archiveVersion: null,
  passed: false,
  entryCount: 0,
  fileCount: 0,
  comparedFileCount: 0,
  artifacts: [],
  sourceFiles: [],
  forbiddenEntries: [],
  errors: [],
};
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

async function hashFile(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

function sourceFiles(directory) {
  const result = [];
  const visit = (folder) => {
    for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, item.name);
      if (item.isSymbolicLink()) throw Error(`Source tree contains a symlink: ${file}`);
      if (item.isDirectory()) visit(file);
      else if (item.isFile()) result.push(path.relative(root, file).replaceAll('\\', '/'));
      else throw Error(`Source tree contains a non-file entry: ${file}`);
    }
  };
  visit(path.join(root, directory));
  if (!result.length) throw Error(`Source tree is empty: ${directory}`);
  return result.sort();
}

function normalizedEntry(entry) {
  const relative = entry.replaceAll('\\', '/').replace(/^\/+/, '');
  if (!relative || relative.split('/').some((part) => part === '..' || part === '.'))
    throw Error(`Unsafe archive entry: ${entry}`);
  return relative;
}

function isPrivateEntry(entry) {
  const parts = entry.toLowerCase().split('/');
  // Installed packages can legitimately contain .env examples, database fixtures,
  // and session-related source files. Only inspect the application's own files.
  if (parts[0] === 'node_modules') return false;
  if (parts.some((part) => ['.git', '.test-data', '.codex', '.agents', 'sessions'].includes(part)))
    return true;
  const name = parts[parts.length - 1];
  return (
    name === '.env' ||
    name.startsWith('.env.') ||
    /\.(?:sqlite\d*|db)(?:-(?:wal|shm|journal))?$/.test(name) ||
    /\.(?:session|jsonl)$/.test(name) ||
    /^(?:sessions?|rollout)(?:[-_.].*)?\.(?:json|log)$/.test(name)
  );
}

async function inspectArtifact(relative) {
  const file = path.join(dist, relative);
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size === 0)
    throw Error(`Missing or empty release artifact: ${relative}`);
  const artifact = { path: relative, bytes: stat.size, sha256: await hashFile(file) };
  report.artifacts.push(artifact);
  return artifact;
}

async function audit() {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (typeof manifest.version !== 'string' || !/^[0-9A-Za-z.+-]+$/.test(manifest.version))
    throw Error('package.json has an invalid release version');
  report.version = manifest.version;
  const entries = asar.listPackage(archivePath).map(normalizedEntry);
  if (new Set(entries).size !== entries.length) throw Error('Archive contains duplicate paths');
  report.entryCount = entries.length;
  const archiveFiles = new Set();
  for (const entry of entries) {
    if (isPrivateEntry(entry)) report.forbiddenEntries.push(entry);
    const info = asar.statFile(archivePath, path.normalize(entry), false);
    if (!('files' in info)) archiveFiles.add(entry);
  }
  report.fileCount = archiveFiles.size;
  if (report.forbiddenEntries.length)
    report.errors.push(`Archive contains private data: ${report.forbiddenEntries.join(', ')}`);

  const packaged = JSON.parse(asar.extractFile(archivePath, 'package.json').toString('utf8'));
  report.archiveVersion = packaged.version;
  if (packaged.version !== manifest.version)
    report.errors.push(
      `Version mismatch: package.json=${manifest.version}, app.asar=${packaged.version}`,
    );

  const expected = new Set([...sourceFiles('build'), ...sourceFiles('electron')]);
  for (const entry of expected) {
    const local = fs.readFileSync(path.join(root, entry));
    const result = {
      path: entry,
      bytes: local.length,
      sha256: sha256(local),
      archiveSha256: null,
      matches: false,
    };
    try {
      // Do not follow a link in place of a shipped source file.
      const packagedFile = asar.extractFile(archivePath, path.normalize(entry), false);
      result.archiveSha256 = sha256(packagedFile);
      result.matches = result.sha256 === result.archiveSha256;
      if (!result.matches) report.errors.push(`Packaged file differs from workspace: ${entry}`);
    } catch (error) {
      report.errors.push(`Cannot verify packaged source ${entry}: ${error.message}`);
    }
    report.sourceFiles.push(result);
  }
  report.comparedFileCount = report.sourceFiles.length;
  for (const entry of archiveFiles) {
    if ((entry.startsWith('build/') || entry.startsWith('electron/')) && !expected.has(entry))
      report.errors.push(`Archive contains a stale or unexpected application file: ${entry}`);
  }

  for (const artifact of [
    'win-unpacked/resources/app.asar',
    `NexusCompanion-Portable-${manifest.version}.exe`,
    `NexusCompanion-Setup-${manifest.version}.exe`,
  ]) {
    try {
      await inspectArtifact(artifact);
    } catch (error) {
      report.errors.push(`${artifact}: ${error.message}`);
    }
  }
  if (report.errors.length) return;
  const sums = `SHA256SUMS-${manifest.version}.txt`;
  fs.writeFileSync(
    path.join(dist, sums),
    report.artifacts
      .filter((item) => item.path.endsWith('.exe'))
      .map((item) => `${item.sha256}  ${item.path}`)
      .join('\n') + '\n',
    'utf8',
  );
  report.checksumsFile = `dist/${sums}`;
  report.passed = true;
}

(async () => {
  try {
    await audit();
  } catch (error) {
    report.errors.push(error.message);
  }
  report.finishedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  if (!report.passed) {
    process.exitCode = 1;
    console.error(`FAIL release audit: ${report.errors.join('\n')}`);
  } else {
    console.log(
      `PASS release ${report.version}: ${report.comparedFileCount} source files match app.asar; ${report.entryCount} archive entries checked; ${report.artifacts.length} artifacts hashed.`,
    );
    console.log(`Checksums: ${path.join(root, report.checksumsFile)}`);
  }
  console.log(`Audit record: ${reportPath}`);
})().catch((error) => {
  console.error(`FAIL writing release audit: ${error.message}`);
  process.exitCode = 1;
});
