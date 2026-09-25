import * as THREE from 'three';
import { floorAt } from './core.js';
// Explosions and enemy death effects built from fixed pools: fireball and smoke sprites, ground
// shockwave rings, expanding heat shells, point-light flashes and fading scorch/splat decals.
// Everything is allocated up front (lights included, so shader light counts never change) and
// driven by simulation time, so pausing freezes effects and nothing compiles mid-fight.
function canvasTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function seeded(seed) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}
// Billowing fire: many soft lobes so the sprite reads as turbulent flame, not a disc.
const fireTexture = () =>
  canvasTexture(128, (c, s) => {
    const rand = seeded(91);
    for (let n = 0; n < 34; n++) {
      const a = rand() * Math.PI * 2,
        d = rand() * s * 0.22,
        r = s * (0.12 + rand() * 0.2),
        x = s / 2 + Math.cos(a) * d,
        y = s / 2 + Math.sin(a) * d,
        g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, s, s);
    }
  });
const smokeTexture = () =>
  canvasTexture(128, (c, s) => {
    const rand = seeded(17);
    for (let n = 0; n < 26; n++) {
      const a = rand() * Math.PI * 2,
        d = rand() * s * 0.2,
        r = s * (0.14 + rand() * 0.2),
        x = s / 2 + Math.cos(a) * d,
        y = s / 2 + Math.sin(a) * d,
        g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, s, s);
    }
  });
const markTexture = (splat) =>
  canvasTexture(128, (c, s) => {
    const rand = seeded(splat ? 55 : 33),
      core = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.42);
    core.addColorStop(0, `rgba(255,255,255,${splat ? 0.9 : 0.85})`);
    core.addColorStop(0.6, `rgba(255,255,255,${splat ? 0.7 : 0.45})`);
    core.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = core;
    c.fillRect(0, 0, s, s);
    // Radial streaks (scorch) or droplets (splat) break up the outline.
    for (let n = 0; n < (splat ? 18 : 40); n++) {
      const a = rand() * Math.PI * 2,
        d = s * (0.25 + rand() * 0.22);
      c.fillStyle = `rgba(255,255,255,${0.3 + rand() * 0.4})`;
      if (splat) {
        c.beginPath();
        c.arc(s / 2 + Math.cos(a) * d, s / 2 + Math.sin(a) * d, 1.5 + rand() * 5, 0, Math.PI * 2);
        c.fill();
      } else {
        c.save();
        c.translate(s / 2, s / 2);
        c.rotate(a);
        c.fillRect(s * 0.18, -1, d * 0.7, 2 + rand() * 2);
        c.restore();
      }
    }
  });
// Fresnel shell: bright at the rim, clear in the middle, like a pressure bubble.
const shellMaterial = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color() }, uOpacity: { value: 0 } },
    vertexShader: /* glsl */ `
      varying float vRim;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        vRim = pow(1.0 - abs(dot(n, normalize(-mv.xyz))), 4.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vRim;
      void main() { gl_FragColor = vec4(uColor * vRim * uOpacity, 1.0); }`,
  });
