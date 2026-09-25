import * as THREE from 'three';
import { clamp, damp } from './core.js';
// Turns parkour events into weight: a sprung camera that dips on landings, tilts into slides and
// rolls off wall kicks, FOV punches, dust, sparks and matching sound. Purely presentational;
// reduced-motion keeps the sounds and particles but removes every camera offset.
const DUST = 0xb9b09a;
export class MovementFeel {
  constructor(player) {
    this.player = player;
    this.hands = null;
    this.reset();
  }
  // Two gloved hands shown only while mantling, gripping the ledge in front of the camera.
  buildHands(world) {
    const hands = new THREE.Group();
    for (const side of [-1, 1]) {
      const hand = new THREE.Group();
      hand.position.set(side * 0.22, 0, 0);
      hand.rotation.z = side * -0.15;
      world.box(0.13, 0.05, 0.15, 0x4d5249, 0, 0, 0, hand);
      for (let n = 0; n < 4; n++)
        world.box(0.028, 0.04, 0.07, 0x4d5249, -0.045 + n * 0.03, -0.015, -0.1, hand);
      world.box(0.12, 0.12, 0.45, 0x2f3b36, 0, -0.06, 0.28, hand).rotation.x = 0.35;
      world.box(0.125, 0.03, 0.25, 0xd88750, 0, -0.0, 0.26, hand).rotation.x = 0.35;
      hands.add(hand);
    }
    hands.visible = false;
    world.camera.add(hands);
    world.viewmodel(hands);
    this.hands = hands;
  }
  reset() {
    this.dip = 0;
    this.dipVelocity = 0;
    this.roll = 0;
    this.rollVelocity = 0;
    this.pitch = 0;
    this.pitchVelocity = 0;
    this.fovKick = 0;
    this.speedFov = 0;
    this.trail = 0;
    this.mantle = 0;
    this.mantleRise = 0;
    this.stepPhase = 0;
    this.stepSide = 1;
    // Viewmodel offsets consumed by weapons.js / melee-class.js.
    this.gun = { x: 0, y: 0, z: 0, pitch: 0, roll: 0 };
    this.swayX = 0;
    this.swayY = 0;
    if (this.hands) this.hands.visible = false;
  }
  get game() {
    return this.player.game;
  }
  feet() {
    return this.player.position.clone().add(new THREE.Vector3(0, 0.08, 0));
  }
  event(type, data) {
    const g = this.game,
      fx = g.fx,
      audio = g.audio;
    if (type === 'jump') {
      this.dipVelocity -= data.slide ? 0.9 : 0.6;
      this.pitchVelocity -= 0.25;
      this.fovKick += data.slide ? 5 : 1.5;
      audio.jump(data.slide ? 1.4 : 1);
      fx?.burst(this.feet(), DUST, data.slide ? 8 : 4, 2);
    } else if (type === 'land') {
      const weight = clamp((data.impact - 3) / 14, 0, 1);
      if (data.impact < 2.5) return;
      this.dipVelocity -= 0.6 + weight * 3.4;
      this.pitchVelocity += 0.4 + weight * 1.6;
      this.gun.y -= 0.02 + weight * 0.06;
      audio.land(data.impact);
      fx?.burst(this.feet(), DUST, 4 + Math.round(weight * 16), 2 + weight * 4);
      if (weight > 0.45) {
        fx?.smoke(this.feet(), 2);
        this.player.shake = Math.max(this.player.shake, 0.04 + weight * 0.06);
      }
    } else if (type === 'slide') {
      this.fovKick += 7;
      this.dipVelocity -= 0.8;
      this.rollVelocity += 0.6 * (this.stepSide || 1);
      audio.burst(0.12, 0.08, 1400, { filter: 'bandpass', sweep: 500 });
      fx?.burst(this.feet(), DUST, 10, 3);
    } else if (type === 'wallKick') {
      // Roll away from the wall we kicked off, relative to the current view.
      const yaw = this.player.yaw,
        right = data.nx * Math.cos(yaw) - data.nz * Math.sin(yaw);
      this.rollVelocity += right * 2.2;
      this.fovKick += 6;
      this.dipVelocity += 0.6;
      audio.wallKick();
      const contact = this.player.position
        .clone()
        .add(new THREE.Vector3(-data.nx * 0.4, 1, -data.nz * 0.4));
      fx?.burst(contact, DUST, 14, 3.5);
      fx?.smoke(contact, 1);
    } else if (type === 'mantle') {
      this.mantle = 0.001;
      this.mantleRise = data.rise;
      this.pitchVelocity += 1.4;
      audio.grab();
    } else if (type === 'mantleEnd') {
      this.dipVelocity -= 1.2;
      this.pitchVelocity -= 0.6;
      audio.step(true);
      fx?.burst(this.feet(), DUST, 6, 2);
    }
  }
  // Critically-ish damped springs: stiff enough to snap back, loose enough to overshoot a touch.
  spring(value, velocity, stiffness, damping, dt) {
    velocity += (-stiffness * value - damping * velocity) * dt;
    return [value + velocity * dt, velocity];
  }
  update(dt) {
    const p = this.player,
      g = this.game,
      parkour = p.parkour,
      speed = Math.hypot(p.velocity.x, p.velocity.z),
      reduced = g.settings.reducedMotion,
      input = g.input;
    // Integrate springs in small steps so large frames stay stable.
    const steps = Math.ceil(dt / 0.008);
    for (let n = 0; n < steps; n++) {
      const h = dt / steps;
      [this.dip, this.dipVelocity] = this.spring(this.dip, this.dipVelocity, 170, 15, h);
      [this.roll, this.rollVelocity] = this.spring(this.roll, this.rollVelocity, 90, 12, h);
      [this.pitch, this.pitchVelocity] = this.spring(this.pitch, this.pitchVelocity, 120, 14, h);
    }
    this.dip = clamp(this.dip, -0.5, 0.25);
    this.fovKick = damp(this.fovKick, 0, 5, dt);
    this.speedFov = damp(this.speedFov, clamp((speed - 8.2) * 1.6, 0, 11), 6, dt);
    // Slides lean into the direction you steer; strafing adds a subtle lean everywhere.
    const strafe = Number(input.down('KeyD')) - Number(input.down('KeyA')),
      sliding = parkour.slide > 0,
      lean = sliding ? -0.05 - strafe * 0.04 : p.grounded ? -strafe * 0.012 : -strafe * 0.02;
    this.leanRoll = damp(this.leanRoll || 0, lean, 8, dt);
    // Footsteps land at the bottom of each head-bob cycle, heavier while sprinting.
    const phase = Math.floor(p.bob / Math.PI);
    if (phase !== this.stepPhase) {
      this.stepPhase = phase;
      if (p.grounded && !sliding && speed > 1) {
        this.stepSide *= -1;
        g.audio.step(p.sprint, this.stepSide * 0.15);
        if (p.sprint) this.dipVelocity -= 0.25;
      }
    }
    // Slide trail and sound.
    if (sliding) {
      this.trail -= dt;
      if (this.trail <= 0) {
        this.trail = 0.035;
        const f = this.feet();
        g.fx?.burst(f, DUST, 2, 1.4);
        if (speed > 9) g.fx?.burst(f, 0xffc27a, 1, 2.5);
      }
    }
    g.audio.loop('slide', sliding ? 0.05 + clamp(speed / 11, 0, 1) * 0.07 : 0, 900 + speed * 110);
    const airSpeed = Math.hypot(speed, p.velocity.y);
    g.audio.loop('wind', clamp((airSpeed - 7) / 10, 0, 1) * 0.06, 400 + airSpeed * 60);
    // Mantle: hands appear gripping the ledge and push down as the body rises.
    if (this.mantle > 0) {
      this.mantle = parkour.mantle ? parkour.mantle.time / 0.38 : 0;
      if (!parkour.mantle) this.mantle = 0;
    }
    if (this.hands) {
      this.hands.visible = this.mantle > 0;
      const t = this.mantle;
      this.hands.position.set(0, -0.05 - t * 0.55, -0.55 + t * 0.12);
      this.hands.rotation.x = -0.25 - t * 0.5;
    }
    // Weapon sway lags behind mouse look; bob, dip and slide cant layer on top.
    this.swayX = damp(this.swayX, clamp(-input.dx * 0.0009, -0.06, 0.06), 10, dt);
    this.swayY = damp(this.swayY, clamp(input.dy * 0.0009, -0.05, 0.05), 10, dt);
    const gun = this.gun;
    gun.x = damp(gun.x, this.swayX + (sliding ? -0.05 : 0), 12, dt);
    gun.y = damp(gun.y, this.dip * 0.5 + this.swayY - (p.grounded ? 0 : 0.02), 12, dt);
    gun.z = damp(gun.z, sliding ? 0.06 : 0, 10, dt);
    gun.roll = damp(gun.roll, (sliding ? 0.35 : 0) + this.roll * 2 - this.swayX * 3, 10, dt);
    gun.pitch = damp(gun.pitch, this.pitch * 0.6 + this.swayY * 2, 12, dt);
    if (reduced) {
      this.dip = this.roll = this.pitch = this.leanRoll = this.fovKick = this.speedFov = 0;
      gun.roll = gun.pitch = gun.x = 0;
    }
    const melee = g.meleeClass?.root;
    if (melee) {
      melee.position.set(gun.x, gun.y, gun.z);
      melee.rotation.set(gun.pitch, 0, gun.roll * 0.6);
    }
    if (g.world.post)
      g.world.post.uniforms.uSpeed.value = reduced ? 0 : clamp((speed - 8.5) / 6, 0, 1);
  }
  // Camera offsets applied by Player.update.
  get cameraY() {
    return this.dip * 0.45;
  }
  get cameraPitch() {
    return -this.pitch * 0.15;
  }
  get cameraRoll() {
    return this.roll * 0.2 + (this.leanRoll || 0);
  }
  get fov() {
    return this.fovKick + this.speedFov;
  }
}
