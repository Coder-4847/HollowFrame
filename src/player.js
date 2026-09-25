import { Parkour } from './movement.js';
import { MovementFeel } from './feel.js';
import * as THREE from 'three';
import { clamp, damp } from './core.js';
import { modifier } from './upgrades.js';
export class Player {
  constructor(game) {
    this.game = game;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.feel = new MovementFeel(this);
    this.feel.buildHands(game.world);
    this.reset();
  }
  reset() {
    this.position.copy(this.game.map.start);
    this.velocity.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.hp = 100;
    this.armor = 50;
    this.grounded = true;
    this.eye = 1.72;
    this.bob = 0;
    this.hurt = 0;
    this.shake = 0;
    this.sprint = false;
    this.crouch = false;
    this.feel.reset();
    if (this.parkour) this.parkour.reset();
    else this.parkour = new Parkour(this);
  }
  update(dt) {
    const g = this.game,
      i = g.input,
      s = g.settings;
    this.yaw -= i.dx * 0.002 * s.sensitivity;
    this.pitch = clamp(
      this.pitch - i.dy * 0.002 * s.sensitivity * (s.invertY ? -1 : 1),
      -1.48,
      1.48,
    );
    this.parkour.update(dt);
    this.feel.update(dt);
    this.eye = damp(this.eye, this.crouch ? 1 : 1.72, 14, dt);
    this.bob += dt * Math.hypot(this.velocity.x, this.velocity.z) * 1.7;
    this.hurt = Math.max(0, this.hurt - dt);
    this.shake = damp(this.shake, 0, 12, dt);
    const moving =
        Math.hypot(this.velocity.x, this.velocity.z) > 1 &&
        this.grounded &&
        this.parkour.slide <= 0,
      feel = this.feel,
      c = g.world.camera;
    c.position.copy(this.position);
    c.position.y +=
      this.eye +
      feel.cameraY +
      (moving && !s.reducedMotion ? Math.abs(Math.sin(this.bob)) * 0.045 - 0.02 : 0);
    c.rotation.set(
      this.pitch +
        feel.cameraPitch +
        (Math.random() - 0.5) * this.shake * (s.reducedMotion ? 0 : s.shake),
      this.yaw,
      feel.cameraRoll + (Math.random() - 0.5) * this.shake * (s.reducedMotion ? 0 : s.shake) * 0.25,
    );
    const fov = g.weapons.aiming
      ? g.weapons.current.id === 'needle'
        ? 39
        : 58
      : s.fov + (this.sprint && !s.reducedMotion ? 6 : 0) + feel.fov;
    c.fov = damp(c.fov, fov, 12, dt);
    c.updateProjectionMatrix();
    if (i.tap('KeyQ')) g.useEquipment();
    if (i.tap('KeyB')) g.openUpgrades();
    if (i.tap('KeyE')) {
      if (g.waves.breakTime > 0) g.waves.next();
      else if (g.map.hazards?.length && this.position.distanceTo(g.map.station) < 5) {
        if (g.quenchCooldown <= 0) {
          g.quenchTime = 12;
          g.quenchCooldown = 30;
          g.notice('DISCHARGE GRID QUENCHED / 12s', 2);
          g.audio.alert();
        } else g.notice('QUENCH RECHARGING / ' + Math.ceil(g.quenchCooldown) + 's', 1);
      } else if (this.position.distanceTo(g.map.station) < 4)
        g.notice('RESUPPLY OFFLINE / Clear this wave', 2);
    }
  }
  damage(amount, from, unblockable = false) {
    if (this.game.state !== 'playing' || this.hp <= 0) return;
    if (!unblockable) amount = this.game.meleeClass?.defend(amount, from) ?? amount;
    if (amount <= 0) return;
    amount *= modifier(this.game.upgrades, 'plating', -0.1);
    this.game.stats.damageTaken = (this.game.stats.damageTaken || 0) + amount;
    const absorb = Math.min(this.armor, amount * 0.65);
    this.armor -= absorb;
    this.hp = Math.max(0, this.hp - (amount - absorb));
    if (this.hurt <= 0) this.game.audio.burst(0.1, 0.1, 500);
    this.hurt = 0.4;
    this.shake = 0.055;
    if (from) {
      const angle = Math.atan2(from.x - this.position.x, from.z - this.position.z);
      this.game.ui.damageAngle = -angle - this.yaw + Math.PI;
    }
    if (this.hp <= 0) this.game.finish(false);
  }
}
