const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { validate } = require('../storage/validation.cjs');
const collections = [
  'projects',
  'tasks',
  'events',
  'notes',
  'focus',
  'timeline',
  'reports',
  'settings',
];
function checksum(data) {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}
function portableSetting(value) {
  const id = value?.id;
  return (
    typeof id === 'string' &&
    (['appearance', 'agent-profiles', 'capture-preferences'].includes(id) ||
      /^daily-plan:\d{4}-\d{2}-\d{2}$/.test(id) ||
      /^draft:(note:[^:\s]{1,180}|capture)$/.test(id))
  );
}
function validatePortableSetting(value) {
  if (!portableSetting(value)) throw Error('不能导入运行中的内部状态');
  if (
    value.id.startsWith('daily-plan:') &&
    (value.date !== value.id.slice(11) ||
      !Array.isArray(value.topTaskIds) ||
      value.topTaskIds.length > 3 ||
      value.topTaskIds.some((id) => typeof id !== 'string' || id.length > 200) ||
      !Number.isFinite(value.capacityMinutes) ||
      value.capacityMinutes < 0 ||
      value.capacityMinutes > 1440)
  )
    throw Error('无效每日计划');
  if (value.id.startsWith('draft:')) {
    validate('settings', value.value);
    if (typeof value.revision !== 'string' || !value.revision || value.revision.length > 200)
      throw Error('无效草稿');
    if (
      value.id.startsWith('draft:note:') &&
      value.id !== 'draft:note:new' &&
      value.value.id !== value.id.slice(11)
    )
      throw Error('草稿与笔记不匹配');
    if (
      value.id === 'draft:capture' &&
      (!['notes', 'tasks'].includes(value.value.kind) || typeof value.value.text !== 'string')
    )
      throw Error('无效快速记录草稿');
  }
  if (value.id === 'capture-preferences' && !['notes', 'tasks'].includes(value.kind))
    throw Error('无效快速记录类型');
}
async function createBackup(store, assetsRoot) {
  const records = await store.snapshot();
  const filtered = records.filter(
    (r) => collections.includes(r.kind) && (r.kind !== 'settings' || portableSetting(r.value)),
  );
  const ids = new Set();
  for (const r of filtered) {
    if (r.kind === 'settings' && r.value.id === 'appearance') {
      if (r.value.backgroundImage) ids.add(r.value.backgroundImage);
      for (const id of Object.values(r.value.avatarPack?.states || {})) ids.add(id);
    }
  }
  const assets = {};
  for (const id of ids) {
    if (!/^[a-f0-9]{64}\.(png|jpe?g|webp|gif)$/.test(id)) throw Error('Invalid asset in settings');
    assets[id] = (await fs.readFile(path.join(assetsRoot, id))).toString('base64');
  }
  const data = { records: filtered, assets };
  return {
    format: 'nexus-companion-backup',
    version: 1,
    createdAt: new Date().toISOString(),
    sha256: checksum(data),
    data,
  };
}
function validateBackup(bundle) {
  if (
    bundle?.format !== 'nexus-companion-backup' ||
    bundle.version !== 1 ||
    !bundle.data ||
    bundle.sha256 !== checksum(bundle.data)
  )
    throw Error('备份格式或 SHA-256 校验失败');
  if (!Array.isArray(bundle.data.records) || bundle.data.records.length > 50000)
    throw Error('备份记录数量无效');
  for (const r of bundle.data.records) {
    if (!collections.includes(r.kind)) throw Error('不支持的备份数据类型');
    if (r.kind === 'settings') validatePortableSetting(r.value);
    validate(r.kind, r.value);
  }
  for (const [id, base64] of Object.entries(bundle.data.assets || {})) {
    if (!/^[a-f0-9]{64}\.(png|jpe?g|webp|gif)$/.test(id) || typeof base64 !== 'string')
      throw Error('无效备份资源');
    const b = Buffer.from(base64, 'base64');
    if (
      b.length > 12 * 1024 * 1024 ||
      crypto.createHash('sha256').update(b).digest('hex') !== id.split('.')[0]
    )
      throw Error('备份图片校验失败');
  }
  return bundle;
}
async function restoreBackup(store, bundle, assetsRoot) {
  validateBackup(bundle);
  await fs.mkdir(assetsRoot, { recursive: true });
  for (const [id, data] of Object.entries(bundle.data.assets || {}))
    await fs.writeFile(path.join(assetsRoot, id), Buffer.from(data, 'base64'));
  await store.merge(bundle.data.records);
  return bundle.data.records.length;
}
module.exports = { createBackup, validateBackup, restoreBackup, checksum };
