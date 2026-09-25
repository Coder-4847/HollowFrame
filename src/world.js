import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createSurfaces, worldBoxUV, worldCylinderUV, TILE_METRES } from './surfaces.js';
import { createSky, createDust } from './atmosphere.js';
import { PostPipeline } from './post.js';
// Layer 1 holds first-person models; they render in a second pass after post-processing so
// bloom, AO and depth never interact with the weapon in your hands.
export const VIEW_LAYER = 1;
export class World {
  constructor(canvas, settings) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.info.autoReset = false;
    this.quality = settings.quality;
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
    this.hemi = new THREE.HemisphereLight(0xafdadb, 0x34302a, 1.6);
    this.hemi.layers.enable(VIEW_LAYER);
    this.scene.add(this.hemi);
    // Image-based reflections give metal and painted panels real highlights.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.environment;
    this.hemiBase = 1.6;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();
    this.surfaces = createSurfaces();
    this.sky = createSky();
    this.scene.add(this.sky);
    this.dust = createDust();
    this.scene.add(this.dust);
    const sun = new THREE.DirectionalLight(0xffdeb2, 3);
    sun.layers.enable(VIEW_LAYER);
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
    this.floorTexture.repeat.set(TILE_METRES / 3, TILE_METRES / 3);
    this.floorTexture.colorSpace = THREE.SRGBColorSpace;
    this.floorTexture.anisotropy = 4;
    this.post = new PostPipeline(this.renderer, this.scene, this.camera);
    this.resolutionScale = 1;
    // Transient flash lights (muzzle, explosions). Each point light adds per-pixel cost to every
    // lit surface, so Low removes them; the count only changes with the quality setting.
    this.flashLights = [];
    this.bufferSize = new THREE.Vector2();
    this.clock = 0;
    window.addEventListener('resize', () => this.resize());
  }
  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.pixelRatio());
    this.renderer.setSize(innerWidth, innerHeight);
    this.post.setSize(innerWidth, innerHeight, this.pixelRatio());
  }
  pixelRatio() {
    const cap = this.quality === 'high' ? 1.75 : this.quality === 'medium' ? 1.25 : 1;
    return Math.max(0.5, Math.min(devicePixelRatio, cap) * this.resolutionScale);
  }
  // Dynamic resolution: trade a little sharpness for a steady frame rate on slower GPUs.
  // Hysteresis: drop only after two slow checks in a row, recover only after four fast ones, so
  // the image never visibly pumps between sharp and soft.
  adaptResolution(frameMs) {
    this.slowChecks = frameMs > 22 ? (this.slowChecks || 0) + 1 : 0;
    this.fastChecks = frameMs < 12 ? (this.fastChecks || 0) + 1 : 0;
    let next = this.resolutionScale;
    if (this.slowChecks >= 2) next = Math.max(0.65, next - 0.1);
    else if (this.fastChecks >= 4) next = Math.min(1, next + 0.05);
    if (Math.abs(next - this.resolutionScale) < 0.001) return;
    this.slowChecks = this.fastChecks = 0;
    this.resolutionScale = next;
    this.resize();
  }
  material(color, emissive = false, surface = 'panel', glow = 2.4) {
    const key = color + ':' + emissive + ':' + surface + ':' + glow;
    if (!this.materials.has(key)) {
      const detail = !emissive && this.surfaces[surface];
      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: detail ? 1 : 0.72,
        metalness: surface === 'organic' ? 0.05 : 0.35,
        ...(detail
          ? {
              map: detail.map,
              roughnessMap: detail.roughnessMap,
              normalMap: detail.normalMap,
              normalScale: new THREE.Vector2(0.9, 0.9),
            }
          : {}),
        ...(emissive ? { emissive: color, emissiveIntensity: glow } : {}),
      });
      if (detail) material.userData.detail = detail;
      this.applyDetail(material);
      this.materials.set(key, material);
    }
    return this.materials.get(key);
  }
  // Low quality drops relief and roughness maps (the costliest per-pixel work) but keeps colour.
  applyDetail(material) {
    const detail = material.userData.detail;
    if (!detail) return;
    const on = this.quality !== 'low';
    if ((material.normalMap === detail.normalMap) === on) return;
    material.normalMap = on ? detail.normalMap : null;
    material.roughnessMap = on ? detail.roughnessMap : null;
    material.roughness = on ? 1 : 0.72;
    material.needsUpdate = true;
  }
  box(w, h, d, color, x = 0, y = 0, z = 0, parent = this.scene, emissive = false) {
    const key = `${w},${h},${d}`;
    if (!this.geometries.has(key))
      this.geometries.set(key, worldBoxUV(new THREE.BoxGeometry(w, h, d), w, h, d));
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
      this.geometries.set(key, worldCylinderUV(new THREE.CylinderGeometry(r, r, h, 16), r, h));
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
  // Compile every shader the arena needs up front so the first seconds of play do not hitch.
  warmup(extra) {
    // compile() skips hidden objects, and some GPU drivers (ANGLE on Windows included) finish
    // pipeline setup only on the first real draw with a given blend state. So: reveal every
    // pooled effect, projectile, holstered gun and offscreen enemy variant, disable culling, and
    // draw one real frame through the full pipeline, scissored to a single on-screen pixel.
    const hidden = [],
      culled = [];
    if (extra) this.scene.add(extra);
    this.scene.traverse((o) => {
      // Lights stay as they are: revealing one would compile shaders for the wrong light count.
      if (!o.visible && !o.isLight) {
        o.visible = true;
        hidden.push(o);
      }
      if (o.frustumCulled) {
        o.frustumCulled = false;
        culled.push(o);
      }
    });
    this.camera.layers.enableAll();
    this.renderer.compile(this.scene, this.camera);
    this.camera.layers.set(0);
    this.renderer.setScissor(0, 0, 1, 1);
    this.renderer.setScissorTest(true);
    this.render(0);
    this.renderer.setScissorTest(false);
    for (const o of hidden) o.visible = false;
    for (const o of culled) o.frustumCulled = true;
    if (extra) this.scene.remove(extra);
  }
  // Mark a first-person model so it is drawn in the late, unprocessed pass.
  viewmodel(object) {
    object.traverse((o) => o.layers.set(VIEW_LAYER));
  }
  render(dt = 1 / 60) {
    this.clock += dt;
    this.renderer.info.reset();
    const camera = this.camera,
      sky = this.sky.material.uniforms;
    this.sky.position.copy(camera.position);
    sky.uHorizon.value.copy(this.scene.fog.color);
    sky.uZenith.value.copy(this.scene.background);
    sky.uSunColor.value.copy(this.sun.color).multiplyScalar(this.sun.intensity / 3);
    sky.uSunDir.value.copy(this.sunOffset).normalize();
    const dust = this.dust.material.uniforms;
    this.dust.visible = this.particlesEnabled !== false && this.richAtmosphere;
    dust.uTime.value = this.reducedMotion ? 0 : this.clock;
    dust.uCamera.value.copy(camera.position);
    dust.uColor.value.copy(this.sun.color).multiplyScalar(this.sun.intensity / 3);
    dust.uScale.value =
      this.renderer.getDrawingBufferSize(this.bufferSize).y /
      (2 * Math.tan((camera.fov * Math.PI) / 360));
    camera.layers.set(0);
    if (this.postEnabled) this.post.render(dt);
    else this.renderer.render(this.scene, camera);
    // First-person pass: keep the colour buffer, clear depth, draw only the viewmodel layer.
    this.renderer.autoClear = false;
    this.renderer.clearDepth();
    camera.layers.set(VIEW_LAYER);
    const background = this.scene.background;
    this.scene.background = null;
    this.renderer.render(this.scene, camera);
    this.scene.background = background;
    camera.layers.set(0);
    this.renderer.autoClear = true;
  }
  apply(settings) {
    this.renderer.toneMappingExposure = settings.brightness || 1.15;
    this.particlesEnabled = settings.particles !== false;
    this.reducedMotion = !!settings.reducedMotion;
    for (const obj of this.mapObjects || [])
      if (obj.userData.weather) obj.visible = this.particlesEnabled;
    this.quality = settings.quality;
    this.postEnabled = settings.quality !== 'low';
    // Low: no reflections or dust; brighter ambient light stands in for the missing reflections.
    const rich = settings.quality !== 'low';
    this.scene.environment = rich ? this.environment : null;
    this.hemiBase = rich ? 1.6 : 2.2;
    if (!this.blackout) this.hemi.intensity = this.hemiBase;
    this.richAtmosphere = rich;
    for (const material of this.materials.values()) this.applyDetail(material);
    for (const light of this.flashLights) light.visible = rich;
    this.post.configure({ ao: settings.quality === 'high', reducedMotion: this.reducedMotion });
    this.resize();
    this.renderer.shadowMap.enabled = settings.quality !== 'low' && settings.shadows !== false;
    this.camera.fov = settings.fov;
    this.camera.updateProjectionMatrix();
  }
}
