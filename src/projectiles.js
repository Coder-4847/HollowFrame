import * as THREE from 'three';
export class Projectiles {
  constructor(game) {
    this.game = game;
    this.pool = [];
    this.ray = new THREE.Raycaster();
    const geo = new THREE.SphereGeometry(0.12, 6, 4),
      mat = new THREE.MeshBasicMaterial({ color: 0xff6944 });
    for (let i = 0; i < 90; i++) {
      const mesh = new THREE.Mesh(geo, mat.clone());
      mesh.visible = false;
      game.world.scene.add(mesh);
      this.pool.push({ mesh, active: false, velocity: new THREE.Vector3() });
    }
  }
  spawn(pos, dir, speed, damage, friendly, radius = 0, options = {}) {
    const p = this.pool.find((p) => !p.active);
    if (!p) return;
    p.active = true;
    p.mesh.visible = true;
    p.mesh.position.copy(pos);
    p.mesh.material.color.set(options.color || 0xff6944);
    if (!friendly) this.game.fx.glow(pos, options.color || 0xff8b55, 0.3, 0.06);
    p.velocity.copy(dir).multiplyScalar(speed);
    p.life = options.fuse || 7;
    p.gravity = options.gravity || 0;
    p.equipment = !!options.equipment;
    p.cluster = !!options.cluster;
    p.damage = damage;
    p.friendly = friendly;
    p.radius = radius;
    p.mesh.scale.setScalar(friendly ? 1.4 : radius ? 2 : 1);
  }
  explode(pos, damage, radius, friendly, equipment = false, kind = friendly ? 'fire' : 'hostile') {
    const g = this.game;
    g.fx.blasts.explosion(pos, radius, kind);
    g.audio.explosion(pos.distanceTo(g.player.position));
    let hitEnemy = false;
    if (friendly)
      for (const e of [...g.enemies.list]) {
        const center = e.root.position.clone().add(new THREE.Vector3(0, e.d.height * 0.5, 0)),
          d = center.distanceTo(pos);
        if (d < radius && g.enemies.visible(pos, center)) {
          for (const part of ['weaponLeft', 'weaponRight', 'repair', 'deployer', 'command'])
            if (
              e.components[part] > 0 &&
              e.meshes.some((m) => m.userData.part === part && m.visible)
            ) {
              e.components[part] -= damage * 0.45 * (1 - (d / radius) * 0.7);
              if (e.components[part] <= 0) g.enemies.breakComponent(e, part);
            }
          if (e.shield > 0) {
            e.shield -= damage;
            if (e.shield <= 0) g.enemies.breakComponent(e, 'shield');
          }
          g.enemies.hit(
            e,
            'body',
            {
              damage: damage * (1 - (d / radius) * 0.7),
              penetration: 0.85,
              weak: 1,
              range: 200,
              explosive: true,
            },
            center,
            0,
          );
          hitEnemy = true;
        }
      }
    if (hitEnemy && !equipment) g.stats.hits++;
    const distance = g.world.camera.position.distanceTo(pos);
    if (distance < radius && g.enemies.visible(pos, g.world.camera.position))
      g.player.damage(damage * (1 - distance / radius) * (friendly ? 0.35 : 1), pos);
    if (distance < 18) g.player.shake = Math.max(g.player.shake, 0.15 * (1 - distance / 18));
  }
  fragment(p, pos) {
    if (!p.cluster) return;
    for (let n = 0; n < 4; n++) {
      const dir = new THREE.Vector3(
        Math.cos((n * Math.PI) / 2),
        0.7,
        Math.sin((n * Math.PI) / 2),
      ).normalize();
      this.spawn(pos, dir, 7, 30, true, 2.2, { gravity: 13, fuse: 0.6, equipment: true });
    }
  }
  update(dt) {
    const g = this.game;
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      p.velocity.y -= p.gravity * dt;
      const start = p.mesh.position.clone(),
        step = p.velocity.clone().multiplyScalar(dt),
        len = step.length();
      if (len === 0 && p.life > 0) continue;
      this.ray.set(start, step.clone().normalize());
      this.ray.far = len;
      const targets = p.friendly ? [...g.world.solids, ...g.enemies.targets] : g.world.solids;
      const hit = this.ray.intersectObjects(targets, false).find((h) => h.object.visible);
      let impact = hit?.point;
      if (!p.friendly) {
        const closest = start
          .clone()
          .addScaledVector(
            step,
            Math.max(
              0,
              Math.min(1, g.world.camera.position.clone().sub(start).dot(step) / (len * len)),
            ),
          );
        if (
          closest.distanceTo(g.world.camera.position) < 0.55 &&
          (!impact || start.distanceTo(closest) < start.distanceTo(impact))
        ) {
          impact = closest;
          if (!p.radius) g.player.damage(p.damage, start);
        }
      }
      if (impact) {
        const explosion = impact.clone().addScaledVector(step.clone().normalize(), -0.12);
        if (p.radius) {
          this.explode(explosion, p.damage, p.radius, p.friendly, p.equipment);
          this.fragment(p, explosion);
        } else
          g.fx.impact(
            impact,
            step.clone().normalize().negate(),
            p.mesh.material.color.getHex() === 0xff6944 ? 'metal' : 'veil',
          );
        p.active = false;
        p.mesh.visible = false;
      } else if (p.life <= 0) {
        if (p.radius && p.gravity) {
          this.explode(p.mesh.position, p.damage, p.radius, p.friendly, p.equipment);
          this.fragment(p, p.mesh.position);
        }
        p.active = false;
        p.mesh.visible = false;
      } else {
        p.mesh.position.add(step);
        if (p.radius) g.fx.burst(p.mesh.position, p.friendly ? 0xffce89 : 0xff7954, 1, 1);
      }
    }
  }
  clear() {
    for (const p of this.pool) {
      p.active = false;
      p.mesh.visible = false;
    }
  }
}
