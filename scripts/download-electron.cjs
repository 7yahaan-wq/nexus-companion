const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const { Readable } = require('node:stream');
const extract = require('extract-zip');
(async () => {
  const version = require('../node_modules/electron/package.json').version;
  const name = `electron-v${version}-win32-x64.zip`;
  const target = path.resolve(__dirname, '../.test-data', name);
  await fsp.mkdir(path.dirname(target), { recursive: true });
  const sum = require('../node_modules/electron/checksums.json')[name];
  for (const base of [
    `https://github.com/electron/electron/releases/download/v${version}/`,
    `https://npmmirror.com/mirrors/electron/${version}/`,
  ]) {
    try {
      console.log('Downloading', base + name);
      const response = await fetch(base + name, { signal: AbortSignal.timeout(180000) });
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(target));
      const hash = crypto
        .createHash('sha256')
        .update(await fsp.readFile(target))
        .digest('hex');
      if (hash !== sum) throw Error('SHA-256 mismatch');
      const dest = path.resolve(__dirname, '../node_modules/electron/dist');
      await fsp.mkdir(dest, { recursive: true });
      await extract(target, { dir: dest });
      await fsp.writeFile(
        path.resolve(__dirname, '../node_modules/electron/path.txt'),
        'electron.exe',
      );
      console.log('Verified and installed', version, hash);
      return;
    } catch (e) {
      console.log('Download failed:', e.message);
    }
  }
  throw Error('Could not download verified Electron runtime');
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
