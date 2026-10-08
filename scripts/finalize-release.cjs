const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const version = require('../package.json').version;
if (fs.realpathSync(dist) !== dist) throw Error('dist resolves outside the repository');
const documents = path.join(dist, 'docs');
const documentStat = fs.lstatSync(documents, { throwIfNoEntry: false });
if (
  documentStat &&
  (!documentStat.isDirectory() ||
    documentStat.isSymbolicLink() ||
    fs.realpathSync(documents) !== documents)
)
  throw Error('release documentation resolves outside the repository');
const copies = [
  ['README.md', 'README.md'],
  ['AGENTS.md', 'AGENTS.md'],
  ...[
    'USER_GUIDE',
    'DEVELOPMENT_HANDOFF',
    'PROJECT_STATUS',
    'VERIFICATION',
    'ARCHITECTURE',
    'AVATAR_PACK',
    'NIA_ANIMATION',
    'OPEN_SOURCE_RESEARCH',
    'START_ON_NEW_PC',
  ].map((name) => ['docs/' + name + '.md', 'docs/' + name + '.md']),
  ['docs/RELEASE_' + version + '.md', 'docs/RELEASE_' + version + '.md'],
];
for (const target of [
  'SHA256SUMS-' + version + '.txt',
  'RELEASE_STATUS.md',
  ...copies.map(([, target]) => target),
]) {
  const destination = path.join(dist, target);
  const stat = fs.lstatSync(destination, { throwIfNoEntry: false });
  if (stat && !stat.isFile()) throw Error('release output must be a regular file: ' + destination);
}
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
fs.mkdirSync(documents, { recursive: true });
for (const [source, target] of copies) {
  fs.copyFileSync(path.join(root, source), path.join(dist, target));
}
fs.writeFileSync(
  path.join(dist, 'RELEASE_STATUS.md'),
  '# Nexus Companion ' +
    version +
    '\n\nWindows x64 local build. See RELEASE_' +
    version +
    '.md under docs/ and SHA256SUMS-' +
    version +
    '.txt. Installer is unsigned; installation is not automatically tested.\n',
);
console.log('Current release files ready:\n' + lines.join('\n'));
