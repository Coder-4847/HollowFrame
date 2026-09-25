import './fonts.css';
import { normalizeSettings } from './polish.js';
import { buyUpgrade, modifier } from './upgrades.js';
import { updateEnvironment } from './environment.js';
import './style.css';
import { World } from './world.js';
import { loadMap } from './maps.js';
import { DIFFICULTIES, EQUIPMENT, MAPS } from './content.js';
import { normalizeProgress, purchase, equip, matchReward } from './progression.js';
import { Navigation } from './navigation.js';
import { Effects } from './vfx.js';
import { MeleeClass } from './melee-class.js';
import { Input } from './input.js';
import { AudioSystem } from './audio.js';
import { Player } from './player.js';
import { Weapons } from './weapons.js';
import { Enemies } from './enemies.js';
import { Projectiles } from './projectiles.js';
import { Waves } from './waves.js';
import { UI } from './ui.js';
import { WEAPONS } from './data.js';
import { readSave, saveData } from './core.js';

class Game {
  constructor() {
    this.canvas = document.querySelector('#world');
    this.save = normalizeProgress(readSave());
    this.settings = normalizeSettings(this.save.settings);
    this.save.best = Number.isFinite(this.save.best) ? Math.max(0, this.save.best) : 0;
    this.state = 'menu';
    this.elapsed = 0;
    this.menuTime = 0;
    this.noticeTime = 0;
    this.noticeText = '';
    this.world = new World(this.canvas, this.settings);
    this.map = loadMap(this.world, this.save.map);
    this.difficulty = DIFFICULTIES[this.save.difficulty];
    this.fx = new Effects(this.world);
    this.input = new Input(this.canvas, () => this.settings);
    this.audio = new AudioSystem();
    this.audio.volume = this.settings.volume;
    this.audio.musicVolume = this.settings.music;
    this.audio.effectsVolume = this.settings.effects;
    this.player = new Player(this);
    this.projectiles = new Projectiles(this);
    this.enemies = new Enemies(this);
    this.weapons = new Weapons(this);
    this.meleeClass = new MeleeClass(this);
    this.waves = new Waves(this);
    this.ui = new UI(this);
    this.weapons.root.visible = false;
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== this.canvas && this.state === 'playing') this.pause();
    });
    document.addEventListener('pointerlockerror', () => {
      if (this.state === 'playing') this.pause();
      this.ui.error('Mouse capture was blocked. Select Resume and allow pointer lock to play.');
    });
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Escape') return;
      if (this.state === 'playing') this.pause();
      else if (this.ui.screen !== 'pause' && !e.repeat)
        this.ui.el.querySelector('button.back')?.click();
    });
    window.addEventListener('blur', () => {
      if (this.state === 'playing') this.pause();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      if (this.state === 'playing') this.pause();
      this.ui.error(
        'Graphics context lost. Reload this page to restore the foundry. Your record is saved.',
      );
    });
    this.applySettings();
    this.ui.menu();
    this.last = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }
  async lock() {
    try {
      await this.canvas.requestPointerLock();
    } catch {
      if (this.state === 'playing') this.pause();
      this.ui.error('Mouse capture is required. Click Resume to try again.');
    }
  }
  start() {
    this.selectMap(this.save.map);
    this.difficulty = DIFFICULTIES[this.save.difficulty];
    this.equipmentCharges = EQUIPMENT[this.save.equipment].charges;
    this.rewardGranted = false;
    this.noticeTime = 0;
    this.noticePriority = 0;
    this.scrap = 0;
    this.upgrades = {};
    this.quenchTime = 0;
    this.quenchCooldown = 0;
    this.setBlackout(false);
    this.enemies.clear();
    this.projectiles.clear();
    this.fx.clear();
    this.input.reset();
    this.player.reset();
    this.weapons.disposeModel();
    this.weapons.reset();
    this.meleeClass.reset();
    this.waves.reset();
    this.ui.feed = [];
    this.ui.targetInfo = null;
    this.elapsed = 0;
    this.stats = {
      kills: 0,
      score: 0,
      shots: 0,
      hits: 0,
      weak: 0,
      damage: 0,
      usage: Array(WEAPONS.length).fill(0),
      waveTimes: [],
      scrapEarned: 0,
      damageTaken: 0,
      bosses: 0,
      components: 0,
      elites: 0,
    };
    this.state = 'playing';
    this.weapons.root.visible = !this.meleeClass.active;
    this.meleeClass.root.visible = this.meleeClass.active;
    this.ui.hud();
    this.notice(`${this.map.name} / SEVER THE SIGNAL`, 3);
    this.audio.start();
    this.lock();
    this.player.update(0);
  }
  resume() {
    this.state = 'playing';
    this.input.reset();
    this.ui.hud();
    this.lock();
  }
  pause() {
    this.state = 'paused';
    this.input.reset();
    document.exitPointerLock?.();
    this.ui.pause();
  }
  toMenu() {
    this.state = 'menu';
    this.setBlackout(false);
    document.exitPointerLock?.();
    this.enemies.clear();
    this.projectiles.clear();
    this.fx.clear();
    this.weapons.root.visible = false;
    this.input.reset();
    this.meleeClass.root.visible = false;
    this.ui.menu();
  }
  finish(won) {
    if (this.state !== 'playing') return;
    this.state = 'results';
    document.exitPointerLock?.();
    this.input.reset();
    this.save.best = Math.max(this.save.best || 0, this.stats.score);
    this.save.settings = this.settings;
    if (!this.rewardGranted) {
      this.lastReward = matchReward(this.stats, this.waves.completed, won, this.save.difficulty);
      this.save.credits += this.lastReward;
      this.save.runs++;
      if (won) this.save.wins++;
      this.save.records ??= {};
      const key = this.save.map + '-' + this.save.difficulty,
        record = this.save.records[key] || {};
      this.save.records[key] = {
        best: Math.max(record.best || 0, this.stats.score),
        wins: (record.wins || 0) + (won ? 1 : 0),
        runs: (record.runs || 0) + 1,
        bestTime: won
          ? Math.min(record.bestTime || Infinity, this.elapsed)
          : record.bestTime || null,
      };
      this.rewardGranted = true;
    }
    this.persist();
    this.ui.results(won);
    this.audio.alert();
  }
  persist() {
    this.save.settings = this.settings;
    this.storageAvailable = saveData(this.save);
    if (!this.storageAvailable)
      this.ui?.error('Local saving is unavailable. Progress lasts for this session only.');
  }
  selectMap(id) {
    this.fx?.clear();
    if (this.map?.id === id) return;
    this.enemies?.clear();
    this.projectiles?.clear();
    this.fx?.clear();
    this.map = loadMap(this.world, id);
    if (this.enemies) {
      this.enemies.nav = new Navigation(this.world.colliders, 0.7, 3, this.map);
      this.enemies.heavyNav = new Navigation(this.world.colliders, 1.25, 4, this.map);
      this.enemies.bossNav = new Navigation(this.world.colliders, 1.75, 6, this.map);
    }
    this.world.apply(this.settings);
  }
  unlock(id) {
    const result = purchase(this.save, id);
    if (result) this.persist();
    return result;
  }
  equip(id, slot) {
    const result = equip(this.save, id, slot);
    if (result) this.persist();
    return result;
  }
  useEquipment() {
    if (this.equipmentCharges <= 0) {
      this.notice('EQUIPMENT EMPTY / Resets next wave', 1);
      return;
    }
    if (this.save.equipment === 'repair' && this.player.hp >= 100 && this.player.armor >= 50) {
      this.notice('FRAME ALREADY RESTORED', 1);
      return;
    }
    this.equipmentCharges--;
    this.audio.ui();
    if (this.save.equipment === 'repair') {
      this.player.hp = Math.min(100, this.player.hp + 35);
      this.player.armor = Math.min(50, this.player.armor + 15);
      this.notice('FIELD PATCH / FRAME RESTORED', 1.5);
    }
    if (this.save.equipment === 'emp') {
      for (const e of this.enemies.list) {
        if (e.root.position.distanceTo(this.player.position) < 10) {
          e.stun = Math.max(e.stun, 2.5);
          e.warn = 0;
          if (e.shield > 0) this.enemies.breakComponent(e, 'shield');
          this.fx.burst(e.root.position, 0x83dce8, 20, 5);
        }
      }
      this.notice('NULL PULSE / MACHINES DISRUPTED', 1.5);
    }
    if (this.save.equipment === 'grenade') {
      const dir = this.world.camera.getWorldDirection(this.player.position.clone());
      dir.y += 0.22;
      this.projectiles.spawn(
        this.world.camera.position.clone(),
        dir.normalize(),
        20,
        120,
        true,
        5 * modifier(this.upgrades, 'payload', 0.15),
        { gravity: 13, fuse: 2.5, equipment: true },
      );
      this.notice('SHARD GRENADE', 1);
    }
  }
  setBlackout(active) {
    this.blackout = active;
    if (!this.map) return;
    this.world.scene.fog.density = active
      ? 0.032
      : this.map.fogDensity || (this.map.id === 'whiteout' ? 0.015 : 0.012);
    this.world.scene.background.set(active ? 0x10191e : this.map.sky);
    this.world.scene.fog.color.set(active ? 0x162025 : this.map.fog);
    const hemi = this.world.scene.children.find((o) => o.isHemisphereLight);
    if (hemi) hemi.intensity = active ? 0.6 : 2.3;
    this.world.sun.intensity = active ? 0.6 : 3;
  }
  openUpgrades() {
    if (this.waves.breakTime <= 0 || this.waves.index < 0) return;
    this.state = 'upgrading';
    this.input.reset();
    document.exitPointerLock?.();
    this.ui.upgrades();
  }
  buyUpgrade(id) {
    const bought = buyUpgrade(this, id);
    if (bought) {
      this.audio.ui();
      this.ui.upgrades();
    }
    return bought;
  }
  notice(text, time = 2) {
    const priority = /SHOCKWAVE|SWEEP|LIVE DISCHARGE|MISSILE|BEAM/.test(text)
      ? 2
      : /CORE|REINFORCEMENTS|DISABLED/.test(text)
        ? 1
        : 0;
    if (this.noticeTime > 0 && (this.noticePriority || 0) > priority) return;
    this.noticePriority = priority;
    this.noticeText = text;
    this.noticeTime = time;
  }
  applySettings() {
    Object.assign(this.settings, normalizeSettings(this.settings));
    document.documentElement.classList.toggle('reduced-motion', this.settings.reducedMotion);
    this.world.reducedMotion = this.settings.reducedMotion;
    document.documentElement.classList.toggle('high-contrast', this.settings.highContrast);
    this.world.apply(this.settings);
    this.audio.volume = this.settings.volume;
    this.audio.musicVolume = this.settings.music;
    this.audio.effectsVolume = this.settings.effects;
    if (this.audio.master) {
      this.audio.master.gain.value = this.settings.volume;
      this.audio.effectsBus.gain.value = this.settings.effects;
      this.audio.musicBus.gain.value = this.settings.music;
    }
    this.save.settings = this.settings;
    this.storageAvailable = saveData(this.save);
    if (!this.storageAvailable)
      this.ui.error('Local storage is unavailable. Settings apply for this session only.');
  }
  resetSave() {
    this.save = normalizeProgress({});
    this.settings = normalizeSettings();
    this.applySettings();
  }
  loop(now) {
    requestAnimationFrame(this.loop);
    const frameMs = now - this.last;
    const dt = Math.min(frameMs / 1000, 0.04);
    this.frameMs = (this.frameMs || frameMs) * 0.95 + frameMs * 0.05;
    this.last = now;
    if (document.hidden) return;
    if (this.state === 'playing') {
      this.elapsed += dt;
      this.noticeTime = Math.max(0, this.noticeTime - dt);
      this.player.update(dt);
      if (this.state !== 'playing') {
        this.input.end();
        this.world.render();
        return;
      }
      updateEnvironment(this, dt);
      if (this.state !== 'playing') {
        this.input.end();
        this.world.render();
        return;
      }
      this.world.focusShadows(this.player.position);
      this.world.scene.updateMatrixWorld(true);
      this.weapons.update(dt);
      this.enemies.update(dt);
      if (this.state !== 'playing') {
        this.input.end();
        this.world.render();
        return;
      }
      this.world.scene.updateMatrixWorld(true);
      this.projectiles.update(dt);
      if (this.state === 'playing') this.waves.update(dt);
      this.fx.update(dt);
      this.ui.update(dt);
      this.audio.update(dt, this.waves.index, this.state);
      this.input.end();
    } else if (this.state === 'menu') {
      this.menuTime += dt;
      const t = this.settings.reducedMotion ? 0 : this.menuTime * 0.035;
      this.world.camera.position.set(24 + Math.sin(t) * 4, 12, 29 + Math.cos(t) * 3);
      this.world.camera.lookAt(-3, 4, -5);
      this.world.focusShadows({ x: 0, z: 0 });
      this.world.camera.fov = this.settings.fov;
      this.world.camera.updateProjectionMatrix();
      this.fx.update(dt);
    }
    if (this.state === 'results') this.fx.update(dt);
    if (['playing', 'menu'].includes(this.state))
      for (const obj of this.world.animated) obj.rotation.z += dt * 0.15;
    if (['playing', 'menu'].includes(this.state))
      for (const obj of this.world.mapObjects || [])
        if (obj.userData.weather && !this.settings.reducedMotion) {
          obj.position.y -= dt * 0.7;
          if (obj.position.y < -2) obj.position.y = 0;
        }
    if (
      this.state === 'playing' ||
      now - (this.lastRender || 0) >= (this.state === 'menu' ? 33 : 100)
    ) {
      this.world.render();
      this.lastRender = now;
    }
  }
}
document.querySelector('#ui').innerHTML =
  '<div class="boot"><h1>HOLLOWFRAME</h1><p>ESTABLISHING FIELD CONNECTION</p><div class="bar"></div></div>';
setTimeout(() => {
  try {
    const game = new Game();
    if (import.meta.env.DEV) window.__HOLLOWFRAME__ = game;
  } catch (error) {
    console.error(error);
    document.querySelector('#ui').innerHTML =
      '<main class="boot"><h1>CONNECTION FAILED</h1><p>A WebGL-capable desktop browser is required.</p><p>Enable hardware acceleration, then reload.</p><button onclick="location.reload()">RETRY CONNECTION</button></main>';
  }
}, 40);
