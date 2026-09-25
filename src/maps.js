import { dressArena } from './arena-details.js';
import { dressSurfaces } from './set-dressing.js';
import { buildSkyline, buildSaltreach, buildSpillway } from './terrain-maps.js';
import { addFieldMarkings } from './markings.js';
import { buildCinderline, buildDeepwell } from './expansion-maps.js';
import * as THREE from 'three';
import { buildAshworks } from './map.js';
import { MAPS } from './content.js';

function boundary(w, ground, wall) {
  const floor = w.solid(72, 1, 72, ground, 0, -0.5, 0);
  floor.material = floor.material.clone();
  floor.material.map = w.floorTexture;
  for (const z of [-36, 36]) w.solid(74, 7, 2, wall, 0, 3.5, z);
  // Side walls sit 2 cm lower than the end walls so their shared corner tops never z-fight.
  for (const x of [-36, 36]) w.solid(2, 6.98, 72, wall, x, 3.49, 0);
}
function station(w, pos, color) {
  w.solid(3, 1.35, 1.4, 0x384c4e, pos.x, 0.675, pos.z);
  w.box(2.4, 0.1, 1.45, color, pos.x, 1.4, pos.z, w.scene, true);
  w.text('FIELD CACHE', pos.x, 2.3, pos.z, 0.6, '#d0efdf');
}
function steps(w, x, z, count = 8) {
  for (let n = 0; n < count; n++) w.solid(5, 0.3 * (n + 1), 1, 0x778186, x, 0.15 * (n + 1), z - n);
}
export function buildSunbreak(w) {
  boundary(w, 0xb5a380, 0x817b69);
  // An open figure-eight through relay bunkers; the dish blocks only the northern loop.
  w.solid(8, 3, 8, 0x6a756f, 0, 1.5, -13);
  w.solid(2.5, 12, 2.5, 0x66756f, 0, 7, -13);
  const dish = new THREE.Mesh(new THREE.ConeGeometry(7, 2.5, 16, 1, true), w.material(0xa6b1a3));
  dish.material = dish.material.clone();
  dish.material.side = THREE.DoubleSide;
  dish.position.set(0, 13, -13);
  dish.rotation.z = 0.35;
  w.scene.add(dish);
  const antenna = w.box(0.2, 5, 0.2, 0xb8ccba, 0, 15, -13);
  antenna.rotation.z = 0.35;
  for (const x of [-15, 15]) {
    w.solid(8, 4, 1.5, 0x7e8171, x, 2, -4);
    w.solid(1.5, 4, 10, 0x7e8171, x + Math.sign(x) * 4, 2, 0);
    w.solid(8, 0.6, 10, 0x959786, x, 4.3, 0);
    w.box(6, 0.2, 0.2, 0x89dfcf, x, 3.3, -3.1, w.scene, true);
    w.text(x < 0 ? 'RELAY A' : 'RELAY B', x, 2.6, -3.15, 0.65, '#d8e4c5');
  }
  // Accessible observation deck, reached from the southern approach.
  w.solid(8, 2.4, 12, 0x787b67, -25, 1.2, 16);
  steps(w, -25, 30);
  w.solid(1, 1.1, 11, 0x8f9680, -28.5, 2.95, 16);
  for (const [x, z, width] of [
    [-9, 16, 6],
    [10, 17, 4],
    [22, -18, 6],
    [-21, -21, 5],
    [5, 2, 3],
  ]) {
    w.solid(width, 1.8, 2.5, 0x8c8a6d, x, 0.9, z);
    w.box(width + 0.03, 0.18, 2.53, 0xc5af76, x, 1.35, z);
  }
  for (const [x, z, h] of [
    [31, 10, 6],
    [-31, -10, 9],
    [15, -29, 7],
    [-8, 31, 3],
  ]) {
    w.solid(4, h, 4, 0x8c816d, x, h / 2, z);
    w.box(4.5, 0.2, 4.5, 0xa9997c, x, h, z);
  }
  for (let n = 0; n < 8; n++) {
    const x = -50 + n * 14;
    w.box(8, 14 + (n % 3) * 5, 9, 0x8b8779, x, 5, -47);
  }
  w.text('SUNBREAK / 12', 0, 5, 34.8, 2, '#e3d7af', Math.PI);
  w.text('NO SIGNAL IS INNOCENT', 0, 3, -34.8, 1.1, '#f1d7a3');
  const spawns = [
    [-29, -29],
    [28, -28],
    [-30, 3],
    [28, 28],
    [0, -29],
  ].map(([x, z]) => new THREE.Vector3(x, 0, z));
  const cache = new THREE.Vector3(5, 0, 27);
  station(w, cache, 0x91dbc8);
  return { spawns, station: cache, start: new THREE.Vector3(0, 0, 26) };
}

