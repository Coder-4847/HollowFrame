import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
await fs.mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({
  channel: process.env.HF_BROWSER || 'chrome',
  headless: true,
  args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } }),
  errors = [],
  checks = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('response', (r) => {
  if (r.status() >= 400) errors.push(r.url() + ':' + r.status());
});
const check = (n, v) => {
  assert.ok(v, n);
  checks.push(n);
  console.log('PASS', n);
};
try {
  await page.goto('http://127.0.0.1:5173');
  await page.waitForFunction(() => !!window.__HOLLOWFRAME__);
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('button', { name: /CONFIGURE LOADOUT/ }).click();
  await page.locator('[data-weapon="5"]').click();
  await page.getByRole('button', { name: /UNLOCK \/ 150/ }).click();
  await page.getByRole('button', { name: /EQUIP TO PRIMARY/ }).click();
  await page.locator('[data-equipment="emp"]').click();
  await page.locator('[data-melee="hammer"]').click();
  check(
    'UI purchase equips sidegrade and deducts alloy once',
    await page.evaluate(
      () =>
        __HOLLOWFRAME__.save.credits === 150 &&
        __HOLLOWFRAME__.save.loadout[0] === 'spire' &&
        __HOLLOWFRAME__.save.equipment === 'emp' &&
        __HOLLOWFRAME__.save.melee === 'hammer',
    ),
  );
  await page.screenshot({ path: 'artifacts/phase2-loadout.png', fullPage: true });
  await page.reload();
  await page.waitForFunction(() => !!window.__HOLLOWFRAME__);
  check(
    'loadout equipment unlocks persist across reload',
    await page.evaluate(
      () =>
        __HOLLOWFRAME__.save.loadout[0] === 'spire' &&
        __HOLLOWFRAME__.save.unlocked.includes('spire'),
    ),
  );
  await page.getByRole('button', { name: /SELECT OPERATION/ }).click();
  await page.locator('[data-map="sunbreak"]').click();
  await page.locator('[data-difficulty="veteran"]').click();
  await page.screenshot({ path: 'artifacts/phase2-operations.png' });
  await page.getByRole('button', { name: /DEPLOY TO SUNBREAK/ }).click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  check(
    'map difficulty and equipped weapon applied on deployment',
    await page.evaluate(
      () =>
        __HOLLOWFRAME__.map.id === 'sunbreak' &&
        __HOLLOWFRAME__.difficulty.budget === 1.3 &&
        __HOLLOWFRAME__.weapons.current.id === 'spire',
    ),
  );
  await page.evaluate(() => {
    const g = __HOLLOWFRAME__;
    g.waves.breakTime = 999;
    g.noticeTime = 0;
  });
  await page.screenshot({ path: 'artifacts/phase2-sunbreak.png' });
  const mechanics = await page.evaluate(() => {
    const g = __HOLLOWFRAME__,
      out = {};
    g.input.reset();
    g.enemies.clear();
    g.projectiles.clear();
    g.save.unlocked = [
      'rivet',
      'breach',
      'needle',
      'cinder',
      'relay',
      'spire',
      'triptych',
      'ballast',
      'kiln',
      'arc',
      'anvil',
      'stitch',
      'glint',
      'mortar',
      'lance',
    ];
    g.save.loadout = ['arc', 'triptych', 'ballast', 'lance', 'glint'];
    g.weapons.disposeModel();
    g.weapons.reset();
    for (let n = 0; n < 6; n++) g.weapons.fire();
    out.overheat = g.weapons.ammo.overheated && g.weapons.ammo.heat === 100;
    const shots = g.stats.shots;
    g.weapons.fire();
    out.overheatBlocks = g.stats.shots === shots;
    g.weapons.reload();
    g.weapons.update(1.7);
    out.vent = g.weapons.ammo.heat === 0 && !g.weapons.ammo.overheated;
    g.weapons.switch(6);
    g.weapons.cooldown = 0;
    g.input.shot = true;
    const before = g.stats.shots;
    g.weapons.update(0.01);
    g.input.shot = false;
    for (let n = 0; n < 30; n++) g.weapons.update(0.01);
    out.burst = g.stats.shots - before === 3;
    g.weapons.switch(14);
    g.weapons.cooldown = 0;
    g.input.fire = true;
    const chargeShots = g.stats.shots;
    for (let n = 0; n < 50; n++) g.weapons.update(0.01);
    out.charging = g.stats.shots === chargeShots && g.weapons.chargeTime > 0;
    for (let n = 0; n < 30; n++) g.weapons.update(0.01);
    out.chargedShot = g.stats.shots === chargeShots + 1;
    g.input.reset();
    g.enemies.clear();
    const p = g.player.position.clone();
    p.set(0, 0, 15);
    const shield = g.enemies.spawn('bulwark', p);
    const hp = shield.hp;
    g.enemies.hit(shield, 'shield', { damage: 30, range: 100, penetration: 0.2, weak: 2 }, p, 0);
    out.shieldAbsorbs = shield.hp === hp && shield.shield < 210;
    g.player.position.set(0, 0, 20);
    g.player.update(0);
    g.save.equipment = 'emp';
    g.equipmentCharges = 2;
    g.useEquipment();
    out.emp = shield.shield === 0 && shield.stun >= 2 && g.equipmentCharges === 1;
    g.enemies.clear();
    const mender = g.enemies.spawn('mender', p);
    const allyPos = p.clone();
    allyPos.x = 3;
    const ally = g.enemies.spawn('warden', allyPos);
    ally.hp = 30;
    for (let n = 0; n < 30; n++) g.enemies.update(1 / 60);
    out.healing = ally.hp > 30;
    g.enemies.hit(mender, 'repair', { damage: 75, range: 100, penetration: 1, weak: 2 }, p, 0);
    const hpBefore = ally.hp;
    for (let n = 0; n < 30; n++) g.enemies.update(1 / 60);
    out.repairDisabled = mender.components.repair <= 0 && ally.hp === hpBefore;
    g.enemies.clear();
    const boss = g.enemies.spawn('conductor', p);
    const weapon = { damage: 100, range: 200, penetration: 1, weak: 2 };
    const closed = g.enemies.hit(boss, 'body', weapon, p, 0);
    g.enemies.updateBoss(boss, 8, p.clone(), 20);
    const opened = g.enemies.hit(boss, 'core', weapon, p, 0);
    out.bossWindow = boss.coreOpen && opened > closed * 5;
    for (let n = 0; n < 3; n++) {
      g.enemies.hit(boss, 'weaponLeft', weapon, p, 0);
      g.enemies.hit(boss, 'weaponRight', weapon, p, 0);
    }
    out.mounts = boss.components.weaponLeft <= 0 && boss.components.weaponRight <= 0;
    g.projectiles.clear();
    boss.cycle = 1.99;
    boss.volleyFired = false;
    boss.aim = g.world.camera.position.clone();
    g.enemies.updateBoss(boss, 0.02, p.clone(), 20);
    out.disarmedBoss = g.projectiles.pool.every((x) => !x.active);
    g.enemies.clear();
    g.projectiles.clear();
    g.player.hp = 40;
    g.player.armor = 0;
    g.save.equipment = 'repair';
    g.equipmentCharges = 2;
    g.useEquipment();
    out.repairKit = g.player.hp === 75 && g.player.armor === 15;
    g.save.equipment = 'grenade';
    g.equipmentCharges = 2;
    g.useEquipment();
    out.grenade = g.projectiles.pool.some((x) => x.active && x.gravity > 0 && x.equipment);
    return out;
  });
  for (const [n, v] of Object.entries(mechanics)) check(n, v);
  await page.evaluate(() => {
    const g = __HOLLOWFRAME__;
    g.toMenu();
    g.save.map = 'whiteout';
    g.selectMap('whiteout');
    g.save.loadout = ['rivet', 'breach', 'needle', 'cinder', 'relay'];
    g.persist();
  });
  await page.getByRole('button', { name: /SELECT OPERATION/ }).click();
  await page.getByRole('button', { name: /DEPLOY TO WHITEOUT/ }).click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  await page.evaluate(() => {
    const g = __HOLLOWFRAME__;
    g.waves.breakTime = 999;
    g.noticeTime = 0;
    g.player.yaw = 0.3;
    g.player.update(0);
  });
  await page.screenshot({ path: 'artifacts/phase2-whiteout.png' });
  const memory = await page.evaluate(() => {
    const g = __HOLLOWFRAME__;
    g.toMenu();
    const measures = [];
    for (let pass = 0; pass < 3; pass++) {
      for (const id of ['ashworks', 'sunbreak', 'whiteout']) {
        g.selectMap(id);
        g.world.render();
      }
      measures.push({ ...g.world.renderer.info.memory, children: g.world.scene.children.length });
    }
    return measures;
  });
  console.log('memory', memory);
  check(
    'map switching retains bounded GPU resources',
    memory[2].geometries === memory[1].geometries &&
      memory[2].textures === memory[1].textures &&
      memory[2].children === memory[1].children,
  );
  await page.getByRole('button', { name: /SELECT OPERATION/ }).click();
  await page.getByRole('button', { name: /DEPLOY TO WHITEOUT/ }).click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  const payout = await page.evaluate(() => {
    const g = __HOLLOWFRAME__,
      before = g.save.credits;
    g.stats.kills = 10;
    g.waves.completed = 2;
    g.finish(false);
    const after = g.save.credits;
    g.finish(false);
    return after > before && g.save.credits === after;
  });
  check('match reward credited exactly once', payout);
  await page.getByRole('button', { name: /RETURN TO COMMAND/ }).click();
  await page.getByRole('button', { name: /SYSTEM SETTINGS/ }).click();
  await page.locator('[data-setting="music"]').fill('0.1');
  await page.locator('[data-toggle="shadows"]').uncheck();
  await page.locator('[data-toggle="particles"]').uncheck();
  check(
    'audio and graphics toggles update live',
    await page.evaluate(
      () =>
        __HOLLOWFRAME__.audio.musicBus.gain.value < 0.11 &&
        !__HOLLOWFRAME__.world.renderer.shadowMap.enabled &&
        !__HOLLOWFRAME__.world.particlesEnabled,
    ),
  );
  check('no browser errors or missing assets', errors.length === 0);
} catch (e) {
  console.error(e);
  errors.push(e.message);
  await page.screenshot({ path: 'artifacts/phase2-failure.png' });
  process.exitCode = 1;
} finally {
  await fs.writeFile(
    'artifacts/phase2-regression.json',
    JSON.stringify({ checks, errors }, null, 2),
  );
  await browser.close();
}
