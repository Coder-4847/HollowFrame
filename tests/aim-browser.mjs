import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser = await chromium.launch({
  channel: process.env.HF_BROWSER || 'chrome',
  headless: true,
  args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto('http://127.0.0.1:5173');
  await page.waitForFunction(() => !!window.__HOLLOWFRAME__);
  await page.getByRole('button', { name: /SELECT OPERATION/ }).click();
  await page.getByRole('button', { name: /DEPLOY TO/ }).click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  const result = await page.evaluate(async () => {
    const { WEAPONS } = await import('/src/data.js');
    const THREE = await import('/node_modules/three/build/three.module.js');
    const g = __HOLLOWFRAME__;
    g.state = 'paused';
    g.player.reset();
    g.input.reset();
    g.input.aim = true;
    g.weapons.equipped = WEAPONS.map((_, n) => n);
    const out = [];
    for (let index = 0; index < WEAPONS.length; index++) {
      g.weapons.switch(index);
      for (let n = 0; n < 90; n++) {
        g.player.update(1 / 60);
        g.weapons.update(1 / 60);
      }
      for (const recoil of [0, 0.25]) {
        g.weapons.recoil = recoil;
        g.weapons.update(0);
        g.world.scene.updateMatrixWorld(true);
        const ray = new THREE.Raycaster();
        let blocked = 0;
        const meshes = g.weapons.root.children.filter(
          (m) => m.isMesh && m.visible && m !== g.weapons.flash,
        );
        // Keep a usable target area clear, not just a single pixel at the crosshair.
        for (const x of [-0.06, 0, 0.06])
          for (const y of [-0.06, 0, 0.06]) {
            ray.setFromCamera(new THREE.Vector2(x, y), g.world.camera);
            blocked += ray.intersectObjects(meshes, false).length > 0 ? 1 : 0;
          }
        out.push({ id: WEAPONS[index].id, recoil, blocked });
      }
    }
    g.weapons.switch(WEAPONS.findIndex((w) => w.id === 'needle'));
    for (let n = 0; n < 90; n++) {
      g.player.update(1 / 60);
      g.weapons.update(1 / 60);
    }
    const zoom = g.world.camera.fov;
    g.world.render();
    return { out, zoom };
  });
  assert.ok(
    result.out.every((r) => r.blocked === 0),
    JSON.stringify(result.out.filter((r) => r.blocked)),
  );
  assert.ok(Math.abs(result.zoom - 39) < 0.01, 'sniper zoom retained');
  await page.screenshot({ path: 'artifacts/aim-sniper.png' });
  const restored = await page.evaluate(() => {
    const g = __HOLLOWFRAME__;
    g.input.aim = false;
    for (let n = 0; n < 90; n++) {
      g.player.update(1 / 60);
      g.weapons.update(1 / 60);
    }
    return (
      Math.abs(g.weapons.root.position.x - 0.32) < 0.001 &&
      Math.abs(g.world.camera.fov - g.settings.fov) < 0.01
    );
  });
  assert.ok(restored, 'hip-fire pose and FOV restore');
  assert.deepEqual(errors, []);
  await fs.writeFile(
    'artifacts/aim-check.json',
    JSON.stringify({ ...result, restored, errors }, null, 2),
  );
  console.log(
    'PASS all 18 aimed weapons keep target area clear at rest and under recoil; sniper zoom and hip-fire recovery; no errors',
  );
} finally {
  await browser.close();
}
