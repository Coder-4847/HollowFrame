import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEncounter, WAVE_COUNT } from '../src/director.js';
import { MAPS, DIFFICULTIES } from '../src/content.js';
import { ENEMIES } from '../src/data.js';
import { buyUpgrade, modifier } from '../src/upgrades.js';
test('director never exceeds escort budget and bounds adaptive pressure', () => {
  for (const map of MAPS)
    for (const d of Object.keys(DIFFICULTIES))
      for (let n = 0; n < WAVE_COUNT; n++) {
        const r = buildEncounter(n, map.id, d, { health: 100, shots: 100, hits: 90 }, () => 0.35);
        const spent = r.roster
          .filter((id) => !ENEMIES[id].boss)
          .reduce((s, id) => s + ENEMIES[id].cost, 0);
        assert.equal(spent, r.spent);
        assert.ok(spent <= r.budget);
        assert.ok(r.roster.length <= 29);
      }
  const normal = buildEncounter(3, 'ashworks', 'operative', {}, () => 0.5),
    weak = buildEncounter(3, 'ashworks', 'operative', { health: 20 }, () => 0.5),
    strong = buildEncounter(
      3,
      'ashworks',
      'operative',
      { health: 100, shots: 100, hits: 90 },
      () => 0.5,
    );
  assert.ok(weak.budget < normal.budget && strong.budget > normal.budget);
  assert.ok(strong.budget <= normal.budget * 1.2);
});
test('operations contain two distinct bosses and the special-wave signature', () => {
  for (const m of MAPS) {
    const bosses = [5, 7].map((i) =>
      buildEncounter(i, m.id, 'operative', {}, () => 0.5).roster.find((id) => ENEMIES[id].boss),
    );
    assert.equal(new Set(bosses).size, 2);
  }
  assert.ok(buildEncounter(2, 'ashworks', 'operative').roster.includes('bastion'));
  assert.ok(buildEncounter(4, 'ashworks', 'operative').roster.includes('shade'));
});
test('upgrades spend only run scrap during intermission and enforce rank caps', () => {
  const g = { upgrades: {}, scrap: 300, waves: { breakTime: 20, index: 0 } };
  assert.ok(buyUpgrade(g, 'loader'));
  assert.ok(buyUpgrade(g, 'loader'));
  assert.equal(g.scrap, 100);
  assert.ok(!buyUpgrade(g, 'loader'));
  assert.equal(modifier(g.upgrades, 'loader', -0.18), 0.64);
  g.waves.breakTime = 0;
  assert.ok(!buyUpgrade(g, 'stride'));
  assert.equal(g.scrap, 100);
});
