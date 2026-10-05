// A detailed spacesuit, built from simple shapes and modelled loosely on NASA EVA suits:
// jointed limbs with bearing rings, a life-support backpack (PLSS), a chest display and
// control module, a bubble helmet with a gold sun visor and helmet lights, and red
// commander stripes (NASA marks the EVA lead's suit with red stripes).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { canvasTexture } from './solarScene.js';

let shared = null;
function materials() {
  if (shared) return shared;
  const weave = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f2f2ee';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,.05)';
    for (let i = 0; i < w; i += 4) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke();
    }
    // a few seams
    ctx.strokeStyle = 'rgba(0,0,0,.12)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, h * 0.5); ctx.lineTo(w, h * 0.5); ctx.stroke();
  });
  weave.wrapS = weave.wrapT = THREE.RepeatWrapping;
  weave.repeat.set(2, 2);
  const patch = canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#0b3d91';
    ctx.beginPath(); ctx.arc(64, 64, 62, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('S30S', 64, 76);
    ctx.fillStyle = '#e03c31';
    ctx.beginPath(); ctx.ellipse(64, 96, 40, 6, -0.3, 0, Math.PI * 2); ctx.fill();
  });
  shared = {
    suit: new THREE.MeshStandardMaterial({ color: '#f4f4ef', map: weave, roughness: 0.88, metalness: 0 }),
    hard: new THREE.MeshStandardMaterial({ color: '#e8e8e4', roughness: 0.45, metalness: 0.1 }),
    ring: new THREE.MeshStandardMaterial({ color: '#9aa3ad', roughness: 0.35, metalness: 0.85 }),
    glove: new THREE.MeshStandardMaterial({ color: '#d9d9d2', roughness: 0.8 }),
    boot: new THREE.MeshStandardMaterial({ color: '#cfcfca', roughness: 0.75 }),
    sole: new THREE.MeshStandardMaterial({ color: '#2b2b2b', roughness: 0.95 }),
    stripe: new THREE.MeshStandardMaterial({ color: '#c81e1e', roughness: 0.7 }),
    visor: new THREE.MeshStandardMaterial({ color: '#d4a338', roughness: 0.12, metalness: 1, emissive: '#2a1a00', emissiveIntensity: 0.3 }),
    bubble: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.18, depthWrite: false }),
    dark: new THREE.MeshStandardMaterial({ color: '#30363d', roughness: 0.6, metalness: 0.4 }),
    lamp: new THREE.MeshStandardMaterial({ color: '#fffbe6', emissive: '#fff4c2', emissiveIntensity: 1.6 }),
    screen: new THREE.MeshStandardMaterial({ color: '#0a1a2a', emissive: '#29b6f6', emissiveIntensity: 0.9 }),
    knobR: new THREE.MeshStandardMaterial({ color: '#d32f2f', roughness: 0.5 }),
    knobB: new THREE.MeshStandardMaterial({ color: '#1565c0', roughness: 0.5 }),
    patch: new THREE.MeshStandardMaterial({ map: patch, roughness: 0.8 }),
  };
  return shared;
}

const cap = (r, len, mat) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), mat);
const ring = (r, mat, tube = 0.035) => {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 24), mat);
  m.rotation.x = Math.PI / 2;
  return m;
};

function limb(upperLen, lowerLen, radius, m, stripes, endFn) {
  // pivot (shoulder/hip) -> upper -> joint pivot (elbow/knee) -> lower -> end (glove/boot)
  const top = new THREE.Group();
  const upper = cap(radius, upperLen, m.suit);
  upper.position.y = -upperLen / 2 - radius * 0.4;
  top.add(upper);
  top.add(ring(radius * 1.12, m.ring, 0.04));
  const joint = new THREE.Group();
  joint.position.y = -upperLen - radius * 0.9;
  top.add(joint);
  joint.add(ring(radius * 1.05, m.ring));
  const lower = cap(radius * 0.92, lowerLen, m.suit);
  lower.position.y = -lowerLen / 2 - radius * 0.3;
  joint.add(lower);
  if (stripes) {
    const s1 = ring(radius * 1.02, m.stripe, 0.05);
    s1.position.y = -upperLen * 0.45;
    top.add(s1);
    const s2 = ring(radius * 0.95, m.stripe, 0.045);
    s2.position.y = -lowerLen * 0.45;
    joint.add(s2);
  }
  const end = endFn();
  end.position.y = -lowerLen - radius * 0.7;
  joint.add(end);
  return { top, joint, end };
}

