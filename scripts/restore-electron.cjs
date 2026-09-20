const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const extract = require('extract-zip');
(async () => {
  const version = require('../node_modules/electron/package.json').version;
  const name = `electron-v${version}-win32-x64.zip`;
  const root = path.join(process.env.LOCALAPPDATA, 'electron', 'Cache');
  let found;
  for (const d of fs.readdirSync(root)) {
    const p = path.join(root, d, name);
    if (fs.existsSync(p)) found = p;
  }
  if (!found) throw Error('No matching Electron cache');
  const sums = require('../node_modules/electron/checksums.json');
  const actual = crypto.createHash('sha256').update(fs.readFileSync(found)).digest('hex');
  if (sums[name] !== actual) throw Error('Electron checksum mismatch');
  const dest = path.resolve(__dirname, '../node_modules/electron/dist');
  fs.mkdirSync(dest, { recursive: true });
  await extract(found, { dir: dest });
  fs.writeFileSync(path.resolve(__dirname, '../node_modules/electron/path.txt'), 'electron.exe');
  console.log(`Restored Electron ${version}; SHA-256 verified: ${actual}`);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
