import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser = await chromium.launch({
  channel: process.env.HF_BROWSER || 'chrome',
  headless: true,
  args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [],
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
  check(
    'three faction switches, last active faction protected',
    (await page.getByRole('switch').count()) === 3 &&
      (await page.locator('[data-faction=choir]').getAttribute('aria-disabled')) === 'true',
  );
  await page.locator('[data-faction=brood]').click();
  await page.locator('[data-faction=choir]').click();
  await page.reload();
  await page.waitForFunction(() => !!window.__HOLLOWFRAME__);
  check(
    'faction selection persists',
    await page.evaluate(
      () =>
        __HOLLOWFRAME__.save.factions.brood &&
        !__HOLLOWFRAME__.save.factions.choir &&
        !__HOLLOWFRAME__.save.factions.veil,
    ),
  );
  await page.getByRole('button', { name: /SELECT OPERATION/ }).click();
  await page.screenshot({ path: 'artifacts/factions-menu.png', fullPage: true });
  await page.getByRole('button', { name: /DEPLOY TO/ }).click();
  const results = await page.evaluate(async () => {
    const { ENEMIES } = await import('/src/data.js');
    const g = __HOLLOWFRAME__,
      out = {};
    g.state = 'paused';
    g.waves.next();
    out.queue = g.waves.queue.every((id) => ENEMIES[id].faction === 'brood');
    g.enemies.clear();
    g.world.colliders = [];
    g.world.solids = [];
    g.player.position.set(0, 0, 0);
    g.player.update(0);
    const pos = g.player.position.clone().set(0, 0, 10);
    const weapon = { damage: 120, range: 200, penetration: 1, weak: 1 };
    const keeper = g.enemies.spawn('broodkeeper', pos);
    keeper.deployClock = 0;
    g.enemies.update(0.02);
    out.hatch = g.enemies.list.some((e) => e.type === 'nipper');
    g.enemies.breakComponent(keeper, 'deployer');
    const count = g.enemies.list.length;
    keeper.deployClock = 0;
    g.enemies.update(0.02);
    out.stopHatch = g.enemies.list.length === count;
    g.enemies.clear();
    const guard = g.enemies.spawn('prism', pos),
      hp = guard.hp;
    g.enemies.hit(guard, 'shield', { ...weapon, damage: 30, penetration: 0.2 }, pos, 0);
    out.shield = guard.hp === hp && guard.shield < guard.d.shield;
    g.enemies.hit(guard, 'shield', weapon, pos, 0);
    out.shieldBreak = guard.shield <= 0 && !guard.shieldMesh.visible;
    const weaver = g.enemies.spawn('weaver', pos.clone().setX(3));
    guard.hp = 40;
    const nipper = g.enemies.spawn('nipper', pos.clone().setX(-3));
    nipper.hp = 20;
    g.enemies.update(0.1);
    out.heal = guard.hp > 40 && nipper.hp === 20;
    g.enemies.breakComponent(weaver, 'repair');
    const healed = guard.hp;
    g.enemies.update(0.1);
    out.stopHeal = guard.hp === healed;
    g.enemies.clear();
    const blade = g.enemies.spawn('phaseblade', pos.clone().setZ(20));
    blade.attack = 5;
    g.enemies.update(0.02);
    out.cloak = blade.meshes.some((m) => m.material.opacity === 0.25);
    const carapace = g.enemies.spawn('carapace', pos);
    g.enemies.update(0.02);
    out.chargeWarning = carapace.chargeWarn > 0;
    for (let n = 0; n < 50; n++) g.enemies.update(0.02);
    out.rush = carapace.rush > 0;
    const bossChecks = [];
    for (const type of ['broodmother', 'dreadmaw', 'hierophant', 'prismarch']) {
      g.enemies.clear();
      g.projectiles.clear();
      const boss = g.enemies.spawn(type, pos),
        origin = pos.clone().setY(1.72);
      g.enemies.updateBoss(boss, 0.1, origin, 10);
      boss.cycle = 2;
      g.enemies.updateBoss(boss, 0.02, origin, 10);
      const fired =
        type === 'prismarch'
          ? !!boss.aim && boss.phaseLabel.includes('SWEEP')
          : g.projectiles.pool.some((p) => p.active);
      boss.cycle = 5.5;
      g.enemies.updateBoss(boss, 0, origin, 10);
      const warning = boss.zone.visible;
      boss.cycle = 8;
      g.enemies.updateBoss(boss, 0, origin, 10);
      const open = boss.coreOpen && boss.core.visible;
      boss.hp = boss.d.hp * 0.6;
      g.enemies.updateBoss(boss, 0, origin, 10);
      const children = g.enemies.list.filter((e) => e !== boss);
      const own = children.length > 0 && children.every((e) => e.d.faction === boss.d.faction);
      boss.cycle = 0;
      g.enemies.breakComponent(boss, 'weaponLeft');
      g.enemies.breakComponent(boss, 'weaponRight');
      g.enemies.updateBoss(boss, 0, origin, 10);
      bossChecks.push({ type, fired, warning, open, own, disarm: boss.coreOpen });
    }
    out.bosses = bossChecks;
    g.enemies.clear();
    g.projectiles.clear();
    return out;
  });
  for (const [key, value] of Object.entries(results)) if (key !== 'bosses') check(key, value);
  for (const boss of results.bosses)
    check(
      boss.type + ' attacks, warns, exposes core and calls own faction',
      boss.fired && boss.warning && boss.open && boss.own && boss.disarm,
    );
  // Warm all faction models, then repeat to catch resource growth on reset.
  const memory = await page.evaluate(async () => {
    const { FACTION_ENEMIES } = await import('/src/factions.js');
    const g = __HOLLOWFRAME__,
      samples = [];
    for (let pass = 0; pass < 3; pass++) {
      for (const type of Object.keys(FACTION_ENEMIES)) g.enemies.spawn(type, g.map.spawns[0]);
      g.world.render();
      g.enemies.clear();
      g.world.render();
      samples.push({ ...g.world.renderer.info.memory });
    }
    return samples;
  });
  check(
    'faction models clean up across repeated resets',
    JSON.stringify(memory[1]) === JSON.stringify(memory[2]),
  );
  await page.evaluate(() => {
    const g = __HOLLOWFRAME__;
    g.weapons.root.visible = false;
    document.querySelector('#ui').style.display = 'none';
    g.fx.clear();
    g.fx.update(0);
    ['nipper', 'carapace', 'bilecaster', 'broodkeeper', 'spore', 'broodmother', 'dreadmaw'].forEach(
      (type, n) => g.enemies.spawn(type, g.map.start.clone().set((n - 3) * 4, 0, 12)),
    );
    g.world.camera.position.set(0, 8, 32);
    g.world.camera.lookAt(0, 2, 12);
    g.world.camera.fov = 65;
    g.world.camera.updateProjectionMatrix();
    g.world.render();
  });
  await page.screenshot({ path: 'artifacts/factions-brood.png' });
  await page.evaluate(() => {
    const g = __HOLLOWFRAME__;
    g.enemies.clear();
    ['thrall', 'prism', 'seer', 'weaver', 'phaseblade', 'hierophant', 'prismarch'].forEach(
      (type, n) => g.enemies.spawn(type, g.map.start.clone().set((n - 3) * 4, 0, 12)),
    );
    g.world.render();
  });
  await page.screenshot({ path: 'artifacts/factions-veil.png' });
  check('no browser errors', errors.length === 0);
  await fs.writeFile(
    'artifacts/factions-' + (process.env.HF_BROWSER || 'chrome') + '.json',
    JSON.stringify({ checks, results, memory, errors }, null, 2),
  );
} finally {
  await browser.close();
}
