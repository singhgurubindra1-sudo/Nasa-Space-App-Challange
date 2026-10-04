// 3D view of the crew's base on the surface: Jezero Crater (Mars) or the lunar south pole (Moon).
// Everything is generated in code (terrain, rocks, sky, base modules), so it works offline.
// The scene reacts to the game: shielding mound height, greenhouse growth, battery lights,
// dust storms, lunar shadow, alarms, and event animations (flares, micrometeoroids, landers).
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { seeded, canvasTexture, planetTexture, glowTexture } from './solarScene.js';
import { PLANETS } from '../engine/orbits.js';

// ---------- Noise ----------
function makeNoise(seed) {
  const rnd = seeded(seed);
  const perm = new Uint8Array(256).map((_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  const vals = new Float32Array(256).map(() => rnd() * 2 - 1);
  const h = (x, y) => vals[perm[(perm[x & 255] + (y & 255)) & 255]];
  const noise = (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = h(xi, yi);
    const b = h(xi + 1, yi);
    const c = h(xi, yi + 1);
    const d = h(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const fbm = (x, y, oct = 5) => {
    let s = 0;
    let amp = 1;
    let f = 1;
    let norm = 0;
    for (let i = 0; i < oct; i++) {
      s += amp * noise(x * f, y * f);
      norm += amp;
      amp *= 0.5;
      f *= 2.03;
    }
    return s / norm;
  };
  return { noise, fbm };
}

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---------- World looks ----------
const LOOKS = {
  mars: {
    ground: ['#7f3f22', '#b0623a', '#cf8a57'],
    rock: '#a8714f',
    skyTop: '#b98a62',
    skyHorizon: '#e0b083',
    stormColor: '#9c5a32',
    fog: 0.0075,
    sunElev: 34,
    sunAz: 140,
    sunColor: '#ffe6cc',
    sunIntensity: 2.6,
    hemi: ['#e3b07c', '#5c301b', 1.0],
    rocks: 900,
  },
  moon: {
    ground: ['#4f4f4f', '#7d7d7d', '#a6a6a6'],
    rock: '#858585',
    sunElev: 13,
    sunAz: 75,
    sunColor: '#ffffff',
    sunIntensity: 3.6,
    hemi: ['#4a5568', '#1a1a1a', 0.22],
    rocks: 420,
  },
};

// ---------- Terrain ----------
function makeHeightFn(worldId) {
  const { fbm } = makeNoise(worldId === 'mars' ? 17 : 29);
  const rnd = seeded(worldId === 'mars' ? 5 : 9);
  const craters = [];
  if (worldId === 'moon') {
    for (let i = 0; i < 60; i++) {
      const r = 2 + Math.pow(rnd(), 2.2) * 22;
      const a = rnd() * Math.PI * 2;
      const d = 20 + rnd() * 170;
      craters.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, r, depth: r * 0.32, rim: r * 0.1 });
    }
  } else {
    for (let i = 0; i < 12; i++) {
      const r = 2 + rnd() * 8;
      const a = rnd() * Math.PI * 2;
      const d = 25 + rnd() * 120;
      craters.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, r, depth: r * 0.18, rim: r * 0.06 });
    }
  }
  return (x, z) => {
    const d = Math.hypot(x, z);
    let h;
    if (worldId === 'mars') {
      h = fbm(x * 0.018, z * 0.018) * 5 + fbm(x * 0.09, z * 0.09, 3) * 0.7;
      h += Math.sin(x * 0.22 + fbm(x * 0.04, z * 0.04) * 6) * 0.12; // wind ripples
      h += 38 * Math.exp(-((x + 25) ** 2 + (z + 165) ** 2) / (2 * 48 * 48)); // the big hill (like Santa Cruz / Mount Sharp)
      h += smooth(110, 230, d) * (16 + fbm(x * 0.012, z * 0.012) * 14); // Jezero crater rim
    } else {
      h = fbm(x * 0.02, z * 0.02) * 3 + fbm(x * 0.1, z * 0.1, 3) * 0.4;
      h += 30 * Math.exp(-((x - 130) ** 2 + (z + 170) ** 2) / (2 * 55 * 55)); // a south-pole massif
      h += smooth(150, 240, d) * (22 + fbm(x * 0.01, z * 0.01) * 18);
    }
    for (const c of craters) {
      const cd = Math.hypot(x - c.x, z - c.z);
      if (cd < c.r * 1.8) {
        if (cd < c.r) h -= c.depth * (1 - (cd / c.r) ** 2);
        h += c.rim * Math.exp(-(((cd - c.r) / (0.35 * c.r)) ** 2));
      }
    }
    // Flatten the landing site where the base sits.
    const f = smooth(11, 26, d);
    return h * f + (1 - f) * fbm(x * 0.1, z * 0.1, 2) * 0.08;
  };
}

