# HOLLOWFRAME

**You are the interruption.** An original, single-player browser FPS about fighting the machine collective known as the Choir.

**Play it:** https://coder-4847.github.io/HollowFrame/ (desktop browser with WebGL2, mouse and keyboard).

**Version 0.13.0 — Aftermath** removes the weapon-switch freeze and every other mid-fight shader stall, and adds new death effects and explosions. Twenty regular enemy types and six bosses span three factions and eight arenas, with eighteen guns, three main melee kits, four difficulties, and eight-wave operations.

### What changed in 0.13.0

- **Fixed: weapon switching froze the game for 1–2 seconds.** Every switch cloned and disposed about 80 materials, and disposing the last user of a shader makes three.js discard and recompile it. Guns are now built once per loadout from shared materials, and switching just changes which one is visible: measured at 2–7 ms, down from about 1,000 ms.
- **Fixed: other first-use stalls.** Enemy, corpse and effect materials are no longer disposed mid-fight (they are garbage-collected, so compiled shaders stay cached). Deploying pre-draws every pooled effect, projectile, holstered gun and enemy variant for the selected factions in one hidden, single-pixel frame, because some drivers (ANGLE on Windows) finish GPU setup only on the first real draw. A survey that switches every weapon, spawns and kills all 26 enemy types and fires every explosion type now compiles no new shaders during play.
- **Explosions** (rockets, grenades, launcher clusters, Volatiles, enemy shells, boss slams): a white-hot flash, billowing fireballs cooling from yellow to red, a rim-lit pressure shell, a ground shockwave ring, a light flash on the surroundings, rising smoke columns, embers, debris and a scorch mark that fades.
- **Death effects by faction:** Choir machines spark and blow apart, heavies chain secondary detonations, and bosses go up in a sequence of blasts before a huge final one. Brood burst in acid (goo gouts, gibs, a spore cloud and a green splat), and their bosses rupture sac by sac. Veil shatter in a bright implosion with crystal shards, an energy ring and drifting sparkles. Each faction has its own death sound, and heavy or boss kills nearby shake the view.

### 0.12.0 — Menagerie

- **New enemy models for all 26 types.** The Choir are articulated mechs with reverse-jointed legs, armoured torsos with glowing vents, visor heads, pauldrons, gun-pod arms that raise to aim, backpacks and exhausts, plus role kit: Bastion missile racks, a framed translucent Bulwark tower shield, the Mender's repair mast, the Lancer's rail rifle, the Fabricator's drone bay and the Cantor's halo. Skitters and Volatiles are four-legged crawlers. The Brood are insects with segmented swaying abdomens, spiked carapaces, clustered glowing eyes, snapping mandibles, pulsing acid sacs, horns and six clawed legs. The Veil are hovering crystalline wraiths with crowned heads, halos, blade or orb arms, energy shields and orbiting shards. Bosses scale these up with missile racks, rotors and exposed cores.
- **Enemy animation:** walk cycles driven by actual movement speed, a tripod gait for insects, hovering and bobbing for the Veil, head tracking, and arms that raise to aim. Glow pulses while an attack is telegraphed, and bodies flash white when hit. Every part is still a hit target with its original gameplay role, so breaking an arm still disarms it.
- **Fixed flicker:** Skyline's roof decks sat exactly on their buildings (about 1,900 m² of coplanar faces), so they z-fought as you moved. Towers now stop just below and inside their decks, decks carry a depth bias, and perimeter-wall corners no longer overlap.
- **Fixed:** grime decals no longer overhang ledges; dynamic resolution uses hysteresis so the image never pumps between sharp and soft; map announcements drop below the boss health bar.

### 0.11.0 — Weight

**Visuals**
- Post-processing: HDR bloom on lights and emissives, ground-truth ambient occlusion (High), colour grade, vignette, subtle grain, and edge chromatic aberration. Medium keeps bloom and grading; Low renders directly.
- Image-based reflections on every metal and painted surface.
- Procedural surface detail generated at startup: panel seams, rivets, scratches, grime, and matching roughness and normal maps. World-scale UVs keep texel density constant on every box and cylinder. Brood and Veil enemies use a separate organic skin with veins and mottling.
- A gradient sky with sun halo and drifting cloud banding that fades into each map's fog, plus floating dust motes lit by the sun colour.
- Set dressing on every map: rubble along wall bases, grime decals on floors and decks, and cables sagging between tall structures (a few draw calls, seeded per map).
- A rebuilt first-person arsenal: receivers, rails and reflex optics, vented handguards, round barrels and muzzle brakes, angled magazines, skeleton stocks, gloved hands with fingers and armoured sleeves, and per-family parts (twin-barrel pump shotgun, revolver drums, launcher tubes, energy coils). Reflex sights frame the crosshair when aiming; the weapon renders in its own pass, so it never clips into walls or picks up post effects.
- Dynamic resolution keeps the frame rate steady on slower GPUs.

