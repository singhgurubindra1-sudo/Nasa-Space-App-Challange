// Mission Control 3D solar system (three.js).
// Planets move with their real orbital periods and start at their real positions for today.
// Distances and sizes are squeezed so everything fits on a phone screen.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PLANETS, MOON, orbitAngle } from '../engine/orbits.js';
import { tex } from './assets.js';
import { starSky } from './realism.js';
import { createPost } from './post.js';
import { getQuality } from './quality.js';
import { createGovernor } from './perf.js';

// Real maps (NASA imagery) where we have them; the rest stay procedural.
const REAL_MAPS = { mars: 'mars', jupiter: 'jupiter', saturn: 'saturn', neptune: 'neptune', venus: 'venus' };

const TARGET_COLORS = { moon: '#e2e8f0', mars: '#ff7a45' };

// Scene units: squeeze 0.39–30 au into ~9–56 units so the outer planets fit.
export const sceneRadius = (au) => 4 + 8 * Math.pow(au, 0.55);
const bodySize = (km) => Math.max(0.3, Math.min(1.9, 0.55 * Math.sqrt(km / 6371)));
const MOON_ORBIT = 1.5;

// ---------- Procedural textures (no image downloads, so it works offline) ----------

export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function blobs(ctx, w, h, rnd, n, colors, rMin, rMax, alpha) {
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = alpha * (0.5 + rnd() * 0.5);
    ctx.fillStyle = colors[Math.floor(rnd() * colors.length)];
    const x = rnd() * w;
    const y = h * 0.08 + rnd() * h * 0.84;
    const r = rMin + rnd() * (rMax - rMin);
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.6, r, 0, 0, Math.PI * 2);
    ctx.fill();
    // wrap around the seam
    if (x + r * 1.6 > w) { ctx.beginPath(); ctx.ellipse(x - w, y, r * 1.6, r, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}

export function planetTexture(body, seed) {
  const rnd = seeded(seed);
  const [base, light, dark] = body.colors;
  return canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    if (body.look === 'gas' || body.look === 'ice' || body.look === 'cloudy') {
      const bands = body.look === 'gas' ? 22 : 9;
      for (let i = 0; i < bands; i++) {
        ctx.globalAlpha = body.look === 'gas' ? 0.55 : 0.25;
        ctx.fillStyle = [light, dark, base][i % 3];
        const y = (i / bands) * h + Math.sin(i * 1.7) * 4;
        ctx.fillRect(0, y, w, h / bands + rnd() * 6);
      }
      ctx.globalAlpha = 1;
      if (body.id === 'jupiter') {
        ctx.fillStyle = '#b5532f';
        ctx.beginPath();
        ctx.ellipse(w * 0.62, h * 0.66, 26, 13, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    if (body.look === 'earth') {
      blobs(ctx, w, h, rnd, 26, ['#3f8f4a', '#5a9e3f', '#8a7a4a'], 10, 34, 0.95);
      blobs(ctx, w, h, rnd, 40, ['#ffffff'], 4, 18, 0.45);
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, 0, w, h * 0.06);
      ctx.fillRect(0, h * 0.94, w, h * 0.06);
      return;
    }
    blobs(ctx, w, h, rnd, 70, [light, dark], 4, 26, 0.5);
    if (body.look === 'moon' || body.look === 'rocky') {
      for (let i = 0; i < 90; i++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const r = 1.5 + rnd() * 7;
        ctx.strokeStyle = 'rgba(40,40,40,.35)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    if (body.look === 'mars') {
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.fillRect(0, 0, w, h * 0.05);
      ctx.fillRect(0, h * 0.96, w, h * 0.04);
      // Valles Marineris-ish dark streak
      ctx.strokeStyle = 'rgba(80,30,15,.6)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(w * 0.3, h * 0.52);
      ctx.bezierCurveTo(w * 0.38, h * 0.48, w * 0.45, h * 0.55, w * 0.52, h * 0.5);
      ctx.stroke();
    }
  });
}

export function glowTexture(inner, outer) {
  return canvasTexture(256, 256, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, inner);
    g.addColorStop(0.25, outer);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  });
}

function ringMarkerTexture(color) {
  return canvasTexture(128, 128, (ctx) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(64, 64, 52, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(64 + Math.cos(a) * 40, 64 + Math.sin(a) * 40);
      ctx.lineTo(64 + Math.cos(a) * 62, 64 + Math.sin(a) * 62);
      ctx.stroke();
    }
  });
}

function orbitLine(radius, color, opacity) {
  const pts = [];
  for (let i = 0; i <= 256; i++) {
    const a = (i / 256) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, -Math.sin(a) * radius));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  return new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}

// ---------- The scene ----------

