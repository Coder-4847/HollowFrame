export function updateEnvironment(game, dt) {
  if (game.map.killY !== undefined && game.player.position.y < game.map.killY) {
    game.player.hp = 0;
    game.finish(false);
    return;
  }
  game.quenchTime = Math.max(0, (game.quenchTime || 0) - dt);
  game.quenchCooldown = Math.max(0, (game.quenchCooldown || 0) - dt);
  for (const h of game.map.hazards || []) {
    const phase = (game.elapsed + h.offset) % h.period,
      active = phase < h.activeFor && game.quenchTime <= 0 && game.waves.breakTime <= 0;
    const warning =
      !active && h.period - phase < 1.5 && game.quenchTime <= 0 && game.waves.breakTime <= 0;
    h.marker.material.opacity = active ? 0.85 : warning ? 0.6 : 0.22;
    h.marker.material.color.set(active ? 0xff945d : warning ? 0xffd479 : 0x78b6a1);
    if (
      active &&
      Math.hypot(game.player.position.x - h.x, game.player.position.z - h.z) < h.radius &&
      Math.abs(game.player.position.y - (h.y || 0)) < 1.2
    ) {
      game.player.damage(h.damage * dt, h.marker.position, true);
      game.notice((h.name || 'LIVE DISCHARGE') + ' / LEAVE THE RING', 0.2);
    }
    if (active && Math.random() < dt * 6) {
      game.fx.burst(h.marker.position, 0x91edc6, 2, 3);
      if (h.name === 'STEAM VENT') game.fx.smoke(h.marker.position, 1);
    }
  }
}