const FIRE_RAMP = [
  [0, new THREE.Color(0xfff6d8)],
  [0.12, new THREE.Color(0xffd27a)],
  [0.35, new THREE.Color(0xff8a2e)],
  [0.7, new THREE.Color(0x9e2a10)],
  [1, new THREE.Color(0x000000)],
];
const PALETTES = {
  fire: {
    flash: 0xfff1cf,
    ring: 0xffb26b,
    light: 0xff9a4a,
    smoke: 0x2f2a26,
    mark: 0x0d0b09,
    embers: 0xffb45c,
  },
  acid: {
    flash: 0xe9ff9c,
    ring: 0xb8e45a,
    light: 0x9fe04a,
    smoke: 0x55642c,
    mark: 0x3e5a14,
    embers: 0xc8f06a,
  },
  energy: {
    flash: 0xf3e8ff,
    ring: 0xc3a4ff,
    light: 0xb28cff,
    smoke: 0x3b3552,
    mark: 0x221c36,
    embers: 0xd9c6ff,
  },
  hostile: {
    flash: 0xffe1c8,
    ring: 0xff7a4d,
    light: 0xff6a3a,
    smoke: 0x2b2522,
    mark: 0x0d0b09,
    embers: 0xff8a55,
  },
};
export class Blasts {
  constructor(world, fx) {
    this.world = world;
    this.fx = fx;
    this.time = 0;
    this.queue = [];
    const fire = fireTexture(),
      smoke = smokeTexture();
    this.marksTexture = { scorch: markTexture(false), splat: markTexture(true) };
    const sprites = (count, map, blending) =>
      Array.from({ length: count }, () => {
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({ map, blending, transparent: true, depthWrite: false }),
        );
        sprite.visible = false;
        world.scene.add(sprite);
        return { sprite, life: 0 };
      });
    this.fires = sprites(64, fire, THREE.AdditiveBlending);
    this.smokes = sprites(40, smoke, THREE.NormalBlending);
    this.rings = Array.from({ length: 10 }, () => {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1, 64),
        new THREE.MeshBasicMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      world.scene.add(mesh);
      return { mesh, life: 0 };
    });
    const shellGeometry = new THREE.SphereGeometry(1, 24, 16);
    this.shells = Array.from({ length: 8 }, () => {
      const mesh = new THREE.Mesh(shellGeometry, shellMaterial());
      mesh.visible = false;
      world.scene.add(mesh);
      return { mesh, life: 0 };
    });
    // Two pooled flash lights, present from the start so the scene's light count is constant.
    this.lights = Array.from({ length: 2 }, () => {
      const light = new THREE.PointLight(0xffa050, 0, 18, 2);
      world.scene.add(light);
      world.flashLights.push(light);
      return { light, life: 0 };
    });
    const markGeometry = new THREE.PlaneGeometry(1, 1);
    markGeometry.rotateX(-Math.PI / 2);
    this.marks = Array.from({ length: 24 }, () => {
      const mesh = new THREE.Mesh(
        markGeometry,
        new THREE.MeshBasicMaterial({
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -3,
          polygonOffsetUnits: -3,
          map: this.marksTexture.scorch,
        }),
      );
      mesh.visible = false;
      mesh.renderOrder = 2;
      world.scene.add(mesh);
      return { mesh, life: 0 };
    });
    this.cursor = { fires: 0, smokes: 0, rings: 0, shells: 0, lights: 0, marks: 0 };
  }
  take(pool) {
    const item = this[pool][this.cursor[pool]++ % this[pool].length];
    return item;
  }
  get quiet() {
    return this.world.reducedMotion;
  }
  get sparse() {
    return this.world.particlesEnabled === false;
  }
  // Run fn after `delay` seconds of simulation time.
  later(delay, fn) {
    this.queue.push({ at: this.time + delay, fn });
  }
  fireball(pos, size, life, velocity, delay = 0, tint) {
    const f = this.take('fires');
    f.sprite.position.copy(pos);
    f.velocity = velocity;
    f.size = size;
    f.life = f.max = life;
    f.delay = delay;
    f.tint = tint;
    f.sprite.material.rotation = Math.random() * Math.PI * 2;
    f.spin = (Math.random() - 0.5) * 2;
    f.sprite.visible = false;
  }
  smoke(pos, size, life, color, velocity, delay = 0) {
    if (this.sparse) return;
    const s = this.take('smokes');
    s.sprite.position.copy(pos);
    s.sprite.material.color.set(color);
    s.sprite.material.rotation = Math.random() * Math.PI * 2;
    s.velocity = velocity;
    s.size = size;
    s.life = s.max = life;
    s.delay = delay;
    s.sprite.visible = false;
  }
  ring(pos, radius, color, life = 0.5) {
    const floor = this.floor(pos, 2.5);
    if (floor === null) return;
    const r = this.take('rings');
    r.mesh.position.set(pos.x, floor + 0.06, pos.z);
    r.mesh.material.color.set(color);
    r.radius = radius;
    r.life = r.max = life;
  }
  shell(pos, radius, color, life = 0.35) {
    if (this.quiet) return;
    const s = this.take('shells');
    s.mesh.position.copy(pos);
    s.mesh.material.uniforms.uColor.value.set(color);
    s.radius = radius;
    s.life = s.max = life;
  }
  flash(pos, color, intensity, life = 0.22) {
    if (this.quiet) intensity *= 0.35;
    const l = this.take('lights');
    l.light.position.copy(pos);
    l.light.color.set(color);
    l.intensity = intensity;
    l.life = l.max = life;
  }
  mark(pos, size, color, kind = 'scorch', life = 12) {
    const floor = this.floor(pos, 2);
    if (floor === null) return;
    const m = this.take('marks');
    m.mesh.material.map = this.marksTexture[kind];
    m.mesh.material.color.set(color);
    m.mesh.position.set(pos.x, floor + 0.02, pos.z);
    m.mesh.rotation.y = Math.random() * Math.PI * 2;
    m.mesh.scale.set(size, 1, size * (0.8 + Math.random() * 0.4));
    m.life = m.max = life;
  }
  floor(pos, reach) {
    const probe = { x: pos.x, y: pos.y + 0.3, z: pos.z },
      floor = floorAt(probe, 0.05, this.world.colliders, 0.3, this.world.voidFloor ? -Infinity : 0);
    return Number.isFinite(floor) && pos.y - floor < reach ? floor : null;
  }
  // A full explosion. kind picks the palette; scale ~ blast radius in metres.
  explosion(pos, scale = 3, kind = 'fire') {
    const p = PALETTES[kind] || PALETTES.fire,
      up = new THREE.Vector3(0, 1, 0),
      s = Math.max(0.6, scale),
      organic = kind === 'acid';
    // Core flash and billowing fireballs (acid bursts use tinted gouts instead of flame).
    this.fireball(pos, s * 1.3, 0.12, up.clone().multiplyScalar(0.5), 0, p.flash);
    const lobes = Math.round(4 + s * 1.5);
    for (let n = 0; n < lobes; n++) {
      const dir = new THREE.Vector3(
          Math.random() - 0.5,
          Math.random() * 0.8,
          Math.random() - 0.5,
        ).normalize(),
        offset = pos.clone().addScaledVector(dir, s * 0.25 * Math.random());
      this.fireball(
        offset,
        s * (0.55 + Math.random() * 0.5),
        0.45 + Math.random() * 0.4,
        dir.multiplyScalar(s * (1.2 + Math.random())).add(up.clone().multiplyScalar(s * 0.6)),
        Math.random() * 0.06,
        organic || kind === 'energy' ? p.ring : null,
      );
    }
    this.flash(pos.clone().add(up), p.light, 30 + s * 14, 0.14 + s * 0.03);
    this.shell(pos, s * 1.4, p.ring, 0.28);
    this.ring(pos, s * 1.7, p.ring, 0.45 + s * 0.05);
    // Smoke rises after the fire, embers and debris fly out.
    for (let n = 0; n < Math.round(3 + s); n++)
      this.smoke(
        pos
          .clone()
          .add(
            new THREE.Vector3(
              (Math.random() - 0.5) * s * 0.6,
              Math.random() * s * 0.3,
              (Math.random() - 0.5) * s * 0.6,
            ),
          ),
        s * (0.9 + Math.random() * 0.8),
        1.6 + Math.random() * 1.4,
        p.smoke,
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.6,
          0.9 + Math.random() * 0.8,
          (Math.random() - 0.5) * 0.6,
        ),
        0.08 + Math.random() * 0.15,
      );
    this.fx.burst(pos, p.embers, Math.round(10 + s * 6), 6 + s * 2);
    for (let n = 0; n < 8; n++) {
      const item = this.fx.items[(this.fx.cursor - 1 - n + this.fx.max) % this.fx.max];
      item.streak = true;
      item.life = 0.35 + Math.random() * 0.4;
    }
    if (!organic) this.fx.debris(pos, 0x3b3a36, Math.round(4 + s * 2));
    this.mark(pos, s * 1.6, p.mark, organic ? 'splat' : 'scorch', organic ? 10 : 14);
  }
  // Faction-flavoured destruction for an enemy. p is the body centre.
  death(e, p) {
    const d = e.d,
      big = d.boss ? 3 : d.radius > 1 || d.height > 3.2 ? 2 : 1,
      faction = d.faction || 'choir';
    if (faction === 'brood') {
      const color = d.color,
        goo = 0xb8e45a;
      const burst = (at, s) => {
        this.fx.burst(at, goo, Math.round(14 * s), 5 * s);
        this.fx.burst(at, color, Math.round(10 * s), 4 * s);
        this.fx.debris(at, color, Math.round(5 * s));
        for (let n = 0; n < 3; n++)
          this.smoke(
            at,
            s * 1.1,
            1.8,
            0x6d7a35,
            new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.4, (Math.random() - 0.5) * 0.8),
            n * 0.05,
          );
        for (let n = 0; n < 5; n++)
          this.fireball(
            at
              .clone()
              .add(
                new THREE.Vector3(
                  (Math.random() - 0.5) * s * 0.5,
                  Math.random() * s * 0.3,
                  (Math.random() - 0.5) * s * 0.5,
                ),
              ),
            s * (0.8 + Math.random() * 0.6),
            0.3 + Math.random() * 0.25,
            new THREE.Vector3(
              (Math.random() - 0.5) * 3,
              1 + Math.random() * 2,
              (Math.random() - 0.5) * 3,
            ).multiplyScalar(s),
            n * 0.02,
            n % 2 ? goo : 0xe6ff7a,
          );
        this.ring(at, s * 1.6, goo, 0.4);
        this.fx.debris(at, 0x6b7a2e, Math.round(6 * s));
        this.mark(at, s * 1.8, 0x3e5a14, 'splat', 10);
      };
      burst(p, big === 1 ? 1 : 1.5);
      if (big >= 2)
        for (let n = 0; n < (big === 3 ? 6 : 2); n++)
          this.later(0.12 + n * 0.18, () => {
            const at = p
              .clone()
              .add(
                new THREE.Vector3(
                  (Math.random() - 0.5) * d.radius * 2,
                  (Math.random() - 0.3) * d.height * 0.4,
                  (Math.random() - 0.5) * d.radius * 2,
                ),
              );
            burst(at, big === 3 ? 1.6 : 1.1);
          });
      if (big === 3) this.later(1.3, () => this.explosion(p, 5, 'acid'));
      return;
    }
    if (faction === 'veil') {
      const shard = 0xd9ccff;
      const shatter = (at, s) => {
        this.fireball(at, s * 1.4, 0.14, new THREE.Vector3(), 0, 0xf3e8ff);
        this.shell(at, s * 1.6, 0xc3a4ff, 0.3);
        this.flash(at, 0xb28cff, 18 * s, 0.2);
        this.fx.debris(at, shard, Math.round(10 * s));
        this.fx.burst(at, 0xc5a8ff, Math.round(16 * s), 7 * s);
        for (let n = 0; n < 6; n++) {
          const item = this.fx.items[(this.fx.cursor - 1 - n + this.fx.max) % this.fx.max];
          item.streak = true;
        }
        this.ring(at, s * 2.2, 0xc3a4ff, 0.55);
        // Sparkles drift upward after the shatter.
        for (let n = 0; n < Math.round(4 * s); n++)
          this.fireball(
            at
              .clone()
              .add(
                new THREE.Vector3(
                  (Math.random() - 0.5) * s,
                  Math.random() * s * 0.5,
                  (Math.random() - 0.5) * s,
                ),
              ),
            0.25,
            0.9 + Math.random() * 0.6,
            new THREE.Vector3(0, 0.9 + Math.random(), 0),
            0.1 + Math.random() * 0.3,
            0xc5a8ff,
          );
      };
      shatter(p, big === 1 ? 1 : 1.5);
      if (big === 3) {
        for (let n = 0; n < 5; n++)
          this.later(0.15 + n * 0.2, () =>
            shatter(
              p
                .clone()
                .add(
                  new THREE.Vector3(
                    (Math.random() - 0.5) * 3,
                    (Math.random() - 0.3) * 2,
                    (Math.random() - 0.5) * 3,
                  ),
                ),
              1.3,
            ),
          );
        this.later(1.2, () => this.explosion(p, 5.5, 'energy'));
      }
      return;
    }
    // Choir machines: sparks and shrapnel, then fire; heavies chain secondary detonations.
    this.fx.burst(p, 0xffe0a8, 14, 8);
    for (let n = 0; n < 10; n++) {
      const item = this.fx.items[(this.fx.cursor - 1 - n + this.fx.max) % this.fx.max];
      item.streak = true;
      item.life = 0.3 + Math.random() * 0.35;
    }
    this.fx.debris(p, d.color, big === 1 ? 7 : 12);
    if (big === 1) {
      this.explosion(p, 1.4, 'fire');
      return;
    }
    const pops = big === 3 ? 7 : 2;
    for (let n = 0; n < pops; n++)
      this.later(n * (big === 3 ? 0.2 : 0.14), () => {
        const at = p
          .clone()
          .add(
            new THREE.Vector3(
              (Math.random() - 0.5) * d.radius * 2,
              (Math.random() - 0.2) * d.height * 0.5,
              (Math.random() - 0.5) * d.radius * 2,
            ),
          );
        this.explosion(at, big === 3 ? 1.8 : 1.1, 'fire');
      });
    this.later(pops * (big === 3 ? 0.2 : 0.14) + 0.05, () =>
      this.explosion(p, big === 3 ? 6 : 2.6, 'fire'),
    );
  }
  update(dt) {
    this.time += dt;
    if (this.queue.length) {
      const due = this.queue.filter((q) => q.at <= this.time);
      this.queue = this.queue.filter((q) => q.at > this.time);
      for (const q of due) q.fn();
    }
    const color = new THREE.Color();
    for (const f of this.fires) {
      if (f.life <= 0) continue;
      if (f.delay > 0) {
        f.delay -= dt;
        continue;
      }
      f.life -= dt;
      const t = 1 - Math.max(0, f.life) / f.max;
      f.sprite.visible = f.life > 0;
      f.velocity.multiplyScalar(Math.exp(-3.5 * dt));
      f.velocity.y += dt * 1.2;
      f.sprite.position.addScaledVector(f.velocity, dt);
      f.sprite.scale.setScalar(f.size * (0.45 + (1 - Math.pow(1 - t, 3)) * 0.9));
      f.sprite.material.rotation += f.spin * dt;
      if (f.tint) color.set(f.tint).multiplyScalar(1 - t);
      else {
        let i = 1;
        while (i < FIRE_RAMP.length - 1 && FIRE_RAMP[i][0] < t) i++;
        const [t0, c0] = FIRE_RAMP[i - 1],
          [t1, c1] = FIRE_RAMP[i];
        color.copy(c0).lerp(c1, (t - t0) / (t1 - t0));
      }
      // Additive: brightness above 1 feeds the bloom pass for a hot core.
      f.sprite.material.color.copy(color).multiplyScalar(2.2);
      f.sprite.material.opacity = Math.min(1, (1 - t) * 1.6);
    }
    for (const s of this.smokes) {
      if (s.life <= 0) continue;
      if (s.delay > 0) {
        s.delay -= dt;
        continue;
      }
      s.life -= dt;
      const t = 1 - Math.max(0, s.life) / s.max;
      s.sprite.visible = s.life > 0;
      s.sprite.position.addScaledVector(s.velocity, dt);
      s.velocity.multiplyScalar(Math.exp(-0.6 * dt));
      s.sprite.scale.setScalar(s.size * (0.6 + t * 1.3));
      s.sprite.material.rotation += dt * 0.25;
      s.sprite.material.opacity = Math.sin(Math.min(1, t * 3) * Math.PI * 0.5) * (1 - t) * 0.75;
    }
    for (const r of this.rings) {
      r.life -= dt;
      r.mesh.visible = r.life > 0;
      if (r.life <= 0) continue;
      const t = 1 - r.life / r.max;
      r.mesh.scale.setScalar(0.2 + r.radius * (1 - Math.pow(1 - t, 2.5)));
      r.mesh.material.opacity = Math.pow(1 - t, 1.5) * 0.6;
    }
    for (const s of this.shells) {
      s.life -= dt;
      s.mesh.visible = s.life > 0;
      if (s.life <= 0) continue;
      const t = 1 - s.life / s.max;
      s.mesh.scale.setScalar(s.radius * (0.3 + (1 - Math.pow(1 - t, 3)) * 0.9));
      s.mesh.material.uniforms.uOpacity.value = (1 - t) * 0.75;
    }
    for (const l of this.lights) {
      l.life -= dt;
      l.light.intensity = l.life > 0 ? l.intensity * Math.pow(l.life / l.max, 1.5) : 0;
    }
    for (const m of this.marks) {
      m.life -= dt;
      m.mesh.visible = m.life > 0;
      if (m.life > 0) m.mesh.material.opacity = Math.min(1, m.life / 3) * 0.85;
    }
  }
  clear() {
    this.queue = [];
    for (const pool of [this.fires, this.smokes])
      for (const item of pool) ((item.life = 0), (item.sprite.visible = false));
    for (const pool of [this.rings, this.shells, this.marks])
      for (const item of pool) ((item.life = 0), (item.mesh.visible = false));
    for (const l of this.lights) ((l.life = 0), (l.light.intensity = 0));
  }
}
