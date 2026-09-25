import * as THREE from 'three';
export class World {
  constructor(canvas, settings) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, settings.quality === 'high' ? 1.75 : 1));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = settings.quality !== 'low' && settings.shadows !== false;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x18292c);
    this.scene.fog = new THREE.FogExp2(0x233235, 0.012);
    this.camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.06, 180);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    this.scene.add(new THREE.HemisphereLight(0xafdadb, 0x34302a, 2.3));
    const sun = new THREE.DirectionalLight(0xffdeb2, 3);
    sun.position.set(-25, 48, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -45;
    sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45;
    sun.shadow.camera.bottom = -45;
    sun.shadow.normalBias = 0.06;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun, sun.target);
    this.sun = sun;
    this.sunOffset = sun.position.clone();
    this.shadowFocus = new THREE.Vector3(Infinity, 0, 0);
    this.materials = new Map();
    this.geometries = new Map();
    this.colliders = [];
    this.solids = [];
    this.animated = [];
    const tile = document.createElement('canvas');
    tile.width = 128;
    tile.height = 128;
    const ctx = tile.getContext('2d');
    ctx.fillStyle = '#b9c1b9';
    ctx.fillRect(0, 0, 128, 128);
    let seed = 17;
    for (let n = 0; n < 2200; n++) {
      seed = (seed * 16807) % 2147483647;
      const x = seed % 128;
      seed = (seed * 16807) % 2147483647;
      const y = seed % 128;
      ctx.fillStyle = n % 2 ? '#8e988d33' : '#e1e4d422';
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.strokeStyle = '#687266';
    ctx.strokeRect(0, 0, 128, 128);
    for (const [x, y] of [
      [5, 5],
      [123, 5],
      [5, 123],
      [123, 123],
    ]) {
      ctx.fillStyle = '#757f70';
      ctx.fillRect(x, y, 2, 2);
    }
    this.floorTexture = new THREE.CanvasTexture(tile);
    this.floorTexture.wrapS = this.floorTexture.wrapT = THREE.RepeatWrapping;
    this.floorTexture.repeat.set(24, 24);
    this.floorTexture.colorSpace = THREE.SRGBColorSpace;
    this.floorTexture.anisotropy = 4;
    window.addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
  }
  material(color, emissive = false) {
    const key = color + ':' + emissive;
    if (!this.materials.has(key))
      this.materials.set(
        key,
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.72,
          metalness: 0.4,
          ...(emissive ? { emissive: color, emissiveIntensity: 2 } : {}),
        }),
      );
    return this.materials.get(key);
  }
  box(w, h, d, color, x = 0, y = 0, z = 0, parent = this.scene, emissive = false) {
    const key = `${w},${h},${d}`;
    if (!this.geometries.has(key)) this.geometries.set(key, new THREE.BoxGeometry(w, h, d));
    const mesh = new THREE.Mesh(this.geometries.get(key), this.material(color, emissive));
    mesh.position.set(x, y, z);
    mesh.castShadow = !emissive;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  solid(w, h, d, color, x, y, z) {
    const mesh = this.box(w, h, d, color, x, y, z);
    this.colliders.push({ x, z, w, d, top: y + h / 2, bottom: y - h / 2 });
    this.solids.push(mesh);
    return mesh;
  }
  cylinder(r, h, color, x, y, z, parent = this.scene) {
    const key = `c${r},${h}`;
    if (!this.geometries.has(key))
      this.geometries.set(key, new THREE.CylinderGeometry(r, r, h, 12));
    const m = new THREE.Mesh(this.geometries.get(key), this.material(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  text(value, x, y, z, size = 2, color = '#c8d5ce', ry = 0) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = color;
    ctx.font = 'bold 70px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(value, 256, 90);
    const tex = new THREE.CanvasTexture(c);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(size * 4, size),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
    );
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    this.scene.add(mesh);
    return mesh;
  }
  // Keep the shadow frustum centred on the action so large arenas stay shadowed.
  // Snapping to whole shadow texels prevents shimmering edges while the player moves.
  focusShadows(point) {
    const texel = (this.sun.shadow.camera.right * 2) / this.sun.shadow.mapSize.x,
      x = Math.round(point.x / texel) * texel,
      z = Math.round(point.z / texel) * texel;
    if (
      Math.abs(x - this.shadowFocus.x) < texel * 0.5 &&
      Math.abs(z - this.shadowFocus.z) < texel * 0.5
    )
      return;
    this.shadowFocus.set(x, 0, z);
    this.sun.target.position.copy(this.shadowFocus);
    this.sun.position.copy(this.shadowFocus).add(this.sunOffset);
    this.sun.target.updateMatrixWorld();
    this.sun.updateMatrixWorld();
  }
  render() {
    this.renderer.render(this.scene, this.camera);
  }
  apply(settings) {
    this.renderer.toneMappingExposure = settings.brightness || 1.15;
    this.particlesEnabled = settings.particles !== false;
    for (const obj of this.mapObjects || [])
      if (obj.userData.weather) obj.visible = this.particlesEnabled;
    this.renderer.setPixelRatio(
      Math.min(
        devicePixelRatio,
        settings.quality === 'high' ? 1.75 : settings.quality === 'medium' ? 1.25 : 1,
      ),
    );
    this.renderer.shadowMap.enabled = settings.quality !== 'low' && settings.shadows !== false;
    this.camera.fov = settings.fov;
    this.camera.updateProjectionMatrix();
  }
}
