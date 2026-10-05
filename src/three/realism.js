// Realistic surface rendering: PBR terrain with baked regolith textures (two-scale to hide
// tiling), fractured rocks and pebbles, physically-inspired skies, the real Milky Way (NASA
// Hipparcos star map) and Earth (Blue Marble), environment lighting for reflections,
// lens flare, and NASA's official 3D models (Perseverance, Ingenuity).
import * as THREE from 'three';
import { Lensflare, LensflareElement } from 'three/examples/jsm/objects/Lensflare.js';
import { tex, loadModel } from './assets.js';
import { seeded } from './solarScene.js';

// ---------- 3D value noise (for rock shapes) ----------
function noise3(seed) {
  const h = (x, y, z) => {
    let n = (x * 374761393 + y * 668265263 + z * 1274126177 + seed * 951274213) | 0;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const s = (t) => t * t * (3 - 2 * t);
  return (x, y, z) => {
    const xi = Math.floor(x); const yi = Math.floor(y); const zi = Math.floor(z);
    const u = s(x - xi); const v = s(y - yi); const w = s(z - zi);
    const l = (a, b, t) => a + (b - a) * t;
    return l(
      l(l(h(xi, yi, zi), h(xi + 1, yi, zi), u), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
      l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v),
      w,
    ) * 2 - 1;
  };
}

// A rock: displaced sphere with a few flat fracture planes cut into it
function rockGeometry(seed, detail, flat) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const n = noise3(seed);
  const rnd = seeded(seed * 7 + 3);
  const cuts = [];
  for (let i = 0; i < 4 + Math.floor(rnd() * 4); i++) {
    const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 1.6 - 0.5, rnd() * 2 - 1).normalize();
    cuts.push([v, 0.55 + rnd() * 0.35]);
  }
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const r = 1 + n(v.x * 1.6, v.y * 1.6, v.z * 1.6) * 0.22 + n(v.x * 4.5, v.y * 4.5, v.z * 4.5) * 0.07;
    v.multiplyScalar(r);
    for (const [cn, d] of cuts) {
      const k = v.dot(cn);
      if (k > d) v.addScaledVector(cn, d - k);
    }
    v.y *= flat;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

const TILE = 3.2; // metres per texture repeat on the ground

// Terrain: a detailed patch around the base plus a coarser ring out to the horizon.
export function buildTerrainPBR(worldId, heightAt, look, quality) {
  const group = new THREE.Group();
  const prefix = `textures/surface/${worldId}_`;
  const mat = new THREE.MeshStandardMaterial({
    map: tex(`${prefix}albedo.jpg`, { repeat: 1 }),
    normalMap: tex(`${prefix}normal.jpg`, { srgb: false, repeat: 1 }),
    roughnessMap: tex(`${prefix}rough.jpg`, { srgb: false, repeat: 1 }),
    normalScale: new THREE.Vector2(1.1, 1.1),
    vertexColors: true,
    roughness: 1,
    metalness: 0,
  });
  // Blend the albedo at two scales so the repeat can't be seen
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <map_fragment>',
      `#ifdef USE_MAP
        vec4 s1 = texture2D(map, vMapUv);
        vec4 s2 = texture2D(map, vMapUv * 0.173 + vec2(0.31, 0.77));
        vec4 sampledDiffuseColor = mix(s1, s2, 0.42);
        diffuseColor *= sampledDiffuseColor;
      #endif`,
    );
  };
  const nearMat = mat.clone();
  nearMat.onBeforeCompile = mat.onBeforeCompile;
  nearMat.polygonOffset = true;
  nearMat.polygonOffsetFactor = -1;
  nearMat.polygonOffsetUnits = -1;

  const make = (size, seg, lowerInside, material) => {
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      let y = heightAt(x, z);
      if (lowerInside && Math.abs(x) < lowerInside && Math.abs(z) < lowerInside) y -= 0.8;
      pos.setY(i, y);
      uv.setXY(i, x / TILE, z / TILE);
    }
    geo.computeVertexNormals();
    // Macro brightness variation and darker steep slopes (vertex colours multiply the texture)
    const nrm = geo.attributes.normal;
    const col = new Float32Array(pos.count * 3);
    const rnd = (x, z) => Math.sin(x * 0.043 + Math.sin(z * 0.031) * 2) * 0.5 + Math.sin(z * 0.051 + x * 0.017) * 0.5;
    for (let i = 0; i < pos.count; i++) {
      const slope = 1 - nrm.getY(i);
      const m = 0.92 + rnd(pos.getX(i), pos.getZ(i)) * 0.08 - Math.min(0.35, slope * 0.9);
      if (worldId === 'mars') col.set([m * 1.0, m * 0.97, m * 0.95], i * 3);
      else col.set([m, m, m], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mesh = new THREE.Mesh(geo, material);
    mesh.receiveShadow = true;
    return mesh;
  };
  group.add(make(520, quality.terrainSeg, 98, mat));
  group.add(make(200, quality.nearSeg, 0, nearMat));
  return group;
}