function glove(m) {
  const g = new THREE.Group();
  g.add(ring(0.085, m.ring, 0.025));
  const palm = new THREE.Mesh(new RoundedBoxGeometry(0.15, 0.17, 0.08, 3, 0.03), m.glove);
  palm.position.y = -0.1;
  g.add(palm);
  for (let i = 0; i < 4; i++) {
    const f = cap(0.018, 0.07, m.glove);
    f.position.set(-0.05 + i * 0.033, -0.22, 0.005);
    g.add(f);
  }
  const thumb = cap(0.02, 0.06, m.glove);
  thumb.position.set(0.085, -0.13, 0.02);
  thumb.rotation.z = 0.6;
  g.add(thumb);
  return g;
}

function boot(m) {
  const g = new THREE.Group();
  g.add(ring(0.11, m.ring, 0.03));
  const b = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.2, 0.36, 3, 0.06), m.boot);
  b.position.set(0, -0.12, 0.06);
  g.add(b);
  const sole = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.06, 0.4, 2, 0.02), m.sole);
  sole.position.set(0, -0.23, 0.06);
  g.add(sole);
  return g;
}

export function createAstronaut({ commander = false, bandColor = null, skin = '#c99a76', hair = '#2a1d14' } = {}) {
  const m = materials();
  const band = bandColor ? new THREE.MeshStandardMaterial({ color: bandColor, roughness: 0.6, emissive: bandColor, emissiveIntensity: 0.15 }) : null;
  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 1.0;
  root.add(hips);

  // Torso (hard upper torso + soft waist)
  const waist = cap(0.21, 0.12, m.suit);
  waist.position.y = 0.05;
  hips.add(waist);
  const belt = ring(0.23, m.ring, 0.04);
  belt.position.y = 0.17;
  hips.add(belt);
  const torso = new THREE.Group();
  torso.position.y = 0.22;
  hips.add(torso);
  const hut = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.5, 0.36, 4, 0.14), m.hard);
  hut.position.y = 0.25;
  torso.add(hut);

  // Chest display and control module
  const dcm = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.14, 0.12, 2, 0.03), m.hard);
  dcm.position.set(0, 0.2, 0.22);
  torso.add(dcm);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.06), m.screen);
  scr.position.set(-0.05, 0.22, 0.285);
  scr.rotation.x = -0.4;
  torso.add(scr);
  [[0.07, m.knobR], [0.11, m.knobB]].forEach(([x, mat]) => {
    const k = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 10), mat);
    k.rotation.x = Math.PI / 2;
    k.position.set(x, 0.2, 0.29);
    torso.add(k);
  });
  const hoseL = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.015, 6, 14, Math.PI), m.dark);
  hoseL.position.set(-0.17, 0.13, 0.2);
  hoseL.rotation.set(0, Math.PI / 2, 0.4);
  torso.add(hoseL);

  // Mission patch on the shoulder
  const pat = new THREE.Mesh(new THREE.CircleGeometry(0.06, 20), m.patch);
  pat.position.set(-0.285, 0.35, 0.03);
  pat.rotation.y = -Math.PI / 2;
  torso.add(pat);

  // Life-support backpack (PLSS)
  const plss = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.62, 0.24, 4, 0.06), m.hard);
  plss.position.set(0, 0.27, -0.3);
  torso.add(plss);
  for (let i = 0; i < 4; i++) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.015, 0.02), m.dark);
    vent.position.set(0, 0.08 + i * 0.05, -0.425);
    torso.add(vent);
  }
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.35, 6), m.ring);
  ant.position.set(0.2, 0.75, -0.32);
  torso.add(ant);

  // Helmet: neck ring, bubble, visor housing, gold visor, two lamps
  const head = new THREE.Group();
  head.position.y = 0.62;
  torso.add(head);
  head.add(ring(0.17, m.ring, 0.04));
  const helmetG = new THREE.Group();
  head.add(helmetG);
  // Bare head for inside the habitat (helmet off)
  const bare = new THREE.Group();
  bare.visible = false;
  head.add(bare);
  {
    const skinM = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.75 });
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 14), skinM);
    face.scale.set(1, 1.15, 1.05);
    face.position.y = 0.16;
    bare.add(face);
    const neck = cap(0.05, 0.05, skinM);
    neck.position.y = 0.04;
    bare.add(neck);
    const hairM = new THREE.MeshStandardMaterial({ color: hair, roughness: 0.9 });
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.122, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM);
    hairCap.position.set(0, 0.19, -0.012);
    hairCap.rotation.x = -0.25;
    bare.add(hairCap);
    const eyeM = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.3 });
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), eyeM);
      eye.position.set(sx * 0.04, 0.18, 0.112);
      bare.add(eye);
    }
  }
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.23, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.62), m.hard);
  shell.position.y = 0.17;
  shell.rotation.x = -0.35;
  helmetG.add(shell);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.215, 28, 18, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.18, Math.PI * 0.52), m.visor);
  visor.position.set(0, 0.17, 0.01);
  helmetG.add(visor);
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.235, 28, 18), m.bubble);
  bubble.position.y = 0.17;
  helmetG.add(bubble);
  for (const sx of [-1, 1]) {
    const housing = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.05, 0.08, 2, 0.015), m.hard);
    housing.position.set(sx * 0.2, 0.3, 0.06);
    helmetG.add(housing);
    const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.018, 12), m.lamp);
    lamp.position.set(sx * 0.2, 0.3, 0.101);
    helmetG.add(lamp);
  }

  // Arms
  const armL = limb(0.24, 0.22, 0.075, m, commander, () => glove(m));
  const armR = limb(0.24, 0.22, 0.075, m, commander, () => glove(m));
  armL.top.position.set(-0.36, 0.4, 0);
  armR.top.position.set(0.36, 0.4, 0);
  armL.top.rotation.z = 0.12;
  armR.top.rotation.z = -0.12;
  torso.add(armL.top, armR.top);
  for (const sx of [-1, 1]) {
    const sb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), m.hard);
    sb.position.set(sx * 0.33, 0.42, 0);
    torso.add(sb);
  }

  // Legs
  const legL = limb(0.34, 0.32, 0.095, m, commander, () => boot(m));
  const legR = limb(0.34, 0.32, 0.095, m, commander, () => boot(m));
  legL.top.position.set(-0.13, -0.02, 0);
  legR.top.position.set(0.13, -0.02, 0);
  hips.add(legL.top, legR.top);

  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  // Crew colour bands on the upper arms and a chest stripe, so you can tell juniors apart
  if (band) {
    for (const arm of [armL, armR]) {
      const b = ring(0.083, band, 0.03);
      b.position.y = -0.12;
      arm.top.add(b);
    }
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.02), band);
    chest.position.set(0, 0.44, 0.185);
    torso.add(chest);
    const packStripe = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.02), band);
    packStripe.position.set(0, 0.5, -0.425);
    torso.add(packStripe);
  }

  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  root.userData.rig = { hips, torso, head, armL, armR, legL, legR, helmetG, bare, handR: armR.end, prop: null };
  return root;
}

