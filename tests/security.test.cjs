const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { validate } = require('../electron/storage/validation.cjs');
const { importPack, getAsset } = require('../electron/services/assets.cjs');
test('IPC record validator rejects invalid states and event ranges', () => {
  assert.throws(() => validate('tasks', { id: 'a', title: 'x', status: 'fake' }));
  assert.throws(() => validate('events', { id: 'a', title: 'x', start: 'bad', end: 'bad' }));
  assert.throws(() => validate('projects', { id: 'a', name: 'x', projectPath: 'relative' }));
  assert.doesNotThrow(() => validate('tasks', { id: 'a', title: 'real', status: 'Inbox' }));
});
test('asset import rejects traversal and invalid resource ids', async () => {
  const base = path.join(__dirname, '../.test-data/assets-' + Date.now());
  await fs.mkdir(base, { recursive: true });
  await fs.writeFile(
    path.join(base, 'avatar.json'),
    JSON.stringify({ name: 'Unsafe', states: { idle: '../../package.json' } }),
  );
  await assert.rejects(importPack(path.join(base, 'avatar.json'), base, {}), /目录外/);
  await assert.rejects(getAsset('../package.json', base), /Invalid asset/);
});
