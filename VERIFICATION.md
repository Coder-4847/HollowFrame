# Aftershock combat presentation — v0.9.0

Added directional impacts, pooled muzzle/explosion glows and smoke, and lightweight articulated corpse physics. Corpse models reuse geometry, own disposable materials, are capped at six, fade after four seconds and expire at five simulation seconds. Restart/map changes clear them. Added a persistent melee combat class with Arc Saber, Ion Spear and Sword & Shield, stamina, directional defense, a brief sword-parry window, attack animations and trails. Ranged quick melee remains available.

- 38 system tests pass. Chrome gameplay regression (17 checks), faction regression (18 checks), and all-weapon aiming visibility checks pass.
- Aftershock browser checks pass in Chrome and Edge (25 each): selection/persistence, actual mouse attack and guard input, spear reach, sword sweep, cooldown, stamina/recovery, front/rear defense, hazard bypass, parry, input reset, cover occlusion, corpse gravity/expiry/cap/reset, effect generation, reduced motion and particle settings. Repeated corpse resource counts stabilize after warmup in both browsers. Production build, formatting and static subdirectory checks pass.
- Automated melee combat experiments reached boss fights, but did not clear full operations. The simple navigation/guard driver and melee balance need further playtesting; no eight-wave melee victory claim is made. Existing firearm regression coverage remains passing.

Evidence: artifacts/aftershock-*.json, melee-*.png, aftershock-ragdoll.png. These are lightweight constrained part bodies, not a full skeletal physics engine. Human combat feel and hardware performance remain unverified.

## Previous faction evidence

# Convergence faction update — v0.8.0

Verified 25 September 2026. Added the Brood and Veil as original factions, each with five regular enemies and two bosses. Three persistent operation switches support all seven nonempty faction combinations. Legacy saves retain the Choir selection. Mixed operations include bosses from every selected faction; enabling all three adds a third boss in the final wave.

- 37 system tests pass, including strict selection normalization, every faction combination across map modifiers and all difficulties, roster budget accounting and boss-faction coverage.
- 18 faction browser checks pass in Chrome and Edge: switches/persistence, selected wave queue, hatchlings and disabled sacs, breakable shields, same-faction healing and disabled healing focus, cloak, telegraphed charge, all four new bosses' attacks/core windows/reinforcements/disarming, resource cleanup and no runtime errors.
- Seven full eight-wave combat runs pass: Brood and Veil individually on Ashworks, Skyline and Spillway, plus all three factions together on Skyline. Individual runs defeat two bosses; the mixed run defeats three. The automated driver uses ordinary movement, damage, ammo and earned upgrades; it skips preparation timers. This does not establish human difficulty balance.
- Existing Chrome regression suites pass: 17 gameplay, 22 Phase II and 23 Phase III checks.
- Production build, formatting and static subdirectory browser verification pass. No external asset requests or runtime errors in the production check.
- Model lineup screenshots and faction reports are in artifacts/factions-*.png and artifacts/factions-*.json; faction combat evidence is in artifacts/sustained-*-brood.json, sustained-*-veil.json and sustained-skyline-choir-brood-veil.json.

Human balance and performance testing remain open. Records are still grouped by map/difficulty, not split by faction selection. New art and enemy names are original procedural designs. No public deployment was performed.

## Previous arena evidence

# High Ground arena update — v0.7.0

ADS follow-up: lowered aimed poses with extra clearance for scoped rifles and launchers; reduced visual weapon recoil and bob while aiming. Sniper zoom remains 39 degrees. The dedicated aim browser check verifies a clear central target area for all 18 weapons at rest and maximum recoil, plus zoom and hip-fire recovery. All 34 system tests and the production build pass.

Verified 24 September 2026. Three new arenas bring the total to eight: Skyline Severance (three linked rooftop heights and lethal void), Saltreach Expanse (open terrain and timed steam vents), and Verdigris Spillway (stacked decks and toxic runoff). Existing maps receive instanced trim, grilles, service panels and themed machinery. Navigation now stores multiple elevations per ground cell, checks body clearance along routes, and prevents rooftop edge cutting. Enemies use stairs and bridges; parkour shortcuts remain player routes.

