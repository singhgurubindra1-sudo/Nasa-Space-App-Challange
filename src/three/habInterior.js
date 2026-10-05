// The inside of the habitat: one long module with working stations.
// It sits underground (below the terrain), so it is fully enclosed; the player and crew are
// moved here when they cycle through the airlock.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { canvasTexture } from './solarScene.js';

export const INTERIOR_ORIGIN = new THREE.Vector3(0, -200, 0);
const R = 2.4; // module radius
const CY = 1.55; // module axis height above the floor
const HALF = 10; // half length

function screenTex(lines, accent = '#38bdf8', bg = '#04121f') {
  return canvasTexture(256, 160, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = accent;
    ctx.font = 'bold 20px monospace';
    lines.forEach((l, i) => ctx.fillText(l, 16, 34 + i * 28));
  });
}

const mat = {
  wall: null,
  floor: null,
  white: () => new THREE.MeshStandardMaterial({ color: '#eceff1', roughness: 0.6 }),
  grey: () => new THREE.MeshStandardMaterial({ color: '#90a4ae', roughness: 0.5, metalness: 0.5 }),
  dark: () => new THREE.MeshStandardMaterial({ color: '#263238', roughness: 0.6, metalness: 0.3 }),
  screen: (lines, accent) => new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffffff', emissiveIntensity: 0.9, emissiveMap: screenTex(lines, accent) }),
};

function box(w, h, d, m, x, y, z) {
  const b = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.15), m);
  b.position.set(x, y, z);
  return b;
}

function screen(lines, accent, w, h, x, y, z, rotY) {
  const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat.screen(lines, accent));
  s.position.set(x, y, z);
  s.rotation.y = rotY;
  return s;
}

