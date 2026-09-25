import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const channel = process.env.HF_BROWSER || 'chrome';
const browser = await chromium.launch({
  channel,
  headless: true,
  args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [],
  checks = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('response', (r) => {
  if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
});
const check = (name, value) => {
  assert.ok(value, name);
  checks.push(name);
  console.log('PASS', name);
};
try {
  await page.goto('http://127.0.0.1:5173');
  await page.waitForFunction(() => !!window.__HOLLOWFRAME__);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `artifacts/${channel}-menu.png` });
  await page.getByRole('button', { name: /OPERATOR MANUAL/ }).click();
  check('manual exposes all controls', (await page.locator('kbd').count()) >= 11);
  await page.getByRole('button', { name: '← BACK' }).click();
  await page.getByRole('button', { name: /FIELD ARMORY/ }).click();
  await page.getByRole('button', { name: /Precision rifle/i }).click();
  check(
    'armory inspection',
    (await page.locator('.weapon-detail h3').textContent()) === 'NEEDLE / 06',
  );
  await page.screenshot({ path: `artifacts/${channel}-armory.png` });
  await page.getByRole('button', { name: '← BACK' }).click();
  await page.getByRole('button', { name: /SYSTEM SETTINGS/ }).click();
  await page.locator('[data-setting=volume]').fill('0.2');
  await page.locator('[data-setting=quality]').selectOption('low');
  await page.reload();
  await page.waitForFunction(() => !!window.__HOLLOWFRAME__);
  check(
    'settings survive reload',
    await page.evaluate(
      () => __HOLLOWFRAME__.settings.volume === 0.2 && __HOLLOWFRAME__.settings.quality === 'low',
    ),
  );
  await page.getByRole('button', { name: /SELECT OPERATION/ }).click();
  await page.getByRole('button', { name: /DEPLOY TO ASHWORKS/ }).click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  check(
    'deployment captures pointer',
    await page.evaluate(() => __HOLLOWFRAME__.state === 'playing'),
  );
  await page.evaluate(() => {
    __HOLLOWFRAME__.waves.breakTime = 1000;
  });
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(600);
  await page.keyboard.up('KeyW');
  check('WASD moves player', await page.evaluate(() => __HOLLOWFRAME__.player.position.z < 19.5));
  await page.keyboard.press('Space');
  await page.waitForTimeout(160);
  check('jump leaves ground', await page.evaluate(() => __HOLLOWFRAME__.player.position.y > 0));
  await page.waitForTimeout(750);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => __HOLLOWFRAME__.state === 'paused');
  const pausedTime = await page.evaluate(() => __HOLLOWFRAME__.elapsed);
  await page.waitForTimeout(300);
  check(
    'pause freezes simulation',
    await page.evaluate((t) => __HOLLOWFRAME__.elapsed === t, pausedTime),
  );
  await page.getByRole('button', { name: /RESUME OPERATION/ }).click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  const weak = await page.evaluate(() => {
    const g = __HOLLOWFRAME__;
    g.player.position.set(0, 0, 20);
    g.player.velocity.set(0, 0, 0);
    g.player.yaw = 0;
    g.player.pitch = Math.atan2(2.27 - 1.72, 9.69);
    g.player.update(0);
    g.enemies.clear();
    const p = g.player.position.clone();
    p.z = 10;
    g.enemies.spawn('warden', p);
    g.world.scene.updateMatrixWorld(true);
    g.weapons.switch(2);
    g.weapons.cooldown = 0;
    g.weapons.fire();
    return { kills: g.stats.kills, weak: g.stats.weak, mag: g.weapons.ammo.mag };
  });
  check(
    'precision sensor shot bypasses armor and kills',
    weak.kills === 1 && weak.weak === 1 && weak.mag === 5,
  );
  const reload = await page.evaluate(() => {
    const g = __HOLLOWFRAME__;
    g.weapons.reload();
    g.weapons.update(2.2);
    return { mag: g.weapons.ammo.mag, reserve: g.weapons.ammo.reserve };
  });
  check('reload transfers finite reserve', reload.mag === 6 && reload.reserve === 47);
  const parts = await page.evaluate(() => {
    const g = __HOLLOWFRAME__;
    const p = g.player.position.clone();
    p.z = 12;
    const e = g.enemies.spawn('bastion', p);
    const w = { damage: 80, range: 100, penetration: 1, weak: 2 };
    g.enemies.hit(e, 'leg', w, p, 0);
    g.enemies.hit(e, 'body', w, p, 0);
    return { slowed: e.legBroken, armor: e.armor, plate: e.plate.visible };
  });
  check(
    'components slow movement and armor breaks',
    parts.slowed && parts.armor === 0 && !parts.plate,
  );
  const stairs = await page.evaluate(() => {
    const g = __HOLLOWFRAME__;
    g.enemies.clear();
    g.player.reset();
    g.player.position.set(-24, 0, 12);
    g.input.keys.add('KeyW');
    for (let i = 0; i < 160; i++) g.player.update(1 / 60);
    g.input.reset();
    return {
      y: g.player.position.y,
      z: g.player.position.z,
      path: g.enemies.nav.path({ x: -24, z: 14 }, g.player.position).length,
    };
  });
  console.log('stairs', stairs);
  check('stairs and raised platform traversal', Math.abs(stairs.y - 2.4) < 0.1 && stairs.path > 0);
  const ai = await page.evaluate(() => {
    const g = __HOLLOWFRAME__;
    g.player.reset();
    g.player.position.set(0, 0, 20);
    g.player.update(0);
    g.enemies.clear();
    g.projectiles.clear();
    const p = g.player.position.clone();
    p.z = 10;
    g.enemies.spawn('warden', p);
    for (let n = 0; n < 420; n++) {
      g.enemies.update(1 / 60);
      g.world.scene.updateMatrixWorld(true);
      g.projectiles.update(1 / 60);
    }
    return {
      hp: g.player.hp,
      armor: g.player.armor,
      projectiles: g.projectiles.pool.filter((p) => p.active).length,
    };
  });
  check('ranged AI attacks player', ai.hp < 100 || ai.armor < 50 || ai.projectiles > 0);
  await page.evaluate(() => {
    const g = __HOLLOWFRAME__;
    g.enemies.clear();
    g.projectiles.clear();
    g.player.reset();
    g.player.update(0);
    g.weapons.switch(0);
    for (const [type, x, z] of [
      ['warden', -3, 10],
      ['bastion', 4, 4],
      ['skitter', 1, 13],
    ]) {
      const p = g.player.position.clone();
      p.set(x, 0, z);
      g.enemies.spawn(type, p);
    }
    g.noticeTime = 0;
    g.waves.breakTime = 0;
    g.waves.index = 2;
    g.waves.queue = ['warden'];
    g.fx.clear();
    g.fx.update(0);
    g.weapons.update(0.25);
    g.world.render();
  });
  await page.screenshot({ path: `artifacts/${channel}-combat.png` });
  await page.evaluate(() => __HOLLOWFRAME__.player.damage(10000));
  check('death opens results', await page.getByText('YOUR SIGNAL WENT DARK.').isVisible());
  await page.getByRole('button', { name: /DEPLOY AGAIN/ }).click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  check(
    'restart clears enemies and resets resources',
    await page.evaluate(
      () =>
        __HOLLOWFRAME__.enemies.list.length === 0 &&
        __HOLLOWFRAME__.player.hp === 100 &&
        __HOLLOWFRAME__.stats.kills === 0,
    ),
  );
  const outcome = await page.evaluate(() => {
    const g = __HOLLOWFRAME__;
    for (let wave = 0; wave < 8; wave++) {
      g.waves.next();
      while (g.waves.queue.length) {
        g.waves.timer = 0;
        g.waves.update(0.01);
        for (const e of [...g.enemies.list]) g.enemies.kill(e);
        g.enemies.update(0);
      }
      g.waves.update(0.01);
    }
    return {
      state: g.state,
      cleared: g.waves.completed,
      kills: g.stats.kills,
      score: g.stats.score,
      saved: JSON.parse(localStorage.getItem('hollowframe-v1')).best,
    };
  });
  console.log('outcome', outcome);
  check(
    'eight complete waves reach victory and save record',
    outcome.state === 'results' &&
      outcome.cleared === 8 &&
      outcome.kills >= 50 &&
      outcome.saved === outcome.score,
  );
  await page.screenshot({ path: `artifacts/${channel}-victory.png` });
  await page.getByRole('button', { name: /RETURN TO COMMAND/ }).click();
  await page.setViewportSize({ width: 900, height: 650 });
  await page.screenshot({ path: `artifacts/${channel}-compact.png` });
  check(
    'compact menu has no horizontal overflow',
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  check('no page errors or missing assets', errors.length === 0);
} catch (e) {
  console.error(e);
  await page.screenshot({ path: `artifacts/${channel}-failure.png` });
  errors.push(e.message);
  process.exitCode = 1;
} finally {
  await fs.writeFile(
    `artifacts/${channel}-regression.json`,
    JSON.stringify({ channel, checks, errors }, null, 2),
  );
  await browser.close();
}