export function createSolarScene({ canvas, startDays, onPick, onHover, onContextLost, reducedMotion }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  const onLost = (e) => {
    e.preventDefault();
    if (onContextLost) onContextLost();
  };
  canvas.addEventListener('webglcontextlost', onLost);
  const quality = getQuality();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 4000);
  camera.position.set(0, 34, 52);

  const post = createPost(renderer, scene, camera, quality, { worldId: 'space', bloom: 0.55, bloomThreshold: 0.9 });
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 1.2;
  controls.maxDistance = 140;
  controls.autoRotate = !reducedMotion;
  controls.autoRotateSpeed = 0.35;

  // Lights: the Sun is the light source.
  scene.add(new THREE.AmbientLight(0x30384d, 0.35));
  const sunLight = new THREE.PointLight(0xfff4e0, 3.2, 0, 0);
  scene.add(sunLight);

  // The real night sky: NASA's Hipparcos star map
  scene.add(starSky(1600, 1.1));

  // Sun
  const sunMat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: 'varying vec3 vP; varying vec3 vN; varying vec3 vV; void main(){ vP = position; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: `
      uniform float time; varying vec3 vP; varying vec3 vN; varying vec3 vV;
      float h(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float n(vec3 p){ vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(h(i), h(i+vec3(1,0,0)), f.x), mix(h(i+vec3(0,1,0)), h(i+vec3(1,1,0)), f.x), f.y),
                   mix(mix(h(i+vec3(0,0,1)), h(i+vec3(1,0,1)), f.x), mix(h(i+vec3(0,1,1)), h(i+vec3(1,1,1)), f.x), f.y), f.z); }
      void main(){
        vec3 p = normalize(vP) * 6.0;
        float g = n(p + time * 0.15) * 0.5 + n(p * 2.3 - time * 0.2) * 0.3 + n(p * 6.0 + time * 0.3) * 0.2; // granulation
        float limb = pow(max(dot(vN, vV), 0.0), 0.45); // limb darkening, as seen on the real Sun
        vec3 col = mix(vec3(1.0, 0.45, 0.08), vec3(1.0, 0.92, 0.65), g) * (0.55 + 0.75 * limb);
        gl_FragColor = vec4(col * 3.2, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sun = new THREE.Mesh(new THREE.SphereGeometry(2.6, 64, 48), sunMat);
  scene.add(sun);
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,236,170,1)', 'rgba(255,160,40,.45)'), blending: THREE.AdditiveBlending, depthWrite: false }));
  sunGlow.scale.set(11, 11, 1);
  scene.add(sunGlow);

  // Asteroid belt between Mars and Jupiter
  {
    const rnd = seeded(3);
    const n = 1400;
    const pos = new Float32Array(n * 3);
    const r0 = sceneRadius(2.2);
    const r1 = sceneRadius(3.3);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const r = r0 + rnd() * (r1 - r0);
      pos.set([Math.cos(a) * r, (rnd() - 0.5) * 0.6, Math.sin(a) * r], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.4, sizeAttenuation: false, color: 0x8a8070 })));
  }

  // Planets
  const bodies = {}; // id -> { mesh, pivot, data }
  const pickables = [];
  PLANETS.forEach((p, i) => {
    const r = sceneRadius(p.au);
    const isTarget = !!p.target;
    scene.add(orbitLine(r, isTarget ? TARGET_COLORS[p.id] : 0x64748b, isTarget ? 0.55 : 0.22));
    const size = bodySize(p.radiusKm);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(size, 48, 32),
      p.id === 'earth'
        ? new THREE.MeshStandardMaterial({ map: tex('textures/planets/earth.jpg'), normalMap: tex('textures/planets/earth_normal.jpg', { srgb: false }), roughness: 0.7, metalness: 0 })
        : new THREE.MeshStandardMaterial({ map: REAL_MAPS[p.id] ? tex(`textures/planets/${REAL_MAPS[p.id]}.jpg`) : planetTexture(p, 100 + i), roughness: 0.9, metalness: 0 }),
    );
    mesh.userData = { id: p.id, name: p.name };
    mesh.rotation.z = (p.id === 'uranus' ? 98 : p.id === 'earth' ? 23.4 : p.id === 'mars' ? 25.2 : p.id === 'saturn' ? 26.7 : 3) * (Math.PI / 180);
    const holder = new THREE.Group();
    holder.add(mesh);
    if (p.rings) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(size * 1.3, size * 2.3, 96),
        new THREE.MeshBasicMaterial({
          map: canvasTexture(256, 8, (ctx, w, h) => {
            const g = ctx.createLinearGradient(0, 0, w, 0);
            g.addColorStop(0, 'rgba(210,190,150,.2)');
            g.addColorStop(0.4, 'rgba(230,214,170,.85)');
            g.addColorStop(0.55, 'rgba(80,70,50,.2)');
            g.addColorStop(0.7, 'rgba(220,200,160,.7)');
            g.addColorStop(1, 'rgba(200,180,140,.1)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, w, h);
          }),
          side: THREE.DoubleSide,
          transparent: true,
        }),
      );
      // Map the 1-D gradient radially.
      const uv = ring.geometry.attributes.uv;
      const posAttr = ring.geometry.attributes.position;
      for (let k = 0; k < uv.count; k++) {
        const d = Math.hypot(posAttr.getX(k), posAttr.getY(k));
        uv.setXY(k, (d - size * 1.3) / (size * 1.0), 0.5);
      }
      ring.rotation.x = -Math.PI / 2 + 0.47;
      holder.add(ring);
    }
    if (p.id === 'earth') {
      const clouds = new THREE.Mesh(new THREE.SphereGeometry(size * 1.015, 48, 32), new THREE.MeshStandardMaterial({ map: tex('textures/planets/earth_clouds.png'), transparent: true, depthWrite: false, roughness: 1 }));
      clouds.rotation.z = mesh.rotation.z;
      holder.add(clouds);
      mesh.userData.clouds = clouds;
      const atmo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(120,180,255,.0)', 'rgba(90,160,255,.35)'), blending: THREE.AdditiveBlending, depthWrite: false }));
      atmo.scale.set(size * 2.6, size * 2.6, 1);
      holder.add(atmo);
    }
    scene.add(holder);
    bodies[p.id] = { mesh, holder, data: p, radius: r, size };
    pickables.push(mesh);
  });

  // The Moon orbits Earth.
  const earth = bodies.earth;
  const moonOrbit = orbitLine(MOON_ORBIT, TARGET_COLORS.moon, 0.55);
  earth.holder.add(moonOrbit);
  const moonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 40, 24),
    new THREE.MeshStandardMaterial({ map: tex('textures/planets/moon.jpg'), roughness: 1 }),
  );
  moonMesh.userData = { id: 'moon', name: 'Moon' };
  const moonHolder = new THREE.Group();
  moonHolder.add(moonMesh);
  earth.holder.add(moonHolder);
  bodies.moon = { mesh: moonMesh, holder: moonHolder, data: MOON, size: 0.3 };
  pickables.push(moonMesh);

  // Target markers (pulsing rings around the Moon and Mars).
  const markers = {};
  for (const id of ['moon', 'mars']) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringMarkerTexture(TARGET_COLORS[id]), transparent: true, depthWrite: false, depthTest: false }));
    bodies[id].holder.add(sprite);
    markers[id] = sprite;
  }

  // ---------- State ----------
  let days = startDays;
  let speed = reducedMotion ? 1 : 8; // simulated days per second
  let focus = null;
  let selected = null;
  let flying = true;
  let disposed = false;
  let hop = false; // flying between two bodies: go up and over, not through the Sun
  let last = performance.now();
  let elapsed = 0;
  const tmp = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const lagOffset = new THREE.Vector3(); // camera target = body position + this, shrinking to zero
  let resetLag = true;

  function placeBodies() {
    for (const p of PLANETS) {
      const b = bodies[p.id];
      const a = orbitAngle(p, days);
      b.holder.position.set(Math.cos(a) * b.radius, 0, -Math.sin(a) * b.radius);
    }
    const ma = orbitAngle(MOON, days);
    moonHolder.position.set(Math.cos(ma) * MOON_ORBIT, 0, -Math.sin(ma) * MOON_ORBIT);
  }

  function overviewDistance() {
    const aspect = camera.aspect || 1;
    return aspect < 0.8 ? 80 : aspect < 1.3 ? 62 : 46;
  }
  function focusDistance(id) {
    // Narrow (portrait) screens need the camera further back to fit the planet.
    const aspectBoost = Math.pow(Math.min(1, camera.aspect || 1), -0.75);
    return (id === 'moon' ? 4.2 : 3.4) * aspectBoost;
  }

  function focusTarget(out) {
    if (!focus) return out.set(0, 0, 0);
    return bodies[focus].mesh.getWorldPosition(out);
  }

  // ---------- Picking ----------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downAt = null;
  function hit(ev) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects([...pickables, sun], false);
    if (!hits.length) return null;
    const obj = hits[0].object;
    return obj === sun ? { id: 'sun', name: 'Sun' } : obj.userData;
  }
  const onDown = (ev) => { downAt = { x: ev.clientX, y: ev.clientY }; };
  const onUp = (ev) => {
    if (!downAt) return;
    const moved = Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y);
    downAt = null;
    if (moved > 6) return;
    const h = hit(ev);
    if (h) onPick && onPick(h.id === 'earth' ? 'moon' : h.id, h);
  };
  const onMove = (ev) => {
    if (ev.pointerType !== 'mouse') return;
    const h = hit(ev);
    canvas.style.cursor = h && (h.id === 'moon' || h.id === 'mars' || h.id === 'earth') ? 'pointer' : 'grab';
    onHover && onHover(h);
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointermove', onMove);
  const stopAuto = () => { controls.autoRotate = false; };
  controls.addEventListener('start', stopAuto);

  // ---------- Loop ----------
  const labelState = {};
  let labelCb = null;

  function frame() {
    if (disposed) return;
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    elapsed += dt;
    days += dt * speed;
    placeBodies();

    // Spin planets and the Sun a little.
    for (const id in bodies) bodies[id].mesh.rotation.y += dt * (id === 'moon' ? 0.05 : 0.25);
    sun.rotation.y += dt * 0.03;
    sunMat.uniforms.time.value += dt;
    if (bodies.earth.mesh.userData.clouds) bodies.earth.mesh.userData.clouds.rotation.y += dt * 0.05;

    // Pulsing target markers.
    const t = elapsed;
    for (const id in markers) {
      const isSel = selected === id;
      const base = bodies[id].size * (isSel && focus === id ? 2.6 : isSel ? 3.4 : 3.0);
      const s = base * (1 + 0.12 * Math.sin(t * (isSel ? 4 : 2.2)));
      markers[id].scale.set(s, s, 1);
      markers[id].material.opacity = isSel ? 1 : 0.7;
    }

    // Camera follows the focused body.
    focusTarget(desired);
    const k = 1 - Math.exp(-dt * 2.6);
    if (resetLag) {
      lagOffset.copy(controls.target).sub(desired);
      resetLag = false;
    }
    lagOffset.multiplyScalar(flying ? 1 - k : 0);
    tmp.copy(desired).add(lagOffset);
    camera.position.add(tmp.clone().sub(controls.target));
    controls.target.copy(tmp);
    if (flying) {
      const off = camera.position.clone().sub(controls.target);
      const far = lagOffset.length() > 1.5;
      if (hop && !far) hop = false;
      const want = focus ? (hop ? 26 : focusDistance(focus)) : overviewDistance();
      const len = off.length() + (want - off.length()) * k;
      off.setLength(len);
      if (!focus || hop) {
        // Ease back to a nice high angle for the overview.
        const flat = Math.hypot(off.x, off.z) || 1;
        const ang = Math.atan2(off.y, flat);
        const wantAng = 0.55 + (ang - 0.55) * (1 - k);
        off.set((off.x / flat) * Math.cos(wantAng) * len, Math.sin(wantAng) * len, (off.z / flat) * Math.cos(wantAng) * len);
      }
      camera.position.copy(controls.target).add(off);
      if (!hop && Math.abs(len - want) < 0.05 * want && lagOffset.length() < 0.02) flying = false;
    }
    controls.update();
    post.render(dt);
    governor.tick(dt);

    // Screen positions for HTML labels.
    if (labelCb) {
      const rect = canvas.getBoundingClientRect();
      for (const id of ['moon', 'mars', 'earth', 'jupiter', 'saturn', 'venus', 'mercury', 'uranus', 'neptune', 'sun']) {
        const obj = id === 'sun' ? sun : bodies[id].mesh;
        obj.getWorldPosition(tmp);
        const dist = camera.position.distanceTo(tmp);
        tmp.project(camera);
        const visible = tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1;
        const worldR = id === 'sun' ? 2.6 : bodies[id].size;
        labelState[id] = {
          x: ((tmp.x + 1) / 2) * rect.width,
          y: ((1 - tmp.y) / 2) * rect.height,
          visible,
          dist,
          r: (worldR / Math.max(dist, 0.01)) * (rect.height / 2) / Math.tan((camera.fov * Math.PI) / 360),
        };
      }
      labelCb(labelState, days);
    }
  }
  const governor = createGovernor({ renderer, post, quality, onResize: resize, target: 50 });
  renderer.setAnimationLoop(frame);

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    post.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();
  placeBodies();

  return {
    setFocus(id) {
      if (focus && id && focus !== id) hop = true;
      focus = id;
      flying = true;
      resetLag = true;
      if (id) controls.autoRotate = false;
    },
    setSelected(id) {
      selected = id;
    },
    overview() {
      focus = null;
      flying = true;
      resetLag = true;
      controls.autoRotate = !reducedMotion;
    },
    setSpeed(s) {
      speed = s;
    },
    onLabels(cb) {
      labelCb = cb;
    },
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('webglcontextlost', onLost);
      controls.removeEventListener('start', stopAuto);
      controls.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (o.material.map) o.material.map.dispose();
          o.material.dispose();
        }
      });
      post.dispose();
      renderer.dispose();
    },
  };
}
