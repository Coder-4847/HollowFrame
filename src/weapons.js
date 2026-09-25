import { modifier } from './upgrades.js';
import * as THREE from 'three';
import { WEAPONS } from './data.js';
import { damp } from './core.js';
import { MELEE } from './content.js';
export class Weapons {
  constructor(game) {
    this.game = game;
    this.root = new THREE.Group();
    game.world.camera.add(this.root);
    // Always present (intensity 0 when idle) so shaders never recompile mid-fight.
    this.light = new THREE.PointLight(0xffb66b, 0, 9, 2);
    this.light.position.set(0.25, -0.1, -1.2);
    game.world.camera.add(this.light);
    this.ray = new THREE.Raycaster();
    this.reset();
  }
  get current() {
    return WEAPONS[this.index];
  }
  get ammo() {
    return this.ammoList[this.index];
  }
  get aiming() {
    if (this.game.meleeClass?.active) return false;
    return this.game.input.aim && !this.game.player.sprint && !this.game.player.parkour?.mantle;
  }
  reset() {
    this.equipped = this.game.save.loadout.map((id) => WEAPONS.findIndex((w) => w.id === id));
    this.index = this.equipped[0];
    this.burstRemaining = 0;
    this.chargeTime = 0;
    this.heatDelay = 0;
    this.ammoList = WEAPONS.map((w) => ({
      mag: w.mag,
      reserve: Math.round(w.reserve * (this.game.difficulty?.ammo || 1)),
      heat: 0,
      overheated: false,
    }));
    this.cooldown = 0;
    this.reloadTime = 0;
    this.recoil = 0;
    this.kickDebt = 0;
    if (this.light) this.light.intensity = 0;
    this.switchTime = 0;
    this.meleeTime = 0;
    this.flashTime = 0;
    this.regen = 0;
    this.build();
  }
  build() {
    this.root.clear();
    this.bolt = null;
    const w = this.game.world,
      d = this.current;
    const add = (a, b, c, color, x, y, z) => w.box(a, b, c, color, x, y, z, this.root);
    add(0.22, 0.23, d.length * 0.55, 0x344340, 0, 0, 0);
    add(0.28, 0.09, d.length * 0.65, d.color, 0, 0.14, 0);
    add(0.09, 0.09, d.length * 0.6, 0x242f2d, 0, 0.05, -d.length * 0.45);
    add(0.12, 0.3, 0.18, 0x26312f, 0, -0.22, 0.1);
    add(0.08, 0.05, 0.08, 0xb7d9be, 0, 0.22, -0.2);
    add(0.07, 0.06, 0.04, 0x141f1b, 0, 0.21, 0.18);
    this.bolt = add(0.055, 0.07, 0.2, 0x94a69a, 0.15, 0.025, 0.03);
    this.magazine = add(0.12, 0.35, 0.15, 0x766c4f, 0, -0.28, -0.1);
    add(0.07, 0.035, 0.23, 0x93c7b1, 0.15, 0.09, 0.02);
    for (let n = 0; n < 5; n++) {
      add(0.285, 0.025, 0.025, 0x253630, 0, 0.195, -0.25 + n * 0.08);
      add(0.02, 0.045, 0.035, 0x142921, 0.145, 0.08, -0.2 + n * 0.06);
    }
    add(0.025, 0.12, 0.075, 0xd88750, 0.16, -0.015, 0.14);
    if (d.id === 'needle' || d.id === 'lance') {
      add(0.12, 0.13, 0.4, 0x26332f, 0, 0.28, 0);
      add(0.09, 0.09, 0.02, 0x85ddc8, 0, 0.28, 0.21);
    }
    if (d.id === 'breach') {
      for (const x of [-0.085, 0.085]) add(0.095, 0.095, 0.72, 0x55625a, x, 0.02, -0.42);
      this.pump = add(0.24, 0.14, 0.25, 0x7e6950, 0, -0.025, -0.35);
    } else this.pump = null;
    if (['verdict', 'anvil'].includes(d.id)) {
      for (let n = 0; n < 6; n++) {
        const a = (n * Math.PI) / 3;
        add(0.08, 0.08, 0.2, 0xa1997c, Math.cos(a) * 0.11, Math.sin(a) * 0.11, -0.06);
      }
    }
    if (d.explosive) {
      add(0.35, 0.33, 0.85, 0x666d48, 0, 0.05, -0.2);
      add(0.4, 0.4, 0.1, 0x222f27, 0, 0.05, -0.65);
    }
    if (d.energy) {
      for (let n = 0; n < 4; n++) {
        const coil = add(0.32, 0.045, 0.065, 0x73cbe2, 0, 0.16, -0.28 + n * 0.14);
        coil.userData.coil = true;
      }
      add(0.12, 0.2, 0.25, 0x354a63, 0, -0.17, -0.18);
    }
    if (d.id === 'ballast') add(0.42, 0.32, 0.28, 0x5f6854, 0, -0.25, -0.08);
    if (d.id === 'mortar')
      for (const x of [-0.14, 0.14]) add(0.12, 0.16, 0.3, 0x879776, x, -0.1, -0.25);
    if (d.category === 'secondary') {
      this.root.scale.setScalar(0.58);
    }
    // Gloved hands and armored forearms, deliberately angular.
    add(0.19, 0.22, 0.28, 0x70786a, 0.07, -0.2, 0.22);
    add(0.2, 0.23, 0.48, 0x303e37, 0.13, -0.27, 0.5);
    add(0.18, 0.19, 0.22, 0x70786a, -0.14, -0.17, -0.2);
    add(0.18, 0.2, 0.42, 0x303e37, -0.24, -0.27, 0.03);
    this.blade = add(0.045, 0.55, 0.07, 0x9cddca, -0.3, 0.25, -0.15);
    this.blade.visible = false;
    this.hammer = add(0.48, 0.23, 0.22, 0x829790, -0.3, 0.49, -0.15);
    this.hammer.visible = false;
    this.flash = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.42, 5),
      new THREE.MeshBasicMaterial({ color: 0xffd7a1 }),
    );
    this.flash.rotation.x = -Math.PI / 2;
    this.flash.position.set(0, 0.05, -d.length * 0.8);
    this.flash.visible = false;
    this.root.add(this.flash);
    this.root.scale.setScalar(d.category === 'secondary' ? 0.58 : 0.65);
    this.root.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = false;
        m.receiveShadow = false;
        m.renderOrder = 10;
        if (m !== this.flash) m.material = m.material.clone();
        if (m.userData.coil) {
          m.material.emissive.set(0x4eb0ca);
          m.material.emissiveIntensity = 0.8;
        }
        m.material.depthTest = false;
      }
    });
  }
  switch(index) {
    if (index === this.index || !this.equipped.includes(index)) return;
    this.burstRemaining = 0;
    this.chargeTime = 0;
    this.disposeModel();
    this.index = (index + WEAPONS.length) % WEAPONS.length;
    this.reloadTime = 0;
    this.switchTime = 0.24;
    this.cooldown = 0.24;
    this.build();
    this.game.audio.tone(180, 0.08, 0.05, 'triangle', 300);
  }
  disposeModel() {
    this.root.traverse((m) => {
      if (m.isMesh) m.material.dispose();
    });
    if (this.flash) this.flash.geometry.dispose();
  }
  reload() {
    if (this.current.energy) {
      if (this.ammo.heat > 0 && this.reloadTime <= 0) {
        this.reloadTime = this.current.reload * modifier(this.game.upgrades, 'loader', -0.18);
        this.game.audio.tone(700, 0.25, 0.09, 'sine', 150);
      }
      return;
    }
    this.burstRemaining = 0;
    this.chargeTime = 0;
    if (this.reloadTime > 0 || this.ammo.mag === this.current.mag || this.ammo.reserve <= 0) return;
    this.reloadTime = this.current.reload * modifier(this.game.upgrades, 'loader', -0.18);
    this.game.audio.tone(280, 0.12, 0.08, 'square', 120);
  }
  resupply() {
    for (let n = 0; n < WEAPONS.length; n++) {
      this.ammoList[n].mag = WEAPONS[n].mag;
      this.ammoList[n].reserve = Math.round(WEAPONS[n].reserve * (this.game.difficulty?.ammo || 1));
      this.ammoList[n].heat = 0;
      this.ammoList[n].overheated = false;
    }
    this.reloadTime = 0;
  }
  fire() {
    if (this.game.meleeClass?.active) return;
    const g = this.game,
      d = this.current;
    if (this.current.energy && this.ammo.overheated) return;
    if (!d.energy && this.ammo.mag <= 0) {
      this.reload();
      return;
    }
    if (d.energy) {
      this.ammo.heat = Math.min(100, this.ammo.heat + d.heatPerShot);
      this.ammo.overheated = this.ammo.heat >= 100;
      this.heatDelay = 0.5;
    } else this.ammo.mag--;
    this.cooldown = 1 / d.rate;
    if (d.burst) {
      this.burstRemaining = Math.max(0, this.burstRemaining - 1);
      if (this.burstRemaining === 0) this.cooldown = d.burstDelay;
    }
    this.recoil = Math.min(
      0.25,
      this.recoil + d.recoil * 2.3 * modifier(g.upgrades, 'stabilizer', -0.2),
    );
    this.flashTime = 0.05;
    if (!g.settings.reducedMotion) {
      this.light.color.set(d.energy ? 0x7fd8ff : 0xffb66b);
      this.light.intensity = d.explosive ? 26 : d.pellets > 1 ? 22 : 14;
    }
    const kick = d.recoil * (g.input.aim ? 0.5 : 1) * modifier(g.upgrades, 'stabilizer', -0.2);
    g.player.pitch += kick;
    g.player.yaw += (Math.random() - 0.5) * kick * 0.45;
    // Most of the climb settles back; sustained fire still drifts upward.
    this.kickDebt += kick * 0.65;
    g.audio.fire(d);
    g.stats.shots++;
    g.stats.usage[this.index] = (g.stats.usage[this.index] || 0) + 1;
    const origin = g.world.camera.position.clone();
    const direction = new THREE.Vector3();
    g.world.camera.getWorldDirection(direction);
    const muzzle = origin
      .clone()
      .addScaledVector(direction, 0.75)
      .add(new THREE.Vector3(0.12, -0.15, 0));
    this.flash.updateWorldMatrix(true, false);
    muzzle.copy(this.flash.getWorldPosition(new THREE.Vector3()));
    g.fx.muzzle(muzzle, direction, !!d.energy);
    if (d.explosive) {
      if (d.gravity) direction.y += 0.1;
      g.projectiles.spawn(
        origin,
        direction.normalize(),
        d.speed || 32,
        d.damage,
        true,
        d.explosive * modifier(g.upgrades, 'payload', 0.15),
        { gravity: d.gravity || 0, fuse: d.fuse || 7, cluster: !!d.cluster },
      );
      return;
    }
    let connected = false;
    for (let n = 0; n < d.pellets; n++) {
      const spread = d.spread * (g.input.aim ? 0.42 : 1) * (g.player.sprint ? 2 : 1),
        dir = direction
          .clone()
          .add(
            new THREE.Vector3(
              (Math.random() - 0.5) * spread,
              (Math.random() - 0.5) * spread,
              (Math.random() - 0.5) * spread,
            ),
          )
          .normalize();
      this.ray.set(origin, dir);
      this.ray.far = d.range;
      const hits = this.ray
        .intersectObjects([...g.enemies.targets, ...g.world.solids], false)
        .filter((h) => h.object.visible);
      const h = hits[0];
      const end = h ? h.point : origin.clone().addScaledVector(dir, d.range);
      g.fx.trace(
        muzzle,
        end,
        d.energy || d.id === 'needle' || d.id === 'lance' ? 0x99eeff : 0xffd3a0,
      );
      const struck = new Set();
      for (const collision of hits) {
        const { enemy, part } = collision.object.userData;
        if (!enemy) {
          const normal =
            collision.face?.normal.clone().transformDirection(collision.object.matrixWorld) ||
            dir.clone().negate();
          g.fx.impact(collision.point, normal, 'metal');
          break;
        }
        if (struck.has(enemy)) continue;
        struck.add(enemy);
        g.enemies.hit(enemy, part, d, collision.point, collision.distance);
        connected = true;
        if (struck.size >= (d.pierce || 1)) break;
        g.fx.trace(muzzle, collision.point, 0xa9f5ed);
      }
    }
    if (connected) g.stats.hits++;
    g.fx.burst(muzzle, 0xbaa777, 1, 1);
  }
  melee() {
    if (this.meleeTime > 0) return;
    const g = this.game;
    const melee = MELEE[g.save.melee];
    this.meleeTime = melee.cooldown;
    this.recoil = 0.2;
    g.audio.tone(g.save.melee === 'hammer' ? 60 : 120, 0.2, 0.15, 'sawtooth', 450);
    const dir = new THREE.Vector3();
    g.world.camera.getWorldDirection(dir);
    let hit = false;
    for (const e of [...g.enemies.list]) {
      const p = e.root.position.clone().add(new THREE.Vector3(0, e.d.height * 0.6, 0)),
        v = p.clone().sub(g.world.camera.position);
      if (
        v.length() < melee.range &&
        dir.dot(v.normalize()) > 0.55 &&
        g.enemies.visible(g.world.camera.position, p)
      ) {
        g.enemies.hit(
          e,
          'body',
          { damage: melee.damage, range: 5, penetration: 0.6, weak: 1, stagger: melee.stagger },
          p,
          0,
        );
        hit = true;
      }
    }
    g.notice(melee.name + (hit ? ' / IMPACT' : ''), 0.55);
  }
  update(dt) {
    if (this.game.meleeClass?.active) {
      this.root.visible = false;
      this.game.meleeClass.update(dt);
      return;
    }
    const g = this.game,
      i = g.input,
      d = this.current;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.meleeTime = Math.max(0, this.meleeTime - dt);
    this.switchTime = Math.max(0, this.switchTime - dt);
    this.flashTime -= dt;
    if (this.reloadTime > 0) {
      this.reloadTime -= dt;
      if (this.reloadTime <= 0) {
        if (d.energy) {
          this.ammo.heat = 0;
          this.ammo.overheated = false;
        }
        const count = d.energy ? 0 : Math.min(d.mag - this.ammo.mag, this.ammo.reserve);
        this.ammo.mag += count;
        this.ammo.reserve -= count;
        g.audio.tone(350, 0.09, 0.08, 'square', 170);
      }
    }
    for (let n = 0; n < this.equipped.length; n++)
      if (i.tap('Digit' + (n + 1))) this.switch(this.equipped[n]);
    if (i.wheel)
      this.switch(
        this.equipped[
          (this.equipped.indexOf(this.index) + i.wheel + this.equipped.length) %
            this.equipped.length
        ],
      );
    if (i.tap('KeyR')) this.reload();
    if ((i.tap('KeyV') || i.tap('KeyF')) && !g.player.parkour?.mantle) this.melee();
    this.heatDelay = Math.max(0, this.heatDelay - dt);
    for (let n = 0; n < WEAPONS.length; n++)
      if (WEAPONS[n].energy) {
        const ammo = this.ammoList[n];
        if (this.heatDelay <= 0 || n !== this.index) ammo.heat = Math.max(0, ammo.heat - dt * 22);
        if (ammo.heat < 35) ammo.overheated = false;
        ammo.mag = Math.ceil(100 - ammo.heat);
      }
    const ready =
      this.cooldown <= 0 &&
      this.reloadTime <= 0 &&
      this.meleeTime <= 0.25 &&
      !g.player.sprint &&
      !g.player.parkour?.mantle;
    if (this.current.charge) {
      if (i.fire && ready) {
        this.chargeTime += dt;
        if (this.chargeTime >= this.current.charge) {
          this.fire();
          this.chargeTime = 0;
        }
      } else if (!i.fire) this.chargeTime = 0;
    } else if (ready) {
      if (this.burstRemaining > 0) this.fire();
      else if (this.current.auto ? i.fire || i.shot : i.shot) {
        if (this.current.burst) this.burstRemaining = this.current.burst;
        this.fire();
      }
    }
    this.regen += dt;
    if (this.regen > 1.5) {
      this.regen = 0;
      this.ammoList[4].reserve = Math.min(72, this.ammoList[4].reserve + 1);
    }
    this.recoil = damp(this.recoil, 0, 13, dt);
    this.light.intensity = damp(this.light.intensity, 0, 38, dt);
    const settle = this.kickDebt * (1 - Math.exp(-9 * dt));
    this.kickDebt -= settle;
    g.player.pitch -= settle;
    this.magazine.position.y =
      -0.28 -
      (this.reloadTime > 0 && !this.current.energy
        ? Math.sin(
            Math.min(
              1,
              this.reloadTime / (this.current.reload * modifier(g.upgrades, 'loader', -0.18)),
            ) * Math.PI,
          ) * 0.22
        : 0);
    this.magazine.rotation.z = this.reloadTime > 0 ? 0.15 : 0;
    const ads = this.aiming,
      // Keep solid sights below the reticle, with extra room for scope housings and launchers.
      aimHeight = ['needle', 'lance'].includes(this.current.id)
        ? -0.34
        : this.current.explosive
          ? -0.29
          : -0.23,
      move = Math.hypot(g.player.velocity.x, g.player.velocity.z),
      bob = g.settings.reducedMotion
        ? 0
        : Math.sin(g.player.bob) * 0.016 * Math.min(1, move / 4) * (ads ? 0.15 : 1),
      visualRecoil = this.recoil * (ads ? 0.25 : 1);
    this.root.position.x = damp(this.root.position.x, ads ? 0 : 0.32, 15, dt);
    this.root.position.y = damp(
      this.root.position.y,
      (ads ? aimHeight : -0.32) +
        bob -
        (this.reloadTime > 0 || g.player.parkour?.mantle ? 0.25 : 0) -
        this.switchTime,
      14,
      dt,
    );
    this.root.position.z = -0.8 + visualRecoil;
    this.root.rotation.set(
      visualRecoil + (g.player.sprint ? -0.35 : 0),
      g.player.sprint ? 0.3 : 0,
      (this.reloadTime > 0 ? -0.5 : 0) + (this.meleeTime > 0.4 ? -0.9 : 0) + bob * 0.4,
    );
    this.blade.visible = this.meleeTime > 0.35;
    this.hammer.visible = this.blade.visible && g.save.melee === 'hammer';
    this.flash.visible = false;
    this.bolt.position.z = 0.03 + this.recoil * 0.5;
    if (this.pump)
      this.pump.position.z =
        -0.35 + Math.sin(Math.min(1, this.cooldown * this.current.rate) * Math.PI) * 0.12;
    this.flash.rotation.z = Math.random() * Math.PI;
  }
}
