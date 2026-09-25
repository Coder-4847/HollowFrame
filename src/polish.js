import { DEFAULT_SETTINGS } from './data.js';
export const POLISH_DEFAULTS = {
  invertY: false,
  toggleAim: false,
  toggleCrouch: false,
  reducedMotion: false,
  highContrast: false,
  hints: true,
  performance: false,
  brightness: 1.15,
};
export function normalizeSettings(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const defaults = { ...DEFAULT_SETTINGS, ...POLISH_DEFAULTS },
    result = { ...defaults };
  for (const [key, min, max] of [
    ['volume', 0, 1],
    ['music', 0, 1],
    ['effects', 0, 1],
    ['sensitivity', 0.2, 3],
    ['fov', 65, 105],
    ['shake', 0, 1],
    ['brightness', 0.75, 1.6],
  ])
    if (Number.isFinite(source[key])) result[key] = Math.max(min, Math.min(max, source[key]));
  for (const key of Object.keys(defaults))
    if (typeof defaults[key] === 'boolean' && typeof source[key] === 'boolean')
      result[key] = source[key];
  if (['low', 'medium', 'high'].includes(source.quality)) result.quality = source.quality;
  return result;
}
export function fieldHint(game) {
  if (!game.settings.hints) return '';
  if (game.player.hp < 35)
    return game.equipmentCharges && game.save.equipment === 'repair'
      ? 'FRAME CRITICAL · Q to repair. Break line of sight.'
      : 'FRAME CRITICAL · Find cover. Clearing a wave restores health.';
  if (game.map?.voidFloor && game.waves.breakTime > 0)
    return 'ROOFTOPS · Falling is lethal. Stair bridges link all floors; mantle stacks lead to jump shortcuts.';
  if (game.meleeClass?.active && (game.elapsed < 35 || game.waves.breakTime > 0))
    return 'LMB attack · RMB guard · Watch stamina. Release guard to recover. Q uses equipment.';
  if (game.waves.breakTime > 0)
    return game.waves.index < 0
      ? 'WASD move · Mouse aim · LMB fire · E when ready. Amber sensors bypass armor.'
      : 'B spends run scrap on upgrades · E starts the next wave. Alloy unlocks stay permanent.';
  if (game.weapons.ammo.overheated)
    return 'Heat lock · R vents the cell. Swap weapons while it cools.';
  if (game.weapons.ammo.mag === 0 && !game.weapons.current.energy)
    return 'R reloads · 1–5 or wheel switches your equipped weapons.';
  if (game.waves.encounter?.kind === 'blackout')
    return 'BLACKOUT · Follow glowing sensors and telegraphs. Keep cover nearby.';
  if (game.elapsed < 35)
    return 'Strafe to dodge bolts · RMB aims · V melees · Q uses your equipment.';
  return '';
}
