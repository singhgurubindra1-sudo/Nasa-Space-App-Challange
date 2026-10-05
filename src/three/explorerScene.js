// Explorer dashboard: one renderer, six views.
//   galaxy — the Milky Way (procedural, real proportions), with the Sun's real place in it
//   solar  — planets where they really are right now (JPL elements), probes and famous asteroids
//   earth  — live Earth satellites (CelesTrak elements + SGP4), real Earth rotation and sunlight
//   neo    — asteroids passing Earth this week (NASA NeoWs) on a log-distance radar
//   moon   — lunar orbiters and landing sites, lit by the real Sun angle (today's Moon phase)
//   mars   — Mars orbiters, Phobos & Deimos, Jezero and other sites, with the real Mars clock
// Scene units: galaxy 1 = 1,000 light years · solar = squeezed au · earth/moon/mars 1 = 1,000 km.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { propagate, gstime, eciToGeodetic, degreesLat, degreesLong } from '../lib/satellite.js';
import { tex } from './assets.js';
import { starSky, realEarth, atmosphereShell } from './realism.js';
import { createPost } from './post.js';
import { getQuality } from './quality.js';
import { createGovernor } from './perf.js';
import { seeded, canvasTexture, planetTexture, glowTexture, sunMesh, sceneRadius } from './solarScene.js';
import { PLANETS } from '../engine/orbits.js';
import {
  DEG, AU_KM, RADIUS_KM, planetElements, planetHelio, keplerXYZ, orbitPoints, neoElements, neoHelio, eqToEcl, eclToEq,
  escapeProbe, parkerProbe, sunEclLon, moonGeo, moonPhase, marsTime, orbiterElements, orbiterState, latLonUnit, hashAngle,
} from '../engine/space.js';
import catalog from '../data/spacecraft.json' with { type: 'json' };
import asteroids from '../data/asteroids.json' with { type: 'json' };

export const KIND_COLORS = {
  station: '#facc15', satellite: '#38bdf8', telescope: '#c084fc', orbiter: '#38bdf8', probe: '#f472b6', moonlet: '#d6d3d1',
  base: '#4ade80', lander: '#22d3ee', rover: '#fb923c', heritage: '#fbbf24', poi: '#e2e8f0', asteroid: '#fbbf24', hazardous: '#f87171',
  planet: '#e2e8f0', star: '#fde68a', galaxy: '#a5b4fc', bright: '#cbd5e1',
};
const LD_KM = 384400;

// z-up physics frames (ECI, ecliptic, planet-fixed) → three.js y-up
const toThree = (v, s = 1, out = new THREE.Vector3()) => out.set(v.x * s, v.z * s, -v.y * s);
function rotZ(v, deg) {
  const c = Math.cos(deg * DEG), s = Math.sin(deg * DEG);
  return { x: c * v.x - s * v.y, y: s * v.x + c * v.y, z: v.z };
}

// ---------- shared visuals ----------
const markerTexCache = {};
function markerTexture(color) {
  if (markerTexCache[color]) return markerTexCache[color];
  markerTexCache[color] = canvasTexture(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.22, color);
    g.addColorStop(0.45, color + '88');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
  return markerTexCache[color];
}
function makeMarker(color) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTexture(color), transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false }));
  s.renderOrder = 5;
  return s;
}
const ringTex = () =>
  canvasTexture(128, 128, (ctx) => {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(64, 64, 52, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 4;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(64 + Math.cos(a) * 38, 64 + Math.sin(a) * 38);
      ctx.lineTo(64 + Math.cos(a) * 62, 64 + Math.sin(a) * 62);
      ctx.stroke();
    }
  });
