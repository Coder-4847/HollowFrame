import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser = await chromium.launch({
  channel: process.env.HF_BROWSER || 'chrome',
  headless: true,
  args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } }),
  errors = [],
  checks = [];
page.on('pageerror', (e) => errors.push(e.message));
const check = (n, v) => {
  assert.ok(v, n);
  checks.push(n);
  console.log('PASS', n);
};
try {
  await page.goto('http://127.0.0.1:5173');
  await page.waitForFunction(() => !!window.__HOLLOWFRAME__);
  await page.getByRole('button', { name: /SELECT OPERATION/ }).click();
  check('eight selectable arenas', (await page.locator('[data-map]').count()) === 8);
  await page.locator('[data-map=skyline]').click();
  await page.getByRole('button', { name: /DEPLOY TO SKYLINE/ }).click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  const routes = await page.evaluate(() => {
    const g = __HOLLOWFRAME__,
      result = [];
    g.waves.breakTime = 999;
    const originalDamage = g.player.damage;
    g.player.damage = () => {};
    for (const up of [false, true])
      for (const type of ['skitter', 'conductor']) {
        g.enemies.clear();
        g.projectiles.clear();
        g.player.position.copy(up ? g.map.spawns[4] : g.map.start);
        g.player.update(0);
        const e = g.enemies.spawn(type, up ? g.map.start : g.map.spawns[4]);
        let low = Infinity;
        for (let n = 0; n < 4000 && e.alive; n++) {
          g.elapsed += 0.04;
          g.world.scene.updateMatrixWorld(true);
          g.enemies.update(0.04);
          low = Math.min(low, e.root.position.y);
          if (
            Math.abs(e.root.position.y - g.player.position.y) < 0.5 &&
            e.root.position.distanceTo(g.player.position) < 20
          )
            break;
        }
        result.push({
          up,
          targetY: g.player.position.y,
          type,
          y: e.root.position.y,
          position: e.root.position.toArray(),
          path: e.path.slice(0, 3),
          distance: e.root.position.distanceTo(g.player.position),
          low,
        });
      }
    g.player.damage = originalDamage;
    g.enemies.clear();
    g.projectiles.clear();
    return result;
  });
  console.log('routes', JSON.stringify(routes));
  check(
    'regular and boss AI climb and descend both bridges without falling',
    routes.every((r) => Math.abs(r.y - r.targetY) < 0.5 && r.distance < 20 && r.low >= 4),
  );
  const death = await page.evaluate(async () => {
    const { updateEnvironment } = await import('/src/environment.js');
    const g = __HOLLOWFRAME__;
    g.player.position.set(-40, 3, 0);
    g.player.velocity.set(0, 0, 0);
    g.player.grounded = false;
    for (let n = 0; n < 100 && g.state === 'playing'; n++) {
      g.player.update(0.02);
      updateEnvironment(g, 0.02);
    }
    return { state: g.state, y: g.player.position.y, hp: g.player.hp };
  });
  check(
    'falling between rooftops ends the run',
    death.state === 'results' && death.hp === 0 && death.y < 1,
  );
  await page.evaluate(() => __HOLLOWFRAME__.toMenu());
  for (const id of ['skyline', 'saltreach', 'spillway', 'ashworks', 'whiteout']) {
    await page.evaluate((id) => {
      const g = __HOLLOWFRAME__;
      g.selectMap(id);
      g.state = 'paused';
      g.weapons.root.visible = false;
      g.fx.clear();
      g.fx.update(0);
      document.querySelector('#ui').style.display = 'none';
      g.world.camera.position.set(
        id === 'skyline' ? -47 : 39,
        id === 'skyline' ? 34 : 35,
        id === 'skyline' ? 49 : 45,
      );
      g.world.camera.lookAt(0, id === 'skyline' ? 6 : 0, 0);
      g.world.camera.fov = 75;
      g.world.camera.updateProjectionMatrix();
      g.world.render();
    }, id);
    await page.screenshot({ path: `artifacts/terrain-${id}.png` });
  }
  const hazard = await page.evaluate(async () => {
    const { updateEnvironment } = await import('/src/environment.js');
    const g = __HOLLOWFRAME__;
    g.selectMap('spillway');
    g.player.reset();
    g.state = 'playing';
    g.waves.breakTime = 0;
    g.waves.queue = ['warden'];
    g.waves.timer = 999;
    const h = g.map.hazards[0];
    g.player.position.set(h.x, 0, h.z);
    const before = g.player.hp;
    updateEnvironment(g, 0.2);
    const ground = g.player.hp;
    g.player.position.y = 4;
    updateEnvironment(g, 0.2);
    return { hurt: ground < before, aboveSafe: g.player.hp === ground };
  });
  check('toxic runoff damages the channel but not the deck above', hazard.hurt && hazard.aboveSafe);
  const memory = await page.evaluate(() => {
    const g = __HOLLOWFRAME__,
      out = [];
    g.toMenu();
    for (let n = 0; n < 3; n++) {
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
  check(
    'eight-map cycles have stable GPU resource counts',
    JSON.stringify(memory[1]) === JSON.stringify(memory[2]),
  );
  check('no browser errors', errors.length === 0);
} catch (e) {
  errors.push(e.message);
  console.error(e);
  process.exitCode = 1;
} finally {
  await fs.mkdir('artifacts', { recursive: true });
  await fs.writeFile(
    'artifacts/terrain-' + (process.env.HF_BROWSER || 'chrome') + '.json',
    JSON.stringify({ checks, errors }, null, 2),
  );
  await browser.close();
}