// Rocks (several fractured shapes) plus small pebbles. Returns { group, big }.
export function buildRocksPBR(worldId, heightAt, look, quality) {
  const group = new THREE.Group();
  const big = [];
  // texture is mid-grey, so brighten the tint to land on the real rock colour
  const rockMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(look.rock).multiplyScalar(1.75),
    map: tex('textures/surface/rock_albedo.jpg'),
    normalMap: tex('textures/surface/rock_normal.jpg', { srgb: false }),
    normalScale: new THREE.Vector2(1.4, 1.4),
    roughness: 0.92,
    metalness: 0,
  });
  const rnd = seeded(worldId === 'mars' ? 77 : 88);
  const detail = quality.rockDetail ?? 2;
  const protos = [0, 1, 2, 3, 4, 5].map((i) => rockGeometry(100 + i + (worldId === 'mars' ? 0 : 50), detail, worldId === 'mars' ? 0.62 + i * 0.03 : 0.7 + i * 0.03));
  const total = Math.round(look.rocks * quality.rocks);
  const per = Math.ceil(total / protos.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const c = new THREE.Color();
  const base = new THREE.Color(1, 1, 1);
  const avoid = (x, z, d) => (d < 15 && rnd() < 0.85) || Math.hypot(x + 9, z - 9) < 6.5 || d < 11;
  protos.forEach((geo, pi) => {
    // Split each shape into shadow-casting (large) and non-casting (small) instances:
    // small stones barely show a shadow but cost a full extra draw in the shadow pass.
    const large = [];
    const smallOnes = [];
    for (let i = 0; i < per; i++) {
      let x; let z; let d;
      do {
        const a = rnd() * Math.PI * 2;
        d = 9 + Math.pow(rnd(), 1.6) * 150;
        x = Math.cos(a) * d;
        z = Math.sin(a) * d;
      } while (avoid(x, z, d));
      const sc = (0.08 + Math.pow(rnd(), 3.2) * (worldId === 'mars' ? 1.6 : 1.25)) * (d > 60 ? 1.6 : 1);
      e.set(rnd() * 0.4, rnd() * Math.PI * 2, rnd() * 0.4);
      q.setFromEuler(e);
      // sink rocks a little into the ground so they look embedded, not placed
      const mat4 = new THREE.Matrix4().compose(new THREE.Vector3(x, heightAt(x, z) - sc * 0.18, z), q.clone(), new THREE.Vector3(sc * (0.8 + rnd() * 0.6), sc, sc * (0.8 + rnd() * 0.6)));
      if (sc > 0.7) big.push({ x, z, r: sc * 1.05 });
      const tint = 0.72 + rnd() * 0.4;
      (sc > 0.35 && d < 70 ? large : smallOnes).push([mat4, tint]);
    }
    for (const [list, cast] of [[large, true], [smallOnes, false]]) {
      if (!list.length) continue;
      const mesh = new THREE.InstancedMesh(geo, rockMat, list.length);
      list.forEach(([mat4, tint], i) => {
        mesh.setMatrixAt(i, mat4);
        c.copy(base).multiplyScalar(tint);
        mesh.setColorAt(i, c);
      });
      mesh.castShadow = cast;
      mesh.receiveShadow = true;
      mesh.userData.proto = pi;
      group.add(mesh);
    }
  });

  // Pebbles: thousands of small stones near the base (receive shadows only, for speed)
  if (quality.pebbles > 0) {
    const pg = rockGeometry(900 + (worldId === 'mars' ? 1 : 2), 1, 0.6);
    const pmesh = new THREE.InstancedMesh(pg, rockMat, quality.pebbles);
    for (let i = 0; i < quality.pebbles; i++) {
      let x; let z; let d;
      do {
        const a = rnd() * Math.PI * 2;
        d = 5 + Math.pow(rnd(), 0.9) * 75;
        x = Math.cos(a) * d;
        z = Math.sin(a) * d;
      } while (Math.hypot(x + 9, z - 9) < 5 || (d < 9 && rnd() < 0.7));
      const s = 0.025 + Math.pow(rnd(), 2.5) * 0.14;
      e.set(rnd() * 3, rnd() * 3, rnd() * 3);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(x, heightAt(x, z) - s * 0.25, z), q, new THREE.Vector3(s, s * 0.8, s));
      pmesh.setMatrixAt(i, m);
      c.copy(base).multiplyScalar(0.65 + rnd() * 0.5);
      pmesh.setColorAt(i, c);
    }
    pmesh.receiveShadow = true;
    pmesh.userData.pebbles = true;
    group.add(pmesh);
  }
  group.userData.big = big;
  return { group, big };
}