export function setHelmet(a, on) {
  const r = a.userData.rig;
  r.helmetG.visible = on;
  r.bare.visible = !on;
}

// Hand-held tools for crew tasks
const PROP_BUILDERS = {
  shovel: () => {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.9, 8), new THREE.MeshStandardMaterial({ color: '#8b9097', metalness: 0.7, roughness: 0.4 }));
    shaft.position.y = -0.35;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.25, 0.02), new THREE.MeshStandardMaterial({ color: '#c0c4c9', metalness: 0.8, roughness: 0.3 }));
    blade.position.y = -0.85;
    g.add(shaft, blade);
    return g;
  },
  brush: () => {
    const g = new THREE.Group();
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 8), new THREE.MeshStandardMaterial({ color: '#334155' }));
    h.position.y = -0.2;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.08), new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.9 }));
    head.position.y = -0.45;
    g.add(h, head);
    return g;
  },
  wrench: () => {
    const g = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.26, 0.02), new THREE.MeshStandardMaterial({ color: '#9ca3af', metalness: 0.9, roughness: 0.3 }));
    g.position.y = -0.15;
    return g;
  },
  bag: () => {
    const g = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.06), new THREE.MeshStandardMaterial({ color: '#e5e7eb', roughness: 0.9, transparent: true, opacity: 0.85 }));
    g.position.y = -0.18;
    return g;
  },
  tablet: () => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.015), new THREE.MeshStandardMaterial({ color: '#1f2937' }));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.12), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#38bdf8', emissiveIntensity: 1 }));
    scr.position.z = 0.009;
    g.add(body, scr);
    g.position.set(0, -0.15, 0.06);
    g.rotation.x = -0.6;
    return g;
  },
  can: () => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.16, 12), new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.5 }));
    body.position.y = -0.2;
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.015, 0.16, 6), new THREE.MeshStandardMaterial({ color: '#15803d' }));
    spout.position.set(0, -0.17, 0.1);
    spout.rotation.x = 1.1;
    g.add(body, spout);
    return g;
  },
};

export function setProp(a, kind) {
  const r = a.userData.rig;
  if (r.prop) {
    r.handR.remove(r.prop);
    r.prop = null;
  }
  if (kind && PROP_BUILDERS[kind]) {
    r.prop = PROP_BUILDERS[kind]();
    r.handR.add(r.prop);
  }
}