**Movement feel**
- A sprung camera rig: landings dip the view in proportion to fall height and nod the head; slides drop, lean into your steering and punch the FOV; wall kicks roll the view away from the wall; mantles pitch the head up and show both hands gripping and pushing off the ledge.
- Heavier physics: a stronger fall than rise (jump speed compensated so every gap and ledge route is unchanged), weightier ground acceleration and braking, and hard landings that briefly cost speed. **Hold crouch as you land at speed to roll straight into a slide** and keep your momentum.
- Speed-driven FOV, radial speed blur and wind.
- Weapon sway that lags behind mouse look, with dip, lean and slide cant.
- Sound: jump whoosh, landing thuds scaled by impact, wall-kick impacts, ledge grabs, cadence-synced footsteps that are heavier at a sprint, and a continuous slide scrape.
- Particles: dust bursts on jumps, landings and wall kicks, plus a slide trail with sparks at high speed.
- Reduced-motion removes every camera offset, speed blur and FOV kick while keeping the sounds and particles.

### 0.10.0 — Refit

- **Fixed:** the three large arenas (Skyline, Saltreach, Spillway) clamped movement to ±35 m on the north–south axis, so players, enemies and remains could not reach half of each map and Saltreach's insertion point was unreachable.
- **Fixed:** sun shadows only covered a fixed 90 m square around the origin; the shadow frustum now follows the player (texel-snapped to avoid shimmer).
- **Fixed:** results screen always reported "/ 2" bosses and "THE CHOIR REMAINS" regardless of the faction mix; it now reflects the selected factions.
- **Fixed:** the command menu overlapped its header on short windows (e.g. 1366×768 laptops).
- **Fixed:** overlapping signage at the Skyline insertion roof.
- **Feel:** recoil now settles back after each shot (sustained fire still climbs), with slight horizontal kick; muzzle flashes light the scene; enemies flinch when hit; kill confirmation sound.
- **Audio:** layered gunshots (transient, body, thump, room tail), a synthesized reverb send, distance-filtered enemy fire, and a fuller adaptive music loop.
- **Interface:** HUD text readable on bright maps (Saltreach, Whiteout); 9 px minimum type size; selecting a map/weapon/difficulty keeps your scroll position and focus; Escape steps back through menus; results actions sit above the fold; themed scrollbars; touch-only devices are told a mouse and keyboard are needed.
- **Deployment:** pushes to `main` build, test and publish to GitHub Pages automatically; social preview metadata added.

## Run

Requires Node.js 22.12+ (Node 24 recommended), npm, and a desktop browser with WebGL2.

```sh
npm ci
npm run dev
```

Open the printed local URL, choose **Select Operation**, select a map and difficulty, and deploy. Allow mouse capture. Escape pauses and releases the mouse. Embedded previews may restrict pointer lock; use a regular browser tab if needed.

```sh
npm run build     # static output in dist/
npm run preview   # inspect the production build
```

Serve over HTTP/HTTPS rather than opening index.html directly. No account, backend, API key, or remote game assets are required. Fonts are bundled; synthesized audio starts after a menu interaction.

## Operations and progression

**Choose your enemies:** Select Operation has three faction switches. Enable any combination of Choir, Brood and Veil; at least one stays enabled. Selection persists between sessions. Existing saves start with the Choir selected. Wave rosters, bosses and summoned reinforcements respect these switches on every map. Single-faction operations contain both of that faction's bosses. Mixed operations include a boss from each selected faction: two bosses with two factions, three with all three (the final wave can contain two bosses).

