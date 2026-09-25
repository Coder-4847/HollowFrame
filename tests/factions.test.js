import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FACTIONS, normalizeFactions } from '../src/factions.js';
import { ENEMIES } from '../src/data.js';
import { buildEncounter } from '../src/director.js';
import { normalizeProgress } from '../src/progression.js';
import { DIFFICULTIES } from '../src/content.js';
test('faction selection migrates legacy saves and rejects empty or malformed selection', () => {
  for (const factions of [
    undefined,
    {},
    { brood: 'true' },
    { choir: false, veil: false, brood: false },
  ])
    assert.deepEqual(normalizeFactions(factions), { choir: true, brood: false, veil: false });
  assert.deepEqual(
    normalizeProgress({ best: 123, factions: { brood: true, veil: true } }).factions,
    { choir: false, brood: true, veil: true },
  );
});
test('every faction has distinct regular roles and two valid bosses', () => {
  for (const [faction, def] of Object.entries(FACTIONS)) {
    assert.ok(Object.values(ENEMIES).filter((e) => e.faction === faction && !e.boss).length >= 5);
    assert.equal(new Set(def.bosses).size, 2);
    for (const id of def.bosses) {
      assert.equal(ENEMIES[id].faction, faction);
      assert.ok(ENEMIES[id].boss);
    }
  }
});
test('all seven faction combinations respect selections, escort budgets and boss coverage', () => {
  const ids = Object.keys(FACTIONS);
  for (let bits = 1; bits < 8; bits++) {
    const factions = Object.fromEntries(ids.map((id, n) => [id, !!(bits & (1 << n))]));
    const seen = new Set(),
      bosses = new Set();
    for (const map of ['ashworks', 'skyline', 'deepwell'])
      for (const difficulty of Object.keys(DIFFICULTIES)) {
        for (let wave = 0; wave < 8; wave++) {
          const encounter = buildEncounter(wave, map, difficulty, {}, () => 0.45, factions);
          let spent = 0;
          for (const id of encounter.roster) {
            const d = ENEMIES[id];
            assert.ok(d);
            assert.ok(factions[d.faction], `${bits}: leaked ${id}`);
            seen.add(d.faction);
            if (d.boss) bosses.add(d.faction);
            else spent += d.cost;
          }
          assert.equal(spent, encounter.spent);
          assert.ok(spent <= encounter.budget);
        }
      }
    assert.deepEqual([...seen].sort(), ids.filter((id) => factions[id]).sort());
    assert.deepEqual([...bosses].sort(), ids.filter((id) => factions[id]).sort());
  }
});