- 34 system tests pass, including all map spawn clearances and rooftop routes for normal, heavy and boss bodies.
- Six terrain browser checks pass in Chrome and Edge: eight-map selection, actual enemy and boss traversal up and down both rooftop bridges, lethal falls, elevation-aware hazard damage, stable resources across repeated eight-map cycles, and no runtime errors.
- Chrome gameplay regression: 17 checks pass. Phase III: 23 checks pass, including hazards and eight-map resource cleanup.
- All eight arenas clear eight waves and both bosses through normal combat with the automated driver. The driver retains navigation waypoints between updates, avoiding backtracking to the same grid anchor. It uses ordinary movement, weapons, damage, ammunition and upgrades; preparation timers are skipped. This is integration coverage, not human balance validation.
- Production build and static subdirectory browser test pass, with local fonts, mouse capture, no external requests, no inspection handle and no runtime errors.
- Rendering workload coverage includes all eight maps at two presets with 24 actors. Measurements use software WebGL and do not establish hardware FPS.

Screenshots and reports are in artifacts/terrain-*.png, terrain-chrome.json, terrain-msedge.json, sustained-*.json and render-profile.json. Human playtesting, difficulty tuning and target-GPU performance remain open. The game remains unpublished.

## Previous movement evidence

# Momentum movement update — v0.6.0

Added sprint slides, slide-jump momentum, wall kicks and ledge mantling without changing arena layouts. Movement constants and pure collision helpers are isolated in src/movement.js. Mantling checks the full lift/traverse path and standing clearance; fast movement uses short collision steps. Wall kicks require a different surface for the second kick, cap at two per airborne sequence, and reset on landing. Jump buffering and edge grace are included.

Verification: 30 system tests pass (eight new movement tests), nine movement browser checks pass in both Chrome and Edge, the 17-check gameplay regression passes, and all 19 accessibility/feedback checks pass in Chrome. Tests cover slide cooldown, carried momentum, same-wall rejection, kick cap, low ceilings, thin obstacles, safe mantle destinations, jump buffering, edge grace, pause/resume during climbing and restart cleanup. Production build and static subdirectory smoke test pass.

Controls: sprint W + Shift then press C/Ctrl to slide; Space during a slide launches; Space while airborne next to a wall kicks away; W + Space toward a reachable ledge mantles. Movement feedback appears below the crosshair, and the in-game manual documents the mechanics. Firing/melee are blocked during mantles. Human tuning and future parkour-oriented arena design remain open.

## Archived release-candidate evidence
# Phase V release-candidate verification

Verified 24 September 2026, **0.5.0-rc.1**.

- 22 system tests and formatting checks pass.
- Chrome gameplay regression: 17 checks; Phase II: 22; Phase III: 23; Phase IV: 19.
- Eight release-specific checks pass in both Chrome and Edge: all eighteen weapons fire through the normal update path, timed cluster fragmentation, repeated weapon-reset resource stability, reset cancellation, malformed JSON recovery, visible storage-denied warning, migration of invalid legacy fields, and no page errors.
- All five arenas complete eight waves and both bosses through normal combat. Final runs: Ashworks 82 kills / 109 simulated seconds; Sunbreak 72 / 111; Whiteout 74 / 135; Cinderline 71 / 112; Deepwell 83 / 137. The automated driver aims/navigates, buys earned upgrades and skips preparation timers. It does not establish human difficulty.
- Static production build launches from a subdirectory, loads its local fonts, captures/releases the pointer, contains no development inspection handle, and makes no external requests. No missing assets or page errors in the passing check.
- WOFF2-only fonts remove six redundant WOFF assets (about 96 KB). Main JS is 107.77 KB / 39.26 KB gzip, renderer 490.29 KB / 122.70 KB gzip, CSS 28.57 KB / 7.25 KB gzip. Assets total 751,802 bytes before the manifest and ZIP compression.
- A release manifest records each shipped file's size and SHA-256. The ZIP contains the static site at its root, with no node_modules, source, test artifacts or save data.
- Rendering workload profiling was rerun across five arenas and two graphics presets with 24 actors. Results in artifacts/render-profile.json are CPU submission timings under software WebGL, not hardware FPS.

Release fixes: timed cluster detonation now emits fragments, storage failure remains visible after startup-menu rendering, and the frame exits promptly if enemy damage ends the operation. Browser build errors and source TODO/debug statements were checked. The game remains unpublished.

