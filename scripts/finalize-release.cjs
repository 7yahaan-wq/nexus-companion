const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const version = require('../package.json').version;
if (fs.realpathSync(dist) !== dist) throw Error('dist resolves outside the repository');
const names = [
  'NexusCompanion-Setup-' + version + '.exe',
  'NexusCompanion-Portable-' + version + '.exe',
];
const lines = names.map((name) => {
  const hash = crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(dist, name)))
    .digest('hex');
  return hash + '  ' + name;
});
fs.writeFileSync(path.join(dist, 'SHA256SUMS-' + version + '.txt'), lines.join('\n') + '\n');
for (const [source, target] of [
  ['README.md', 'README.md'],
  ['docs/USER_GUIDE.md', 'USER_GUIDE.md'],
  ['docs/RELEASE_' + version + '.md', 'RELEASE_' + version + '.md'],
])
  fs.copyFileSync(path.join(root, source), path.join(dist, target));
fs.writeFileSync(
  path.join(dist, 'RELEASE_STATUS.md'),
  '# Nexus Companion ' +
    version +
    '\n\nWindows x64 local build. See RELEASE_' +
    version +
    '.md and SHA256SUMS-' +
    version +
    '.txt. Installer is unsigned; installation is not automatically tested.\n',
);
console.log('Current release files ready:\n' + lines.join('\n'));
