import { surfaceTexture, rooftopHardware } from './terrain-art.js';
import * as THREE from 'three';
export const TERRAIN_MAPS = [
  {
    id: 'skyline',
    fogDensity: 0.007,
    name: 'SKYLINE SEVERANCE',
    region: 'THE SIGNAL ROOFTOPS',
    tag: 'THREE HEIGHTS / LETHAL FALLS',
    description:
      'Three linked rooftops at one, two and three stories. Wide stair bridges carry the machines; mantle stacks and short gaps reward parkour. Beyond the roofs is a lethal drop.',
    accent: '#e6b7ed',
    sky: 0x35384f,
    fog: 0x5e607b,
    sun: 0xffd2ae,
  },
  {
    id: 'saltreach',
    fogDensity: 0.006,
    name: 'SALTREACH EXPANSE',
    region: 'THE DRIED RESERVOIR',
    tag: 'OPEN TERRAIN / STEAM VENTS',
    description:
      'A broad salt basin with scattered rock formations, drilling rigs and a raised survey station. Cross exposed ground or take cover routes around timed steam vents.',
    accent: '#e8c891',
    sky: 0xb6b6a4,
    fog: 0xd3c9ae,
    sun: 0xffe2b1,
  },
  {
    id: 'spillway',
    fogDensity: 0.008,
    name: 'VERDIGRIS SPILLWAY',
    region: 'THE FLOODED TURBINE WORKS',
    tag: 'UPPER DECKS / TOXIC CHANNELS',
    description:
      'Climb turbine terraces and cross service bridges over toxic runoff. Twin stair routes link the upper decks, while stepped machinery offers mantle shortcuts.',
    accent: '#86d6c2',
    sky: 0x334f55,
    fog: 0x507573,
    sun: 0xc4e4cf,
  },
];
function deck(w, x, z, width, depth, y, color) {
  const mesh = w.solid(width, 0.6, depth, color, x, y - 0.3, z);
  mesh.material = mesh.material.clone();
  mesh.material.map = w.floorTexture;
  return mesh;
}
function stairs(w, a, b, width = 7) {
  const distance = Math.hypot(b.x - a.x, b.z - a.z),
    count = Math.ceil(Math.abs(b.y - a.y) / 0.25),
    alongX = Math.abs(b.x - a.x) > Math.abs(b.z - a.z);
  for (let n = 0; n < count; n++) {
    const t = (n + 0.5) / count,
      y = a.y + ((b.y - a.y) * (n + 1)) / count;
    w.solid(
      alongX ? distance / count + 0.03 : width,
      y - a.y + 0.4,
      alongX ? width : distance / count + 0.03,
      0x89958e,
      a.x + (b.x - a.x) * t,
      a.y - 0.4 + (y - a.y + 0.4) / 2,
      a.z + (b.z - a.z) * t,
    );
  }
}
function cache(w, x, y, z) {
  w.solid(3, 1.3, 1.3, 0x394f51, x, y + 0.65, z);
  w.box(2.8, 0.12, 1.4, 0x9de5c9, x, y + 1.35, z, w.scene, true);
  w.text('FIELD CACHE', x, y + 2.3, z, 0.7, '#b7f1d7');
  return new THREE.Vector3(x, y, z);
}
function cover(w, x, y, z, width = 3) {
  w.solid(width, 1.4, 2.5, 0x596c70, x, y + 0.7, z);
  for (let n = 0; n < 5; n++)
    w.box(width - 0.3, 0.07, 0.04, 0x8fa3a2, x, y + 0.3 + n * 0.2, z + 1.27);
  w.box(width + 0.06, 0.12, 2.56, 0xb3b394, x, y + 1.43, z);
}
function boundary(w, b, color) {
  for (const z of [-b - 1, b + 1]) w.solid(b * 2 + 4, 9, 2, color, 0, 4.5, z);
  for (const x of [-b - 1, b + 1]) w.solid(2, 9, b * 2 + 4, color, x, 4.5, 0);
}
function hazard(w, x, y, z, radius, name, color = 0x91da81) {
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(radius - 0.13, radius, 40),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.set(x, y + 0.05, z);
  w.scene.add(marker);
  return {
    x,
    y,
    z,
    radius,
    name,
    period: 10,
    activeFor: 3,
    offset: Math.abs(x) % 7,
    damage: 24,
    marker,
  };
}
export function buildSkyline(w) {
  const roofs = [
    [-22, 18, 4],
    [10, 18, 8],
    [10, -18, 12],
  ];
  for (const [x, z, y] of roofs) {
    w.solid(24, y + 18, 24, 0x454959, x, (y - 18) / 2, z);
    deck(w, x, z, 24, 24, y, 0x717a83);
    for (const dx of [-11.5, 11.5])
      for (let dz = -9; dz <= 9; dz += 3)
        w.box(0.13, 0.06, 1.6, 0xefbd79, x + dx, y + 0.04, z + dz);
    for (const dz of [-11.5, 11.5])
      for (let dx = -9; dx <= 9; dx += 3)
        w.box(1.6, 0.06, 0.13, 0xefbd79, x + dx, y + 0.04, z + dz);
    for (let level = -12; level < y - 1; level += 3)
      for (let dx = -9; dx <= 9; dx += 3)
        w.box(1.4, 1.2, 0.06, 0xd5ba93, x + dx, level, z + 12.04, w.scene, true);
    cover(w, x - 6, y, z + 3, 4);
    cover(w, x + 6, y, z - 4, 3);
    w.solid(3, 2.8, 3, 0x515968, x - 6, y + 1.4, z - 5);
    w.cylinder(1.1, 1, 0xa5a9ad, x - 6, y + 3.3, z - 5);
    for (let n = 0; n < 3; n++)
      w.solid(2, 1.4 * (n + 1), 2, 0x728a86, x + 6, y + 0.7 * (n + 1), z + 5 - n * 2);
    rooftopHardware(w, x + 7, y, z - 8);
    w.text('ROOF / ' + y / 4, x, y + 2, z - 11.8, 1.1, '#f5d5b3');
  }
  stairs(w, { x: -10, y: 4, z: 18 }, { x: -2, y: 8, z: 18 }, 8);
  stairs(w, { x: 10, y: 8, z: 6 }, { x: 10, y: 12, z: -6 }, 8);
  // A second, narrower parallel route includes a short jump gap for players.
  deck(w, -6, 10, 8, 3, 8, 0x8b7f91);
  deck(w, 19, 2, 3, 8, 12, 0x8b7f91);
  deck(w, 19, -5, 3, 2, 12, 0x8b7f91);
  for (let n = 0; n < 16; n++) {
    const x = -68 + n * 9,
      h = 20 + (n % 5) * 6;
    w.box(7, h, 8, 0x3b4256, x, -20 + h / 2, -50);
  }
  w.text('EDGE = SIGNAL LOST', -22, 7.4, 6.3, 0.8, '#ffd298');
  return {
    bounds: 46,
    voidFloor: true,
    killY: 1,
    start: new THREE.Vector3(-22, 4, 25),
    station: cache(w, -28, 4, 26),
    spawns: [
      [-30, 4, 8.5],
      [-14, 4, 26],
      [3, 8, 26],
      [18, 8, 10],
      [2, 12, -28],
      [18, 12, -10],
    ].map((p) => new THREE.Vector3(...p)),
    hazards: [],
  };
}
export function buildSaltreach(w) {
  const ground = deck(w, 0, 0, 112, 112, 0, 0xbaa986);
  if (typeof document !== 'undefined') ground.material.map = surfaceTexture('salt');
  boundary(w, 55, 0x8b8371);
  for (const [x, z, bw, bd, h] of [
    [-30, -20, 12, 8, 5],
    [25, -27, 10, 14, 7],
    [-20, 22, 9, 12, 4],
    [31, 20, 12, 8, 5],
    [-4, -8, 8, 6, 3],
  ]) {
    const rock = w.solid(bw, h, bd, 0x8b8070, x, h / 2, z);
    if (rock.isMesh) {
      rock.geometry = new THREE.CylinderGeometry(0.8, 1, 1, 8);
      rock.scale.set(bw * 0.54, h, bd * 0.54);
      rock.rotation.y = Math.PI / 8;
    }
    const cap = w.cylinder(1, 0.25, 0xc5b58c, x, h, z);
    cap.scale.set(bw * 0.4, 1, bd * 0.4);
    cap.rotation.y = Math.PI / 8;
    for (let n = 0; n < 3; n++) {
      const layer = w.cylinder(1, 0.12, 0xab9b7e, x, 1 + n * (h / 3), z);
      layer.scale.set(bw * 0.54 * (1 - 0.07 * n), 1, bd * 0.54 * (1 - 0.07 * n));
      layer.rotation.y = Math.PI / 8;
    }
  }
  deck(w, 0, -38, 18, 12, 4, 0x738c86);
  stairs(w, { x: 0, y: 0, z: -20 }, { x: 0, y: 4, z: -32 }, 8);
  for (const x of [-7, 7]) w.solid(0.5, 4, 0.5, 0x485e59, x, 2, -38);
  for (const [x, z] of [
    [-40, 0],
    [40, -5],
    [-8, 31],
    [16, 6],
  ]) {
    cover(w, x, 0, z, 5);
    w.cylinder(0.8, 6, 0x65746d, x + 3, 3, z);
    w.box(5, 0.2, 0.3, 0xd6aa65, x + 3, 5.8, z);
  }
  for (let n = 0; n < 15; n++) {
    const x = -49 + n * 7;
    w.box(2, 0.03, 1, 0xe1d4b4, x, 0.03, 40);
  }
  for (let n = 0; n < 9; n++) {
    const mesa = w.cylinder(1, 1, 0x8c8271, -64 + n * 16, 5, -66);
    mesa.scale.set(7 + (n % 3), 14 + (n % 4) * 4, 9);
  }
  w.text('SALTREACH / RESERVOIR 06', 0, 6, -54.8, 2, '#efe2c3');
  const hazards = [
    hazard(w, -12, 0, 5, 4, 'STEAM VENT'),
    hazard(w, 17, 0, -13, 4, 'STEAM VENT'),
    hazard(w, 29, 0, 34, 3.5, 'STEAM VENT'),
  ];
  for (const h of hazards) {
    w.cylinder(h.radius, 0.08, 0x4d6761, h.x, 0.02, h.z);
    for (let n = 0; n < 5; n++)
      w.box(h.radius * 1.6, 0.06, 0.12, 0x81948a, h.x, 0.09, h.z + (n - 2) * 0.5);
  }
  return {
    bounds: 55,
    start: new THREE.Vector3(0, 0, 45),
    station: cache(w, -6, 0, 47),
    spawns: [
      [-46, 0, -44],
      [45, 0, -43],
      [-47, 0, 35],
      [46, 0, 40],
      [0, 4, -40],
    ].map((p) => new THREE.Vector3(...p)),
    hazards,
  };
}
export function buildSpillway(w) {
  deck(w, 0, 0, 88, 88, 0, 0x506b64);
  boundary(w, 43, 0x355452);
  deck(w, -22, -12, 18, 38, 4, 0x678781);
  deck(w, 22, -12, 18, 38, 8, 0x7b968a);
  stairs(w, { x: -22, y: 0, z: 23 }, { x: -22, y: 4, z: 7 }, 8);
  stairs(w, { x: 22, y: 0, z: 31 }, { x: 22, y: 8, z: 7 }, 9);
  deck(w, 0, -26, 26, 8, 4, 0x778d77);
  stairs(w, { x: 5, y: 4, z: -26 }, { x: 13, y: 8, z: -26 }, 8);
  for (const x of [-22, 22]) {
    const y = x < 0 ? 4 : 8;
    for (const z of [-20, -4]) {
      w.solid(5, 2.4, 5, 0x3e5f5d, x, y + 1.2, z);
      w.cylinder(2, 1.2, 0x91b99e, x, y + 3, z);
      w.box(5.1, 0.12, 5.1, 0xc1b281, x, y + 2.4, z);
    }
    for (let n = 0; n < 3; n++)
      w.solid(3, (n + 1) * 1.4, 3, 0x6c897b, x + (x < 0 ? 7 : -7), y + (n + 1) * 0.7, 1 - n * 3);
  }
  for (const [x, z] of [
    [-6, 19],
    [9, 8],
    [0, -9],
    [-32, 30],
    [32, 35],
  ])
    cover(w, x, 0, z, 4);
  const hazards = [
    hazard(w, -6, 0, -20, 5, 'TOXIC RUNOFF'),
    hazard(w, 6, 0, -3, 5, 'TOXIC RUNOFF'),
  ];
  for (const h of hazards) {
    h.period = 1;
    h.activeFor = 1;
    h.damage = 18;
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(h.radius - 0.1, 40),
      new THREE.MeshBasicMaterial({ color: 0x6fa44b, transparent: true, opacity: 0.7 }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(h.x, 0.03, h.z);
    w.scene.add(pool);
  }
  w.text('VERDIGRIS / KEEP ABOVE THE RUNOFF', 0, 6, -42.8, 1.8, '#d6e4b1');
  return {
    bounds: 43,
    start: new THREE.Vector3(0, 0, 34),
    station: cache(w, -6, 0, 36),
    spawns: [
      [-35, 0, -34],
      [35, 0, -34],
      [-34, 0, 33],
      [34, 0, 30],
      [-27, 4, -27],
      [27, 8, -27],
    ].map((p) => new THREE.Vector3(...p)),
    hazards,
  };
}
