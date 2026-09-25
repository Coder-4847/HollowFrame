import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Parkour, bodyFits, mantleTarget } from '../src/movement.js';
function fixture(boxes = []) {
  const keys = new Set(),
    pressed = new Set();
  const p = {
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    grounded: true,
    sprint: false,
    crouch: false,
    yaw: 0,
    game: {
      input: {
        down: (k) => keys.has(k),
        tap: (k) => pressed.has(k),
        crouchToggle: false,
        aim: false,
      },
      settings: {},
      world: { colliders: boxes },
      weapons: { current: { mobility: 1 } },
      upgrades: {},
      audio: { burst() {}, tone() {} },
    },
  };
  p.parkour = new Parkour(p);
  return {
    p,
    keys,
    pressed,
    step(dt = 1 / 60) {
      p.parkour.update(dt);
      pressed.clear();
    },
  };
}
const wall = { x: 0, z: -1.5, w: 6, d: 1, top: 5, bottom: 0 };
test('sprint slide boosts speed, lowers stance and cannot retrigger while held', () => {
  const f = fixture();
  f.keys.add('KeyW');
  f.keys.add('ShiftLeft');
  for (let n = 0; n < 40; n++) f.step();
  const speed = f.p.velocity.length();
  f.keys.add('KeyC');
  f.pressed.add('KeyC');
  f.step();
  assert.ok(f.p.parkour.slide > 0 && f.p.crouch);
  assert.ok(f.p.velocity.length() > speed);
  for (let n = 0; n < 90; n++) f.step();
  assert.equal(f.p.parkour.slide, 0);
  assert.ok(f.p.velocity.length() < 3);
});
test('slide jump carries momentum and leaves ground', () => {
  const f = fixture();
  f.keys.add('KeyW');
  f.keys.add('ShiftLeft');
  for (let n = 0; n < 40; n++) f.step();
  f.keys.add('KeyC');
  f.pressed.add('KeyC');
  f.step();
  f.pressed.add('Space');
  f.step();
  assert.ok(!f.p.grounded && f.p.velocity.y > 0 && f.p.parkour.momentum > 0);
  assert.ok(Math.hypot(f.p.velocity.x, f.p.velocity.z) > 9);
});
test('wall kick pushes away, forbids repeat on same wall and resets on landing', () => {
  const f = fixture([wall]);
  f.p.position.set(0, 1, -0.6);
  f.p.grounded = false;
  f.pressed.add('Space');
  f.step();
  assert.ok(f.p.velocity.z > 7 && f.p.velocity.y > 7);
  assert.equal(f.p.parkour.kicks, 1);
  f.p.position.set(0, 1, -0.6);
  f.p.velocity.set(0, 0, 0);
  f.p.parkour.wallLock = 0;
  f.pressed.add('Space');
  f.step();
  assert.equal(f.p.parkour.kicks, 1);
  assert.ok(f.p.velocity.y < 0);
  f.p.position.set(5, 0.01, 0);
  f.p.velocity.y = -5;
  f.step();
  assert.equal(f.p.parkour.kicks, 0);
});
test('mantle reaches supported top, rejects tall ledges and obstructed headroom', () => {
  const ledge = { x: 0, z: -1.5, w: 3, d: 2, top: 1.5, bottom: 0 };
  const f = fixture([ledge]);
  assert.ok(mantleTarget(f.p.position, 0, [ledge]));
  f.keys.add('KeyW');
  f.pressed.add('Space');
  f.step();
  assert.ok(f.p.parkour.mantle);
  for (let n = 0; n < 24; n++) f.step();
  assert.equal(f.p.position.y, 1.5);
  assert.ok(bodyFits(f.p.position, 1.8, [ledge]));
  assert.equal(mantleTarget(new THREE.Vector3(), 0, [{ ...ledge, top: 3 }]), null);
  assert.equal(
    mantleTarget(new THREE.Vector3(), 0, [ledge, { x: 0, z: -1, w: 4, d: 5, bottom: 2.6, top: 3 }]),
    null,
  );
});
test('rising jump collides with ceiling and fast slide cannot cross thin wall', () => {
  const roof = { x: 0, z: 0, w: 5, d: 5, bottom: 2, top: 3 };
  const f = fixture([roof]);
  f.pressed.add('Space');
  for (let n = 0; n < 20; n++) f.step();
  assert.ok(f.p.position.y <= 0.201);
  const s = fixture([{ x: 0, z: -0.6, w: 4, d: 0.08, bottom: 0, top: 4 }]);
  s.p.velocity.z = -20;
  s.p.parkour.slide = 0.8;
  s.keys.add('KeyC');
  s.step(0.04);
  assert.ok(s.p.position.z >= -0.181);
});
test('jump buffer survives imminent landing and reset removes parkour state', () => {
  const f = fixture();
  f.p.position.y = 0.06;
  f.p.grounded = false;
  f.p.velocity.y = -3;
  f.pressed.add('Space');
  f.step();
  f.step();
  f.step();
  assert.ok(f.p.velocity.y > 0);
  f.p.parkour.reset();
  assert.equal(f.p.parkour.buffer, 0);
  assert.equal(f.p.parkour.mantle, null);
});
test('coyote jump works briefly after an edge, never after the grace window', () => {
  const f = fixture();
  f.step();
  f.p.grounded = false;
  f.p.position.y = 2;
  f.step(0.04);
  f.pressed.add('Space');
  f.step();
  assert.ok(f.p.velocity.y > 0);
  const late = fixture();
  late.step();
  late.p.grounded = false;
  late.p.position.y = 2;
  for (let n = 0; n < 10; n++) late.step();
  late.pressed.add('Space');
  late.step();
  assert.ok(late.p.velocity.y < 0);
});
test('alternating walls allow only two kicks before landing', () => {
  const other = { x: 0, z: 1.5, w: 6, d: 1, top: 5, bottom: 0 };
  const f = fixture([wall, other]);
  for (let n = 0; n < 3; n++) {
    f.p.position.set(0, 1, n % 2 ? 0.6 : -0.6);
    f.p.velocity.set(0, 0, 0);
    f.p.grounded = false;
    f.p.parkour.wallLock = 0;
    f.pressed.add('Space');
    f.step();
  }
  assert.equal(f.p.parkour.kicks, 2);
  assert.ok(f.p.velocity.y < 0);
});
