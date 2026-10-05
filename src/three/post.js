// Modern-game post-processing: ambient occlusion (GTAO), bloom for the Sun and lights,
// SMAA anti-aliasing, filmic tone mapping, and a subtle camera look (vignette, grain,
// a touch of colour grading). Falls back to a plain render on the Low preset.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

const CameraLook = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    vignette: { value: 0.32 },
    grain: { value: 0.035 },
    tint: { value: new THREE.Vector3(1, 1, 1) },
    contrast: { value: 1.06 },
    saturation: { value: 1.04 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, vignette, grain, contrast, saturation; uniform vec3 tint; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + time * 61.7) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb * tint;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, saturation);
      col = (col - 0.5) * contrast + 0.5;
      vec2 d = vUv - 0.5;
      col *= 1.0 - vignette * smoothstep(0.25, 0.85, length(d * vec2(1.15, 1.0)));
      col += (hash(vUv * 1024.0) - 0.5) * grain;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
    }`,
};

export function createPost(renderer, scene, camera, quality, { worldId = 'mars', bloom = 0.35, bloomThreshold = 0.85 } = {}) {
  if (!quality.post) {
    return {
      render: () => renderer.render(scene, camera),
      setSize: () => {},
      setCamera: (c) => { camera = c; },
      setScene: (sc) => { scene = sc; },
      dispose: () => {},
      look: null,
    };
  }
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(renderer.getPixelRatio());
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  let ao = null;
  if (quality.ao) {
    ao = new GTAOPass(scene, camera, 512, 512, undefined, { radius: 0.6, distanceExponent: 1.4, thickness: 2.2, scale: 1.1, samples: 12, screenSpaceRadius: false }, { lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    ao.blendIntensity = 0.9;
    composer.addPass(ao);
  }
  let bloomPass = null;
  if (quality.bloom) {
    bloomPass = new UnrealBloomPass(new THREE.Vector2(512, 512), bloom, 0.55, bloomThreshold);
    composer.addPass(bloomPass);
  }
  composer.addPass(new OutputPass()); // tone mapping + sRGB
  const look = new ShaderPass(CameraLook);
  if (worldId === 'mars') look.uniforms.tint.value.set(1.02, 0.99, 0.96);
  else if (worldId === 'moon') look.uniforms.tint.value.set(0.98, 0.99, 1.02);
  else look.uniforms.vignette.value = 0.25;
  composer.addPass(look);
  if (quality.smaa) composer.addPass(new SMAAPass());

  let t = 0;
  return {
    composer,
    look,
    bloomPass,
    render(dt = 0.016) {
      t += dt;
      look.uniforms.time.value = t % 100;
      composer.render(dt);
    },
    setSize(w, h) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
      // Bloom is blurry anyway: render it at half resolution (a big saving)
      if (bloomPass) {
        const pr = renderer.getPixelRatio();
        bloomPass.setSize(Math.max(1, Math.round((w * pr) / 2)), Math.max(1, Math.round((h * pr) / 2)));
      }
    },
    // Governor's last resort: switch off the expensive passes
    reduce() {
      if (ao) ao.enabled = false;
      if (bloomPass) bloomPass.enabled = false;
    },
    setScene(sc) {
      renderPass.scene = sc;
      if (ao) ao.scene = sc;
    },
    setCamera(c) {
      camera = c;
      renderPass.camera = c;
      if (ao) ao.camera = c;
    },
    dispose() {
      composer.dispose();
    },
  };
}
