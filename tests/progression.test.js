import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProgress, purchase, equip, matchReward } from '../src/progression.js';
import { WEAPONS, ENEMIES } from '../src/data.js';
import { DIFFICULTIES } from '../src/content.js';
import { buildEncounter } from '../src/director.js';
const createRoster = (i, m, d) => buildEncounter(i, m, d, {}, () => 0.5).roster;
test('combat class migration preserves ranged defaults and validates melee kits', () => {
  assert.equal(normalizeProgress({}).combatClass, 'ranged');
  for (const kit of ['energy', 'spear', 'aegis']) {
    const save = normalizeProgress({ combatClass: 'melee', meleeKit: kit });
    assert.equal(save.combatClass, 'melee');
    assert.equal(save.meleeKit, kit);
  }
  const malformed = normalizeProgress({ combatClass: true, meleeKit: 'unknown' });
  assert.equal(malformed.combatClass, 'ranged');
  assert.equal(malformed.meleeKit, 'energy');
});
test('Phase I saves migrate without losing record and all definitions have unique IDs', () => {
  const p = normalizeProgress({ best: 1500, settings: { fov: 90 } });
  assert.equal(p.best, 1500);
  assert.equal(p.credits, 300);
  assert.equal(p.loadout.length, 5);
  assert.equal(new Set(WEAPONS.map((w) => w.id)).size, 18);
  assert.equal(Object.keys(ENEMIES).length, 26);
});
test('unlock transaction rejects insufficient funds and repeats; loadout swaps and enforces categories', () => {
  const p = normalizeProgress({});
  assert.ok(purchase(p, 'spire'));
  assert.equal(p.credits, 150);
  assert.ok(!purchase(p, 'spire'));
  assert.ok(!purchase(p, 'lance'));
  assert.ok(equip(p, 'spire', 0));
  assert.ok(!equip(p, 'spire', 4));
  assert.ok(equip(p, 'needle', 1));
  assert.equal(p.loadout[2], 'breach');
  assert.equal(new Set(p.loadout).size, 5);
});
test('corrupt loadout and progression sanitize to playable defaults', () => {
  for (const s of [
    { credits: -20, loadout: ['needle', 'needle', 'needle'], map: 'bad', difficulty: 'bad' },
    { credits: NaN, unlocked: [null, 'bad'], loadout: 'bad' },
  ]) {
    const p = normalizeProgress(s);
    assert.ok(p.credits >= 0);
    assert.equal(p.map, 'ashworks');
    assert.equal(new Set(p.loadout).size, 5);
    for (const id of p.loadout) assert.ok(p.unlocked.includes(id));
  }
});
test('difficulty changes roster budgets, introduces elites, and keeps one boss', () => {
  for (const map of ['ashworks', 'sunbreak', 'whiteout'])
    for (const d of Object.keys(DIFFICULTIES))
      for (let i = 0; i < 8; i++) {
        const list = createRoster(i, map, d);
        assert.ok(list.every((id) => ENEMIES[id]));
        assert.equal(list.filter((id) => ENEMIES[id].boss).length, [5, 7].includes(i) ? 1 : 0);
      }
  assert.ok(
    createRoster(4, 'ashworks', 'nightmare').length > createRoster(4, 'ashworks', 'recruit').length,
  );
});
test('match rewards are useful on defeat and improved for victory/difficulty', () => {
  const stats = { kills: 15 };
  assert.ok(matchReward(stats, 2, false, 'operative') >= 80);
  assert.ok(matchReward(stats, 6, true, 'veteran') > matchReward(stats, 6, true, 'recruit'));
});
