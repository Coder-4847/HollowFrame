import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSettings, fieldHint } from '../src/polish.js';
test('settings validate numeric limits and strict booleans without dropping accessibility defaults', () => {
  const s = normalizeSettings({
    brightness: 99,
    volume: -1,
    fov: NaN,
    toggleAim: 'yes',
    highContrast: true,
    quality: 'broken',
    sensitivity: Infinity,
  });
  assert.equal(s.brightness, 1.6);
  assert.equal(s.volume, 0);
  assert.equal(s.fov, 80);
  assert.equal(s.toggleAim, false);
  assert.equal(s.highContrast, true);
  assert.equal(s.quality, 'high');
  assert.equal(s.sensitivity, 1);
  assert.equal(normalizeSettings(null).hints, true);
});
test('critical field tips take priority and can be disabled', () => {
  const g = {
    settings: { hints: true },
    player: { hp: 20 },
    equipmentCharges: 1,
    save: { equipment: 'repair' },
    waves: { breakTime: 10, index: 0 },
    weapons: { ammo: {} },
    elapsed: 0,
  };
  assert.match(fieldHint(g), /Q to repair/);
  g.settings.hints = false;
  assert.equal(fieldHint(g), '');
  g.settings.hints = true;
  g.player.hp = 100;
  assert.match(fieldHint(g), /B spends/);
});
