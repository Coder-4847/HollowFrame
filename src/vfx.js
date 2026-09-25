import * as THREE from 'three';
import { Ragdolls } from './ragdolls.js';
import { Blasts } from './blasts.js';
import { floorAt } from './core.js';
export class Effects {
  constructor(world) {
    this.world = world;
    this.ragdolls = new Ragdolls(world);
    this.max = 360;
    this.items = Array.from({ length: this.max }, () => ({
      life: 0,
      v: new THREE.Vector3(),
      p: new THREE.Vector3(),
      scale: 1,
    }));
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.07, 0.07, 0.07),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      this.max,
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.userData.noAO = true;
    // Create the per-instance colour buffer now: adding it on the first burst would change the
    // shader variant and force a compile in the middle of the first fight.
    for (let i = 0; i < this.max; i++) this.mesh.setColorAt(i, new THREE.Color(0xffffff));
    world.scene.add(this.mesh);
    this.dummy = new THREE.Object3D();
    this.cursor = 0;
    this.color = new THREE.Color();
    this.traces = [];
    this.geometry = new THREE.CylinderGeometry(0.014, 0.014, 1, 4);
    this.material = new THREE.MeshBasicMaterial({ color: 0xffdf9e, transparent: true });
    for (let i = 0; i < 45; i++) {
      const m = new THREE.Mesh(this.geometry, this.material.clone());
      m.visible = false;
      world.scene.add(m);
      this.traces.push({ m, life: 0 });
    }
    this.traceCursor = 0;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d'),
      gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(180,193,187,.55)');
    gradient.addColorStop(0.45, 'rgba(135,150,146,.3)');
    gradient.addColorStop(1, 'rgba(120,130,125,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    this.smokeTexture = new THREE.CanvasTexture(canvas);
    this.smokePool = Array.from({ length: 28 }, () => {
      const mesh = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.smokeTexture,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      );
      mesh.visible = false;
      world.scene.add(mesh);
      return { mesh, life: 0 };
    });
    this.smokeCursor = 0;
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 64;
    glowCanvas.height = 64;
    const glowContext = glowCanvas.getContext('2d'),
      glowGradient = glowContext.createRadialGradient(32, 32, 0, 32, 32, 32);
    glowGradient.addColorStop(0, 'rgba(255,255,255,1)');
    glowGradient.addColorStop(0.2, 'rgba(255,255,255,.8)');
    glowGradient.addColorStop(1, 'rgba(255,255,255,0)');
    glowContext.fillStyle = glowGradient;
    glowContext.fillRect(0, 0, 64, 64);
    this.glowTexture = new THREE.CanvasTexture(glowCanvas);
    this.glows = Array.from({ length: 24 }, () => {
      const mesh = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowTexture,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
        }),
      );
      mesh.visible = false;
      world.scene.add(mesh);
      return { mesh, life: 0, max: 1, size: 1 };
    });
    this.glowCursor = 0;
    this.blasts = new Blasts(world, this);
  }
  glow(pos, color, size = 0.4, life = 0.1) {
    if (this.world.particlesEnabled === false || this.world.reducedMotion) return;
    const g = this.glows[this.glowCursor++ % this.glows.length];
    g.life = g.max = life;
    g.size = size;
    g.mesh.position.copy(pos);
    g.mesh.material.color.set(color);
    g.mesh.material.opacity = 1;
    g.mesh.scale.setScalar(size);
    g.mesh.visible = true;
  }
  muzzle(pos, direction, energy = false) {
    if (this.world.particlesEnabled === false) return;
    this.glow(pos, energy ? 0x83ddff : 0xffb659, energy ? 0.22 : 0.32, 0.045);
    if (!this.world.reducedMotion) {
      this.burst(pos, energy ? 0x93efff : 0xffc973, 4, 1);
      for (let n = 0; n < 4; n++) {
        const p = this.items[(this.cursor - 1 - n + this.max) % this.max];
        p.v.copy(direction).multiplyScalar(3 + Math.random() * 4);
        p.life = 0.07;
        p.streak = true;
        p.scale = 0.65;
      }
    }
    if (!energy) this.smoke(pos, 1);
  }
  impact(pos, normal, kind = 'metal') {
    const color =
      kind === 'brood' ? 0xb4d76e : kind === 'veil' || kind === 'shield' ? 0x91ceff : 0xffc27a;
    this.burst(pos, color, kind === 'shield' ? 14 : 10, 5);
    if (this.world.particlesEnabled === false) return;
    for (let n = 0; n < 10; n++) {
      const p = this.items[(this.cursor - 1 - n + this.max) % this.max];
      p.v.addScaledVector(normal, 3);
      p.streak = kind !== 'brood';
      p.scale = kind === 'brood' ? 1.8 : 0.7;
    }
    this.glow(pos, color, 0.35, 0.09);
    this.smoke(pos, 1);
    const smoke = this.smokePool[(this.smokeCursor - 1) % this.smokePool.length];
    smoke.mesh.material.color.set(
      kind === 'brood' ? 0x9fae67 : kind === 'veil' ? 0xaaa0cf : 0xbdb9ab,
    );
  }
  smoke(pos, count = 1) {
    if (this.world.particlesEnabled === false) return;
    for (let n = 0; n < count; n++) {
      const s = this.smokePool[this.smokeCursor++ % this.smokePool.length];
      s.life = 1.5;
      s.mesh.material.color.set(0xffffff);
      s.mesh.position.copy(pos);
      s.mesh.position.x += (Math.random() - 0.5) * 0.5;
      s.mesh.visible = true;
      s.mesh.scale.setScalar(0.8);
    }
  }
  debris(pos, color, count = 8) {
    if (this.world.particlesEnabled === false) return;
    this.burst(pos, color, count, 7);
    for (let n = 0; n < count; n++) {
      const p = this.items[(this.cursor - 1 - n + this.max) % this.max];
      p.life = 1 + Math.random() * 0.5;
      p.scale = 3 + Math.random() * 5;
    }
  }
  burst(pos, color, count = 12, power = 4) {
    if (this.world.particlesEnabled === false) return;
    count = Math.min(count, this.world.renderer.getPixelRatio() === 1 ? 12 : 40);
    for (let i = 0; i < count; i++) {
      const n = this.cursor++ % this.max,
        p = this.items[n];
      p.p.copy(pos);
      p.v.set((Math.random() - 0.5) * power, Math.random() * power, (Math.random() - 0.5) * power);
      p.life = 0.2 + Math.random() * 0.5;
      p.scale = 1 + Math.random() * 2;
      p.streak = false;
      this.mesh.setColorAt(n, this.color.set(color));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  trace(from, to, color = 0xffd8a0) {
    const t = this.traces[this.traceCursor++ % this.traces.length];
    const d = to.clone().sub(from);
    t.m.position.copy(from).addScaledVector(d, 0.5);
    t.m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    t.m.scale.set(1, d.length(), 1);
    t.m.material.color.set(color);
    t.m.material.opacity = 0.8;
    t.m.visible = true;
    t.life = 0.065;
  }
  update(dt) {
    this.ragdolls.update(dt);
    this.blasts.update(dt);
    this.mesh.visible = this.world.particlesEnabled !== false;
    for (const g of this.glows) {
      g.life -= dt;
      g.mesh.visible =
        g.life > 0 && this.world.particlesEnabled !== false && !this.world.reducedMotion;
      g.mesh.material.opacity = Math.max(0, g.life / g.max);
      g.mesh.scale.setScalar(g.size * (1.5 - (g.life / g.max) * 0.5));
    }
    for (const s of this.smokePool) {
      s.life -= dt;
      s.mesh.visible = s.life > 0 && this.world.particlesEnabled !== false;
      if (s.life > 0) {
        s.mesh.position.y += dt * 0.8;
        s.mesh.scale.setScalar(0.8 + (1.5 - s.life) * 1.5);
        s.mesh.material.opacity = (s.life / 1.5) * 0.5;
      }
    }
    for (let i = 0; i < this.max; i++) {
      const p = this.items[i];
      p.life -= dt;
      if (p.life > 0) {
        const floor =
          floorAt(p.p, 0.04, this.world.colliders, 0.05, this.world.voidFloor ? -Infinity : 0) +
          0.04;
        p.v.y -= 10 * dt;
        p.p.addScaledVector(p.v, dt);
        if (p.p.y < floor) {
          p.p.y = floor;
          p.v.y = Math.abs(p.v.y) * 0.25;
          p.v.x *= 0.7;
          p.v.z *= 0.7;
        }
        this.dummy.position.copy(p.p);
        this.dummy.rotation.set(p.life * 3, i, p.life * 2);
        this.dummy.scale.setScalar(
          p.p.distanceToSquared(this.world.camera.position) < 0.6
            ? 0
            : p.scale * Math.min(1, p.life * 5),
        );
        if (p.streak) {
          this.dummy.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            p.v.clone().normalize(),
          );
          this.dummy.scale.y *= 4;
        }
      } else this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    for (const t of this.traces) {
      t.life -= dt;
      t.m.visible = t.life > 0;
    }
  }
  clear() {
    this.ragdolls.clear();
    this.blasts.clear();
    for (const g of this.glows) {
      g.life = 0;
      g.mesh.visible = false;
    }
    for (const s of this.smokePool) {
      s.life = 0;
      s.mesh.visible = false;
    }
    for (const p of this.items) p.life = 0;
    for (const t of this.traces) {
      t.life = 0;
      t.m.visible = false;
    }
  }
}
