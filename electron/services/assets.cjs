const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
async function importImage(file, root, nativeImage) {
  const ext = path.extname(file).toLowerCase();
  if (!allowed.has(ext)) throw Error('只支持 PNG/JPG/WEBP/GIF 图片');
  const stat = await fs.stat(file);
  if (stat.size > 12 * 1024 * 1024) throw Error('图片不能超过 12 MB');
  const buffer = await fs.readFile(file);
  if (nativeImage.createFromBuffer(buffer).isEmpty()) throw Error('无法解码此图片');
  const id = crypto.createHash('sha256').update(buffer).digest('hex') + ext;
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(path.join(root, id), buffer);
  return id;
}
async function getAsset(id, root) {
  if (typeof id !== 'string' || !/^[a-f0-9]{64}\.(png|jpe?g|webp|gif)$/.test(id))
    throw Error('Invalid asset');
  const data = await fs.readFile(path.join(root, id));
  const ext = path.extname(id).slice(1);
  return `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${data.toString('base64')}`;
}
async function importPack(file, root, nativeImage) {
  if ((await fs.stat(file)).size > 64000) throw Error('avatar.json 过大');
  const config = JSON.parse(await fs.readFile(file, 'utf8'));
  if (typeof config.name !== 'string' || config.name.length > 80)
    throw Error('Avatar Pack 需要有效名称');
  const base = await fs.realpath(path.dirname(file));
  const states = {};
  for (const state of [
    'idle',
    'working',
    'thinking',
    'happy',
    'warning',
    'error',
    'sleepy',
    'celebrate',
  ]) {
    const value = config.states?.[state] || config[state];
    if (typeof value !== 'string' || path.isAbsolute(value))
      throw Error(`缺少相对资源路径：${state}`);
    const source = await fs.realpath(path.resolve(base, value));
    const relative = path.relative(base, source);
    if (relative.startsWith('..') || path.isAbsolute(relative))
      throw Error('Avatar 资源不能位于 pack 目录外');
    states[state] = await importImage(source, root, nativeImage);
  }
  return { id: crypto.randomUUID(), name: config.name, states };
}
module.exports = { importImage, getAsset, importPack };