function grainTexture(seed, light) {
  const rnd = seeded(seed);
  const t = canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const v = light ? 205 + rnd() * 50 : 180 + rnd() * 75;
      img.data.set([v, v, v, 255], i * 4);
    }
    ctx.putImageData(img, 0, 0);
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.04 + rnd() * 0.08})`;
      ctx.beginPath();
      ctx.arc(rnd() * w, rnd() * h, 1 + rnd() * 6, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function buildTerrain(worldId, heightAt, look) {
  const SIZE = 520;
  const SEG = 260;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal;
  const { fbm } = makeNoise(worldId === 'mars' ? 3 : 4);
  const [dark, mid, light] = look.ground.map((c) => new THREE.Color(c));
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const n = fbm(x * 0.04, z * 0.04) * 0.5 + 0.5;
    const slope = 1 - nrm.getY(i);
    c.copy(mid).lerp(light, Math.max(0, n - 0.35) * 1.4);
    c.lerp(dark, Math.min(1, slope * 3.2 + (1 - n) * 0.25));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const grain = grainTexture(worldId === 'mars' ? 21 : 22, worldId === 'moon');
  grain.repeat.set(90, 90);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: grain, bumpMap: grain, bumpScale: 1.2, roughness: 1, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

function buildRocks(worldId, heightAt, look, count) {
  const rnd = seeded(worldId === 'mars' ? 77 : 88);
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const p = geo.attributes.position;
  const { noise } = makeNoise(5);
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
    const k = 0.72 + 0.45 * (noise(v.x * 1.7 + 3, v.z * 1.7 + v.y * 2.1) * 0.5 + 0.5);
    v.multiplyScalar(k);
    v.y *= worldId === 'mars' ? 0.62 : 0.7;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: look.rock, roughness: 0.95, metalness: 0, flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const col = new THREE.Color();
  const base = new THREE.Color(look.rock);
  for (let i = 0; i < count; i++) {
    let x;
    let z;
    let d;
    do {
      const a = rnd() * Math.PI * 2;
      d = 9 + Math.pow(rnd(), 1.6) * 150;
      x = Math.cos(a) * d;
      z = Math.sin(a) * d;
    } while (d < 15 && rnd() < 0.85); // keep the base area mostly clear
    const s = (0.08 + Math.pow(rnd(), 3.2) * (worldId === 'mars' ? 1.7 : 1.3)) * (d > 60 ? 1.6 : 1);
    e.set(rnd() * 0.6, rnd() * Math.PI * 2, rnd() * 0.6);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(x, heightAt(x, z) + s * 0.15, z), q, new THREE.Vector3(s * (0.8 + rnd() * 0.6), s, s * (0.8 + rnd() * 0.6)));
    mesh.setMatrixAt(i, m);
    col.copy(base).multiplyScalar(0.75 + rnd() * 0.45);
    mesh.setColorAt(i, col);
  }
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// ---------- Sky ----------
function marsSky(look, sunDir) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(look.skyTop) },
      horizon: { value: new THREE.Color(look.skyHorizon) },
      stormColor: { value: new THREE.Color(look.stormColor) },
      sunDir: { value: sunDir.clone() },
      storm: { value: 0 },
      flash: { value: 0 },
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      varying vec3 vDir; uniform vec3 top, horizon, stormColor, sunDir; uniform float storm, flash;
      void main(){
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 c = mix(horizon, top, pow(h, 0.55));
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        c += vec3(1.0, 0.97, 0.9) * pow(s, 400.0) * 1.4 * (1.0 - storm);
        c += vec3(0.75, 0.8, 0.85) * pow(s, 18.0) * 0.22 * (1.0 - storm); // Mars has bluish light near the Sun
        c = mix(c, stormColor, storm * 0.85);
        c += vec3(1.0, 0.95, 0.8) * flash;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat);
}

function starField(n, seed) {
  const rnd = seeded(seed);
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = rnd() * 0.98 + 0.02;
    const t = rnd() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    pos.set([800 * s * Math.cos(t), 800 * u, 800 * s * Math.sin(t)], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size: 1.5, sizeAttenuation: false, color: 0xdde6ff, fog: false }));
}

// ---------- Base hardware ----------
const M = {
  white: () => new THREE.MeshStandardMaterial({ color: '#e9ecef', roughness: 0.55, metalness: 0.15 }),
  grey: () => new THREE.MeshStandardMaterial({ color: '#8c939c', roughness: 0.6, metalness: 0.4 }),
  dark: () => new THREE.MeshStandardMaterial({ color: '#2a2f36', roughness: 0.7, metalness: 0.3 }),
  panel: () => new THREE.MeshStandardMaterial({ color: '#1d2d5c', roughness: 0.3, metalness: 0.55, emissive: '#050a1a' }),
  gold: () => new THREE.MeshStandardMaterial({ color: '#d6a645', roughness: 0.35, metalness: 0.9 }),
};

function shadowAll(obj) {
  obj.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return obj;
}

function habModule(length, radius) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 32, 1), M.white());
  body.rotation.z = Math.PI / 2;
  g.add(body);
  for (const sx of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.white());
    cap.rotation.z = (-sx * Math.PI) / 2;
    cap.position.x = (sx * length) / 2;
    cap.scale.y = 0.45;
    g.add(cap);
  }
  const ribMat = M.grey();
  for (let i = 0; i <= 4; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.01, 0.05, 8, 40), ribMat);
    rib.rotation.y = Math.PI / 2;
    rib.position.x = -length / 2 + (i / 4) * length;
    g.add(rib);
  }
  const winMat = new THREE.MeshStandardMaterial({ color: '#1b2a3a', emissive: '#ffcf8a', emissiveIntensity: 0.25, roughness: 0.2 });
  for (let i = 0; i < 4; i++) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.05), winMat);
    w.position.set(-length / 2 + 1 + i * ((length - 2) / 3), radius * 0.35, radius * 0.95);
    w.rotation.x = -0.35;
    g.add(w);
  }
  const legMat = M.grey();
  for (const sx of [-0.35, 0.35]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, radius * 1.1, 8), legMat);
      leg.position.set(sx * length, -radius * 0.95, sz * radius * 0.6);
      g.add(leg);
    }
  }
  g.userData.windows = winMat;
  return g;
}

function solarPanelFlat(w, h) {
  const g = new THREE.Group();
  const panel = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, h), M.panel());
  g.add(panel);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.04, h + 0.1), M.grey());
  frame.position.y = -0.03;
  g.add(frame);
  // cell grid lines
  const lines = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({
      map: canvasTexture(128, 128, (ctx) => {
        ctx.strokeStyle = 'rgba(160,190,255,.35)';
        ctx.lineWidth = 2;
        for (let i = 0; i <= 8; i++) {
          ctx.beginPath(); ctx.moveTo(i * 16, 0); ctx.lineTo(i * 16, 128); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, i * 16); ctx.lineTo(128, i * 16); ctx.stroke();
        }
      }),
      transparent: true,
    }),
  );
  lines.rotation.x = -Math.PI / 2;
  lines.position.y = 0.035;
  g.add(lines);
  g.userData.panel = panel.material;
  return g;
}

function rover() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, 1.6), M.white());
  body.position.y = 0.95;
  g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 1.4), new THREE.MeshStandardMaterial({ color: '#203040', roughness: 0.15, metalness: 0.6 }));
  cab.position.set(0.7, 1.6, 0);
  g.add(cab);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 8), M.grey());
  mast.position.set(-0.8, 1.85, 0.5);
  g.add(mast);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.25), M.dark());
  head.position.set(-0.8, 2.45, 0.5);
  g.add(head);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 18);
  const wheelMat = M.dark();
  for (const x of [-0.95, 0, 0.95]) {
    for (const z of [-0.9, 0.9]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.4, z);
      g.add(wheel);
    }
  }
  return shadowAll(g);
}

function astronaut() {
  const g = new THREE.Group();
  const suit = M.white();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.6, 6, 12), suit);
  body.position.y = 0.95;
  g.add(body);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.6, 0.25), suit);
  pack.position.set(0, 1.05, -0.28);
  g.add(pack);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), suit);
  helmet.position.y = 1.65;
  g.add(helmet);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12, -Math.PI / 2.6, Math.PI / 1.3, Math.PI / 3, Math.PI / 3), M.gold());
  visor.position.set(0, 1.65, 0.06);
  g.add(visor);
  for (const sx of [-0.13, 0.13]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.45, 4, 8), suit);
    leg.position.set(sx, 0.35, 0);
    g.add(leg);
  }
  return shadowAll(g);
}

function lander(tall) {
  const g = new THREE.Group();
  const h = tall ? 15 : 6;
  const r = tall ? 1.7 : 1.6;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 32), M.white());
  body.position.y = h / 2 + 1.2;
  g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(r, tall ? 4 : 1.6, 32), M.white());
  nose.position.y = h + 1.2 + (tall ? 2 : 0.8);
  g.add(nose);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.01, r * 1.01, 0.5, 32), M.dark());
  band.position.y = 3;
  g.add(band);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 3, 8), M.grey());
    leg.position.set(Math.cos(a) * r * 1.2, 1.2, Math.sin(a) * r * 1.2);
    leg.rotation.z = Math.cos(a) * 0.35;
    leg.rotation.x = -Math.sin(a) * 0.35;
    g.add(leg);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 12), M.grey());
    foot.position.set(Math.cos(a) * r * 1.75, 0.05, Math.sin(a) * r * 1.75);
    g.add(foot);
  }
  return shadowAll(g);
}

// ---------- Scene ----------
export function createBaseScene({ canvas, worldId, reducedMotion, onContextLost }) {
  const look = LOOKS[worldId];
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
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

  const heightAt = makeHeightFn(worldId);
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - look.sunElev), THREE.MathUtils.degToRad(look.sunAz));

  // Sky, fog, lights
  let sky = null;
  if (worldId === 'mars') {
    sky = marsSky(look, sunDir);
    scene.add(sky);
    scene.fog = new THREE.FogExp2(new THREE.Color(look.skyHorizon), look.fog);
  } else {
    scene.background = new THREE.Color('#000000');
    scene.add(starField(2200, 13));
    // Earth hangs low over the horizon, as seen from the lunar south pole.
    const earthData = PLANETS.find((p) => p.id === 'earth');
    const earth = new THREE.Mesh(new THREE.SphereGeometry(11, 48, 32), new THREE.MeshStandardMaterial({ map: planetTexture(earthData, 103), roughness: 0.8, fog: false }));
    earth.position.setFromSphericalCoords(600, THREE.MathUtils.degToRad(84), THREE.MathUtils.degToRad(222));
    scene.add(earth);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(140,190,255,0)', 'rgba(110,170,255,.35)'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    glow.position.copy(earth.position);
    glow.scale.set(40, 40, 1);
    scene.add(glow);
    const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,255,1)', 'rgba(255,240,210,.5)'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    sunGlow.position.copy(sunDir).multiplyScalar(700);
    sunGlow.scale.set(60, 60, 1);
    scene.add(sunGlow);
    // Earthshine: faint bluish fill from Earth's direction
    const earthshine = new THREE.DirectionalLight('#9fb8ff', 0.35);
    earthshine.position.copy(earth.position).normalize().multiplyScalar(100);
    scene.add(earthshine);
  }
  const hemi = new THREE.HemisphereLight(look.hemi[0], look.hemi[1], look.hemi[2]);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(look.sunColor, look.sunIntensity);
  sun.position.copy(sunDir).multiplyScalar(120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  const sc = sun.shadow.camera;
  sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55; sc.near = 10; sc.far = 320;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  scene.add(sun.target);

  scene.add(buildTerrain(worldId, heightAt, look));
  scene.add(buildRocks(worldId, heightAt, look, look.rocks));

  // ---------- The base ----------
  const base = new THREE.Group();
  scene.add(base);
  const labels = {}; // id -> Object3D whose position we track for HTML labels
  const ground = (x, z) => heightAt(x, z);

  // Habitat: living module + node + lab module
  const habA = habModule(7, 1.7);
  habA.position.set(-2.5, ground(-2.5, 0) + 1.9, 0);
  const habB = habModule(5.5, 1.5);
  habB.rotation.y = Math.PI / 2;
  habB.position.set(3, ground(3, 4) + 1.8, 4.2);
  const node = new THREE.Mesh(new THREE.SphereGeometry(1.9, 32, 20), M.white());
  node.position.set(3, ground(3, 0) + 1.9, 0);
  const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.6, 20), M.grey());
  hatch.rotation.z = Math.PI / 2;
  hatch.position.set(5.2, ground(5, 0) + 1.5, 0);
  base.add(shadowAll(habA), shadowAll(habB), shadowAll(node), shadowAll(hatch));
  labels.hab = node;
  const windows = [habA.userData.windows, habB.userData.windows];

  // Alarm beacon on top of the node
  const beaconMat = new THREE.MeshStandardMaterial({ color: '#550000', emissive: '#ff2020', emissiveIntensity: 0.2 });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), beaconMat);
  beacon.position.set(3, node.position.y + 2, 0);
  base.add(beacon);
  const alarmLight = new THREE.PointLight('#ff3030', 0, 18, 1.5);
  alarmLight.position.copy(beacon.position);
  base.add(alarmLight);

  // Regolith shielding mound over the living module (grows with shielding %)
  const regolithMat = new THREE.MeshStandardMaterial({ color: look.ground[1], roughness: 1, map: grainTexture(31, worldId === 'moon'), bumpScale: 1 });
  regolithMat.map.repeat.set(6, 6);
  regolithMat.bumpMap = regolithMat.map;
  const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), regolithMat);
  mound.position.set(-2.5, ground(-2.5, 0) - 0.05, 0);
  mound.scale.set(5.4, 0.05, 2.9);
  mound.castShadow = true;
  mound.receiveShadow = true;
  base.add(mound);
  const shieldAnchor = new THREE.Object3D();
  shieldAnchor.position.set(-6.5, ground(-6.5, 0) + 1.2, 0);
  base.add(shieldAnchor);
  labels.shield = shieldAnchor;

  // Greenhouse dome with plants and pink grow lights
  const ghPos = new THREE.Vector3(-8, ground(-8, 8), 8);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#d8f0ff', transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.2, depthWrite: false, side: THREE.DoubleSide }),
  );
  dome.position.copy(ghPos);
  const domeFrame = new THREE.Mesh(new THREE.SphereGeometry(3.22, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#c9d4de', wireframe: true }));
  domeFrame.position.copy(ghPos);
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(3.25, 3.3, 0.25, 40), M.grey());
  floor.position.copy(ghPos).add(new THREE.Vector3(0, 0.05, 0));
  floor.receiveShadow = true;
  base.add(floor, dome, domeFrame);
  const plantGeo = new THREE.ConeGeometry(0.22, 0.8, 7);
  plantGeo.translate(0, 0.4, 0);
  const plants = new THREE.InstancedMesh(plantGeo, new THREE.MeshStandardMaterial({ color: '#3fa34d', roughness: 0.8, emissive: '#0c2a10' }), 48);
  const plantSpots = [];
  {
    const rnd = seeded(61);
    for (let i = 0; i < 48; i++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * 2.5;
      plantSpots.push([ghPos.x + Math.cos(a) * r, ghPos.y + 0.18, ghPos.z + Math.sin(a) * r, 0.7 + rnd() * 0.6]);
    }
  }
  base.add(plants);
  const growLight = new THREE.PointLight('#ff6fd8', 0, 9, 1.4);
  growLight.position.copy(ghPos).add(new THREE.Vector3(0, 2.2, 0));
  base.add(growLight);
  labels.greenhouse = floor;

  // Solar power: flat array field on Mars; tall sun-tracking vertical arrays on the Moon (like NASA's VSAT concept)
  const solarGroup = new THREE.Group();
  const panelMats = [];
  if (worldId === 'mars') {
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const p = solarPanelFlat(3.2, 2);
        const x = 15 + i * 3.6;
        const z = -12 + j * 2.8;
        p.position.set(x, ground(x, z) + 1.1, z);
        p.rotation.y = -THREE.MathUtils.degToRad(look.sunAz) + Math.PI / 2;
        p.rotateX(0.35);
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 6), M.grey());
        post.position.set(x, ground(x, z) + 0.55, z);
        solarGroup.add(shadowAll(p), post);
        panelMats.push(p.userData.panel);
      }
    }
    labels.solar = solarGroup.children[10];
  } else {
    for (let i = 0; i < 3; i++) {
      const x = 14 + i * 5;
      const z = -14 + i * 2;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 11, 10), M.grey());
      mast.position.set(x, ground(x, z) + 5.5, z);
      const p = solarPanelFlat(2.6, 8);
      p.rotation.x = Math.PI / 2;
      const holder = new THREE.Group();
      holder.add(p);
      holder.position.set(x, ground(x, z) + 6.5, z);
      holder.lookAt(holder.position.clone().add(new THREE.Vector3(sunDir.x, 0, sunDir.z)));
      solarGroup.add(shadowAll(mast), shadowAll(holder));
      panelMats.push(p.userData.panel);
    }
    labels.solar = solarGroup.children[3];
  }
  base.add(solarGroup);

  // Fission reactor (Moon base has one), placed away from the hab behind a berm, as NASA plans
  if (worldId === 'moon') {
    const r = new THREE.Group();
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 3.2, 20), M.grey());
    core.position.y = 1.6;
    r.add(core);
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1, 20), M.grey());
    top.position.y = 3.7;
    r.add(top);
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.6, 2.6), M.white());
      const a = (i / 4) * Math.PI * 2;
      fin.position.set(Math.cos(a) * 2.1, 2.6, Math.sin(a) * 2.1);
      fin.rotation.y = -a;
      r.add(fin);
    }
    r.position.set(-30, ground(-30, -26), -26);
    base.add(shadowAll(r));
    const berm = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), regolithMat);
    berm.scale.set(7, 1.6, 1.4);
    berm.position.set(-25, ground(-25, -21), -21);
    berm.rotation.y = 0.75;
    berm.castShadow = berm.receiveShadow = true;
    base.add(berm);
    labels.reactor = core;
  }

  // Battery bank with an LED strip that shows charge
  const battery = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.2, 1.2), M.dark());
  battery.position.set(8.5, ground(8.5, -3) + 0.6, -3);
  const ledMat = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#22c55e', emissiveIntensity: 2 });
  const led = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.05), ledMat);
  led.position.set(8.5, battery.position.y + 0.25, -2.38);
  base.add(shadowAll(battery), led);
  labels.battery = battery;

  // Antenna dish pointing at Earth
  const dishG = new THREE.Group();
  const dmast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4, 8), M.grey());
  dmast.position.y = 2;
  const dish = new THREE.Mesh(new THREE.SphereGeometry(1.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 3.2), M.white());
  dish.material.side = THREE.DoubleSide;
  dish.position.y = 4.3;
  dish.rotation.x = worldId === 'moon' ? -1.35 : -0.6;
  dishG.add(dmast, dish);
  dishG.position.set(-6, ground(-6, -6), -6);
  dishG.rotation.y = worldId === 'moon' ? -0.6 : 0.4;
  base.add(shadowAll(dishG));

  // Lander parked away from the base
  const parked = lander(worldId === 'moon');
  parked.position.set(32, ground(32, 22), 22);
  base.add(parked);
  labels.lander = parked.children[0];

  // Rover + astronauts (they move a little)
  const rov = rover();
  base.add(rov);
  labels.rover = rov;
  const crew = [astronaut(), astronaut()];
  crew.forEach((a) => base.add(a));

  // Window / flood lights for the night
  const flood = new THREE.PointLight('#ffd9a0', 0, 30, 1.2);
  flood.position.set(0, 7, 6);
  base.add(flood);

  // Dust particles (Mars)
  let dust = null;
  if (worldId === 'mars') {
    const n = 1800;
    const pos = new Float32Array(n * 3);
    const rnd = seeded(91);
    for (let i = 0; i < n; i++) pos.set([(rnd() - 0.5) * 120, rnd() * 18, (rnd() - 0.5) * 120], i * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    dust = new THREE.Points(g, new THREE.PointsMaterial({ color: '#d79b66', size: 0.18, transparent: true, opacity: 0.25, depthWrite: false }));
    scene.add(dust);
  }

  // Event props: meteor streak, impact flash, cargo lander
  const meteor = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff3c4' }));
  const meteorTrail = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,250,220,1)', 'rgba(255,170,80,.6)'), blending: THREE.AdditiveBlending, depthWrite: false }));
  meteorTrail.scale.set(3, 3, 1);
  meteor.add(meteorTrail);
  meteor.visible = false;
  scene.add(meteor);
  const impactLight = new THREE.PointLight('#ffd27a', 0, 25, 1.5);
  scene.add(impactLight);
  const cargo = lander(false);
  cargo.scale.setScalar(0.7);
  cargo.visible = false;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.rotation.x = Math.PI;
  flame.position.y = -0.8;
  cargo.add(flame);
  const flameLight = new THREE.PointLight('#ff9a3c', 0, 30, 1.5);
  cargo.add(flameLight);
  const cargoSpot = new THREE.Vector3(-18, ground(-18, 18), 18);
  scene.add(cargo);

  // ---------- Game-driven state ----------
  const target = { storm: 0, dark: 0, cold: 0, shield: 0, maturity: 0, battery: 0.5, ghPower: 8, lsFrac: 1, alarm: false };
  const cur = { ...target, flash: 0 };
  let event = null; // { id, t }
  let disposed = false;
  let last = performance.now();
  let elapsed = 0;
  const tmpM = new THREE.Matrix4();
  const tmpV = new THREE.Vector3();
  const lerp = (a, b, k) => a + (b - a) * k;

  function applyPlants() {
    const grow = 0.15 + cur.maturity * 1.1;
    plantSpots.forEach(([x, y, z, s], i) => {
      tmpM.makeScale(s * (0.6 + cur.maturity * 0.6), s * grow, s * (0.6 + cur.maturity * 0.6));
      tmpM.setPosition(x, y, z);
      plants.setMatrixAt(i, tmpM);
    });
    plants.instanceMatrix.needsUpdate = true;
  }

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
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    elapsed += dt;
    const k = 1 - Math.exp(-dt * 1.5);

    for (const key of ['storm', 'dark', 'cold', 'shield', 'maturity', 'battery', 'ghPower', 'lsFrac']) cur[key] = lerp(cur[key], target[key], k);

    // Event animations
    let flashTarget = 0;
    if (event) {
      event.t += dt;
      const t = event.t;
      if (event.id === 'solar_flare') {
        flashTarget = t < 4 ? 0.35 * Math.max(0, Math.sin(t * 6)) * (1 - t / 4) : 0;
        if (t > 4.5) event = null;
      } else if (event.id === 'micrometeoroid') {
        const start = new THREE.Vector3(60, 70, -40);
        const hit = new THREE.Vector3(-1, ground(-1, 1.5) + 0.3, 1.5);
        if (t < 0.9) {
          meteor.visible = true;
          meteor.position.lerpVectors(start, hit, t / 0.9);
        } else {
          meteor.visible = false;
          impactLight.position.copy(hit).add(new THREE.Vector3(0, 1, 0));
          impactLight.intensity = Math.max(0, 60 * (1 - (t - 0.9) / 0.8));
          if (t > 2) event = null;
        }
      } else if (event.id === 'supply_lander') {
        cargo.visible = true;
        const dur = 6;
        const p = Math.min(1, t / dur);
        const ease = 1 - Math.pow(1 - p, 2.2);
        cargo.position.set(cargoSpot.x, cargoSpot.y + 45 * (1 - ease), cargoSpot.z);
        flame.visible = p < 1;
        flame.scale.y = 0.8 + Math.random() * 0.4;
        flameLight.intensity = p < 1 ? 40 : 0;
        if (t > dur + 0.5) event = null;
      } else {
        event = null;
      }
    }
    cur.flash = lerp(cur.flash, flashTarget, 1 - Math.exp(-dt * 12));

    // Lighting from conditions
    const dayFactor = 1 - cur.dark * 0.97;
    const stormDim = 1 - cur.storm * 0.65;
    sun.intensity = look.sunIntensity * dayFactor * stormDim;
    hemi.intensity = look.hemi[2] * (1 - cur.dark * 0.6) * (1 + cur.storm * 0.2);
    if (cur.cold > 0.01) hemi.color.set(look.hemi[0]).lerp(new THREE.Color('#9ec3ff'), cur.cold * 0.4);
    else hemi.color.set(look.hemi[0]);
    renderer.toneMappingExposure = 1 + cur.flash * 2.5;
    if (sky) {
      sky.material.uniforms.storm.value = cur.storm;
      sky.material.uniforms.flash.value = cur.flash;
      scene.fog.density = look.fog + cur.storm * 0.045;
      scene.fog.color.set(look.skyHorizon).lerp(new THREE.Color(look.stormColor), cur.storm * 0.85);
    } else {
      scene.background.setRGB(cur.flash * 0.8, cur.flash * 0.7, cur.flash * 0.4);
    }
    const night = Math.max(cur.dark, cur.storm * 0.6);
    flood.intensity = night * 55;
    windows.forEach((w) => { w.emissiveIntensity = 0.15 + cur.lsFrac * (0.25 + night * 1.6); });
    growLight.intensity = (cur.ghPower / 12) * 16;

    // Dust on the panels during storms, frost in the cold
    panelMats.forEach((m) => {
      m.color.set('#1d2d5c').lerp(new THREE.Color('#9c6a45'), cur.storm * 0.55).lerp(new THREE.Color('#dde8f5'), cur.cold * 0.3);
    });

    // Shield mound and greenhouse
    mound.scale.y = 0.05 + (cur.shield / 100) * 4.1;
    applyPlants();

    // Battery LED colour
    const b = cur.battery;
    ledMat.emissive.set(b > 0.5 ? '#22c55e' : b > 0.2 ? '#facc15' : '#ef4444');
    led.scale.x = Math.max(0.05, b);
    led.position.x = 8.5 - (1 - Math.max(0.05, b)) * 1.1;

    // Alarm beacon
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 7);
    beaconMat.emissiveIntensity = target.alarm ? 1 + pulse * 4 : 0.2 + 0.3 * (Math.sin(elapsed * 2) > 0.95 ? 1 : 0);
    alarmLight.intensity = target.alarm ? pulse * 30 : 0;

    // Dust motion
    if (dust) {
      const p = dust.geometry.attributes.position;
      const speed = 2 + cur.storm * 26;
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i) + speed * dt;
        if (x > 60) x -= 120;
        p.setX(i, x);
        p.setY(i, p.getY(i) + Math.sin(elapsed + i) * dt * 0.3);
      }
      p.needsUpdate = true;
      dust.material.opacity = 0.18 + cur.storm * 0.6;
      dust.material.size = 0.15 + cur.storm * 0.25;
    }

    // Rover drives a slow loop; crew walks between hab and rover
    const ra = elapsed * 0.05;
    const rx = Math.cos(ra) * 17;
    const rz = Math.sin(ra) * 17 + 2;
    rov.position.set(rx, ground(rx, rz), rz);
    rov.rotation.y = -ra - Math.PI;
    crew.forEach((a, i) => {
      const t = elapsed * 0.25 + i * 2.2;
      const x = 7 + Math.sin(t) * 3 + i * 1.2;
      const z = 6 + Math.cos(t * 0.7) * 2;
      a.position.set(x, ground(x, z) + Math.abs(Math.sin(t * 6)) * 0.08, z);
      a.rotation.y = Math.atan2(Math.cos(t), -Math.sin(t) * 0.7);
    });

    controls.update();
    renderer.render(scene, camera);

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
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // Pull back on portrait screens so the base fits.
    controls.maxDistance = camera.aspect < 0.9 ? 110 : 85;
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();
  if (camera.aspect < 0.9) camera.position.set(25, 10, 31);
  applyPlants();
  renderer.setAnimationLoop(frame);

  return {
    labelIds: Object.keys(labels),
    update(s) {
      Object.assign(target, s);
    },
    playEvent(id) {
      event = { id, t: 0 };
      if (id === 'supply_lander') cargo.visible = true;
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
      renderer.dispose();
    },
  };
}
