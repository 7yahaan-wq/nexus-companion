const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const pkg = require('../package.json');
const lock = require('../package-lock.json');
const source = path.join(root, 'res', 'Nia.png');
assert.ok(fs.existsSync(source), 'Keep the user character reference at res/Nia.png');
assert.equal(lock.version, pkg.version, 'package and lockfile versions differ');

const states = ['idle', 'working', 'thinking', 'happy', 'warning', 'error', 'sleepy', 'celebrate'];
for (const state of states) {
  const file = path.join(root, 'public', 'assets', 'nia', 'animations', state + '.png');
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.subarray(1, 4).toString(), 'PNG', state + ': PNG expected');
  assert.equal(bytes.readUInt32BE(16), 1448, state + ': width must be 4 x 362');
  assert.equal(bytes.readUInt32BE(20), 1086, state + ': height must be 3 x 362');
  assert.equal(bytes[25], 6, state + ': transparent RGBA expected');
}
const avatar = fs.readFileSync(path.join(root, 'src', 'domain', 'avatar.ts'), 'utf8');
assert.ok(!avatar.includes('spriteBlend'), 'Do not reintroduce flashing cross-fades');
const renderer = fs.readFileSync(path.join(root, 'src', 'avatar', 'AvatarManager.tsx'), 'utf8');
assert.ok(!renderer.includes('blend.mix'), 'Render a single authored cell at a time');
assert.ok(
  fs.existsSync(path.join(root, 'docs', 'RELEASE_' + pkg.version + '.md')),
  'Current release note missing',
);
console.log(
  'PASS project contract: reference protected, eight RGBA 12-frame sheets, no cross-fade, versioned docs',
);