**Remaining validation:** Firefox and WebKit runtimes are not installed here; Safari/Firefox, target-GPU performance, long human sessions, subjective audio/weapon feel and difficulty tuning remain unverified. Prior Chrome/Edge coverage below remains relevant. No unsupported balance or hardware-performance claim is made.

## Previous Phase IV evidence


Verified locally on 24 September 2026, version 0.4.0. This report supersedes the Phase III test snapshot.

## Current evidence

- **System tests:** 22 pass, including strict settings normalization and contextual-tip priority alongside damage, collision, navigation, save migration, unlocks, encounter budgets and upgrades.
- **Chrome / Edge gameplay regression:** 17 checks pass in each browser, including real mouse capture, movement, stairs, reload, damage, pause, defeat/restart, eight-wave victory, saved score and compact menus.
- **Phase IV checks:** 19 pass in each browser. Keyboard focus; successive setting changes; persistence; onboarding; toggle aim/crouch; inverted look; reduced motion; quick-click automatic fire; reload progress; flash suppression; target/kill feedback; performance display; warning priority; input reset on pause; frozen upgrade-terminal animation; audio voice cap/release; compact settings; and no errors/missing assets.
- **Prior expansion regression:** 22 Phase II and 23 Phase III checks pass in Chrome after the changes. Weapons, equipment, components, bosses, specialists, hazards, upgrade economy and resource cleanup remain functional.
- **Static build:** Vite passes. JavaScript 597.84 KB / 162.71 KB gzip; CSS 28.98 KB / 7.33 KB gzip. Bundled fonts and license files remain local.
- **Production hosting:** final build passes subdirectory launch, mouse capture, pause, absence of the development inspection handle, no external requests and no runtime/missing-asset errors.

## Sustained combat

All five arenas clear all eight waves and both bosses through normal weapon damage, ammunition, earned upgrades and equipment.

| Arena | Kills | Simulated seconds | Bosses |
| --- | ---: | ---: | ---: |
| Ashworks | 75 | 115 | 2 |
| Sunbreak | 72 | 103 | 2 |
| Whiteout | 78 | 136 | 2 |
| Cinderline | 72 | 131 | 2 |
| Deepwell | 75 | 148 | 2 |

The driver automatically navigates and aims, skips preparation timers, and does not inject kills or grant health/ammunition/scrap. These are completion/integration checks, not evidence that a human will clear the game or find it balanced.

## Rendering and visual review

The synthetic profile covers five maps at both low and high quality, at 1280×800 with 24 machines. Recorded visible draw counts range from 227 to 387; triangle counts range from 7,806 to 10,938. Median CPU render-submission times range from 0.6 to 1.4 ms, and sampled p95 from 0.7 to 4.6 ms. These use software WebGL and exclude a complete gameplay/GPU workload; they must not be converted into hardware FPS claims.

Repeated five-map switching remains stable after warmup: 193 geometries, 3 textures and 231 scene children at the Deepwell checkpoint. The new markings use two instanced draw calls. Audio is bounded at 48 voices and releases completed voices. Paused screens render less frequently, hidden tabs skip rendering, and the field HUD updates at up to 30 Hz.

Screenshots of the settings, compact layout and high-contrast field HUD were inspected. A field-tip overlap with the HUD was corrected. Source and scripts were formatted; production assets rebuilt and retested.

## Corrections during this phase

- Automatic guns now preserve a quick press/release occurring between simulation frames.
- Settings validate numeric bounds and boolean types. Sequential settings edits retain their values.
- Toggle controls reset when mouse capture is released or play is paused.
- Upgrade screens freeze decorative scene animation as well as combat timers.
- Warning priority prevents ordinary armor-hit notices from hiding boss/environmental danger messages.
- EMP-stunned Cantors no longer buff surrounding units during the stun.
- Reload magazine animation uses the upgraded reload duration.
- Repeated storage error notifications replace the existing toast instead of stacking.

## Release limits

Firefox/Safari, target-hardware frame-rate profiling, long human sessions, subjective combat/audio review and difficulty tuning remain unverified. The art remains original stylized procedural geometry. This is a completed polish pass, not a production-release certification. No public deployment was performed.

Run commands are in README.md. Reproducible scripts and tests live in tests/. Local screenshots, browser reports, five combat reports and render-profile.json are in the ignored artifacts/ directory.


