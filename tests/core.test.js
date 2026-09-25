import { test } from 'node:test';
import assert from 'node:assert/strict';
import { damageFor, moveBody, floorAt, readSave, saveData } from '../src/core.js';
import { Navigation } from '../src/navigation.js';
import { WEAPONS, WAVES, ENEMIES } from '../src/data.js';
test('sensor shots bypass armor, precision penetrates, damage falls off', () => {
  const rifle = WEAPONS[0],
    needle = WEAPONS[2];
  assert.equal(damageFor(rifle, 'sensor', 200), rifle.damage * rifle.weak);
  assert.ok(damageFor(rifle, 'body', 200) < damageFor(rifle, 'body', 0));
  assert.ok(
    damageFor(needle, 'body', 200) / needle.damage > damageFor(rifle, 'body', 200) / rifle.damage,
  );
  assert.ok(damageFor(rifle, 'body', 0, 90) < damageFor(rifle, 'body', 0, 10));
});
test('large arenas clamp both axes to their own bounds', () => {
  const p = { x: 0, z: 44, y: 0 };
  moveBody(p, 0, 1, 0.4, 1.8, [], 0.45, 55);
  assert.equal(p.z, 45);
  moveBody(p, 80, 80, 0.4, 1.8, [], 0.45, 55);
  assert.equal(p.x, 54.6);
  assert.equal(p.z, 54.6);
});
test('collision slides along walls and permits steps, floor supports deck', () => {
  const wall = { x: 0, z: 0, w: 2, d: 10, top: 3, bottom: 0 };
  const p = { x: 2, z: 0, y: 0 };
  moveBody(p, -1, 1, 0.4, 1.8, [wall]);
  assert.equal(p.x, 2);
  assert.equal(p.z, 1);
  const step = { x: 0, z: 0, w: 3, d: 3, top: 0.3, bottom: 0 };
  const q = { x: 2, z: 0, y: 0 };
  moveBody(q, -1, 0, 0.4, 1.8, [step]);
  assert.equal(q.x, 1);
  assert.equal(floorAt(q, 0.4, [step]), 0.3);
});
test('navigation routes around cover', () => {
  const nav = new Navigation([{ x: 0, z: 0, w: 6, d: 15, top: 4, bottom: 0 }]);
  const path = nav.path({ x: -10, z: 0 }, { x: 10, z: 0 });
  assert.ok(path.length > 10);
  assert.ok(path.every((p) => nav.columns.get(nav.index(p.x, p.z))?.length > 0));
  assert.deepEqual(path.at(-1), { x: 10, y: 0, z: 0 });
});
test('corrupt and inaccessible save storage fail safely', () => {
  assert.deepEqual(readSave({ getItem: () => '{bad' }), {});
  assert.deepEqual(readSave({ getItem: () => 'null' }), {});
  assert.equal(
    saveData(
      {},
      {
        setItem: () => {
          throw Error('blocked');
        },
      },
    ),
    false,
  );
});
test('eight wave rules reference valid machines and preserve onboarding', () => {
  assert.equal(WAVES.length, 8);
  assert.ok(!WAVES[0].pool.includes('bastion'));
  for (const w of WAVES) for (const id of w.pool) assert.ok(ENEMIES[id]);
  assert.equal(WAVES.at(-1).kind, 'boss');
});

test('blocked localStorage getter does not prevent launch', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw Error('denied');
      },
    });
    assert.deepEqual(readSave(), {});
    assert.equal(saveData({}), false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});
