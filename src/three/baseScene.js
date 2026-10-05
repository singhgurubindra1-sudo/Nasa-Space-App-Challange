// 3D view of the crew's base on the surface, with an orbiting camera.
// The world itself (terrain, sky, base hardware, status visuals) comes from world.js.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildWorld } from './world.js';
import { createPost } from './post.js';
import { getQuality } from './quality.js';
import { createGovernor } from './perf.js';

export function createBaseScene({ canvas, worldId, reducedMotion, onContextLost }) {
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !getQuality().post, powerPreference: 'high-performance' });
  const quality = getQuality();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false; // the Sun doesn't move: refresh shadows every few frames only
  const onLost = (e) => {
    e.preventDefault();
    if (onContextLost) onContextLost();
  };
  canvas.addEventListener('webglcontextlost', onLost);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 2500);
  camera.position.set(17, 6.5, 20);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(1, 1.6, 2);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.minDistance = 9;
  controls.maxDistance = 85;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.autoRotate = !reducedMotion;
  controls.autoRotateSpeed = 0.25;
  const stopAuto = () => { controls.autoRotate = false; };
  controls.addEventListener('start', stopAuto);

  const world = buildWorld(scene, worldId, { renderer, quality, small });
  const { labels, target } = world;
  const post = createPost(renderer, scene, camera, quality, { worldId, bloom: worldId === 'moon' ? 0.45 : 0.3 });
  let disposed = false;
  let last = performance.now();
  let elapsed = 0;
  let frameNo = 0;
  const tmpV = new THREE.Vector3();

  // Don't spend battery drawing the scene while it's scrolled out of view.
  let onScreen = true;
  const io = new IntersectionObserver((entries) => {
    onScreen = entries[0].isIntersecting;
  });
  io.observe(canvas);

  function frame() {
    if (disposed) return;
    if (!onScreen) {
      last = performance.now();
      return;
    }
    const now = performance.now();
    // The base view is a backdrop: cap its frame rate to save the GPU (and phone batteries)
    if (now - last < 1000 / quality.baseFps - 2) return;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    elapsed += dt;
    world.tick(dt, elapsed);
    if (frameNo++ % quality.shadowEvery === 0) renderer.shadowMap.needsUpdate = true;

    controls.update();
    post.render(dt);
    governor.tick(dt);

    if (labelCb) {
      const rect = canvas.getBoundingClientRect();
      const out = {};
      for (const id in labels) {
        labels[id].getWorldPosition(tmpV);
        tmpV.y += id === 'hab' ? 2.6 : id === 'shield' ? 0.6 : id === 'solar' ? 2 : id === 'reactor' ? 3.5 : id === 'lander' ? (worldId === 'moon' ? 12 : 6) : 1.6;
        tmpV.project(camera);
        out[id] = { x: ((tmpV.x + 1) / 2) * rect.width, y: ((1 - tmpV.y) / 2) * rect.height, visible: tmpV.z < 1 && Math.abs(tmpV.x) < 1.05 && Math.abs(tmpV.y) < 1.05 };
      }
      labelCb(out);
    }
  }
  let labelCb = null;

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    post.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // Pull back on portrait screens so the base fits.
    controls.maxDistance = camera.aspect < 0.9 ? 110 : 85;
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();
  if (camera.aspect < 0.9) camera.position.set(25, 10, 31);
  const governor = createGovernor({ renderer, post, quality, onResize: resize, target: Math.min(quality.baseFps, 45) * 0.95 });
  renderer.setAnimationLoop(frame);

  return {
    labelIds: Object.keys(labels),
    update(s) {
      Object.assign(target, s);
    },
    playEvent(id) {
      world.playEvent(id);
    },
    onLabels(cb) {
      labelCb = cb;
    },
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener('webglcontextlost', onLost);
      controls.removeEventListener('start', stopAuto);
      controls.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => {
            for (const key of ['map', 'bumpMap']) if (m[key]) m[key].dispose();
            m.dispose();
          });
        }
      });
      post.dispose();
      renderer.dispose();
    },
  };
}
