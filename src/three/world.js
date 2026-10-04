// The surface world shared by the 3D base view and the first-person mode: Jezero Crater (Mars) or the lunar south pole (Moon).
// Everything is generated in code (terrain, rocks, sky, base modules), so it works offline.
// The scene reacts to the game: shielding mound height, greenhouse growth, battery lights,
// dust storms, lunar shadow, alarms, and event animations (flares, micrometeoroids, landers).
import * as THREE from 'three';
import { seeded, canvasTexture, planetTexture, glowTexture } from './solarScene.js';
import { PLANETS } from '../engine/orbits.js';
import { createAstronaut, animateAstronaut } from './astronaut.js';

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
  const big = [];
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
    if (s > 0.7) big.push({ x, z, r: s * 1.1 });
    col.copy(base).multiplyScalar(0.75 + rnd() * 0.45);
    mesh.setColorAt(i, col);
  }
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.big = big;
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


// ---------- World ----------
// Builds sky, terrain, rocks and the base into `scene`. Returns handles plus tick(dt, elapsed)
// which animates lighting, the base status visuals and event effects.
export function buildWorld(scene, worldId, { renderer, small }) {
  const look = LOOKS[worldId];
  const gravity = worldId === 'moon' ? 1.62 : 3.71;
  let autoRover = true;
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
  const rocks = buildRocks(worldId, heightAt, look, look.rocks);
  scene.add(rocks);

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

  // Greenhouse: a walk-in dome with plant racks, LED grow bars and a control console
  const GH_R = 4.6;
  const ghPos = new THREE.Vector3(-9, ground(-9, 9), 9);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(GH_R, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#d8f0ff', transparent: true, opacity: 0.2, roughness: 0.05, metalness: 0.2, depthWrite: false, side: THREE.DoubleSide }),
  );
  dome.position.copy(ghPos);
  const domeFrame = new THREE.Mesh(new THREE.SphereGeometry(GH_R + 0.02, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#c9d4de', wireframe: true }));
  domeFrame.position.copy(ghPos);
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(GH_R + 0.05, GH_R + 0.1, 0.25, 48), M.grey());
  floor.position.copy(ghPos).add(new THREE.Vector3(0, 0.05, 0));
  floor.receiveShadow = true;
  base.add(floor, dome, domeFrame);
  // Door frame facing the habitat (east)
  const door = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.12, 8, 20, Math.PI), M.grey());
  door.position.set(ghPos.x + GH_R - 0.05, ghPos.y + 0.1, ghPos.z);
  door.rotation.y = Math.PI / 2;
  base.add(door);
  // Racks: 3 racks x 2 shelves x 8 plants
  const plantSpots = [];
  const rackMat = M.white();
  const ledBarMat = new THREE.MeshStandardMaterial({ color: '#330022', emissive: '#ff4fd8', emissiveIntensity: 1.5 });
  for (let r = 0; r < 3; r++) {
    const z = ghPos.z - 2.2 + r * 2.2;
    const rack = new THREE.Group();
    for (const y of [0.55, 1.35]) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.08, 0.7), rackMat);
      shelf.position.set(0, y, 0);
      rack.add(shelf);
      const tray = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.12, 0.6), new THREE.MeshStandardMaterial({ color: '#3b2a1e', roughness: 1 }));
      tray.position.set(0, y + 0.1, 0);
      rack.add(tray);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.04, 0.12), ledBarMat);
      bar.position.set(0, y + 0.72, 0);
      rack.add(bar);
      for (let i = 0; i < 8; i++) plantSpots.push([ghPos.x - 2 + i * 0.57 - 0.6, ghPos.y + y + 0.16, z, 0.8 + ((i * 7 + r * 3) % 5) * 0.08]);
    }
    for (const x of [-2.25, 2.25]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.2, 0.06), M.grey());
      post.position.set(x, 1.1, 0.32);
      rack.add(post);
      const post2 = post.clone();
      post2.position.z = -0.32;
      rack.add(post2);
    }
    rack.position.set(ghPos.x - 0.6, ghPos.y, z);
    base.add(shadowAll(rack));
  }
  // Two plant shapes: leafy bush (lettuce, potato, soy, mixed) and grass blades (wheat)
  const bushGeo = new THREE.IcosahedronGeometry(0.2, 1);
  bushGeo.scale(1.2, 0.8, 1.2);
  bushGeo.translate(0, 0.16, 0);
  const bladeGeo = new THREE.ConeGeometry(0.07, 0.75, 5);
  bladeGeo.translate(0, 0.37, 0);
  const plantMat = new THREE.MeshStandardMaterial({ color: '#3fa34d', roughness: 0.8, emissive: '#0c2a10', flatShading: true });
  const bushes = new THREE.InstancedMesh(bushGeo, plantMat, plantSpots.length);
  const blades = new THREE.InstancedMesh(bladeGeo, plantMat, plantSpots.length * 3);
  base.add(bushes, blades);
  const plants = bushes; // legacy name used below
  const growLight = new THREE.PointLight('#ff6fd8', 0, 11, 1.3);
  growLight.position.copy(ghPos).add(new THREE.Vector3(0, 3, 0));
  base.add(growLight);
  // Control console inside the door
  const consoleG = new THREE.Group();
  const ped = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.0, 0.4), M.white());
  ped.position.y = 0.5;
  consoleG.add(ped);
  const screenMat = new THREE.MeshStandardMaterial({
    color: '#05111d',
    emissive: '#ffffff',
    emissiveIntensity: 0.9,
    emissiveMap: canvasTexture(256, 160, (ctx, w, h) => {
      ctx.fillStyle = '#04121f';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('GREENHOUSE', 20, 40);
      ctx.fillText('CONTROL', 20, 68);
      ctx.fillStyle = '#ff6fd8';
      ctx.fillRect(20, 92, 150, 12);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(20, 116, 100, 12);
      ctx.strokeStyle = '#94a3b8';
      ctx.strokeRect(4, 4, w - 8, h - 8);
    }),
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.4), screenMat);
  screen.position.set(0, 1.15, 0.05);
  screen.rotation.x = -0.5;
  consoleG.add(screen);
  consoleG.position.set(ghPos.x + 3.2, ghPos.y, ghPos.z + 1.4);
  consoleG.rotation.y = -Math.PI / 2 - 0.5;
  base.add(shadowAll(consoleG));
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
  const crew = [createAstronaut({ commander: false }), createAstronaut({ commander: false })];
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

  const target = { storm: 0, dark: 0, cold: 0, shield: 0, maturity: 0, battery: 0.5, ghPower: 8, lsFrac: 1, alarm: false, crop: 'mixed' };
  const cur = { ...target, flash: 0 };
  const ev = { current: null }; // running event animation { id, t }
  const tmpM = new THREE.Matrix4();
  const tmpV = new THREE.Vector3();
  const lerp = (a, b, k) => a + (b - a) * k;

  const CROP_LOOK = {
    mixed: { color: '#3fa34d', blades: false, sx: 1, sy: 1 },
    lettuce: { color: '#8b2f45', blades: false, sx: 1.25, sy: 0.7 },
    potato: { color: '#3c8a3a', blades: false, sx: 1.1, sy: 1.25 },
    soybean: { color: '#5aa83e', blades: false, sx: 0.95, sy: 1.1 },
    wheat: { color: '#b7b04a', blades: true, sx: 1, sy: 1 },
  };
  function applyPlants() {
    const lookC = CROP_LOOK[target.crop] || CROP_LOOK.mixed;
    plantMat.color.set(lookC.color);
    const g = 0.15 + cur.maturity * 1.0;
    bushes.visible = !lookC.blades;
    blades.visible = lookC.blades;
    plantSpots.forEach(([x, y, z, sc], i) => {
      if (!lookC.blades) {
        tmpM.makeScale(sc * lookC.sx * (0.4 + cur.maturity * 0.8), sc * lookC.sy * g, sc * lookC.sx * (0.4 + cur.maturity * 0.8));
        tmpM.setPosition(x, y, z);
        bushes.setMatrixAt(i, tmpM);
      } else {
        for (let j = 0; j < 3; j++) {
          tmpM.makeScale(sc, sc * g * (0.8 + j * 0.15), sc);
          tmpM.setPosition(x + (j - 1) * 0.12, y, z + ((j * 5) % 3 - 1) * 0.1);
          blades.setMatrixAt(i * 3 + j, tmpM);
        }
      }
    });
    bushes.instanceMatrix.needsUpdate = true;
    blades.instanceMatrix.needsUpdate = true;
  }

  function tick(dt, elapsed) {
    const k = 1 - Math.exp(-dt * 1.5);
    for (const key of ['storm', 'dark', 'cold', 'shield', 'maturity', 'battery', 'ghPower', 'lsFrac']) cur[key] = lerp(cur[key], target[key], k);

    // Event animations
    let flashTarget = 0;
    if (ev.current) {
      ev.current.t += dt;
      const t = ev.current.t;
      if (ev.current.id === 'solar_flare') {
        flashTarget = t < 4 ? 0.35 * Math.max(0, Math.sin(t * 6)) * (1 - t / 4) : 0;
        if (t > 4.5) ev.current = null;
      } else if (ev.current.id === 'micrometeoroid') {
        const start = new THREE.Vector3(60, 70, -40);
        const hit = new THREE.Vector3(-1, ground(-1, 1.5) + 0.3, 1.5);
        if (t < 0.9) {
          meteor.visible = true;
          meteor.position.lerpVectors(start, hit, t / 0.9);
        } else {
          meteor.visible = false;
          impactLight.position.copy(hit).add(new THREE.Vector3(0, 1, 0));
          impactLight.intensity = Math.max(0, 60 * (1 - (t - 0.9) / 0.8));
          if (t > 2) ev.current = null;
        }
      } else if (ev.current.id === 'supply_lander') {
        cargo.visible = true;
        const dur = 6;
        const p = Math.min(1, t / dur);
        const ease = 1 - Math.pow(1 - p, 2.2);
        cargo.position.set(cargoSpot.x, cargoSpot.y + 45 * (1 - ease), cargoSpot.z);
        flame.visible = p < 1;
        flame.scale.y = 0.8 + Math.random() * 0.4;
        flameLight.intensity = p < 1 ? 40 : 0;
        if (t > dur + 0.5) ev.current = null;
      } else {
        ev.current = null;
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
    ledBarMat.emissiveIntensity = 0.2 + (cur.ghPower / 12) * 2.2;

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

    // Rover drives a slow loop (unless the player is driving); crew walks between hab and rover
    if (autoRover) {
    const ra = elapsed * 0.05;
    const rx = Math.cos(ra) * 17;
    const rz = Math.sin(ra) * 17 + 2;
    rov.position.set(rx, ground(rx, rz), rz);
    rov.rotation.y = -ra - Math.PI;
    }
    crew.forEach((a, i) => {
      const t = elapsed * 0.25 + i * 2.2;
      const x = 7 + Math.sin(t) * 3 + i * 1.2;
      const z = 6 + Math.cos(t * 0.7) * 2;
      a.position.set(x, ground(x, z) + Math.abs(Math.sin(t * 6)) * 0.08, z);
      a.rotation.y = Math.atan2(Math.cos(t) * 3, -Math.sin(t * 0.7) * 1.4);
      animateAstronaut(a, elapsed + i, 0.9, gravity);
    });
  }

  // ---------- Walkable-world data for first-person mode ----------
  const colliders = [];
  for (let x = -5.5; x <= 1.01; x += 1.3) colliders.push({ x, z: 0, r: 1.85 });
  colliders.push({ x: 3, z: 0, r: 2.0 }, { x: 5.2, z: 0, r: 0.9 });
  for (let z = 1.8; z <= 7.01; z += 1.3) colliders.push({ x: 3, z, r: 1.6 });
  colliders.push({ x: 8.5, z: -3, r: 1.5 }, { x: -6, z: -6, r: 0.45 }, { x: 32, z: 22, r: worldId === 'moon' ? 2.4 : 2.2 });
  if (worldId === 'mars') {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) colliders.push({ x: 15 + i * 3.6, z: -12 + j * 2.8, r: 1.3 });
  } else {
    for (let i = 0; i < 3; i++) colliders.push({ x: 14 + i * 5, z: -14 + i * 2, r: 0.5 });
    colliders.push({ x: -30, z: -26, r: 2.8 }, { x: -29, z: -18, r: 1.6 }, { x: -25, z: -21, r: 1.6 }, { x: -21, z: -24, r: 1.6 });
  }
  for (let r = 0; r < 3; r++) colliders.push({ x: ghPos.x - 0.6, z: ghPos.z - 2.2 + r * 2.2, r: 0.45, w: 2.4 }); // racks (capsules along x)
  colliders.push(...rocks.userData.big);
  const ghWall = { x: ghPos.x, z: ghPos.z, r: GH_R, doorAngle: 0, doorHalf: 0.3 };
  const interactables = [
    { id: 'airlock', label: 'Recharge suit at the airlock', x: 6.2, z: 0, r: 2.6 },
    { id: 'greenhouse', label: 'Open greenhouse controls', x: consoleG.position.x, z: consoleG.position.z, r: 1.9 },
    { id: 'solar', label: 'Inspect the solar array', x: worldId === 'mars' ? 20 : 19, z: worldId === 'mars' ? -8 : -12, r: 7 },
    { id: 'battery', label: 'Check the battery bank', x: 8.5, z: -3, r: 2.8 },
    { id: 'lander', label: 'Inspect the lander', x: 32, z: 22, r: 5 },
    ...(worldId === 'moon' ? [{ id: 'reactor', label: 'Inspect the fission reactor', x: -30, z: -26, r: 5.5 }] : []),
  ];

  return {
    colliders,
    ghWall,
    interactables,
    look,
    gravity,
    heightAt,
    sunDir,
    sun,
    labels,
    rocks,
    rover: rov,
    crew,
    ghPos,
    target,
    cur,
    tick,
    setAutoRover(on) {
      autoRover = on;
    },
    playEvent(id) {
      ev.current = { id, t: 0 };
      if (id === 'supply_lander') cargo.visible = true;
    },
  };
}
