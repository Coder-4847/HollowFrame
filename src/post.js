import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
// Linear-HDR grade applied before tone mapping: vignette, gentle saturation, edge chromatic
// aberration, damage tint and a radial speed blur that only affects the outer screen.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uSpeed: { value: 0 },
    uHurt: { value: 0 },
    uVignette: { value: 0.32 },
    uSaturation: { value: 1.1 },
    uGrain: { value: 0.035 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uSpeed, uHurt, uVignette, uSaturation, uGrain;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 fromCenter = vUv - 0.5;
      float edge = smoothstep(0.18, 0.72, length(fromCenter));
      vec3 color = texture2D(tDiffuse, vUv).rgb;
      float blur = uSpeed * edge;
      if (blur > 0.001) {
        vec3 sum = color;
        for (int i = 1; i <= 6; i++) sum += texture2D(tDiffuse, vUv - fromCenter * blur * 0.045 * float(i)).rgb;
        color = sum / 7.0;
      }
      float shift = (0.0015 + uSpeed * 0.004 + uHurt * 0.006) * edge;
      color.r = mix(color.r, texture2D(tDiffuse, vUv + fromCenter * shift * 2.0).r, 0.85);
      color.b = mix(color.b, texture2D(tDiffuse, vUv - fromCenter * shift * 2.0).b, 0.85);
      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(vec3(luma), color, uSaturation - uHurt * 0.5);
      color = mix(color, color * vec3(1.35, 0.55, 0.5), uHurt * edge * 0.8);
      color *= 1.0 - uVignette * smoothstep(0.3, 0.85, length(fromCenter * vec2(1.1, 1.0)));
      color *= 1.0 + (hash(vUv * 1000.0 + fract(uTime) * 91.0) - 0.5) * uGrain;
      gl_FragColor = vec4(color, 1.0);
    }`,
};
// Stock GTAO only skips points and lines, so sprites, decals and tracers would be stamped into
// its depth/normal buffer as solid quads and cast dark squares of occlusion. Hide anything that
// is not solid, opaque geometry while the occlusion inputs are drawn.
class SolidGTAOPass extends GTAOPass {
  _overrideVisibility() {
    const cache = this._visibilityCache;
    this.scene.traverse((object) => {
      if (
        object.visible &&
        (object.isPoints ||
          object.isLine ||
          object.isSprite ||
          object.userData.noAO ||
          (object.material && !Array.isArray(object.material) && object.material.transparent))
      ) {
        object.visible = false;
        cache.push(object);
      }
    });
  }
}
export class PostPipeline {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    // Multisampled HDR target keeps edges antialiased once rendering leaves the canvas.
    const target = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: 4,
    });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));
    this.ao = new SolidGTAOPass(scene, camera, size.x, size.y);
    this.ao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.4, thickness: 1.2, scale: 1.1 });
    this.ao.blendIntensity = 0.85;
    this.composer.addPass(this.ao);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.5, 0.55, 1.05);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
    this.uniforms = this.grade.uniforms;
  }
  configure({ ao, reducedMotion }) {
    this.ao.enabled = ao;
    this.reducedMotion = reducedMotion;
    this.uniforms.uGrain.value = reducedMotion ? 0 : 0.035;
  }
  setSize(width, height, pixelRatio) {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
  }
  render(dt) {
    this.uniforms.uTime.value += dt;
    if (this.reducedMotion) this.uniforms.uSpeed.value = 0;
    this.composer.render(dt);
  }
}
