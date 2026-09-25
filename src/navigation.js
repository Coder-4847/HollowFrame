import { overlaps, floorAt } from './core.js';
// Layered surface graph: each X/Z cell can contain ground, bridges and rooftops.
export class Navigation {
  constructor(boxes, radius = 0.7, clearance = 3, options = {}) {
    this.boxes = boxes;
    this.radius = radius;
    this.clearance = clearance;
    this.bounds = options.bounds || 35;
    this.cell = 1;
    this.size = Math.floor(this.bounds * 2) + 1;
    this.nodes = [];
    this.columns = new Map();
    this.cache = new Map();
    this.voidFloor = options.voidFloor || false;
    for (let iz = 1; iz < this.size - 1; iz++)
      for (let ix = 1; ix < this.size - 1; ix++) {
        const x = ix - this.bounds,
          z = iz - this.bounds,
          touched = boxes.filter((b) => overlaps(x, z, radius, b));
        const levels = [
          ...new Set([
            ...(this.voidFloor ? [] : [0]),
            ...touched.map((b) => b.top).filter((y) => y >= 0 && y <= 24),
          ]),
        ].sort((a, b) => b - a);
        for (const y of levels) {
          if (touched.some((b) => b.top > y + 0.4 && b.bottom < y + clearance - 0.05)) continue;
          if (!this.supported(x, z, y)) continue;
          // Collapse the closely spaced staircase samples to their highest supported tread.
          const key = iz * this.size + ix,
            list = this.columns.get(key) || [];
          if (list.some((n) => Math.abs(this.nodes[n].y - y) < 0.41)) continue;
          const n = this.nodes.length;
          this.nodes.push({ x, y, z, edges: [] });
          list.push(n);
          this.columns.set(key, list);
        }
      }
    for (let n = 0; n < this.nodes.length; n++) {
      const a = this.nodes[n],
        key = this.index(a.x, a.z);
      for (const k of [key - 1, key + 1, key - this.size, key + this.size])
        for (const id of this.columns.get(k) || []) {
          const b = this.nodes[id];
          if (Math.abs(a.y - b.y) > 1.25) continue;
          let clear = true,
            walkY = a.y;
          for (let t = 0.2; t <= 1.001; t += 0.2) {
            const x = a.x + (b.x - a.x) * t,
              z = a.z + (b.z - a.z) * t,
              y = floorAt({ x, z, y: walkY }, radius, boxes, 0.4, this.voidFloor ? -Infinity : 0);
            if (
              !Number.isFinite(y) ||
              Math.abs(y - walkY) > 1.25 ||
              boxes.some(
                (c) =>
                  c.top > y + 0.41 && c.bottom < y + clearance - 0.05 && overlaps(x, z, radius, c),
              ) ||
              !this.supported(x, z, y)
            ) {
              clear = false;
              break;
            }
            walkY = y;
          }
          if (Math.abs(walkY - b.y) > 0.5) clear = false;
          if (clear) a.edges.push(id);
        }
    }
    for (const node of this.nodes) node.incoming = [];
    this.nodes.forEach((node, id) => {
      for (const next of node.edges) this.nodes[next].incoming.push(id);
    });
  }
  index(x, z) {
    return Math.round(z + this.bounds) * this.size + Math.round(x + this.bounds);
  }
  supported(x, z, y) {
    if (!this.voidFloor) return true;
    return [
      [0, 0],
      [this.radius * 0.85, 0],
      [-this.radius * 0.85, 0],
      [0, this.radius * 0.85],
      [0, -this.radius * 0.85],
      [this.radius * 0.7, this.radius * 0.7],
      [-this.radius * 0.7, this.radius * 0.7],
      [this.radius * 0.7, -this.radius * 0.7],
      [-this.radius * 0.7, -this.radius * 0.7],
    ].every(([dx, dz]) =>
      this.boxes.some(
        (b) =>
          b.top <= y + 0.41 &&
          b.top >= y - 2 &&
          x + dx >= b.x - b.w / 2 &&
          x + dx <= b.x + b.w / 2 &&
          z + dz >= b.z - b.d / 2 &&
          z + dz <= b.z + b.d / 2,
      ),
    );
  }
  nearest(p) {
    let best = -1,
      score = Infinity;
    for (let n = 0; n < this.nodes.length; n++) {
      const a = this.nodes[n],
        dy = Math.abs(a.y - (p.y ?? a.y)),
        d = (a.x - p.x) ** 2 + (a.z - p.z) ** 2 + dy * dy * 9;
      if (d < score) {
        best = n;
        score = d;
      }
    }
    return best;
  }
  path(from, to) {
    const start = this.nearest(from),
      goal = this.nearest(to);
    if (start < 0 || goal < 0 || start === goal) return [];
    let parent = this.cache.get(goal);
    if (!parent) {
      parent = new Int32Array(this.nodes.length).fill(-1);
      const queue = [goal];
      parent[goal] = goal;
      for (let i = 0; i < queue.length; i++)
        for (const n of this.nodes[queue[i]].incoming)
          if (parent[n] === -1) {
            parent[n] = queue[i];
            queue.push(n);
          }
      if (this.cache.size >= 6) this.cache.delete(this.cache.keys().next().value);
      this.cache.set(goal, parent);
    }
    if (parent[start] < 0) {
      const trail = new Int32Array(this.nodes.length).fill(-1),
        queue = [start];
      trail[start] = start;
      let closest = start,
        best = Infinity;
      for (let i = 0; i < queue.length; i++) {
        const n = queue[i],
          p = this.nodes[n],
          score = (p.x - to.x) ** 2 + (p.z - to.z) ** 2 + (p.y - (to.y ?? p.y)) ** 2 * 4;
        if (score < best) {
          best = score;
          closest = n;
        }
        for (const next of p.edges)
          if (trail[next] < 0) {
            trail[next] = n;
            queue.push(next);
          }
      }
      const route = [];
      for (let n = closest; n !== start; n = trail[n]) {
        const p = this.nodes[n];
        route.push({ x: p.x, y: p.y, z: p.z });
      }
      return route.reverse();
    }
    const anchor = this.nodes[start];
    const result =
      Math.hypot(anchor.x - from.x, anchor.z - from.z) > 0.2
        ? [{ x: anchor.x, y: anchor.y, z: anchor.z }]
        : [];
    let n = start;
    for (let i = 0; n !== goal && i < 600; i++) {
      n = parent[n];
      const p = this.nodes[n];
      result.push({ x: p.x, y: p.y, z: p.z });
    }
    return result;
  }
}
