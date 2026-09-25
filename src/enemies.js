import { updateArchitect } from './bosses.js';
import { buildFactionModel } from './faction-models.js';
import { updateFactionBoss } from './faction-bosses.js';
import { modifier } from './upgrades.js';
import * as THREE from 'three';
import { ENEMIES } from './data.js';
import { damageFor, moveBody, floorAt, overlaps } from './core.js';
import { Navigation } from './navigation.js';
export class Enemies {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.targets = [];
    this.nav = new Navigation(game.world.colliders, 0.7, 3, game.map);
    this.heavyNav = new Navigation(game.world.colliders, 1.25, 4, game.map);
    this.bossNav = new Navigation(game.world.colliders, 1.75, 6, game.map);
    this.ray = new THREE.Raycaster();
    this.nextId = 0;
  }
  spawn(type, pos, elite = false) {
    const g = this.game,
      w = g.world,
      d = ENEMIES[type],
      root = new THREE.Group();
    root.position.copy(pos);
    root.rotation.order = 'YXZ';
    w.scene.add(root);
    const e = {
      id: this.nextId++,
      type,
      d,
      root,
      hp: d.hp,
      armor: d.armor,
      legs: d.boss ? 250 : 70,
      alive: true,
      attack: 1.5 + Math.random(),
      warn: 0,
      stun: 0,
      path: [],
      repath: Math.random(),
      phase: Math.random() * 6,
      meshes: [],
      limbs: [],
      legBroken: false,
      elite: elite && !d.boss,
      shield: d.shield || 0,
      components: {
        weaponLeft: d.boss ? 230 : 90,
        weaponRight: d.boss ? 230 : 90,
        repair: 70,
        deployer: 100,
        command: 90,
      },
      cycle: 0,
      coreOpen: false,
      volleyFired: false,
      slamFired: false,
      reinforced: 0,
      slow: 0,
      deployClock: 7,
      deployCharges: 2,
      rewardScale: 1,
    };
    const color = e.elite ? 0x9b765f : d.color;
    const part = (bw, bh, bd, c, x, y, z, name) => {
      const m = w.box(bw, bh, bd, c, x, y, z, root, ['sensor', 'core'].includes(name));
      m.userData = { enemy: e, part: name };
      e.meshes.push(m);
      return m;
    };
    const s = d.height / 2.5;
    if (d.faction !== 'choir') {
      buildFactionModel(w, e);
    } else if (type === 'architect') {
      part(3.2, 1.7, 2.1, color, 0, 2.8, 0, 'body');
      e.plate = part(2.4, 1.5, 0.22, 0x819c97, 0, 2.8, 1.13, 'armor');
      e.core = part(1.1, 1, 0.25, 0xbda2fc, 0, 2.8, 1.06, 'core');
      e.core.visible = false;
      for (const x of [-1.15, 1.15])
        for (const z of [-0.7, 0.7]) {
          const leg = part(0.5, 1.9, 0.6, 0x35494a, x, 0.95, z, 'leg');
          e.limbs.push(leg);
          part(0.8, 0.3, 1, color, x, 0.15, z + 0.1, 'leg');
        }
      for (const side of [-1, 1]) {
        const name = side < 0 ? 'weaponLeft' : 'weaponRight';
        part(0.65, 1.6, 0.7, 0x586e77, side * 1.95, 3.4, 0, name);
        part(0.38, 0.38, 1.3, 0xbaa0ed, side * 1.95, 3.5, 0.6, name);
      }
      e.rotor = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.22, 6, 24), w.material(0x849eab));
      e.rotor.position.set(0, 4, 0);
      root.add(e.rotor);
      e.sensor = part(0.6, 0.17, 0.2, 0xcea5ff, 0, 4.1, 1.25, 'sensor');
    } else if (d.boss) {
      part(2.8, 1.9, 1.65, color, 0, 3.1, 0, 'body');
      e.plate = part(2.4, 1.5, 0.24, 0xa2a995, 0, 3.1, 0.94, 'armor');
      e.core = part(1.15, 1.05, 0.25, 0x8cf0e1, 0, 3.1, 0.88, 'core');
      e.core.visible = false;
      part(1.4, 0.7, 1.1, 0x43514d, 0, 4.75, 0, 'body');
      e.sensor = part(0.8, 0.13, 0.1, 0xff854b, 0, 4.8, 0.6, 'sensor');
      for (const x of [-1, 1]) {
        const leg = part(0.65, 2.2, 0.8, 0x3c4844, x, 1.1, 0, 'leg');
        e.limbs.push(leg);
        part(0.95, 0.4, 1.4, color, x, 0.2, 0.15, 'leg');
        const name = x < 0 ? 'weaponLeft' : 'weaponRight';
        part(0.85, 1, 1.9, color, x * 1.9, 3.9, 0.2, name);
        for (const dx of [-0.2, 0.2]) part(0.22, 0.22, 1.3, 0x263530, x * 1.9 + dx, 4, 0.95, name);
        part(0.7, 0.1, 0.3, 0xffa24e, x * 1.9, 4.47, 0.4, name);
      }
      e.zone = new THREE.Mesh(
        new THREE.RingGeometry(8.85, 9, 64),
        new THREE.MeshBasicMaterial({
          color: 0xff8a5e,
          transparent: true,
          opacity: 0.65,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      e.zone.rotation.x = -Math.PI / 2;
      e.zone.position.y = 0.045;
      e.zone.visible = false;
      root.add(e.zone);
      part(3.1, 0.28, 1.9, 0xb3a274, 0, 4.25, 0, 'armor');
      part(0.15, 1.1, 0.15, 0xff995b, 0, 5.25, 0, 'sensor');
    } else if (type === 'skitter' || type === 'volatile') {
      part(1, 0.42, 0.9, color, 0, 0.52, 0, 'body');
      e.sensor = part(0.5, 0.12, 0.13, 0xff673b, 0, 0.72, 0.5, 'sensor');
      for (const x of [-0.56, 0.56])
        for (const z of [-0.35, 0.35]) {
          const leg = part(0.18, 0.5, 0.2, 0x3b4340, x, 0.25, z, 'leg');
          e.limbs.push(leg);
        }
      part(0.4, 0.16, 0.6, 0x3d4540, 0, 0.28, 0.55, 'body');
      if (type === 'volatile') {
        part(0.7, 0.3, 0.6, 0xeb8045, 0, 0.92, 0, 'sensor');
        part(0.12, 0.5, 0.12, 0xffbd70, 0, 1.2, 0, 'sensor');
      }
    } else {
      part(1.05 * s, 1.1 * s, 0.7 * s, color, 0, 1.45 * s, 0, 'body');
      e.plate = part(0.95 * s, 0.75 * s, 0.18 * s, 0xadb2a0, 0, 1.48 * s, 0.43 * s, 'armor');
      part(0.58 * s, 0.45 * s, 0.52 * s, 0x303f3b, 0, 2.22 * s, 0, 'body');
      e.sensor = part(0.44 * s, 0.13 * s, 0.14 * s, 0xff7143, 0, 2.27 * s, 0.31 * s, 'sensor');
      for (const x of [-0.34, 0.34]) {
        const leg = part(0.28 * s, 0.88 * s, 0.36 * s, 0x333f3c, x * s, 0.45 * s, 0, 'leg');
        e.limbs.push(leg);
        part(0.39 * s, 0.22 * s, 0.6 * s, color, x * s, 0.12 * s, 0.1 * s, 'leg');
      }
      for (const x of [-0.77, 0.77]) {
        const name = x < 0 ? 'weaponLeft' : 'weaponRight';
        part(0.4 * s, 0.65 * s, 0.55 * s, color, x * s, 1.7 * s, 0, name);
        part(0.22 * s, 0.22 * s, 1.15 * s, 0x28332f, x * s, 1.42 * s, 0.4 * s, name);
      }
      if (type === 'bastion') {
        part(1.6, 0.65, 0.9, 0x696d5b, 0, 3.3, -0.25, 'armor');
        part(0.3, 0.3, 0.3, 0xff8a4d, -0.52, 3.3, 0.3, 'sensor');
        part(0.3, 0.3, 0.3, 0xff8a4d, 0.52, 3.3, 0.3, 'sensor');
      }
      if (type === 'bulwark') {
        e.shieldMesh = part(1.6, 1.65, 0.18, 0x547887, 0, 1.25, 0.8, 'shield');
        part(1.5, 0.08, 0.2, 0x97e2f1, 0, 2.1, 0.81, 'shield');
      }
      if (type === 'mender') {
        e.repairMesh = part(0.7, 0.65, 0.4, 0x76c9a4, 0, 2.6, -0.15, 'repair');
        part(0.12, 1.1, 0.12, 0x81e1b2, 0, 2.7, -0.2, 'repair');
      }
      if (type === 'lancer') {
        part(0.2, 0.2, 1.6, 0x81799c, 0.8, 1.9, 0.5, 'weaponRight');
        part(0.12, 0.8, 0.12, 0xbca0dd, -0.3, 3, 0, 'sensor');
      }
    }
    if (type === 'fabricator') {
      part(1.2, 1.3, 0.6, 0x8ea472, 0, 2.5, -0.65, 'deployer');
      part(0.8, 0.15, 0.2, 0xb9e29c, 0, 3.35, -0.3, 'deployer');
    }
    if (type === 'cantor') {
      for (const x of [-0.6, 0.6]) part(0.15, 1.4, 0.15, 0xe9cd8f, x, 3.1, 0, 'command');
      part(1.4, 0.15, 0.15, 0xf4d598, 0, 3.8, 0, 'command');
    }
    if (type === 'shade' || d.cloak)
      for (const m of e.meshes) {
        m.material = m.material.clone();
        m.material.transparent = true;
        m.userData.ownedMaterial = true;
      }
    if (e.elite) part(d.radius * 1.5, 0.12, 0.15, 0xf4c075, 0, d.height + 0.2, 0, 'armor');
    this.list.push(e);
    this.targets.push(...e.meshes);
    root.updateMatrixWorld(true);
    return e;
  }
  visible(from, to) {
    const dir = to.clone().sub(from),
      distance = dir.length();
    if (distance < 0.01) return true;
    this.ray.set(from, dir.normalize());
    this.ray.far = distance;
    return this.ray.intersectObjects(this.game.world.solids, false).length === 0;
  }
  breakComponent(e, name) {
    if (name === 'shield') e.shield = 0;
    else e.components[name] = 0;
    for (const mesh of e.meshes) if (mesh.userData.part === name) mesh.visible = false;
    this.game.stats.components = (this.game.stats.components || 0) + 1;
    this.game.fx.burst(
      e.root.position.clone().add(new THREE.Vector3(0, e.d.height * 0.6, 0)),
      0x93e6e3,
      20,
      5,
    );
    this.game.notice(
      name === 'shield'
        ? 'SHIELD COLLAPSED'
        : name === 'repair'
          ? e.d.faction === 'veil'
            ? 'HEALING FOCUS DISABLED'
            : 'REPAIR ARRAY DISABLED'
          : name === 'deployer'
            ? e.d.faction === 'brood'
              ? 'BROOD SAC DESTROYED'
              : 'DRONE BAY DESTROYED'
            : name === 'command'
              ? 'COMMAND RELAY DESTROYED'
              : e.d.faction === 'brood'
                ? 'ATTACK ORGAN DESTROYED'
                : 'WEAPON MOUNT DESTROYED',
      1.2,
    );
    this.game.fx.debris(e.root.position, 0x92aaa1, 4);
    this.game.audio.tone(110, 0.3, 0.15, 'sawtooth', 30);
  }
  hit(e, part, weapon, point, distance) {
    if (!e.alive) return 0;
    const g = this.game;
    const weak = part === 'sensor' || part === 'core';
    e.deathImpulse = e.root.position
      .clone()
      .sub(g.player.position)
      .normalize()
      .multiplyScalar(Math.min(7, 2 + weapon.damage / 40));
    let actual = damageFor(weapon, weak ? 'sensor' : part, e.armor, distance);
    if (weak) actual *= modifier(g.upgrades, 'optics', 0.15);
    if (weapon.slow) e.slow = Math.max(e.slow, weapon.slow);
    if (part === 'shield' && e.shield > 0) {
      e.shield -= weapon.damage * (0.6 + weapon.penetration);
      actual = weapon.penetration >= 0.85 ? weapon.damage * 0.2 : 0;
      if (e.shield <= 0) this.breakComponent(e, 'shield');
    }
    if (e.d.boss) {
      if (part === 'core' && e.coreOpen) actual *= 1.25;
      else if (!part.startsWith('weapon')) actual *= e.coreOpen ? 0.7 : 0.22;
    }
    if (e.components[part] > 0) {
      e.components[part] -= weapon.damage;
      if (e.components[part] <= 0) this.breakComponent(e, part);
    }
    e.hp -= actual;
    e.flinch = Math.min(1, (e.flinch || 0) + actual / 45);
    const armorHit = e.armor > 0 && !weak && part !== 'shield';
    if (armorHit) {
      e.armor = Math.max(0, e.armor - weapon.damage * (0.65 + weapon.penetration));
      if (e.armor === 0 && e.plate) {
        e.plate.visible = false;
        g.fx.burst(point, 0xe9d7a0, 18, 5);
        g.notice('PLATING BROKEN', 0.8);
      }
    }
    if (part === 'leg') {
      e.legs -= weapon.damage;
      if (e.legs <= 0 && !e.legBroken) {
        e.legBroken = true;
        g.stats.components = (g.stats.components || 0) + 1;
        g.notice('LOCOMOTION DISABLED', 0.8);
      }
    }
    if (!e.d.boss && (weapon.id === 'breach' || weapon.explosive || weapon.stagger)) {
      e.stun = Math.max(e.stun, weapon.stagger || 0.4);
      e.warn = 0;
    }
    g.fx.impact(
      point,
      g.player.position.clone().sub(point).normalize(),
      part === 'shield'
        ? 'shield'
        : armorHit
          ? 'metal'
          : e.d.faction === 'choir'
            ? 'metal'
            : e.d.faction,
    );
    g.ui.hit(weak ? 'weak' : armorHit || part === 'shield' ? 'armor' : 'normal');
    g.audio.hit(weak);
    g.ui.targetInfo = {
      name: e.d.name,
      hp: Math.max(0, e.hp),
      max: e.d.hp,
      part: weak
        ? e.d.faction === 'brood'
          ? 'VITAL POINT'
          : 'SENSOR'
        : armorHit
          ? 'ARMOR'
          : part.toUpperCase(),
      until: g.elapsed + 1.5,
    };
    g.stats.damage += Math.min(actual, Math.max(0, e.hp + actual));
    if (weak) g.stats.weak++;
    if (e.hp <= 0) this.kill(e);
    return actual;
  }
  kill(e) {
    if (!e.alive) return;
    e.alive = false;
    const g = this.game,
      p = e.root.position.clone().add(new THREE.Vector3(0, e.d.height * 0.5, 0));
    g.fx.burst(p, 0xffb45c, e.d.boss ? 60 : e.type === 'bastion' ? 40 : 23, e.d.boss ? 15 : 6);
    g.fx.burst(p, 0x87968c, 15, 5);
    g.audio.explosion(p.distanceTo(g.player.position));
    g.fx.ragdolls.spawn(e, e.deathImpulse || new THREE.Vector3(0, 2, 1));
    g.world.scene.remove(e.root);
    for (const m of e.meshes) if (m.userData.ownedMaterial) m.material.dispose();
    if (e.rotor) e.rotor.geometry.dispose();
    if (e.zone) {
      e.zone.geometry.dispose();
      e.zone.material.dispose();
    }
    g.fx.debris(p, e.d.color, e.d.boss ? 14 : 8);
    g.fx.smoke(p, e.d.boss ? 4 : 2);
    g.stats.kills++;
    if (e.d.boss) g.stats.bosses = (g.stats.bosses || 0) + 1;
    g.stats.score += Math.round(e.d.reward * (e.elite ? 1.5 : 1) * e.rewardScale);
    const scrap = Math.round(e.d.reward * 0.45 * e.rewardScale);
    g.scrap = (g.scrap || 0) + scrap;
    g.stats.scrapEarned = (g.stats.scrapEarned || 0) + scrap;
    if (e.elite) g.stats.elites = (g.stats.elites || 0) + 1;
    g.ui.hit('kill');
    g.audio.kill();
    g.ui.addKill?.(e.d.name, scrap);
    g.player.armor = Math.min(50, g.player.armor + 2);
    this.targets = this.targets.filter((m) => m.userData.enemy !== e);
    if (e.type === 'volatile' || e.d.deathBlast)
      g.projectiles.explode(p, e.d.damage * g.difficulty.damage, e.d.deathBlast || 3, false);
  }
  updateBoss(e, dt, origin, distance) {
    if (e.d.faction !== 'choir') return updateFactionBoss(this, e, dt, origin, distance);
    if (e.type === 'architect') return updateArchitect(this, e, dt, origin, distance);
    const g = this.game;
    e.cycle += dt * (e.hp < e.d.hp * 0.5 ? 1.12 : 1);
    if (e.cycle >= 14) {
      e.cycle = 0;
      e.volleyFired = false;
      e.slamFired = false;
      e.warn = 0;
    }
    e.zone.visible = e.cycle >= 5.3 && e.cycle < 7;
    e.coreOpen = e.cycle >= 7 && e.cycle < 13;
    e.core.visible = e.coreOpen;
    e.plate.visible = e.armor > 0 && !e.coreOpen;
    if (e.cycle < 2) {
      e.aim = g.world.camera.position.clone();
      e.warn = 2 - e.cycle;
      if (Math.random() < dt * 18) g.fx.trace(origin, e.aim, 0xff765b);
    }
    if (e.cycle >= 2 && !e.volleyFired) {
      e.volleyFired = true;
      e.warn = 0;
      if (e.aim)
        for (const side of [-1, 1]) {
          if (e.components[side < 0 ? 'weaponLeft' : 'weaponRight'] <= 0) continue;
          const muzzle = origin.clone().add(new THREE.Vector3(side * 1.5, 0.2, 0));
          for (const dx of [-1, 0, 1]) {
            const target = e.aim.clone().add(new THREE.Vector3(dx * 1.2, 0, 0));
            g.projectiles.spawn(
              muzzle,
              target.sub(muzzle).normalize(),
              15,
              e.d.damage * g.difficulty.damage,
              false,
              3.3,
            );
          }
        }
      g.audio.alert();
    }
    if (e.cycle >= 5.3 && e.cycle < 7) {
      if (distance < 12) g.notice('CONDUCTOR / SHOCKWAVE — GET CLEAR', 0.2);
      g.fx.burst(e.root.position, 0xffad72, 1, 7);
    }
    if (e.cycle >= 7 && !e.slamFired) {
      e.slamFired = true;
      g.projectiles.explode(
        e.root.position.clone().add(new THREE.Vector3(0, 0.3, 0)),
        45 * g.difficulty.damage,
        9,
        false,
      );
      g.notice('CONDUCTOR / CORE EXPOSED', 2.5);
    }
    const stage = e.hp < e.d.hp * 0.35 ? 2 : e.hp < e.d.hp * 0.7 ? 1 : 0;
    if (stage > e.reinforced) {
      e.reinforced = stage;
      for (const type of ['skitter', 'mender']) {
        if (this.list.length >= 24) break;
        const p = g.map.spawns.find((p) => p.distanceTo(g.player.position) > 12) || g.map.spawns[0];
        this.spawn(type, p, true);
      }
      g.notice('CONDUCTOR / REINFORCEMENTS', 1.5);
    }
  }
  update(dt) {
    const g = this.game,
      player = g.player.position,
      eye = g.world.camera.position,
      diff = g.difficulty;
    for (const e of [...this.list]) {
      if (!e.alive) continue;
      const boosted = this.list.some(
        (o) =>
          o !== e &&
          o.type === 'cantor' &&
          o.d.faction === e.d.faction &&
          o.alive &&
          o.stun <= 0 &&
          o.components.command > 0 &&
          o.root.position.distanceTo(e.root.position) < 12,
      );
      e.attack -= dt * diff.aggression * (e.elite ? 1.15 : 1) * (boosted ? 1.2 : 1);
      e.slow = Math.max(0, e.slow - dt);
      e.stun = Math.max(0, e.stun - dt);
      e.repath -= dt;
      e.phase += dt * e.d.speed * 3;
      const p = e.root.position,
        delta = player.clone().sub(p),
        distance = Math.max(0.01, delta.length()),
        origin = p.clone().add(new THREE.Vector3(0, e.d.height * 0.7, 0));
      e.root.rotation.y = Math.atan2(delta.x, delta.z);
      // Brief backward tilt after taking damage; purely visual, colliders are unaffected.
      e.flinch = Math.max(0, (e.flinch || 0) - dt * 6);
      e.root.rotation.x = -e.flinch * (e.d.boss ? 0.05 : 0.2);
      if (e.d.charger) {
        e.chargeCooldown = Math.max(0, (e.chargeCooldown || 0) - dt);
        if (
          !e.chargeCooldown &&
          e.stun <= 0 &&
          distance > 4 &&
          distance < 16 &&
          Math.abs(delta.y) < 1 &&
          this.visible(origin, eye)
        ) {
          e.chargeCooldown = 7;
          e.chargeWarn = 0.9;
          e.chargeDirection = delta.clone().setY(0).normalize();
          e.chargeHit = false;
        }
        if (e.chargeWarn > 0) {
          e.chargeWarn -= dt;
          if (Math.random() < dt * 12)
            g.fx.trace(origin, origin.clone().addScaledVector(e.chargeDirection, 12), 0xdbd57b);
          if (e.chargeWarn <= 0) e.rush = 0.9;
        } else e.rush = Math.max(0, (e.rush || 0) - dt);
        if (
          e.rush > 0 &&
          !e.chargeHit &&
          e.stun <= 0 &&
          distance < 2.5 &&
          Math.abs(delta.y) < 1.5
        ) {
          g.player.damage(32 * diff.damage, p);
          e.chargeHit = true;
        }
      }
      if (e.type === 'shade' || e.d.cloak)
        for (const m of e.meshes)
          if (m.userData.ownedMaterial)
            m.material.opacity = distance > 9 && e.warn <= 0 && e.attack > 1 ? 0.25 : 1;
      if (
        (e.type === 'fabricator' || (e.d.summons && !e.d.boss)) &&
        e.components.deployer > 0 &&
        e.deployCharges > 0 &&
        e.stun <= 0
      ) {
        e.deployClock -= dt;
        if (e.deployClock <= 0 && this.list.length < 22) {
          let spawned = 0;
          for (const side of [-1, 1]) {
            const location = p.clone().add(new THREE.Vector3(side * 2.6, 0, 1));
            if (
              this.nav.supported(location.x, location.z, location.y) &&
              !g.world.colliders.some(
                (b) =>
                  b.top > location.y + 0.3 &&
                  b.bottom < location.y + 1.2 &&
                  overlaps(location.x, location.z, 0.65, b),
              )
            ) {
              const unit = this.spawn(e.d.summons || 'skitter', location);
              unit.rewardScale = 0.4;
              spawned++;
            }
          }
          if (spawned) e.deployCharges--;
          e.deployClock = 12;
        }
      }
      let destination = player;
      if ((e.type === 'mender' || e.d.healer) && e.components.repair > 0 && e.stun <= 0) {
        const ally = this.list
          .filter((o) => o !== e && o.alive && o.d.faction === e.d.faction && o.hp < o.d.hp)
          .sort((a, b) => p.distanceTo(a.root.position) - p.distanceTo(b.root.position))[0];
        if (ally) {
          destination = ally.root.position;
          const center = destination.clone().add(new THREE.Vector3(0, ally.d.height * 0.6, 0));
          if (p.distanceTo(destination) < 12 && this.visible(origin, center)) {
            ally.hp = Math.min(ally.d.hp, ally.hp + dt * 14);
            if (Math.random() < dt * 12) g.fx.trace(origin, center, 0x84f1c4);
          }
        }
      }
      if (e.repath <= 0) {
        e.sight = this.visible(origin, eye);
        e.path = (e.d.boss ? this.bossNav : e.d.radius > 1 ? this.heavyNav : this.nav).path(
          p,
          destination,
        );
        e.repath = 0.6 + Math.random() * 0.35;
      }
      const ranged = !['melee', 'suicide'].includes(e.d.attack),
        desired =
          e.d.desiredRange ||
          (e.d.boss
            ? 17
            : e.type === 'lancer'
              ? 25
              : e.type === 'bastion'
                ? 18
                : e.type === 'bulwark'
                  ? 8
                  : 13);
      if (e.stun <= 0) {
        let dx = 0,
          dz = 0;
        if (
          (!ranged && distance > 1.3) ||
          distance > desired ||
          !e.sight ||
          Math.abs(p.y - destination.y) > 0.8 ||
          ((e.type === 'mender' || e.d.healer) &&
            destination !== player &&
            p.distanceTo(destination) > 9)
        ) {
          const target = e.path[0] || (Math.abs(p.y - destination.y) < 0.8 ? destination : p),
            d = new THREE.Vector3(target.x - p.x, 0, target.z - p.z);
          if (d.length() < 0.18) e.path.shift();
          d.normalize();
          dx = d.x;
          dz = d.z;
        } else if (ranged && distance < (e.type === 'lancer' ? 17 : 6)) {
          dx = -delta.x / distance;
          dz = -delta.z / distance;
        } else if (ranged && !e.d.boss) {
          const side = e.id % 2 ? 1 : -1;
          dx = (delta.z / distance) * 0.38 * side;
          dz = (-delta.x / distance) * 0.38 * side;
        }
        for (const other of this.list) {
          if (other === e || !other.alive) continue;
          const dist = p.distanceTo(other.root.position);
          if (dist < e.d.radius + other.d.radius + 0.35 && dist > 0.01) {
            dx += ((p.x - other.root.position.x) / dist) * 0.8;
            dz += ((p.z - other.root.position.z) / dist) * 0.8;
          }
        }
        const speed =
          e.d.speed *
          (e.rush > 0 ? 3.5 : e.chargeWarn > 0 ? 0 : 1) *
          (e.legBroken ? 0.4 : 1) *
          (e.elite ? 1.15 : 1) *
          (boosted ? 1.2 : 1) *
          (e.slow > 0 ? 0.55 : 1);
        const oldPosition = p.clone();
        if (e.rush > 0) {
          dx = e.chargeDirection.x;
          dz = e.chargeDirection.z;
        }
        moveBody(
          p,
          dx * speed * dt,
          dz * speed * dt,
          e.d.radius,
          e.d.height,
          g.world.colliders,
          0.4,
          g.map.bounds || 35,
        );
        const floor = floorAt(
          p,
          e.d.radius,
          g.world.colliders,
          0.4,
          g.map.voidFloor ? -Infinity : 0,
        );
        if (
          g.map.voidFloor &&
          (!Number.isFinite(floor) ||
            floor < oldPosition.y - 0.6 ||
            !(e.d.boss ? this.bossNav : e.d.radius > 1 ? this.heavyNav : this.nav).supported(
              p.x,
              p.z,
              p.y,
            ))
        ) {
          p.copy(oldPosition);
          e.repath = 0;
        }
        p.y = Math.max(
          floorAt(p, e.d.radius, g.world.colliders, 0.4, g.map.voidFloor ? -Infinity : 0),
          p.y - 12 * dt,
        );
        for (let n = 0; n < e.limbs.length; n++)
          e.limbs[n].rotation.x = Math.sin(e.phase + n * Math.PI) * 0.35;
      }
      if (e.d.boss) {
        if (e.stun <= 0) this.updateBoss(e, dt, origin, distance);
        continue;
      }
      const armed = e.components.weaponLeft > 0 || e.components.weaponRight > 0;
      if (e.warn > 0) {
        e.warn -= dt;
        if (e.warn <= 0 && armed) {
          const dir = e.aim.clone().sub(origin).normalize();
          for (let shot = 0; shot < (e.d.volley || 1); shot++)
            g.projectiles.spawn(
              origin,
              dir
                .clone()
                .applyAxisAngle(
                  new THREE.Vector3(0, 1, 0),
                  (shot - ((e.d.volley || 1) - 1) / 2) * 0.09,
                ),
              e.d.shotSpeed || (e.type === 'bastion' ? 14 : e.type === 'lancer' ? 42 : 23),
              e.d.damage * diff.damage,
              false,
              e.d.splash || (e.type === 'bastion' ? 3 : 0),
              { color: e.d.shotColor },
            );
          g.audio.enemy(e.type, p, player, g.player.yaw);
          e.attack =
            e.d.interval *
            (e.components.weaponLeft <= 0 || e.components.weaponRight <= 0 ? 1.6 : 1);
        }
      }
      if (e.attack <= 0 && e.warn <= 0 && e.stun <= 0) {
        if (!ranged && distance < 1.8 && Math.abs(player.y - p.y) < 1.5) {
          if (e.d.attack === 'suicide') {
            this.kill(e);
            continue;
          }
          g.player.damage(e.d.damage * diff.damage, p);
          g.fx.trace(origin, eye, 0xff6c43);
          e.attack = e.d.interval;
        } else if (ranged && armed && e.sight && distance < 45) {
          e.warn =
            (e.d.telegraph || (e.type === 'bastion' ? 1 : e.type === 'lancer' ? 1.1 : 0.5)) /
            diff.aggression;
          e.aim = eye
            .clone()
            .add(
              new THREE.Vector3(
                (Math.random() - 0.5) * 1.2 * diff.accuracy,
                0,
                (Math.random() - 0.5) * 1.2 * diff.accuracy,
              ),
            );
        }
      }
      if (e.sensor) e.sensor.scale.setScalar(e.warn > 0 ? 1.4 + Math.sin(g.elapsed * 30) * 0.2 : 1);
      if (
        e.warn > 0 &&
        (e.d.telegraph || ['bastion', 'lancer'].includes(e.type)) &&
        Math.random() < dt * 16
      )
        g.fx.trace(origin, e.aim, e.d.shotColor || (e.type === 'lancer' ? 0xdd95e9 : 0xff6848));
      if (e.hp < e.d.hp * 0.3 && Math.random() < dt * 4) g.fx.smoke(origin, 1);
    }
    this.list = this.list.filter((e) => e.alive);
  }
  clear() {
    for (const e of this.list) {
      this.game.world.scene.remove(e.root);
      for (const m of e.meshes) if (m.userData.ownedMaterial) m.material.dispose();
      if (e.rotor) e.rotor.geometry.dispose();
      if (e.zone) {
        e.zone.geometry.dispose();
        e.zone.material.dispose();
      }
    }
    this.list = [];
    this.targets = [];
  }
}