| Faction | Regular enemies | Bosses |
| --- | --- | --- |
| The Choir | Existing ten machine types, including shield, repair, artillery, fabricator and cloak specialists | Conductor, Architect |
| The Brood | Nipper melee swarm; Carapace armored charger; Bilecaster acid volleys; Broodkeeper hatchlings; explosive Spore Burster | Broodmother: acid fans and hatchling reinforcements. Dreadmaw: heavy volleys and a large ground rupture. |
| The Veil | Hollow Thrall melee; Prism Guard shield and energy volleys; Far Seer precision shots; Life Weaver healing; cloaked Phase Blade | Hierophant: radial energy volleys and reinforcements. Prismarch: sweeping beam blocked by solid cover. |

New bosses telegraph their area attacks with ground rings, expose vital cores after attacks, and become vulnerable when both attack organs/emitters are destroyed. Brood sacs stop producing hatchlings when destroyed; Weaver healing organs can also be disabled. Healers support their own faction. All factions use the existing layered navigation, including rooftop stairs and edge protection. Map/difficulty records remain shared across faction selections.

| Arena | Identity |
| --- | --- |
| Ashworks | Industrial furnace lanes, cover, raised service deck |
| Sunbreak Relay | Desert dish installation, long sightlines, flanking bunkers |
| Whiteout Array | Snowbound laboratory corridors and courtyards |
| Cinderline | Ruined city blocks, alleys, elevated transit steps |
| Deepwell | Machine chambers with periodic discharge fields and a cache quench switch |
| Skyline Severance | Three linked rooftops at 4, 8 and 12 metres, stair bridges, jump routes and lethal falls into the void |
| Saltreach Expanse | Wide 112-metre salt basin, rock formations, drilling stations, raised survey deck and timed steam vents |
| Verdigris Spillway | Ground routes beneath 4- and 8-metre terraces, turbine cover, connecting stairs and toxic runoff |

Existing arenas now have additional cover trim, grilles, service panels, lighting and location-specific machinery. New arenas include mantle steps and alternate parkour routes. Machines use a layered navigation graph that distinguishes ground from overhead decks, routes different body sizes across stairs and bridges, and keeps them away from rooftop edges. Enemies use walking routes; they do not wall-jump or mantle.

Steam vents warn before activating. Runoff and discharge fields hurt only at their surface elevation, so overhead decks provide protection. Hazard grids can be temporarily quenched near the supply cache during combat. Skyline has no ground safety net: falling below the lowest roof ends the operation.

A threat-budget director composes eight waves with bounded adaptation to health and accuracy. Shield formations, missile pressure, swarms, blackout, elites, and two boss encounters vary the pacing. Difficulty changes composition, reaction speed, accuracy, damage, recovery, and ammunition supply; enemy health is not inflated.

The Conductor uses missile mounts and a telegraphed radial slam. The Architect uses a cover-blocked sweeping beam and missile racks. Both expose cooling cores. Destroying weapon mounts disables missile fire; disarming the Architect also forces its core open. Specialists include repair machines, shield bearers, marksmen, suicide units, drone fabricators, command-aura Cantors, and cloaking Shades. Sensors, plating, legs, weapon mounts, and specialist components have different combat effects.

Destroy machines to earn **scrap** for six temporary upgrade types, each capped at two ranks. Press B between waves to open the field terminal; the preparation timer pauses while shopping. Upgrades affect reload/vent speed, weak-point damage, armor, mobility, explosive radius, and recoil. They reset each operation.

**Alloy** persists between operations and buys arsenal sidegrades. Configure three primary guns, one heavy, one secondary, a melee tool, and equipment. The eighteen guns include automatic, burst, precision, shotgun, machine-gun, energy, cryo, revolver, rocket, grenade, charged-rail, and cluster weapons. Energy weapons use heat and venting. Equipment choices are a repair kit, EMP, or grenade; melee choices are blade or hammer. Five starter guns are issued free, plus 300 starting alloy. Between waves ammunition, equipment charges, and some health/armor recover.

Results show score, kills, accuracy, weak hits, damage, time, components, elites, bosses, scrap spending, wave times, and alloy. Personal and map/difficulty records persist locally. Existing Phase I saves migrate under the original `hollowframe-v1` storage key; unavailable storage falls back to the session. Reset in Settings requires confirmation.

## Parkour

