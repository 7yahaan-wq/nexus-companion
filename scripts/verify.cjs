const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..'),
  results = [];
const codexHome = path.join(root, '.test-data', 'verify-codex');
fs.mkdirSync(path.join(codexHome, 'sessions'), { recursive: true });
const commands = [
  ['project contract', ['scripts/check-project.cjs']],
  ['build', ['node_modules/typescript/bin/tsc', '--noEmit']],
  ['domain build', ['scripts/build-domain.cjs']],
  ['renderer build', ['node_modules/vite/bin/vite.js', 'build']],
  [
    'unit tests',
    [
      '--test',
      ...fs
        .readdirSync(path.join(root, 'tests'))
        .filter((f) => f.endsWith('.test.cjs'))
        .map((f) => 'tests/' + f),
    ],
  ],
  ...[
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
  ].map((name) => [name, ['tests/' + name + '.cjs']]),
];
for (const [name, args] of commands) {
  console.log(`\nVERIFY ${name}`);
  const begin = Date.now();
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, CODEX_HOME: codexHome },
    timeout: 180000,
  });
  results.push({ name, passed: result.status === 0, durationMs: Date.now() - begin });
  if (result.status !== 0) {
    console.error(result.error || `${name} failed (${result.status})`);
    process.exitCode = 1;
    break;
  }
}
fs.mkdirSync(path.join(root, '.test-data'), { recursive: true });
fs.writeFileSync(
  path.join(root, '.test-data/verification.json'),
  JSON.stringify({ time: new Date().toISOString(), results }, null, 2),
);