function lineFrom(points, color, opacity) {
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
  line.userData.baseOpacity = opacity;
  return line;
}
function setLinePoints(line, points) {
  const old = line.geometry;
  line.geometry = new THREE.BufferGeometry().setFromPoints(points);
  old.dispose();
}
function ringLine(radius, color, opacity, n = 192) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  }
  return lineFrom(pts, color, opacity);
}
function softDot() {
  return canvasTexture(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
}
function gauss(rnd) {
  return Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
}

function obj(o) {
  return { pos: new THREE.Vector3(), r: 0, pickable: true, label: true, list: true, ...o };
}

// ================= GALAXY =================
function buildGalaxy({ quality }) {
  const scene = new THREE.Scene();
  const n = quality.level === 'low' ? 26000 : quality.level === 'medium' ? 52000 : 90000;
  const rnd = seeded(42);
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const c = new THREE.Color();
  const k = Math.tan(12 * DEG); // spiral arm pitch angle ≈ 12°
  const armPhase = 4.32; // an arm passes 22,000 ly out on the Sun's side, the next at 31,000 ly: the Sun sits between
  const barAngle = 27 * DEG;
  for (let i = 0; i < n; i++) {
    const t = rnd();
    let x, y, z;
    if (t < 0.14) {
      // central bar and bulge (old, yellow stars)
      const bx = gauss(rnd) * 4.2, bz = gauss(rnd) * 1.4;
      x = bx * Math.cos(barAngle) - bz * Math.sin(barAngle);
      z = bx * Math.sin(barAngle) + bz * Math.cos(barAngle);
      y = gauss(rnd) * 1.1;
      c.setHSL(0.1 + rnd() * 0.04, 0.7, 0.62 + rnd() * 0.2);
    } else if (t < 0.86) {
      // four logarithmic spiral arms, trailing the rotation
      const arm = Math.floor(rnd() * 4);
      const th = rnd() * 12; // radians along the arm
      const rr = 4.5 * Math.exp(k * th);
      const phi = armPhase + (arm * Math.PI) / 2 - th;
      const spread = 0.45 + rr * 0.028;
      x = rr * Math.cos(phi) + gauss(rnd) * spread;
      z = rr * Math.sin(phi) + gauss(rnd) * spread;
      y = gauss(rnd) * 0.25;
      const hii = rnd() < 0.05;
      if (hii) c.setHSL(0.93 + rnd() * 0.04, 0.8, 0.65);
      else c.setHSL(0.6 + rnd() * 0.05, 0.55 + rnd() * 0.25, 0.62 + rnd() * 0.25);
    } else {
      // thin disk of older stars between the arms
      const rr = -Math.log(1 - rnd() * 0.995) * 10;
      const phi = rnd() * Math.PI * 2;
      x = rr * Math.cos(phi);
      z = rr * Math.sin(phi);
      y = gauss(rnd) * 0.35;
      c.setHSL(0.1, 0.25, 0.3 + rnd() * 0.2);
    }
    pos.set([x, y, z], i * 3);
    col.set([c.r, c.g, c.b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const stars = new THREE.Points(g, new THREE.PointsMaterial({ size: quality.level === 'low' ? 0.6 : 0.45, map: softDot(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(stars);
  // Orion Spur: the short arm segment the Sun lives in
  {
    const m = 1600;
    const p = new Float32Array(m * 3);
    const r2 = seeded(7);
    for (let i = 0; i < m; i++) {
      const s = r2() * 9 - 4.5;
      const phi = Math.PI + s * 0.05;
      const rr = 26 + s * 0.35;
      p.set([rr * Math.cos(phi) + gauss(r2) * 0.5, gauss(r2) * 0.2, rr * Math.sin(phi) + gauss(r2) * 0.5], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(p, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.35, map: softDot(), color: 0xbfd4ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  }
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,230,180,1)', 'rgba(255,190,110,.35)'), blending: THREE.AdditiveBlending, depthWrite: false }));
  core.scale.set(26, 26, 1);
  scene.add(core);
  // distant background galaxies
  {
    const m = 900;
    const p = new Float32Array(m * 3);
    const r3 = seeded(11);
    for (let i = 0; i < m; i++) {
      const v = new THREE.Vector3(gauss(r3), gauss(r3), gauss(r3)).setLength(900 + r3() * 300);
      p.set([v.x, v.y, v.z], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(p, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.4, sizeAttenuation: false, color: 0x8899bb })));
  }

  // Galactic coordinates (l, b) as seen from the Sun → scene position (x toward the centre, y north)
  const SUN = new THREE.Vector3(-26, 0, 0);
  const fromSun = (lDeg, bDeg, kly) =>
    new THREE.Vector3(Math.cos(bDeg * DEG) * Math.cos(lDeg * DEG), Math.sin(bDeg * DEG), -Math.cos(bDeg * DEG) * Math.sin(lDeg * DEG)).multiplyScalar(kly).add(SUN);
  const objects = [
    obj({ id: 'g-sun', name: 'You are here: the Sun', kind: 'star', color: KIND_COLORS.star, r: 0.5, info: { place: 'Orion Spur, between the Sagittarius and Perseus arms' } }),
    obj({ id: 'g-center', name: 'Sagittarius A* (galactic centre)', kind: 'galaxy', color: '#fb923c', r: 2 }),
    obj({ id: 'g-lmc', name: 'Large Magellanic Cloud', kind: 'galaxy', color: KIND_COLORS.galaxy, r: 3 }),
    obj({ id: 'g-smc', name: 'Small Magellanic Cloud', kind: 'galaxy', color: KIND_COLORS.galaxy, r: 2 }),
  ];
  objects[0].pos.copy(SUN);
  objects[1].pos.set(0, 0, 0);
  objects[2].pos.copy(fromSun(280.5, -32.9, 163));
  objects[3].pos.copy(fromSun(302.8, -44.3, 203));
  for (const o of objects.slice(2)) {
    const blob = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(220,225,255,.9)', 'rgba(150,170,255,.25)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    blob.scale.set(o.id === 'g-lmc' ? 14 : 8, o.id === 'g-lmc' ? 9 : 6, 1);
    blob.position.copy(o.pos);
    scene.add(blob);
  }
  for (const o of objects) {
    o.sprite = makeMarker(o.color);
    o.sprite.position.copy(o.pos);
    o.markerPx = o.id === 'g-sun' ? 16 : 11;
    scene.add(o.sprite);
  }
  // a ring showing the Sun's 230-million-year orbit around the centre
  scene.add(ringLine(26, 0xfde68a, 0.22, 256));

  const readout = (o) => {
    if (o.id === 'g-sun') return { badge: 'fixed', rows: [['Distance to galactic centre', '≈ 26,000 light years'], ['Orbit speed around the centre', '≈ 230 km/s'], ['One lap (a "galactic year")', '≈ 230 million years'], ['Arm', 'Orion Spur (Local Arm)']] };
    if (o.id === 'g-center') return { badge: 'fixed', rows: [['Black hole mass', '≈ 4 million Suns'], ['Distance from us', '≈ 26,000 light years'], ['First image', 'Event Horizon Telescope, 2022']] };
    if (o.id === 'g-lmc') return { badge: 'fixed', rows: [['Distance', '≈ 160,000 light years'], ['Type', 'Satellite galaxy of the Milky Way'], ['Seen from', 'Southern Hemisphere, with no telescope']] };
    return { badge: 'fixed', rows: [['Distance', '≈ 200,000 light years'], ['Type', 'Satellite galaxy of the Milky Way']] };
  };
  return {
    scene, objects, occluders: [],
    near: 0.5, far: 6000, minD: 3, maxD: 900,
    home: { pos: [-14, 84, 58], target: [-6, 0, 0] },
    focusDist: (o) => (o.id === 'g-sun' ? 9 : o.id.startsWith('g-l') || o.id === 'g-smc' ? 60 : 26),
    update(_ms, _dt, elapsed) {
      objects[0].markerPx = 15 + 3 * Math.sin(elapsed * 3); // a gentle pulse on "you are here"
    },
    readout,
  };
}

// ================= SOLAR SYSTEM =================
const REAL_MAPS = { mars: 'mars', jupiter: 'jupiter', saturn: 'saturn', neptune: 'neptune', venus: 'venus' };
const bodySize = (km) => Math.max(0.3, Math.min(1.9, 0.55 * Math.sqrt(km / 6371)));
// squeeze a heliocentric position (au) into scene units, keeping its direction
function squeeze(v, out = new THREE.Vector3()) {
  const r = Math.hypot(v.x, v.y, v.z) || 1e-9;
  return toThree(v, sceneRadius(r) / r, out);
}

function buildSolar({ quality }) {
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0x30384d, 0.35));
  scene.add(new THREE.PointLight(0xfff4e0, 3.2, 0, 0));
  scene.add(starSky(2400, 1.0));
  const sun = sunMesh(2.6);
  scene.add(sun);
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,236,170,1)', 'rgba(255,160,40,.45)'), blending: THREE.AdditiveBlending, depthWrite: false }));
  sunGlow.scale.set(11, 11, 1);
  scene.add(sunGlow);
  // main asteroid belt (decorative)
  {
    const rnd = seeded(3);
    const m = quality.level === 'low' ? 1200 : 2600;
    const p = new Float32Array(m * 3);
    for (let i = 0; i < m; i++) {
      const a = rnd() * Math.PI * 2;
      const au = 2.1 + rnd() * 1.2;
      const v = squeeze({ x: Math.cos(a) * au, y: Math.sin(a) * au, z: (rnd() - 0.5) * 0.25 });
      p.set([v.x, v.y, v.z], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.3, sizeAttenuation: false, color: 0x8a8070 })));
  }
  const objects = [];
  const now = Date.now();
  PLANETS.forEach((p, i) => {
    const size = bodySize(p.radiusKm);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(size, 48, 32),
      p.id === 'earth'
        ? new THREE.MeshStandardMaterial({ map: tex('textures/planets/earth.jpg'), roughness: 0.7 })
        : new THREE.MeshStandardMaterial({ map: REAL_MAPS[p.id] ? tex(`textures/planets/${REAL_MAPS[p.id]}.jpg`) : planetTexture(p, 100 + i), roughness: 0.9 }),
    );
    mesh.rotation.z = (p.id === 'uranus' ? 98 : p.id === 'earth' ? 23.4 : p.id === 'mars' ? 25.2 : p.id === 'saturn' ? 26.7 : 3) * DEG;
    scene.add(mesh);
    if (p.rings) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(size * 1.3, size * 2.3, 96), new THREE.MeshBasicMaterial({ color: 0xd9c9a0, side: THREE.DoubleSide, transparent: true, opacity: 0.55 }));
      ring.rotation.x = -Math.PI / 2 + 0.47;
      mesh.add(ring);
      ring.rotation.set(Math.PI / 2, 0, 0);
    }
    const el = planetElements(p.id, now);
    const line = lineFrom(orbitPoints(el, 240).map((v) => squeeze(v)), p.id === 'earth' ? 0x60a5fa : p.id === 'mars' ? 0xff7a45 : 0x64748b, p.id === 'earth' || p.id === 'mars' ? 0.5 : 0.25);
    scene.add(line);
    objects.push(obj({ id: `p-${p.id}`, name: p.name, kind: 'planet', color: KIND_COLORS.planet, r: size, mesh, line, data: p, update(ms) { squeeze(planetHelio(p.id, ms), this.pos); mesh.position.copy(this.pos); mesh.rotation.y += 0.004; } }));
  });
  const earthObj = objects.find((o) => o.id === 'p-earth');
  const jupObj = objects.find((o) => o.id === 'p-jupiter');
  // The Moon in its real direction from Earth (distance squeezed)
  const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 20), new THREE.MeshStandardMaterial({ map: tex('textures/planets/moon.jpg'), roughness: 1 }));
  scene.add(moonMesh);
  objects.push(obj({
    id: 's-moon', name: 'Moon', kind: 'planet', color: KIND_COLORS.planet, r: 0.3, mesh: moonMesh,
    update(ms) {
      const m = moonGeo(ms);
      const u = { x: Math.cos(m.lat * DEG) * Math.cos(m.lon * DEG), y: Math.cos(m.lat * DEG) * Math.sin(m.lon * DEG), z: Math.sin(m.lat * DEG) };
      toThree(u, 1.5, this.pos).add(earthObj.pos);
      moonMesh.position.copy(this.pos);
    },
  }));

  // Spacecraft
  for (const s of catalog.helio) {
    const o = obj({ id: s.id, name: s.name, kind: s.kind, color: KIND_COLORS[s.kind], data: s });
    o.sprite = makeMarker(o.color);
    o.markerPx = 10;
    scene.add(o.sprite);
    if (s.at === 'parker') {
      const el = parkerProbe(now).el;
      o.line = lineFrom(orbitPoints(el, 180).map((v) => squeeze(v)), 0xf472b6, 0.35);
      scene.add(o.line);
    }
    if (s.at === 'escape') {
      // a trail from the inner Solar System out to where the probe is now
      const pts = [];
      for (let k = 0; k <= 60; k++) {
        const p = escapeProbe(s.escape, now);
        const f = k / 60;
        pts.push(squeeze({ x: p.x * f, y: p.y * f, z: p.z * f }));
      }
      o.line = lineFrom(pts, 0xf472b6, 0.25);
      scene.add(o.line);
    }
    o.update = (ms) => {
      const e = planetHelio('earth', ms);
      const er = Math.hypot(e.x, e.y, e.z);
      if (s.at === 'L2' || s.at === 'L1') {
        // 1.5 million km is too small to see at this scale: show it just outside Earth, on the right side
        const f = s.at === 'L2' ? 1 : -1;
        o.pos.copy(earthObj.pos).add(toThree({ x: e.x / er, y: e.y / er, z: 0 }, f * 1.25));
        o.helio = { x: e.x * (1 + f * 0.01), y: e.y * (1 + f * 0.01), z: 0 };
      } else if (s.at === 'parker') {
        o.helio = parkerProbe(ms);
        squeeze(o.helio, o.pos);
      } else if (s.at === 'escape') {
        o.helio = escapeProbe(s.escape, ms);
        squeeze(o.helio, o.pos);
      } else if (s.at === 'jupiter') {
        o.helio = planetHelio('jupiter', ms);
        o.pos.copy(jupObj.pos).add(new THREE.Vector3(jupObj.r + 0.5, 0.3, 0));
      }
      o.sprite.position.copy(o.pos);
    };
    objects.push(o);
  }

  // Famous asteroids: live orbit from NASA NeoWs when we have it
  for (const a of asteroids.famous) {
    const o = obj({ id: `a-${a.id}`, name: a.name, kind: 'asteroid', color: a.active ? '#fb923c' : KIND_COLORS.asteroid, data: a, el: null });
    const approx = { a: a.approx.a, e: a.approx.e, i: a.approx.i, node: a.approx.node, argp: a.approx.peri };
    o.line = lineFrom(orbitPoints(approx, 200).map((v) => squeeze(v)), 0xfbbf24, 0.22);
    scene.add(o.line);
    o.sprite = makeMarker(o.color);
    o.markerPx = 8;
    o.sprite.visible = false;
    scene.add(o.sprite);
    o.update = (ms) => {
      if (!o.el) return;
      o.helio = neoHelio(o.el, ms);
      squeeze(o.helio, o.pos);
      o.sprite.position.copy(o.pos);
    };
    objects.push(o);
  }

  const readout = (o, ms) => {
    const e = planetHelio('earth', ms);
    const fromEarth = (h) => Math.hypot(h.x - e.x, h.y - e.y, h.z - e.z);
    const lt = (au) => {
      const s = (au * AU_KM) / 299792.458;
      return s < 120 ? `${s.toFixed(1)} s` : s < 7200 ? `${(s / 60).toFixed(1)} min` : `${(s / 3600).toFixed(1)} h`;
    };
    if (o.kind === 'planet') {
      const h = o.id === 's-moon' ? e : planetHelio(o.data.id, ms);
      if (o.id === 's-moon') {
        const m = moonGeo(ms);
        const ph = moonPhase(ms);
        return { badge: 'computed', rows: [['Distance from Earth', `${Math.round(m.km).toLocaleString()} km`], ['Phase', `${ph.name} (${Math.round(ph.illum * 100)}% lit)`], ['Light time', lt(m.km / AU_KM)]], action: 'moon' };
      }
      const rows = [['Distance from the Sun', `${Math.hypot(h.x, h.y, h.z).toFixed(3)} au`]];
      if (o.data.id !== 'earth') rows.push(['Distance from Earth', `${(fromEarth(h) * AU_KM / 1e6).toFixed(1)} million km`], ['Radio delay from Earth', lt(fromEarth(h))]);
      rows.push(['Year length', `${o.data.periodDays.toLocaleString()} Earth days`], ['Radius', `${o.data.radiusKm.toLocaleString()} km`]);
      return { badge: 'computed', rows, action: o.data.id === 'mars' ? 'mars' : o.data.id === 'earth' ? 'earth' : null };
    }
    if (o.kind === 'asteroid') {
      if (!o.el) return { badge: 'offline', rows: [['Diameter', `≈ ${o.data.diameterM.toLocaleString()} m`]], note: 'Live orbit from NASA NeoWs not loaded, so only an approximate orbit path is drawn and no position is shown.' };
      const h = neoHelio(o.el, ms);
      return {
        badge: 'live',
        rows: [
          ['Distance from the Sun', `${Math.hypot(h.x, h.y, h.z).toFixed(3)} au`],
          ['Distance from Earth', `${(fromEarth(h) * AU_KM / 1e6).toFixed(1)} million km`],
          ['Diameter', `≈ ${o.data.diameterM.toLocaleString()} m`],
          ['Orbit', `${o.el.a.toFixed(3)} au · e ${o.el.e.toFixed(3)} · ${o.el.i.toFixed(1)}° tilt`],
          ...(o.next ? [['Next close approach', `${o.next.date} · ${Math.round(o.next.missKm).toLocaleString()} km`]] : []),
        ],
        note: `Position from NASA NeoWs orbital elements${o.orbitClass ? ` (${o.orbitClass})` : ''}.`,
      };
    }
    const h = o.helio || { x: 0, y: 0, z: 0 };
    const s = o.data;
    const rows = [];
    if (s.at === 'L2' || s.at === 'L1') rows.push(['Where', `Sun–Earth ${s.at}, ≈ 1.5 million km from Earth`], ['Radio delay', '≈ 5 s']);
    else {
      rows.push(['Distance from the Sun', `${Math.hypot(h.x, h.y, h.z).toFixed(s.at === 'parker' ? 3 : 1)} au`]);
      rows.push(['Distance from Earth', `${fromEarth(h).toFixed(s.at === 'parker' ? 3 : 1)} au`], ['Radio delay', lt(fromEarth(h))]);
    }
    const note = s.at === 'parker' ? 'Distance from the Sun follows Parker\'s real 88-day perihelion schedule; the direction around the Sun is approximate.'
      : s.at === 'escape' ? 'Computed from the probe\'s published distance, speed and direction (accurate to about 1 au).'
      : s.at === 'jupiter' ? 'Juno orbits Jupiter, so it moves with the planet (shown beside it).'
      : 'L1 and L2 are 1% of the Earth–Sun distance from Earth, so the marker is pulled out to be visible.';
    return { badge: 'computed', rows, note };
  };
  return {
    scene, objects, occluders: [],
    near: 0.05, far: 6000, minD: 1.2, maxD: 320,
    home: { pos: [0, 40, 60], target: [0, 0, 0] },
    focusDist: (o) => (o.kind === 'planet' ? Math.max(3, o.r * 4.5) : o.data && o.data.at === 'escape' ? 30 : 5),
    update(ms, dt) {
      sun.rotation.y += dt * 0.03;
      sun.material.uniforms.time.value += dt;
    },
    readout,
    setAsteroidOrbit(id, res) {
      const o = objects.find((x) => x.id === `a-${id}`);
      if (!o || !res || !res.data) return;
      o.el = neoElements(res.data.od);
      o.next = res.data.next;
      o.orbitClass = res.data.od.orbit_class;
      o.liveState = res.state;
      setLinePoints(o.line, orbitPoints(o.el, 240).map((v) => squeeze(v)));
      o.line.material.opacity = o.line.userData.baseOpacity = 0.4;
      o.sprite.visible = true;
    },
  };
}

