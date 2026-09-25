import { lowQuality } from './low-quality.mjs';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser = await chromium.launch({
  channel: process.env.HF_BROWSER || 'chrome',
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
  await lowQuality(page);
  await page.goto('http://127.0.0.1:5173');
  await page.waitForFunction(() => !!window.__HOLLOWFRAME__);
  await page.getByRole('button', { name: /SELECT OPERATION/ }).click();
  await page.getByRole('button', { name: /DEPLOY TO/ }).click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  await page.evaluate(() => {
    const g = __HOLLOWFRAME__;
    g.waves.breakTime = 999;
    g.world.colliders = [];
    g.player.reset();
    g.player.position.set(0, 0, 5);
    g.player.update(0);
  });
  await page.keyboard.down('KeyW');
  await page.keyboard.down('ShiftLeft');
  await page.waitForTimeout(500);
  await page.keyboard.down('KeyC');
  await page.waitForFunction(() => __HOLLOWFRAME__.player.parkour.slide > 0);
  check(
    'sprint crouch enters slide through keyboard input',
    await page.evaluate(
      () =>
        __HOLLOWFRAME__.player.crouch &&
        Math.hypot(__HOLLOWFRAME__.player.velocity.x, __HOLLOWFRAME__.player.velocity.z) > 8,
    ),
  );
  await page.keyboard.press('Space');
  await page.waitForFunction(() => __HOLLOWFRAME__.player.parkour.momentum > 0);
  check(
    'slide jump preserves momentum',
    await page.evaluate(() => !__HOLLOWFRAME__.player.grounded),
  );
  await page.keyboard.up('KeyC');
  await page.keyboard.up('ShiftLeft');
  await page.keyboard.up('KeyW');
  await page.evaluate(() => {
    const g = __HOLLOWFRAME__;
    g.player.reset();
    g.player.position.set(0, 1, -0.6);
    g.player.grounded = false;
    g.world.colliders = [{ x: 0, z: -1.5, w: 6, d: 1, bottom: 0, top: 5 }];
    g.player.update(0);
  });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => __HOLLOWFRAME__.player.parkour.kicks === 1);
  check(
    'wall jump pushes away from wall',
    await page.evaluate(
      () => __HOLLOWFRAME__.player.velocity.z > 5 && __HOLLOWFRAME__.player.velocity.y > 0,
    ),
  );
  await page.evaluate(() => {
    const g = __HOLLOWFRAME__;
    g.player.reset();
    g.player.position.set(0, 0, 0);
    g.world.colliders = [{ x: 0, z: -1.5, w: 3, d: 2, bottom: 0, top: 1.5 }];
    g.player.update(0);
  });
  await page.keyboard.down('KeyW');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => !!__HOLLOWFRAME__.player.parkour.mantle);
  await page.keyboard.up('KeyW');
  check(
    'mantle HUD reports the traversal',
    await page
      .locator('#movement-state')
      .textContent()
      .then((t) => t === 'MANTLING'),
  );
  await page.mouse.down();
  const shots = await page.evaluate(() => __HOLLOWFRAME__.stats.shots);
  await page.waitForTimeout(70);
  check(
    'mantling blocks firing',
    await page.evaluate((n) => __HOLLOWFRAME__.stats.shots === n, shots),
  );
  await page.mouse.up();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => __HOLLOWFRAME__.state === 'paused');
  const pos = await page.evaluate(() => __HOLLOWFRAME__.player.position.toArray());
  await page.waitForTimeout(150);
  check(
    'pause freezes an active mantle',
    await page.evaluate(
      (a) => JSON.stringify(a) === JSON.stringify(__HOLLOWFRAME__.player.position.toArray()),
      pos,
    ),
  );
  await page.getByRole('button', { name: /RESUME OPERATION/ }).click();
  await page.waitForFunction(() => !__HOLLOWFRAME__.player.parkour.mantle);
  check(
    'mantle resumes onto ledge',
    await page.evaluate(() => Math.abs(__HOLLOWFRAME__.player.position.y - 1.5) < 0.01),
  );
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /RESTART OPERATION/ }).click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  check(
    'restart resets movement state',
    await page.evaluate(() => {
      const m = __HOLLOWFRAME__.player.parkour;
      return !m.mantle && !m.slide && !m.kicks && !m.momentum;
    }),
  );
  check('no browser errors', errors.length === 0);
} catch (e) {
  errors.push(e.message);
  console.error(e);
  process.exitCode = 1;
} finally {
  await fs.mkdir('artifacts', { recursive: true });
  await fs.writeFile(
    'artifacts/movement-' + (process.env.HF_BROWSER || 'chrome') + '.json',
    JSON.stringify({ checks, errors }, null, 2),
  );
  await browser.close();
}
