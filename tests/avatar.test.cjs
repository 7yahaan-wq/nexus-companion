const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const now = new Date('2026-09-21T12:00:00').getTime();
const time = (age = 0) => new Date(now - age).toISOString();
const run = (status, age = 0) => ({ status, observedAt: time(age), endTime: time(age) });

test('avatar ignores stale failures and stale live states, while recent alerts take priority', async () => {
  const { resolveAvatarState: state } = await import('../src/domain/avatar.ts');
  assert.equal(state([run('FAILED', 300001)], true, now), 'working');
  assert.equal(state([run('FAILED', 300001)], false, now), 'idle');
  assert.equal(state([run('FAILED')], true, now), 'error');
  assert.equal(state([run('WAITING_APPROVAL')], true, now), 'warning');
  assert.equal(state([run('WAITING_APPROVAL', 120001)], false, now), 'idle');
  assert.equal(state([run('RUNNING', 120001)], false, now), 'idle');
  assert.equal(state([run('RUNNING')], false, now), 'working');
  assert.equal(state([run('STARTING')], false, now), 'thinking');
});

test('avatar completion reactions expire and reject invalid or future timestamps', async () => {
  const { resolveAvatarState: state } = await import('../src/domain/avatar.ts');
  assert.equal(state([run('COMPLETED')], false, now), 'happy');
  assert.equal(state([run('COMPLETED'), run('COMPLETED', 1000)], false, now), 'celebrate');
  assert.equal(state([run('COMPLETED', 120001)], false, now), 'idle');
  assert.equal(state([run('FAILED', -1000)], false, now), 'idle');
  assert.equal(state([{ status: 'FAILED', observedAt: 'invalid' }], false, now), 'idle');
});

test('nighttime mood uses local time and active focus remains working', async () => {
  const { resolveAvatarState: state } = await import('../src/domain/avatar.ts');
  const night = new Date('2026-09-21T23:30:00').getTime();
  assert.equal(state([], false, night), 'sleepy');
  assert.equal(state([], true, night), 'working');
  assert.equal(state([], false, new Date('2026-09-22T06:00:00').getTime()), 'idle');
});

test('every Nia state has a distinct 12-cell transparent sheet and correct playback contract', async () => {
  const { niaAnimations, avatarStates, avatarTriggers } = await import('../src/domain/avatar.ts');
  assert.deepEqual(Object.keys(niaAnimations).sort(), [...avatarStates].sort());
  assert.deepEqual(Object.keys(avatarTriggers).sort(), [...avatarStates].sort());
  assert.equal(new Set(Object.values(niaAnimations).map((animation) => animation.sheet)).size, 8);
  for (const animation of Object.values(niaAnimations)) {
    const file = path.join(__dirname, '../public', animation.sheet);
    const bytes = fs.readFileSync(file);
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    assert.equal(bytes[25], 6, 'RGBA alpha must be preserved');
    assert.equal(bytes.readUInt32BE(16), 1448, 'four 362px columns');
    assert.equal(bytes.readUInt32BE(20), 1086, 'three 362px rows');
    assert.deepEqual(
      animation.frames,
      Array.from({ length: 12 }, (_, index) => index),
    );
    assert.equal(animation.durations.length, 12);
    assert.ok(animation.still >= 0 && animation.still < 12);
    assert.ok(animation.durations.every((duration) => duration >= 100 && duration <= 5000));
    assert.equal(typeof animation.loop, 'boolean');
  }
  for (const state of ['happy', 'warning', 'error', 'celebrate']) {
    assert.equal(niaAnimations[state].loop, false);
  }
});