// ================= EARTH ORBIT (live satellites) =================
const KM = 1 / 1000; // 1 unit = 1,000 km
function sunDirEci(ms) {
  const l = sunEclLon(ms) * DEG;
  return eclToEq({ x: Math.cos(l), y: Math.sin(l), z: 0 });
}
function moonEci(ms) {
  const m = moonGeo(ms);
  const u = { x: Math.cos(m.lat * DEG) * Math.cos(m.lon * DEG), y: Math.cos(m.lat * DEG) * Math.sin(m.lon * DEG), z: Math.sin(m.lat * DEG) };
  const q = eclToEq(u);
  return { x: q.x * m.km, y: q.y * m.km, z: q.z * m.km };
}

function buildEarth() {
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0x1e293b, 0.25));
  const sunLight = new THREE.DirectionalLight(0xffffff, 3.0);
  scene.add(sunLight, sunLight.target);
  scene.add(starSky(3500, 1.0));
  const earth = realEarth(RADIUS_KM.earth * KM);
  scene.add(earth);
  const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(RADIUS_KM.moon * KM, 48, 32), new THREE.MeshStandardMaterial({ map: tex('textures/planets/moon.jpg'), roughness: 1 }));
  scene.add(moonMesh);
  const geoRing = ringLine(42.164, 0x334155, 0.35, 256);
  scene.add(geoRing);

  const objects = [];
  const moonObj = obj({ id: 'e-moon', name: 'Moon', kind: 'planet', color: KIND_COLORS.planet, r: RADIUS_KM.moon * KM, mesh: moonMesh });
  objects.push(moonObj);

  for (const s of catalog.earth) {
    const o = obj({ id: s.id, name: s.name, kind: s.kind, color: KIND_COLORS[s.kind], data: s, satrec: null, liveState: 'offline' });
    o.fallback = orbiterElements(s.id, s.orbit, 'earth');
    o.sprite = makeMarker(o.color);
    o.markerPx = s.kind === 'station' ? 13 : 10;
    o.line = lineFrom([new THREE.Vector3(), new THREE.Vector3()], o.color, 0.22);
    o.eci = { x: 0, y: 0, z: 0 };
    o.vel = null;
    scene.add(o.sprite, o.line);
    objects.push(o);
  }

  // CelesTrak "brightest" group as small points
  let bright = [];
  const brightGeo = new THREE.BufferGeometry();
  const brightPts = new THREE.Points(brightGeo, new THREE.PointsMaterial({ size: 3, sizeAttenuation: false, color: 0xcbd5e1, transparent: true, opacity: 0.85, depthWrite: false }));
  brightPts.visible = false;
  scene.add(brightPts);

  let lastOrbit = 0;
  function eciAt(o, date, ms, gmst) {
    if (o.satrec) {
      const pv = propagate(o.satrec, date);
      if (pv && pv.position) {
        o.vel = pv.velocity;
        return pv.position;
      }
    }
    o.vel = null;
    if (o.data.geoLonDeg !== undefined) {
      const a = gmst + o.data.geoLonDeg * DEG;
      const r = RADIUS_KM.earth + 35786;
      return { x: r * Math.cos(a), y: r * Math.sin(a), z: 0 };
    }
    return orbiterState(o.fallback, 'earth', ms);
  }
  function rebuildOrbits(ms) {
    lastOrbit = ms;
    for (const o of objects) {
      if (!o.data || !o.line) continue;
      const pts = [];
      if (o.satrec) {
        const periodMin = (2 * Math.PI) / o.satrec.no;
        for (let k = 0; k <= 160; k++) {
          const d = new Date(ms + (k / 160) * periodMin * 60e3);
          const pv = propagate(o.satrec, d);
          if (pv && pv.position) pts.push(toThree(pv.position, KM));
        }
      } else if (o.data.geoLonDeg === undefined) {
        for (const v of orbitPoints(o.fallback, 160)) pts.push(toThree(v, KM));
      }
      if (pts.length > 1) setLinePoints(o.line, pts);
      o.line.visible = pts.length > 1;
    }
  }

  function update(ms) {
    const date = new Date(ms);
    const gmst = gstime(date);
    earth.rotation.y = gmst;
    earth.userData.clouds.rotation.y = 0.0;
    const sd = sunDirEci(ms);
    toThree(sd, 200, sunLight.position);
    toThree(moonEci(ms), KM, moonObj.pos);
    moonMesh.position.copy(moonObj.pos);
    // tidally locked: the near side (longitude 0) faces Earth
    moonMesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), moonObj.pos.clone().negate().normalize());
    if (Math.abs(ms - lastOrbit) > 15 * 60e3) rebuildOrbits(ms);
    for (const o of objects) {
      if (!o.data) continue;
      o.eci = eciAt(o, date, ms, gmst);
      toThree(o.eci, KM, o.pos);
      o.sprite.position.copy(o.pos);
    }
    if (brightPts.visible && bright.length) {
      const arr = brightGeo.attributes.position.array;
      for (let i = 0; i < bright.length; i++) {
        const pv = propagate(bright[i].satrec, date);
        if (pv && pv.position) {
          toThree(pv.position, KM, bright[i].pos);
          bright[i].ok = true;
        } else bright[i].ok = false;
        arr[i * 3] = bright[i].pos.x;
        arr[i * 3 + 1] = bright[i].pos.y;
        arr[i * 3 + 2] = bright[i].pos.z;
      }
      brightGeo.attributes.position.needsUpdate = true;
    }
  }

  function geodetic(eci, ms) {
    const g = eciToGeodetic(eci, gstime(new Date(ms)));
    return { lat: degreesLat(g.latitude), lon: degreesLong(g.longitude), h: g.height };
  }
  const fmtLatLon = (g) => `${Math.abs(g.lat).toFixed(1)}°${g.lat >= 0 ? 'N' : 'S'}, ${Math.abs(g.lon).toFixed(1)}°${g.lon >= 0 ? 'E' : 'W'}`;
  function sunlit(eci, ms) {
    const s = sunDirEci(ms);
    const d = eci.x * s.x + eci.y * s.y + eci.z * s.z;
    if (d > 0) return true;
    const perp = Math.hypot(eci.x - d * s.x, eci.y - d * s.y, eci.z - d * s.z);
    return perp > RADIUS_KM.earth;
  }

  const readout = (o, ms) => {
    if (o.id === 'e-moon') {
      const m = moonGeo(ms);
      const ph = moonPhase(ms);
      return { badge: 'computed', rows: [['Distance', `${Math.round(m.km).toLocaleString()} km`], ['Phase', `${ph.name} (${Math.round(ph.illum * 100)}% lit)`]], action: 'moon' };
    }
    if (o.bright) {
      const b = o.bright;
      const pv = propagate(b.satrec, new Date(ms));
      if (!pv || !pv.position) return { badge: 'live', rows: [['NORAD number', String(b.omm.NORAD_CAT_ID)]] };
      const g = geodetic(pv.position, ms);
      const v = Math.hypot(pv.velocity.x, pv.velocity.y, pv.velocity.z);
      return {
        badge: 'live',
        rows: [['Over', fmtLatLon(g)], ['Altitude', `${Math.round(g.h).toLocaleString()} km`], ['Speed', `${v.toFixed(2)} km/s`], ['Orbit tilt', `${(+b.omm.INCLINATION).toFixed(1)}°`], ['Laps per day', (+b.omm.MEAN_MOTION).toFixed(2)], ['NORAD number', String(b.omm.NORAD_CAT_ID)], ['International ID', b.omm.OBJECT_ID]],
        note: `One of CelesTrak's brightest satellites. Elements epoch ${String(b.omm.EPOCH).replace('T', ' ').slice(0, 16)} UTC.`,
      };
    }
    const date = new Date(ms);
    const eci = eciAt(o, date, ms, gstime(date));
    const g = geodetic(eci, ms);
    const r = Math.hypot(eci.x, eci.y, eci.z);
    const speed = o.vel ? Math.hypot(o.vel.x, o.vel.y, o.vel.z) : Math.sqrt(398600.4418 / r);
    const rows = [
      ['Over', fmtLatLon(g)],
      ['Altitude', `${Math.round(g.h).toLocaleString()} km`],
      ['Speed', `${speed.toFixed(2)} km/s (${Math.round(speed * 3600).toLocaleString()} km/h)`],
      ['In sunlight?', sunlit(eci, ms) ? 'Yes ☀' : 'No — in Earth\'s shadow 🌑'],
    ];
    if (o.satrec) {
      rows.push(['Orbit period', `${((2 * Math.PI) / o.satrec.no).toFixed(1)} min`], ['NORAD number', String(o.data.norad)]);
      return { badge: o.liveState === 'stale' ? 'stale' : 'live', rows, note: `Live orbit: CelesTrak elements for ${o.omm.OBJECT_NAME}, epoch ${String(o.omm.EPOCH).replace('T', ' ').slice(0, 16)} UTC, propagated with SGP4 in your browser.` };
    }
    if (o.data.geoLonDeg !== undefined) return { badge: 'computed', rows, note: 'Geostationary: it stays above the same longitude, so its position is known without live data.' };
    return { badge: 'estimate', rows, note: 'Live elements could not be loaded (offline or blocked). The orbit height and tilt are real, but where the satellite is along it is only an estimate.' };
  };

  return {
    scene, objects, occluders: [{ center: new THREE.Vector3(), R: RADIUS_KM.earth * KM }],
    near: 0.02, far: 8000, minD: 7.2, maxD: 900,
    home: { pos: [10, 9, 24], target: [0, 0, 0] },
    focusDist: (o) => (o.id === 'e-moon' ? 7 : o.data && o.data.orbit && o.data.orbit.apoKm > 30000 ? 14 : 4.5),
    update,
    readout,
    setTle(id, res) {
      const o = objects.find((x) => x.id === id);
      if (!o) return;
      if (res && res.satrec) {
        o.satrec = res.satrec;
        o.omm = res.data;
        o.liveState = res.state;
      }
      lastOrbit = -1e15; // rebuild orbit lines next frame
    },
    setBright(list) {
      bright = list.map((b) => ({ ...b, pos: new THREE.Vector3(), ok: false }));
      brightGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bright.length * 3), 3));
      brightGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    },
    showBright(v) {
      brightPts.visible = v;
    },
    extraPick() {
      if (!brightPts.visible) return [];
      return bright.filter((b) => b.ok).map((b) => ({ p: b.pos, ref: b }));
    },
    brightObject(b) {
      return obj({ id: `vis-${b.omm.NORAD_CAT_ID}`, name: b.omm.OBJECT_NAME, kind: 'bright', color: KIND_COLORS.bright, bright: b, pos: b.pos, data: null, label: false });
    },
  };
}

