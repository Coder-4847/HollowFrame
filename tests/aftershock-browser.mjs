import { lowQuality, settled } from './low-quality.mjs';
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
  await page.getByRole('button', { name: /CONFIGURE LOADOUT/ }).click();
  check(
    'three main melee kits are selectable',
    (await page.locator('[data-melee-kit]').count()) === 3,
  );
  await page.locator('[data-melee-kit=spear]').click();
  await page.reload();
  await page.waitForFunction(() => !!window.__HOLLOWFRAME__);
  check(
    'melee class and kit persist',
    await page.evaluate(
      () =>
        __HOLLOWFRAME__.save.combatClass === 'melee' && __HOLLOWFRAME__.save.meleeKit === 'spear',
    ),
  );
  await page.getByRole('button', { name: /SELECT OPERATION/ }).click();
  await page.getByRole('button', { name: /DEPLOY TO/ }).click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  await settled(page);
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.up();
  check(
    'left mouse attacks through the real game loop',
    await page.evaluate(
      () => __HOLLOWFRAME__.meleeClass.stamina < 100 && !__HOLLOWFRAME__.weapons.root.visible,
    ),
  );
  await page.waitForFunction(() => __HOLLOWFRAME__.meleeClass.swing <= 0);
  await page.mouse.down({ button: 'right' });
  await page.waitForFunction(() => __HOLLOWFRAME__.meleeClass.guard);
  check('right mouse raises guard', await page.evaluate(() => __HOLLOWFRAME__.meleeClass.guard));
  await page.mouse.up({ button: 'right' });
  const result = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const g = __HOLLOWFRAME__,
      out = {};
    g.state = 'paused';
    g.waves.breakTime = 999;
    g.world.colliders = [];
    g.world.solids = [];
    g.input.reset();
    g.player.position.set(0, 0, 20);
    g.player.yaw = 0;
    g.player.pitch = 0;
    g.player.update(0);
    const setup = (kit) => {
      g.enemies.clear();
      g.save.meleeKit = kit;
      g.save.combatClass = 'melee';
      g.meleeClass.reset();
      g.input.reset();
      g.meleeClass.update(0);
    };
    setup('spear');
    const far = g.enemies.spawn('warden', new THREE.Vector3(0, 0, 15.4)),
      side = g.enemies.spawn('warden', new THREE.Vector3(3, 0, 17));
    g.meleeClass.attack();
    out.spearReach = far.hp < far.d.hp && side.hp === side.d.hp;
    const hp = far.hp;
    g.meleeClass.attack();
    out.cooldown = far.hp === hp;
    setup('energy');
    const a = g.enemies.spawn('warden', new THREE.Vector3(-1, 0, 17.8)),
      b = g.enemies.spawn('warden', new THREE.Vector3(1, 0, 17.8));
    g.meleeClass.attack();
    out.sweep = a.hp < a.d.hp && b.hp < b.d.hp;
    g.meleeClass.stamina = 0;
    g.meleeClass.cooldown = 0;
    out.exhausted = !g.meleeClass.attack();
    g.meleeClass.update(1);
    out.recovery = g.meleeClass.stamina > 0;
    setup('aegis');
    g.input.aim = true;
    g.meleeClass.update(0.01);
    out.frontBlock = g.meleeClass.defend(30, new THREE.Vector3(0, 1, 10)) < 7;
    out.rearBypass = g.meleeClass.defend(30, new THREE.Vector3(0, 1, 25)) === 30;
    g.state = 'playing';
    g.player.hp = 100;
    g.player.armor = 0;
    g.player.damage(10, new THREE.Vector3(0, 0, 10), true);
    out.hazardBypass = g.player.hp === 90;
    g.state = 'paused';
    setup('energy');
    g.input.aim = true;
    g.meleeClass.update(0.01);
    out.parry = g.meleeClass.defend(30, new THREE.Vector3(0, 1, 10)) === 0;
    g.input.reset();
    out.resetGuard = g.meleeClass.defend(30, new THREE.Vector3(0, 1, 10)) === 30;
    setup('spear');
    g.world.solids = [
      new THREE.Mesh(new THREE.BoxGeometry(5, 5, 0.3), new THREE.MeshBasicMaterial()),
    ];
    g.world.solids[0].position.set(0, 2, 18);
    g.world.solids[0].updateMatrixWorld(true);
    const covered = g.enemies.spawn('warden', new THREE.Vector3(0, 0, 17));
    g.meleeClass.attack();
    out.cover = covered.hp === covered.d.hp;
    g.world.solids[0].geometry.dispose();
    g.world.solids[0].material.dispose();
    g.world.solids = [];
    g.enemies.clear();
    g.fx.clear();
    const corpse = g.enemies.spawn('warden', new THREE.Vector3(0, 0, 16));
    g.enemies.kill(corpse);
    out.corpseCreated =
      g.fx.ragdolls.items.length === 1 &&
      !g.enemies.targets.some((m) => m.userData.enemy === corpse);
    const root = g.fx.ragdolls.items[0].bodies[0].mesh,
      before = root.position.clone();
    for (let n = 0; n < 60; n++) g.fx.update(1 / 60);
    out.gravity = root.position.distanceTo(before) > 0.2;
    for (let n = 0; n < 250; n++) g.fx.update(1 / 60);
    out.fiveSeconds = g.fx.ragdolls.items.length === 0;
    for (let n = 0; n < 10; n++) {
      const e = g.enemies.spawn('nipper', new THREE.Vector3(0, 0, 15));
      g.enemies.kill(e);
    }
    out.bounded = g.fx.ragdolls.items.length === 6;
    g.fx.clear();
    out.clear = g.fx.ragdolls.items.length === 0;
    const point = new THREE.Vector3(0, 2, 16),
      normal = new THREE.Vector3(0, 0, 1);
    g.fx.impact(point, normal, 'metal');
    g.fx.muzzle(point, normal, false);
    out.effects =
      g.fx.glows.some((p) => p.life > 0) &&
      g.fx.items.some((p) => p.life > 0 && p.streak) &&
      g.fx.smokePool.some((p) => p.life > 0);
    g.fx.clear();
    g.world.reducedMotion = true;
    g.fx.muzzle(point, normal);
    out.reduced = g.fx.glows.every((p) => p.life <= 0);
    g.world.reducedMotion = false;
    g.fx.clear();
    g.world.particlesEnabled = false;
    g.fx.impact(point, normal);
    out.particlesOff = g.fx.items.every((p) => p.life <= 0);
    g.world.particlesEnabled = true;
    setup('energy');
    g.input.reset();
    g.meleeClass.update(0);
    g.weapons.root.visible = false;
    g.ui.update(1);
    g.world.render();
    return out;
  });
  for (const [name, value] of Object.entries(result)) check(name, value);
  for (const kit of ['energy', 'spear', 'aegis']) {
    await page.evaluate((kit) => {
      const g = __HOLLOWFRAME__;
      g.save.meleeKit = kit;
      g.meleeClass.reset();
      g.meleeClass.update(0);
      g.ui.update(1);
      g.world.render();
    }, kit);
    await page.screenshot({ path: `artifacts/melee-${kit}.png` });
  }
  const resources = await page.evaluate(() => {
    const g = __HOLLOWFRAME__,
      counts = [];
    g.enemies.clear();
    g.fx.clear();
    for (let pass = 0; pass < 3; pass++) {
      for (const type of ['warden', 'broodmother', 'prismarch']) {
        const e = g.enemies.spawn(type, g.map.start.clone());
        g.enemies.kill(e);
      }
      g.world.render();
      g.fx.clear();
      g.enemies.clear();
      g.world.render();
      counts.push({ ...g.world.renderer.info.memory, children: g.world.scene.children.length });
    }
    return counts;
  });
  check(
    'repeated corpse creation and cleanup stabilizes resources',
    JSON.stringify(resources[1]) === JSON.stringify(resources[2]),
  );
  await page.evaluate(() => {
    const g = __HOLLOWFRAME__;
    g.meleeClass.root.visible = false;
    document.querySelector('#ui').style.display = 'none';
    const e = g.enemies.spawn('warden', g.map.start.clone().set(0, 0, 12));
    g.enemies.kill(e);
    for (let n = 0; n < 45; n++) g.fx.update(1 / 60);
    g.world.camera.position.set(0, 4, 18);
    g.world.camera.lookAt(0, 0.5, 12);
    g.world.render();
  });
  await page.screenshot({ path: 'artifacts/aftershock-ragdoll.png' });
  check('no runtime errors', errors.length === 0);
  await fs.writeFile(
    `artifacts/aftershock-${process.env.HF_BROWSER || 'chrome'}.json`,
    JSON.stringify({ checks, errors }, null, 2),
  );
} finally {
  await browser.close();
}
