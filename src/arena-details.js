import * as THREE from 'three';
// Batch surface details rather than adding a draw call for every rivet or panel.
export function dressArena(w, map, id) {
  const groups = [[], [], []],
    steel = id === 'whiteout' ? 0x819eaa : id === 'cinderline' ? 0x8f8297 : 0x7f9285,
    glow =
      id === 'ashworks' ? 0xffa75c : id === 'sunbreak' || id === 'saltreach' ? 0xd3db99 : 0x9cdecd;
  const add = (group, x, y, z, sx, sy, sz) => groups[group].push([x, y, z, sx, sy, sz]);
  const covers = w.colliders.filter(
    (b) =>
      b.top - b.bottom > 1 &&
      b.top - b.bottom < 5 &&
      b.w >= 2 &&
      b.w <= 14 &&
      b.d >= 2 &&
      b.d <= 15,
  );
  for (const b of covers) {
    const y = b.top;
    for (const side of [-1, 1]) {
      add(
        0,
        b.x + side * (b.w / 2 - 0.15),
        (b.bottom + y) / 2,
        b.z + b.d / 2 + 0.012,
        0.15,
        y - b.bottom,
        0.03,
      );
      for (let n = 0; n < 4; n++)
        add(
          1,
          b.x + side * (b.w / 2 - 0.3),
          b.bottom + 0.35 + (n * (y - b.bottom - 0.7)) / 3,
          b.z + b.d / 2 + 0.04,
          0.07,
          0.07,
          0.05,
        );
    }
    for (let n = 0; n < 6; n++)
      add(
        0,
        b.x + (n - 2.5) * Math.min(0.4, b.w / 8),
        y + 0.016,
        b.z,
        Math.min(0.18, b.w / 15),
        0.025,
        b.d * 0.6,
      );
    add(2, b.x, y - 0.18, b.z + b.d / 2 + 0.035, b.w * 0.55, 0.05, 0.03);
  }
  // Perimeter service infrastructure and locality-specific silhouettes.
  const extent = (map.bounds || 35) - 1;
  for (let n = 0; n < 12; n++) {
    const x = -extent + 4 + (n * (extent * 2 - 8)) / 11;
    if (id === 'whiteout') {
      add(0, x, 3, -extent + 0.12, 2, 3, 0.05);
      add(2, x, 3.9, -extent + 0.16, 1.2, 0.08, 0.07);
    } else if (id === 'cinderline') {
      add(0, x, 2, -extent + 0.1, 2.4, 3, 0.08);
      add(1, x, 1.1, -extent + 0.17, 2, 0.3, 0.02);
    } else if (!map.voidFloor) {
      add(0, x, 4.5, -extent + 0.1, 0.15, 2, 0.2);
      add(2, x, 5.3, -extent + 0.2, 0.7, 0.1, 0.12);
    }
  }
  for (let group = 0; group < 3; group++) {
    if (!groups[group].length) continue;
    const mat =
      group === 2
        ? new THREE.MeshBasicMaterial({ color: glow })
        : new THREE.MeshStandardMaterial({
            color: group === 0 ? steel : 0xc6bd9b,
            roughness: 0.65,
            metalness: 0.5,
          });
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, groups[group].length),
      dummy = new THREE.Object3D();
    groups[group].forEach(([x, y, z, sx, sy, sz], n) => {
      dummy.position.set(x, y, z);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(n, dummy.matrix);
    });
    mesh.receiveShadow = true;
    w.scene.add(mesh);
  }
  if (['ashworks', 'deepwell', 'spillway'].includes(id))
    for (const x of [-30, 30]) {
      const p = w.cylinder(0.3, 48, steel, x, 5, 0);
      p.rotation.x = Math.PI / 2;
      for (const z of [-20, -8, 8, 20]) w.box(0.7, 0.9, 0.18, 0x4b5c58, x, 5, z);
    }
  if (['sunbreak', 'saltreach'].includes(id))
    for (const x of [-24, -12, 12, 24]) {
      w.box(0.3, 3, 0.3, 0x506761, x, 1.5, -(map.bounds || 35) - 5);
      const panel = w.box(8, 0.25, 5, 0x37566a, x, 3, -(map.bounds || 35) - 5);
      panel.rotation.x = 0.25;
      for (let n = 0; n < 6; n++)
        w.box(0.05, 0.04, 4.7, 0x90b1af, x - 3 + n, 3.18, -(map.bounds || 35) - 5);
    }
  if (id === 'whiteout')
    for (const x of [-17, 17])
      for (const z of [-9, 4]) {
        w.box(1, 0.9, 0.1, 0x203e48, x - 5.15, 2.4, z);
        w.box(0.75, 0.55, 0.12, 0x9ce4dd, x - 5.12, 2.5, z, w.scene, true);
      }
  if (id === 'cinderline')
    for (const [x, z] of [
      [-22, 8],
      [22, -22],
    ]) {
      w.box(4, 1.6, 0.13, 0x252b3a, x, 6, z + 5.15);
      w.text(x < 0 ? 'LAST TRAIN / 04' : 'CHOIR OCCUPIED', x, 6, z + 5.24, 0.65, '#eac5d7');
    }
  if (id === 'deepwell')
    for (const x of [-10, 10])
      for (const z of [-20, 16]) {
        w.cylinder(0.9, 3.8, 0x486a60, x, 1.9, z);
        w.box(0.07, 2.7, 0.6, 0x8ee3bf, x + 0.91, 2, z, w.scene, true);
      }
}