// ================= NEAR-EARTH ASTEROIDS (radar) =================
const radarR = (km) => 10 * Math.log10(1 + km / 40000);
function buildNeo() {
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0x334155, 0.4));
  const sunLight = new THREE.DirectionalLight(0xffffff, 3);
  scene.add(sunLight);
  scene.add(starSky(3000, 0.8));
  const earth = realEarth(1.0); // drawn a little bigger than its log-scale size so you can see it
  scene.add(earth);
  const rings = [];
  for (const [ld, label] of [[1, '1 lunar distance (384,400 km)'], [10, '10 lunar distances'], [100, '100 lunar distances (0.26 au)']]) {
    const R = radarR(ld * LD_KM);
    const l = ringLine(R, ld === 1 ? 0x94a3b8 : 0x475569, ld === 1 ? 0.55 : 0.35, 256);
    scene.add(l);
    rings.push(obj({ id: `ring-${ld}`, name: label, kind: 'poi', color: '#64748b', pickable: false, list: false, ringR: R }));
  }
  const geoR = radarR(42164);
  scene.add(ringLine(geoR, 0x334155, 0.4, 128));
  const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(0.35, 32, 20), new THREE.MeshStandardMaterial({ map: tex('textures/planets/moon.jpg'), roughness: 1 }));
  scene.add(moonMesh);
  const moonObj = obj({ id: 'n-moon', name: 'Moon', kind: 'planet', color: KIND_COLORS.planet, r: 0.35, mesh: moonMesh });
  const objects = [moonObj, ...rings];
  const group = new THREE.Group();
  scene.add(group);

  // real-space position (km, ecliptic frame) of a straight-line flyby
  function flyby(o, ms) {
    const dt = (ms - o.data.t) / 1000;
    return {
      x: o.dir.x * o.data.missKm + o.trav.x * o.data.speedKms * dt,
      y: o.dir.y * o.data.missKm + o.trav.y * o.data.speedKms * dt,
      z: o.dir.z * o.data.missKm + o.trav.z * o.data.speedKms * dt,
    };
  }
  const radarPos = (v, out) => {
    const r = Math.hypot(v.x, v.y, v.z) || 1;
    return toThree(v, radarR(r) / r, out);
  };

  function setNeos(list) {
    for (const o of objects.filter((x) => x.kind === 'asteroid' || x.kind === 'hazardous')) {
      group.remove(o.sprite, o.line);
      o.line.geometry.dispose();
    }
    objects.splice(0, objects.length, moonObj, ...rings);
    const all = [...list, ...asteroids.scheduled.map((s) => ({ id: s.id, name: s.name, t: Date.parse(s.dateUtc), missKm: s.missKm, missLd: s.missKm / LD_KM, speedKms: s.speedKms, dMin: s.diameterM, dMax: s.diameterM, hazardous: s.hazardous, scheduled: true, note: s.note }))];
    for (const a of all) {
      // NeoWs gives distance and speed but not direction, so the direction is a fixed pseudo-random one
      const lon = hashAngle(a.id, 5) * DEG;
      const lat = (hashAngle(a.id, 6) / 360 - 0.5) * 1.0;
      const dir = { x: Math.cos(lat) * Math.cos(lon), y: Math.cos(lat) * Math.sin(lon), z: Math.sin(lat) };
      // travel direction: perpendicular to dir
      const helper = Math.abs(dir.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
      let tx = dir.y * helper.z - dir.z * helper.y, ty = dir.z * helper.x - dir.x * helper.z, tz = dir.x * helper.y - dir.y * helper.x;
      const tl = Math.hypot(tx, ty, tz);
      tx /= tl; ty /= tl; tz /= tl;
      const spin = hashAngle(a.id, 7) * DEG;
      // rotate the travel direction around dir by a random angle
      const bx = dir.y * tz - dir.z * ty, by = dir.z * tx - dir.x * tz, bz = dir.x * ty - dir.y * tx;
      const trav = { x: tx * Math.cos(spin) + bx * Math.sin(spin), y: ty * Math.cos(spin) + by * Math.sin(spin), z: tz * Math.cos(spin) + bz * Math.sin(spin) };
      const color = a.hazardous ? KIND_COLORS.hazardous : KIND_COLORS.asteroid;
      const o = obj({ id: `neo-${a.id}`, name: a.name, kind: a.hazardous ? 'hazardous' : 'asteroid', color, data: a, dir, trav, label: a.missLd < 20 || a.hazardous || a.scheduled });
      o.sprite = makeMarker(color);
      const d = ((a.dMin || 0) + (a.dMax || 0)) / 2;
      o.markerPx = Math.max(7, Math.min(18, 5 + Math.log10(Math.max(d, 1)) * 3.2));
      const pts = [];
      for (let k = -60; k <= 60; k++) pts.push(radarPos(flyby(o, a.t + k * 2 * 3600e3), new THREE.Vector3()));
      o.line = lineFrom(pts, color, 0.28);
      group.add(o.sprite, o.line);
      objects.push(o);
    }
  }

  const update = (ms) => {
    const l = sunEclLon(ms) * DEG;
    toThree({ x: Math.cos(l), y: Math.sin(l), z: 0 }, 100, sunLight.position);
    earth.rotation.y = gstime(new Date(ms));
    const m = moonGeo(ms);
    const u = { x: Math.cos(m.lat * DEG) * Math.cos(m.lon * DEG), y: Math.cos(m.lat * DEG) * Math.sin(m.lon * DEG), z: Math.sin(m.lat * DEG) };
    toThree(u, radarR(m.km), moonObj.pos);
    moonMesh.position.copy(moonObj.pos);
    for (const o of objects) {
      if (o.ringR) o.pos.set(o.ringR * 0.7071, 0, o.ringR * 0.7071);
      if (!o.trav) continue;
      radarPos(flyby(o, ms), o.pos);
      o.sprite.position.copy(o.pos);
      const hrs = Math.abs(ms - o.data.t) / 3600e3;
      o.sprite.visible = hrs < 24 * 6;
      o.line.material.opacity = o.selected ? 0.9 : hrs < 24 * 6 ? o.line.userData.baseOpacity : 0.06;
    }
  };

  const readout = (o, ms) => {
    if (o.id === 'n-moon') return { badge: 'computed', rows: [['Distance', `${Math.round(moonGeo(ms).km).toLocaleString()} km`]], action: 'moon' };
    const a = o.data;
    const p = flyby(o, ms);
    const now = Math.hypot(p.x, p.y, p.z);
    const when = new Date(a.t);
    const dh = (a.t - ms) / 3600e3;
    const rows = [
      ['Closest approach', `${when.toUTCString().slice(5, 22)} UTC (${dh > 0 ? `in ${dh < 48 ? `${dh.toFixed(1)} h` : `${(dh / 24).toFixed(1)} days`}` : `${(-dh < 48 ? `${(-dh).toFixed(1)} h` : `${(-dh / 24).toFixed(1)} days`)} ago`})`],
      ['Miss distance', `${Math.round(a.missKm).toLocaleString()} km (${a.missLd.toFixed(2)} × Moon distance)`],
      ['Speed relative to Earth', `${a.speedKms.toFixed(2)} km/s (${Math.round(a.speedKms * 3600).toLocaleString()} km/h)`],
      ['Size', !a.dMin ? 'unknown' : Math.round(a.dMin) === Math.round(a.dMax) ? `≈ ${Math.round(a.dMin)} m across` : `${Math.round(a.dMin)}–${Math.round(a.dMax)} m across`],
      ['Potentially hazardous?', a.hazardous ? 'Yes (big and its orbit comes close) — but not on a collision course' : 'No'],
      ...(Math.abs(dh) < 24 * 10 ? [['Distance now (approx.)', `${Math.round(now).toLocaleString()} km`]] : []),
    ];
    return {
      badge: a.scheduled ? 'predicted' : o.liveState === 'stale' ? 'stale' : 'live',
      rows,
      url: a.url,
      note: a.scheduled ? a.note : 'Live from NASA NeoWs: time, miss distance, speed and size. NeoWs does not give the direction, so the direction of the path on the radar is illustrative; the distance from Earth is to scale on a log ruler.',
    };
  };
  return {
    scene, objects, occluders: [],
    near: 0.05, far: 6000, minD: 2, maxD: 140,
    home: { pos: [0, 34, 46], target: [0, 0, 0] },
    focusDist: (o) => (o.id === 'n-moon' ? 4 : 6),
    update, readout, setNeos,
  };
}