- **Slide:** hold W + Shift to build sprint speed, then press C or Ctrl. Sliding lasts up to 0.8 seconds, uses a low stance, and has a one-second cooldown. Release crouch to stop; holding it after the slide keeps you crouched.
- **Slide jump:** press Space during a slide to carry speed into the air. Air steering remains available.
- **Wall jump:** press Space while airborne beside a vertical wall to kick away and upward. Two kicks maximum before landing; the second must use a different wall.
- **Mantle:** hold W and press Space toward a reachable ledge (up to two metres above your feet). Climbing requires a clear standing space and path, lasts 0.38 seconds, and lowers your weapon. Firing/melee is blocked during the climb; you can still take damage.
- **Forgiving jumps:** 100 ms edge grace and 120 ms input buffering help with late/early presses.
- **Landing roll:** hard landings briefly slow you down. Hold C/Ctrl while landing at speed to go straight into a slide instead.

These mechanics use solid geometry, including the new rooftop platforms and facility ledges. Movement constants and collision helpers live in src/movement.js. Reduced-motion settings remain supported; no forced wall-camera roll is added.

## Controls

In **Configure Loadout**, choose Ranged or Melee. The melee class replaces firearm use for the operation; your saved gun loadout remains available when you switch back. All three melee kits are available immediately:

- **Arc Saber:** broad energy sweeps; raising guard has a 0.22-second perfect-parry window, then modest damage reduction.
- **Ion Spear:** narrow, single-target thrusts with 5.4-metre reach; bracing reduces frontal damage.
- **Sword & Shield:** quick cuts with 80% frontal damage reduction while guarding.

Left mouse attacks, right mouse guards, and Q still uses equipment. Attacks and blocks spend stamina; releasing guard restores it faster. Empty stamina breaks guard briefly. Attacks from behind and environmental hazards bypass guard. Sprinting and mantling prevent attacks. The ranged class retains the existing V/F quick-melee tools.

Shooting now uses soft muzzle glows, smoke and directional impact sparks. Metal, organic and alien impacts use different colors and particle motion. Explosions add a brief glow and smoke. Defeated enemies leave lightweight articulated physics remains with gravity, momentum, constraints and terrain collision. They fade during the final second and are removed at five simulation seconds; at most six corpses are retained, with older remains removed during heavy fighting. Pausing freezes their simulation. Reduced-motion suppresses muzzle glows and melee trails; particle settings suppress optional particle effects.

| Input | Action |
| --- | --- |
| WASD / mouse | Move / look |
| Left / right mouse | Fire / aim |
| Left Shift | Sprint forward |
| Left Ctrl or C | Crouch / slide while sprinting |
| Space | Jump / wall kick / W + mantle |
| R | Reload or vent |
| 1–5 / wheel | Switch equipped weapon |
| V or F | Melee |
| Q | Equipment |
| B | Field upgrades between waves |
| E | Begin next wave; quench environmental hazards near the cache during combat |
| Escape | Pause and release mouse |

Settings include sensitivity, FOV, shake, master/music/effects volume, graphics quality, shadows, particles, and exposure. Accessibility options add inverted vertical look, toggle aim, toggle crouch, reduced motion/flash, high-contrast HUD, contextual tips, and an optional FPS/frame-time/draw-count display. Toggles clear on pause so controls do not remain latched on resume. Reduced motion removes camera/weapon bob, random shake, sprint FOV changes, muzzle flash, menu panning and weather motion; aiming and weapon recoil remain functional.

The first operation has a twelve-second preparation window (E skips it). Field tips explain movement, sensors, repairs, heat and upgrades as needed. A target readout confirms hits, a bounded feed shows scrap earned, and reload/charge/heat bars make weapon state visible. Danger warnings take priority over incidental hit notices. Keyboard focus follows primary menu actions.

Presentation updates include moving weapon bolts, shotgun pump travel, more distinct shotgun/revolver silhouettes and instanced cache/spawn surface markings. Audio limits simultaneous voices; the HUD refreshes at up to 30 Hz, inactive screens render less often, and hidden tabs skip rendering. These measures preserve simulation timing during play.

## Architecture

Plain ES modules, Three.js, and Vite. Models, textures, maps, sound, and effects are generated by the project.

