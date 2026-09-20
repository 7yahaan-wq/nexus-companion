const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
let failed = false;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'OK' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) failed = true;
};
check('Node', Number(process.versions.node.split('.')[0]) >= 24, process.versions.node);
const electron = require('../node_modules/electron/package.json').version;
check('Electron', electron === '39.8.10', electron);
check(
  'Runtime',
  fs.existsSync(path.join(root, 'node_modules/electron/dist/electron.exe')),
  'Windows x64 Electron',
);
check('Assets', fs.existsSync(path.join(root, 'public/assets/nia.png')), 'Nia sprite');
check('Lockfile', fs.existsSync(path.join(root, 'package-lock.json')), 'npm reproducibility');
const git = spawnSync('git', ['--version'], { encoding: 'utf8', windowsHide: true });
console.log(`${git.status === 0 ? 'OK' : 'OPTIONAL'} Git: ${(git.stdout || 'Unavailable').trim()}`);
if (failed) process.exitCode = 1;
