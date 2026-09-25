import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
// Articulated enemy models for all three factions.
//
// Every visible part is a hit target tagged with its gameplay part name (body, armor, sensor,
// leg, weaponLeft/Right, shield, repair, deployer, command, core), so shooting a gun arm still
// disarms it and breaking a component still hides exactly those meshes. Parts hang off joint
// groups; e.animate(dt, ctx) drives walk cycles, aiming, idle motion, telegraph glow and hit
// flashes. Each enemy owns a small set of materials so glow and cloaking are per-enemy.

// Unit primitives, cached in the world's geometry cache and scaled per part.
const SHAPES = {
  box: () => new RoundedBoxGeometry(1, 1, 1, 2, 0.12),
  hard: () => new THREE.BoxGeometry(1, 1, 1),
  sphere: () => new THREE.SphereGeometry(0.5, 18, 12),
  cyl: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 14),
  cone: () => new THREE.ConeGeometry(0.5, 1, 12),
  spike: () => new THREE.ConeGeometry(0.5, 1, 5),
  crystal: () => new THREE.OctahedronGeometry(0.5, 0),
  gem: () => new THREE.CylinderGeometry(0.5, 0.18, 1, 6),
  torus: () => new THREE.TorusGeometry(0.5, 0.06, 8, 40),
};
// Surface detail tuned for enemy scale: finer tiling than the world's 4 m panels.
let detailCache;
function detail(world) {
  if (detailCache || !world.surfaces) return detailCache;
  const tile = (set, repeat) =>
    Object.fromEntries(
      Object.entries(set).map(([k, t]) => {
        const c = t.clone();
        c.repeat.setScalar(repeat);
        c.needsUpdate = true;
        return [k, c];
      }),
    );
  detailCache = {
    panel: tile(world.surfaces.panel, 0.35),
    organic: tile(world.surfaces.organic, 0.8),
  };
  return detailCache;
}
function makeMaterials(world, e, spec) {
  const d = detail(world),
    // Crystal skins reuse the fine panel detail as faceting; Low keeps colour detail only.
    maps = (kind) => {
      const set = d?.[kind === 'organic' ? 'organic' : 'panel'];
      return !set ? {} : world.quality !== 'low' ? set : { map: set.map };
    },
    standard = (color, kind, extra = {}) =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: 1,
        metalness: 0.45,
        ...maps(kind),
        ...extra,
      }),
    set = {
      armor: standard(spec.armor, spec.skin),
      trim: standard(spec.trim, spec.skin, { metalness: 0.6 }),
      frame: standard(spec.frame, spec.skin === 'organic' ? 'organic' : 'panel', {
        metalness: 0.55,
      }),
      joint: new THREE.MeshStandardMaterial({
        color: spec.joint,
        roughness: 0.35,
        metalness: 0.85,
      }),
      glow: new THREE.MeshStandardMaterial({
        color: spec.glow,
        emissive: spec.glow,
        emissiveIntensity: spec.glowIntensity ?? 2.2,
        roughness: 0.4,
      }),
      soft: new THREE.MeshStandardMaterial({
        color: spec.glow,
        emissive: spec.glow,
        emissiveIntensity: 0.55,
        roughness: 0.3,
        metalness: 0.1,
      }),
      gold: new THREE.MeshStandardMaterial({ color: 0xf4c075, roughness: 0.3, metalness: 0.9 }),
      // Translucent energy barrier for shields: readable as a field, not a solid slab.
      energy: new THREE.MeshStandardMaterial({
        color: spec.shield ?? 0x7fd8ff,
        emissive: spec.shield ?? 0x7fd8ff,
        emissiveIntensity: 0.7,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        side: THREE.DoubleSide,
        roughness: 0.1,
        metalness: 0,
      }),
    };
  set.glow.userData.glow = set.soft.userData.glow = set.energy.userData.glow = true;
  if (spec.skin === 'organic') set.armor.metalness = set.trim.metalness = 0.1;
  if (spec.skin === 'crystal') {
    set.armor.metalness = 0.2;
    set.armor.roughness = 0.35;
    set.trim.roughness = 0.2;
    set.trim.transparent = false;
  }
  const all = Object.values(set);
  // Cloaking units fade their whole body, so every material must support opacity.
  if (spec.cloak) for (const m of all) m.transparent = true;
  e.materials = all;
  e.glowBase = spec.glowIntensity ?? 2.2;
  return set;
}
function builder(world, e) {
  const part = (shape, size, material, position, name, parent = e.root, rotation) => {
    const key = 'enemy-' + shape;
    if (!world.geometries.has(key)) world.geometries.set(key, SHAPES[shape]());
    const mesh = new THREE.Mesh(world.geometries.get(key), material);
    mesh.scale.set(...size);
    mesh.position.set(...position);
    if (rotation) mesh.rotation.set(...rotation);
    mesh.castShadow = size[0] * size[1] * size[2] > 0.004;
    mesh.receiveShadow = true;
    mesh.userData = { enemy: e, part: name, ownedMaterial: true };
    parent.add(mesh);
    e.meshes.push(mesh);
    return mesh;
  };
  const joint = (parent, x, y, z) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };
  return { part, joint };
}
function zoneRing(e, inner, outer, color) {
  e.zone = new THREE.Mesh(
    new THREE.RingGeometry(inner, outer, 64),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  e.zone.rotation.x = -Math.PI / 2;
  e.zone.position.y = 0.05;
  e.zone.visible = false;
  e.root.add(e.zone);
}
// ---------------------------------------------------------------------------------- Choir
function choirWalker(world, e) {
  const { d, type } = e,
    boss = !!d.boss,
    s = d.height / 2.5,
    bulk = boss
      ? 1.25
      : type === 'bastion'
        ? 1.2
        : type === 'shade' || type === 'lancer'
          ? 0.85
          : 1,
    m = makeMaterials(world, e, {
      armor: e.elite ? 0x9b765f : d.color,
      trim: 0xb9beae,
      frame: 0x232b2a,
      joint: 0x5d6a67,
      glow: type === 'mender' ? 0x7cf0b8 : type === 'lancer' ? 0xd8a6ff : 0xff6a3a,
      skin: 'panel',
      cloak: type === 'shade',
    }),
    { part, joint } = builder(world, e),
    rig = { legs: [], arms: [], glows: [] };
  const hips = joint(e.root, 0, 0.95 * s, 0);
  part('cyl', [0.62 * s * bulk, 0.2 * s, 0.42 * s], m.joint, [0, 0, 0], 'body', hips, [
    0,
    0,
    Math.PI / 2,
  ]);
  for (const side of [-1, 1]) {
    const hip = joint(hips, side * 0.32 * s * bulk, 0, 0);
    part('sphere', [0.24 * s, 0.24 * s, 0.24 * s], m.joint, [0, 0, 0], 'leg', hip);
    part('box', [0.28 * s, 0.52 * s, 0.32 * s], m.armor, [0, -0.26 * s, 0], 'leg', hip);
    part('box', [0.3 * s, 0.2 * s, 0.34 * s], m.frame, [0, -0.1 * s, 0.03 * s], 'leg', hip);
    const knee = joint(hip, 0, -0.52 * s, 0);
    part('sphere', [0.19 * s, 0.19 * s, 0.19 * s], m.joint, [0, 0, 0], 'leg', knee);
    part('box', [0.2 * s, 0.52 * s, 0.24 * s], m.frame, [0, -0.26 * s, 0], 'leg', knee);
    part('hard', [0.08 * s, 0.3 * s, 0.05 * s], m.glow, [0, -0.2 * s, 0.13 * s], 'leg', knee);
    const ankle = joint(knee, 0, -0.52 * s, 0);
    part('box', [0.32 * s, 0.13 * s, 0.56 * s], m.armor, [0, -0.02 * s, 0.1 * s], 'leg', ankle);
    part('spike', [0.1 * s, 0.18 * s, 0.1 * s], m.frame, [0, -0.02 * s, 0.4 * s], 'leg', ankle, [
      Math.PI / 2,
      0,
      0,
    ]);
    rig.legs.push({ hip, knee, ankle, side });
  }
  const torso = joint(hips, 0, 0.12 * s, 0);
  part('cyl', [0.34 * s, 0.26 * s, 0.34 * s], m.joint, [0, 0.08 * s, 0], 'body', torso);
  part('box', [1.02 * s * bulk, 0.92 * s, 0.72 * s], m.armor, [0, 0.62 * s, 0], 'body', torso);
  e.plate = part(
    'box',
    [0.86 * s * bulk, 0.58 * s, 0.16 * s],
    m.trim,
    [0, 0.68 * s, 0.4 * s],
    'armor',
    torso,
  );
  for (const side of [-1, 1]) {
    part(
      'hard',
      [0.05 * s, 0.26 * s, 0.03 * s],
      m.glow,
      [side * 0.34 * s * bulk, 0.3 * s, 0.37 * s],
      'body',
      torso,
    );
    part(
      'hard',
      [0.16 * s, 0.035 * s, 0.03 * s],
      m.glow,
      [side * 0.2 * s, 0.98 * s, 0.37 * s],
      'body',
      torso,
    );
  }
  part(
    'box',
    [0.72 * s * bulk, 0.66 * s, 0.34 * s],
    m.frame,
    [0, 0.66 * s, -0.48 * s],
    'body',
    torso,
  );
  for (const side of [-1, 1]) {
    part(
      'cyl',
      [0.13 * s, 0.34 * s, 0.13 * s],
      m.joint,
      [side * 0.22 * s, 1.0 * s, -0.56 * s],
      'body',
      torso,
    );
    const vent = part(
      'cyl',
      [0.1 * s, 0.03 * s, 0.1 * s],
      m.glow,
      [side * 0.22 * s, 1.18 * s, -0.56 * s],
      'body',
      torso,
    );
    rig.glows.push(vent);
  }
  // Head with a wide visor sensor.
  const head = joint(torso, 0, 1.12 * s, 0.04 * s);
  part('cyl', [0.18 * s, 0.14 * s, 0.18 * s], m.joint, [0, 0.02 * s, 0], 'body', head);
  part('box', [0.5 * s, 0.34 * s, 0.5 * s], m.armor, [0, 0.2 * s, 0], 'body', head);
  part('box', [0.54 * s, 0.1 * s, 0.3 * s], m.frame, [0, 0.14 * s, 0.14 * s], 'body', head);
  e.sensor = part(
    'hard',
    [0.44 * s, 0.07 * s, 0.05 * s],
    m.glow,
    [0, 0.22 * s, 0.26 * s],
    'sensor',
    head,
  );
  const antenna = part(
    'cyl',
    [0.025 * s, 0.4 * s, 0.025 * s],
    m.joint,
    [0.18 * s, 0.5 * s, -0.12 * s],
    'body',
    head,
  );
  antenna.rotation.z = -0.15;
  part(
    'sphere',
    [0.06 * s, 0.06 * s, 0.06 * s],
    m.glow,
    [0.21 * s, 0.7 * s, -0.12 * s],
    'body',
    head,
  );
  // Shoulders and gun-pod arms; each arm is its weapon mount.
  for (const side of [-1, 1]) {
    const name = side < 0 ? 'weaponLeft' : 'weaponRight',
      shoulder = joint(torso, side * 0.66 * s * bulk, 0.92 * s, 0);
    part(
      'box',
      [0.46 * s, 0.3 * s, 0.56 * s],
      m.armor,
      [side * 0.06 * s, 0.12 * s, 0],
      name,
      shoulder,
      [0, 0, side * -0.25],
    );
    part('sphere', [0.2 * s, 0.2 * s, 0.2 * s], m.joint, [0, 0, 0], name, shoulder);
    part('box', [0.2 * s, 0.4 * s, 0.22 * s], m.frame, [0, -0.2 * s, 0], name, shoulder);
    const elbow = joint(shoulder, 0, -0.4 * s, 0);
    elbow.rotation.x = -1.35;
    part('box', [0.3 * s, 0.62 * s, 0.3 * s], m.armor, [0, -0.22 * s, 0], name, elbow);
    for (const dx of [-0.07, 0.07]) {
      part('cyl', [0.07 * s, 0.4 * s, 0.07 * s], m.frame, [dx * s, -0.52 * s, 0], name, elbow);
      const muzzle = part(
        'cyl',
        [0.05 * s, 0.03 * s, 0.05 * s],
        m.glow,
        [dx * s, -0.73 * s, 0],
        name,
        elbow,
      );
      rig.glows.push(muzzle);
    }
    rig.arms.push({ shoulder, elbow, side });
  }
  // Role equipment.
  if (type === 'bastion' || boss) {
    for (const side of [-1, 1]) {
      const name = side < 0 ? 'weaponLeft' : 'weaponRight',
        rack = joint(torso, side * 0.5 * s * bulk, 1.25 * s, -0.25 * s);
      part('box', [0.5 * s, 0.4 * s, 0.7 * s], m.frame, [0, 0, 0], name, rack);
      for (const dx of [-0.12, 0.12])
        for (const dy of [-0.08, 0.08])
          part(
            'cyl',
            [0.08 * s, 0.03 * s, 0.08 * s],
            m.glow,
            [dx * s, dy * s, 0.36 * s],
            name,
            rack,
            [Math.PI / 2, 0, 0],
          );
    }
  }
  if (type === 'bulwark') {
    // Tower shield: armoured frame around a translucent barrier pane.
    e.shieldMesh = part('box', [1.4, 1.6, 0.06], m.energy, [0, 1.3, 0.86], 'shield', e.root);
    for (const x of [-0.75, 0.75])
      part('box', [0.14, 1.75, 0.2], m.trim, [x, 1.3, 0.86], 'shield', e.root);
    for (const y of [0.45, 2.15])
      part('box', [1.6, 0.12, 0.2], m.trim, [0, y, 0.86], 'shield', e.root);
    part('hard', [1.3, 0.04, 0.22], m.glow, [0, 2.15, 0.87], 'shield', e.root);
  }
  if (type === 'mender') {
    e.repairMesh = part(
      'box',
      [0.55 * s, 0.5 * s, 0.4 * s],
      m.soft,
      [0, 0.7 * s, -0.75 * s],
      'repair',
      torso,
    );
    part('cyl', [0.05 * s, 0.9 * s, 0.05 * s], m.joint, [0, 1.3 * s, -0.75 * s], 'repair', torso);
    rig.orb = part(
      'sphere',
      [0.2 * s, 0.2 * s, 0.2 * s],
      m.glow,
      [0, 1.8 * s, -0.75 * s],
      'repair',
      torso,
    );
  }
  if (type === 'lancer') {
    part('box', [0.14, 1.9, 0.16], m.frame, [0, -0.9, 0.1], 'weaponRight', rig.arms[1].elbow);
    part('hard', [0.05, 1.7, 0.05], m.glow, [0, -0.95, 0.2], 'weaponRight', rig.arms[1].elbow);
    part('crystal', [0.18, 0.5, 0.18], m.glow, [0, 0.62 * s, 0], 'sensor', head);
  }
  if (type === 'fabricator') {
    part('box', [1.15 * s, 1.0 * s, 0.6 * s], m.armor, [0, 0.72 * s, -0.8 * s], 'deployer', torso);
    for (let n = 0; n < 3; n++)
      part(
        'hard',
        [0.8 * s, 0.05 * s, 0.05 * s],
        m.glow,
        [0, 0.4 * s + n * 0.22 * s, -1.11 * s],
        'deployer',
        torso,
      );
  }
  if (type === 'cantor') {
    rig.halo = joint(head, 0, 0.75 * s, 0);
    part('torus', [1.2 * s, 1.2 * s, 1.2 * s], m.glow, [0, 0, 0], 'command', rig.halo, [
      Math.PI / 2,
      0,
      0,
    ]);
    for (const side of [-1, 1])
      part(
        'cyl',
        [0.05 * s, 0.7 * s, 0.05 * s],
        m.trim,
        [side * 0.3 * s, 0.4 * s, -0.1 * s],
        'command',
        head,
      );
  }
  if (boss) {
    e.core = part(
      'sphere',
      [0.55 * s, 0.55 * s, 0.3 * s],
      m.glow,
      [0, 0.68 * s, 0.44 * s],
      'core',
      torso,
    );
    e.core.visible = false;
    part('cyl', [0.06 * s, 1.1 * s, 0.06 * s], m.joint, [0, 1.9 * s, -0.3 * s], 'body', torso);
    part(
      'sphere',
      [0.14 * s, 0.14 * s, 0.14 * s],
      m.glow,
      [0, 2.45 * s, -0.3 * s],
      'sensor',
      torso,
    );
    zoneRing(e, 8.85, 9, 0xff8a5e);
  }
  if (e.elite) part('box', [0.62 * s, 0.08 * s, 0.56 * s], m.gold, [0, 0.4 * s, 0], 'armor', head);
  rig.hips = hips;
  rig.torso = torso;
  rig.head = head;
  rig.hipHeight = 0.95 * s;
  rig.scale = s;
  e.animate = (dt, ctx) => animateWalker(e, rig, dt, ctx);
}
function animateWalker(e, rig, dt, ctx) {
  const s = rig.scale,
    stride = Math.min(1, ctx.speed / Math.max(0.5, e.d.speed));
  e.walk = (e.walk || 0) + (ctx.speed * dt * 2.4) / s;
  const phase = e.walk;
  for (const leg of rig.legs) {
    const p = phase + (leg.side > 0 ? Math.PI : 0),
      swing = Math.sin(p) * 0.5 * stride,
      lift = Math.max(0, -Math.cos(p)) * 0.8 * stride;
    leg.hip.rotation.x = -0.32 - swing;
    leg.knee.rotation.x = 0.64 + lift;
    leg.ankle.rotation.x = -(leg.hip.rotation.x + leg.knee.rotation.x);
  }
  const breathe = Math.sin(ctx.time * 1.6 + e.id) * 0.012 * s;
  rig.hips.position.y =
    rig.hipHeight - 0.05 * s * stride + Math.abs(Math.sin(phase)) * 0.06 * s * stride + breathe;
  rig.torso.rotation.z = Math.sin(phase) * 0.04 * stride;
  rig.torso.rotation.y = Math.sin(phase) * 0.06 * stride;
  rig.torso.rotation.x = 0.06 * stride;
  rig.head.rotation.x = ctx.lookPitch * 0.6;
  // Arms raise to the target while telegraphing or firing, and sway with the stride otherwise.
  const aim = ctx.warn > 0 || ctx.recent ? 1 : 0;
  rig.aim = (rig.aim || 0) + (aim - (rig.aim || 0)) * Math.min(1, dt * 8);
  for (const arm of rig.arms) {
    arm.shoulder.rotation.x =
      -rig.aim * (0.2 + ctx.lookPitch) +
      Math.sin(phase + (arm.side > 0 ? 0 : Math.PI)) * 0.25 * stride * (1 - rig.aim);
    arm.elbow.rotation.x = -1.35 - rig.aim * 0.25;
  }
  if (rig.halo) rig.halo.rotation.y += dt * 1.5;
  if (rig.orb) rig.orb.position.y = 1.8 * s + Math.sin(ctx.time * 3) * 0.08 * s;
}
function choirCrawler(world, e) {
  const { d, type } = e,
    s = d.height / 1.05,
    m = makeMaterials(world, e, {
      armor: e.elite ? 0x9b765f : d.color,
      trim: 0xb3b39e,
      frame: 0x242b29,
      joint: 0x5a6461,
      glow: 0xff5a2c,
      skin: 'panel',
    }),
    { part, joint } = builder(world, e),
    rig = { legs: [] };
  const body = joint(e.root, 0, 0.5 * s, 0);
  part('box', [0.9 * s, 0.34 * s, 1.0 * s], m.armor, [0, 0, 0], 'body', body);
  part('box', [0.7 * s, 0.14 * s, 0.8 * s], m.frame, [0, 0.22 * s, -0.05 * s], 'body', body);
  part('box', [0.5 * s, 0.26 * s, 0.34 * s], m.frame, [0, 0.02 * s, 0.6 * s], 'body', body);
  e.sensor = part(
    'hard',
    [0.42 * s, 0.08 * s, 0.05 * s],
    m.glow,
    [0, 0.06 * s, 0.78 * s],
    'sensor',
    body,
  );
  for (const side of [-1, 1])
    part(
      'spike',
      [0.06 * s, 0.3 * s, 0.06 * s],
      m.frame,
      [side * 0.16 * s, -0.08 * s, 0.86 * s],
      'body',
      body,
      [1.9, 0, 0],
    );
  part(
    'cyl',
    [0.03 * s, 0.5 * s, 0.03 * s],
    m.joint,
    [0, 0.4 * s, -0.45 * s],
    'body',
    body,
    [-0.5, 0, 0],
  );
  if (type === 'volatile') {
    part('cyl', [0.5 * s, 0.4 * s, 0.5 * s], m.frame, [0, 0.38 * s, -0.1 * s], 'body', body);
    rig.canister = part(
      'cyl',
      [0.42 * s, 0.34 * s, 0.42 * s],
      m.glow,
      [0, 0.4 * s, -0.1 * s],
      'sensor',
      body,
    );
    part('cyl', [0.08 * s, 0.4 * s, 0.08 * s], m.glow, [0, 0.72 * s, -0.1 * s], 'sensor', body);
  }
  for (const side of [-1, 1])
    for (const fz of [-1, 1]) {
      const hip = joint(body, side * 0.45 * s, 0, fz * 0.34 * s);
      hip.rotation.y = side * fz * 0.5;
      const upper = joint(hip, 0, 0, 0);
      part(
        'box',
        [0.5 * s, 0.1 * s, 0.12 * s],
        m.armor,
        [side * 0.25 * s, 0.1 * s, 0],
        'leg',
        upper,
        [0, 0, side * 0.5],
      );
      const knee = joint(upper, side * 0.48 * s, 0.22 * s, 0);
      part('sphere', [0.1 * s, 0.1 * s, 0.1 * s], m.joint, [0, 0, 0], 'leg', knee);
      part(
        'cone',
        [0.08 * s, 0.7 * s, 0.08 * s],
        m.frame,
        [side * 0.1 * s, -0.36 * s, 0],
        'leg',
        knee,
        [Math.PI, 0, side * 0.25],
      );
      rig.legs.push({ upper, side, fz });
    }
  if (e.elite) part('box', [0.5 * s, 0.05 * s, 0.5 * s], m.gold, [0, 0.3 * s, 0], 'armor', body);
  rig.body = body;
  e.animate = (dt, ctx) => {
    e.walk = (e.walk || 0) + ctx.speed * dt * 5;
    const stride = Math.min(1, ctx.speed / Math.max(0.5, d.speed));
    for (const leg of rig.legs) {
      const p = e.walk + (leg.side * leg.fz > 0 ? 0 : Math.PI);
      leg.upper.rotation.z = leg.side * Math.max(0, Math.sin(p)) * 0.5 * stride;
      leg.upper.rotation.y = Math.cos(p) * 0.35 * stride;
    }
    rig.body.position.y =
      0.5 * s + Math.abs(Math.sin(e.walk)) * 0.05 * s + Math.sin(ctx.time * 4 + e.id) * 0.01;
    rig.body.rotation.x = ctx.lookPitch * 0.3;
    if (rig.canister) rig.canister.material.emissiveIntensity = 2 + Math.sin(ctx.time * 12) * 1.2;
  };
}
function choirArchitect(world, e) {
  const { d } = e,
    m = makeMaterials(world, e, {
      armor: d.color,
      trim: 0x819c97,
      frame: 0x1f2a2b,
      joint: 0x5b6c70,
      glow: 0xc9a2ff,
      skin: 'panel',
    }),
    { part, joint } = builder(world, e),
    rig = { legs: [] };
  const hull = joint(e.root, 0, 2.6, 0);
  part('box', [3.3, 1.5, 2.3], m.armor, [0, 0.2, 0], 'body', hull);
  part('box', [2.6, 0.5, 1.8], m.frame, [0, 1.1, -0.1], 'body', hull);
  e.plate = part('box', [2.5, 1.3, 0.22], m.trim, [0, 0.25, 1.2], 'armor', hull);
  e.core = part('sphere', [1.0, 0.9, 0.3], m.glow, [0, 0.25, 1.15], 'core', hull);
  e.core.visible = false;
  e.sensor = part('hard', [0.8, 0.14, 0.12], m.glow, [0, 1.12, 0.95], 'sensor', hull);
  for (const side of [-1, 1]) {
    const name = side < 0 ? 'weaponLeft' : 'weaponRight';
    part('box', [0.7, 1.4, 0.8], m.frame, [side * 1.95, 0.7, 0], name, hull);
    part('cyl', [0.4, 1.4, 0.4], m.armor, [side * 1.95, 0.8, 0.8], name, hull, [Math.PI / 2, 0, 0]);
    part('cyl', [0.3, 0.05, 0.3], m.glow, [side * 1.95, 0.8, 1.52], name, hull, [
      Math.PI / 2,
      0,
      0,
    ]);
    for (const fz of [-1, 1]) {
      const hip = joint(hull, side * 1.35, -0.4, fz * 0.8);
      part('sphere', [0.5, 0.5, 0.5], m.joint, [0, 0, 0], 'leg', hip);
      part('box', [0.4, 1.3, 0.45], m.armor, [side * 0.35, 0.3, 0], 'leg', hip, [
        0,
        0,
        side * -0.8,
      ]);
      const knee = joint(hip, side * 0.8, 0.7, 0);
      part('sphere', [0.34, 0.34, 0.34], m.joint, [0, 0, 0], 'leg', knee);
      part('box', [0.32, 2.9, 0.36], m.frame, [side * 0.3, -1.4, 0], 'leg', knee, [
        0,
        0,
        side * 0.2,
      ]);
      part('cone', [0.4, 0.4, 0.4], m.frame, [side * 0.6, -2.9, 0], 'leg', knee, [Math.PI, 0, 0]);
      rig.legs.push({ hip, side, fz });
    }
  }
  e.rotor = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.22, 8, 32), m.joint);
  e.rotor.position.set(0, 4.1, 0);
  e.root.add(e.rotor);
  for (let n = 0; n < 6; n++) {
    const a = (n / 6) * Math.PI * 2;
    part(
      'hard',
      [0.1, 0.3, 0.1],
      m.glow,
      [Math.cos(a) * 1.2, Math.sin(a) * 1.2, 0],
      'body',
      e.rotor,
      [0, 0, a],
    );
  }
  rig.hull = hull;
  e.animate = (dt, ctx) => {
    e.walk = (e.walk || 0) + ctx.speed * dt * 1.6;
    const stride = Math.min(1, ctx.speed / Math.max(0.5, d.speed));
    for (const leg of rig.legs) {
      const p = e.walk + (leg.side * leg.fz > 0 ? 0 : Math.PI);
      leg.hip.rotation.x = Math.sin(p) * 0.3 * stride * leg.fz;
      leg.hip.rotation.z = Math.max(0, Math.cos(p)) * 0.15 * stride * leg.side;
    }
    rig.hull.position.y = 2.6 + Math.sin(e.walk * 2) * 0.06 * stride + Math.sin(ctx.time) * 0.04;
    rig.hull.rotation.x = ctx.lookPitch * 0.2;
  };
}
// ---------------------------------------------------------------------------------- Brood
function broodBug(world, e) {
  const { d } = e,
    boss = !!d.boss,
    h = d.height,
    r = d.radius,
    glowColor = d.attack === 'suicide' ? 0xffc24a : d.summons ? 0xc6ff5c : 0xe8f06a,
    m = makeMaterials(world, e, {
      armor: e.elite ? 0x9b8a4f : d.color,
      trim: 0x3d4122,
      frame: 0x2a2616,
      joint: 0x8b7a52,
      glow: glowColor,
      glowIntensity: 0.95,
      skin: 'organic',
    }),
    { part, joint } = builder(world, e),
    rig = { legs: [], segments: [], jaws: [] },
    bodyY = h * (boss ? 0.5 : 0.46);
  const body = joint(e.root, 0, bodyY, 0);
  part('sphere', [r * 1.55, h * 0.4, r * 1.7], m.armor, [0, 0, 0], 'body', body);
  part('sphere', [r * 1.35, h * 0.26, r * 1.5], m.frame, [0, -h * 0.1, 0.05], 'body', body);
  e.plate = part(
    'sphere',
    [r * 1.8, h * 0.3, r * 2.05],
    m.trim,
    [0, h * 0.12, -0.08],
    'armor',
    body,
  );
  const spines = boss ? 7 : d.charger ? 5 : 3;
  for (let n = 0; n < spines; n++)
    part(
      'spike',
      [r * 0.22, h * 0.26, r * 0.22],
      m.joint,
      [0, h * 0.28, r * (0.7 - (n * 1.5) / spines)],
      'armor',
      body,
      [-0.5, 0, 0],
    );
  // Segmented abdomen that sways behind the thorax.
  let parent = body;
  for (let n = 0; n < (boss ? 4 : 3); n++) {
    const seg = joint(parent, 0, n ? 0.02 : -h * 0.02, n ? -r * 0.72 : -r * 1.2);
    const k = 1 - n * 0.2;
    part(
      'sphere',
      [r * 1.3 * k, h * 0.34 * k, r * 1.0 * k],
      m.armor,
      [0, 0, -r * 0.3],
      'body',
      seg,
    );
    part(
      'torus',
      [r * 1.25 * k, r * 1.25 * k, r * 1.0 * k],
      m.trim,
      [0, 0, -r * 0.05],
      'body',
      seg,
      [0, 0, 0],
    );
    rig.segments.push(seg);
    parent = seg;
  }
  if (d.attack === 'acid' || d.summons || d.attack === 'suicide' || boss) {
    const sacs = d.attack === 'suicide' ? 1 : 2;
    for (let n = 0; n < sacs; n++) {
      const side = sacs === 1 ? 0 : n ? 1 : -1;
      const sac = part(
        'sphere',
        [r * (sacs === 1 ? 1.4 : 0.75), h * 0.3, r * 0.8],
        m.glow,
        [side * r * 0.55, h * 0.22, -r * 0.25],
        d.summons ? 'deployer' : 'sensor',
        rig.segments[0],
      );
      (rig.sacs ||= []).push(sac);
    }
  }
  // Head: eye cluster (weak point) and snapping mandibles (attack organs).
  const head = joint(body, 0, h * 0.02, r * 1.05);
  part('sphere', [r * 1.0, h * 0.26, r * 0.85], m.armor, [0, 0, r * 0.2], 'body', head);
  e.sensor = part(
    'sphere',
    [r * 0.5, h * 0.12, r * 0.28],
    m.glow,
    [0, h * 0.06, r * 0.58],
    'sensor',
    head,
  );
  for (const side of [-1, 1])
    for (const dy of [0.06, -0.02])
      part(
        'sphere',
        [r * 0.16, r * 0.16, r * 0.16],
        m.glow,
        [side * r * 0.36, h * dy, r * 0.5],
        'sensor',
        head,
      );
  for (const side of [-1, 1]) {
    const jaw = joint(head, side * r * 0.3, -h * 0.06, r * 0.55);
    part(
      'spike',
      [r * 0.22, r * 0.9, r * 0.22],
      m.joint,
      [side * r * 0.12, 0, r * 0.35],
      side < 0 ? 'weaponLeft' : 'weaponRight',
      jaw,
      [Math.PI / 2, 0, side * -0.5],
    );
    rig.jaws.push({ jaw, side });
  }
  if (d.charger || d.pattern === 'rupture')
    part(
      'spike',
      [r * 0.5, h * 0.55, r * 0.5],
      m.trim,
      [0, h * 0.2, r * 0.9],
      'armor',
      head,
      [0.9, 0, 0],
    );
  // Six jointed legs.
  for (const side of [-1, 1])
    for (let n = 0; n < 3; n++) {
      const hip = joint(body, side * r * 0.72, -h * 0.05, r * (0.55 - n * 0.55));
      hip.rotation.y = side * (n - 1) * -0.45;
      const upper = joint(hip, 0, 0, 0);
      // Thigh rises out to a raised knee, then a tapering shin and claw reach the ground.
      part(
        'cyl',
        [r * 0.15, r * 1.1, r * 0.15],
        m.armor,
        [side * r * 0.42, h * 0.16, 0],
        'leg',
        upper,
        [0, 0, side * -1.0],
      );
      const knee = joint(upper, side * r * 0.85, h * 0.32, 0);
      part('sphere', [r * 0.2, r * 0.2, r * 0.2], m.trim, [0, 0, 0], 'leg', knee);
      const shin = bodyY + h * 0.28;
      part(
        'cone',
        [r * 0.16, shin, r * 0.16],
        m.armor,
        [side * r * 0.22, -shin / 2, 0],
        'leg',
        knee,
        [Math.PI, 0, side * 0.26],
      );
      part(
        'spike',
        [r * 0.1, r * 0.35, r * 0.1],
        m.joint,
        [side * r * 0.42, -shin + r * 0.05, r * 0.12],
        'leg',
        knee,
        [2.2, 0, 0],
      );
      rig.legs.push({ upper, side, n });
    }
  if (boss) {
    e.core = part('sphere', [1.1, 1.1, 0.5], m.glow, [0, h * 0.02, r * 1.0], 'core', body);
    e.core.visible = false;
    for (const side of [-1, 1])
      part(
        'sphere',
        [0.95, 1.25, 0.95],
        m.glow,
        [side * 1.35, h * 0.22, 0.2],
        side < 0 ? 'weaponLeft' : 'weaponRight',
        body,
      );
    zoneRing(e, d.pattern === 'rupture' ? 9.8 : 6.8, d.pattern === 'rupture' ? 10 : 7, 0xcce96f);
  }
  if (e.elite)
    part('torus', [r * 1.3, r * 1.3, r * 1.3], m.gold, [0, h * 0.2, 0], 'armor', body, [
      Math.PI / 2,
      0,
      0,
    ]);
  rig.body = body;
  rig.head = head;
  e.animate = (dt, ctx) => {
    e.walk = (e.walk || 0) + ctx.speed * dt * (6 / Math.max(0.6, r));
    const stride = Math.min(1, ctx.speed / Math.max(0.5, d.speed)),
      t = ctx.time;
    // Alternating tripod gait.
    for (const leg of rig.legs) {
      const tripod = leg.side > 0 === (leg.n % 2 === 0) ? 0 : Math.PI,
        p = e.walk + tripod;
      leg.upper.rotation.z = leg.side * Math.max(0, Math.sin(p)) * 0.35 * stride;
      leg.upper.rotation.y = Math.cos(p) * 0.3 * stride;
    }
    rig.body.position.y =
      bodyY +
      Math.abs(Math.sin(e.walk * 2)) * 0.04 * h * stride +
      Math.sin(t * 2.2 + e.id) * 0.015 * h;
    rig.segments.forEach((seg, n) => {
      seg.rotation.y = Math.sin(t * 2 + n * 0.8 + e.walk) * 0.12;
      seg.rotation.x = Math.sin(t * 1.3 + n) * 0.05;
    });
    const snap =
      ctx.warn > 0 || ctx.recent ? Math.abs(Math.sin(t * 18)) : Math.abs(Math.sin(t * 2.5)) * 0.3;
    for (const j of rig.jaws) j.jaw.rotation.y = j.side * (0.1 + snap * 0.45);
    rig.head.rotation.x = ctx.lookPitch * 0.5;
    for (const sac of rig.sacs || []) sac.scale.y = h * 0.3 * (1 + Math.sin(t * 4 + e.id) * 0.08);
  };
}
// ---------------------------------------------------------------------------------- Veil
function veilWraith(world, e) {
  const { d } = e,
    boss = !!d.boss,
    h = d.height,
    r = d.radius,
    m = makeMaterials(world, e, {
      armor: e.elite ? 0x9e7fc4 : d.color,
      trim: 0xd9ccff,
      frame: 0x262238,
      joint: 0xb0a2e6,
      glow: d.healer ? 0x8ef5df : d.cloak ? 0xff7ad9 : 0xc5a8ff,
      glowIntensity: 1.3,
      shield: 0xb7a4ff,
      skin: 'crystal',
      cloak: !!d.cloak,
    }),
    { part, joint } = builder(world, e),
    rig = { shards: [], arms: [] },
    floatY = h * 0.34;
  const body = joint(e.root, 0, floatY, 0);
  // Tapered lower body: the Veil hover and never touch the ground.
  part('gem', [r * 1.2, h * 0.42, r * 1.0], m.frame, [0, h * 0.02, 0], 'leg', body, [
    Math.PI,
    0,
    0,
  ]);
  part('crystal', [r * 0.45, h * 0.2, r * 0.45], m.glow, [0, -h * 0.22, 0], 'leg', body);
  const torso = joint(body, 0, h * 0.26, 0);
  part('crystal', [r * 1.9, h * 0.42, r * 1.2], m.armor, [0, 0.05 * h, 0], 'body', torso);
  e.plate = part(
    'crystal',
    [r * 1.45, h * 0.3, r * 0.6],
    m.trim,
    [0, 0.07 * h, r * 0.38],
    'armor',
    torso,
  );
  part('hard', [0.05, h * 0.2, 0.05], m.glow, [0, 0.07 * h, r * 0.62], 'body', torso);
  for (const side of [-1, 1])
    part(
      'hard',
      [r * 0.5, 0.04, 0.04],
      m.glow,
      [side * r * 0.45, 0.16 * h, r * 0.5],
      'body',
      torso,
      [0, 0, side * 0.5],
    );
  // Head: faceted skull with a glowing eye slit and a shard crown.
  const head = joint(torso, 0, h * 0.3, 0);
  part('crystal', [r * 0.75, h * 0.2, r * 0.75], m.armor, [0, 0, 0], 'body', head);
  e.sensor = part(
    'hard',
    [r * 0.55, h * 0.03, 0.06],
    m.glow,
    [0, 0.01 * h, r * 0.33],
    'sensor',
    head,
  );
  for (let n = -2; n <= 2; n++)
    part(
      'spike',
      [0.08, h * (0.12 - Math.abs(n) * 0.02), 0.08],
      m.trim,
      [n * r * 0.14, h * 0.1, -r * 0.05],
      'body',
      head,
      [-0.2, 0, n * -0.25],
    );
  rig.halo = joint(head, 0, h * 0.02, -r * 0.35);
  part('torus', [r * 0.85, r * 0.85, r * 0.85], m.soft, [0, 0, 0], 'body', rig.halo);
  // Arms: blades for melee hunters, emitter orbs for casters.
  const melee = d.attack === 'melee';
  for (const side of [-1, 1]) {
    const name = side < 0 ? 'weaponLeft' : 'weaponRight',
      shoulder = joint(torso, side * r * 1.0, h * 0.14, 0);
    part('crystal', [r * 0.5, h * 0.12, r * 0.5], m.trim, [0, 0, 0], name, shoulder);
    const arm = joint(shoulder, side * r * 0.1, -h * 0.05, 0);
    part('gem', [0.16, h * 0.28, 0.16], m.frame, [0, -h * 0.14, 0], name, arm, [Math.PI, 0, 0]);
    if (melee) {
      part(
        'spike',
        [0.14, h * (d.cloak ? 0.55 : 0.4), 0.05],
        m.glow,
        [0, -h * 0.4, 0.1],
        name,
        arm,
        [Math.PI - 0.25, 0, 0],
      );
    } else part('sphere', [0.24, 0.24, 0.24], m.glow, [0, -h * 0.3, 0.05], name, arm);
    rig.arms.push({ shoulder: arm, side });
  }
  if (d.shield)
    e.shieldMesh = part(
      'crystal',
      [r * 2.6, h * 0.7, 0.14],
      m.energy,
      [0, h * 0.2, r + 0.25],
      'shield',
      body,
    );
  if (d.healer)
    for (let n = 0; n < 3; n++) {
      const orb = part('sphere', [0.28, 0.28, 0.28], m.glow, [0, h * 0.62, 0], 'repair', body);
      rig.shards.push({
        mesh: orb,
        radius: r * 1.4,
        speed: 1.6,
        offset: (n / 3) * Math.PI * 2,
        y: h * 0.62,
      });
    }
  if (d.desiredRange) {
    part('gem', [0.14, 1.9, 0.14], m.frame, [r * 0.9, h * 0.2, 0.8], 'weaponRight', torso, [
      Math.PI / 2,
      0,
      0,
    ]);
    part('hard', [0.05, 0.05, 1.7], m.glow, [r * 0.9, h * 0.24, 0.85], 'weaponRight', torso);
  }
  for (let n = 0; n < (boss ? 6 : 3); n++) {
    const shard = part('crystal', [0.16, 0.36, 0.16], m.trim, [0, h * 0.3, 0], 'body', body);
    rig.shards.push({
      mesh: shard,
      radius: r * (boss ? 2.1 : 1.6),
      speed: 0.9,
      offset: (n / (boss ? 6 : 3)) * Math.PI * 2,
      y: h * 0.3,
    });
  }
  if (boss) {
    e.rotor = new THREE.Mesh(
      new THREE.TorusGeometry(
        d.pattern === 'beam' ? 1.7 : 1.25,
        0.1,
        6,
        d.pattern === 'beam' ? 4 : 24,
      ),
      m.glow,
    );
    e.rotor.position.set(0, h * 0.85, -0.3);
    e.root.add(e.rotor);
    e.core = part('crystal', [1.1, 1.1, 0.4], m.glow, [0, h * 0.08, r * 0.7], 'core', torso);
    e.core.visible = false;
    for (const side of [-1, 1])
      part(
        'crystal',
        [0.9, 1.3, 0.9],
        m.glow,
        [side * 1.35, h * 0.3, 0.45],
        side < 0 ? 'weaponLeft' : 'weaponRight',
        body,
      );
    zoneRing(e, 6.8, 7, 0xc0a0ff);
  }
  if (e.elite)
    part('torus', [r * 0.9, r * 0.9, r * 0.9], m.gold, [0, h * 0.02, 0], 'armor', head, [
      Math.PI / 2,
      0,
      0,
    ]);
  rig.body = body;
  rig.torso = torso;
  rig.head = head;
  e.animate = (dt, ctx) => {
    const t = ctx.time,
      stride = Math.min(1, ctx.speed / Math.max(0.5, d.speed));
    rig.body.position.y = floatY + Math.sin(t * 1.8 + e.id) * 0.08 * h * 0.3;
    rig.body.rotation.x = 0.15 * stride;
    rig.torso.rotation.y = Math.sin(t * 0.9 + e.id) * 0.08;
    rig.head.rotation.x = ctx.lookPitch * 0.6;
    rig.halo.rotation.z += dt * 0.8;
    const raise = ctx.warn > 0 || ctx.recent ? 1 : 0;
    rig.raise = (rig.raise || 0) + (raise - (rig.raise || 0)) * Math.min(1, dt * 7);
    for (const arm of rig.arms)
      arm.shoulder.rotation.x =
        -rig.raise * (1.3 + ctx.lookPitch) + Math.sin(t * 1.4 + arm.side) * 0.08;
    for (const shard of rig.shards) {
      const a = t * shard.speed + shard.offset;
      shard.mesh.position.set(
        Math.cos(a) * shard.radius,
        shard.y + Math.sin(a * 2) * 0.15,
        Math.sin(a) * shard.radius,
      );
      shard.mesh.rotation.y = a * 2;
    }
  };
}
export function buildEnemyModel(world, e) {
  const { d, type } = e;
  if (d.faction === 'brood') broodBug(world, e);
  else if (d.faction === 'veil') veilWraith(world, e);
  else if (type === 'architect') choirArchitect(world, e);
  else if (type === 'skitter' || type === 'volatile') choirCrawler(world, e);
  else choirWalker(world, e);
  e.sensor ??= e.meshes.find((m) => m.userData.part === 'sensor');
}
// Per-frame presentation shared by every model: telegraph glow and hit flash.
export function updateEnemyLook(e, dt, ctx) {
  e.animate?.(dt, ctx);
  e.hitFlash = Math.max(0, (e.hitFlash || 0) - dt * 7);
  const warn = ctx.warn > 0 ? 1.6 + Math.sin(ctx.time * 30) * 0.8 : 1;
  for (const material of e.materials || []) {
    if (material.userData.glow) {
      material.userData.base ??= material.emissiveIntensity;
      material.emissiveIntensity = material.userData.base * warn + e.hitFlash * 2;
    } else if (e.hitFlash > 0 || material.userData.flashing) {
      material.emissive.setScalar(e.hitFlash * 0.55);
      material.userData.flashing = e.hitFlash > 0;
    }
  }
}
