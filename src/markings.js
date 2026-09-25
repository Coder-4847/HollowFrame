import * as THREE from 'three';
// Surface markings use two draw calls and never alter the collision/navigation layout.
export function addFieldMarkings(world, map, definition) {
  const placements = [];
  for (const side of [-1, 1])
    for (let n = 0; n < 7; n++)
      placements.push({
        y: map.station.y,
        x: map.station.x + side * 2.2,
        z: map.station.z - 2.5 + n * 0.55,
        sx: 0.65,
        sz: 0.22,
        angle: -0.45,
      });
  for (const p of map.spawns)
    for (let n = -1; n <= 1; n++)
      placements.push({ y: p.y, x: p.x + n * 0.55, z: p.z, sx: 0.28, sz: 1.1, angle: 0 });
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 0.012, 1),
    new THREE.MeshStandardMaterial({
      color: definition.id === 'whiteout' ? 0x294951 : 0xbc9d64,
      roughness: 0.95,
    }),
    placements.length,
  );
  const dummy = new THREE.Object3D();
  placements.forEach((p, n) => {
    dummy.position.set(p.x, (p.y || 0) + 0.015, p.z);
    dummy.scale.set(p.sx, 1, p.sz);
    dummy.rotation.y = p.angle;
    dummy.updateMatrix();
    mesh.setMatrixAt(n, dummy.matrix);
  });
  mesh.receiveShadow = true;
  world.scene.add(mesh);
  const strips = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.07, 0.02, 2),
    new THREE.MeshBasicMaterial({ color: definition.id === 'cinderline' ? 0xb6a2dc : 0x91d4c4 }),
    8,
  );
  for (let n = 0; n < 8; n++) {
    dummy.position.set(
      map.station.x + (n % 2 ? 2.7 : -2.7),
      map.station.y + 0.035,
      map.station.z - 3 + Math.floor(n / 2) * 1.6,
    );
    dummy.scale.set(1, 1, 0.45);
    dummy.rotation.y = 0;
    dummy.updateMatrix();
    strips.setMatrixAt(n, dummy.matrix);
  }
  world.scene.add(strips);
}
