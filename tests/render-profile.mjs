import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto('http://127.0.0.1:5173');
  await page.waitForFunction(() => !!window.__HOLLOWFRAME__);
  const results = await page.evaluate(async () => {
    const { ENEMIES } = await import('/src/data.js');
    const g = __HOLLOWFRAME__,
      out = [];
    g.state = 'paused';
    for (const quality of ['low', 'high'])
      for (const map of [
        'ashworks',
        'sunbreak',
        'whiteout',
        'cinderline',
        'deepwell',
        'skyline',
        'saltreach',
        'spillway',
      ]) {
        g.selectMap(map);
        g.settings.quality = quality;
        g.world.apply(g.settings);
        g.player.reset();
        g.player.update(0);
        g.weapons.root.visible = true;
        const types = Object.keys(ENEMIES).filter((t) => !ENEMIES[t].boss);
        for (let n = 0; n < 24; n++)
          g.enemies.spawn(types[n % types.length], g.map.spawns[n % g.map.spawns.length]);
        const frames = [];
        for (let n = 0; n < 35; n++) {
          const start = performance.now();
          g.world.scene.updateMatrixWorld(true);
          g.world.render();
          if (n >= 5) frames.push(performance.now() - start);
        }
        frames.sort((a, b) => a - b);
        out.push({
          map,
          quality,
          actors: g.enemies.list.length,
          drawCalls: g.world.renderer.info.render.calls,
          triangles: g.world.renderer.info.render.triangles,
          geometries: g.world.renderer.info.memory.geometries,
          medianSubmissionMs: frames[15],
          p95SubmissionMs: frames[28],
        });
        g.enemies.clear();
      }
    return out;
  });
  assert.equal(errors.length, 0);
  assert.ok(results.every((r) => r.actors === 24 && Number.isFinite(r.p95SubmissionMs)));
  await fs.writeFile(
    'artifacts/render-profile.json',
    JSON.stringify(
      {
        note: 'Software WebGL, CPU render submission timing; not hardware FPS or GPU frame time.',
        results,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
