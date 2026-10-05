// Real space-history objects that belong at these exact places, plus satellites overhead.
// Mars, Jezero Crater: NASA's Ingenuity helicopter (72 flights, a broken rotor blade ended its
//   mission in January 2024) and Perseverance's "Three Forks" sample depot (10 tubes, 2022–23).
// Moon, south pole: a lander lying on its side, like Intuitive Machines' IM-1 "Odysseus",
//   which tipped over near Malapert A in February 2024.
import * as THREE from 'three';
import { glowTexture } from './solarScene.js';

const metal = (c, r = 0.35, m = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });

function ingenuity() {
  // Real size: 0.49 m tall, rotors 1.2 m across.
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), metal('#d9d9d9', 0.5, 0.3));
  body.position.y = 0.2;
  g.add(body);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.38, 6), metal('#c8c8c8'));
    leg.position.set(Math.cos(a) * 0.12, 0.13, Math.sin(a) * 0.12);
    leg.rotation.z = Math.cos(a) * 0.55;
    leg.rotation.x = -Math.sin(a) * 0.55;
    g.add(leg);
  }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 8), metal('#a0a0a0'));
  mast.position.y = 0.4;
  g.add(mast);
  const bladeM = metal('#2b2b2b', 0.6, 0.2);
  for (const [y, rot] of [[0.33, 0.3], [0.41, 1.4]]) {
    for (const side of [-1, 1]) {
      // One blade lost about a quarter of its length on the final flight
      const len = y === 0.41 && side === 1 ? 0.42 : 0.58;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(len, 0.008, 0.07), bladeM);
      blade.position.set((side * len) / 2, y, 0);
      const holder = new THREE.Group();
      holder.add(blade);
      holder.rotation.y = rot;
      g.add(holder);
    }
  }
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.01, 0.2), new THREE.MeshStandardMaterial({ color: '#1e3a8a', metalness: 0.5, roughness: 0.3 }));
  panel.position.y = 0.55;
  g.add(panel);
  return g;
}

function tippedLander() {
  // Hexagonal lander about 4 m tall, lying on its side with legs sticking out
  const g = new THREE.Group();
  const foil = new THREE.MeshStandardMaterial({ color: '#c9a227', metalness: 0.9, roughness: 0.25 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.6, 6), foil);
  g.add(body);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 0.6, 6), metal('#e5e5e5', 0.5, 0.3));
  top.position.y = 1.6;
  g.add(top);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 0.6, 16), metal('#9e9e9e'));
  tank.position.y = -1.6;
  g.add(tank);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 8), metal('#bdbdbd'));
    leg.position.set(Math.cos(a) * 1.1, -1.6, Math.sin(a) * 1.1);
    leg.rotation.z = Math.cos(a) * 0.5;
    leg.rotation.x = -Math.sin(a) * 0.5;
    g.add(leg);
  }
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.6, 1.1), new THREE.MeshStandardMaterial({ color: '#1e3a8a', metalness: 0.5, roughness: 0.3 }));
  panel.position.set(0.93, 0.2, 0);
  g.add(panel);
  // lying on its side
  g.rotation.z = Math.PI / 2 - 0.25;
  g.position.y = 0.85;
  return g;
}

function sampleTube() {
  const g = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 10), metal('#d4d4d8', 0.25, 0.9));
  tube.rotation.z = Math.PI / 2;
  const capM = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.04, 10), new THREE.MeshStandardMaterial({ color: '#f5f5f5' }));
  capM.rotation.z = Math.PI / 2;
  capM.position.x = 0.11;
  g.add(tube, capM);
  // a little survey flag so you can find it
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.9, 6), metal('#e5e7eb'));
  pole.position.set(-0.25, 0.45, 0);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.12), new THREE.MeshStandardMaterial({ color: '#f97316', side: THREE.DoubleSide, emissive: '#7c2d12', emissiveIntensity: 0.4 }));
  flag.position.set(-0.15, 0.84, 0);
  g.add(pole, flag);
  return g;
}