// ================= MOON =================
function surfaceSprite(o, R) {
  const u = latLonUnit(o.data.lat, o.data.lon);
  toThree(u, R * 1.004, o.pos);
  o.normal = toThree(u, 1);
  o.sprite = makeMarker(o.color);
  o.sprite.position.copy(o.pos);
  o.markerPx = o.kind === 'base' ? 14 : 10;
  o.surface = true;
}
function sunElevation(o, sunDir) {
  return Math.asin(Math.max(-1, Math.min(1, o.normal.dot(sunDir)))) / DEG;
}

function buildMoon() {
  const scene = new THREE.Scene();
  const R = RADIUS_KM.moon * KM;
  scene.add(new THREE.AmbientLight(0x1e293b, 0.12));
  const sunLight = new THREE.DirectionalLight(0xffffff, 3.2);
  scene.add(sunLight);
  const earthshine = new THREE.DirectionalLight(0x9ec5ff, 0.12);
  earthshine.position.set(100, 0, 0);
  scene.add(earthshine);
  scene.add(starSky(3500, 1.0));
  const moon = new THREE.Mesh(new THREE.SphereGeometry(R, 160, 120), new THREE.MeshStandardMaterial({ map: tex('textures/planets/moon.jpg'), roughness: 1, metalness: 0 }));
  scene.add(moon);
  const earth = realEarth(RADIUS_KM.earth * KM);
  scene.add(earth);
  const objects = [];
  const earthObj = obj({ id: 'm-earth', name: 'Earth', kind: 'planet', color: KIND_COLORS.planet, r: RADIUS_KM.earth * KM, mesh: earth });
  objects.push(earthObj);
  for (const s of catalog.moon.sites) {
    const o = obj({ id: s.id, name: s.name, kind: s.kind, color: KIND_COLORS[s.kind], data: s });
    surfaceSprite(o, R);
    scene.add(o.sprite);
    objects.push(o);
  }
  const sunDir = new THREE.Vector3();
  let subsolar = 0;
  for (const s of catalog.moon.orbiters) {
    const o = obj({ id: s.id, name: s.name, kind: s.kind, color: KIND_COLORS[s.kind], data: s });
    o.el = orbiterElements(s.id, s.orbit, 'moon');
    o.sprite = makeMarker(o.color);
    o.markerPx = 10;
    o.line = lineFrom(orbitPoints(o.el, 200).map((v) => toThree(v, KM)), o.color, 0.3);
    scene.add(o.sprite, o.line);
    objects.push(o);
  }
  const update = (ms) => {
    const ph = moonPhase(ms);
    subsolar = ph.subsolarLon;
    toThree(latLonUnit(0, subsolar), 1, sunDir);
    sunLight.position.copy(sunDir).multiplyScalar(100);
    const km = moonGeo(ms).km;
    earthObj.pos.set(km * KM, 0, 0);
    earth.position.copy(earthObj.pos);
    earth.rotation.y = gstime(new Date(ms)) + Math.PI;
    // orbits are fixed in space; the Moon turns under them once a month (measured here against the Sun)
    const turn = subsolar;
    for (const o of objects) {
      if (!o.el) continue;
      const st = orbiterState(o.el, 'moon', ms);
      o.state = st;
      toThree(rotZ(st, turn), KM, o.pos);
      o.sprite.position.copy(o.pos);
      o.line.rotation.y = turn * DEG;
    }
  };
  const readout = (o, ms) => {
    if (o.id === 'm-earth') {
      const m = moonGeo(ms);
      return { badge: 'computed', rows: [['Distance', `${Math.round(m.km).toLocaleString()} km`], ['Radio delay', `${(m.km / 299792.458).toFixed(2)} s`]], note: 'The Moon always keeps the same side facing Earth, so Earth hangs in nearly the same spot in the near-side sky.' };
    }
    if (o.surface) {
      const el = sunElevation(o, sunDir);
      const polar = Math.abs(o.data.lat) > 80;
      const sunTxt = polar && Math.abs(el) < 3 ? `Sun skimming the horizon (${el.toFixed(1)}°) — normal near the pole` : el > 0 ? `Daytime ☀ (Sun ${el.toFixed(0)}° up)` : 'Night 🌑';
      const rows = [['Location', `${Math.abs(o.data.lat).toFixed(2)}°${o.data.lat >= 0 ? 'N' : 'S'}, ${Math.abs(o.data.lon).toFixed(2)}°${o.data.lon >= 0 ? 'E' : 'W'}`], ['Sun right now', sunTxt]];
      if (o.data.landed) rows.push(['Landed', `${new Date(o.data.landed).toUTCString().slice(5, 16)} (${Math.floor((ms - Date.parse(o.data.landed)) / 864e5).toLocaleString()} days ago)`]);
      rows.push(['Side', polar ? 'Polar (on the edge of the side we see)' : Math.abs(o.data.lon) > 90 ? 'Far side (never seen from Earth)' : 'Near side (faces Earth)']);
      return { badge: 'computed', rows, note: 'Day and night are computed from today\'s real Moon phase.', action: o.kind === 'base' ? 'moon' : null };
    }
    const st = o.state || orbiterState(o.el, 'moon', ms);
    return {
      badge: 'model',
      rows: [['Altitude now', `${Math.round(st.altKm).toLocaleString()} km`], ['Speed', `${st.speed.toFixed(2)} km/s`], ['Orbit', `${o.data.orbit.periKm.toLocaleString()} × ${o.data.orbit.apoKm.toLocaleString()} km, ${o.data.orbit.incDeg}° tilt`], ['One lap', o.el.periodS > 86400 * 1.5 ? `${(o.el.periodS / 86400).toFixed(1)} days` : `${(o.el.periodS / 3600).toFixed(1)} h`]],
      note: 'Orbit size, shape, tilt and lap time are the published values. Moon orbiters are not tracked publicly in real time, so the position along the orbit is an estimate.',
    };
  };
  return {
    scene, objects, occluders: [{ center: new THREE.Vector3(), R }],
    near: 0.01, far: 9000, minD: 2.0, maxD: 900,
    home: { pos: [3.2, -4.4, 4.2], target: [0, -0.2, 0] },
    focusDist: (o) => (o.id === 'm-earth' ? 22 : o.surface ? 1.4 : o.id === 'capstone' ? 30 : 1.6),
    update, readout,
  };
}

