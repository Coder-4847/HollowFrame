import * as THREE from 'three';
export function buildFactionModel(w, e) {
  const { d, root } = e,
    h = d.height,
    r = d.radius;
  const part = (shape, width, height, depth, color, x, y, z, name) => {
    const key = 'faction-' + shape;
    if (!w.geometries.has(key))
      w.geometries.set(
        key,
        shape === 'shell'
          ? new THREE.SphereGeometry(0.5, 10, 6)
          : new THREE.OctahedronGeometry(0.5),
      );
    const m = new THREE.Mesh(
      w.geometries.get(key),
      w.material(color, ['sensor', 'core', 'shield', 'repair'].includes(name)),
    );
    m.scale.set(width, height, depth);
    m.position.set(x, y, z);
    m.userData = { enemy: e, part: name };
    m.castShadow = true;
    root.add(m);
    e.meshes.push(m);
    return m;
  };
  if (d.faction === 'brood') {
    part('shell', r * 1.8, h * 0.48, r * 2.3, d.color, 0, h * 0.48, -0.15, 'body');
    e.plate = part('shell', r * 1.9, h * 0.28, r * 2.2, 0x525c31, 0, h * 0.66, -0.2, 'armor');
    part('shell', r * 1.2, h * 0.3, r * 1.1, d.color, 0, h * 0.48, r * 0.85, 'body');
    e.sensor = part('shell', r * 0.65, h * 0.12, 0.22, 0xedcc65, 0, h * 0.53, r * 1.4, 'sensor');
    for (const side of [-1, 1]) {
      for (let n = 0; n < 3; n++) {
        const leg = part(
          'spike',
          r * 0.4,
          h * 0.57,
          0.35,
          0x66593a,
          side * r * 0.87,
          h * 0.27,
          (n - 1) * r * 0.75,
          'leg',
        );
        leg.rotation.z = side * -0.55;
        e.limbs.push(leg);
      }
      const jaw = part(
        'spike',
        r * 0.4,
        h * 0.3,
        r * 0.9,
        0xd1bb7d,
        side * r * 0.5,
        h * 0.35,
        r * 1.3,
        side < 0 ? 'weaponLeft' : 'weaponRight',
      );
      jaw.rotation.x = 0.5;
    }
    if (d.attack === 'acid' || d.summons || d.attack === 'suicide')
      for (const side of [-1, 1])
        part(
          'shell',
          r * 0.9,
          h * 0.5,
          r,
          d.attack === 'suicide' ? 0xecc56a : 0xb4ce65,
          side * r * 0.5,
          h * 0.8,
          -0.35,
          d.summons ? 'deployer' : 'sensor',
        );
    if (d.charger || d.pattern === 'rupture') {
      const horn = part('spike', 0.55, h * 0.65, 0.7, 0xe2d0a1, 0, h * 0.75, r, 'armor');
      horn.rotation.x = 0.45;
    }
  } else {
    part('spike', r * 1.9, h * 0.5, r * 1.4, d.color, 0, h * 0.55, 0, 'body');
    e.plate = part('spike', r * 1.6, h * 0.38, 0.25, 0xb0a6d2, 0, h * 0.56, r * 0.55, 'armor');
    part('shell', r * 0.95, h * 0.22, r * 0.9, 0x55577f, 0, h * 0.85, 0, 'body');
    e.sensor = part('spike', r * 0.55, h * 0.09, 0.2, 0xd6afff, 0, h * 0.86, r * 0.5, 'sensor');
    for (const side of [-1, 1]) {
      const leg = part(
        'spike',
        r * 0.45,
        h * 0.46,
        0.45,
        0x4a466a,
        side * r * 0.43,
        h * 0.23,
        0,
        'leg',
      );
      e.limbs.push(leg);
      part(
        'spike',
        0.4,
        h * 0.45,
        0.5,
        d.color,
        side * r * 0.95,
        h * 0.58,
        0,
        side < 0 ? 'weaponLeft' : 'weaponRight',
      );
      part(
        'spike',
        0.2,
        d.cloak ? h * 0.5 : 0.25,
        d.cloak ? 0.2 : 1,
        0xa7d7ef,
        side * r,
        h * 0.45,
        0.5,
        side < 0 ? 'weaponLeft' : 'weaponRight',
      );
    }
    if (d.shield)
      e.shieldMesh = part(
        'spike',
        r * 2.5,
        h * 0.68,
        0.12,
        0x8faafa,
        0,
        h * 0.5,
        r + 0.15,
        'shield',
      );
    if (d.healer)
      for (const side of [-1, 1])
        part('spike', 0.35, 1, 0.35, 0x8eebdf, side * r, h * 0.94, -0.2, 'repair');
    if (d.desiredRange) part('spike', 0.15, 0.3, 1.7, 0xc7b4e7, r, h * 0.6, 0.9, 'weaponRight');
  }
  if (d.boss) {
    if (d.faction === 'veil') {
      e.rotor = new THREE.Mesh(
        new THREE.TorusGeometry(
          d.pattern === 'beam' ? 1.7 : 1.25,
          0.1,
          6,
          d.pattern === 'beam' ? 4 : 24,
        ),
        w.material(0xc3a6f1, true),
      );
      e.rotor.position.set(0, h * 0.85, -0.3);
      root.add(e.rotor);
    }
    e.core = part(
      'shell',
      1.1,
      1.1,
      0.3,
      d.faction === 'brood' ? 0xd3f877 : 0xd1b4ff,
      0,
      h * 0.55,
      r * 1.35,
      'core',
    );
    e.core.visible = false;
    for (const side of [-1, 1])
      part(
        'shell',
        0.9,
        1.2,
        0.9,
        d.faction === 'brood' ? 0xa6bd58 : 0xb6adf1,
        side * 1.35,
        h * 0.75,
        0.45,
        side < 0 ? 'weaponLeft' : 'weaponRight',
      );
    e.zone = new THREE.Mesh(
      new THREE.RingGeometry(
        d.pattern === 'rupture' ? 9.8 : 6.8,
        d.pattern === 'rupture' ? 10 : 7,
        48,
      ),
      new THREE.MeshBasicMaterial({
        color: d.faction === 'brood' ? 0xcce96f : 0xc0a0ff,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    e.zone.rotation.x = -Math.PI / 2;
    e.zone.position.y = 0.06;
    e.zone.visible = false;
    root.add(e.zone);
  }
}
