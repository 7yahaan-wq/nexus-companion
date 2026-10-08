const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const version = require('../package.json').version;
const executable = path.join(root, 'dist', 'win-unpacked', 'Nexus Companion.exe');
const codexHome = path.join(root, '.test-data', 'packaged-codex');
fs.mkdirSync(path.join(codexHome, 'sessions'), { recursive: true });
const report = { version, time: new Date().toISOString(), executable, results: [] };
for (const name of [
  'e2e',
  'usability',
  'nia',
  'notes-flow',
  'focus-flow',
  'planning-flow',
  'workflow',
  'portable',
]) {
  console.log('\nPACKAGED ' + name);
  const started = Date.now();
  const result = spawnSync(process.execPath, ['tests/' + name + '.cjs'], {
    cwd: root,
    stdio: 'inherit',
    timeout: 180000,
    env: { ...process.env, NEXUS_PACKAGED_EXE: executable, CODEX_HOME: codexHome },
  });
  report.results.push({ name, passed: result.status === 0, durationMs: Date.now() - started });
  if (result.status !== 0) {
    console.error(result.error || name + ' failed (' + result.status + ')');
    process.exitCode = 1;
    break;
  }
}
fs.writeFileSync(
  path.join(root, '.test-data', 'packaged-verification.json'),
  JSON.stringify(report, null, 2) + '\n',
);
if (!process.exitCode) console.log('\nPASS packaged ' + version);
