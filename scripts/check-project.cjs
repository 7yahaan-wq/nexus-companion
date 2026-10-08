const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const pkg = require('../package.json');
const lock = require('../package-lock.json');
const source = path.join(root, 'res', 'Nia.png');
assert.ok(fs.existsSync(source), 'Keep the user character reference at res/Nia.png');
assert.equal(lock.version, pkg.version, 'package and lockfile versions differ');

const states = ['idle', 'working', 'thinking', 'happy', 'warning', 'error', 'sleepy', 'celebrate'];
const reference = require('../art/nia-reference-manifest.json');
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
assert.deepEqual(
  Object.keys(reference.states),
  ['idle'],
  'Only accepted idle belongs in the reference animation manifest',
);
for (const file of [
  'res/Nia.png',
  'public/assets/nia/calm.png',
  ...states.map((state) => 'art/nia-source/' + state + '.png'),
]) {
  const bytes = fs.readFileSync(path.join(root, file));
  assert.equal(bytes.subarray(1, 4).toString(), 'PNG', file + ': protected PNG expected');
  assert.equal(
    sha256(bytes),
    reference.protectedSourceSha256[file],
    file + ': protected source changed',
  );
}
for (const state of ['idle']) {
  const file = path.join(root, 'public', 'assets', 'nia', 'animations', state + '.png');
  const bytes = fs.readFileSync(file);
  assert.equal(
    sha256(bytes),
    reference.states[state].atlasSha256,
    state + ': reference style atlas changed',
  );
  assert.equal(bytes.subarray(1, 4).toString(), 'PNG', state + ': PNG expected');
  assert.equal(bytes.readUInt32BE(16), 2172, state + ': width must be 6 x 362');
  assert.equal(bytes.readUInt32BE(20), 1448, state + ': height must be 4 x 362');
  assert.equal(bytes[25], 6, state + ': transparent RGBA expected');
  for (let frame = 0; frame < 24; frame++) {
    const name = String(frame).padStart(3, '0') + '.png';
    const cel = fs.readFileSync(path.join(root, 'art', 'nia-classic-frames', state, name));
    assert.equal(
      sha256(cel),
      reference.states[state].frameSha256[frame],
      state + '/' + name + ': protected reference cel changed',
    );
    assert.equal(cel.subarray(1, 4).toString(), 'PNG', state + '/' + name);
    assert.equal(cel.readUInt32BE(16), 362, state + '/' + name + ': width');
    assert.equal(cel.readUInt32BE(20), 362, state + '/' + name + ': height');
    assert.equal(cel[25], 6, state + '/' + name + ': RGBA');
  }
}
for (const state of states) {
  const portrait = fs.readFileSync(
    path.join(root, 'public', 'assets', 'nia', 'portraits', state + '.png'),
  );
  assert.equal(portrait.subarray(1, 4).toString(), 'PNG', state + ': portrait PNG expected');
  assert.equal(portrait.readUInt32BE(16), 1024, state + ': portrait width');
  assert.equal(portrait.readUInt32BE(20), 1536, state + ': portrait height');
  assert.equal(portrait[25], 6, state + ': portrait RGBA expected');
  const portraitSource = fs.readFileSync(path.join(root, 'art', 'nia-portraits', state + '.png'));
  assert.equal(
    sha256(portrait),
    sha256(portraitSource),
    state + ': portrait source/runtime mismatch',
  );
  const sourceFile = path.join(root, 'art', 'nia-source', state + '.png');
  const source = fs.readFileSync(sourceFile);
  assert.equal(source.subarray(1, 4).toString(), 'PNG', state + ': source PNG expected');
  assert.equal(source.readUInt32BE(16), 1254, state + ': source width changed');
  assert.equal(source.readUInt32BE(20), 1254, state + ': source height changed');
  assert.equal(source[25], 6, state + ': source RGBA expected');
}
assert.ok(
  fs.existsSync(path.join(root, 'scripts', 'normalize-nia.ps1')),
  'Nia normalization script missing',
);
const normalizer = fs.readFileSync(path.join(root, 'scripts', 'normalize-nia.ps1'), 'utf8');
assert.ok(
  normalizer.includes("[string]$OutputDir = '.test-data/nia-keyframes'"),
  'Normalization must not overwrite production 24-frame atlases by default',
);
const packer = fs.readFileSync(path.join(root, 'scripts', 'build-nia-24.py'), 'utf8');
assert.ok(packer.includes("f'{index:03}.png'"), 'packer must read numbered whole-frame PNGs');
assert.ok(
  !packer.includes('calcOpticalFlow') && !packer.includes('warp_one_source'),
  'Never synthesize in-between Nia frames',
);
const avatar = fs.readFileSync(path.join(root, 'src', 'domain', 'avatar.ts'), 'utf8');
assert.ok(!avatar.includes('spriteBlend'), 'Do not reintroduce flashing cross-fades');
const renderer = fs.readFileSync(path.join(root, 'src', 'avatar', 'AvatarManager.tsx'), 'utf8');
assert.ok(!renderer.includes('blend.mix'), 'Render a single authored cell at a time');
assert.ok(
  fs.existsSync(path.join(root, 'docs', 'RELEASE_' + pkg.version + '.md')),
  'Current release note missing',
);
console.log(
  'PASS project contract: accepted idle and original source hashes protected, current portraits valid; runtime art binding is checked by avatar tests',
);

const currentArt = require('../art/nia-state-hires/manifest.json');
for (const state of states.filter((state) => state !== 'idle')) {
  const entry = currentArt.states[state];
  assert.equal(entry.uniqueCels, 24);
  assert.equal(
    sha256(fs.readFileSync(path.join(root, 'public/assets/nia/animations-hires', state + '.png'))),
    entry.atlasSha256,
  );
  for (let page = 0; page < 2; page++) {
    assert.equal(
      sha256(
        fs.readFileSync(
          path.join(root, 'art/nia-state-hires/pages', state + '-' + ['a', 'b'][page] + '.png'),
        ),
      ),
      entry.sourceSha256[page],
    );
  }
  for (const frame of entry.frames) {
    const bytes = fs.readFileSync(
      path.join(
        root,
        'art/nia-state-hires/frames',
        state,
        String(frame.frame).padStart(3, '0') + '.png',
      ),
    );
    assert.equal(sha256(bytes), frame.sha256);
  }
}
console.log('PASS seven independent 24-cel candidate sequences: sources and output hashes match');