export function buildWhiteout(w) {
  boundary(w, 0xaebfc6, 0x5e7986);
  // Two connected labs form distinct indoor lanes around an outdoor central spine.
  for (const x of [-17, 17]) {
    w.solid(1.4, 5, 30, 0x526c7c, x - Math.sign(x) * 6, 2.5, -3);
    w.solid(1.4, 5, 30, 0x526c7c, x + Math.sign(x) * 6, 2.5, -3);
    // Door gaps in the north and south ends prevent a sealed room.
    for (const z of [-18, 12])
      for (const dx of [-4.5, 4.5]) w.solid(3, 5, 1.4, 0x657f8a, x + dx, 2.5, z);
    for (const z of [-8, 3]) {
      w.solid(3.8, 1.5, 2, 0x648c9c, x, 0.75, z);
      w.box(3.7, 0.1, 1.9, 0x91d9eb, x, 1.56, z, w.scene, true);
    }
    for (const z of [-13, -1, 8]) {
      w.box(10, 0.2, 0.6, 0xc2e8f4, x, 4.8, z, w.scene, true);
      w.box(12, 0.3, 2, 0x526779, x, 5.2, z);
    }
    w.text(x < 0 ? 'CRYO / 01' : 'ARCHIVE / 02', x, 3.8, 12.75, 0.7, '#cae9ec');
  }
  // Northern array plaza and a climbable ice service terrace to the east.
  w.solid(6, 2.4, 8, 0x8299a7, 27, 1.2, -22);
  steps(w, 27, -10);
  for (const x of [-5, 5]) {
    w.solid(2.4, 7, 2.4, 0x566b7f, x, 3.5, -27);
    w.box(0.18, 6, 0.18, 0x94d5f6, x, 4, -25.7, w.scene, true);
  }
  w.box(13, 0.5, 2, 0x829aab, 0, 7, -27);
  w.text('WHITEOUT ARRAY', 0, 5, -25.65, 1.1, '#bce9ff');
  for (const [x, z] of [
    [0, 0],
    [0, 18],
    [-29, 20],
    [30, 22],
    [-27, -27],
  ]) {
    w.solid(4, 1.8, 3, 0x7192a2, x, 0.9, z);
    w.box(4.15, 0.15, 3.15, 0xe0eced, x, 1.85, z);
  }
  for (const x of [-30, 30])
    for (let z = -30; z <= 30; z += 12) {
      w.box(0.18, 8, 0.18, 0x8da2af, x, 4, z);
      w.box(0.5, 0.15, 0.5, 0xb8e8ff, x, 7.8, z, w.scene, true);
    }
  const spawns = [
    [-28, -20],
    [0, -32],
    [29, 5],
    [-29, 4],
    [26, 30],
  ].map(([x, z]) => new THREE.Vector3(x, 0, z));
  const cache = new THREE.Vector3(-5, 0, 28);
  station(w, cache, 0x98d4ee);
  // Sparse instanced snow is decorative and never participates in collision.
  const snow = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.035, 0.12, 0.035),
    new THREE.MeshBasicMaterial({ color: 0xdcedf5 }),
    180,
  );
  const dummy = new THREE.Object3D();
  for (let n = 0; n < 180; n++) {
    dummy.position.set(Math.sin(n * 53) * 34, 2 + (n % 17), Math.cos(n * 23) * 34);
    dummy.updateMatrix();
    snow.setMatrixAt(n, dummy.matrix);
  }
  snow.userData.weather = true;
  w.scene.add(snow);
  return { spawns, station: cache, start: new THREE.Vector3(0, 0, 27) };
}

export function loadMap(world, id) {
  const cachedGeos = new Set(world.geometries.values()),
    cachedMats = new Set(world.materials.values());
  for (const obj of world.mapObjects || []) {
    world.scene.remove(obj);
    obj.traverse((m) => {
      if (m.geometry && !cachedGeos.has(m.geometry)) m.geometry.dispose();
      if (m.material && !cachedMats.has(m.material)) {
        if (m.material.map && m.material.map !== world.floorTexture) m.material.map.dispose();
        m.material.dispose();
      }
    });
  }
  world.colliders = [];
  world.solids = [];
  world.animated = [];
  const before = new Set(world.scene.children),
    def = MAPS.find((m) => m.id === id) || MAPS[0];
  const map = {
    ashworks: buildAshworks,
    sunbreak: buildSunbreak,
    whiteout: buildWhiteout,
    cinderline: buildCinderline,
    deepwell: buildDeepwell,
    skyline: buildSkyline,
    saltreach: buildSaltreach,
    spillway: buildSpillway,
  }[def.id](world);
  dressArena(world, map, def.id);
  dressSurfaces(world, map, def.id);
  addFieldMarkings(world, map, def);
  world.bounds = map.bounds || 35;
  world.voidFloor = !!map.voidFloor;
  world.mapObjects = world.scene.children.filter((o) => !before.has(o));
  world.scene.background.set(def.sky);
  world.scene.fog.color.set(def.fog);
  world.scene.fog.density = def.fogDensity || (def.id === 'whiteout' ? 0.015 : 0.012);
  world.sun.color.set(def.sun);
  return { ...map, ...def, start: map.start };
}
