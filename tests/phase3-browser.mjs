import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
await fs.mkdir('artifacts', { recursive: true });
const channel = process.env.HF_BROWSER || 'chrome';
const browser = await chromium.launch({
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
  await page.goto('http://127.0.0.1:5173');
  await page.waitForFunction(() => !!window.__HOLLOWFRAME__);
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('button', { name: /SELECT OPERATION/ }).click();
  check('eight selectable operations', (await page.locator('[data-map]').count()) === 8);
  await page.locator('[data-map=deepwell]').click();
  await page.screenshot({ path: 'artifacts/phase3-operations.png' });
  await page.getByRole('button', { name: /DEPLOY TO DEEPWELL/ }).click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  await page.evaluate(() => {
    const g = __HOLLOWFRAME__;
    g.waves.index = 0;
    g.waves.breakTime = 22;
    g.scrap = 1000;
    g.stats.scrapEarned = 1000;
  });
  await page.keyboard.press('KeyB');
  await page.getByText('REBUILD. RELOAD. RETURN.').waitFor();
  check(
    'B opens terminal and releases pointer',
    await page.evaluate(
      () => __HOLLOWFRAME__.state === 'upgrading' && !document.pointerLockElement,
    ),
  );
  const time = await page.evaluate(() => __HOLLOWFRAME__.waves.breakTime);
  await page.waitForTimeout(200);
  check(
    'upgrade terminal freezes preparation timer',
    await page.evaluate((t) => __HOLLOWFRAME__.waves.breakTime === t, time),
  );
  await page.locator('[data-upgrade=loader]').click();
  await page.locator('[data-upgrade=loader]').click();
  check(
    'purchase costs scrap and caps at two ranks',
    await page.evaluate(
      () => __HOLLOWFRAME__.upgrades.loader === 2 && __HOLLOWFRAME__.scrap === 800,
    ),
  );
  check('max rank button disabled', await page.locator('[data-upgrade=loader]').isDisabled());
  await page.screenshot({ path: 'artifacts/phase3-upgrades.png' });
  await page.getByRole('button', { name: /RETURN TO FIELD/ }).click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  check(
    'reload upgrade changes actual timing',
    await page.evaluate(() => {
      const g = __HOLLOWFRAME__;
      g.weapons.ammo.mag--;
      g.weapons.reload();
      return Math.abs(g.weapons.reloadTime - g.weapons.current.reload * 0.64) < 0.001;
    }),
  );
  await page.evaluate(() => {
    const g = __HOLLOWFRAME__;
    g.elapsed = 0;
    g.waves.breakTime = 0;
    g.waves.queue = ['warden'];
    g.waves.timer = 999;
    g.player.position.set(-8, 0, 2);
    g.player.update(0);
  });
  const armor = await page.evaluate(() => __HOLLOWFRAME__.player.armor);
  await page.waitForTimeout(220);
  check(
    'active discharge field causes damage',
    await page.evaluate((a) => __HOLLOWFRAME__.player.armor < a, armor),
  );
  await page.evaluate(() => {
    const g = __HOLLOWFRAME__;
    g.player.position.set(0, 0, 27);
    g.player.update(0);
  });
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => __HOLLOWFRAME__.quenchTime > 0);
  check(
    'cache interaction quenches grid',
    await page.evaluate(() => __HOLLOWFRAME__.quenchTime > 10),
  );
  await page.evaluate(() => {
    const g = __HOLLOWFRAME__;
    g.elapsed = 0;
    g.player.position.set(-8, 0, 2);
    g.player.update(0);
  });
  const safe = await page.evaluate(() => __HOLLOWFRAME__.player.armor);
  await page.waitForTimeout(220);
  check(
    'quenched hazard stops dealing damage',
    await page.evaluate((a) => __HOLLOWFRAME__.player.armor === a, safe),
  );
  const features = await page.evaluate(async () => {
    const { WEAPONS } = await import('/src/data.js');
    const g = __HOLLOWFRAME__,
      out = {};
    g.waves.breakTime = 999;
    g.enemies.clear();
    g.projectiles.clear();
    g.player.reset();
    g.player.update(0);
    const pos = g.player.position.clone();
    pos.set(0, 0, 15);
    const f = g.enemies.spawn('fabricator', pos);
    f.deployClock = 0;
    g.enemies.update(0.01);
    out.fabricator = g.enemies.list.filter((e) => e.type === 'skitter').length === 2;
    g.enemies.hit(f, 'deployer', { damage: 110, range: 100, penetration: 1, weak: 1 }, pos, 0);
    f.deployClock = 0;
    const count = g.enemies.list.length;
    g.enemies.update(0.01);
    out.disabledBay = g.enemies.list.length === count && f.components.deployer <= 0;
    g.enemies.clear();
    const cantor = g.enemies.spawn('cantor', pos),
      ally = g.enemies.spawn('warden', pos.clone().add({ x: 3, y: 0, z: 0 }));
    ally.attack = 10;
    g.enemies.update(0.1);
    const boosted = 10 - ally.attack;
    cantor.components.command = 0;
    ally.attack = 10;
    g.enemies.update(0.1);
    out.cantor = boosted > (10 - ally.attack) * 1.1;
    g.enemies.clear();
    pos.set(0, 0, 5);
    const shade = g.enemies.spawn('shade', pos);
    shade.attack = 10;
    g.enemies.update(0.01);
    out.cloak = shade.meshes.find((m) => m.userData.ownedMaterial).material.opacity < 0.5;
    shade.root.position.copy(g.player.position).add({ x: 0, y: 0, z: -5 });
    g.enemies.update(0.01);
    out.reveal = shade.meshes.find((m) => m.userData.ownedMaterial).material.opacity === 1;
    g.enemies.hit(
      shade,
      'body',
      WEAPONS.find((w) => w.id === 'rime'),
      pos,
      0,
    );
    out.cryo = shade.slow === 2;
    g.enemies.clear();
    g.projectiles.clear();
    g.weapons.equipped[3] = 17;
    g.weapons.switch(17);
    g.weapons.cooldown = 0;
    g.player.position.set(0, 0, 20);
    g.player.yaw = 0;
    g.player.pitch = 0;
    g.player.update(0);
    g.weapons.fire();
    out.cluster = g.projectiles.pool.some((p) => p.active && p.cluster);
    for (let n = 0; n < 120; n++) {
      g.projectiles.update(0.02);
      if (g.projectiles.pool.filter((p) => p.active && p.equipment).length >= 4) {
        out.fragments = true;
        break;
      }
    }
    g.enemies.clear();
    g.projectiles.clear();
    pos.set(0, 0, 8);
    const architect = g.enemies.spawn('architect', pos);
    architect.components.weaponLeft = 0;
    architect.components.weaponRight = 0;
    g.enemies.updateBoss(architect, 0.1, pos.clone().add({ x: 0, y: 3, z: 0 }), 20);
    out.architectCore = architect.coreOpen;
    g.setBlackout(true);
    out.blackout = g.world.scene.fog.density > 0.03;
    g.setBlackout(false);
    out.lightRestored = g.world.scene.fog.density < 0.02;
    return out;
  });
  for (const [n, v] of Object.entries(features)) check(n, v);
  await page.evaluate(() => {
    const g = __HOLLOWFRAME__;
    g.enemies.clear();
    g.projectiles.clear();
    g.player.reset();
    g.player.update(0);
    g.weapons.switch(0);
    g.fx.clear();
    g.fx.update(0);
    const p = g.player.position.clone();
    p.set(0, 0, 12);
    const boss = g.enemies.spawn('architect', p);
    boss.cycle = 9;
    g.enemies.updateBoss(boss, 0, p, 15);
    g.waves.index = 7;
    g.waves.breakTime = 0;
    g.waves.queue = [];
    g.waves.timer = 999;
    g.noticeTime = 0;
    g.ui.update(0);
    g.world.render();
  });
  await page.screenshot({ path: 'artifacts/phase3-architect.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /RESTART OPERATION/ }).click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  check(
    'restart resets all temporary upgrades and scrap',
    await page.evaluate(
      () => Object.keys(__HOLLOWFRAME__.upgrades).length === 0 && __HOLLOWFRAME__.scrap === 0,
    ),
  );
  const resources = await page.evaluate(() => {
    const g = __HOLLOWFRAME__;
    g.toMenu();
    const out = [];
    for (let pass = 0; pass < 3; pass++) {
      for (const id of [
        'ashworks',
        'sunbreak',
        'whiteout',
        'cinderline',
        'deepwell',
        'skyline',
        'saltreach',
        'spillway',
      ]) {
        g.selectMap(id);
        g.world.render();
      }
      out.push({ ...g.world.renderer.info.memory, children: g.world.scene.children.length });
    }
    return out;
  });
  console.log('resources', resources);
  check(
    'all eight maps keep stable resource counts after warmup',
    resources[1].geometries === resources[2].geometries &&
      resources[1].textures === resources[2].textures &&
      resources[1].children === resources[2].children,
  );
  await page.evaluate(() => {
    const g = __HOLLOWFRAME__;
    g.save.map = 'cinderline';
    g.selectMap('cinderline');
    g.ui.menu();
  });
  await page.getByRole('button', { name: /SELECT OPERATION/ }).click();
  await page.getByRole('button', { name: /DEPLOY TO CINDERLINE/ }).click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  await page.evaluate(() => {
    __HOLLOWFRAME__.noticeTime = 0;
    __HOLLOWFRAME__.waves.breakTime = 999;
  });
  await page.screenshot({ path: 'artifacts/phase3-cinderline.png' });
  check('no browser errors or missing assets', errors.length === 0);
} catch (e) {
  console.error(e);
  errors.push(e.message);
  await page.screenshot({ path: 'artifacts/phase3-failure.png' });
  process.exitCode = 1;
} finally {
  await fs.writeFile(
    'artifacts/phase3-' + channel + '.json',
    JSON.stringify({ checks, errors }, null, 2),
  );
  await browser.close();
}
