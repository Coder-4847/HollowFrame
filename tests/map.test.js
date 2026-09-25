import { buildSkyline, buildSaltreach, buildSpillway } from '../src/terrain-maps.js';
import { buildCinderline, buildDeepwell } from '../src/expansion-maps.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildAshworks } from '../src/map.js';
import { buildSunbreak, buildWhiteout } from '../src/maps.js';
import { overlaps } from '../src/core.js';
import { Navigation } from '../src/navigation.js';
function mapFixture(build) {
  const mat = new THREE.MeshBasicMaterial();
  const mesh = () => {
    const obj = new THREE.Object3D();
    obj.material = mat;
    return obj;
  };
  const world = {
    scene: new THREE.Scene(),
    colliders: [],
    animated: [],
    material: () => mat,
    box: mesh,
    cylinder: mesh,
    text: mesh,
    solid(w, h, d, color, x, y, z) {
      this.colliders.push({ w, d, x, z, top: y + h / 2, bottom: y - h / 2 });
      return mesh();
    },
  };
  return { world, map: build(world) };
}
for (const [name, build] of Object.entries({
  ashworks: buildAshworks,
  sunbreak: buildSunbreak,
  whiteout: buildWhiteout,
  cinderline: buildCinderline,
  deepwell: buildDeepwell,
  skyline: buildSkyline,
  saltreach: buildSaltreach,
  spillway: buildSpillway,
})) {
  test(`${name}: every spawn clears boss collision and connects to start`, () => {
    const { world, map } = mapFixture(build);
    const nav = new Navigation(world.colliders, 0.7, 3, map);
    for (const p of map.spawns) {
      assert.ok(
        !world.colliders.some(
          (b) => b.top > p.y + 0.3 && b.bottom < p.y + 6 && overlaps(p.x, p.z, 1.75, b),
        ),
        `spawn ${p.x},${p.z} overlaps solid`,
      );
      assert.ok(nav.path(p, map.start).length > 0, `spawn ${p.x},${p.z} isolated`);
    }
    const heavy = new Navigation(world.colliders, 1.75, 6, map);
    assert.ok(
      map.spawns.some((p) => heavy.path(p, map.start).length > 0),
      'boss has navigation route',
    );
  });
}
test('Ashworks stairs connect ground navigation to service deck', () => {
  const { world, map } = mapFixture(buildAshworks);
  const nav = new Navigation(world.colliders);
  assert.ok(nav.path({ x: -24, z: 14 }, { x: -24, z: -2 }).length > 0);
});

test('every rooftop has a continuous boss-width stair route to insertion', () => {
  const { world, map } = mapFixture(buildSkyline);
  for (const radius of [0.7, 1.25, 1.75]) {
    const nav = new Navigation(world.colliders, radius, radius > 1.3 ? 6 : 3, map);
    for (const p of map.spawns)
      assert.ok(nav.path(p, map.start).length > 0, JSON.stringify({ radius, p }));
  }
});
