const fs = require('node:fs');
const path = require('node:path');
const recognized = [
  /^NexusCompanion-(?:Setup|Portable)-(\d+\.\d+\.\d+)\.exe(?:\.blockmap)?$/,
  /^SHA256SUMS-(\d+\.\d+\.\d+)\.txt$/,
  /^RELEASE_(\d+\.\d+\.\d+)\.md$/,
];
const documentation = [
  'USER_GUIDE',
  'DEVELOPMENT_HANDOFF',
  'PROJECT_STATUS',
  'VERIFICATION',
  'ARCHITECTURE',
  'AVATAR_PACK',
  'NIA_ANIMATION',
  'OPEN_SOURCE_RESEARCH',
  'START_ON_NEW_PC',
];

function cleanDistribution(root, version, log = console.log) {
  const dist = path.join(path.resolve(root), 'dist');
  if (!fs.existsSync(dist)) return [];
  const directories = [dist, path.join(dist, 'docs')].filter(fs.existsSync);
  // Validate every directory before removing any files, including empty link targets.
  for (const directory of directories) {
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(directory) !== directory)
      throw Error('release directory resolves outside the repository: ' + directory);
  }
  const targets = [];
  for (const directory of directories) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const match = recognized.map((pattern) => entry.name.match(pattern)).find(Boolean);
      const replacement = path.join(dist, 'docs', entry.name);
      const duplicate =
        directory === dist &&
        documentation.some((name) => entry.name === name + '.md') &&
        fs.existsSync(replacement) &&
        fs.lstatSync(replacement).isFile();
      if (!(match && match[1] !== version) && !duplicate) continue;
      const target = path.join(directory, entry.name);
      targets.push(target);
    }
  }
  for (const target of targets) log('Removing obsolete generated release file: ' + target);
  for (const target of targets) fs.unlinkSync(target);
  return targets;
}

if (require.main === module) {
  cleanDistribution(path.resolve(__dirname, '..'), require('../package.json').version);
}
module.exports = { cleanDistribution };
