const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const version = require('../package.json').version;
if (!fs.existsSync(dist)) process.exit(0);
if (fs.realpathSync(dist) !== dist) throw Error('dist resolves outside the repository');
const recognized = [
  /^NexusCompanion-(?:Setup|Portable)-(\d+\.\d+\.\d+)\.exe(?:\.blockmap)?$/,
  /^SHA256SUMS-(\d+\.\d+\.\d+)\.txt$/,
  /^RELEASE_(\d+\.\d+\.\d+)\.md$/,
];
for (const entry of fs.readdirSync(dist, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const match = recognized.map((pattern) => entry.name.match(pattern)).find(Boolean);
  if (!match || match[1] === version) continue;
  const target = path.join(dist, entry.name);
  console.log('Removing old generated release file: ' + target);
  fs.unlinkSync(target);
}
