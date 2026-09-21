const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const root = path.join(__dirname, '..'),
    data = path.join(root, '.test-data/portable-' + Date.now());
  await fs.mkdir(data, { recursive: true });
  const version = require('../package.json').version;
  const executable = path.join(root, `dist/NexusCompanion-Portable-${version}.exe`);
  const child = spawn(executable, ['--smoke'], {
    env: { ...process.env, NEXUS_DATA_DIR: data },
    windowsHide: true,
    stdio: 'pipe',
  });
  let output = '';
  child.stdout.on('data', (b) => (output += b));
  child.stderr.on('data', (b) => (output += b));
  const code = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(Error('Portable smoke timed out\n' + output));
    }, 90000);
    child.once('error', reject);
    child.once('exit', (c) => {
      clearTimeout(timeout);
      resolve(c);
    });
  });
  assert.equal(code, 0, output);
  const smoke = JSON.parse(await fs.readFile(path.join(data, 'smoke.json'), 'utf8'));
  assert.equal(smoke.title, 'Nexus Companion');
  assert.equal(smoke.bridge, true);
  assert.match(smoke.text, /欢迎使用 Nexus/);
  await fs.copyFile(path.join(data, 'smoke.png'), path.join(root, '.test-data/portable-smoke.png'));
  await fs.writeFile(
    path.join(root, '.test-data/portable-result.json'),
    JSON.stringify({ passed: true, executable, code, time: new Date().toISOString() }, null, 2),
  );
  console.log(
    'PASS: actual portable exe launches, bundled UI/SQLite bridge ready, onboarding rendered, exits cleanly',
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
