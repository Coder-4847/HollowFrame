import * as THREE from 'three';
export function buildAshworks(w) {
  const ground = w.solid(72, 1, 72, 0x53605b, 0, -0.5, 0);
  ground.material = ground.material.clone();
  ground.material.map = w.floorTexture;
  // The foundry has four connected combat lanes and a raised western service deck.
  for (const z of [-36, 36]) w.solid(74, 8, 2, 0x293636, 0, 4, z);
  for (const x of [-36, 36]) w.solid(2, 8, 72, 0x293636, x, 4, 0);
  for (let i = -32; i <= 32; i += 8) {
    for (const z of [-34.9, 34.9]) {
      w.box(0.35, 9, 0.6, 0x56615b, i, 4.5, z);
      w.box(2, 0.14, 0.12, 0xff9c4e, i, 4, z - Math.sign(z) * 0.4, w.scene, true);
    }
    w.box(0.07, 0.015, 70, 0x52605b, i, 0.012, 0);
    w.box(70, 0.015, 0.07, 0x52605b, 0, 0.013, i);
  }
  // Furnace island and the suspended extraction assembly.
  w.solid(9, 2, 10, 0x252c2b, 0, 1, -3);
  w.solid(6.8, 9, 7.8, 0x414945, 0, 5.5, -3);
  for (const x of [-3.45, 3.45])
    for (let z = -6; z <= 0; z += 1.2) w.box(0.08, 4, 0.45, 0xff762d, x, 4, z, w.scene, true);
  for (let x = -2.8; x <= 2.8; x += 1.1) w.box(0.55, 4, 0.08, 0xff873b, x, 4, 1, w.scene, true);
  w.solid(10, 1.2, 11, 0x65706a, 0, 10, -3);
  w.cylinder(2.1, 10, 0x343e3c, 0, 15, -3);
  for (const x of [-5.8, 5.8]) {
    w.solid(0.8, 12, 0.8, 0x697369, x, 6, -3);
    w.box(0.9, 0.5, 12, 0xa89160, x, 11.5, -3);
  }
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(4.3, 0.16, 5, 48),
    w.material(0xe39349, true),
  );
  ring.position.set(0, 11.7, -3);
  ring.rotation.x = Math.PI / 2;
  w.scene.add(ring);
  w.animated.push(ring);
  const glow = new THREE.PointLight(0xff873b, 80, 24, 2);
  glow.position.set(0, 5, 4);
  w.scene.add(glow);
  // Cooling tanks in the east lane.
  for (const z of [-18, -7, 5]) {
    w.solid(5, 4.2, 5, 0x4a605f, 22, 2.1, z);
    w.cylinder(2.65, 0.3, 0x85908a, 22, 4.3, z);
    w.box(5.03, 0.23, 5.03, 0x81918a, 22, 2.7, z);
    w.box(0.09, 0.5, 2, 0x74cfbe, 19.45, 2.8, z, w.scene, true);
  }
  // West service deck with stairs, cover and an open route underneath its gantry.
  w.solid(8, 2.4, 19, 0x424e4b, -24, 1.2, -8);
  for (let n = 0; n < 8; n++) w.solid(5, 0.3 * (n + 1), 1, 0x68716a, -24, 0.15 * (n + 1), 9.5 - n);
  w.solid(1.1, 1.25, 18, 0x747b6d, -27.5, 3.025, -8);
  w.solid(3.5, 1.5, 3, 0x766e56, -23, 3.15, -12);
  w.text('02 / COOLANT', -34.8, 6, -6, 1.5, '#92b9ad', Math.PI / 2);
  // Loading bays, sightline breaks, ammo crates.
  for (const [x, z, rot] of [
    [-12, 19, 0],
    [15, 21, 0],
    [-14, -23, 0],
    [12, -24, 0],
    [-13, -7, 1],
    [10, 9, 1],
  ]) {
    const bw = rot ? 2.5 : 6,
      bd = rot ? 6 : 2.5;
    w.solid(bw, 2.1, bd, 0x5b655d, x, 1.05, z);
    w.box(bw + 0.03, 0.2, bd + 0.03, 0xa99a6b, x, 1.6, z);
    for (let i = -1; i <= 1; i++) w.box(0.18, 1.8, bd + 0.06, 0x313e3b, x + i * 1.5, 1.05, z);
  }
  for (const [x, z] of [
    [-30, 24],
    [28, 28],
    [-29, -28],
    [27, -29],
  ]) {
    w.solid(3, 4, 3, 0x4c5750, x, 2, z);
    w.box(3.1, 0.4, 3.1, 0xa89d75, x, 3.5, z);
  }
  for (const x of [-29, 29]) {
    w.box(0.4, 14, 0.4, 0x647570, x, 7, 14);
    w.box(7, 0.3, 0.4, 0x75857e, x - Math.sign(x) * 3, 14, 14);
    w.box(2, 0.1, 0.8, 0xe7f3d7, x - Math.sign(x) * 5, 13.8, 14, w.scene, true);
  }
  // Huge distant silhouettes keep the arena grounded in a larger facility.
  for (let i = 0; i < 12; i++) {
    const x = -60 + i * 11,
      h = 12 + ((i * 7) % 22);
    w.box(7, h, 9, 0x263838, x, h / 2, -49 - (i % 3) * 5);
    w.cylinder(1.4, h + 10, 0x34433e, x + 2, (h + 10) / 2, -51);
  }
  w.text('ASHWORKS', 0, 6, 34.85, 3, '#a5b4a7', Math.PI);
  w.text('07', 0, 8, 1.02, 2, '#ddd2aa');
  w.text('THE CHOIR IS LISTENING', 0, 3, -34.85, 1.2, '#8b9d91');
  // Resupply station anchors the starting courtyard.
  w.solid(3, 1.35, 1.4, 0x364d48, 0, 0.675, 26);
  w.box(2.4, 0.1, 1.45, 0x8ed5b9, 0, 1.4, 26, w.scene, true);
  w.text('RESUPPLY', 0, 2.2, 26, 0.55, '#b7ffe0');
  const beacon = new THREE.Mesh(
    new THREE.TorusGeometry(0.65, 0.035, 5, 32),
    w.material(0x8fe0bf, true),
  );
  beacon.position.set(0, 2.9, 26);
  w.scene.add(beacon);
  w.animated.push(beacon);
  const spawns = [
    new THREE.Vector3(-29, 0, -22),
    new THREE.Vector3(29, 0, -20),
    new THREE.Vector3(-30, 0, 15),
    new THREE.Vector3(23, 0, 29),
    new THREE.Vector3(8, 0, -29),
  ];
  for (const p of spawns) {
    w.box(4, 0.025, 4, 0x685c40, p.x, 0.02, p.z);
    w.box(4, 0.04, 0.12, 0xeb9952, p.x, 0.05, p.z + 2, w.scene, true);
  }
  return { spawns, start: new THREE.Vector3(0, 0, 20), station: new THREE.Vector3(0, 0, 26) };
}
