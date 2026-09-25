import * as THREE from 'three';
// The Architect trades the Conductor's radial slam for a cover-blocked sweeping beam.
export function updateArchitect(manager, e, dt, origin, distance) {
  const g = manager.game;
  e.cycle += dt * (e.hp < e.d.hp * 0.5 ? 1.15 : 1);
  e.beamTick = Math.max(0, (e.beamTick || 0) - dt);
  if (e.cycle >= 14) {
    e.cycle = 0;
    e.volleyFired = false;
    e.slamFired = false;
    e.aim = null;
  }
  const armed = e.components.weaponLeft > 0 || e.components.weaponRight > 0;
  e.coreOpen = (e.cycle >= 8 && e.cycle < 13) || !armed;
  e.core.visible = e.coreOpen;
  e.plate.visible = e.armor > 0 && !e.coreOpen;
  if (e.rotor) e.rotor.rotation.z += dt * (e.coreOpen ? 1 : 3);
  if (e.cycle < 1.6) {
    e.aim = g.world.camera.position.clone();
    e.warn = 1.6 - e.cycle;
    if (armed && Math.random() < dt * 20) g.fx.trace(origin, e.aim, 0xe69bff);
  }
  if (e.cycle >= 1.6 && e.cycle < 4.5 && armed && e.aim) {
    e.warn = 0;
    const direction = e.aim.clone().sub(origin).normalize();
    direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.6 + ((e.cycle - 1.6) / 2.9) * 1.2);
    const ray = new THREE.Raycaster(origin, direction, 0, 48),
      block = ray.intersectObjects(g.world.solids, false)[0],
      end = block ? block.point : origin.clone().addScaledVector(direction, 48);
    g.fx.trace(origin, end, 0xe7a1ff);
    const segment = end.clone().sub(origin),
      closest = origin
        .clone()
        .addScaledVector(
          segment,
          Math.max(
            0,
            Math.min(
              1,
              g.world.camera.position.clone().sub(origin).dot(segment) / segment.lengthSq(),
            ),
          ),
        );
    if (closest.distanceTo(g.world.camera.position) < 0.65 && e.beamTick <= 0) {
      g.player.damage(7 * g.difficulty.damage, origin);
      e.beamTick = 0.18;
    }
    if (distance < 30) g.notice('ARCHITECT / SWEEP — USE COVER', 0.15);
  }
  if (e.cycle >= 6 && !e.volleyFired) {
    e.volleyFired = true;
    const target = g.world.camera.position.clone();
    for (const side of [-1, 1])
      if (e.components[side < 0 ? 'weaponLeft' : 'weaponRight'] > 0) {
        const muzzle = origin.clone().add(new THREE.Vector3(side * 1.5, 0, 0));
        g.projectiles.spawn(
          muzzle,
          target.clone().sub(muzzle).normalize(),
          13,
          22 * g.difficulty.damage,
          false,
          4,
        );
      }
    g.audio.alert();
  }
  if (e.cycle >= 8 && !e.slamFired) {
    e.slamFired = true;
    g.notice('ARCHITECT / COOLING CORE EXPOSED', 2.5);
  }
  const stage = e.hp < e.d.hp * 0.4 ? 1 : 0;
  if (stage > e.reinforced) {
    e.reinforced = stage;
    const p = g.map.spawns.find((p) => p.distanceTo(g.player.position) > 14) || g.map.spawns[0];
    if (manager.list.length < 24) manager.spawn('shade', p, true);
  }
}
