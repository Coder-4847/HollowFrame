import * as THREE from 'three';
// Procedural first-person weapon models. Every gun shares one construction language (receiver,
// rail, handguard, barrel, magazine, grip, stock, gloved hands) and each family swaps parts.
// Local space: -z is forward, the receiver sits at the origin and sights top out near y 0.26
// so aim-down-sight offsets in weapons.js stay valid.
const DARK = 0x222b29,
  STEEL = 0x3b4744,
  POLYMER = 0x2c3533,
  GLOVE = 0x4d5249,
  SLEEVE = 0x2f3b36,
  GLASS = 0x8fe6d6;
export function buildGun(world, root, d) {
  const L = d.length,
    accent = d.color,
    handles = {};
  const box = (w, h, depth, color, x, y, z, parent = root, emissive = false) =>
    world.box(w, h, depth, color, x, y, z, parent, emissive);
  // Open reflex frame with a transparent lens; its centre is what aim-down-sights lines up.
  const reflex = (y, z) => {
    box(0.1, 0.02, 0.12, DARK, 0, y - 0.05, z);
    for (const x of [-0.045, 0.045]) box(0.012, 0.08, 0.1, DARK, x, y - 0.005, z);
    box(0.09, 0.012, 0.1, DARK, 0, y + 0.035, z);
    const lens = new THREE.Mesh(
      new THREE.PlaneGeometry(0.078, 0.07),
      new THREE.MeshBasicMaterial({
        color: GLASS,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
      }),
    );
    lens.position.set(0, y, z - 0.03);
    lens.userData.lens = true;
    root.add(lens);
    const dot = box(0.008, 0.008, 0.002, 0xff5a3c, 0, y, z - 0.031, root, true);
    dot.userData.lens = true;
    handles.sightHeight = y;
  };
  const tube = (r, length, color, x, y, z, parent = root) => {
    const m = world.cylinder(r, length, color, x, y, z, parent);
    m.rotation.x = Math.PI / 2;
    return m;
  };
  const family = d.explosive
    ? 'launcher'
    : ['verdict', 'anvil'].includes(d.id)
      ? 'revolver'
      : d.pellets > 1
        ? 'shotgun'
        : d.category === 'secondary'
          ? 'pistol'
          : 'rifle';
  const barrelEnd = -L * 0.95;
  if (family === 'launcher') {
    tube(0.16, L * 1.1, 0x5c6446, 0, 0.04, -L * 0.3);
    tube(0.19, 0.12, DARK, 0, 0.04, -L * 0.85);
    tube(0.18, 0.1, DARK, 0, 0.04, L * 0.25);
    for (const z of [-0.45, -0.15, 0.1]) tube(0.168, 0.03, accent, 0, 0.04, z * L);
    box(0.06, 0.04, 0.2, STEEL, 0, 0.21, -0.1);
    reflex(0.28, -0.1);
    if (d.id === 'mortar')
      for (const x of [-0.17, 0.17]) tube(0.07, L * 0.5, 0x879776, x, -0.08, -0.2);
    handles.bolt = box(0.05, 0.04, 0.1, 0x94a69a, 0.17, 0.1, 0.05);
    handles.magazine = box(0.12, 0.14, 0.16, 0x766c4f, 0, -0.15, -0.12);
  } else {
    // Receiver, upper and top rail.
    box(0.19, 0.18, L * 0.5, STEEL, 0, 0, 0);
    box(0.2, 0.07, L * 0.56, 0x4a5652, 0, 0.12, -0.02);
    box(0.203, 0.018, L * 0.4, accent, 0, 0.12, -0.04);
    box(0.07, 0.025, L * 0.5, DARK, 0, 0.17, -0.05);
    for (let n = 0; n < 7; n++) box(0.08, 0.012, 0.018, 0x1a2120, 0, 0.187, 0.12 - n * 0.05);
    // Ejection port, charging handle (animated as the bolt) and a small ammo readout.
    box(0.012, 0.06, 0.14, 0x121716, 0.1, 0.04, 0.02);
    handles.bolt = box(0.05, 0.035, 0.08, 0x94a69a, 0.12, 0.08, 0.06);
    box(0.012, 0.035, 0.07, 0x7fe0c8, -0.1, 0.07, 0.06, root, true);
    // Handguard with vent slots.
    box(0.16, 0.15, L * 0.42, POLYMER, 0, 0.0, -L * 0.45);
    for (let n = 0; n < 4; n++)
      for (const x of [-0.081, 0.081])
        box(0.004, 0.05, 0.05, 0x121716, x, 0.01, -L * 0.3 - n * 0.08);
    // Barrel and muzzle brake.
    if (family === 'shotgun') {
      for (const x of [-0.045, 0.045]) tube(0.04, L * 0.6, 0x55625a, x, 0.03, -L * 0.6);
      handles.pump = box(0.19, 0.11, 0.24, 0x7e6950, 0, -0.07, -L * 0.52);
      for (let n = 0; n < 5; n++) box(0.195, 0.012, 0.02, 0x3d3226, 0, -0.07, -L * 0.43 - n * 0.04);
    } else {
      tube(0.028, L * 0.45, DARK, 0, 0.03, -L * 0.78);
      tube(0.042, 0.1, 0x1a2120, 0, 0.03, barrelEnd);
      for (const x of [-0.043, 0.043]) box(0.004, 0.02, 0.06, 0x0b0f0e, x, 0.03, barrelEnd);
    }
    // Optics: long scope for precision/rail weapons, a compact reflex sight otherwise.
    if (['needle', 'lance'].includes(d.id)) {
      handles.sightHeight = null;
      tube(0.06, 0.42, 0x26332f, 0, 0.28, 0);
      tube(0.072, 0.05, DARK, 0, 0.28, -0.2);
      tube(0.068, 0.05, DARK, 0, 0.28, 0.2);
      box(0.05, 0.05, 0.004, GLASS, 0, 0.28, 0.226, root, true);
      for (const z of [-0.08, 0.08]) box(0.04, 0.07, 0.04, DARK, 0, 0.22, z);
    } else if (family !== 'revolver') reflex(0.245, -0.04);
    else box(0.03, 0.04, 0.03, 0xb7d9be, 0, 0.21, -L * 0.8);
    // Magazine, grip and trigger guard.
    if (family === 'revolver') {
      const drum = tube(0.1, 0.18, 0xa1997c, 0, 0.04, -0.04);
      drum.rotation.z = Math.PI / 12;
      handles.magazine = box(0.06, 0.08, 0.08, STEEL, 0, -0.12, -0.04);
    } else if (d.id === 'ballast') {
      handles.magazine = box(0.3, 0.26, 0.24, 0x5f6854, 0, -0.2, -0.1);
    } else if (family !== 'shotgun') {
      handles.magazine = box(0.1, 0.3, 0.14, 0x766c4f, 0, -0.22, -0.12);
      handles.magazine.rotation.x = 0.16;
      box(0.104, 0.03, 0.144, 0x4a4334, 0, -0.36, -0.1);
    } else handles.magazine = box(0.1, 0.06, 0.2, STEEL, 0, -0.1, -0.05);
    box(0.11, 0.015, 0.16, DARK, 0, -0.14, 0.09);
    // Stock (long guns only).
    if (family === 'rifle' || family === 'shotgun') {
      for (const y of [0.05, -0.07]) box(0.035, 0.035, 0.34, DARK, 0, y, 0.38);
      box(0.12, 0.22, 0.06, POLYMER, 0, -0.02, 0.56);
      box(0.13, 0.23, 0.02, 0x141a18, 0, -0.02, 0.595);
    }
    if (d.energy)
      for (let n = 0; n < 4; n++) {
        const coil = tube(0.1, 0.03, 0x73cbe2, 0, 0.0, -L * 0.3 - n * 0.09);
        coil.userData.coil = true;
      }
  }
  handles.magazineBase = handles.magazine.position.y;
  // Pistol grip.
  const grip = box(0.09, 0.24, 0.12, POLYMER, 0, -0.18, 0.13);
  grip.rotation.x = -0.3;
  // Right hand wrapped around the grip, left hand under the handguard, armoured sleeves.
  const right = new THREE.Group();
  right.position.set(0.02, -0.18, 0.15);
  right.rotation.x = -0.3;
  root.add(right);
  box(0.13, 0.14, 0.15, GLOVE, 0.03, 0.0, 0.03, right);
  for (let n = 0; n < 4; n++) box(0.1, 0.035, 0.04, GLOVE, -0.03, 0.05 - n * 0.045, -0.07, right);
  box(0.04, 0.04, 0.09, GLOVE, -0.07, 0.08, -0.02, right);
  box(0.02, 0.04, 0.03, 0x1a2120, -0.02, 0.1, -0.1, right);
  const sleeve = new THREE.Group();
  sleeve.position.set(0.06, -0.08, 0.1);
  // Forearms run back, down and outward so they leave the frame at the screen corners.
  sleeve.rotation.set(0.85, 0.5, 0);
  right.add(sleeve);
  box(0.14, 0.14, 0.4, SLEEVE, 0, 0, 0.2, sleeve);
  box(0.145, 0.03, 0.22, accent, 0, 0.07, 0.2, sleeve);
  box(0.15, 0.15, 0.03, 0x1a2120, 0, 0, 0.02, sleeve);
  const left = new THREE.Group();
  left.position.set(-0.02, -0.1, family === 'launcher' ? -0.35 : -L * 0.45);
  root.add(left);
  box(0.16, 0.06, 0.16, GLOVE, 0, 0, 0, left);
  for (let n = 0; n < 4; n++) box(0.03, 0.09, 0.035, GLOVE, 0.09, 0.05, 0.06 - n * 0.04, left);
  box(0.035, 0.08, 0.1, GLOVE, -0.09, 0.06, -0.01, left);
  const forearm = new THREE.Group();
  forearm.position.set(-0.05, -0.05, 0.05);
  forearm.rotation.set(0.55, -0.6, 0);
  left.add(forearm);
  box(0.14, 0.14, 0.5, SLEEVE, 0, -0.04, 0.25, forearm);
  box(0.145, 0.03, 0.26, accent, 0, 0.035, 0.25, forearm);
  box(0.15, 0.15, 0.03, 0x1a2120, 0, -0.04, 0.02, forearm);
  // Quick melee tools, shown briefly when used.
  handles.blade = box(0.045, 0.55, 0.07, 0x9cddca, -0.3, 0.25, -0.15);
  handles.hammer = box(0.48, 0.23, 0.22, 0x829790, -0.3, 0.49, -0.15);
  handles.blade.visible = handles.hammer.visible = false;
  handles.sightHeight ??= null;
  handles.muzzle = new THREE.Vector3(0, family === 'launcher' ? 0.04 : 0.03, barrelEnd - 0.07);
  return handles;
}
