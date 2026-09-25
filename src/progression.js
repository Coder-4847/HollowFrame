import { WEAPONS } from './data.js';
import { normalizeFactions } from './factions.js';
import { MELEE_KITS } from './melee-class.js';
import { MAPS, DIFFICULTIES, EQUIPMENT, MELEE, LOADOUT_SLOTS } from './content.js';
export const DEFAULT_LOADOUT = ['rivet', 'breach', 'needle', 'cinder', 'relay'];
export function normalizeProgress(save = {}) {
  const unlocked = [
    ...new Set([...DEFAULT_LOADOUT, ...(Array.isArray(save.unlocked) ? save.unlocked : [])]),
  ].filter((id) => WEAPONS.some((w) => w.id === id));
  const used = new Set();
  const loadout = LOADOUT_SLOTS.map((slot, n) => {
    const id = save.loadout?.[n],
      w = WEAPONS.find((w) => w.id === id);
    const valid = w && w.category === slot.category && unlocked.includes(id) && !used.has(id);
    const chosen = valid ? id : DEFAULT_LOADOUT[n];
    used.add(chosen);
    return chosen;
  });
  // Resolve malformed saves whose fallback would duplicate an earlier choice.
  for (let n = 0; n < loadout.length; n++)
    if (loadout.indexOf(loadout[n]) !== n)
      loadout[n] = WEAPONS.find(
        (w) =>
          w.category === LOADOUT_SLOTS[n].category &&
          unlocked.includes(w.id) &&
          !loadout.includes(w.id),
      ).id;
  return {
    ...save,
    version: 4,
    factions: normalizeFactions(save.factions),
    combatClass: save.combatClass === 'melee' ? 'melee' : 'ranged',
    meleeKit: Object.hasOwn(MELEE_KITS, save.meleeKit) ? save.meleeKit : 'energy',
    best: Number.isFinite(save.best) ? Math.max(0, save.best) : 0,
    credits: Number.isFinite(save.credits) ? Math.max(0, Math.floor(save.credits)) : 300,
    unlocked,
    loadout,
    equipment: Object.hasOwn(EQUIPMENT, save.equipment) ? save.equipment : 'repair',
    melee: Object.hasOwn(MELEE, save.melee) ? save.melee : 'blade',
    map: MAPS.some((m) => m.id === save.map) ? save.map : 'ashworks',
    difficulty: Object.hasOwn(DIFFICULTIES, save.difficulty) ? save.difficulty : 'operative',
    records: cleanRecords(save.records),
    runs: Number.isFinite(save.runs) ? Math.max(0, Math.floor(save.runs)) : 0,
    wins: Number.isFinite(save.wins) ? Math.max(0, Math.floor(save.wins)) : 0,
  };
}
function cleanRecords(records) {
  const result = {};
  for (const m of MAPS)
    for (const d of Object.keys(DIFFICULTIES)) {
      const key = m.id + '-' + d,
        r = records?.[key];
      if (r && typeof r === 'object')
        result[key] = {
          best: Number.isFinite(r.best) ? Math.max(0, r.best) : 0,
          wins: Number.isFinite(r.wins) ? Math.max(0, r.wins) : 0,
          runs: Number.isFinite(r.runs) ? Math.max(0, r.runs) : 0,
          bestTime: Number.isFinite(r.bestTime) && r.bestTime > 0 ? r.bestTime : null,
        };
    }
  return result;
}
export function purchase(save, id) {
  const w = WEAPONS.find((w) => w.id === id);
  if (!w || save.unlocked.includes(id) || save.credits < w.cost) return false;
  save.credits -= w.cost;
  save.unlocked.push(id);
  return true;
}
export function equip(save, id, slot) {
  const w = WEAPONS.find((w) => w.id === id);
  if (!w || !save.unlocked.includes(id) || w.category !== LOADOUT_SLOTS[slot]?.category)
    return false;
  const old = save.loadout.indexOf(id);
  if (old >= 0) save.loadout[old] = save.loadout[slot];
  save.loadout[slot] = id;
  return true;
}
export function matchReward(stats, completed, won, difficulty) {
  return Math.round(
    (stats.kills * 3 + completed * 20 + (won ? 180 : 0)) * DIFFICULTIES[difficulty].reward,
  );
}
