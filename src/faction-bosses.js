import * as THREE from 'three';
export function updateFactionBoss(manager, e, dt, origin, distance) {
  const g = manager.game,
    pattern = e.d.pattern;
  e.cycle += dt * (e.hp < e.d.hp * 0.5 ? 1.15 : 1);
  if (e.cycle >= 14) {
    e.cycle = 0;
    e.volleyFired = false;
    e.slamFired = false;
    e.aim = null;
  }
  const armed = e.components.weaponLeft > 0 || e.components.weaponRight > 0;
  e.coreOpen = (e.cycle >= 7 && e.cycle < 12.5) || !armed;
  e.core.visible = e.coreOpen;
  if (e.rotor) e.rotor.rotation.z += dt * (e.coreOpen ? 0.3 : 1.8);
  e.plate.visible = e.armor > 0 && !e.coreOpen;
  e.zone.visible = e.cycle >= 5 && e.cycle < 7;
  e.phaseLabel = e.coreOpen
    ? 'VITAL CORE EXPOSED / FIRE'
    : e.cycle < 2
      ? 'ATTACK CHARGING / MOVE'
      : e.zone.visible
        ? 'AREA PULSE / GET CLEAR'
        : e.d.faction === 'brood'
          ? 'BREAK THE ATTACK ORGANS'
          : 'DISABLE THE EMITTERS';
  const color = e.d.faction === 'brood' ? 0xc7ec63 : 0xc2a1ff;
  if (e.cycle < 2) {
    e.aim = g.world.camera.position.clone();
    if (armed && Math.random() < dt * 16) g.fx.trace(origin, e.aim, color);
  }
  if (e.cycle >= 2 && !e.volleyFired) {
    e.volleyFired = true;
    if (armed && e.aim && pattern !== 'beam') {
      const count = pattern === 'nova' ? 12 : pattern === 'hatch' ? 5 : 3;
      for (let n = 0; n < count; n++) {
        const dir = e.aim.clone().sub(origin).normalize();
        dir.applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          pattern === 'nova' ? (n * Math.PI * 2) / count : (n - (count - 1) / 2) * 0.12,
        );
        g.projectiles.spawn(
          origin,
          dir,
          pattern === 'nova' ? 16 : 12,
          e.d.damage * g.difficulty.damage,
          false,
          pattern === 'nova' ? 0 : 2.5,
          { color },
        );
      }
    }
  }
  if (pattern === 'beam' && armed && e.aim && e.cycle >= 2 && e.cycle < 5) {
    const dir = e.aim
      .clone()
      .sub(origin)
      .normalize()
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.55 + ((e.cycle - 2) / 3) * 1.1);
    const ray = new THREE.Raycaster(origin, dir, 0, 48),
      block = ray.intersectObjects(g.world.solids, false)[0];
    const end = block ? block.point : origin.clone().addScaledVector(dir, 48);
    g.fx.trace(origin, end, color);
    e.beamTick = Math.max(0, (e.beamTick || 0) - dt);
    const segment = new THREE.Line3(origin, end),
      closest = segment.closestPointToPoint(g.world.camera.position, true, new THREE.Vector3());
    if (closest.distanceTo(g.world.camera.position) < 0.65 && e.beamTick <= 0) {
      g.player.damage(8 * g.difficulty.damage, origin);
      e.beamTick = 0.2;
    }
    e.phaseLabel = 'PRISM SWEEP / USE COVER';
  }
  if (e.zone.visible && distance < 14) g.notice(e.d.name + ' / AREA PULSE — GET CLEAR', 0.15);
  if (e.cycle >= 7 && !e.slamFired) {
    e.slamFired = true;
    g.projectiles.explode(
      e.root.position.clone().add(new THREE.Vector3(0, 0.3, 0)),
      (pattern === 'rupture' ? 55 : 30) * g.difficulty.damage,
      pattern === 'rupture' ? 10 : 7,
      false,
    );
    g.notice(e.d.name + ' / VITAL CORE EXPOSED', 2);
  }
  const stage = e.hp < e.d.hp * 0.35 ? 2 : e.hp < e.d.hp * 0.7 ? 1 : 0;
  if (stage > e.reinforced) {
    e.reinforced = stage;
    if (pattern === 'hatch' && e.components.deployer <= 0) return;
    const types =
      pattern === 'hatch'
        ? ['nipper', 'nipper', 'spore']
        : pattern === 'rupture'
          ? ['carapace']
          : pattern === 'nova'
            ? ['thrall', 'weaver']
            : ['prism', 'phaseblade'];
    for (const type of types) {
      if (manager.list.length >= 24) break;
      const p = g.map.spawns.find((p) => p.distanceTo(g.player.position) > 14) || g.map.spawns[0];
      const child = manager.spawn(type, p);
      child.rewardScale = 0.4;
    }
    g.notice(
      e.d.name + ' / ' + (e.d.faction === 'brood' ? 'HATCHLINGS EMERGE' : 'REINFORCEMENTS ARRIVE'),
      2,
    );
  }
}
