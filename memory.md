# HOLLOWFRAME — Project Memory

Hand-off notes for continuing work in a fresh chat. Read this first, then `README.md`. Last updated
for **v0.13.0 "Aftermath"** (commit `b9e2fbc`, 2026-09-25).

---

## 1. What this is

HOLLOWFRAME is a single-player browser FPS (plain ES modules + **three.js 0.180** + **Vite 7**, no
backend). You defend eight arenas against three enemy factions over eight-wave "operations", with
parkour movement, 18 guns, a melee class, upgrades and persistent unlocks. All art, models,
textures and sounds are **procedural** (generated in code). There are no image or audio asset files
apart from fonts, the favicon and `public/og.jpg`.

- **Live game:** https://coder-4847.github.io/HollowFrame/
- **Repo:** https://github.com/Coder-4847/HollowFrame (branch `main`; `gh-pages` holds the built site)
- **Local path:** `C:\Programming\Visual Studio Code\HollowFrame`
- **Owner:** Ettan Bansal (git user already configured; pushes over HTTPS via Git Credential Manager).
  The `gh` CLI is **not installed**. Use plain `git`, and the public GitHub REST API via `curl` for
  read-only checks such as Actions status.
- The original game was written by another AI ("GPT 6 Astra"), v0.9.0 "Aftershock". Every version
  from 0.10.0 onward was done in the chat this file summarises.

## 2. Run, test, build, deploy

```bash
npm ci
npm run dev            # http://127.0.0.1:5173 (dev build exposes window.__HOLLOWFRAME__)
npm test               # 39 node unit tests (tests/*.test.js)
npm run check:format   # Prettier — CI fails if this fails; run `npx prettier --write src tests`
npm run build          # -> dist/
npm run release:manifest
```

Browser suites (Playwright driving headless Chrome with **SwiftShader** software WebGL; they need
`npm run dev` running on port 5173): `test:browser`, `test:movement`, `test:terrain`,
`test:aftershock`, `test:factions`, `test:release`, `test:phase2`, `test:phase3`, `test:phase4`,
`test:combat` (a full 8-wave autopilot run; `HF_MAPS=skyline HF_FACTIONS=choir,brood,veil`),
`test:production` (serves `dist/`), plus `node tests/aim-browser.mjs`.

