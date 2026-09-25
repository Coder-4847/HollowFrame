import * as THREE from 'three';
export const MELEE_KITS = {
  energy: {
    name: 'ARC SABER',
    description: 'Wide energy sweeps. Brief perfect parry when raising guard.',
    damage: 125,
    range: 3.8,
    cone: 0.5,
    cooldown: 0.55,
    cost: 18,
    block: 0.25,
    color: 0x70edff,
  },
  spear: {
    name: 'ION SPEAR',
    description: 'Long, precise thrusts. Brace to reduce frontal damage.',
    damage: 180,
    range: 5.4,
    cone: 0.92,
    cooldown: 0.85,
    cost: 24,
    block: 0.45,
    color: 0xc4a1ff,
  },
  aegis: {
    name: 'SWORD & SHIELD',
    description: 'Fast cuts and strong frontal protection. Guard drains stamina on impact.',
    damage: 100,
    range: 3.5,
    cone: 0.65,
    cooldown: 0.48,
    cost: 15,
    block: 0.8,
    color: 0xffcf79,
  },
};
export class MeleeClass {
  constructor(game) {
    this.game = game;
    this.root = new THREE.Group();
    game.world.camera.add(this.root);
    this.reset();
  }
  get active() {
    return this.game.save.combatClass === 'melee';
  }
  get kit() {
    return MELEE_KITS[this.game.save.meleeKit] || MELEE_KITS.energy;
  }
  reset() {
    this.stamina = 100;
    this.cooldown = 0;
    this.swing = 0;
    this.combo = 0;
    this.guard = false;
    this.guardTime = 0;
    this.exhausted = 0;
    this.build();
  }
  build() {
    this.root.traverse((m) => {
      if (m.isMesh) m.material.dispose();
    });
    this.root.clear();
    const w = this.game.world,
      c = this.kit.color,
      spear = this.game.save.meleeKit === 'spear';
    this.weapon = new THREE.Group();
    this.weapon.scale.setScalar(0.65);
    this.root.add(this.weapon);
    const add = (a, b, d, color, x, y, z, parent = this.weapon, emissive = false) => {
      const m = w.box(a, b, d, color, x, y, z, parent, emissive);
      m.material = m.material.clone();
      m.material.depthTest = false;
      m.renderOrder = 12;
      return m;
    };
    add(0.1, spear ? 1.8 : 0.42, 0.1, 0x45576a, 0, 0, 0);
    add(0.26, 0.18, 0.23, 0x687e81, 0, -0.05, 0.05);
    add(0.48, 0.08, 0.17, 0xb3c9d0, 0, spear ? 0.75 : 0.26, 0);
    const edge = add(
      spear ? 0.15 : 0.13,
      spear ? 0.65 : 1.05,
      0.065,
      c,
      0,
      spear ? 1.1 : 0.82,
      0,
      this.weapon,
      true,
    );
    if (spear) {
      if (!w.geometries.has('spear-tip'))
        w.geometries.set('spear-tip', new THREE.ConeGeometry(0.12, 0.65, 4));
      edge.geometry = w.geometries.get('spear-tip');
    }
    add(
      0.045,
      spear ? 0.35 : 0.95,
      0.08,
      0xeaffff,
      0,
      spear ? 1.05 : 0.82,
      0.01,
      this.weapon,
      true,
    );
    this.weapon.position.set(0.48, -0.45, -0.7);
    this.weapon.rotation.z = -0.32;
    this.shield = new THREE.Group();
    this.shield.scale.setScalar(0.62);
    this.root.add(this.shield);
    add(0.65, 0.82, 0.12, 0x43566c, 0, 0, 0, this.shield);
    for (const x of [-0.3, 0.3]) add(0.055, 0.84, 0.14, c, x, 0, 0, this.shield, true);
    add(0.12, 0.55, 0.15, c, 0, 0, 0, this.shield, true);
    this.shield.position.set(-0.48, -0.3, -0.72);
    this.shield.visible = this.game.save.meleeKit === 'aegis';
    this.root.visible = false;
  }
  defend(amount, from) {
    const g = this.game;
    if (
      !this.active ||
      !this.guard ||
      !g.input.aim ||
      !from ||
      this.stamina < 8 ||
      g.player.parkour?.mantle
    )
      return amount;
    const facing = new THREE.Vector3();
    g.world.camera.getWorldDirection(facing);
    facing.y = 0;
    facing.normalize();
    const direction = from.clone().sub(g.player.position).setY(0).normalize();
    if (direction.dot(facing) < 0.45) return amount;
    const parry = g.save.meleeKit === 'energy' && this.guardTime < 0.22;
    const reduction = parry ? 1 : this.kit.block;
    this.stamina = Math.max(0, this.stamina - Math.max(8, amount * 0.7));
    if (this.stamina === 0) {
      this.exhausted = 1.3;
      this.guard = false;
    }
    g.fx.impact(
      g.world.camera.position.clone().addScaledVector(facing, 0.9),
      facing.clone().negate(),
      'shield',
    );
    g.audio.tone(parry ? 880 : 220, 0.08, 0.09, 'triangle', 450);
    g.notice(parry ? 'PARRY' : this.exhausted ? 'GUARD BROKEN' : 'BLOCK', 0.4);
    return amount * (1 - reduction);
  }
  attack() {
    const g = this.game,
      k = this.kit;
    if (this.cooldown > 0 || this.stamina < k.cost || g.player.sprint || g.player.parkour?.mantle)
      return false;
    this.stamina -= k.cost;
    this.cooldown = k.cooldown;
    this.swing = k.cooldown;
    this.combo++;
    this.guard = false;
    g.stats.shots++;
    const origin = g.world.camera.position.clone(),
      dir = new THREE.Vector3();
    g.world.camera.getWorldDirection(dir);
    let hit = false;
    for (const e of [...g.enemies.list].sort(
      (a, b) =>
        a.root.position.distanceToSquared(origin) - b.root.position.distanceToSquared(origin),
    )) {
      const target = e.root.position.clone().add(new THREE.Vector3(0, e.d.height * 0.55, 0)),
        delta = target.clone().sub(origin);
      const ray = new THREE.Raycaster(origin, dir, 0, k.range + e.d.radius * 0.4);
      const direct = ray.intersectObjects(
        e.meshes.filter((m) => m.visible),
        false,
      )[0];
      if (
        !direct &&
        (delta.length() > k.range + e.d.radius * 0.4 || delta.normalize().dot(dir) < k.cone)
      )
        continue;
      if (!g.enemies.visible(origin, direct?.point || target)) continue;
      const part = direct?.object.userData.part || 'body',
        point = direct?.point || target;
      g.enemies.hit(
        e,
        part,
        { damage: k.damage, range: k.range + 2, penetration: 0.85, weak: 1.8, stagger: 0.45 },
        point,
        0,
      );
      hit = true;
      if (g.save.meleeKit === 'spear') break;
    }
    if (hit) g.stats.hits++;
    g.audio.tone(g.save.meleeKit === 'spear' ? 250 : 430, 0.16, 0.12, 'sawtooth', 90);
    return true;
  }
  update(dt) {
    const g = this.game,
      k = this.kit;
    this.root.visible = this.active && ['playing', 'paused', 'upgrades'].includes(g.state);
    if (!this.active) return;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.swing = Math.max(0, this.swing - dt);
    this.exhausted = Math.max(0, this.exhausted - dt);
    const guarding =
      g.input.aim &&
      this.swing <= 0 &&
      this.stamina > 5 &&
      this.exhausted <= 0 &&
      !g.player.sprint &&
      !g.player.parkour?.mantle;
    this.guardTime = guarding ? (this.guard ? this.guardTime + dt : 0) : 0;
    this.guard = guarding;
    this.stamina = Math.min(100, this.stamina + dt * (this.guard ? 5 : this.cooldown > 0 ? 0 : 28));
    if ((g.input.fire || g.input.shot || g.input.tap('KeyV') || g.input.tap('KeyF')) && !this.guard)
      this.attack();
    const t = 1 - this.swing / k.cooldown,
      arc = this.swing > 0 ? Math.sin(t * Math.PI) : 0,
      spear = g.save.meleeKit === 'spear';
    this.weapon.position.set(
      0.48 - (spear ? 0.25 : 0.65) * arc,
      -0.45 + arc * 0.15 - (g.player.parkour?.mantle ? 0.6 : 0),
      -0.7 - (spear ? arc * 0.8 : 0),
    );
    this.weapon.rotation.set(
      spear ? -0.85 - arc * 0.5 : 0,
      0,
      this.guard ? -1.15 : -0.32 + arc * (this.combo % 2 ? 1.4 : -1.2),
    );
    this.shield.position.set(this.guard ? -0.32 : -0.48, this.guard ? -0.24 : -0.4, -0.85);
    if (arc > 0.2 && !g.settings.reducedMotion) {
      this.weapon.updateWorldMatrix(true, false);
      const a = this.weapon.localToWorld(new THREE.Vector3(0, 0.3, 0)),
        b = this.weapon.localToWorld(new THREE.Vector3(0, spear ? 1.4 : 1.3, 0));
      g.fx.trace(a, b, k.color);
    }
  }
}
