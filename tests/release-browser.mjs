import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const channel = process.env.HF_BROWSER || 'chrome',
  browser = await chromium.launch({
    channel,
    headless: true,
    args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
  errors = [],
  checks = [];
page.on('pageerror', (e) => errors.push(e.message));
const check = (name, value) => {
  assert.ok(value, name);
  checks.push(name);
  console.log('PASS', name);
};
try {
  await page.goto('http://127.0.0.1:5173');
  await page.waitForFunction(() => !!window.__HOLLOWFRAME__);
  await page.getByRole('button', { name: /SELECT OPERATION/ }).click();
  await page.getByRole('button', { name: /DEPLOY TO/ }).click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  const arsenal = await page.evaluate(async () => {
    const { WEAPONS } = await import('/src/data.js');
    const g = __HOLLOWFRAME__;
    g.waves.breakTime = 999;
    const result = [];
    for (let n = 0; n < WEAPONS.length; n++) {
      g.weapons.equipped = [n];
      g.weapons.switch(n);
      g.weapons.cooldown = 0;
      g.weapons.reloadTime = 0;
      const before = g.stats.shots;
      g.input.fire = true;
      g.input.shot = true;
      g.weapons.update(WEAPONS[n].charge || 0.01);
      g.input.reset();
      result.push({ id: WEAPONS[n].id, fired: g.stats.shots > before });
      g.projectiles.clear();
    }
    return result;
  });
  check(
    'all eighteen equipped weapons fire through the update path',
    arsenal.length === 18 && arsenal.every((w) => w.fired),
  );
  const cluster = await page.evaluate(() => {
    const g = __HOLLOWFRAME__;
    g.projectiles.clear();
    const p = g.player.position.clone().set(0, 15, 0),
      dir = p.clone().set(0, 1, 0);
    g.projectiles.spawn(p, dir, 1, 50, true, 3, { gravity: 1, fuse: 0.01, cluster: true });
    g.projectiles.update(0.02);
    return g.projectiles.pool.filter((p) => p.active && p.equipment).length;
  });
  check('cluster fuse expiration emits four fragments', cluster === 4);
  const memory = await page.evaluate(() => {
    const g = __HOLLOWFRAME__,
      out = [];
    for (let pass = 0; pass < 3; pass++) {
      for (let n = 0; n < 8; n++) {
        g.enemies.clear();
        g.projectiles.clear();
        g.fx.clear();
        g.weapons.disposeModel();
        g.weapons.reset();
        g.world.render();
      }
      out.push({ ...g.world.renderer.info.memory, children: g.world.scene.children.length });
    }
    return out;
  });
  check(
    'repeated weapon reset keeps GPU resources stable',
    JSON.stringify(memory[1]) === JSON.stringify(memory[2]),
  );
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /SYSTEM SETTINGS/ }).click();
  await page.getByRole('button', { name: /RESET LOCAL RECORD/ }).click();
  await page.getByRole('button', { name: 'CANCEL', exact: true }).click();
  check(
    'canceling reset preserves progress',
    await page.evaluate(() => __HOLLOWFRAME__.save.credits === 300),
  );
  await page.evaluate(() => localStorage.setItem('hollowframe-v1', '{broken'));
  await page.reload();
  await page.waitForFunction(() => !!window.__HOLLOWFRAME__);
  check(
    'malformed saved JSON still launches with issued loadout',
    await page.evaluate(
      () => __HOLLOWFRAME__.save.loadout.length === 5 && __HOLLOWFRAME__.save.credits === 300,
    ),
  );
  const restricted = await browser.newPage();
  restricted.on('pageerror', (e) => errors.push(e.message));
  await restricted.addInitScript(() =>
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('storage denied');
      },
    }),
  );
  await restricted.goto('http://127.0.0.1:5173');
  await restricted.waitForFunction(() => !!window.__HOLLOWFRAME__);
  check(
    'storage-denied launch keeps visible session-only warning',
    await restricted
      .locator('.error-toast')
      .textContent()
      .then((t) => t.includes('session only')),
  );
  await restricted.close();
  const invalid = await browser.newPage();
  invalid.on('pageerror', (e) => errors.push(e.message));
  await invalid.addInitScript(() =>
    localStorage.setItem(
      'hollowframe-v1',
      JSON.stringify({
        version: 1,
        best: 1234,
        credits: -90,
        loadout: ['missing'],
        settings: { fov: 'bad', quality: 'ultra', toggleAim: 'yes' },
      }),
    ),
  );
  await invalid.goto('http://127.0.0.1:5173');
  await invalid.waitForFunction(() => !!window.__HOLLOWFRAME__);
  check(
    'legacy malformed fields migrate without losing valid best score',
    await invalid.evaluate(() => {
      const g = __HOLLOWFRAME__;
      return (
        g.save.best === 1234 &&
        g.save.credits === 0 &&
        g.settings.fov === 80 &&
        g.settings.toggleAim === false &&
        g.save.loadout.length === 5
      );
    }),
  );
  await invalid.close();
  check('release scenarios have no page errors', errors.length === 0);
} catch (e) {
  errors.push(e.message);
  console.error(e);
  process.exitCode = 1;
} finally {
  await fs.mkdir('artifacts', { recursive: true });
  await fs.writeFile(
    `artifacts/release-${channel}.json`,
    JSON.stringify({ checks, errors }, null, 2),
  );
  await browser.close();
}