// ---------- Skies ----------
export function marsSkyPBR(look, sunDir) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      zenith: { value: new THREE.Color('#a9805c') },
      horizon: { value: new THREE.Color('#dcb08a') },
      low: { value: new THREE.Color('#c79470') },
      halo: { value: new THREE.Color('#d8dde6') },
      stormColor: { value: new THREE.Color(look.stormColor) },
      sunDir: { value: sunDir.clone() },
      storm: { value: 0 },
      flash: { value: 0 },
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }',
    fragmentShader: `
      varying vec3 vDir; uniform vec3 zenith, horizon, low, halo, stormColor, sunDir; uniform float storm, flash;
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 c = h > 0.0 ? mix(horizon, zenith, pow(clamp(h, 0.0, 1.0), 0.45)) : mix(horizon, low, clamp(-h * 4.0, 0.0, 1.0));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        // Mars dust scatters light forward: a pale bluish-white glow around the Sun
        c = mix(c, halo, pow(s, 9.0) * 0.55 * (1.0 - storm));
        c += vec3(1.0, 0.96, 0.9) * pow(s, 60.0) * 0.6 * (1.0 - storm);
        c += vec3(1.0, 0.98, 0.95) * smoothstep(0.99985, 0.99995, s) * 14.0 * (1.0 - storm * 0.9); // the Sun's disc (small: Mars is far)
        c = mix(c, stormColor, storm * 0.85);
        c += vec3(1.0, 0.95, 0.8) * flash;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), mat);
  m.renderOrder = -1;
  return m;
}

function atmosphereShell(radius, color, power, intensity) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 48, 32),
    new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { color: { value: new THREE.Color(color) }, power: { value: power }, intensity: { value: intensity } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 color; uniform float power, intensity; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), power); gl_FragColor = vec4(color * f * intensity, f); }',
    }),
  );
}

// Real Earth (NASA Blue Marble map) with clouds and a thin blue atmosphere
export function realEarth(radius) {
  const g = new THREE.Group();
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 96, 64),
    new THREE.MeshStandardMaterial({
      map: tex('textures/planets/earth.jpg'),
      normalMap: tex('textures/planets/earth_normal.jpg', { srgb: false }),
      roughnessMap: tex('textures/planets/earth_specular.jpg', { srgb: false }),
      roughness: 0.9,
      metalness: 0,
      fog: false,
    }),
  );
  // the specular map is bright on oceans: invert it to use it as roughness
  earth.material.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', `float roughnessFactor = roughness;
      #ifdef USE_ROUGHNESSMAP
        roughnessFactor *= mix(0.95, 0.35, texture2D(roughnessMap, vRoughnessMapUv).g);
      #endif`);
  };
  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.012, 96, 64),
    new THREE.MeshStandardMaterial({ map: tex('textures/planets/earth_clouds.png'), transparent: true, depthWrite: false, roughness: 1, fog: false }),
  );
  g.add(earth, clouds, atmosphereShell(radius * 1.06, '#5aa0ff', 3.2, 1.6));
  g.userData = { earth, clouds };
  return g;
}

export function starSky(radius = 1500, brightness = 1) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 64, 32),
    new THREE.MeshBasicMaterial({ map: tex('textures/planets/stars.jpg'), side: THREE.BackSide, depthWrite: false, fog: false, color: new THREE.Color(brightness, brightness, brightness) }),
  );
  m.rotation.set(0.4, 0, 1.0); // tilt the Milky Way across the sky
  m.renderOrder = -2;
  return m;
}

