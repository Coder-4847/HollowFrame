import * as THREE from 'three';
// Procedural surface detail. Every texture tiles, is generated once at startup and is shared by
// all standard materials, so the whole arena gains panel seams, rivets, grime and relief for the
// cost of three texture samples per pixel.
export const TILE_METRES = 4;
const SIZE = 512;
function random(seed) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}
// Tileable value noise sampled with smooth interpolation.
function noiseField(cells, rand) {
  const grid = Array.from({ length: cells * cells }, rand);
  return (x, y) => {
    const fx = (x / SIZE) * cells,
      fy = (y / SIZE) * cells,
      ix = Math.floor(fx),
      iy = Math.floor(fy),
      tx = fx - ix,
      ty = fy - iy,
      sx = tx * tx * (3 - 2 * tx),
      sy = ty * ty * (3 - 2 * ty),
      at = (a, b) =>
        grid[(((b % cells) + cells) % cells) * cells + (((a % cells) + cells) % cells)];
    const top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * sx,
      bottom = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * sx;
    return top + (bottom - top) * sy;
  };
}
function toTexture(values, channels, srgb) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d'),
    image = ctx.createImageData(SIZE, SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) {
    for (let c = 0; c < 3; c++)
      image.data[i * 4 + c] = Math.max(
        0,
        Math.min(255, values[i * channels + (channels === 3 ? c : 0)] * 255),
      );
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return texture;
}
function normalsFrom(height, strength) {
  const out = new Float32Array(SIZE * SIZE * 3),
    at = (x, y) => height[((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)];
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength,
        dy = (at(x, y + 1) - at(x, y - 1)) * strength,
        len = Math.hypot(dx, dy, 1),
        i = (y * SIZE + x) * 3;
      out[i] = (-dx / len) * 0.5 + 0.5;
      out[i + 1] = (dy / len) * 0.5 + 0.5;
      out[i + 2] = (1 / len) * 0.5 + 0.5;
    }
  return out;
}
function panelSurface() {
  const rand = random(9187),
    albedo = new Float32Array(SIZE * SIZE).fill(0.9),
    rough = new Float32Array(SIZE * SIZE).fill(0.7),
    height = new Float32Array(SIZE * SIZE).fill(0.5),
    grime = noiseField(6, rand),
    mottling = noiseField(24, rand),
    grain = noiseField(128, rand),
    cell = SIZE / 4; // One-metre panels at the default tiling.
  const plot = (x, y, fn) => {
    const i = ((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE);
    fn(i);
  };
  // Panels: each metre square is optionally split, then shaded, seamed and riveted.
  for (let py = 0; py < 4; py++)
    for (let px = 0; px < 4; px++) {
      const split = rand(),
        rects =
          split < 0.35
            ? [
                [0, 0, 1, 0.5],
                [0, 0.5, 1, 0.5],
              ]
            : split < 0.6
              ? [
                  [0, 0, 0.5, 1],
                  [0.5, 0, 0.5, 1],
                ]
              : [[0, 0, 1, 1]];
      for (const [rx, ry, rw, rh] of rects) {
        const x0 = Math.round((px + rx) * cell),
          y0 = Math.round((py + ry) * cell),
          w = Math.round(rw * cell),
          h = Math.round(rh * cell),
          tint = 0.93 + rand() * 0.1,
          gloss = 0.6 + rand() * 0.2;
        for (let y = y0; y < y0 + h; y++)
          for (let x = x0; x < x0 + w; x++) {
            const edge = Math.min(x - x0, y - y0, x0 + w - 1 - x, y0 + h - 1 - y);
            plot(x, y, (i) => {
              albedo[i] = tint;
              rough[i] = gloss;
              if (edge < 2) {
                // Recessed seam with a slightly bevelled lip.
                albedo[i] = 0.5;
                rough[i] = 0.92;
                height[i] = 0.12;
              } else if (edge < 4) {
                height[i] = 0.42;
                albedo[i] = tint * 1.04;
              }
            });
            // Dirt collects towards the lower edge of each panel.
            const drip = (y - y0) / h;
            if (drip > 0.7)
              plot(x, y, (i) => {
                albedo[i] *= 1 - (drip - 0.7) * 0.35 * mottling(x, y);
              });
          }
        for (const [cx, cy] of [
          [x0 + 7, y0 + 7],
          [x0 + w - 8, y0 + 7],
          [x0 + 7, y0 + h - 8],
          [x0 + w - 8, y0 + h - 8],
        ])
          for (let y = -3; y <= 3; y++)
            for (let x = -3; x <= 3; x++) {
              const r = Math.hypot(x, y);
              if (r <= 2.6)
                plot(cx + x, cy + y, (i) => {
                  height[i] = 0.5 + (1 - r / 2.6) * 0.5;
                  albedo[i] = 1.02 - r * 0.06;
                  rough[i] = 0.45;
                });
            }
      }
    }
  // Scratches: bright, smoother streaks that catch reflections.
  for (let n = 0; n < 70; n++) {
    let x = rand() * SIZE,
      y = rand() * SIZE;
    const angle = rand() * Math.PI,
      length = 8 + rand() * 40;
    for (let s = 0; s < length; s++) {
      x += Math.cos(angle);
      y += Math.sin(angle);
      plot(Math.floor(x), Math.floor(y), (i) => {
        albedo[i] = Math.min(1.08, albedo[i] + 0.12);
        rough[i] = Math.max(0.3, rough[i] - 0.25);
      });
    }
  }
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x,
        dirt = grime(x, y),
        fine = grain(x, y);
      albedo[i] *= 0.84 + dirt * 0.2 + (fine - 0.5) * 0.06;
      rough[i] = Math.min(1, rough[i] + (1 - dirt) * 0.12 + (fine - 0.5) * 0.08);
      height[i] += (fine - 0.5) * 0.03;
    }
  return {
    map: toTexture(albedo, 1, true),
    roughnessMap: toTexture(rough, 1, false),
    normalMap: toTexture(normalsFrom(height, 2.4), 3, false),
  };
}
function organicSurface() {
  const rand = random(4421),
    albedo = new Float32Array(SIZE * SIZE),
    rough = new Float32Array(SIZE * SIZE),
    height = new Float32Array(SIZE * SIZE),
    broad = noiseField(5, rand),
    mid = noiseField(14, rand),
    fine = noiseField(64, rand),
    vein = noiseField(9, rand);
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x,
        v = Math.abs(vein(x, y) - 0.5),
        ridge = v < 0.035 ? 1 - v / 0.035 : 0,
        bump = broad(x, y) * 0.5 + mid(x, y) * 0.35 + fine(x, y) * 0.15;
      albedo[i] = 0.72 + bump * 0.34 - ridge * 0.28;
      rough[i] = 0.42 + fine(x, y) * 0.3 + ridge * 0.2;
      height[i] = bump + ridge * 0.25;
    }
  return {
    map: toTexture(albedo, 1, true),
    roughnessMap: toTexture(rough, 1, false),
    normalMap: toTexture(normalsFrom(height, 3.2), 3, false),
  };
}
export function createSurfaces() {
  return { panel: panelSurface(), organic: organicSurface() };
}
// Rescales a box's per-face 0..1 UVs to world metres so textures keep a constant density.
export function worldBoxUV(geometry, w, h, d) {
  const uv = geometry.attributes.uv,
    faces = [
      [d, h],
      [d, h],
      [w, d],
      [w, d],
      [w, h],
      [w, h],
    ],
    offset = ((w * 7.13 + h * 3.71 + d * 1.37) % 1) * 0.75;
  for (let f = 0; f < 6; f++)
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(
        i,
        (uv.getX(i) * faces[f][0]) / TILE_METRES + offset,
        (uv.getY(i) * faces[f][1]) / TILE_METRES + offset * 0.5,
      );
    }
  uv.needsUpdate = true;
  return geometry;
}
export function worldCylinderUV(geometry, r, h) {
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++)
    uv.setXY(i, (uv.getX(i) * Math.PI * 2 * r) / TILE_METRES, (uv.getY(i) * h) / TILE_METRES);
  uv.needsUpdate = true;
  return geometry;
}