export function buildInterior(scene, worldId) {
  const g = new THREE.Group();
  g.position.copy(INTERIOR_ORIGIN);
  scene.add(g);

  // Shell, floor, end caps
  const wallTex = canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#e3e8ec';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(80,90,100,.35)';
    ctx.lineWidth = 3;
    for (let x = 0; x <= w; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y <= h; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(30,136,229,.7)';
    for (let x = 20; x < w; x += 128) ctx.fillRect(x, 120, 30, 6);
  });
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
  wallTex.repeat.set(5, 2);
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(R, R, HALF * 2, 40, 1, true), new THREE.MeshStandardMaterial({ map: wallTex, side: THREE.BackSide, roughness: 0.7 }));
  shell.rotation.z = Math.PI / 2;
  shell.position.y = CY;
  g.add(shell);
  for (const sx of [-1, 1]) {
    const capM = new THREE.Mesh(new THREE.CircleGeometry(R, 40), new THREE.MeshStandardMaterial({ color: '#cfd8dc', roughness: 0.7, side: THREE.DoubleSide }));
    capM.position.set(sx * HALF, CY, 0);
    capM.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
    g.add(capM);
  }
  const floorTex = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#37474f';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#263238';
    ctx.lineWidth = 4;
    for (let i = 0; i <= w; i += 32) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke(); }
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(w, 8); ctx.stroke();
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(10, 2);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, 3.7), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 }));
  floor.rotation.x = -Math.PI / 2;
  g.add(floor);
  // Ceiling light strip + lights
  const strip = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 - 1, 0.04, 0.35), new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fff6e0', emissiveIntensity: 1.6 }));
  strip.position.set(0, CY + R - 0.08, 0);
  g.add(strip);
  for (const x of [-7.5, -2.5, 2.5, 7.5]) {
    const l = new THREE.PointLight('#fff1d6', 9, 11, 1.6);
    l.position.set(x, 2.8, 0);
    g.add(l);
  }
  // Handrails along both walls (like on the ISS)
  for (const sz of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, HALF * 2 - 1, 8), new THREE.MeshStandardMaterial({ color: '#ffb300', roughness: 0.5 }));
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0, 2.3, sz * 1.55);
    g.add(rail);
  }

  const stations = [];
  const add = (id, label, x, z, face, objs) => {
    objs.forEach((o) => g.add(o));
    stations.push({ id, label, x: INTERIOR_ORIGIN.x + x, z: INTERIOR_ORIGIN.z + z, r: 1.4, standX: x, standZ: Math.sign(z) * 0.62, face });
  };
  const W = 1.45; // station depth from centre line

  // Airlock door (west end)
  const hatch = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.09, 10, 32), mat.grey());
  hatch.position.set(-HALF + 0.05, 1.15, 0);
  hatch.rotation.y = Math.PI / 2;
  const hatchDoor = new THREE.Mesh(new THREE.CircleGeometry(0.82, 32), mat.white());
  hatchDoor.position.set(-HALF + 0.06, 1.15, 0);
  hatchDoor.rotation.y = Math.PI / 2;
  const hatchSign = screen(['AIRLOCK', 'EXIT TO SURFACE'], '#facc15', 0.8, 0.3, -HALF + 0.07, 2.25, 0, Math.PI / 2);
  stations.push({ id: 'exitHab', label: 'Go out through the airlock', x: INTERIOR_ORIGIN.x - HALF + 0.9, z: INTERIOR_ORIGIN.z, r: 1.5, standX: -HALF + 0.9, standZ: 0 });
  g.add(hatch, hatchDoor, hatchSign);

  // Life support rack (O2 generator + water recycler)
  const ls = [
    box(1.5, 2.0, 0.5, mat.white(), -6, 1.0, W),
    screen(['O2 GENERATOR', 'WATER RECOVERY', 'CO2 SCRUBBER'], '#4ade80', 0.9, 0.55, -6, 1.45, W - 0.26, Math.PI),
  ];
  for (let i = 0; i < 2; i++) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.8, 16), new THREE.MeshStandardMaterial({ color: i ? '#42a5f5' : '#e0e0e0', metalness: 0.6, roughness: 0.3 }));
    tank.position.set(-6.5 + i, 0.45, W - 0.35);
    ls.push(tank);
  }
  add('lifeSupport', 'Check life support', -6, W, Math.PI, ls);

  // Comms station
  add('comms', 'Call mission control', -6, -W, 0, [
    box(1.3, 0.08, 0.6, mat.grey(), -6, 0.85, -W + 0.1),
    box(0.1, 0.85, 0.1, mat.grey(), -6, 0.42, -W + 0.1),
    screen(['MISSION CONTROL', worldId === 'moon' ? 'DELAY 1.3 s' : 'DELAY ~4-24 min', 'LINK OK'], '#38bdf8', 1.0, 0.6, -6, 1.5, -W + 0.27, 0),
  ]);

  // Galley
  const galley = [
    box(1.2, 0.06, 0.8, mat.white(), -2, 0.8, W - 0.15),
    box(0.1, 0.8, 0.1, mat.grey(), -2, 0.4, W - 0.15),
    box(1.4, 0.6, 0.4, mat.white(), -2, 1.9, W + 0.05),
  ];
  const packColors = ['#ef5350', '#ffca28', '#66bb6a', '#42a5f5'];
  packColors.forEach((c, i) => galley.push(box(0.14, 0.03, 0.2, new THREE.MeshStandardMaterial({ color: c }), -2.4 + i * 0.27, 0.85, W - 0.2)));
  add('galley', 'Share a meal with the crew', -2, W, Math.PI, galley);

  // Medical bay
  const crossTex = canvasTexture(64, 64, (ctx) => {
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#e53935'; ctx.fillRect(24, 8, 16, 48); ctx.fillRect(8, 24, 48, 16);
  });
  const cross = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshStandardMaterial({ map: crossTex }));
  cross.position.set(-2, 1.9, -W + 0.22);
  add('medical', 'Medical check', -2, -W, 0, [box(1.2, 1.4, 0.4, mat.white(), -2, 0.7, -W - 0.02), cross]);

  // Lab bench with microscope and sample trays
  const lab = [box(1.6, 0.08, 0.7, mat.white(), 2, 0.9, W - 0.1), box(1.6, 0.85, 0.6, mat.grey(), 2, 0.43, W - 0.05)];
  const scope = new THREE.Group();
  const sbase = box(0.25, 0.05, 0.25, mat.dark(), 0, 0, 0);
  const sarm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 8), mat.dark());
  sarm.position.y = 0.18;
  const seye = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.18, 10), mat.dark());
  seye.position.set(0, 0.34, 0.05);
  seye.rotation.x = 0.6;
  scope.add(sbase, sarm, seye);
  scope.position.set(1.6, 0.97, W - 0.15);
  lab.push(scope);
  for (let i = 0; i < 5; i++) lab.push(box(0.12, 0.04, 0.12, new THREE.MeshStandardMaterial({ color: ['#8d6e63', '#a1887f', '#795548', '#bcaaa4', '#6d4c41'][i] }), 2 + i * 0.16, 0.97, W - 0.2));
  lab.push(screen(['SAMPLE ANALYSER', 'XRF / RAMAN'], '#f472b6', 0.7, 0.4, 2.6, 1.55, W + 0.05 - 0.3, Math.PI));
  add('lab', 'Analyse scanned rock samples', 2, W, Math.PI, lab);

  // Exercise bike (like the ISS CEVIS cycle)
  const bike = new THREE.Group();
  bike.add(box(0.9, 0.08, 0.3, mat.dark(), 0, 0.1, 0));
  const fly = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.06, 24), mat.grey());
  fly.rotation.x = Math.PI / 2;
  fly.position.set(0.25, 0.35, 0);
  const seat = box(0.25, 0.06, 0.2, mat.dark(), -0.25, 0.8, 0);
  const post = box(0.05, 0.7, 0.05, mat.grey(), -0.25, 0.45, 0);
  const bars = box(0.05, 0.05, 0.4, mat.grey(), 0.3, 0.95, 0);
  const stem = box(0.05, 0.6, 0.05, mat.grey(), 0.3, 0.65, 0);
  bike.add(fly, seat, post, bars, stem);
  bike.position.set(2, 0, -W + 0.4);
  add('exercise', 'Exercise on the bike', 2, -W, 0, [bike]);

  // Sleep pods (3 bunks)
  const pods = [];
  const podObjs = [];
  for (let i = 0; i < 3; i++) {
    const px = 4.8 + i * 1.5;
    podObjs.push(box(1.35, 0.1, 0.85, mat.white(), px, 0.6, W - 0.05));
    podObjs.push(box(1.35, 0.12, 0.8, new THREE.MeshStandardMaterial({ color: ['#2e7d32', '#ef6c00', '#1565c0'][i], roughness: 0.9 }), px, 0.71, W - 0.05));
    podObjs.push(box(1.4, 1.7, 0.06, new THREE.MeshStandardMaterial({ color: '#b0bec5' }), px, 1.1, W + 0.35));
    podObjs.push(box(0.05, 1.7, 0.9, new THREE.MeshStandardMaterial({ color: '#b0bec5' }), px - 0.72, 1.1, W - 0.05));
    pods.push({ x: INTERIOR_ORIGIN.x + px, y: INTERIOR_ORIGIN.y + 0.78, z: INTERIOR_ORIGIN.z + W - 0.05 });
  }
  add('pods', 'Crew quarters', 6.3, W, Math.PI, podObjs);

  // Command console
  add('command', 'Command console: give crew orders', 7, -W, 0, [
    box(1.6, 0.9, 0.5, mat.grey(), 7, 0.45, -W + 0.05),
    screen(['CREW STATUS', 'ASHA  LEO  MEI', 'TASK BOARD'], '#facc15', 1.4, 0.75, 7, 1.55, -W + 0.27, 0),
  ]);

  // Viewport window at the east end, painted with the view outside
  const view = canvasTexture(256, 256, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.6);
    if (worldId === 'mars') {
      sky.addColorStop(0, '#b98a62');
      sky.addColorStop(1, '#e0b083');
    } else {
      sky.addColorStop(0, '#000');
      sky.addColorStop(1, '#05060a');
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    if (worldId === 'moon') {
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 60; i++) ctx.fillRect((i * 97) % w, (i * 53) % (h * 0.55), 1.5, 1.5);
      ctx.fillStyle = '#3f7fd9';
      ctx.beginPath(); ctx.arc(w * 0.7, h * 0.4, 14, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = worldId === 'mars' ? '#9c5530' : '#777';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.6);
    for (let x = 0; x <= w; x += 16) ctx.lineTo(x, h * 0.58 - Math.sin(x * 0.03) * 12 - (x > w * 0.3 && x < w * 0.6 ? 25 : 0));
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.fill();
  });
  const win = new THREE.Mesh(new THREE.CircleGeometry(0.75, 40), new THREE.MeshBasicMaterial({ map: view }));
  win.position.set(HALF - 0.04, 1.5, 0);
  win.rotation.y = -Math.PI / 2;
  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.08, 10, 40), mat.grey());
  frame.position.copy(win.position);
  frame.rotation.y = -Math.PI / 2;
  stations.push({ id: 'window', label: 'Look out of the window', x: INTERIOR_ORIGIN.x + HALF - 1, z: INTERIOR_ORIGIN.z, r: 1.4, standX: HALF - 1, standZ: 0 });
  g.add(win, frame);

  g.traverse((o) => {
    if (o.isMesh) o.receiveShadow = true;
  });

  return {
    group: g,
    stations,
    pods,
    bounds: { minX: INTERIOR_ORIGIN.x - HALF + 0.55, maxX: INTERIOR_ORIGIN.x + HALF - 0.55, minZ: INTERIOR_ORIGIN.z - 0.95, maxZ: INTERIOR_ORIGIN.z + 0.95 },
    floorY: INTERIOR_ORIGIN.y,
    door: { x: INTERIOR_ORIGIN.x - HALF + 1.2, z: INTERIOR_ORIGIN.z },
    contains(x, z, y) {
      return y < INTERIOR_ORIGIN.y + 50 && Math.abs(x - INTERIOR_ORIGIN.x) < HALF + 1 && Math.abs(z - INTERIOR_ORIGIN.z) < R + 1;
    },
  };
}
