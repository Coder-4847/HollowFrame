import { UPGRADES } from './expansion.js';
export function buyUpgrade(game, id) {
  const u = UPGRADES.find((x) => x.id === id),
    rank = game.upgrades[id] || 0;
  if (
    !u ||
    rank >= u.max ||
    game.scrap < u.cost ||
    game.waves.breakTime <= 0 ||
    game.waves.index < 0
  )
    return false;
  game.scrap -= u.cost;
  game.upgrades[id] = rank + 1;
  return true;
}
export const modifier = (ranks, id, perRank) => 1 + (ranks?.[id] || 0) * perRank;
