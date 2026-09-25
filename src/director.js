import { ENEMIES } from './data.js';
import { DIFFICULTIES } from './content.js';
import { FACTIONS, FACTION_ROLES, normalizeFactions } from './factions.js';
export const WAVE_COUNT = 8;
export const WAVE_RULES = [
  {
    name: 'FIRST CONTACT',
    kind: 'standard',
    budget: 8,
    pool: ['skitter', 'warden'],
    interval: 1.6,
  },
  {
    name: 'SHIELDED ADVANCE',
    kind: 'standard',
    budget: 15,
    pool: ['warden', 'bulwark', 'mender', 'skitter'],
    interval: 1.3,
  },
  {
    name: 'MISSILE STORM',
    kind: 'missiles',
    budget: 23,
    pool: ['bastion', 'lancer', 'volatile', 'warden'],
    interval: 1.3,
  },
  {
    name: 'SWARM PROTOCOL',
    kind: 'swarm',
    budget: 19,
    pool: ['skitter', 'volatile', 'fabricator'],
    interval: 0.7,
  },
  {
    name: 'BLACKOUT',
    kind: 'blackout',
    budget: 24,
    pool: ['shade', 'cantor', 'warden', 'mender', 'skitter'],
    interval: 1.1,
  },
  {
    name: 'THE FIRST SIGNAL',
    kind: 'boss',
    budget: 17,
    pool: ['bulwark', 'mender', 'skitter', 'lancer'],
    interval: 2,
  },
  {
    name: 'ELITE PROCESSION',
    kind: 'elite',
    budget: 34,
    pool: ['bastion', 'fabricator', 'cantor', 'bulwark', 'lancer', 'shade'],
    interval: 1.1,
  },
  {
    name: 'SEVER THE CHOIR',
    kind: 'boss',
    budget: 24,
    pool: ['warden', 'mender', 'shade', 'volatile', 'cantor'],
    interval: 1.5,
  },
];

export function buildEncounter(
  index,
  map,
  difficulty,
  performance = {},
  random = Math.random,
  factions,
) {
  const selection = normalizeFactions(factions);
  const active = Object.keys(FACTIONS).filter((id) => selection[id]);
  const translate = (id, faction) => (faction === 'choir' ? id : FACTION_ROLES[faction][id]);
  const rule = WAVE_RULES[index],
    diff = DIFFICULTIES[difficulty];
  // Adaptive pressure is deliberately bounded. It never changes machine health.
  const accuracy = performance.shots ? performance.hits / performance.shots : 0.5;
  const adapt =
    index === 0
      ? 1
      : performance.health < 35
        ? 0.85
        : accuracy > 0.6 && performance.health > 75
          ? 1.12
          : 1;
  const budget = Math.round(rule.budget * diff.budget * adapt),
    machinePool = [...rule.pool];
  if (index > 1 && map === 'sunbreak' && rule.kind === 'standard') machinePool.push('lancer');
  if (index > 1 && map === 'whiteout' && rule.kind !== 'swarm') machinePool.push('bulwark');
  if (index > 1 && map === 'deepwell' && rule.kind !== 'swarm') machinePool.push('fabricator');
  if (index > 1 && map === 'cinderline') machinePool.push('shade');
  const pool = [
    ...new Set(active.flatMap((faction) => machinePool.map((id) => translate(id, faction)))),
  ];
  const roster = [];
  let remaining = budget;
  // Guarantee the advertised threat before filling the remaining budget.
  const signature = {
    missiles: 'bastion',
    swarm: 'fabricator',
    blackout: 'shade',
    elite: 'cantor',
  }[rule.kind];
  for (const faction of active) {
    const id = translate(signature || 'skitter', faction);
    if ((signature || active.length > 1) && ENEMIES[id].cost <= remaining) {
      roster.push(id);
      remaining -= ENEMIES[id].cost;
    }
  }
  while (remaining > 0 && roster.length < 28) {
    const choices = pool.filter((id) => ENEMIES[id].cost <= remaining);
    if (!choices.length) break;
    const id = choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
    roster.push(id);
    remaining -= ENEMIES[id].cost;
  }
  if (rule.kind === 'boss') {
    const final = ['deepwell', 'cinderline', 'whiteout'].includes(map) ? 'architect' : 'conductor';
    const bosses =
      active.length === 1
        ? [
            active[0] === 'choir'
              ? index === 7
                ? final
                : final === 'architect'
                  ? 'conductor'
                  : 'architect'
              : FACTIONS[active[0]].bosses[index === 7 ? 1 : 0],
          ]
        : (index === 7 ? active.slice(1) : active.slice(0, 1)).map(
            (faction) => FACTIONS[faction].bosses[index === 7 ? 1 : 0],
          );
    roster.unshift(...bosses);
  }
  return {
    name:
      active.length === 1 && active[0] === 'choir'
        ? rule.name
        : [
            'FIRST CONTACT',
            'ARMORED ADVANCE',
            'RANGED SIEGE',
            'SWARM',
            'BLACKOUT',
            'APEX CONTACT',
            'ELITE HUNT',
            'FINAL CONVERGENCE',
          ][index],
    kind: rule.kind,
    budget,
    spent: budget - remaining,
    roster,
    interval: rule.interval / diff.aggression,
    eliteChance: rule.kind === 'elite' ? Math.max(0.5, diff.elite) : diff.elite,
  };
}
