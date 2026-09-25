import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { overlaps } from './core.js';
// Decorative clutter layered over each arena after it is built: rubble along wall bases, grime
// decals on walkable surfaces and sagging cables between tall structures. Everything is visual
// only (no colliders), seeded per map so layouts are stable, and drawn in a handful of calls.
function seeded(text) {
  let seed = 7;
  for (const c of text) seed = (seed * 31 + c.charCodeAt(0)) % 2147483647;
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}
let stainTexture;
function stains() {
  if (stainTexture) return stainTexture;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d'),
    rand = seeded('stains');
  // Four stain variants in a 2x2 atlas.
  for (let cell = 0; cell < 4; cell++) {
    const ox = (cell % 2) * 128 + 64,
      oy = Math.floor(cell / 2) * 128 + 64;
    for (let n = 0; n < 26; n++) {
      const r = 8 + rand() * 34,
        x = ox + (rand() - 0.5) * 60,
        y = oy + (rand() - 0.5) * 60,
        g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(20,18,14,${0.18 + rand() * 0.2})`);
      g.addColorStop(1, 'rgba(20,18,14,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
  }
  stainTexture = new THREE.CanvasTexture(canvas);
  stainTexture.colorSpace = THREE.SRGBColorSpace;
  stainTexture.repeat.set(0.5, 0.5);
  return stainTexture;
}
export function dressSurfaces(w, map, id) {
  if (typeof document === 'undefined') return;
  const rand = seeded(id),
    bounds = (map.bounds || 35) - 1.5,
    boxes = w.colliders,
    occupied = (x, z, y, r) =>
      boxes.some((b) => b.top > y + 0.05 && b.bottom < y + 0.6 && overlaps(x, z, r, b));
  // Walkable surfaces: the ground (unless the map is a void) plus large deck tops.
  const surfaces = boxes
    .filter((b) => b.w * b.d > 40 && b.w < 100 && b.top > 0.2)
    .map((b) => ({ x: b.x, z: b.z, w: b.w - 1, d: b.d - 1, y: b.top }));
  if (!map.voidFloor) surfaces.push({ x: 0, z: 0, w: bounds * 2, d: bounds * 2, y: 0 });
  const pick = () => {
    const weights = surfaces.map((s) => s.w * s.d),
      total = weights.reduce((a, b) => a + b, 0);
    let t = rand() * total;
    const s = surfaces[weights.findIndex((wt) => (t -= wt) <= 0)] || surfaces[0];
    return { x: s.x + (rand() - 0.5) * s.w, z: s.z + (rand() - 0.5) * s.d, y: s.y };
  };
  const dummy = new THREE.Object3D();
  // Grime decals.
  const decalCount = 70,
    decalGeometry = new THREE.PlaneGeometry(1, 1);
  decalGeometry.rotateX(-Math.PI / 2);
  const decals = new THREE.InstancedMesh(
    decalGeometry,
    new THREE.MeshStandardMaterial({
      map: stains(),
      transparent: true,
      depthWrite: false,
      roughness: 0.4,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
    decalCount,
  );
  let placed = 0;
  for (let n = 0; n < decalCount * 3 && placed < decalCount && surfaces.length; n++) {
    const p = pick(),
      size = 1.2 + rand() * 3.2;
    if (occupied(p.x, p.z, p.y, 0.3)) continue;
    dummy.position.set(p.x, p.y + 0.012, p.z);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.set(size, 1, size * (0.6 + rand() * 0.6));
    dummy.updateMatrix();
    decals.setMatrixAt(placed++, dummy.matrix);
  }
  decals.count = placed;
  // One atlas quadrant per decal; random rotation and stretch keep repeats from reading.
  decals.receiveShadow = true;
  decals.renderOrder = 1;
  w.scene.add(decals);
  // Rubble along the base of walls and cover.
  const rubbleMax = 520,
    rubble = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(0.5, 0),
      w.material(0x6f716a),
      rubbleMax,
    ),
    tint = new THREE.Color();
  let rocks = 0;
  for (const b of boxes) {
    if (rocks >= rubbleMax) break;
    if (b.top - b.bottom < 0.9 || b.w * b.d > 900) continue;
    const base = b.bottom < 0.05 ? 0 : b.bottom;
    const perimeter = 2 * (b.w + b.d),
      count = Math.min(14, Math.floor(perimeter / 3));
    for (let n = 0; n < count && rocks < rubbleMax; n++) {
      const t = rand() * perimeter,
        out = 0.12 + rand() * 0.35;
      let x, z;
      if (t < b.w) ((x = b.x - b.w / 2 + t), (z = b.z - b.d / 2 - out));
      else if (t < b.w * 2) ((x = b.x - b.w / 2 + t - b.w), (z = b.z + b.d / 2 + out));
      else if (t < b.w * 2 + b.d) ((x = b.x - b.w / 2 - out), (z = b.z - b.d / 2 + t - b.w * 2));
      else ((x = b.x + b.w / 2 + out), (z = b.z - b.d / 2 + t - b.w * 2 - b.d));
      const y = map.voidFloor && base === 0 ? null : base;
      if (y === null || Math.abs(x) > bounds || Math.abs(z) > bounds) continue;
      if (occupied(x, z, y, 0.05)) continue;
      const s = 0.06 + rand() ** 2 * 0.28;
      dummy.position.set(x, y + s * 0.3, z);
      dummy.rotation.set(rand() * 6, rand() * 6, rand() * 6);
      dummy.scale.set(s * (0.8 + rand() * 0.6), s * (0.5 + rand() * 0.4), s * (0.8 + rand() * 0.6));
      dummy.updateMatrix();
      rubble.setMatrixAt(rocks, dummy.matrix);
      rubble.setColorAt(rocks, tint.setHSL(0.1, 0.05 + rand() * 0.08, 0.35 + rand() * 0.3));
      rocks++;
    }
  }
  rubble.count = rocks;
  rubble.castShadow = rubble.receiveShadow = true;
  w.scene.add(rubble);
  // Cables sagging between the tops of nearby tall structures.
  const tall = boxes.filter((b) => b.top > 3.5 && b.top - b.bottom < 30 && b.w < 20 && b.d < 20),
    pieces = [];
  for (let n = 0; n < tall.length && pieces.length < 14; n++) {
    const a = tall[Math.floor(rand() * tall.length)],
      b = tall[Math.floor(rand() * tall.length)],
      span = Math.hypot(a.x - b.x, a.z - b.z);
    if (a === b || span < 6 || span > 18) continue;
    const start = new THREE.Vector3(a.x, a.top - 0.25, a.z),
      end = new THREE.Vector3(b.x, b.top - 0.25, b.z),
      sag = span * (0.08 + rand() * 0.06),
      points = [];
    for (let k = 0; k <= 16; k++) {
      const t = k / 16,
        p = start.clone().lerp(end, t);
      p.y -= Math.sin(t * Math.PI) * sag;
      points.push(p);
    }
    pieces.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.035, 5));
  }
  if (pieces.length) {
    const cables = new THREE.Mesh(mergeGeometries(pieces), w.material(0x1c2322));
    for (const p of pieces) p.dispose();
    cables.castShadow = true;
    w.scene.add(cables);
  }
}
