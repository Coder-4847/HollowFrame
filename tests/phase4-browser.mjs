import { lowQuality, settled } from './low-quality.mjs';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const channel = process.env.HF_BROWSER || 'chrome',
  browser = await chromium.launch({
    channel,
    headless: true,
    args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } }),
  errors = [],
  checks = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('response', (r) => {
  if (r.status() >= 400) errors.push(r.status() + ' ' + r.url());
});
const check = (name, value) => {
  assert.ok(value, name);
  checks.push(name);
  console.log('PASS', name);
};
try {
  await lowQuality(page);
  await page.goto('http://127.0.0.1:5173');
  await page.waitForFunction(() => !!window.__HOLLOWFRAME__);
  check(
    'keyboard focus starts on primary menu action',
    await page.evaluate(() => document.activeElement?.dataset.action === 'deploy'),
  );
  await page.getByRole('button', { name: /SYSTEM SETTINGS/ }).click();
  for (const key of [
    'toggleAim',
    'toggleCrouch',
    'invertY',
    'reducedMotion',
    'highContrast',
    'performance',
  ])
    await page.locator(`[data-toggle=${key}]`).check();
  await page.locator('[data-setting=brightness]').fill('1.3');
  await page.locator('[data-setting=volume]').fill('0.25');
  check(
    'successive settings changes remain applied',
    await page.evaluate(() => {
      const g = __HOLLOWFRAME__;
      return (
        g.settings.toggleAim &&
        g.settings.highContrast &&
        g.settings.volume === 0.25 &&
        g.world.renderer.toneMappingExposure === 1.3
      );
    }),
  );
  await page.screenshot({ path: 'artifacts/phase4-settings.png', fullPage: true });
  await page.reload();
  await page.waitForFunction(() => !!window.__HOLLOWFRAME__);
  check(
    'accessibility preferences survive reload',
    await page.evaluate(
      () =>
        __HOLLOWFRAME__.settings.toggleCrouch &&
        document.documentElement.classList.contains('reduced-motion'),
    ),
  );
  await page.getByRole('button', { name: /SELECT OPERATION/ }).click();
  await page.getByRole('button', { name: /DEPLOY TO ASHWORKS/ }).click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  await settled(page);
  await page.evaluate(() => {
    __HOLLOWFRAME__.waves.breakTime = 999;
  });
  await page.waitForTimeout(100);
  check('contextual onboarding shown in field', await page.locator('#field-tip').isVisible());
  await page.mouse.click(700, 400, { button: 'right' });
  await page.waitForFunction(() => __HOLLOWFRAME__.input.aim);
  check('toggle aim survives mouse release', await page.evaluate(() => __HOLLOWFRAME__.input.aim));
  await page.mouse.click(700, 400, { button: 'right' });
  await page.waitForFunction(() => !__HOLLOWFRAME__.input.aim);
  await page.keyboard.press('KeyC');
  await page.waitForFunction(() => __HOLLOWFRAME__.player.crouch);
  check(
    'toggle crouch survives key release',
    await page.evaluate(() => __HOLLOWFRAME__.input.crouchToggle),
  );
  await page.keyboard.press('KeyC');
  await page.waitForFunction(() => !__HOLLOWFRAME__.player.crouch);
  check(
    'inverted look and reduced-motion camera are functional',
    await page.evaluate(() => {
      const g = __HOLLOWFRAME__;
      g.input.dy = 10;
      g.player.pitch = 0;
      g.player.update(0);
      g.input.end();
      return g.player.pitch > 0 && g.world.camera.rotation.z === 0;
    }),
  );
  check(
    'automatic weapon preserves a tap between frames',
    await page.evaluate(() => {
      const g = __HOLLOWFRAME__,
        before = g.weapons.ammo.mag;
      g.input.fire = false;
      g.input.shot = true;
      g.weapons.cooldown = 0;
      g.weapons.update(0);
      g.input.end();
      return g.weapons.ammo.mag === before - 1;
    }),
  );
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.keyboard.press('KeyR');
  await page.waitForFunction(() => __HOLLOWFRAME__.weapons.reloadTime > 0);
  await page.waitForTimeout(120);
  check(
    'reload progress is visible',
    await page.evaluate(
      () => document.querySelector('#action-track').style.visibility === 'visible',
    ),
  );
  check(
    'muzzle flash suppressed in reduced motion',
    await page.evaluate(() => {
      const g = __HOLLOWFRAME__;
      g.weapons.flashTime = 0.2;
      g.weapons.update(0);
      return !g.weapons.flash.visible;
    }),
  );
  await page.evaluate(() => {
    const g = __HOLLOWFRAME__;
    g.weapons.reloadTime = 0;
    g.player.pitch = 0;
    g.player.update(0);
    const p = g.player.position.clone();
    p.z -= 8;
    const e = g.enemies.spawn('warden', p);
    g.enemies.hit(e, 'sensor', { damage: 999, range: 100, penetration: 1, weak: 1 }, p, 8);
    g.ui.hudClock = 0;
    g.ui.update(0);
  });
  check(
    'kill feed and target readout label confirmed damage',
    (await page
      .locator('#kill-feed')
      .textContent()
      .then((t) => t.includes('SCRAP'))) &&
      (await page
        .locator('#target-readout')
        .textContent()
        .then((t) => t.includes('NEUTRALIZED'))),
  );
  check('performance display is available', await page.locator('#performance-readout').isVisible());
  await page.screenshot({ path: 'artifacts/phase4-field.png' });
  await page.evaluate(() => {
    const g = __HOLLOWFRAME__;
    g.noticeTime = 0;
    g.notice('ARCHITECT / SWEEP — USE COVER', 2);
    g.notice('PLATING BROKEN', 1);
  });
  check(
    'danger telegraphs survive incidental damage notices',
    await page.evaluate(() => __HOLLOWFRAME__.noticeText.includes('SWEEP')),
  );
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => __HOLLOWFRAME__.state === 'paused');
  check(
    'pause clears toggle input',
    await page.evaluate(() => !__HOLLOWFRAME__.input.aim && !__HOLLOWFRAME__.input.crouchToggle),
  );
  await page.getByRole('button', { name: /RESUME OPERATION/ }).click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  await settled(page);
  await page.evaluate(() => {
    const g = __HOLLOWFRAME__;
    g.waves.index = 0;
    g.waves.breakTime = 20;
  });
  await page.keyboard.press('KeyB');
  await page.waitForFunction(() => __HOLLOWFRAME__.state === 'upgrading');
  const frozen = await page.evaluate(() => __HOLLOWFRAME__.world.animated.map((o) => o.rotation.z));
  await page.waitForTimeout(250);
  check(
    'upgrade terminal freezes scene animation',
    await page.evaluate(
      (a) =>
        JSON.stringify(a) ===
        JSON.stringify(__HOLLOWFRAME__.world.animated.map((o) => o.rotation.z)),
      frozen,
    ),
  );
  await page.evaluate(() => {
    const a = __HOLLOWFRAME__.audio;
    for (let n = 0; n < 200; n++) a.tone(200, 0.2, 0.001);
  });
  check(
    'audio burst caps simultaneous voices',
    await page.evaluate(() => __HOLLOWFRAME__.audio.voices <= __HOLLOWFRAME__.audio.maxVoices),
  );
  await page.waitForTimeout(1100);
  check('audio voices are released', await page.evaluate(() => __HOLLOWFRAME__.audio.voices === 0));
  await page.evaluate(() => __HOLLOWFRAME__.toMenu());
  await page.setViewportSize({ width: 960, height: 640 });
  await page.getByRole('button', { name: /SYSTEM SETTINGS/ }).click();
  await page.locator('[data-toggle=hints]').scrollIntoViewIfNeeded();
  await page.locator('[data-toggle=hints]').uncheck();
  check(
    'compact settings remain scrollable without horizontal overflow',
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  await page.screenshot({ path: 'artifacts/phase4-compact.png' });
  check('no page errors or missing assets', errors.length === 0);
} catch (e) {
  console.error(e);
  errors.push(e.message);
  process.exitCode = 1;
  await page.screenshot({ path: 'artifacts/phase4-failure.png' });
} finally {
  await fs.mkdir('artifacts', { recursive: true });
  await fs.writeFile(
    `artifacts/phase4-${channel}.json`,
    JSON.stringify({ checks, errors }, null, 2),
  );
  await browser.close();
}
