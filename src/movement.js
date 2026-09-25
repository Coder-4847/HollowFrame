import { clamp, damp, overlaps, moveBody, floorAt } from './core.js';
import { modifier } from './upgrades.js';
export const MOVEMENT = Object.freeze({
  radius: 0.38,
  standing: 1.8,
  crouched: 1.1,
  gravity: 21,
  jump: 7,
  slideSpeed: 11,
  slideDuration: 0.8,
  slideCooldown: 1,
  wallPush: 8,
  wallLift: 7.6,
  wallJumps: 2,
  mantleReach: 0.95,
  mantleHeight: 2,
  mantleDuration: 0.38,
  coyote: 0.1,
  buffer: 0.12,
});
export function bodyFits(pos, height, boxes) {
  return !boxes.some(
    (b) =>
      b.top > pos.y + 0.02 &&
      b.bottom < pos.y + height - 0.02 &&
      overlaps(pos.x, pos.z, MOVEMENT.radius, b),
  );
}
export function wallContact(pos, boxes) {
  let best = null;
  for (const b of boxes) {
    if (b.top <= pos.y + 0.5 || b.bottom >= pos.y + 1.1) continue;
    const faces = [
      { nx: -1, nz: 0, gap: b.x - b.w / 2 - pos.x, along: Math.abs(pos.z - b.z) <= b.d / 2 },
      { nx: 1, nz: 0, gap: pos.x - b.x - b.w / 2, along: Math.abs(pos.z - b.z) <= b.d / 2 },
      { nx: 0, nz: -1, gap: b.z - b.d / 2 - pos.z, along: Math.abs(pos.x - b.x) <= b.w / 2 },
      { nx: 0, nz: 1, gap: pos.z - b.z - b.d / 2, along: Math.abs(pos.x - b.x) <= b.w / 2 },
    ];
    for (const f of faces)
      if (
        f.along &&
        f.gap >= MOVEMENT.radius - 0.06 &&
        f.gap <= MOVEMENT.radius + 0.16 &&
        (!best || f.gap < best.gap)
      )
        best = { ...f, box: b };
  }
  return best;
}
export function mantleTarget(pos, yaw, boxes) {
  const dx = -Math.sin(yaw),
    dz = -Math.cos(yaw),
    r = MOVEMENT.radius;
  for (const b of boxes) {
    const rise = b.top - pos.y;
    if (rise < 0.45 || rise > MOVEMENT.mantleHeight || b.w < r * 2 + 0.1 || b.d < r * 2 + 0.1)
      continue;
    const probe = { x: pos.x + dx * MOVEMENT.mantleReach, z: pos.z + dz * MOVEMENT.mantleReach };
    if (!overlaps(probe.x, probe.z, 0.05, b)) continue;
    const target = {
      x: clamp(probe.x, b.x - b.w / 2 + r + 0.04, b.x + b.w / 2 - r - 0.04),
      y: b.top,
      z: clamp(probe.z, b.z - b.d / 2 + r + 0.04, b.z + b.d / 2 - r - 0.04),
    };
    if (Math.hypot(target.x - pos.x, target.z - pos.z) > 1.5) continue;
    // Check the entire lift-then-traverse path, including ceilings and adjacent cover.
    let clear = true;
    for (let n = 0; n <= 20; n++)
      if (!bodyFits(mantlePoint(pos, target, n / 20), MOVEMENT.standing, boxes)) {
        clear = false;
        break;
      }
    if (clear) return target;
  }
  return null;
}
export function mantlePoint(start, end, t) {
  const lift = clamp(t / 0.55, 0, 1),
    travel = clamp((t - 0.55) / 0.45, 0, 1),
    ease = travel * travel * (3 - 2 * travel);
  return {
    x: start.x + (end.x - start.x) * ease,
    y: start.y + (end.y - start.y) * lift,
    z: start.z + (end.z - start.z) * ease,
  };
}
export class Parkour {
  constructor(player) {
    this.player = player;
    this.reset();
  }
  reset() {
    this.slide = 0;
    this.cooldown = 0;
    this.coyote = 0;
    this.buffer = 0;
    this.momentum = 0;
    this.kicks = 0;
    this.lastWall = null;
    this.wallLock = 0;
    this.mantle = null;
    this.label = '';
  }
  update(dt) {
    const p = this.player,
      g = p.game,
      i = g.input,
      boxes = g.world.colliders,
      m = MOVEMENT;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.wallLock = Math.max(0, this.wallLock - dt);
    this.momentum = Math.max(0, this.momentum - dt);
    this.buffer = i.tap('Space') ? m.buffer : Math.max(0, this.buffer - dt);
    this.coyote = p.grounded ? m.coyote : Math.max(0, this.coyote - dt);
    const wants = g.settings.toggleCrouch
      ? i.crouchToggle
      : i.down('KeyC') || i.down('ControlLeft');
    const headBlocked = !bodyFits(p.position, m.standing, boxes);
    if (this.mantle) {
      const move = this.mantle;
      move.time = Math.min(m.mantleDuration, move.time + dt);
      const next = mantlePoint(move.start, move.end, move.time / m.mantleDuration);
      if (!bodyFits(next, m.standing, boxes)) {
        this.mantle = null;
        this.buffer = 0;
      } else {
        p.position.set(next.x, next.y, next.z);
        p.velocity.set(0, 0, 0);
        p.sprint = false;
        p.crouch = false;
        this.label = 'MANTLING';
        if (move.time >= m.mantleDuration) {
          this.mantle = null;
          p.grounded = true;
          this.kicks = 0;
          this.lastWall = null;
        }
        return;
      }
    }
    const crouchTap = i.tap('KeyC') || i.tap('ControlLeft');
    if (
      crouchTap &&
      wants &&
      p.grounded &&
      p.sprint &&
      Math.hypot(p.velocity.x, p.velocity.z) > 5.5 &&
      this.cooldown === 0
    ) {
      const len = Math.hypot(p.velocity.x, p.velocity.z);
      p.velocity.x = (p.velocity.x / len) * m.slideSpeed;
      p.velocity.z = (p.velocity.z / len) * m.slideSpeed;
      this.slide = m.slideDuration;
      this.cooldown = m.slideCooldown;
      g.audio.burst(0.15, 0.05, 500);
    }
    this.slide = Math.max(0, this.slide - dt);
    if (!wants || !p.grounded) this.slide = 0;
    p.crouch = wants || headBlocked || this.slide > 0;
    p.sprint = i.down('ShiftLeft') && i.down('KeyW') && !p.crouch && !i.aim;
    if (this.buffer > 0) {
      const target =
        !wants && !headBlocked && i.down('KeyW') ? mantleTarget(p.position, p.yaw, boxes) : null;
      if (target) {
        this.mantle = { start: { ...p.position }, end: target, time: 0 };
        this.slide = 0;
        this.buffer = 0;
        p.velocity.set(0, 0, 0);
        p.grounded = false;
        this.label = 'MANTLING';
        return;
      }
      if (this.coyote > 0 && !headBlocked && (!wants || this.slide > 0)) {
        if (this.slide > 0) {
          this.momentum = 0.65;
          i.crouchToggle = false;
          p.crouch = false;
        }
        p.velocity.y = m.jump;
        p.grounded = false;
        this.coyote = 0;
        this.buffer = 0;
        this.slide = 0;
      } else if (!p.grounded && !headBlocked && this.wallLock === 0 && this.kicks < m.wallJumps) {
        const wall = wallContact(p.position, boxes);
        if (wall && wall.box !== this.lastWall) {
          p.velocity.x = wall.nx * m.wallPush;
          p.velocity.z = wall.nz * m.wallPush;
          p.velocity.y = m.wallLift;
          this.lastWall = wall.box;
          this.kicks++;
          this.wallLock = 0.2;
          this.buffer = 0;
          this.coyote = 0;
          this.momentum = 0.4;
          g.audio.tone(200, 0.1, 0.05, 'triangle', 450);
        }
      }
    }
    const speed =
      (p.crouch ? 2.8 : p.sprint ? 8 : 5.3) *
      (g.meleeClass?.active
        ? g.meleeClass.guard
          ? 0.65
          : 1.08
        : g.weapons.current.mobility || 1) *
      modifier(g.upgrades, 'stride', 0.08);
    let x = Number(i.down('KeyD')) - Number(i.down('KeyA')),
      z = Number(i.down('KeyS')) - Number(i.down('KeyW'));
    const length = Math.hypot(x, z) || 1;
    x /= length;
    z /= length;
    const tx = (x * Math.cos(p.yaw) + z * Math.sin(p.yaw)) * speed,
      tz = (-x * Math.sin(p.yaw) + z * Math.cos(p.yaw)) * speed;
    if (this.slide > 0) {
      const factor = Math.exp(-1.05 * dt);
      p.velocity.x *= factor;
      p.velocity.z *= factor;
    } else {
      const control = this.momentum > 0 ? 1.2 : p.grounded ? 16 : 4;
      p.velocity.x = damp(p.velocity.x, tx, control, dt);
      p.velocity.z = damp(p.velocity.z, tz, control, dt);
    }
    // Short collision steps prevent boosted movement crossing thin geometry at low frame rates.
    const steps = Math.max(1, Math.ceil(dt / 0.008));
    for (let n = 0; n < steps; n++) {
      const step = dt / steps,
        oldY = p.position.y,
        height = p.crouch ? m.crouched : m.standing;
      moveBody(
        p.position,
        p.velocity.x * step,
        p.velocity.z * step,
        m.radius,
        height,
        boxes,
        p.grounded ? 0.38 : 0.05,
        g.map?.bounds || 35,
      );
      const floor = floorAt(
        p.position,
        0.35,
        boxes,
        p.grounded ? 0.4 : 0,
        g.map?.voidFloor ? -Infinity : 0,
      );
      p.velocity.y -= m.gravity * step;
      let y = p.position.y + p.velocity.y * step;
      if (p.velocity.y > 0)
        for (const b of boxes)
          if (
            overlaps(p.position.x, p.position.z, m.radius, b) &&
            b.bottom >= oldY + height - 0.02 &&
            b.bottom < y + height
          ) {
            y = b.bottom - height;
            p.velocity.y = 0;
          }
      if (y <= floor) {
        if (p.velocity.y < -4) {
          p.shake = 0.08;
          g.audio.burst(0.08, 0.06, 400);
        }
        y = floor;
        p.velocity.y = 0;
        p.grounded = true;
        this.kicks = 0;
        this.lastWall = null;
      } else p.grounded = false;
      p.position.y = y;
    }
    this.label =
      this.slide > 0
        ? 'SLIDING · SPACE TO LAUNCH'
        : this.momentum > 0 && !p.grounded
          ? 'AIRBORNE'
          : !p.grounded &&
              this.kicks < m.wallJumps &&
              wallContact(p.position, boxes)?.box !== this.lastWall &&
              wallContact(p.position, boxes)
            ? 'SPACE · WALL JUMP'
            : '';
  }
}
