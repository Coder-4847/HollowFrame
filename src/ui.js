import { MELEE_KITS } from './melee-class.js';
import { fieldHint } from './polish.js';
import { FACTIONS } from './factions.js';
import { UPGRADES } from './expansion.js';
import { WAVE_COUNT } from './director.js';
import { WEAPONS, CONTROLS } from './data.js';
import { MAPS, DIFFICULTIES, LOADOUT_SLOTS, EQUIPMENT, MELEE } from './content.js';
const icon =
  '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M5 4h8v9h6V4h8v24h-8v-9h-6v9H5z" stroke="currentColor" stroke-width="2"/><path d="M2 1h6M24 1h6M2 31h6M24 31h6" stroke="currentColor"/></svg>';
const arrow = '<span aria-hidden="true">↗</span>';
export class UI {
  constructor(game) {
    this.game = game;
    this.el = document.querySelector('#ui');
    this.damageAngle = 0;
    this.hitTime = 0;
    this.hitKind = 'normal';
    this.screen = '';
    this.armoryIndex = 0;
    // Remember the last activated control so re-rendered screens can restore keyboard focus.
    this.el.addEventListener('click', (e) => {
      const control = e.target.closest?.('button');
      const data = control && [...control.attributes].find((a) => a.name.startsWith('data-'));
      this.lastControl = data ? `[${data.name}="${CSS.escape(data.value)}"]` : null;
    });
  }
  brand() {
    return `<div class="brand">${icon}<span>HOLLOWFRAME<small>FIELD OPERATIONS / 07</small></span></div>`;
  }
  menu() {
    this.screen = 'menu';
    const best = this.game.save.best || 0;
    const map = MAPS.find((m) => m.id === this.game.save.map);
    this.el.innerHTML = `<main class="menu"><header>${this.brand()}<div class="build"><i></i> SYSTEM ONLINE <span>REFIT / v${__APP_VERSION__}</span></div></header><div class="menu-body"><section class="hero"><div class="eyebrow"><span class="line"></span> ${map.name} / ${DIFFICULTIES[this.game.save.difficulty].name}</div><h1>NOTHING<br>LEFT <em>HOLLOW.</em></h1><p>Eight battlefields. Three enemy factions.<br>Build your frame. Break the Choir.</p><nav class="main-nav"><button class="primary" data-action="deploy"><span>SELECT OPERATION<small>MAP / DIFFICULTY / DEPLOY</small></span>${arrow}</button><button data-action="loadout"><b>01</b> CONFIGURE LOADOUT ${arrow}</button><button data-action="armory"><b>02</b> FIELD ARMORY ${arrow}</button><button data-action="controls"><b>03</b> OPERATOR MANUAL ${arrow}</button><button data-action="settings"><b>04</b> SYSTEM SETTINGS ${arrow}</button></nav></section><aside class="mission"><div class="eyebrow">OPERATION / 001 <span>LIVE</span></div><div class="map-art"><div class="map-lines"></div><span class="map-label a">${map.region}</span><span class="map-label b">${map.name}</span><span class="map-label c">INSERTION</span><i></i></div><div class="mission-title"><div><small>${map.region}</small><h2>${map.name}</h2></div><span>↗</span></div><p>${map.description}</p><div class="mission-stats"><div><small>OBJECTIVE</small><strong>SURVIVE 8 WAVES</strong></div><div><small>THREAT</small><strong class="orange">ESCALATING</strong></div></div><div class="mission-bottom"><span>18 WEAPONS / 3 FACTIONS / 6 BOSSES</span><span>●</span></div></aside></div><footer><span>YOU ARE THE INTERRUPTION. / ${this.game.save.credits} ALLOY</span><div><span>PERSONAL BEST <b>${best.toLocaleString()}</b></span><span>DESKTOP / MOUSE + KEYBOARD</span><button data-action="controls" class="text-button">CONTROLS [ ? ]</button></div></footer></main>`;
    this.bind();
    if (this.game.storageAvailable === false)
      this.error('Local saving is unavailable. Progress lasts for this session only.');
    else if (!matchMedia('(any-pointer: fine)').matches)
      this.error(
        'HOLLOWFRAME is played with a mouse and keyboard. Touch controls are not supported.',
      );
  }
  frame(title, kicker, body) {
    // Re-rendering the same screen (selecting a map, weapon, etc.) keeps the reader's place.
    const scroll = this.framed === this.screen ? this.el.querySelector('.panel')?.scrollTop : 0;
    this.framed = this.screen;
    this.el.innerHTML = `<main class="overlay"><header>${this.brand()}<button class="back" data-action="back">← BACK</button></header><section class="panel"><div class="eyebrow">${kicker}</div><h2>${title}</h2>${body}</section><footer><span>HOLLOWFRAME / ${this.game.map.name}</span><span>CONNECTION SECURE</span></footer></main>`;
    if (scroll) this.el.querySelector('.panel').scrollTop = scroll;
    this.bind(!!scroll);
  }
  missions() {
    this.screen = 'missions';
    const g = this.game;
    this.frame(
      'CHOOSE YOUR INTERRUPTION.',
      'OPERATIONS / ' + g.save.credits + ' ALLOY',
      `<div class="selection-heading">ENEMY FACTIONS <span>Mix any combination. Keep at least one enabled. Each faction brings its own bosses.</span></div><div class="faction-grid">${Object.entries(
        FACTIONS,
      )
        .map(
          ([id, f]) =>
            `<button data-faction="${id}" role="switch" aria-checked="${g.save.factions[id]}" aria-label="${f.name}" aria-disabled="${g.save.factions[id] && Object.values(g.save.factions).filter(Boolean).length === 1}" class="faction-card ${g.save.factions[id] ? 'selected' : ''}" style="--faction-color:${f.color}"><span class="faction-toggle">${g.save.factions[id] ? 'ON' : 'OFF'}</span><strong>${f.name}</strong><small>${f.description}</small><span class="faction-bosses">${f.bosses.map((b) => b.toUpperCase()).join(' / ')}</span></button>`,
        )
        .join(
          '',
        )}</div><div class="map-grid">${MAPS.map((m, n) => `<button data-map="${m.id}" class="map-card ${g.save.map === m.id ? 'selected' : ''}" style="--map-accent:${m.accent}"><div class="map-scene ${m.id}"><i></i><b></b><span>0${n + 1} / ${m.region}</span></div><div class="map-copy"><small>${m.tag}</small><h3>${m.name}</h3><p>${m.description}</p><small>BEST / ${(g.save.records?.[m.id + '-' + g.save.difficulty]?.best || 0).toLocaleString()} · WINS / ${g.save.records?.[m.id + '-' + g.save.difficulty]?.wins || 0}</small><span>${g.save.map === m.id ? '● SELECTED' : 'SELECT OPERATION →'}</span></div></button>`).join('')}</div><div class="selection-heading">THREAT LEVEL <span>Composition, aggression, elites and recovery change. Enemy health stays the same.</span></div><div class="difficulty-grid">${Object.entries(
        DIFFICULTIES,
      )
        .map(
          ([id, d]) =>
            `<button data-difficulty="${id}" class="${g.save.difficulty === id ? 'selected' : ''}"><b>${d.name}</b><small>${d.description}</small><span>${d.reward}× ALLOY</span></button>`,
        )
        .join(
          '',
        )}</div><div class="deployment-bar"><div><small>FIELD KIT</small><span>${g.save.combatClass === 'melee' ? MELEE_KITS[g.save.meleeKit].name + ' / MELEE CLASS' : g.save.loadout.map((id) => WEAPONS.find((w) => w.id === id).name.split(' / ')[0]).join(' / ')}</span></div><button data-action="loadout">EDIT LOADOUT</button><button class="primary" data-action="launch">DEPLOY TO ${MAPS.find((m) => m.id === g.save.map).name} ${arrow}</button></div>`,
    );
    this.el.querySelectorAll('[data-map]').forEach(
      (b) =>
        (b.onclick = () => {
          g.save.map = b.dataset.map;
          g.selectMap(g.save.map);
          g.persist();
          g.audio.ui();
          this.missions();
        }),
    );
    this.el.querySelectorAll('[data-faction]').forEach((b) => {
      b.onclick = () => {
        const id = b.dataset.faction;
        if (g.save.factions[id] && Object.values(g.save.factions).filter(Boolean).length === 1)
          return;
        g.save.factions[id] = !g.save.factions[id];
        g.persist();
        g.audio.ui();
        this.missions();
        this.el.querySelector(`[data-faction="${id}"]`)?.focus({ preventScroll: true });
      };
    });
    this.el.querySelectorAll('[data-difficulty]').forEach(
      (b) =>
        (b.onclick = () => {
          g.save.difficulty = b.dataset.difficulty;
          g.persist();
          g.audio.ui();
          this.missions();
        }),
    );
  }
  armory(edit = false) {
    this.screen = edit ? 'loadout' : 'armory';
    this.loadoutSlot ??= 0;
    this.filter ??= 'all';
    const g = this.game,
      w = WEAPONS[this.armoryIndex],
      owned = g.save.unlocked.includes(w.id),
      slot = LOADOUT_SLOTS[this.loadoutSlot],
      equipped = WEAPONS.find((x) => x.id === g.save.loadout[this.loadoutSlot]);
    const weapons = WEAPONS.filter((x) =>
      edit ? x.category === slot.category : this.filter === 'all' || x.category === this.filter,
    );
    const stat = (label, value, ratio, difference = '') =>
      `<div><span>${label}</span><b>${value} <em>${difference}</em></b><div class="stat-track"><i style="width:${Math.min(1, ratio) * 100}%"></i></div></div>`;
    const delta = (key) =>
      edit && w.id !== equipped.id
        ? (w[key] - equipped[key] > 0 ? '+' : '') + Math.round((w[key] - equipped[key]) * 100) / 100
        : '';
    this.frame(
      edit ? 'BUILD YOUR FRAME.' : 'TOOLS OF INTERRUPTION.',
      (edit ? 'LOADOUT' : 'FIELD ARMORY') + ' / ' + g.save.credits + ' ALLOY',
      `
    ${
      edit
        ? `<div class="selection-heading">COMBAT CLASS <span>Choose your main weapons before deploying.</span></div><div class="armory-tabs"><button data-combat-class="ranged" class="${g.save.combatClass === 'ranged' ? 'selected' : ''}">RANGED / FIREARMS</button><button data-combat-class="melee" class="${g.save.combatClass === 'melee' ? 'selected' : ''}">MELEE / CLOSE COMBAT</button></div><div class="faction-grid">${Object.entries(
            MELEE_KITS,
          )
            .map(
              ([id, k]) =>
                `<button data-melee-kit="${id}" class="faction-card ${g.save.combatClass === 'melee' && g.save.meleeKit === id ? 'selected' : ''}" style="--faction-color:#a9dedc"><strong>${k.name}</strong><small>${k.description}</small><span>${k.damage} DAMAGE / ${k.range}m REACH · LMB ATTACK / RMB GUARD</span></button>`,
            )
            .join(
              '',
            )}</div><div class="selection-heading">RANGED KIT <span>Used when the ranged class is selected.</span></div><div class="loadout-slots">${LOADOUT_SLOTS.map((slot, n) => `<button data-slot="${n}" class="${n === this.loadoutSlot ? 'selected' : ''}"><small>${n + 1} / ${slot.name}</small><strong>${WEAPONS.find((w) => w.id === g.save.loadout[n]).name}</strong></button>`).join('')}</div>`
        : `<div class="armory-tabs">${['all', 'primary', 'heavy', 'secondary'].map((c) => `<button data-filter="${c}" class="${this.filter === c ? 'selected' : ''}">${c.toUpperCase()}</button>`).join('')}</div>`
    }
    <div class="armory"><div class="weapon-list expanded">${weapons.map((x) => `<button data-weapon="${WEAPONS.indexOf(x)}" class="${w.id === x.id ? 'selected' : ''}"><small>${x.class.toUpperCase()}</small><strong>${x.name}</strong><span>${g.save.unlocked.includes(x.id) ? (g.save.loadout.includes(x.id) ? '● EQUIPPED' : x.tag) : 'LOCKED / ' + x.cost + ' ALLOY'}</span></button>`).join('')}</div><article class="weapon-detail"><div class="weapon-drawing weapon-${w.id} family-${w.category} ${w.energy ? 'energy' : ''}"><div class="barrel"></div><div class="receiver"></div><div class="stock"></div><div class="magazine"></div><div class="sight"></div><span>HF / ${w.id.toUpperCase()}</span></div><div class="eyebrow">${w.tag}</div><h3>${w.name}</h3><p>${w.role}</p><div class="weapon-stats">${stat('DAMAGE', w.damage + (w.pellets > 1 ? ' × ' + w.pellets : ''), w.damage / 190, delta('damage'))}${stat('RATE / MIN', Math.round(w.rate * 60), w.rate / 15)}${stat('PENETRATION', Math.round(w.penetration * 100) + '%', w.penetration)}${stat(w.energy ? 'CAPACITOR' : 'MAGAZINE', w.mag, w.mag / 100, delta('mag'))}${stat(w.energy ? 'VENT TIME' : 'RELOAD', w.reload + 's', 1 - w.reload / 4, delta('reload'))}${stat('RANGE', w.range + 'm', w.range / 150, delta('range'))}</div><div class="weapon-action">${!owned ? `<button id="unlock-weapon" class="primary" ${g.save.credits < w.cost ? 'disabled' : ''}>UNLOCK / ${w.cost} ALLOY ${arrow}</button>` : edit ? `<button id="equip-weapon" class="primary" ${w.category !== slot.category ? 'disabled' : ''}>${w.id === equipped.id ? 'EQUIPPED IN ' + slot.name : 'EQUIP TO ' + slot.name} ${arrow}</button>` : '<p class="note">OWNED / Configure your five-slot kit in Loadout.</p>'}</div><div class="compare-note">${edit ? 'COMPARING WITH ' + equipped.name + ' · differences shown beside stats' : 'Unlock sidegrades with alloy earned from each operation.'}</div></article></div>
    ${
      edit
        ? `<div class="kit-extras"><div><h3>MELEE / V</h3>${Object.entries(MELEE)
            .map(
              ([id, m]) =>
                `<button data-melee="${id}" class="${g.save.melee === id ? 'selected' : ''}"><b>${m.name}</b><small>${m.damage} DAMAGE / ${m.cooldown}s RECOVERY</small></button>`,
            )
            .join('')}</div><div><h3>EQUIPMENT / Q</h3>${Object.entries(EQUIPMENT)
            .map(
              ([id, e]) =>
                `<button data-equipment="${id}" class="${g.save.equipment === id ? 'selected' : ''}"><b>${e.name}</b><small>${e.description}</small></button>`,
            )
            .join(
              '',
            )}</div></div><div class="deployment-bar"><span>Loadout saves automatically. Duplicate primaries swap slots.</span><button class="primary" data-action="deploy">SELECT OPERATION ${arrow}</button></div>`
        : ''
    }`,
    );
    this.el.querySelectorAll('[data-weapon]').forEach(
      (b) =>
        (b.onclick = () => {
          this.armoryIndex = +b.dataset.weapon;
          g.audio.ui();
          this.armory(edit);
        }),
    );
    this.el.querySelectorAll('[data-combat-class], [data-melee-kit]').forEach((b) => {
      b.onclick = () => {
        if (b.dataset.meleeKit) {
          g.save.meleeKit = b.dataset.meleeKit;
          g.save.combatClass = 'melee';
        } else g.save.combatClass = b.dataset.combatClass;
        g.persist();
        this.armory(true);
      };
    });
    this.el.querySelectorAll('[data-slot]').forEach(
      (b) =>
        (b.onclick = () => {
          this.loadoutSlot = +b.dataset.slot;
          this.armoryIndex = WEAPONS.findIndex((w) => w.id === g.save.loadout[this.loadoutSlot]);
          this.armory(true);
        }),
    );
    this.el.querySelectorAll('[data-filter]').forEach(
      (b) =>
        (b.onclick = () => {
          this.filter = b.dataset.filter;
          this.armory(false);
        }),
    );
    this.el.querySelector('#unlock-weapon')?.addEventListener('click', () => {
      if (g.unlock(w.id)) {
        g.audio.alert();
        this.armory(edit);
      }
    });
    this.el.querySelector('#equip-weapon')?.addEventListener('click', () => {
      g.equip(w.id, this.loadoutSlot);
      this.armory(true);
    });
    for (const field of ['melee', 'equipment'])
      this.el.querySelectorAll('[data-' + field + ']').forEach(
        (b) =>
          (b.onclick = () => {
            g.save[field] = b.dataset[field];
            g.persist();
            this.armory(true);
          }),
      );
  }
  upgrades() {
    this.screen = 'upgrades';
    const g = this.game;
    this.frame(
      'REBUILD. RELOAD. RETURN.',
      'FIELD TERMINAL / ' + g.scrap + ' SCRAP',
      `<p class="muted">Run upgrades reset on deployment. Alloy unlocks remain permanent. The preparation timer pauses while this terminal is open.</p><div class="upgrade-grid">${UPGRADES.map(
        (u) => {
          const rank = g.upgrades[u.id] || 0;
          return `<article><div class="eyebrow">RANK ${rank} / ${u.max}</div><h3>${u.name}</h3><p>${u.description}</p><button data-upgrade="${u.id}" ${rank >= u.max || g.scrap < u.cost ? 'disabled' : ''}>${rank >= u.max ? 'MAX RANK' : 'INSTALL / ' + u.cost + ' SCRAP'}</button></article>`;
        },
      ).join(
        '',
      )}</div><div class="deployment-bar"><span>Scrap comes from destroyed machines. Each upgrade has a two-rank cap.</span><button class="primary" data-action="resume">RETURN TO FIELD ${arrow}</button></div>`,
    );
    this.el
      .querySelectorAll('[data-upgrade]')
      .forEach((b) => (b.onclick = () => g.buyUpgrade(b.dataset.upgrade)));
  }
  controls() {
    this.screen = 'controls';
    this.frame(
      'KNOW YOUR MACHINE.',
      'OPERATOR MANUAL / READ BEFORE INSERTION',
      `<div class="manual"><div><h3>01 / THE FIELD KIT</h3><div class="controls">${CONTROLS.map(([a, b]) => `<div><kbd>${a}</kbd><span>${b}</span></div>`).join('')}</div></div><div class="tactics"><h3>02 / SURVIVE THE CONVERGENCE</h3><p><b>Choose your enemies.</b> The three switches in Select Operation let you mix the Choir, Brood and Veil. At least one must stay enabled. Bosses and reinforcements follow your selection.</p><p><b>The Brood.</b> Nippers swarm, Carapaces telegraph a straight rush, Bilecasters spit acid fans, Broodkeepers hatch reinforcements, and Spore Bursters explode. Break brood sacs to stop hatchlings. The Broodmother hatches guards and spits wide volleys; Dreadmaw uses a large ground rupture. Leave the marked ring, then hit their exposed vital cores.</p><p><b>The Veil.</b> Thralls close in, Prism Guards carry breakable shields, Far Seers charge precision shots, Life Weavers heal their own faction, and Phase Blades cloak at range. The Hierophant launches radial energy bolts; Prismarch sweeps a beam that solid cover blocks. Break emitters to expose their cores early.</p><p><b>Melee class.</b> Choose a melee kit in Configure Loadout. Left click attacks; right click guards. The Arc Saber sweeps multiple targets and can perfectly parry in the first moment of guarding. The Ion Spear trades a narrow thrust for longer reach. Sword &amp; Shield absorbs most frontal damage. Attacks and blocks spend stamina; release guard to recover faster. Guard cannot stop attacks from behind or protect you from environmental hazards.</p><p><b>Choose your kit before deploying.</b> Five weapon slots, a blade or hammer, and equipment on Q. Alloy from completed matches unlocks sidegrades; your first 300 alloy are already issued.</p><p><b>Break the formation.</b> Bulwarks shield advancing units; aim above the shield or flank them. Menders repair allies until their green antenna is destroyed. Lancers telegraph long-range shots. Orange Volatiles explode at close range. Destroy gun mounts to disarm ranged enemies. Fabricators release drones until their bay is broken; Cantors accelerate nearby allies. Shades cloak while repositioning, but remain hittable.</p><p><b>Aim for the amber sensors.</b> Exposed sensors bypass armor and multiply damage. Plating takes reduced damage until it breaks; the Needle penetrates it.</p><p><b>Read the silhouettes.</b> Skitters rush you. Wardens strafe and fire amber bolts. Bastions telegraph explosive cannon shots with a targeting line. Move when they charge.</p><p><b>Keep your momentum.</b> Sprint, then press C or Ctrl to slide. Space launches from a slide. While airborne next to a wall, press Space to kick away; use different walls, up to two kicks before landing. Hold W and press Space near a reachable ledge to mantle. Low ceilings block climbing. Jump buffering and a short edge grace window make timing forgiving.</p><p><b>Work the lanes.</b> Use the furnace, cooling tanks and loading crates to break line of sight. Shoot legs to slow machines. Rockets damage nearby targets—and you.</p><p><b>Catch your breath.</b> Between waves, all ammunition is restored and health and armor recover partially. Press E to skip the preparation timer.</p><div class="note">Destroying machines restores a little armor. The Relay sidearm regenerates reserve ammo. Survive eight budgeted waves and destroy both bosses. Shoot its weapon mounts to stop missile fire; leave the orange shockwave ring, then attack the glowing core during its recovery. The Architect sweeps a beam that solid cover blocks. Use B between waves to buy capped upgrades with run scrap.</div></div></div>`,
    );
  }
  settings() {
    this.screen = 'settings';
    const s = this.game.settings;
    this.frame(
      'CALIBRATE YOUR FRAME.',
      'SYSTEM SETTINGS / SAVED LOCALLY',
      `<div class="settings">${[
        ['volume', 'MASTER VOLUME', 0, 1, 0.05],
        ['music', 'MUSIC', 0, 1, 0.05],
        ['effects', 'EFFECTS', 0, 1, 0.05],
        ['sensitivity', 'MOUSE SENSITIVITY', 0.2, 3, 0.1],
        ['fov', 'FIELD OF VIEW', 65, 105, 1],
        ['shake', 'SCREEN SHAKE', 0, 1, 0.1],
        ['brightness', 'EXPOSURE', 0.75, 1.6, 0.05],
      ]
        .map(
          ([key, label, min, max, step]) =>
            `<label><span>${label}</span><input type="range" data-setting="${key}" min="${min}" max="${max}" step="${step}" value="${s[key]}"><output>${['volume', 'music', 'effects', 'shake'].includes(key) ? Math.round(s[key] * 100) + '%' : s[key]}</output></label>`,
        )
        .join(
          '',
        )}<label><span>GRAPHICS QUALITY</span><select data-setting="quality"><option value="low" ${s.quality === 'low' ? 'selected' : ''}>LOW / NO SHADOWS</option><option value="medium" ${s.quality === 'medium' ? 'selected' : ''}>MEDIUM / BALANCED</option><option value="high" ${s.quality === 'high' ? 'selected' : ''}>HIGH / FULL LIGHTING</option></select></label><label><span>SHADOWS</span><input type="checkbox" data-toggle="shadows" ${s.shadows !== false ? 'checked' : ''}></label><label><span>PARTICLE EFFECTS</span><input type="checkbox" data-toggle="particles" ${s.particles !== false ? 'checked' : ''}></label><h3>ACCESSIBILITY / FIELD ASSIST</h3>${[
        ['invertY', 'INVERT VERTICAL LOOK'],
        ['toggleAim', 'TOGGLE AIM'],
        ['toggleCrouch', 'TOGGLE CROUCH'],
        ['reducedMotion', 'REDUCED MOTION / FLASH'],
        ['highContrast', 'HIGH CONTRAST HUD'],
        ['hints', 'CONTEXTUAL FIELD TIPS'],
        ['performance', 'PERFORMANCE DISPLAY'],
      ]
        .map(
          ([key, label]) =>
            `<label><span>${label}</span><input type="checkbox" data-toggle="${key}" ${s[key] ? 'checked' : ''}></label>`,
        )
        .join(
          '',
        )}<p class="note">Reduced motion removes camera bob, random shake, sprint FOV changes, and muzzle flashes. Weapon recoil remains part of combat. Low quality reduces resolution and disables shadows. Settings, alloy, unlocks and operation records are stored on this browser.</p><button class="subtle" data-action="reset">RESET LOCAL RECORD & SETTINGS</button><div id="save-message" role="status"></div></div>`,
    );
    this.el.querySelectorAll('[data-toggle]').forEach(
      (el) =>
        (el.onchange = () => {
          s[el.dataset.toggle] = el.checked;
          this.game.applySettings();
        }),
    );
    this.el.querySelectorAll('[data-setting]').forEach(
      (el) =>
        (el.oninput = () => {
          const key = el.dataset.setting;
          s[key] = key === 'quality' ? el.value : Number(el.value);
          const output = el.parentElement.querySelector('output');
          if (output)
            output.textContent = ['volume', 'music', 'effects', 'shake'].includes(key)
              ? Math.round(s[key] * 100) + '%'
              : s[key];
          this.game.applySettings();
        }),
    );
  }
  pause() {
    this.screen = 'pause';
    this.frame(
      'SIGNAL SUSPENDED.',
      'OPERATION PAUSED',
      `<p class="muted">Take a breath. ${this.game.map.name} can wait.</p><div class="pause-actions"><button class="primary" data-action="resume">RESUME OPERATION ${arrow}</button><button data-action="settings">SYSTEM SETTINGS</button><button data-action="restart">RESTART OPERATION</button><button data-action="menu">RETURN TO COMMAND</button></div>`,
    );
  }
  results(won) {
    this.screen = 'results';
    const g = this.game,
      s = g.stats;
    const favorite = g.meleeClass.active
        ? g.meleeClass.kit.name
        : WEAPONS[s.usage.indexOf(Math.max(...s.usage))].name,
      active = Object.keys(FACTIONS).filter((id) => g.save.factions[id]),
      enemyName = active.length === 1 ? FACTIONS[active[0]].name : 'THE CONVERGENCE',
      bossTotal = active.length === 1 ? 2 : active.length;
    this.frame(
      won ? 'THE SIGNAL IS SILENT.' : 'YOUR SIGNAL WENT DARK.',
      won
        ? 'OPERATION COMPLETE / ' + g.map.name + ' SECURED'
        : 'OPERATOR LOST / ' + enemyName + ' REMAINS',
      `<p class="result-sub">${won ? 'The enemy leaders have fallen. Another sector reclaimed.' : 'Every attempt teaches the frame something. Rebuild. Return.'}</p><div class="result-score"><small>OPERATION SCORE</small><strong>${s.score.toLocaleString()}</strong><span>PERSONAL BEST / ${(g.save.best || 0).toLocaleString()}</span></div><div class="results-grid">${[
        ['WAVES CLEARED', `${g.waves.completed} / ${WAVE_COUNT}`],
        ['MACHINES DESTROYED', s.kills],
        ['ACCURACY', `${s.shots ? Math.round((s.hits / s.shots) * 100) : 0}%`],
        ['SENSOR HITS', s.weak],
        ['DAMAGE DEALT', Math.round(s.damage).toLocaleString()],
        [
          'TIME IN FIELD',
          Math.floor(g.elapsed / 60) + ':' + String(Math.floor(g.elapsed % 60)).padStart(2, '0'),
        ],
      ]
        .map(([a, b]) => `<div><small>${a}</small><strong>${b}</strong></div>`)
        .join(
          '',
        )}</div><div class="reward-strip"><strong>+${g.lastReward || 0} ALLOY</strong><span>BALANCE / ${g.save.credits} ALLOY</span><span>${s.components || 0} COMPONENTS / ${s.elites || 0} ELITES</span></div><div class="result-actions"><button class="primary" data-action="restart">DEPLOY AGAIN ${arrow}</button><button data-action="menu">RETURN TO COMMAND</button><button data-action="armory">SPEND ALLOY</button></div><p class="muted">MOST USED / ${favorite}</p><div class="run-details"><div><small>BOSSES DESTROYED</small><b>${s.bosses || 0} / ${bossTotal}</b></div><div><small>DAMAGE RECEIVED</small><b>${Math.round(s.damageTaken || 0)}</b></div><div><small>SCRAP EARNED / SPENT</small><b>${s.scrapEarned || 0} / ${(s.scrapEarned || 0) - (g.scrap || 0)}</b></div><div><small>WAVE TIMES</small><b>${(s.waveTimes || []).map((t) => Math.round(t) + 's').join(' / ') || '—'}</b></div></div>`,
    );
  }
  addKill(name, scrap) {
    this.feed ??= [];
    this.feed.unshift({ name, scrap, until: this.game.elapsed + 3 });
    this.feed.length = Math.min(3, this.feed.length);
  }
  hud() {
    this.screen = 'hud';
    this.hudClock = 0;
    this.el.innerHTML = `<div id="hud"><div id="field-tip"></div><div id="movement-state"></div><div id="target-readout"></div><div id="kill-feed"></div><div id="performance-readout"></div><div class="hud-top"><div class="location">${icon}<span>${this.game.map.name}<small>${DIFFICULTIES[this.game.save.difficulty].name} / SEVER THE SIGNAL</small></span></div><div class="wave"><small id="wave-label"></small><b id="wave-number"></b><span id="enemy-count"></span></div><div class="score"><small>SALVAGE SCORE</small><b id="score"></b></div></div><div id="boss-hud"><div><b id="boss-name">THE CONDUCTOR</b><span id="boss-phase"></span></div><i><b id="boss-health"></b></i><small id="boss-components"></small></div><div class="announcement" id="announcement" role="status"></div><div class="crosshair" id="crosshair"><i></i><i></i><i></i><i></i><b></b></div><div id="hit-marker"></div><div id="damage-indicator"></div><div id="hurt"></div><div class="hud-bottom"><div class="vitals"><small>OPERATOR / 07</small><div><span class="health-icon">✚</span><strong id="health"></strong><span class="health-max">/ 100</span></div><div class="health-track"><i id="health-bar"></i></div><div class="armor-line"><span>ARMOR</span><i><b id="armor-bar"></b></i><strong id="armor"></strong></div></div><div class="hud-center"><div id="equipment-hud"></div><div id="prompt"></div><div id="reload-state"></div><div id="action-track"><i></i></div><span class="hud-help">WASD MOVE <i>•</i> R RELOAD <i>•</i> V MELEE <i>•</i> ESC PAUSE</span></div><div class="ammo"><small id="weapon-tag"></small><h3 id="weapon-name"></h3><div><strong id="mag"></strong><span>/ <b id="reserve"></b></span></div><div id="weapon-slots"></div></div></div></div>`;
    this.nodes = {};
    this.el.querySelectorAll('[id]').forEach((n) => (this.nodes[n.id] = n));
  }
  hit(kind) {
    this.hitTime = 0.18;
    this.hitKind = kind;
  }
  update(dt) {
    if (this.screen !== 'hud') return;
    this.hudClock = (this.hudClock || 0) - dt;
    this.hitTime = Math.max(0, this.hitTime - dt);
    if (this.hudClock > 0) return;
    this.hudClock = 1 / 30;
    const g = this.game,
      n = this.nodes,
      w = g.weapons,
      p = g.player;
    const boss = g.enemies.list.find((e) => e.d.boss);
    n['boss-hud'].style.display = boss ? 'block' : 'none';
    if (boss) {
      n['boss-name'].textContent = boss.d.name;
      n['boss-health'].style.width = Math.max(0, (boss.hp / boss.d.hp) * 100) + '%';
      n['boss-phase'].textContent =
        boss.phaseLabel ||
        (boss.coreOpen
          ? 'CORE EXPOSED / FIRE'
          : boss.cycle < 2
            ? boss.type === 'architect'
              ? 'BEAM LOCK / USE COVER'
              : 'MISSILE LOCK / MOVE'
            : boss.cycle >= 5.3 && boss.cycle < 7
              ? boss.type === 'architect'
                ? 'VOLLEY / FIND COVER'
                : 'SHOCKWAVE / LEAVE THE RING'
              : 'ARMORED / TARGET WEAPON MOUNTS');
      n['boss-components'].textContent =
        (boss.d.faction === 'brood' ? 'LEFT ORGAN ' : 'LEFT EMITTER ') +
        (boss.components.weaponLeft > 0 ? 'ACTIVE' : 'DESTROYED') +
        (boss.d.faction === 'brood' ? ' / RIGHT ORGAN ' : ' / RIGHT EMITTER ') +
        (boss.components.weaponRight > 0 ? 'ACTIVE' : 'DESTROYED');
    }
    n['movement-state'].textContent = p.parkour?.label || '';
    n['field-tip'].textContent = fieldHint(g);
    n['field-tip'].hidden = !n['field-tip'].textContent;
    const info = this.targetInfo;
    n['target-readout'].textContent =
      info && info.until > g.elapsed
        ? info.name +
          ' / ' +
          (info.hp <= 0
            ? 'NEUTRALIZED'
            : info.part + ' · ' + Math.ceil((info.hp / info.max) * 100) + '%')
        : '';
    this.feed = (this.feed || []).filter((item) => item.until > g.elapsed);
    const feedText = this.feed.map((item) => item.name + '  +' + item.scrap + ' SCRAP').join('\n');
    if (n['kill-feed'].textContent !== feedText) n['kill-feed'].textContent = feedText;
    n['performance-readout'].hidden = !g.settings.performance;
    if (g.settings.performance && g.elapsed >= (this.nextPerf || 0)) {
      this.nextPerf = g.elapsed + 0.5;
      const r = g.world.renderer.info;
      n['performance-readout'].textContent =
        Math.round(1000 / (g.frameMs || 16.7)) +
        ' FPS / ' +
        Math.round(g.frameMs || 16.7) +
        ' ms · ' +
        r.render.calls +
        ' draws · ' +
        Math.round(r.render.triangles / 1000) +
        'k tris';
    }
    const progress =
      w.reloadTime > 0
        ? 1 - w.reloadTime / (w.current.reload * (1 - 0.18 * (g.upgrades.loader || 0)))
        : w.chargeTime > 0
          ? w.chargeTime / w.current.charge
          : w.current.energy
            ? w.ammo.heat / 100
            : 0;
    n['action-track'].style.visibility = progress > 0 ? 'visible' : 'hidden';
    n['action-track'].firstElementChild.style.width =
      Math.max(0, Math.min(100, progress * 100)) + '%';
    n['equipment-hud'].textContent =
      'Q / ' + EQUIPMENT[g.save.equipment].name + ' / ' + g.equipmentCharges;

    n['health'].textContent = Math.ceil(p.hp);
    n['armor'].textContent = Math.ceil(p.armor);
    n['health-bar'].style.width = p.hp + '%';
    n['armor-bar'].style.width = p.armor * 2 + '%';
    n['health-bar'].style.background = p.hp < 30 ? '#ff785b' : '#d7e4d4';
    n['wave-label'].textContent =
      g.waves.breakTime > 0 ? 'PREPARE FOR CONTACT' : g.waves.encounter?.name || 'INCOMING ASSAULT';
    n['wave-number'].textContent =
      `WAVE ${String(Math.max(1, g.waves.index + 1)).padStart(2, '0')} / ${WAVE_COUNT}`;
    n['enemy-count'].textContent =
      g.waves.breakTime > 0
        ? `NEXT ASSAULT IN ${Math.ceil(g.waves.breakTime)}s`
        : `${g.waves.remaining} HOSTILES REMAINING`;
    n['score'].textContent = g.stats.score.toLocaleString();
    n['weapon-name'].textContent = w.current.name;
    n['weapon-tag'].textContent = w.current.tag;
    n['mag'].textContent = String(w.ammo.mag).padStart(2, '0');
    n['mag'].style.color = w.ammo.mag <= Math.max(1, w.current.mag * 0.2) ? '#f7a26e' : '#edf0de';
    n['reserve'].textContent = w.current.energy ? 'CELL' : w.ammo.reserve;
    if (n['weapon-slots'].dataset.selected !== String(w.index)) {
      n['weapon-slots'].dataset.selected = String(w.index);
      n['weapon-slots'].innerHTML = w.equipped
        .map(
          (id, j) =>
            `<span title="${WEAPONS[id].name}" class="${id === w.index ? 'active' : ''}">${j + 1}</span>`,
        )
        .join('');
    }
    n['reload-state'].textContent =
      w.reloadTime > 0
        ? `RELOADING ${Math.ceil(w.reloadTime * 10) / 10}s`
        : w.ammo.mag === 0
          ? 'EMPTY / PRESS R TO RELOAD'
          : '';
    if (w.current.energy)
      n['reload-state'].textContent =
        w.reloadTime > 0
          ? 'VENTING'
          : w.ammo.overheated
            ? 'OVERHEATED / COOLING'
            : Math.round(w.ammo.heat) + '% HEAT';
    if (w.chargeTime > 0)
      n['reload-state'].textContent =
        'CHARGING / ' + Math.round((w.chargeTime / w.current.charge) * 100) + '%';
    n['prompt'].innerHTML =
      g.waves.breakTime > 0
        ? `<kbd>E</kbd> ${g.waves.index < 0 ? 'BEGIN ASSAULT' : 'NEXT WAVE / B: UPGRADES / ' + g.scrap + ' SCRAP'}`
        : p.position.distanceTo(g.map.station) < 5
          ? g.map.hazards?.length
            ? g.quenchTime > 0
              ? 'GRID SAFE / ' + Math.ceil(g.quenchTime) + 's'
              : g.quenchCooldown > 0
                ? 'QUENCH RECHARGING / ' + Math.ceil(g.quenchCooldown) + 's'
                : 'E / QUENCH HAZARD GRID'
            : 'RESUPPLY / AVAILABLE BETWEEN WAVES'
          : '';
    n['announcement'].textContent = g.noticeTime > 0 ? g.noticeText : '';
    n['announcement'].classList.toggle('visible', g.noticeTime > 0);
    n['hit-marker'].className = this.hitTime > 0 ? `show ${this.hitKind}` : '';
    n['crosshair'].style.setProperty('--spread', (g.input.aim ? 4 : 8) + w.recoil * 100 + 'px');
    n['crosshair'].style.opacity = g.player.sprint ? 0.25 : 1;
    n['hurt'].style.opacity = g.settings.reducedMotion
      ? p.hp < 25
        ? 0.12
        : 0
      : p.hurt * 0.9 + (p.hp < 25 ? 0.18 : 0);
    n['damage-indicator'].style.opacity = p.hurt > 0 ? 1 : 0;
    if (g.meleeClass.active) {
      const m = g.meleeClass;
      n['weapon-name'].textContent = m.kit.name;
      n['weapon-tag'].textContent = 'MELEE / STAMINA';
      n['mag'].textContent = Math.ceil(m.stamina);
      n['reserve'].textContent = '100';
      n['weapon-slots'].textContent = 'LMB ATTACK · RMB GUARD';
      n['reload-state'].textContent =
        m.exhausted > 0
          ? 'GUARD BROKEN'
          : m.guard
            ? g.save.meleeKit === 'energy' && m.guardTime < 0.22
              ? 'PARRY WINDOW'
              : 'GUARDING'
            : m.stamina < m.kit.cost
              ? 'RECOVERING STAMINA'
              : 'READY';
      n['action-track'].style.opacity = 1;
      n['action-track'].style.visibility = 'visible';
      this.el.querySelector('.hud-help').textContent =
        'WASD MOVE · LMB ATTACK · RMB GUARD · Q EQUIPMENT';
      n['action-track'].querySelector('i').style.width = m.stamina + '%';
    }
    n['damage-indicator'].style.transform = `translate(-50%,-50%) rotate(${this.damageAngle}rad)`;
  }
  bind(restoring = false) {
    const previous = restoring && this.lastControl && this.el.querySelector(this.lastControl);
    (previous || this.el.querySelector('button.primary, button'))?.focus({ preventScroll: true });
    this.el.querySelectorAll('[data-action]').forEach(
      (b) =>
        (b.onclick = () => {
          this.game.audio.start();
          this.game.audio.ui();
          const a = b.dataset.action;
          switch (a) {
            case 'deploy':
              this.missions();
              break;
            case 'loadout':
              this.armoryIndex = WEAPONS.findIndex(
                (w) => w.id === this.game.save.loadout[this.loadoutSlot || 0],
              );
              this.armory(true);
              break;
            case 'launch':
            case 'restart':
              this.game.start();
              break;
            case 'resume':
              this.game.resume();
              break;
            case 'armory':
              if (this.game.state === 'results') this.game.toMenu();
              this.armory();
              break;
            case 'controls':
              this.controls();
              break;
            case 'settings':
              this.settings();
              break;
            case 'menu':
              this.game.toMenu();
              break;
            case 'back':
              this.game.state === 'upgrading'
                ? this.game.resume()
                : this.game.state === 'paused'
                  ? this.pause()
                  : this.game.toMenu();
              break;
            case 'reset':
              this.confirmReset();
              break;
          }
        }),
    );
  }
  confirmReset() {
    const target = this.el.querySelector('#save-message');
    target.innerHTML =
      '<p>Reset your alloy, unlocks, loadout, best score and settings? This cannot be undone.</p><button id="confirm-reset">YES, RESET</button> <button id="cancel-reset">CANCEL</button>';
    target.querySelector('#cancel-reset').onclick = () => (target.innerHTML = '');
    target.querySelector('#confirm-reset').onclick = () => {
      this.game.resetSave();
      this.settings();
    };
  }
  error(message) {
    this.el.querySelector('.error-toast')?.remove();
    const div = document.createElement('div');
    div.className = 'error-toast';
    div.setAttribute('role', 'alert');
    div.textContent = message;
    this.el.appendChild(div);
    setTimeout(() => div.remove(), 7000);
  }
}
