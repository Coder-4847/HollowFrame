import * as THREE from 'three';
// Gradient sky that fades into the fog colour at the horizon, with a soft sun halo and faint
// cloud banding. It follows the camera and never writes depth, so it cannot occlude the arena.
export function createSky() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uZenith: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uSunColor: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(-0.45, 0.85, 0.27).normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith, uHorizon, uSunColor, uSunDir;
      varying vec3 vDir;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      void main() {
        vec3 dir = normalize(vDir);
        float h = max(dir.y, 0.0);
        vec3 color = mix(uHorizon, uZenith, pow(h, 0.55));
        vec2 cloudUv = dir.xz / max(dir.y + 0.12, 0.05) * 1.6;
        float clouds = noise(cloudUv) * 0.6 + noise(cloudUv * 2.7) * 0.4;
        color = mix(color, uHorizon * 1.12, smoothstep(0.55, 0.85, clouds) * smoothstep(0.02, 0.25, h) * 0.35);
        float sun = max(dot(dir, uSunDir), 0.0);
        color += uSunColor * (pow(sun, 700.0) * 5.0 + pow(sun, 18.0) * 0.28 + pow(sun, 4.0) * 0.06);
        color = mix(color, uHorizon, smoothstep(0.02, -0.12, dir.y));
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(160, 32, 16), material);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  return sky;
}
// Slowly drifting motes that wrap around the camera. Additive, tiny and cheap: one draw call.
export function createDust() {
  const count = 600,
    positions = new Float32Array(count * 3),
    seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = Math.random() * 36;
    positions[i * 3 + 1] = Math.random() * 18;
    positions[i * 3 + 2] = Math.random() * 36;
    seeds[i] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uCamera: { value: new THREE.Vector3() },
      uColor: { value: new THREE.Color(0xffe2b8) },
      uScale: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute float seed;
      uniform float uTime, uScale;
      uniform vec3 uCamera;
      varying float vFade;
      void main() {
        vec3 box = vec3(36.0, 18.0, 36.0);
        vec3 drift = vec3(sin(uTime * 0.13 + seed * 20.0), sin(uTime * 0.07 + seed * 9.0) * 0.4 - 0.15, cos(uTime * 0.11 + seed * 14.0)) * uTime * 0.05;
        vec3 p = mod(position + drift - uCamera + box * 0.5, box) - box * 0.5 + uCamera;
        p.y = max(p.y, 0.05);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float d = length(p - uCamera);
        vFade = smoothstep(18.0, 6.0, d) * smoothstep(0.4, 1.5, d) * (0.45 + 0.55 * sin(uTime * (0.6 + seed) + seed * 40.0) * 0.5 + 0.275);
        // uScale converts metres at unit depth into pixels for the current projection.
        gl_PointSize = max(1.0, (0.01 + seed * 0.018) * uScale / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vFade;
      void main() {
        float r = length(gl_PointCoord - 0.5);
        if (r > 0.5) discard;
        gl_FragColor = vec4(uColor * (1.0 - r * 2.0) * vFade * 0.35, 1.0);
      }`,
  });
  const dust = new THREE.Points(geometry, material);
  dust.frustumCulled = false;
  return dust;
}
