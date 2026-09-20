const fs = require('node:fs/promises');
const path = require('node:path');
const { Store } = require('./index.cjs');

async function readLocation(base) {
  try {
    return JSON.parse(await fs.readFile(path.join(base, 'data-location.json'), 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return {};
    throw e;
  }
}
async function writeLocation(base, value) {
  await fs.mkdir(base, { recursive: true });
  const file = path.join(base, 'data-location.json');
  await fs.writeFile(file + '.tmp', JSON.stringify(value));
  await fs.rename(file + '.tmp', file);
}
async function scheduleLocation(base, current, selected) {
  const parent = await fs.realpath(selected);
  const target = path.join(parent, 'NexusCompanion-Data');
  const rel = path.relative(current, target);
  if (!rel || (!rel.startsWith('..' + path.sep) && !path.isAbsolute(rel)))
    throw Error('请选择当前数据目录以外的位置');
  try {
    await fs.access(target);
    throw Error('目标已有 NexusCompanion-Data，请选择其他文件夹，避免覆盖数据');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  await writeLocation(base, { active: current, pending: target });
  return target;
}
async function resolveLocation(base) {
  const config = await readLocation(base);
  const source = config.active || base;
  if (config.active) await fs.access(path.join(source, 'nexus.sqlite'));
  if (!config.pending) return source;
  const target = config.pending;
  // Reserve a new directory. Never merge into or overwrite an existing destination.
  let from, to;
  try {
    await fs.mkdir(target);
    from = new Store(path.join(source, 'nexus.sqlite'));
    to = new Store(path.join(target, 'nexus.sqlite'));
    await to.merge(await from.snapshot());
    const check = await to.integrity();
    if (check.quick_check !== 'ok') throw Error('迁移数据库校验失败');
    for (const name of ['assets', 'backups', 'logs']) {
      const folder = path.join(source, name);
      try {
        await fs.cp(folder, path.join(target, name), {
          recursive: true,
          errorOnExist: true,
          force: false,
          filter: async (file) => !(await fs.lstat(file)).isSymbolicLink(),
        });
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
    }
    await writeLocation(base, { active: target });
    return target;
  } catch (e) {
    await writeLocation(base, { active: source });
    throw e;
  } finally {
    await from?.close();
    await to?.close();
  }
}
module.exports = { readLocation, writeLocation, scheduleLocation, resolveLocation };
