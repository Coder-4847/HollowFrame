import * as THREE from 'three';
function base(w, ground, wall) {
  const floor = w.solid(72, 1, 72, ground, 0, -0.5, 0);
  floor.material = floor.material.clone();
  floor.material.map = w.floorTexture;
  for (const z of [-36, 36]) w.solid(74, 9, 2, wall, 0, 4.5, z);
  for (const x of [-36, 36]) w.solid(2, 9, 72, wall, x, 4.5, 0);
}
function cache(w, x, z, color) {
  w.solid(3, 1.4, 1.4, 0x344c46, x, 0.7, z);
  w.box(2.6, 0.12, 1.5, color, x, 1.45, z, w.scene, true);
  w.text('FIELD TERMINAL', x, 2.4, z, 0.65, '#d0ecda');
  return new THREE.Vector3(x, 0, z);
}
export function buildCinderline(w) {
  base(w, 0x605c66, 0x3d3d4c);
  for (const x of [-22, 22])
    for (const z of [-22, 8]) {
      const height = z < 0 ? 16 : 12;
      w.solid(9, height, 10, 0x595867, x, height / 2, z);
      w.box(9.7, 0.7, 10.7, 0x777281, x, height, z);
      for (let y = 3; y < height - 1; y += 3)
        for (const dx of [-2.5, 0, 2.5])
          w.box(1.2, 1.6, 0.08, 0xb29b8b, x + dx, y, z + 5.06, w.scene, true);
      w.text(z < 0 ? 'ARCHIVE 09' : 'NO OCCUPANTS', x, 2.1, z + 5.1, 0.7, '#b6a8b7');
    }
  // A transit walkway with real stairs provides a narrow elevated firing position.
  w.solid(6, 2.4, 10, 0x686873, -8, 1.2, -22);
  for (let n = 0; n < 8; n++) w.solid(4, 0.3 * (n + 1), 1, 0x817984, -8, 0.15 * (n + 1), -8.5 - n);
  w.solid(0.5, 1.1, 9, 0x9c8e91, -10.8, 2.95, -22);
  for (const [x, z, bw, bd] of [
    [0, 2, 4, 5],
    [8, 18, 6, 2.5],
    [-9, 20, 5, 2.5],
    [13, -12, 3, 5],
    [-28, -5, 4, 3],
  ]) {
    w.solid(bw, 1.6, bd, 0x737077, x, 0.8, z);
    w.box(bw + 0.1, 0.15, bd + 0.1, 0xa69a8c, x, 1.62, z);
  }
  for (const x of [-13, 13])
    for (const z of [-30, -4, 25]) {
      w.box(0.22, 8, 0.22, 0x83818c, x, 4, z);
      w.box(2, 0.14, 0.6, 0xd8b5d9, x, 8, z, w.scene, true);
    }
  for (let n = 0; n < 12; n++) {
    const x = -65 + n * 12,
      h = 18 + (n % 4) * 7;
    w.box(8, h, 9, 0x424251, x, h / 2, -50);
  }
  w.text('CINDERLINE', 0, 6, 34.85, 2.5, '#ccb1c8', Math.PI);
  w.text('EVACUATION COMPLETE / 0 RETURNED', 0, 4, -34.85, 1.2, '#b4a6b7');
  return {
    start: new THREE.Vector3(0, 0, 27),
    station: cache(w, -5, 28, 0xccafdc),
    spawns: [
      [-30, -30],
      [30, -30],
      [-30, 23],
      [30, 28],
      [0, -30],
    ].map(([x, z]) => new THREE.Vector3(x, 0, z)),
    hazards: [],
  };
}
export function buildDeepwell(w) {
  base(w, 0x394c48, 0x203e3a);
  // Four connected machine chambers surround a raised fabrication heart.
  w.solid(8, 7, 8, 0x4c6358, 0, 3.5, -10);
  w.box(8.3, 0.3, 8.3, 0xabc79a, 0, 7, -10);
  for (const x of [-4.1, 4.1])
    for (let z = -13; z < -6; z += 1.3) w.box(0.1, 4, 0.35, 0x8ee8b6, x, 3.7, z, w.scene, true);
  for (const x of [-17, 17]) {
    w.solid(1.5, 6, 16, 0x456159, x, 3, -14);
    w.solid(1.5, 6, 12, 0x456159, x, 3, 14);
    w.box(1.7, 0.3, 29, 0x9fb795, x, 6, -7);
  }
  for (const x of [-26, 26])
    for (const z of [-14, 12]) {
      w.solid(5, 3, 5, 0x526b5d, x, 1.5, z);
      w.box(5.1, 0.17, 5.1, 0x92a575, x, 2.7, z);
      w.box(0.15, 0.45, 3, 0x9fefb7, x - Math.sign(x) * 2.6, 2, z, w.scene, true);
    }
  for (const [x, z] of [
    [-8, 16],
    [8, 16],
    [-9, -26],
    [9, -26],
  ])
    w.solid(4, 1.9, 3, 0x687c66, x, 0.95, z);
  for (const z of [-25, 4, 25]) {
    w.box(69, 0.5, 0.5, 0x657c69, 0, 11, z);
    for (const x of [-30, 0, 30]) w.box(3, 0.12, 1, 0xb5ebbe, x, 10.7, z, w.scene, true);
  }
  const hazards = [];
  for (const [x, z] of [
    [-8, 2],
    [8, 2],
    [0, -25],
  ]) {
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(3.05, 3.2, 40),
      new THREE.MeshBasicMaterial({
        color: 0xf7b26d,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(x, 0.04, z);
    w.scene.add(marker);
    hazards.push({
      x,
      z,
      radius: 3.2,
      period: 10,
      activeFor: 3,
      offset: x === 0 ? 4 : x < 0 ? 0 : 6,
      damage: 18,
      name: 'DISCHARGE GRID',
      marker,
    });
  }
  const coreGlow = new THREE.PointLight(0x79e7b0, 50, 24, 2);
  coreGlow.position.set(0, 5, -4);
  w.scene.add(coreGlow);
  w.text('DEEPWELL / MANUFACTURE WITHOUT END', 0, 6, 34.85, 1.7, '#b3d9b5', Math.PI);
  w.text('QUENCH GRID / E', 0, 3.1, 28, 0.8, '#ffd39a');
  return {
    start: new THREE.Vector3(0, 0, 27),
    station: cache(w, 0, 30, 0x89e0b1),
    spawns: [
      [-29, -29],
      [29, -29],
      [-29, 25],
      [29, 25],
      [0, -32],
    ].map(([x, z]) => new THREE.Vector3(x, 0, z)),
    hazards,
  };
}