export function buildHeritage(scene, worldId, heightAt) {
  const sites = [];
  const place = (obj, x, z, yOff = 0, rotY = 0) => {
    obj.position.set(x, heightAt(x, z) + (obj.position.y || 0) + yOff, z);
    obj.rotation.y += rotY;
    obj.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    scene.add(obj);
    return obj;
  };

  if (worldId === 'mars') {
    const ing = place(ingenuity(), 27, -31, 0, 0.6);
    const broken = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.008, 0.06), new THREE.MeshStandardMaterial({ color: '#2b2b2b' }));
    place(broken, 28.6, -30.2, 0.01, 1.1);
    sites.push({
      id: 'ingenuity',
      label: 'Ingenuity helicopter (historic site)',
      x: ing.position.x, z: ing.position.z, r: 3,
      title: '🚁 NASA Ingenuity Mars Helicopter',
      text: "On 19 April 2021 Ingenuity made the first powered, controlled flight on another planet. It was planned for 5 flights but made 72, flying about 17 km in total. On its last flight, in January 2024, part of a rotor blade broke off (look nearby). It is only 49 cm tall, and it still sits here in Jezero Crater.",
    });
    const zig = [[-38, 18], [-35, 21], [-32, 18], [-29, 21], [-26, 18], [-23, 21], [-20, 18], [-17, 21], [-14, 18], [-11, 21]];
    zig.forEach(([x, z], i) => place(sampleTube(), x, z, 0.02, i * 0.7));
    sites.push({
      id: 'depot',
      label: 'Sample depot "Three Forks" (historic site)',
      x: -24.5, z: 19.5, r: 9,
      title: '🧪 Perseverance sample depot "Three Forks"',
      text: "Between December 2022 and January 2023, Perseverance dropped 10 titanium sample tubes here in a zig-zag pattern, as a backup set for a future mission to bring Mars rocks back to Earth. They hold rock, regolith, a sample of the air and one 'witness' tube. The orange flags are just to help you find them.",
    });
  } else {
    const l = place(tippedLander(), -38, 34, 0, 0.4);
    sites.push({
      id: 'odysseus',
      label: 'Tipped-over lander (historic site)',
      x: l.position.x, z: l.position.z, r: 7,
      title: '🛰 A lander on its side, like IM-1 "Odysseus"',
      text: "On 22 February 2024, Intuitive Machines' Odysseus became the first private spacecraft to soft-land on the Moon, near Malapert A close to the south pole. A leg caught the surface and it tipped onto its side, but it still sent back data for NASA. Landing on rough, steep polar ground is hard. This is a model of what that looks like.",
    });
  }

  // Satellites crossing the sky (sped up). Real ones: LRO has orbited the Moon since 2009;
  // MRO (2006) and MAVEN (2014) orbit Mars.
  const sats = (worldId === 'moon'
    ? [{ name: 'Lunar Reconnaissance Orbiter (LRO)', note: "NASA's LRO has been mapping the Moon since 2009. Its maps help choose safe, sunny landing sites at the south pole.", period: 110, tilt: 0.3, phase: 0.1 }]
    : [
      { name: 'Mars Reconnaissance Orbiter (MRO)', note: "NASA's MRO has orbited Mars since 2006. Its HiRISE camera can see objects the size of a kitchen table, and it relays rover data to Earth.", period: 120, tilt: 0.25, phase: 0.1 },
      { name: 'MAVEN', note: "NASA's MAVEN (since 2014) studies how Mars lost most of its air to space, which is why the planet is cold and dry today.", period: 170, tilt: -0.5, phase: 0.55 },
    ]
  ).map((s) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,255,1)', 'rgba(200,220,255,.5)'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    sp.scale.set(6, 6, 1);
    scene.add(sp);
    return { ...s, sprite: sp, announced: false };
  });

  return {
    sites,
    // Returns a satellite that has just risen high in the sky (to announce it once per pass)
    update(elapsed, center) {
      let risen = null;
      for (const s of sats) {
        const a = ((elapsed / s.period + s.phase) % 1) * Math.PI * 2; // 0..2π around the sky
        const x = Math.cos(a) * 700;
        const y = Math.sin(a) * 700;
        s.sprite.position.set(center.x + x, y * Math.cos(s.tilt), center.z + y * Math.sin(s.tilt) * 0.8);
        s.sprite.visible = y > 0;
        const high = Math.sin(a) > 0.75;
        if (high && !s.announced) {
          s.announced = true;
          risen = s;
        }
        if (Math.sin(a) < 0) s.announced = false;
      }
      return risen;
    },
  };
}

// Bootprints in the regolith. On the Moon they stay (no wind or rain); on Mars the wind fills them in.
export function createFootprints(scene, worldId, max = 700) {
  const tex = (() => {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, 32, 64);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.ellipse(16, 20, 11, 16, 0, 0, Math.PI * 2);
    ctx.ellipse(16, 48, 9, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 8; y < 60; y += 6) ctx.fillRect(6, y, 20, 2); // tread ridges
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const geo = new THREE.PlaneGeometry(0.13, 0.3);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, fog: true });
  const mesh = new THREE.InstancedMesh(geo, m, max);
  mesh.count = 0;
  mesh.frustumCulled = false;
  scene.add(mesh);
  const born = new Float32Array(max);
  const mats = [];
  let next = 0;
  const tmp = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const life = worldId === 'mars' ? 75 : Infinity;

  return {
    add(x, y, z, heading, side, now) {
      const ox = Math.cos(heading) * 0.12 * side;
      const oz = -Math.sin(heading) * 0.12 * side;
      q.setFromAxisAngle(up, heading);
      tmp.compose(new THREE.Vector3(x + ox, y + 0.02, z + oz), q, new THREE.Vector3(1, 1, 1));
      mesh.setMatrixAt(next, tmp);
      mats[next] = tmp.clone();
      born[next] = now;
      next = (next + 1) % max;
      mesh.count = Math.min(max, mesh.count + 1);
      mesh.instanceMatrix.needsUpdate = true;
    },
    update(now) {
      if (life === Infinity) return;
      let dirty = false;
      for (let i = 0; i < mesh.count; i++) {
        const age = now - born[i];
        if (age > life - 15 && mats[i]) {
          const k = Math.max(0, (life - age) / 15); // shrink away as wind fills them in
          tmp.copy(mats[i]);
          tmp.scale(new THREE.Vector3(k, 1, k));
          mesh.setMatrixAt(i, tmp);
          dirty = true;
        }
      }
      if (dirty) mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
