import { ENEMIES } from './data.js';
import { EQUIPMENT } from './content.js';
import { overlaps } from './core.js';
import { WAVE_COUNT, buildEncounter } from './director.js';
export class Waves {
  constructor(game) {
    this.game = game;
    this.total = WAVE_COUNT;
    this.reset();
  }
  reset() {
    this.index = -1;
    this.queue = [];
    this.timer = 0;
    this.breakTime = this.game.save.runs === 0 ? 12 : 4;
    this.completed = 0;
    this.encounter = null;
    this.started = 0;
  }
  get remaining() {
    return this.queue.length + this.game.enemies.list.length;
  }
  next() {
    const g = this.game;
    if (this.index >= this.total - 1) return;
    this.index++;
    this.encounter = buildEncounter(
      this.index,
      g.save.map,
      g.save.difficulty,
      {
        health: g.player.hp,
        shots: g.stats.shots,
        hits: g.stats.hits,
      },
      Math.random,
      g.save.factions,
    );
    this.queue = [...this.encounter.roster];
    this.timer = 0.8;
    this.breakTime = 0;
    this.started = g.elapsed;
    g.setBlackout(this.encounter.kind === 'blackout');
    g.notice(this.encounter.name, 3);
    g.audio.alert();
  }
  update(dt) {
    const g = this.game;
    if (this.breakTime > 0) {
      this.breakTime -= dt;
      if (this.breakTime <= 0) this.next();
      return;
    }
    this.timer -= dt;
    if (this.queue.length && this.timer <= 0 && g.enemies.list.length < 24) {
      let choices = g.map.spawns.filter((p) => p.distanceTo(g.player.position) > 13);
      if (!choices.length) choices = g.map.spawns;
      const p = choices[Math.floor(Math.random() * choices.length)].clone(),
        type = this.queue.shift(),
        d = ENEMIES[type],
        offset = (Math.random() - 0.5) * 2;
      if (
        (d.boss ? g.enemies.bossNav : g.enemies.nav).supported(p.x + offset, p.z, p.y) &&
        !g.world.colliders.some(
          (b) =>
            b.top > p.y + 0.3 &&
            b.bottom < p.y + d.height &&
            overlaps(p.x + offset, p.z, d.radius + 0.1, b),
        )
      )
        p.x += offset;
      g.enemies.spawn(
        type,
        p,
        this.index >= 2 && Math.random() < (this.encounter?.eliteChance || 0),
      );
      if (d.boss) {
        g.notice(
          d.name +
            (d.faction === 'brood' ? ' / BREAK ITS ATTACK ORGANS' : ' / DISABLE ITS WEAPON MOUNTS'),
          4,
        );
        g.audio.alert();
      }
      this.timer = this.encounter?.interval || 1.4;
    }
    if (this.index >= 0 && !this.queue.length && !g.enemies.list.length) {
      this.completed = this.index + 1;
      g.stats.waveTimes ??= [];
      g.stats.waveTimes.push(g.elapsed - this.started);
      if (this.completed === this.total) {
        g.finish(true);
        return;
      }
      this.breakTime = 22;
      g.projectiles.clear();
      g.setBlackout(false);
      g.player.hp = Math.min(100, g.player.hp + g.difficulty.recovery);
      g.player.armor = Math.min(50, g.player.armor + 25);
      g.weapons.resupply();
      g.equipmentCharges = EQUIPMENT[g.save.equipment].charges;
      g.notice('SECTOR CLEAR / B: FIELD UPGRADES', 3);
      g.audio.alert();
    }
  }
}