// Lens flare textures, drawn once
function flareTex(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  if (kind === 'main') {
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.08, 'rgba(255,248,230,0.9)');
    g.addColorStop(0.3, 'rgba(255,220,170,0.18)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,240,220,0.35)';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(128 - Math.cos(a) * 128, 128 - Math.sin(a) * 128);
      ctx.lineTo(128 + Math.cos(a) * 128, 128 + Math.sin(a) * 128);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.0)';
    ctx.fillRect(0, 0, 256, 256);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.lineTo(128 + Math.cos(a) * 110, 128 + Math.sin(a) * 110);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(128, 128, 20, 128, 128, 120);
    g.addColorStop(0, 'rgba(255,255,255,0.05)');
    g.addColorStop(1, 'rgba(255,255,255,0.35)');
    ctx.fillStyle = g;
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function sunFlare(sunDir, strength, distance = 800) {
  const light = new THREE.PointLight(0xffffff, 0, 1);
  light.position.copy(sunDir).multiplyScalar(distance);
  const lf = new Lensflare();
  const main = flareTex('main');
  const hex = flareTex('hex');
  lf.addElement(new LensflareElement(main, 360 * strength, 0, new THREE.Color(1, 0.97, 0.92)));
  lf.addElement(new LensflareElement(hex, 60 * strength, 0.4, new THREE.Color(0.6, 0.75, 1)));
  lf.addElement(new LensflareElement(hex, 90 * strength, 0.6, new THREE.Color(0.9, 0.8, 0.6)));
  lf.addElement(new LensflareElement(hex, 40 * strength, 0.85, new THREE.Color(0.7, 1, 0.8)));
  lf.addElement(new LensflareElement(hex, 120 * strength, 1.0, new THREE.Color(0.5, 0.6, 1)));
  light.add(lf);
  return light;
}

// Environment lighting (image-based) so metal, visors and solar panels reflect the world
export function makeEnvironment(renderer, worldId, skyMesh) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  if (skyMesh) envScene.add(skyMesh.clone());
  else envScene.background = new THREE.Color('#000000');
  const groundColor = worldId === 'mars' ? '#8a4d2c' : '#6d6d6d';
  const ground = new THREE.Mesh(new THREE.CircleGeometry(400, 32), new THREE.MeshBasicMaterial({ color: groundColor }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2;
  envScene.add(ground);
  if (worldId === 'moon') {
    const sunSpot = new THREE.Mesh(new THREE.SphereGeometry(30, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 8, 8) }));
    sunSpot.position.set(300, 60, 80);
    envScene.add(sunSpot);
  }
  const rt = pmrem.fromScene(envScene, 0.02);
  pmrem.dispose();
  return rt.texture;
}

// Upgrade the base-hardware materials with PBR detail textures
export const PBR = {
  white: () => new THREE.MeshStandardMaterial({ color: '#e8eaec', roughness: 0.42, metalness: 0.08, normalMap: tex('textures/surface/panel_normal.jpg', { srgb: false, repeat: 2 }), normalScale: new THREE.Vector2(0.7, 0.7) }),
  grey: () => new THREE.MeshStandardMaterial({ color: '#8c939c', roughness: 0.38, metalness: 0.75 }),
  dark: () => new THREE.MeshStandardMaterial({ color: '#23282e', roughness: 0.55, metalness: 0.4 }),
  panel: () => new THREE.MeshPhysicalMaterial({ color: '#0d1a3d', roughness: 0.16, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.04, emissive: '#02040a' }),
  gold: () => new THREE.MeshStandardMaterial({ color: '#d4a03a', roughness: 0.22, metalness: 1, normalMap: tex('textures/surface/foil_normal.jpg', { srgb: false, repeat: 3 }), normalScale: new THREE.Vector2(0.9, 0.9) }),
};

// NASA's official 3D models (public domain, from github.com/nasa/NASA-3D-Resources)
export function addNasaModels(scene, worldId, heightAt) {
  const placed = [];
  const put = (path, x, z, rotY, scale = 1) =>
    loadModel(path)
      .then((obj) => {
        obj.scale.setScalar(scale);
        obj.rotation.y = rotY;
        obj.position.set(x, heightAt(x, z), z);
        obj.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
            if (o.material && 'envMapIntensity' in o.material) o.material.envMapIntensity = 1;
          }
        });
        scene.add(obj);
        placed.push(obj);
        return obj;
      })
      .catch((e) => console.warn('model failed', path, e));
  if (worldId === 'mars') {
    put('models/perseverance.glb', -20, -14, 0.9);
    put('models/ingenuity.glb', 27, -31, 0.6);
  }
  return placed;
}