**Deploy = push to `main`.** `.github/workflows/pages.yml` runs `npm ci` → format check → unit
tests → build → manifest, then force-pushes `dist/` (with `.nojekyll`) as a single commit to
`gh-pages`. GitHub Pages (enabled automatically when `gh-pages` was first pushed) serves it.
Verify a deploy with
`curl -s https://coder-4847.github.io/HollowFrame/release-manifest.json` (it contains `version`).
Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Releasing a version:** bump `version` in `package.json` **and** both root entries in
`package-lock.json`. Change the menu label in `src/ui.js` (`"<CODENAME> / v${__APP_VERSION__}"`;
the version number comes from `package.json` via Vite's `define` in `vite.config.js`). Add a
"What changed" section at the top of `README.md` and move the previous one down as `### x.y.z —
Name`. Then format, run the tests and push.

## 3. How the game works (architecture)

`src/main.js` holds `class Game`: it owns everything and runs the frame loop. The rough order is
`player.update` → `updateEnvironment` → `world.focusShadows` → `weapons.update` (which calls
`meleeClass.update` when the melee class is active) → `enemies.update` → `projectiles.update` →
`waves.update` → `fx.update` → `ui.update` → `audio.update` → `world.render(dt)`. The simulation
runs only in state `playing` (states: `menu`, `playing`, `paused`, `upgrading`, `results`).
Pausing, blurring the window or losing pointer lock pauses the game. `dt` is capped at 0.04.
Adaptive resolution is re-evaluated every 2 s of play.

| Area | Files | Notes |
| --- | --- | --- |
| Content/data | `data.js`, `content.js`, `expansion.js`, `factions.js` | `WEAPONS` (18), `ENEMIES` (26: 20 regular + 6 bosses), `MAPS` (8), `DIFFICULTIES`, `EQUIPMENT`, `MELEE`, `UPGRADES`, `FACTIONS` (choir/brood/veil). Brood/Veil units map onto Choir roles via `FACTION_ROLES`. |
| Save/progression | `core.js` (`readSave`/`saveData`, key `hollowframe-v1`), `progression.js`, `polish.js` (`normalizeSettings`, field hints), `upgrades.js` | Settings: quality `low`/`medium`/`high` (default high), volume, FOV, reduced motion, etc. |
| Renderer | `world.js` | `World`: WebGLRenderer, scene, camera (rotation order YXZ), hemisphere light + sun (the shadow frustum follows the player, texel-snapped), RoomEnvironment reflection map, material cache `world.material(color, emissive, surface='panel', glow=2.4)`, geometry cache `world.geometries`, `box`/`solid`/`cylinder`/`text` helpers (`solid` also pushes an AABB collider). `render(dt)` draws the world on layer 0 through the post pipeline, then clears depth and draws the **viewmodel layer 1** (`VIEW_LAYER`) directly. `warmup(extra)` pre-draws hidden objects (see §5). `adaptResolution` has hysteresis. `flashLights` are off on Low. |
| Post-processing | `post.js` | EffectComposer with a multisampled HalfFloat target: RenderPass → `SolidGTAOPass` (ambient occlusion, **High only**; excludes sprites, points, transparent objects and `userData.noAO`) → UnrealBloom → custom grade shader (vignette, saturation, grain, edge chromatic aberration, `uSpeed` radial blur, `uHurt`) → OutputPass. Disabled on Low. |
| Surfaces | `surfaces.js` | Procedural 512² panel and organic textures (albedo, roughness, normal maps). `worldBoxUV`/`worldCylinderUV` rescale UVs to world metres (`TILE_METRES = 4`). Low drops the normal and roughness maps. |
| Atmosphere | `atmosphere.js` | Gradient sky dome shader (horizon = fog colour, zenith = `scene.background`, sun halo, clouds) and 600 wrapping dust motes (hidden on Low). |
| Maps | `map.js` (Ashworks), `maps.js` (`loadMap`, Sunbreak, Whiteout), `expansion-maps.js` (Cinderline, Deepwell), `terrain-maps.js` (Skyline, Saltreach, Spillway), `arena-details.js`, `markings.js`, `set-dressing.js` (rubble, decals, cables), `terrain-art.js` | Maps return `{bounds, start, station, spawns, hazards, voidFloor?}`. `loadMap` removes and disposes everything added since the last load (except cached materials and geometry). Colliders are axis-aligned boxes `{x,z,w,d,top,bottom}`. |
| Movement | `movement.js` (`Parkour`, `MOVEMENT` constants), `player.js`, `feel.js` (`MovementFeel`) | Slide, slide-jump, wall kick (2 per jump, different walls), mantle, coyote time and jump buffering, fall gravity ×1.18 (jump speed 7.3 compensates so gap distances match the original), ground accel/brake 11/15, hard-landing stumble, landing roll (hold crouch while landing at speed). `Parkour.emit()` sends `jump`/`land`/`slide`/`wallKick`/`mantle`/`mantleEnd` events to `player.feel`, which drives camera springs (dip, roll, pitch, FOV), mantle hands, footsteps, slide and wind audio loops, dust, and weapon sway (`feel.gun`). Reduced motion zeroes all camera offsets. |
| Weapons | `weapons.js`, `viewmodel.js` (`buildGun`), `melee-class.js` | **All equipped guns are built once** (`build()` → `models` Map) and `select(index)` just toggles visibility (see §5). Reflex sights: `sightHeight` lines the lens up with the crosshair in ADS; scopes (needle/lance) sit below it. Recoil kick with 65 % recovery (`kickDebt`), muzzle point light. |
| Enemies | `enemies.js` (AI, damage, components, kill), `enemy-models.js` (models + animation), `navigation.js`, `bosses.js`, `faction-bosses.js`, `director.js` (threat-budget wave builder), `waves.js` | `buildEnemyModel(world, e)` builds articulated models: Choir walkers and crawlers plus the Architect, Brood insects, Veil wraiths. **Every visible mesh is a hit target** with `userData.part` ∈ body/armor/sensor/leg/weaponLeft/weaponRight/shield/repair/deployer/command/core. Required handles: `e.sensor`, `e.plate`, `e.core`, `e.rotor`, `e.zone`, `e.shieldMesh`. Each enemy owns its materials (`e.materials`), which is what makes cloaking, telegraph glow and hit flash per-enemy. `updateEnemyLook(e, dt, ctx)` runs `e.animate` (walk cycle from actual speed, head tracking, aiming arms) and handles the glow pulse and hit flash. `Enemies.prewarm(types)` compiles and draws every variant at deploy. |
| Effects | `vfx.js` (`Effects`: instanced particles, tracers, glows, smoke, ragdolls), `blasts.js` (`Blasts`, reached as `game.fx.blasts`), `ragdolls.js`, `projectiles.js` | `blasts.explosion(pos, scale, kind)` with kind fire/hostile/acid/energy; `blasts.death(e, p)` handles faction deaths (Choir chained explosions, Brood acid bursts and splats, Veil crystal shatter; bosses get timed sequences via `later()`). Everything is pooled: fire and smoke sprites, ground rings, fresnel shells, 2 flash lights, scorch/splat decals. `projectiles.explode(pos, dmg, radius, friendly, equipment, kind)`. |
| Audio | `audio.js` | Fully synthesized WebAudio: layered gunshots, a convolution reverb send, `enemy()`, `death(faction, distance, size)`, `explosion()`, movement sounds (`jump`/`land`/`wallKick`/`grab`/`step`), `loop('wind'|'slide', level, freq)`, adaptive music. `maxVoices = 56`. |
| UI | `ui.js`, `style.css`, `fonts.css`, `input.js` | Screens are rebuilt with `innerHTML`: `frame()` keeps scroll position and focus on re-render; Escape steps back through menus. The HUD updates at 30 Hz. The `below-boss` class drops announcements below the boss bar. |

**Dev handle** (dev builds only): `window.__HOLLOWFRAME__` is the `Game` instance. For example,
`g.save.map='skyline'; g.start()`, `g.enemies.spawn('warden', new Vector3(...))`,
`g.enemies.kill(e)`, `g.weapons.switch(i)`, `g.world.renderer.info.programs.length`.

## 4. Version history (this project's changes)

- **0.10.0 Refit:**
  - Fixed movement clamping z to ±35 m on every map; large maps now clamp to their own `bounds`.
  - Shadow frustum follows the player.
  - Results screen reflects the selected factions.
  - Menu overlap on short screens fixed.
  - Recoil recovery, muzzle light, enemy flinch, layered audio and reverb.
  - HUD legibility and 9 px minimum type; scroll and focus kept on re-render; Escape navigation.
  - Pages workflow that deploys on push; OG image; version injected from `package.json`.
- **0.11.0 Weight:**
  - Post pipeline, reflection map, procedural surfaces, sky and dust, set dressing.
  - Rebuilt viewmodels in a separate render pass; dynamic resolution; lighter Low tier.
  - Parkour feel system (`feel.js`) and physics weight changes.
  - Gameplay browser suites start at Low under SwiftShader (`tests/low-quality.mjs`).
- **0.12.0 Menagerie:**
  - New articulated models and animation for all 26 enemy types (`enemy-models.js`); translucent energy shields.
  - **Fixed rooftop flicker:** Skyline roof decks were coplanar with their towers (z-fighting). Towers now stop 2 cm below and inside their decks, decks use `polygonOffset`, and perimeter wall corners are offset 2 cm.
  - Decals no longer overhang ledges; resolution hysteresis; boss bar overlap fixed.
- **0.13.0 Aftermath:**
  - **Fixed the 1–2 s weapon-switch freeze** (shader recompiles, see §5).
  - Removed all other first-use stalls: no mid-fight material disposal, and a draw-based warm-up at deploy.
  - New pooled explosion system and faction death effects with faction death sounds.
  - Flash lights are off on Low.
  - Tests wait for `settled(page)` after deploy.

## 5. Hard-won rules — do not break these

1. **Never dispose a material mid-fight.** When the last user of a shader program is disposed,
   three.js throws the program away and recompiles it on next use, costing about 1 s of freeze on
   Windows/ANGLE. That was the weapon-switch bug. Viewmodels use shared cached materials and are
   built once; enemy, corpse and zone materials are left to garbage collection. It is fine to
   dispose on **map change** (`loadMap`) or on explicit loadout rebuilds (`weapons.disposeModel()`
   only removes groups).
2. **Keep the scene's light count constant during play.** Adding or removing a light, or toggling
   `light.visible`, changes every shader's variant. Pooled lights sit at `intensity = 0` when idle.
   `world.flashLights` is toggled only by the quality setting. `world.warmup()` must not reveal lights.
3. **Anything that first appears mid-fight must be warmed up.** `renderer.compile` skips invisible
   objects, and ANGLE finishes pipeline setup only on the first real draw. `world.warmup(extra)`
   (called via `Enemies.prewarm` in `Game.start`) reveals hidden objects, disables culling and draws
   one frame scissored to a single pixel. New pooled objects added to the scene are covered
   automatically. New **enemy material variants** must be produced by `buildEnemyModel` so prewarm
   sees them. Don't add attributes lazily either: the vfx `instanceColor` buffer is created up front
   for this reason.
4. **Verify stalls objectively.** Record `renderer.info.programs.length` before and after gameplay
   events; it must stay flat. The scratch "hitch survey" (switch every weapon, spawn and kill every
   enemy type, fire every explosion kind) is the model to follow.
5. **No coplanar faces.** Z-fighting is very visible with the detail textures. Offset overlapping
   geometry by about 2 cm or use `polygonOffset` (decks and decals already do).
6. **GTAO only understands solid opaque geometry.** Mark sprites and particles as transparent or
   `userData.noAO = true`, or they stamp dark squares into the AO.
7. **Enemy models:** keep part names and handles (§3). Sensors have non-uniform scales, so pulse
   relative to `userData.baseScale`. Keep parts reasonably sized; they are the hitboxes, and
   ragdolls take the first 40 meshes.
8. **Map colliders drive navigation.** Changing sizes can break the spawn-to-start path tests in
   `tests/map.test.js`. Always run `npm test`.
9. **Reduced motion** must remove camera motion, flashes and speed blur (`world.reducedMotion`,
   `settings.reducedMotion`).

## 6. Testing gotchas (these cost hours)

- **Don't edit `src/` while browser suites run.** Vite hot-reloads the page mid-test and tests
  fail randomly. Edit first, then run the suites, ideally in the background, sequentially.
- SwiftShader is a CPU renderer. At High with post-processing it runs at about 1–3 FPS, and Low at
  about 15–20 FPS. Timing-based suites therefore use `lowQuality(page)` (seeds `settings.quality =
  'low'` in localStorage unless a test sets it) and `settled(page)` (waits for `game.elapsed > 0.3`
  after deploy, because the warm-up frame takes a few hundred ms there). Real GPUs are much faster.
- Rarely, a single SwiftShader frame stalls for 50–100 s at a random point. It has never
  reproduced in isolation and no shaders compile when it happens; treat it as an environment quirk,
  but tell the user if something similar is reported on real hardware.
- Headless Playwright supports pointer lock; the in-app browser pane does **not** (the game pauses
  with "Mouse capture was blocked"). Use scratch Playwright scripts for gameplay screenshots.
  Scratch scripts outside the repo must import Playwright by absolute path:
  `file:///C:/Programming/Visual%20Studio%20Code/HollowFrame/node_modules/@playwright/test/index.mjs`.
- Don't name an environment variable `GROUPS` in Git Bash (it's reserved). On Windows, prefer
  writing Python edit scripts to files rather than inline heredocs containing JavaScript template
  literals.