// ================= MARS =================
function buildMars() {
  const scene = new THREE.Scene();
  const R = RADIUS_KM.mars * KM;
  scene.add(new THREE.AmbientLight(0x2a1d16, 0.18));
  const sunLight = new THREE.DirectionalLight(0xfff1e0, 3.0);
  scene.add(sunLight);
  scene.add(starSky(3500, 1.0));
  const mars = new THREE.Mesh(new THREE.SphereGeometry(R, 160, 120), new THREE.MeshStandardMaterial({ map: tex('textures/planets/mars.jpg'), roughness: 0.95, metalness: 0 }));
  scene.add(mars);
  scene.add(atmosphereShell(R * 1.02, '#e9a77f', 4.0, 0.7));
  const objects = [];
  for (const s of catalog.mars.sites) {
    const o = obj({ id: s.id, name: s.name, kind: s.kind, color: KIND_COLORS[s.kind], data: s });
    surfaceSprite(o, R);
    scene.add(o.sprite);
    objects.push(o);
  }
  for (const s of catalog.mars.orbiters) {
    const o = obj({ id: s.id, name: s.name, kind: s.kind, color: KIND_COLORS[s.kind], data: s });
    o.el = orbiterElements(s.id, s.orbit, 'mars');
    if (s.kind === 'moonlet') {
      o.mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(s.radiusKm * KM * 6, 2), new THREE.MeshStandardMaterial({ color: 0x8a7a6a, roughness: 1, flatShading: true }));
      o.mesh.scale.set(1.25, 0.85, 1);
      scene.add(o.mesh);
      o.r = s.radiusKm * KM * 6;
    }
    o.sprite = makeMarker(o.color);
    o.markerPx = s.kind === 'moonlet' ? 9 : 10;
    o.line = lineFrom(orbitPoints(o.el, 200).map((v) => toThree(v, KM)), o.color, s.kind === 'moonlet' ? 0.25 : 0.3);
    scene.add(o.sprite, o.line);
    objects.push(o);
  }
  const sunDir = new THREE.Vector3();
  let mt = null;
  const update = (ms) => {
    mt = marsTime(ms);
    toThree(latLonUnit(mt.decl, mt.subsolarLonE), 1, sunDir);
    sunLight.position.copy(sunDir).multiplyScalar(100);
    for (const o of objects) {
      if (!o.el) continue;
      const st = orbiterState(o.el, 'mars', ms);
      o.state = st;
      toThree(rotZ(st, mt.subsolarLonE), KM, o.pos);
      o.sprite.position.copy(o.pos);
      o.line.rotation.y = mt.subsolarLonE * DEG;
      if (o.mesh) {
        o.mesh.position.copy(o.pos);
        o.mesh.lookAt(0, 0, 0); // Phobos and Deimos are tidally locked too
      }
    }
  };
  const readout = (o, ms) => {
    const t = marsTime(ms);
    if (o.surface) {
      const lmst = ((t.mtc + o.data.lon / 15) % 24 + 24) % 24;
      const ltst = ((lmst + t.eot / 15) % 24 + 24) % 24;
      const el = sunElevation(o, sunDir);
      const rows = [
        ['Location', `${Math.abs(o.data.lat).toFixed(2)}°${o.data.lat >= 0 ? 'N' : 'S'}, ${Math.abs(o.data.lon).toFixed(2)}°${o.data.lon >= 0 ? 'E' : 'W'}`],
        ['Local time now', `${fmt(ltst)} true solar time (${fmt(lmst)} mean)`],
        ['Sun right now', el > 0 ? `Daytime ☀ (Sun ${el.toFixed(0)}° up)` : 'Night 🌑'],
      ];
      if (o.data.landed) {
        const sol = Math.floor(t.msd + o.data.lon / 360) - Math.floor(marsTime(Date.parse(o.data.landed)).msd + o.data.lon / 360);
        rows.push(['Mission sol', `Sol ${sol.toLocaleString()} (landed ${new Date(o.data.landed).toUTCString().slice(5, 16)})`]);
      }
      return { badge: 'computed', rows, note: 'Local time and sol number come from NASA GISS\'s Mars24 clock, computed for this exact moment.', action: o.id === 'perseverance' ? 'mars' : null };
    }
    const st = o.state || orbiterState(o.el, 'mars', ms);
    return {
      badge: o.kind === 'moonlet' ? 'computed' : 'model',
      rows: [['Altitude now', `${Math.round(st.altKm).toLocaleString()} km`], ['Speed', `${st.speed.toFixed(2)} km/s`], ['Orbit', `${o.data.orbit.periKm.toLocaleString()} × ${o.data.orbit.apoKm.toLocaleString()} km, ${o.data.orbit.incDeg}° tilt`], ['One lap', `${(o.el.periodS / 3600).toFixed(1)} h`]],
      note: o.kind === 'moonlet' ? 'Real orbit size and period; the position along the orbit is approximate. (Moon drawn 6× bigger so you can see it.)' : 'Orbit size, shape, tilt and lap time are the published values. Mars orbiters are not tracked publicly in real time, so the position along the orbit is an estimate.',
    };
  };
  return {
    scene, objects, occluders: [{ center: new THREE.Vector3(), R }],
    near: 0.01, far: 9000, minD: 3.6, maxD: 400,
    home: { pos: [6.5, 4.2, -5.5], target: [0, 0, 0] },
    focusDist: (o) => (o.surface ? 2.2 : o.id === 'hope' ? 90 : o.id === 'deimos' ? 32 : o.id === 'phobos' ? 14 : 3),
    update, readout,
    marsTime: () => mt,
  };
}
const fmt = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;

