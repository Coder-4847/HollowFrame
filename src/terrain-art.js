import * as THREE from 'three';
export function surfaceTexture(kind) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d');
  c.fillStyle = kind === 'salt' ? '#b8af92' : '#798782';
  c.fillRect(0, 0, 256, 256);
  let seed = 311;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let n = 0; n < 3500; n++) {
    const v = Math.floor(100 + rand() * 110);
    c.fillStyle = `rgba(${v},${v},${v},.16)`;
    c.fillRect(rand() * 256, rand() * 256, 1 + rand() * 2, 1);
  }
  if (kind === 'salt') {
    c.strokeStyle = '#807b6655';
    c.lineWidth = 1;
    for (let n = 0; n < 28; n++) {
      let x = rand() * 256,
        y = rand() * 256;
      c.beginPath();
      c.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        x += (rand() - 0.5) * 40;
        y += rand() * 22;
        c.lineTo(x, y);
      }
      c.stroke();
    }
  } else {
    c.strokeStyle = '#343f3c88';
    c.strokeRect(2, 2, 252, 252);
    for (let n = 0; n < 16; n++) {
      c.fillStyle = '#d6d9b62a';
      c.fillRect(n * 16, 0, 2, 256);
    }
    for (const x of [9, 247])
      for (const y of [9, 247]) {
        c.fillStyle = '#313d3a';
        c.fillRect(x, y, 3, 3);
      }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(kind === 'salt' ? 15 : 10, kind === 'salt' ? 15 : 10);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
export function rooftopHardware(w, x, y, z) {
  const mast = w.cylinder(0.1, 5, 0x8e9d9f, x, y + 2.5, z);
  for (const offset of [-1.2, 0, 1.2]) w.box(3, 0.07, 0.08, 0xb1baba, x, y + 3 + offset, z);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.09, 6, 20), w.material(0xa5b4af));
  rim.rotation.x = -Math.PI / 2;
  rim.position.set(x + 3, y + 0.2, z);
  w.scene.add(rim);
  const fan = new THREE.Group();
  fan.position.set(x + 3, y + 0.2, z);
  fan.rotation.x = Math.PI / 2;
  for (let n = 0; n < 3; n++) {
    const blade = w.box(0.3, 1.8, 0.06, 0x6b8381, 0, 0, 0, fan);
    blade.rotation.z = (n * Math.PI) / 3;
  }
  w.scene.add(fan);
  w.animated.push(fan);
}