// Working poses: kneel (greenhouse, samples), shovel, work (brushing panels), type (console), rest (lying down)
export function poseAstronaut(a, t, pose) {
  const r = a.userData.rig;
  const reset = () => {
    for (const limbPart of [r.legL, r.legR, r.armL, r.armR]) {
      limbPart.top.rotation.x = 0;
      limbPart.joint.rotation.x = 0;
    }
    r.armL.top.rotation.z = 0.12;
    r.armR.top.rotation.z = -0.12;
    r.torso.rotation.set(0, 0, 0);
    r.head.rotation.set(0, 0, 0);
    r.hips.position.y = 1.0;
  };
  reset();
  const w = Math.sin(t * 3);
  if (pose === 'kneel') {
    r.hips.position.y = 0.56;
    r.legL.top.rotation.x = -1.35;
    r.legL.joint.rotation.x = 1.4;
    r.legR.top.rotation.x = 0.15;
    r.legR.joint.rotation.x = 1.55;
    r.torso.rotation.x = 0.35;
    r.armR.top.rotation.x = -0.9 + w * 0.25;
    r.armR.joint.rotation.x = -0.5;
    r.armL.top.rotation.x = -0.7 - w * 0.15;
    r.armL.joint.rotation.x = -0.6;
    r.head.rotation.x = 0.35;
  } else if (pose === 'shovel') {
    const d = Math.sin(t * 2.2);
    r.hips.position.y = 0.94;
    r.legL.top.rotation.x = -0.3;
    r.legL.joint.rotation.x = 0.4;
    r.legR.top.rotation.x = 0.1;
    r.legR.joint.rotation.x = 0.3;
    r.torso.rotation.x = 0.35 + d * 0.25;
    r.armR.top.rotation.x = -0.9 + d * 0.45;
    r.armL.top.rotation.x = -1.1 + d * 0.45;
    r.armR.joint.rotation.x = -0.4;
    r.armL.joint.rotation.x = -0.7;
  } else if (pose === 'work') {
    const b = Math.sin(t * 4);
    r.torso.rotation.x = 0.15;
    r.armR.top.rotation.x = -1.25 + b * 0.15;
    r.armR.top.rotation.z = -0.15 + b * 0.35;
    r.armR.joint.rotation.x = -0.3;
    r.armL.top.rotation.x = -0.5;
    r.armL.joint.rotation.x = -0.9;
    r.head.rotation.x = 0.2;
  } else if (pose === 'type') {
    const f = Math.sin(t * 9) * 0.05;
    r.armR.top.rotation.x = -0.75 + f;
    r.armL.top.rotation.x = -0.75 - f;
    r.armR.joint.rotation.x = -0.75;
    r.armL.joint.rotation.x = -0.75;
    r.head.rotation.x = 0.25;
  } else if (pose === 'rest') {
    const b = Math.sin(t * 1.2) * 0.02;
    r.armL.top.rotation.x = 0.1;
    r.armR.top.rotation.x = 0.1 + b;
    r.head.rotation.y = 0.3;
  }
}

// Walk cycle: speed 0 = idle (breathing), 1 = walking, 2 = loping.
// Low gravity -> longer, floatier strides.
export function animateAstronaut(a, t, speed, gravity = 1.62) {
  const r = a.userData.rig;
  const low = gravity < 2.5;
  const f = (low ? 5.2 : 6.4) * Math.max(0.6, speed);
  const s = Math.sin(t * f);
  const amp = Math.min(1, speed) * (low ? 0.6 : 0.5);
  r.legL.top.rotation.x = s * amp;
  r.legR.top.rotation.x = -s * amp;
  r.legL.joint.rotation.x = Math.max(0, -s) * amp * 1.1;
  r.legR.joint.rotation.x = Math.max(0, s) * amp * 1.1;
  r.armL.top.rotation.x = -s * amp * 0.6;
  r.armR.top.rotation.x = s * amp * 0.6;
  r.armL.joint.rotation.x = -0.35 - Math.abs(s) * 0.2 * speed;
  r.armR.joint.rotation.x = -0.35 - Math.abs(s) * 0.2 * speed;
  const breathe = Math.sin(t * 1.6) * 0.008;
  r.hips.position.y = 1.0 + Math.abs(s) * 0.05 * speed * (low ? 2.2 : 1) + breathe;
  r.torso.rotation.y = s * 0.05 * speed;
  r.head.rotation.y = Math.sin(t * 0.4) * 0.25;
}