const BUILDERS = { galaxy: buildGalaxy, solar: buildSolar, earth: buildEarth, neo: buildNeo, moon: buildMoon, mars: buildMars };

// ================= ENGINE =================
export function createExplorer({ canvas, onSelect, onContextLost, reducedMotion }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
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
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 4000);
  const ctx = { renderer, quality };
  const modes = {};
  let mode = null;
  let M = null;
  const placeholder = new THREE.Scene();
  const post = createPost(renderer, placeholder, camera, quality, { worldId: 'space', bloom: 0.55, bloomThreshold: 0.9 });
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.autoRotate = !reducedMotion;
  controls.autoRotateSpeed = 0.25;
  const stopAuto = () => {
    controls.autoRotate = false;
    flying = false;
  };
  controls.addEventListener('start', stopAuto);

  const selRing = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex(), color: 0x7dd3fc, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false }));
  selRing.renderOrder = 6;

  // ---- time ----
  let warp = 1;
  let baseMs = Date.now();
  let basePerf = performance.now();
  const simNow = () => baseMs + (performance.now() - basePerf) * warp;

  let selected = null;
  let focusObj = null;
  let flying = false;
  let flyTarget = new THREE.Vector3();
  let flyDist = 10;
  let flyHome = null;
  let disposed = false;
  let elapsed = 0;
  let last = performance.now();
  const lastFocusPos = new THREE.Vector3();
  const pendingLive = { tle: {}, bright: null, neos: null, orbits: {} };

  function ensure(name) {
    if (!modes[name]) {
      modes[name] = BUILDERS[name](ctx);
      const m = modes[name];
      // apply data that arrived before this view was built
      if (name === 'earth') {
        for (const id in pendingLive.tle) m.setTle(id, pendingLive.tle[id]);
        if (pendingLive.bright) m.setBright(pendingLive.bright);
      }
      if (name === 'neo' && pendingLive.neos) m.setNeos(pendingLive.neos.list, pendingLive.neos.state);
      if (name === 'solar') for (const id in pendingLive.orbits) m.setAsteroidOrbit(id, pendingLive.orbits[id]);
      m.update(simNow(), 0, 0);
    }
    return modes[name];
  }

  function setMode(name) {
    if (mode === name) return;
    if (M) M.scene.remove(selRing);
    mode = name;
    M = ensure(name);
    selected = null;
    focusObj = null;
    M.scene.add(selRing);
    selRing.visible = false;
    post.setScene(M.scene);
    camera.near = M.near;
    camera.far = M.far;
    camera.updateProjectionMatrix();
    controls.minDistance = M.minD * 0.5;
    controls.maxDistance = M.maxD;
    camera.position.set(...M.home.pos).multiplyScalar(1.6);
    controls.target.set(...M.home.target);
    goHome();
  }
  function goHome() {
    focusObj = null;
    flyHome = new THREE.Vector3(...M.home.pos);
    flyTarget.set(...M.home.target);
    flying = true;
    controls.autoRotate = !reducedMotion;
  }
  function focusOn(o) {
    focusObj = o;
    flyHome = null;
    flyTarget.copy(o.pos);
    lastFocusPos.copy(o.pos);
    flyDist = Math.max(M.focusDist(o), (o.r || 0) * 3);
    flying = true;
    controls.autoRotate = false;
  }

  // ---- picking (screen space: small moving objects are easy to tap) ----
  const tmp = new THREE.Vector3();
  function isOccluded(p) {
    for (const oc of M.occluders) {
      const cam = camera.position;
      const d = tmp.copy(p).sub(cam);
      const len = d.length();
      d.divideScalar(len);
      const oc2 = oc.center.clone().sub(cam);
      const t = oc2.dot(d);
      if (t <= 0 || t >= len) continue;
      const dist2 = oc2.lengthSq() - t * t;
      if (dist2 < oc.R * oc.R * 0.995) {
        // inside the sphere's silhouette and in front of the point
        const th = Math.sqrt(oc.R * oc.R - dist2);
        if (t - th < len - 1e-4) return true;
      }
    }
    return false;
  }
  function screenOf(p, rect, out) {
    tmp.copy(p).project(camera);
    out.x = ((tmp.x + 1) / 2) * rect.width;
    out.y = ((1 - tmp.y) / 2) * rect.height;
    out.front = tmp.z < 1 && tmp.z > -1;
    return out;
  }
  const scr = { x: 0, y: 0, front: false };
  function pick(ev) {
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left;
    const my = ev.clientY - rect.top;
    const tol = ev.pointerType === 'touch' ? 30 : 20;
    let best = null;
    let bestD = Infinity;
    const projR = (o) => {
      if (!o.r) return 0;
      const dist = camera.position.distanceTo(o.pos);
      return (o.r / Math.max(dist, 1e-6)) * (rect.height / 2) / Math.tan((camera.fov * Math.PI) / 360);
    };
    for (const o of M.objects) {
      if (!o.pickable) continue;
      if (o.sprite && !o.sprite.visible) continue;
      screenOf(o.pos, rect, scr);
      if (!scr.front) continue;
      const d = Math.hypot(scr.x - mx, scr.y - my);
      const lim = Math.max(tol, projR(o));
      if (d < lim && d < bestD && !isOccluded(o.pos)) {
        best = o;
        bestD = d - (o.r ? 0 : 6); // prefer small markers over big planets behind them
      }
    }
    if (!best && M.extraPick) {
      for (const x of M.extraPick()) {
        screenOf(x.p, rect, scr);
        if (!scr.front) continue;
        const d = Math.hypot(scr.x - mx, scr.y - my);
        if (d < tol * 0.7 && d < bestD && !isOccluded(x.p)) {
          best = M.brightObject(x.ref);
          bestD = d;
        }
      }
    }
    return best;
  }
  let downAt = null;
  const onDown = (ev) => {
    downAt = { x: ev.clientX, y: ev.clientY };
  };
  const onUp = (ev) => {
    if (!downAt) return;
    const moved = Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y);
    downAt = null;
    if (moved > 6) return;
    const o = pick(ev);
    if (o) select(o, true);
  };
  const onMove = (ev) => {
    if (ev.pointerType !== 'mouse' || downAt) return;
    canvas.style.cursor = pick(ev) ? 'pointer' : 'grab';
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointermove', onMove);

  function select(o, fromCanvas) {
    if (selected && selected.line) selected.line.material.opacity = selected.line.userData.baseOpacity;
    if (selected) selected.selected = false;
    selected = o;
    if (o) {
      o.selected = true;
      if (o.line) o.line.material.opacity = 0.95;
      if (!o.list && o.bright) extraSelected = o;
      if (onSelect && fromCanvas) onSelect(o.id, o);
    }
    selRing.visible = !!o;
  }
  let extraSelected = null;
  const find = (id) => M && (M.objects.find((o) => o.id === id) || (extraSelected && extraSelected.id === id ? extraSelected : null));

  // ---- labels ----
  let labelCb = null;
  const labelState = {};

  const markerScale = (px, h) => ((2 * px) / h) * Math.tan((camera.fov * Math.PI) / 360);

  function frame() {
    if (disposed || !M) return;
    const nowPerf = performance.now();
    const dt = Math.min((nowPerf - last) / 1000, 0.1);
    last = nowPerf;
    elapsed += dt;
    const ms = simNow();
    for (const o of M.objects) if (o.update) o.update(ms);
    M.update(ms, dt, elapsed);
    const h = canvas.clientHeight || 1;
    const rect = { width: canvas.clientWidth || 1, height: h };

    // follow the focused object as it moves
    if (focusObj) {
      const delta = tmp.copy(focusObj.pos).sub(lastFocusPos);
      lastFocusPos.copy(focusObj.pos);
      camera.position.add(delta);
      controls.target.add(delta);
      flyTarget.copy(focusObj.pos);
    }
    if (flying) {
      const k = 1 - Math.exp(-dt * 2.8);
      controls.target.lerp(flyTarget, k);
      if (flyHome) {
        camera.position.lerp(flyHome, k * 0.8);
        if (camera.position.distanceTo(flyHome) < 0.02 * flyHome.length()) flying = false;
      } else {
        const off = camera.position.clone().sub(controls.target);
        const len = off.length() + (flyDist - off.length()) * k;
        off.setLength(len);
        camera.position.copy(controls.target).add(off);
        if (Math.abs(len - flyDist) < 0.03 * flyDist && controls.target.distanceTo(flyTarget) < 0.01 * flyDist) flying = false;
      }
    }
    controls.update();

    for (const o of M.objects) {
      if (!o.sprite) continue;
      const hidden = o.surface ? o.normal.dot(tmp.copy(camera.position).sub(o.pos)) < 0 : false;
      o.sprite.material.opacity = hidden ? 0 : 1;
      const px = (o.markerPx || 10) * (o.selected ? 1.35 : 1);
      const s = markerScale(px, h);
      o.sprite.scale.set(s, s, 1);
    }
    if (selected) {
      selRing.position.copy(selected.pos);
      const dist = camera.position.distanceTo(selected.pos);
      const pr = selected.r ? ((selected.r / Math.max(dist, 1e-6)) * (h / 2)) / Math.tan((camera.fov * Math.PI) / 360) : 0;
      const s = markerScale(Math.max(18, pr * 1.25) * (1 + 0.08 * Math.sin(elapsed * 5)), h);
      selRing.scale.set(s * 2, s * 2, 1);
    }

    post.render(dt);
    governor.tick(dt);

    if (labelCb) {
      for (const o of M.objects) {
        if (!o.label) continue;
        screenOf(o.pos, rect, scr);
        const on = scr.front && scr.x > -40 && scr.x < rect.width + 40 && scr.y > -20 && scr.y < rect.height + 20 && !isOccluded(o.pos) && !(o.sprite && !o.sprite.visible);
        const st = labelState[o.id] || (labelState[o.id] = {});
        st.x = scr.x;
        st.y = scr.y;
        st.visible = on;
        st.r = o.r ? ((o.r / Math.max(camera.position.distanceTo(o.pos), 1e-6)) * (h / 2)) / Math.tan((camera.fov * Math.PI) / 360) : 0;
      }
      labelCb(labelState, ms);
    }
  }
  const governor = createGovernor({ renderer, post, quality, onResize: resize, target: 50 });

  function resize() {
    const w = canvas.clientWidth;
    const hh = canvas.clientHeight;
    if (!w || !hh) return;
    renderer.setSize(w, hh, false);
    post.setSize(w, hh);
    camera.aspect = w / hh;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // pause when the dashboard scrolls off screen
  let onScreen = true;
  const io = new IntersectionObserver((e) => {
    onScreen = e[0].isIntersecting;
    renderer.setAnimationLoop(onScreen && !disposed ? frame : null);
  });
  io.observe(canvas);
  renderer.setAnimationLoop(frame);

  return {
    setMode,
    get mode() {
      return mode;
    },
    objects: () => (M ? M.objects.filter((o) => o.list) : []),
    labelObjects: () => (M ? M.objects.filter((o) => o.label) : []),
    select(id) {
      const o = id ? find(id) : null;
      select(o || null, false);
      return o;
    },
    focus(id) {
      const o = find(id);
      if (o) focusOn(o);
    },
    home: () => M && goHome(),
    readout(id) {
      const o = find(id);
      if (!o || !M) return null;
      return { ...M.readout(o, simNow()), name: o.name, kind: o.kind, data: o.data, id: o.id };
    },
    now: simNow,
    get warp() {
      return warp;
    },
    setWarp(w) {
      baseMs = simNow();
      basePerf = performance.now();
      warp = w;
    },
    setTime(ms) {
      baseMs = ms;
      basePerf = performance.now();
    },
    live() {
      baseMs = Date.now();
      basePerf = performance.now();
      warp = 1;
    },
    setTle(id, res) {
      pendingLive.tle[id] = res;
      if (modes.earth) modes.earth.setTle(id, res);
    },
    setBright(list) {
      pendingLive.bright = list;
      if (modes.earth) modes.earth.setBright(list);
    },
    showBright(v) {
      ensure('earth').showBright(v);
    },
    setNeos(list, state) {
      pendingLive.neos = { list, state };
      if (modes.neo) modes.neo.setNeos(list, state);
    },
    setAsteroidOrbit(id, res) {
      pendingLive.orbits[id] = res;
      if (modes.solar) modes.solar.setAsteroidOrbit(id, res);
    },
    marsTime: () => marsTime(simNow()),
    onLabels(cb) {
      labelCb = cb;
    },
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('webglcontextlost', onLost);
      controls.removeEventListener('start', stopAuto);
      controls.dispose();
      for (const k in modes) {
        modes[k].scene.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) o.material.dispose();
        });
      }
      post.dispose();
      renderer.dispose();
    },
  };
}

// used by tests / the info panel
export { keplerXYZ, eqToEcl };