- `tests/browser-regression.mjs`' precision-shot check aims at the Warden's actual `e.sensor`
  world position; update similar tests the same way if models change.
- `tests/aim-browser.mjs` requires no gun mesh to block the ±0.06 NDC area around the crosshair in
  ADS (it ignores `userData.lens`), and the hip pose must be at `root.position.x === 0.32`.

## 7. Known limits and ideas for next time

- No human playtest on real hardware has been possible from the chat. Tuning values (landing dip,
  fall weight, bloom, enemy glow, explosion sizes) are best guesses; adjust them from player feedback.
- Enemies cost about 40 draw calls each now (about 20 before). If late waves are slow on weak GPUs,
  consider merging static parts per enemy or instancing.
- GTAO on High is the heaviest effect; dynamic resolution mitigates it.
- Possible next steps: weapon-specific muzzle effects and shell casings, enemy spawn-in effects,
  per-map weather, gamepad support, a proper settings toggle for post effects, merging enemy geometry.

## 8. Resuming in a new chat

Tell the assistant: *"Read memory.md and README.md in C:\Programming\Visual Studio Code\HollowFrame,
then …"*. Before shipping anything: run `npx prettier --write src tests`, `npm test`, the relevant
browser suites (with the dev server running and no edits during the run), `npm run build`, then
commit and `git push`. Confirm the deploy through `release-manifest.json` on the live site. Keep
this file updated with each version.