| Modules | Responsibility |
| --- | --- |
| `main.js`, `core.js`, `progression.js` | Lifecycle, damage/collision math, save migration, unlocks and records |
| `data.js`, `content.js`, `expansion.js` | Weapons, machines, difficulties, maps, equipment and upgrades |
| `world.js`, `map.js`, `maps.js`, `expansion-maps.js`, `terrain-maps.js` | Renderer, arena construction, resource disposal and collision geometry |
| `arena-details.js`, `terrain-art.js` | Instanced environmental detail, procedural surfaces and rooftop machinery |
| `post.js`, `atmosphere.js`, `surfaces.js`, `set-dressing.js` | Post-processing, sky and dust, procedural surface maps, rubble/decals/cables |
| `input.js`, `player.js`, `weapons.js`, `viewmodel.js` | Pointer lock, movement, firing, reload, heat, charge, melee and first-person models |
| `movement.js`, `feel.js` | Parkour physics and its camera, sound and particle feedback |
| `enemies.js`, `enemy-models.js`, `bosses.js`, `navigation.js` | Components, tactics, articulated models and animation, bosses and elevation-aware pathfinding |
| `projectiles.js`, `vfx.js`, `blasts.js`, `audio.js` | Pooled projectiles/particles/tracers, smoke, debris and synthesized audio |
| `director.js`, `waves.js`, `upgrades.js`, `environment.js` | Encounter composition, rewards, temporary upgrades and hazards |
| `polish.js`, `markings.js` | Validated accessibility settings, contextual hints and instanced field markings |
| `ui.js`, `style.css` | Menus, loadout, armory, terminal, HUD and results |

Source modules live in `src/`. Simulation pauses on focus loss, pause menus, and the upgrade terminal. Performance measures include capped pixel ratio, cached resources, bounded entity/particle pools, throttled navigation, and disposal on map changes.

## Verification

```sh
npm test
npm run build
# With dev server on port 5173 and Chrome installed:
npm run test:browser
npm run test:phase2
npm run test:phase3
npm run test:phase4
npm run test:profile # synthetic rendering workload, not hardware FPS
npm run test:combat
npm run test:movement   # slide, wall kick, mantle, pause and restart
npm run test:terrain    # rooftop traversal, falls, hazard elevation and map cleanup
npm run test:factions   # selection, abilities, boss phases and cleanup
npm run test:aftershock # melee controls, defense, effects and corpse cleanup
npm run test:release    # arsenal, fuse, storage and cleanup cases
npm run test:production # serves dist/ under a test subdirectory
npm run check:format
npm run release:manifest # run after build; SHA-256 hashes in dist/
```

The browser suites expect `npm run dev` to be serving on port 5173. `HF_BROWSER=msedge` selects Edge for the browser regression and targeted phase suites. `HF_MAPS=cinderline,deepwell` selects sustained-combat arenas. Browser tests use instrumented scenarios; the sustained driver aims/navigates automatically through ordinary damage, ammo, upgrades, and enemy systems while skipping preparation timers. It does not replace human playtesting. Screenshots and JSON evidence are written to ignored `artifacts/`. See [VERIFICATION.md](VERIFICATION.md) for actual results and limits.

The `window.__HOLLOWFRAME__` inspection handle exists only in development builds.

## Static deployment

Every push to `main` runs `.github/workflows/pages.yml`: install, format check, unit tests, build, release manifest, then the contents of `dist/` are published as a single commit on the `gh-pages` branch, which GitHub Pages serves at https://coder-4847.github.io/HollowFrame/. The workflow can also be started manually from the Actions tab.

To host elsewhere, upload the contents of `dist/` to any static host. `release-manifest.json` identifies the version and SHA-256 of every shipped asset; build again before generating a fresh manifest if source changes. Relative asset paths support both root and subdirectory hosting. No server logic or route rewriting is needed.

## Remaining work

The Phase V automated release pass is complete. Human balance/weapon-feel evaluation, subjective audio mixing, target-hardware profiling and broader browser coverage remain necessary before a release claim. Current art is deliberately procedural and stylized; destruction is component breakage, debris and smoke, lightweight articulated remains, and no destructible buildings. Desktop mouse/keyboard only; no multiplayer. Chrome/Edge have automated coverage; Firefox/Safari and extended human sessions remain unverified.

## Attribution

Game-specific designs, names, maps, UI artwork, procedural models and synthesized audio are original. Three.js, Vite and tooling retain their package licenses. Barlow Condensed and IBM Plex Mono are bundled through Fontsource. Only WOFF2 font files ship; the renderer is a separate cacheable chunk. Runtime library and font notices are in `public/licenses/` and copied to the build.


