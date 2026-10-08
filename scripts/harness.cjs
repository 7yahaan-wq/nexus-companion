const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const full = process.argv.includes('--full');
const unitFiles = fs
  .readdirSync(path.join(root, 'tests'))
  .filter((name) => name.endsWith('.test.cjs'))
  .map((name) => 'tests/' + name);
const stages = [
  ['environment', ['scripts/doctor.cjs']],
  ['project contract', ['scripts/check-project.cjs']],
  ...(full
    ? [['full desktop verification', ['scripts/verify.cjs']]]
    : [
        ['unit tests', ['--test', ...unitFiles]],
        ['TypeScript', ['node_modules/typescript/bin/tsc', '--noEmit']],
        ['domain build', ['scripts/build-domain.cjs']],
        ['renderer build', ['node_modules/vite/bin/vite.js', 'build']],
        ['Nia desktop', ['tests/nia.cjs']],
      ]),
];
for (const [name, args] of stages) {
  console.log('\nHARNESS ' + name);
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: 'inherit',
    timeout: 180000,
    env: process.env,
  });
  if (result.status !== 0) {
    console.error(result.error || name + ' failed (' + result.status + ')');
    process.exit(1);
  }
}
console.log('\nPASS harness ' + (full ? 'full' : 'core'));
