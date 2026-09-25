import * as THREE from 'three';
import { moveBody, floorAt } from './core.js';
// Lightweight articulated point bodies. Geometry is borrowed; each corpse owns its materials.
export class Ragdolls {
  constructor(world) {
    this.world = world;
    this.items = [];
  }
  spawn(enemy, impulse) {
    if (this.items.length >= 6) this.remove(this.items[0]);
    enemy.root.updateMatrixWorld(true);
    const parts = enemy.meshes
      .filter((m) => m.visible && !['shield', 'core'].includes(m.userData.part))
      .slice(0, 40);
    const bodies = parts.map((source, index) => {
      const mesh = new THREE.Mesh(source.geometry, source.material.clone());
      source.matrixWorld.decompose(mesh.position, mesh.quaternion, mesh.scale);
      source.geometry.computeBoundingBox();
      const size = source.geometry.boundingBox.getSize(new THREE.Vector3()).multiply(mesh.scale);
      mesh.material.transparent = true;
      mesh.material.opacity = 1;
      mesh.castShadow = true;
      this.world.scene.add(mesh);
      const velocity = impulse.clone().multiplyScalar(index ? 0.8 + Math.random() * 0.4 : 1);
      velocity.y += 2 + Math.random();
      return {
        mesh,
        velocity,
        spin: new THREE.Vector3(
          Math.random() - 0.5,
          Math.random() - 0.5,
          Math.random() - 0.5,
        ).multiplyScalar(5),
        radius: Math.max(0.08, Math.min(0.55, Math.max(size.x, size.y, size.z) * 0.3)),
        parent: -1,
        length: 0,
      };
    });
    // Connect each part to its closest predecessor, retaining the original silhouette at rest.
    for (let i = 1; i < bodies.length; i++) {
      let distance = Infinity;
      for (let j = 0; j < i; j++) {
        const d = bodies[i].mesh.position.distanceTo(bodies[j].mesh.position);
        if (d < distance) {
          distance = d;
          bodies[i].parent = j;
        }
      }
      bodies[i].length = distance;
    }
    this.items.push({ bodies, age: 0 });
  }
  remove(corpse) {
    for (const b of corpse.bodies) {
      this.world.scene.remove(b.mesh);
      b.mesh.material.dispose();
    }
    this.items = this.items.filter((c) => c !== corpse);
  }
  update(dt) {
    for (const corpse of [...this.items]) {
      corpse.age += dt;
      if (corpse.age >= 5) {
        this.remove(corpse);
        continue;
      }
      const steps = Math.max(1, Math.ceil(dt / 0.016)),
        step = dt / steps;
      for (let n = 0; n < steps; n++) {
        for (const b of corpse.bodies) {
          const p = b.mesh.position,
            oldX = p.x,
            oldZ = p.z;
          b.velocity.y -= 15 * step;
          moveBody(
            p,
            b.velocity.x * step,
            b.velocity.z * step,
            b.radius,
            0.4,
            this.world.colliders,
            0,
            this.world.bounds || 35,
          );
          if (Math.abs(p.x - oldX) < 0.00001) b.velocity.x *= -0.25;
          if (Math.abs(p.z - oldZ) < 0.00001) b.velocity.z *= -0.25;
          const floor =
            floorAt(p, b.radius, this.world.colliders, 0.1, this.world.voidFloor ? -Infinity : 0) +
            b.radius;
          p.y += b.velocity.y * step;
          b.floor = floor;
          if (p.y < floor) {
            p.y = floor;
            b.velocity.y = Math.abs(b.velocity.y) * 0.2;
            b.velocity.x *= 0.9;
            b.velocity.z *= 0.9;
            b.spin.multiplyScalar(0.92);
          }
          b.mesh.rotateX(b.spin.x * step);
          b.mesh.rotateY(b.spin.y * step);
          b.mesh.rotateZ(b.spin.z * step);
        }
        for (let iteration = 0; iteration < 3; iteration++)
          for (const b of corpse.bodies) {
            if (b.parent < 0) continue;
            const parent = corpse.bodies[b.parent],
              delta = b.mesh.position.clone().sub(parent.mesh.position),
              distance = delta.length();
            if (distance > 0.001) {
              const correction = delta.multiplyScalar(((distance - b.length) / distance) * 0.35);
              b.mesh.position.sub(correction);
              parent.mesh.position.add(correction);
            }
          }
      }
      for (const b of corpse.bodies) {
        b.mesh.position.y = Math.max(b.mesh.position.y, b.floor ?? -Infinity);
        b.mesh.material.opacity = Math.min(1, 5 - corpse.age);
      }
    }
  }
  clear() {
    for (const corpse of [...this.items]) this.remove(corpse);
  }
}
