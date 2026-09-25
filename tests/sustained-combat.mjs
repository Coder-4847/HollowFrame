import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const maps = (process.env.HF_MAPS || 'cinderline,deepwell').split(',');
const factions = process.env.HF_FACTIONS?.split(',');
const meleeKit = process.env.HF_MELEE;
try {
  for (const map of maps) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
      errors = [],
      samples = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://127.0.0.1:5173');
    await page.waitForFunction(() => !!window.__HOLLOWFRAME__);
    if (meleeKit)
      await page.evaluate((kit) => {
        __HOLLOWFRAME__.save.combatClass = 'melee';
        __HOLLOWFRAME__.save.meleeKit = kit;
      }, meleeKit);
    if (factions)
      await page.evaluate((ids) => {
        __HOLLOWFRAME__.save.factions = Object.fromEntries(
          ['choir', 'brood', 'veil'].map((id) => [id, ids.includes(id)]),
        );
      }, factions);
    await page.getByRole('button', { name: /SELECT OPERATION/ }).click();
    await page.locator(`[data-map=${map}]`).click();
    await page.getByRole('button', { name: /DEPLOY TO/ }).click();
    await page.waitForFunction(() => !!document.pointerLockElement);
    for (let chunk = 0; chunk < 60; chunk++) {
      const report = await page.evaluate(async () => {
        const { updateEnvironment } = await import('/src/environment.js');
        const { buyUpgrade } = await import('/src/upgrades.js');
        const g = __HOLLOWFRAME__;
        for (let n = 0; n < 450 && g.state === 'playing'; n++) {
          const dt = 1 / 30;
          g.elapsed += dt;
          g.input.reset();
          if (g.waves.breakTime > 0) {
            for (const id of ['optics', 'loader', 'plating']) buyUpgrade(g, id);
            g.waves.breakTime = 0.001;
          }
          if (g.player.hp < 65 && g.equipmentCharges > 0) g.useEquipment();
          g.world.scene.updateMatrixWorld(true);
          const candidates = g.enemies.list
            .filter((e) => e.alive)
            .map((e) => ({
              e,
              p: (e.d.boss && e.coreOpen ? e.core : e.sensor).getWorldPosition(
                g.player.position.clone(),
              ),
            }));
          candidates.sort(
            (a, b) => a.p.distanceTo(g.player.position) - b.p.distanceTo(g.player.position),
          );
          const target =
            candidates.find((t) => g.enemies.visible(g.world.camera.position, t.p)) ||
            candidates[0];
          if (target) {
            const d = target.p.clone().sub(g.world.camera.position);
            g.player.yaw = Math.atan2(-d.x, -d.z);
            g.player.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
            if (
              g.enemies.visible(g.world.camera.position, target.p) &&
              (!g.meleeClass.active || d.length() < g.meleeClass.kit.range * 0.9)
            ) {
              g.input.fire = true;
              g.input.shot = true;
              g.input.aim = true;
              if (d.length() < 10) g.input.keys.add('KeyS');
              else if (d.length() > 28) g.input.keys.add('KeyW');
              g.input.keys.add(Math.floor(g.elapsed / 2) % 2 ? 'KeyA' : 'KeyD');
              if (g.meleeClass.active) {
                g.input.keys.clear();
                g.input.aim =
                  target.e.warn > 0 && target.e.warn < 0.25 && g.meleeClass.stamina > 30;
                if (d.length() > g.meleeClass.kit.range * 0.75) g.input.keys.add('KeyW');
                else if (d.length() < 2.2) g.input.keys.add('KeyS');
              }
            } else {
              if (!g.driverPath?.length || g.elapsed >= (g.driverRepath || 0)) {
                g.driverPath = g.enemies.nav.path(g.player.position, target.e.root.position);
                g.driverRepath = g.elapsed + 0.8;
              }
              const path = g.driverPath;
              while (
                path.length &&
                Math.hypot(path[0].x - g.player.position.x, path[0].z - g.player.position.z) < 0.2
              )
                path.shift();
              const next =
                path.find(
                  (p) => Math.hypot(p.x - g.player.position.x, p.z - g.player.position.z) > 0.2,
                ) || target.p;
              const dx = next.x - g.player.position.x,
                dz = next.z - g.player.position.z;
              g.player.yaw = Math.atan2(-dx, -dz);
              g.input.keys.add('KeyW');
            }
          }
          if (!g.weapons.ammo.mag && !g.weapons.ammo.reserve) {
            const alternative = [0, 2, 1, 4].find(
              (i) => g.weapons.ammoList[i].mag + g.weapons.ammoList[i].reserve > 0,
            );
            if (alternative !== undefined) g.weapons.switch(alternative);
          }
          if (g.map.voidFloor) {
            const x = Number(g.input.down('KeyD')) - Number(g.input.down('KeyA')),
              z = Number(g.input.down('KeyS')) - Number(g.input.down('KeyW'));
            const nx =
                g.player.position.x +
                (x * Math.cos(g.player.yaw) + z * Math.sin(g.player.yaw)) * 0.9,
              nz =
                g.player.position.z +
                (-x * Math.sin(g.player.yaw) + z * Math.cos(g.player.yaw)) * 0.9;
            if (!g.enemies.nav.supported(nx, nz, g.player.position.y)) g.input.keys.clear();
          }
          g.player.update(dt);
          updateEnvironment(g, dt);
          if (g.state !== 'playing') break;
          g.world.scene.updateMatrixWorld(true);
          g.weapons.update(dt);
          if (g.weapons.ammo.mag === 0) g.weapons.reload();
          g.enemies.update(dt);
          g.world.scene.updateMatrixWorld(true);
          g.projectiles.update(dt);
          if (g.state === 'playing') g.waves.update(dt);
          g.fx.update(dt);
          g.input.end();
        }
        return {
          state: g.state,
          time: Math.round(g.elapsed),
          wave: g.waves.index + 1,
          completed: g.waves.completed,
          kills: g.stats.kills,
          bosses: g.stats.bosses,
          hp: Math.round(g.player.hp),
          remaining: g.waves.remaining,
          accuracy: g.stats.hits / Math.max(1, g.stats.shots),
          upgrades: g.upgrades,
          position: g.player.position.toArray(),
          enemies: g.enemies.list.map((e) => ({
            type: e.type,
            hp: e.hp,
            position: e.root.position.toArray(),
          })),
        };
      });
      samples.push(report);
      console.log(map, JSON.stringify(report));
      if (report.state !== 'playing') break;
    }
    const result = samples.at(-1);
    await fs.mkdir('artifacts', { recursive: true });
    await fs.writeFile(
      `artifacts/sustained-${map}${factions ? '-' + factions.join('-') : ''}${meleeKit ? '-' + meleeKit : ''}.json`,
      JSON.stringify({ samples, result, errors }, null, 2),
    );
    assert.equal(errors.length, 0);
    assert.equal(result.completed, 8, `${map}: all waves cleared through normal damage`);
    assert.equal(result.bosses, Math.max(2, factions?.length || 1));
    await page.close();
  }
} finally {
  await browser.close();
}
