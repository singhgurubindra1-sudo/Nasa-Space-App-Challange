// First-person EVA simulation: walk the base as the commander, scan rocks, use the greenhouse
// console, and drive the pressurized rover. Real surface gravity drives every jump and bounce.
import * as THREE from 'three';
import { buildWorld } from './world.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { tex } from './assets.js';
import { createPost } from './post.js';
import { getQuality } from './quality.js';
import { buildInterior } from './habInterior.js';
import { buildHeritage, createFootprints } from './heritage.js';
import { createCrewSim } from './crewSim.js';
import { targetDistance, daysSinceJ2000, formatDelay } from '../engine/orbits.js';
import { sound } from '../audio/sound.js';

const ROCK_FACTS = {
  mars: [
    { name: 'Basalt', text: "Dark volcanic rock. Perseverance found that Jezero's crater floor is made of igneous rock that formed from cooled lava." },
    { name: 'Olivine-rich rock', text: "Like the 'Séítah' rocks Perseverance studied: full of olivine, a green mineral that crystallizes out of magma." },
    { name: 'Layered sedimentary rock', text: 'Laid down in water. About 3.5 billion years ago Jezero held a lake fed by a river delta.' },
    { name: 'Carbonate-bearing rock', text: 'Carbonate minerals form in water. Rocks like this from the Jezero delta are top targets in the search for signs of ancient life.' },
    { name: 'Iron-oxide dust', text: 'Martian dust is a fine powder of iron oxide (rust). That is why Mars looks red.' },
    { name: 'Hematite spherules', text: "Tiny iron-rich 'blueberries' like the ones Opportunity found at Meridiani Planum: a clue that water once soaked the ground." },
  ],
  moon: [
    { name: 'Anorthosite', text: "Bright highland rock from the Moon's early magma ocean. Apollo 15's famous 'Genesis Rock' is anorthosite." },
    { name: 'Breccia', text: 'Rock that was smashed by impacts and cemented back together. The Moon is covered in it.' },
    { name: 'Mare basalt', text: "Dark lava rock from the lunar 'seas' (maria), which are huge ancient lava plains." },
    { name: 'Regolith', text: 'The dusty top layer: sharp bits of rock and glass made by billions of years of impacts. It sticks to everything, including suits.' },
    { name: 'Ice-bearing soil', text: "Permanently shadowed craters near the south pole trap water ice. NASA's LCROSS impact in 2009 confirmed it. That's a big reason Artemis is going here." },
    { name: 'Impact glass beads', text: 'Tiny glass spheres made when meteorite impacts melt rock and spray it across the surface.' },
  ],
};

const INFO = {
  mars: {
    solar: 'Solar array: about 50 kWh on a clear sol. Mars gets only 43% of the sunlight Earth does, so the array is huge. A dust storm can cut its output by 60%.',
    lander: "Ascent vehicle: your ride home. NASA plans to make rocket propellant on Mars from the CO₂ air, the way MOXIE made oxygen.",
  },
  moon: {
    solar: "Vertical solar arrays: at the south pole the Sun skims the horizon, so the panels stand tall and turn to follow it, like NASA's Vertical Solar Array Technology (VSAT) project.",
    lander: "Lander: crews and cargo arrive on tall landers like the ones NASA's Artemis program is buying.",
    reactor: 'Fission reactor: 1 kWe Kilopower-class, about 24 kWh a day, day and night. It sits far from the habitat behind a regolith berm that blocks its radiation.',
  },
};

const BEACON = { mars: [-22, -58], moon: [52, -38] };

export function createFppScene({ canvas, worldId, onContextLost, cb }) {
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !getQuality().post, powerPreference: 'high-performance' });
  const quality = getQuality();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const onLost = (e) => {
    e.preventDefault();
    if (onContextLost) onContextLost();
  };
  canvas.addEventListener('webglcontextlost', onLost);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 2500);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  const world = buildWorld(scene, worldId, { renderer, quality, small, ambientCrew: false });
  const { heightAt, gravity, colliders, ghWall, interactables } = world;
  world.setAutoRover(false);
  const post = createPost(renderer, scene, camera, quality, { worldId, bloom: worldId === 'moon' ? 0.45 : 0.3 });
  const interior = buildInterior(scene, worldId);
  const heritage = buildHeritage(scene, worldId, heightAt);
  const footprints = createFootprints(scene, worldId);
  const outsideInteractables = [...interactables, ...heritage.sites];
  // Shadows follow the player so the area around them stays sharp.
  const sunOffset = world.sun.position.clone();

  // ---------- First-person "view model": suit sleeve, glove and sample scanner ----------
  const vm = new THREE.Group();
  const vmRoot = new THREE.Group();
  vmRoot.scale.setScalar(0.62);
  vmRoot.position.set(0.1, -0.05, 0.12);
  vmRoot.add(vm);
  camera.add(vmRoot);
  {
    const suit = new THREE.MeshStandardMaterial({ color: '#efefea', roughness: 0.85 });
    const ringM = new THREE.MeshStandardMaterial({ color: '#9aa3ad', metalness: 0.85, roughness: 0.35 });
    suit.normalMap = tex('textures/surface/fabric_normal.jpg', { srgb: false, repeat: 3 });
    suit.normalScale = new THREE.Vector2(0.6, 0.6);
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.42, 8, 20), suit);
    sleeve.rotation.x = Math.PI / 2 - 0.25;
    sleeve.position.set(0.3, -0.3, -0.42);
    vm.add(sleeve);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.016, 8, 20), ringM);
    cuff.position.set(0.3, -0.25, -0.64);
    cuff.rotation.x = -0.25;
    vm.add(cuff);
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), new THREE.MeshStandardMaterial({ color: '#d9d9d2', roughness: 0.8 }));
    glove.scale.set(1.1, 0.8, 1.3);
    glove.position.set(0.3, -0.24, -0.7);
    vm.add(glove);
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.095, 0.085, 0.3, 4, 0.025), new THREE.MeshPhysicalMaterial({ color: '#e9e9e4', roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.15 }));
    body.position.set(0.29, -0.19, -0.78);
    vm.add(body);
    const grip = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.13, 0.065, 3, 0.015), new THREE.MeshStandardMaterial({ color: '#2b3138', roughness: 0.7 }));
    grip.position.set(0.29, -0.25, -0.72);
    vm.add(grip);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.05, 16), new THREE.MeshStandardMaterial({ color: '#111', emissive: '#38bdf8', emissiveIntensity: 1.2 }));
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0.29, -0.19, -0.94);
    vm.add(lens);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.05), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#4ade80', emissiveIntensity: 1 }));
    scr.position.set(0.29, -0.145, -0.74);
    scr.rotation.x = -1.2;
    vm.add(scr);
    vm.userData.tip = new THREE.Object3D();
    vm.userData.tip.position.set(0.29, -0.19, -0.97);
    vm.add(vm.userData.tip);
  }
  // Helmet lamp
  const lamp = new THREE.SpotLight('#fff6dd', 0, 40, 0.5, 0.5, 1.2);
  lamp.position.set(0, 0.1, 0);
  camera.add(lamp);
  camera.add(lamp.target);
  lamp.target.position.set(0, 0, -5);
  let lampOn = false;

  // Scanner beam
  const beamGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const beam = new THREE.Line(beamGeo, new THREE.LineBasicMaterial({ color: '#7dd3fc', transparent: true, opacity: 0 }));
  beam.frustumCulled = false;
  scene.add(beam);
  const spark = new THREE.PointLight('#7dd3fc', 0, 6, 2);
  scene.add(spark);

  // Survey beacon for the driving task
  const [bx, bz] = BEACON[worldId];
  const beacon = new THREE.Group();
  const beamMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 80, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#22d3ee', transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  beamMesh.position.y = 40;
  const flag = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.12, 8, 40), new THREE.MeshBasicMaterial({ color: '#22d3ee' }));
  flag.rotation.x = Math.PI / 2;
  flag.position.y = 0.15;
  beacon.add(beamMesh, flag);
  beacon.position.set(bx, heightAt(bx, bz), bz);
  scene.add(beacon);


  // ---------- State ----------
  const player = { x: 9, z: 2.5, y: heightAt(9, 2.5), vy: 0, yaw: Math.PI * 0.62, pitch: -0.05, onGround: true, vel: new THREE.Vector2() };
  const rv = { x: 12, z: 10, y: heightAt(12, 10), vy: 0, heading: Math.PI * 0.75, speed: 0, pitch: 0, roll: 0, battery: 100, lastGround: heightAt(12, 10) };
  let mode = 'walk';
  let space = 'outside'; // or 'inside' the habitat
  let watching = null; // id of a junior astronaut the camera is following
  let crewSpeed = 1; // fast-forward for crew work
  let toldFootprints = false;
  let scannedCount = 0;
  let analyzedCount = 0;
  let driveCam = 'cab';
  let insideGH = false;
  let suitO2 = 100;
  let paused = false;
  let disposed = false;
  let bobPhase = 0;
  let lastStepSign = 1;
  let firstJumpTold = false;
  const keys = new Set();
  const touch = { x: 0, y: 0 };
  let sprint = false;
  let lookOffset = { yaw: 0, pitch: 0 }; // free-look inside the rover cab
  const tasks = { scan: 0, solar: false, greenhouse: false, drive: false, crew: false, habitat: false, heritage: false, airlock: false };
  const scanned = new Set();
  let gameInfo = { battery: 30, capacity: 60 };
  let beamT = 0;
  let shake = 0;

  const tmpV = new THREE.Vector3();
  const tmpV2 = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  raycaster.far = 7;
  const center = new THREE.Vector2(0, 0);

  // ---------- Input ----------
  const isTouch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  const onKeyDown = (e) => {
    if (paused) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    sound.unlock();
    keys.add(e.code);
    if (e.code === 'Space') api.jump();
    if (e.code === 'KeyE') api.use();
    if (e.code === 'KeyF') api.fire();
    if (e.code === 'KeyC') api.toggleCam();
    if (e.code === 'KeyL') api.toggleLamp();
  };
  const onKeyUp = (e) => keys.delete(e.code);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  let locked = false;
  let dragging = null;
  const onPointerLock = () => {
    locked = document.pointerLockElement === canvas;
    cb.onLockChange && cb.onLockChange(locked);
  };
  document.addEventListener('pointerlockchange', onPointerLock);
  const onCanvasDown = (e) => {
    sound.unlock();
    if (paused || isTouch || e.pointerType === 'touch') return;
    if (!locked) {
      try {
        const p = canvas.requestPointerLock();
        if (p && p.catch) p.catch(() => {});
      } catch {
        /* pointer lock not allowed (e.g. inside an iframe): fall back to drag-to-look */
      }
      dragging = { x: e.clientX, y: e.clientY };
      return;
    }
    if (e.button === 0) api.fire();
  };
  const onMouseMove = (e) => {
    if (paused) return;
    if (locked) api.look(e.movementX, e.movementY);
    else if (dragging) {
      api.look(e.clientX - dragging.x, e.clientY - dragging.y);
      dragging = { x: e.clientX, y: e.clientY };
    }
  };
  const onUp = () => { dragging = null; };
  canvas.addEventListener('pointerdown', onCanvasDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('pointerup', onUp);

  // ---------- Physics helpers ----------
  function collide(px, pz, radius) {
    let x = px;
    let z = pz;
    if (space === 'inside') {
      const b = interior.bounds;
      return [Math.max(b.minX, Math.min(b.maxX, x)), Math.max(b.minZ, Math.min(b.maxZ, z))];
    }
    for (const c of colliders) {
      let cx = c.x;
      const cz = c.z;
      if (c.w) cx = Math.max(c.x - c.w, Math.min(c.x + c.w, x)); // capsule along x
      const dx = x - cx;
      const dz = z - cz;
      const d = Math.hypot(dx, dz);
      const min = c.r + radius;
      if (d < min && d > 1e-4) {
        x = cx + (dx / d) * min;
        z = cz + (dz / d) * min;
      }
    }
    // Greenhouse wall with a doorway facing east
    const dx = x - ghWall.x;
    const dz = z - ghWall.z;
    const d = Math.hypot(dx, dz);
    const ang = Math.atan2(dz, dx);
    const inDoor = Math.abs(ang - ghWall.doorAngle) < ghWall.doorHalf;
    if (!inDoor && d > 1e-4) {
      if (insideGH && d > ghWall.r - 0.45) {
        x = ghWall.x + (dx / d) * (ghWall.r - 0.45);
        z = ghWall.z + (dz / d) * (ghWall.r - 0.45);
      } else if (!insideGH && d < ghWall.r + radius) {
        x = ghWall.x + (dx / d) * (ghWall.r + radius);
        z = ghWall.z + (dz / d) * (ghWall.r + radius);
      }
    }
    const dist = Math.hypot(x, z);
    if (dist > 230) {
      x *= 230 / dist;
      z *= 230 / dist;
    }
    return [x, z];
  }
  function groundAt(x, z) {
    if (space === 'inside') return interior.floorY;
    const inGH = Math.hypot(x - ghWall.x, z - ghWall.z) < ghWall.r;
    return heightAt(x, z) + (inGH ? 0.18 : 0);
  }
  function forward(yaw) {
    return [-Math.sin(yaw), -Math.cos(yaw)];
  }

  function nearestInteractable() {
    if (mode === 'drive') return { id: 'exitRover', label: 'Climb out of the rover' };
    let best = null;
    const cand = space === 'inside'
      ? interior.stations
      : [...outsideInteractables.map((it) => (it.id === 'airlock' ? { ...it, label: 'Enter the habitat (recharges your suit)' } : it)), { id: 'rover', label: 'Board the rover', x: rv.x, z: rv.z, r: 3.6 }];
    for (const it of cand) {
      const d = Math.hypot(player.x - it.x, player.z - it.z);
      if (d < it.r && (!best || d < best.d)) best = { ...it, d };
    }
    return best;
  }

  function info(text, title) {
    sound.radio();
    cb.onToast && cb.onToast({ title, text });
  }

  function taskDone(id) {
    if (id === 'scan') tasks.scan = Math.min(3, tasks.scan + 1);
    else if (!tasks[id]) tasks[id] = true;
    else return;
    if (id !== 'scan' || tasks.scan === 3) sound.success();
    cb.onTasks && cb.onTasks({ ...tasks });
  }

  // ---------- Junior astronauts ----------
  const crew = createCrewSim({
    scene, worldId, heightAt, gravity, interior, footprints,
    onEvent(kind, m, task) {
      if (kind === 'start') {
        sound.radio();
        cb.onToast && cb.onToast({ title: `📻 ${m.name} (${m.role})`, text: task.start });
      } else if (kind === 'done') {
        sound.success();
        const text = cb.onCrewDone ? cb.onCrewDone(m.id, task.id) : task.done;
        cb.onToast && cb.onToast({ title: `✅ ${m.name} finished: ${task.label}`, text: `${text} 💡 ${task.fact}`, kind: 'crew' });
      }
    },
  });

  function goInside() {
    space = 'inside';
    player.x = interior.door.x + 0.6;
    player.z = interior.door.z;
    player.y = interior.floorY;
    player.vy = 0;
    player.yaw = -Math.PI / 2; // face down the module (east)
    player.vel.set(0, 0);
    suitO2 = 100;
    taskDone('habitat');
    const others = tasks.scan > 0 || tasks.solar || tasks.greenhouse || tasks.drive;
    if (others) taskDone('airlock');
    sound.thud();
    info('Airlock cycled: suit recharged, helmet off. Walk down the module to the stations: life support, comms, galley, medical, lab, exercise bike, sleep pods and the command console.', 'Inside the habitat');
  }
  function goOutside() {
    space = 'outside';
    player.x = 7.8;
    player.z = 0.8;
    player.y = heightAt(7.8, 0.8);
    player.yaw = -Math.PI / 2;
    player.vel.set(0, 0);
    sound.thud();
  }

  // ---------- Frame ----------
  let last = performance.now();
  let elapsed = 0;
  let hudT = 0;
  let aimT = 0;
  let aimRock = false;

  function frame() {
    if (disposed) return;
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    elapsed += dt;
    world.tick(dt, elapsed);
    crew.update(dt * crewSpeed, elapsed);
    footprints.update(elapsed);
    if (space === 'inside') world.sun.intensity = 0; // sealed module: only the habitat lights

    const fwdIn = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) + touch.y;
    const sideIn = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + touch.x;
    const running = sprint || keys.has('ShiftLeft') || keys.has('ShiftRight');

    if (!paused && mode === 'walk' && !watching) {
      // Walking: slower acceleration in the air, real surface gravity
      const max = (running ? (worldId === 'moon' ? 3.2 : 2.8) : 1.6) * Math.min(1, Math.hypot(fwdIn, sideIn) || 0);
      const [fx, fz] = forward(player.yaw);
      const rx = -fz;
      const rz = fx;
      let mx = fx * fwdIn + rx * sideIn;
      let mz = fz * fwdIn + rz * sideIn;
      const ml = Math.hypot(mx, mz);
      if (ml > 0) {
        mx /= ml;
        mz /= ml;
      }
      const tv = new THREE.Vector2(mx * max, mz * max);
      player.vel.lerp(tv, 1 - Math.exp(-dt * (player.onGround ? 7 : 1.2)));
      let nx = player.x + player.vel.x * dt;
      let nz = player.z + player.vel.y * dt;
      [nx, nz] = collide(nx, nz, 0.38);
      player.x = nx;
      player.z = nz;
      insideGH = space === 'outside' && Math.hypot(nx - ghWall.x, nz - ghWall.z) < ghWall.r;
      const g = groundAt(nx, nz);
      player.vy -= gravity * dt;
      player.y += player.vy * dt;
      if (player.y <= g) {
        if (!player.onGround && player.vy < -1.2) sound.footstep(gravity);
        player.y = g;
        player.vy = 0;
        player.onGround = true;
      } else if (player.y > g + 0.05) {
        player.onGround = false;
      }
      // Head bob + footsteps
      const sp = player.vel.length();
      if (player.onGround && sp > 0.2) {
        bobPhase += dt * sp * (gravity < 2.5 ? 2.6 : 3.4);
        const sgn = Math.sign(Math.sin(bobPhase));
        if (sgn !== lastStepSign) {
          if (sgn < 0) sound.footstep(gravity);
          if (space === 'outside' && !insideGH) {
            footprints.add(player.x, g, player.z, player.yaw + Math.PI, sgn, elapsed);
            if (!toldFootprints && elapsed > 6) {
              toldFootprints = true;
              info(worldId === 'moon'
                ? 'Look behind you: your bootprints. With no wind or rain on the Moon, prints like the Apollo astronauts\' from 1969–72 can last tens of thousands to millions of years, until tiny meteorite impacts slowly churn the dust.'
                : 'Look behind you: your bootprints. On Mars the wind slowly fills them in, the same way it wipes away rover tracks over weeks and months.', 'Footprints');
            }
          }
        }
        lastStepSign = sgn;
      }
      const bob = player.onGround ? Math.sin(bobPhase) * 0.035 * Math.min(1, sp) : 0;
      camera.position.set(player.x, player.y + 1.66 + bob, player.z);
      camera.rotation.set(player.pitch, player.yaw, Math.sin(bobPhase * 0.5) * 0.01 * Math.min(1, sp));
      vm.position.set(Math.sin(bobPhase * 0.5) * 0.012 * sp, Math.abs(Math.sin(bobPhase)) * 0.012 * sp - (player.onGround ? 0 : 0.03), 0);
      // Suit oxygen (real EVA suits last ~8 hours; here it is sped up). Inside, no suit needed.
      if (space === 'outside') suitO2 = Math.max(0, suitO2 - dt * (running ? 0.45 : 0.25));
      // Visiting a historic site
      if (space === 'outside' && !tasks.heritage) {
        for (const h of heritage.sites) if (Math.hypot(player.x - h.x, player.z - h.z) < h.r) taskDone('heritage');
      }
      if (suitO2 === 0) {
        info('Your suit oxygen ran out, so the crew pulled you back inside. Real EVAs are planned with big safety margins.', 'Suit O₂ empty');
        goInside();
      }
    }

    // Rover driving
    if (mode === 'drive' && !paused) {
      const lowBatt = rv.battery <= 0;
      const throttle = Math.max(-1, Math.min(1, fwdIn));
      const steer = Math.max(-1, Math.min(1, sideIn));
      const maxF = lowBatt ? 0.6 : 5.6; // ~20 km/h, like NASA's crewed lunar rover concepts
      rv.speed += throttle * (throttle * rv.speed < 0 ? 4 : 1.8) * dt;
      rv.speed -= rv.speed * (throttle === 0 ? 0.9 : 0.15) * dt;
      rv.speed = Math.max(-2, Math.min(maxF, rv.speed));
      rv.heading -= steer * rv.speed * 0.32 * dt;
      rv.battery = Math.max(0, rv.battery - Math.abs(throttle) * dt * 0.35);
      const fx = Math.cos(rv.heading);
      const fz = -Math.sin(rv.heading);
      let nx = rv.x + fx * rv.speed * dt;
      let nz = rv.z + fz * rv.speed * dt;
      const [cx, cz] = collide(nx, nz, 1.5);
      if (Math.hypot(cx - nx, cz - nz) > 0.01) {
        if (Math.abs(rv.speed) > 1) {
          sound.thud();
          shake = 0.5;
        }
        rv.speed *= -0.25;
        nx = cx;
        nz = cz;
      }
      rv.x = nx;
      rv.z = nz;
      // Suspension: wheels follow the ground; in low gravity, crests launch you into the air
      const rx = -fz;
      const rz = fx;
      const hF = heightAt(rv.x + fx * 1.1, rv.z + fz * 1.1);
      const hB = heightAt(rv.x - fx * 1.1, rv.z - fz * 1.1);
      const hL = heightAt(rv.x - rx * 0.9, rv.z - rz * 0.9);
      const hR = heightAt(rv.x + rx * 0.9, rv.z + rz * 0.9);
      const gnd = (hF + hB + hL + hR) / 4;
      rv.vy -= gravity * dt;
      rv.y += rv.vy * dt;
      if (rv.y <= gnd) {
        if (rv.vy < -2.2) {
          sound.thud();
          shake = Math.min(1, -rv.vy * 0.15);
        }
        rv.y = gnd;
        rv.vy = Math.min(4, Math.max(0, ((gnd - rv.lastGround) / dt) * 0.85));
      }
      rv.lastGround = gnd;
      const airborne = rv.y > gnd + 0.05;
      if (!airborne) {
        rv.pitch += (Math.atan2(hF - hB, 2.2) - rv.pitch) * Math.min(1, dt * 8);
        rv.roll += (Math.atan2(hL - hR, 1.8) - rv.roll) * Math.min(1, dt * 8);
      }
      // Recharge when parked by the battery bank
      if (Math.hypot(rv.x - 8.5, rv.z + 3) < 12 && Math.abs(rv.speed) < 0.2) rv.battery = Math.min(100, rv.battery + dt * 8);
      if (!tasks.drive && Math.hypot(rv.x - bx, rv.z - bz) < 7) {
        taskDone('drive');
        info(`You reached the survey beacon ${Math.round(Math.hypot(bx, bz))} m from the base. Crewed rovers let astronauts explore much farther than walking.`, 'Survey complete');
      }
      sound.rover(true, rv.speed, throttle);
      sound.setStorm(world.cur.storm);
    }
    // Place the rover model
    world.rover.position.set(rv.x, rv.y, rv.z);
    world.rover.rotation.set(rv.roll, rv.heading, rv.pitch, 'YZX');

    if (mode === 'drive') {
      shake = Math.max(0, shake - dt * 2);
      const sx = (Math.random() - 0.5) * shake * 0.08;
      const sy = (Math.random() - 0.5) * shake * 0.08;
      if (driveCam === 'cab') {
        tmpV.set(0.85, 1.95, -0.25);
        world.rover.localToWorld(tmpV);
        camera.position.copy(tmpV).add(new THREE.Vector3(sx, sy, 0));
        const q = world.rover.quaternion.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(lookOffset.pitch, -Math.PI / 2 + lookOffset.yaw, 0, 'YXZ')));
        camera.quaternion.copy(q);
      } else {
        const fx = Math.cos(rv.heading);
        const fz = -Math.sin(rv.heading);
        tmpV.set(rv.x - fx * 8, rv.y + 3.4, rv.z - fz * 8);
        tmpV.y = Math.max(tmpV.y, heightAt(tmpV.x, tmpV.z) + 1.2);
        camera.position.lerp(tmpV, 1 - Math.exp(-dt * 5));
        camera.position.x += sx;
        camera.position.y += sy;
        tmpV2.set(rv.x, rv.y + 1.4, rv.z);
        camera.lookAt(tmpV2);
      }
    }

    // Watch a junior astronaut at work (third-person follow camera)
    if (watching) {
      const m = crew.get(watching);
      m.model.getWorldPosition(tmpV2);
      const inside = m.space === 'inside';
      tmpV2.y += m.phase === 'rest' ? 0.4 : 1.3;
      const back = inside ? 2.1 : 3.4;
      const h = m.phase === 'rest' ? 0 : m.heading;
      tmpV.set(tmpV2.x - Math.sin(h) * back + Math.cos(h) * 0.9, tmpV2.y + (inside ? 0.45 : 1.2), tmpV2.z - Math.cos(h) * back - Math.sin(h) * 0.9);
      if (inside) {
        tmpV.z = Math.max(interior.bounds.minZ - 0.5, Math.min(interior.bounds.maxZ + 0.5, tmpV.z));
        tmpV.x = Math.max(interior.bounds.minX, Math.min(interior.bounds.maxX, tmpV.x));
      } else {
        tmpV.y = Math.max(tmpV.y, heightAt(tmpV.x, tmpV.z) + 0.8);
      }
      const snap = camera.position.distanceTo(tmpV) > 30;
      if (snap) camera.position.copy(tmpV);
      else camera.position.lerp(tmpV, 1 - Math.exp(-dt * 4));
      camera.lookAt(tmpV2);
      vmRoot.visible = false;
    } else if (mode === 'walk') {
      vmRoot.visible = space === 'outside';
    }
    const camInside = watching ? crew.get(watching).space === 'inside' : space === 'inside';
    if (camInside) world.sun.intensity = 0;

    // Satellites overhead
    const risen = heritage.update(elapsed, camera.position);
    if (risen && !camInside && !watching) info(risen.note, `🛰 ${risen.name} passing overhead`);

    // Shadows follow the camera
    world.sun.position.set(camera.position.x, 0, camera.position.z).add(sunOffset);
    world.sun.target.position.set(camera.position.x, 0, camera.position.z);
    world.sun.target.updateMatrixWorld();

    // Helmet lamp on automatically in the dark
    const dark = Math.max(world.cur.dark, world.cur.storm * 0.7);
    lamp.intensity = camInside ? 0 : lampOn || dark > 0.5 ? 60 : 0;

    // Scanner beam fade
    if (beamT > 0) {
      beamT -= dt;
      beam.material.opacity = Math.max(0, beamT / 0.35);
      spark.intensity = Math.max(0, beamT / 0.35) * 8;
    }

    post.render(dt);

    // Aim check (is a rock in the crosshair?)
    aimT -= dt;
    if (aimT <= 0 && mode === 'walk' && space === 'outside' && !watching) {
      aimT = 0.12;
      raycaster.setFromCamera(center, camera);
      const hit = raycaster.intersectObject(world.rocks, true).find((h) => !h.object.userData.pebbles);
      aimRock = !!(hit && !scanned.has(`${hit.object.id}:${hit.instanceId}`));
    }

    // Name tags above the juniors (positioned every frame by the React layer)
    if (cb.onCrewLabels) {
      const rect = canvas.getBoundingClientRect();
      const out = {};
      for (const m of crew.members) {
        m.model.getWorldPosition(tmpV);
        tmpV.y += m.phase === 'rest' ? 0.7 : 2.25;
        const sameSpace = m.space === (camInside ? 'inside' : 'outside') && m.model.visible;
        const dist = camera.position.distanceTo(tmpV);
        tmpV.project(camera);
        out[m.id] = { x: ((tmpV.x + 1) / 2) * rect.width, y: ((1 - tmpV.y) / 2) * rect.height, visible: sameSpace && tmpV.z < 1 && dist < 60 && Math.abs(tmpV.x) < 1.1 && Math.abs(tmpV.y) < 1.1 };
      }
      cb.onCrewLabels(out);
    }

    // HUD updates ~10x a second
    hudT -= dt;
    if (hudT <= 0) {
      hudT = 0.1;
      const yaw = mode === 'drive' ? rv.heading - Math.PI / 2 : player.yaw;
      const heading = ((((-yaw * 180) / Math.PI) % 360) + 360) % 360; // 0 = north (-z)
      const px = mode === 'drive' ? rv.x : player.x;
      const pz = mode === 'drive' ? rv.z : player.z;
      const bearing = (((Math.atan2(bx - px, -(bz - pz)) * 180) / Math.PI) + 360) % 360;
      const markers = space === 'outside' ? heritage.sites.map((h) => ({
        id: h.id,
        bearing: (((Math.atan2(h.x - px, -(h.z - pz)) * 180) / Math.PI) + 360) % 360,
        dist: Math.hypot(h.x - px, h.z - pz),
      })) : [];
      cb.onHud && cb.onHud({
        mode,
        space,
        watching,
        markers,
        crew: crew.status(),
        driveCam,
        heading,
        beaconBearing: bearing,
        beaconDist: Math.hypot(bx - px, bz - pz),
        suitO2,
        gravity,
        aimRock,
        prompt: nearestInteractable(),
        rover: mode === 'drive' ? {
          kmh: Math.abs(rv.speed) * 3.6,
          battery: rv.battery,
          pitch: (rv.pitch * 180) / Math.PI,
          roll: (rv.roll * 180) / Math.PI,
          airborne: rv.y > rv.lastGround + 0.05,
          reverse: rv.speed < -0.05,
        } : null,
      });
    }
  }

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    post.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 0.8 ? 80 : 72;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();
  renderer.setAnimationLoop(frame);
  cb.onTasks && cb.onTasks({ ...tasks });

  const api = {
    isTouch,
    teleport(x, z) {
      player.x = x;
      player.z = z;
      player.y = groundAt(x, z);
    },
    driveTo(x, z) {
      rv.x = x;
      rv.z = z;
    },
    debugAimRock() {
      // test helper: stand 3 m from the nearest big boulder and look at it
      let best = null;
      for (const r of world.rocks.userData.big) {
        const d = Math.hypot(r.x - player.x, r.z - player.z);
        if (Math.hypot(r.x, r.z) > 18 && (!best || d < best.d)) best = { ...r, d };
      }
      if (!best) return false;
      const ang = Math.atan2(player.x - best.x, player.z - best.z);
      player.x = best.x + Math.sin(ang) * (best.r + 2.5);
      player.z = best.z + Math.cos(ang) * (best.r + 2.5);
      player.y = groundAt(player.x, player.z);
      player.yaw = Math.atan2(-(best.x - player.x), -(best.z - player.z));
      const rockY = heightAt(best.x, best.z) + best.r * 0.3;
      player.pitch = Math.atan2(rockY - (player.y + 1.66), Math.hypot(best.x - player.x, best.z - player.z));
      return true;
    },
    debug() {
      return { player: { x: player.x, z: player.z, y: player.y, yaw: player.yaw }, rv: { x: rv.x, z: rv.z }, mode, paused, keys: [...keys] };
    },
    update(s) {
      Object.assign(world.target, s.visual);
      if (s.info) gameInfo = s.info;
    },
    setTouchMove(x, y) {
      touch.x = x;
      touch.y = y;
    },
    setSprint(on) {
      sprint = on;
    },
    look(dx, dy) {
      if (paused) return;
      const k = 0.0024;
      if (mode === 'drive') {
        lookOffset.yaw = Math.max(-1.6, Math.min(1.6, lookOffset.yaw - dx * k));
        lookOffset.pitch = Math.max(-0.8, Math.min(0.6, lookOffset.pitch - dy * k));
      } else {
        player.yaw -= dx * k;
        player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - dy * k));
      }
    },
    jump() {
      if (paused || mode !== 'walk' || !player.onGround) return;
      player.vy = 2.6; // a gentle hop: ~0.34 m on Earth
      player.onGround = false;
      if (!firstJumpTold) {
        firstJumpTold = true;
        const h = (2.6 * 2.6) / (2 * gravity);
        info(`The same hop that lifts you 0.34 m on Earth takes you ${h.toFixed(1)} m high here. Gravity is ${gravity} m/s² (${worldId === 'moon' ? 'about 1/6' : 'about 3/8'} of Earth's).`, 'Low gravity!');
      }
    },
    use() {
      if (paused) return;
      sound.unlock();
      const it = nearestInteractable();
      if (!it) {
        sound.error();
        return;
      }
      sound.blip(1000, 0.06, 0.06);
      if (it.id === 'rover') {
        mode = 'drive';
        vm.visible = false;
        lookOffset = { yaw: 0, pitch: 0 };
        info(isTouch
          ? 'Pressurized rover: push the joystick up to drive, sideways to steer. Tap the camera button to switch views and Use to climb out. Drive to the glowing survey beacon.'
          : 'Pressurized rover: W/S throttle, A/D steer, C switches camera, E to climb out. Drive to the glowing survey beacon.', 'Rover systems online');
      } else if (it.id === 'exitRover') {
        mode = 'walk';
        vm.visible = true;
        sound.rover(false);
        const fx = Math.cos(rv.heading);
        const fz = -Math.sin(rv.heading);
        const [x, z] = collide(rv.x + fz * 2.6, rv.z - fx * 2.6, 0.38);
        player.x = x;
        player.z = z;
        player.y = groundAt(x, z);
        player.yaw = rv.heading - Math.PI / 2;
        rv.speed = 0;
      } else if (it.id === 'greenhouse') {
        taskDone('greenhouse');
        cb.onOpenGreenhouse && cb.onOpenGreenhouse();
      } else if (it.id === 'airlock') {
        goInside();
      } else if (it.id === 'exitHab') {
        goOutside();
        info('Airlock cycled: helmet on, suit pressurized. Real EVA suits keep you alive for about 8 hours.', 'Outside');
      } else if (it.title) {
        taskDone('heritage');
        info(it.text, it.title);
      } else if (it.id === 'lifeSupport') {
        const g = gameInfo;
        info(`Oxygen tank ${g.o2.toFixed(1)} kg · water ${Math.round(g.water)} kg · water recycling 98% (like the ISS). ${g.broken || g.leak ? '⚠ Something is broken! Order Leo (engineer) to repair it from the 👥 crew panel.' : 'All systems nominal.'} The O₂ generator splits water into oxygen and hydrogen using electricity.`, 'Life support rack');
      } else if (it.id === 'comms') {
        const d = targetDistance(worldId, daysSinceJ2000(Date.now()));
        info(`A radio message to Earth takes ${formatDelay(d.lightSeconds)} today, so you can't get instant help. ${gameInfo.forecast ? `CAPCOM's forecast: ${gameInfo.forecast}` : 'CAPCOM: nothing unusual in the forecast.'}`, '📡 Mission control');
      } else if (it.id === 'galley') {
        const r = cb.onCommanderAction ? cb.onCommanderAction('meal') : null;
        info(r ? r.text : 'Meal time.', '🍲 Galley');
      } else if (it.id === 'medical') {
        const g = gameInfo;
        info(`Crew health ${Math.round(g.health)}% · mission radiation dose ${g.dose.toFixed(1)} of 50 mSv. Doctors on Earth check astronauts' bones, eyes and heart before and after missions, because low gravity changes the body.`, '⚕ Medical bay');
      } else if (it.id === 'lab') {
        const fresh = scannedCount - analyzedCount;
        const r = cb.onCommanderAction ? cb.onCommanderAction('analyze', fresh) : null;
        if (r && r.used) analyzedCount += r.used;
        info(r ? r.text : 'No samples.', '🔬 Lab bench');
      } else if (it.id === 'exercise') {
        info(`ISS astronauts exercise about 2 hours a day, because bones and muscles weaken without gravity. Even at ${gravity} m/s² you need to keep fit for the trip home.`, '🚴 Exercise bike');
      } else if (it.id === 'pods') {
        const resting = crew.status().filter((c) => c.taskId === 'rest').map((c) => c.name);
        info(`${resting.length ? `${resting.join(' and ')} ${resting.length > 1 ? 'are' : 'is'} resting. ` : ''}Each crew member has a small private pod. Good sleep keeps the crew sharp and healthy.`, '🛏 Crew quarters');
      } else if (it.id === 'command') {
        cb.onOpenCrew && cb.onOpenCrew();
      } else if (it.id === 'window') {
        info(worldId === 'moon' ? 'Out of the window: grey hills, a black sky and the blue Earth hanging low over the horizon.' : 'Out of the window: a dusty butterscotch sky over Jezero Crater, an ancient lake bed.', 'Viewport');
      } else if (it.id === 'battery') {
        info(`Battery bank: ${Math.round(gameInfo.battery)} of ${gameInfo.capacity} kWh stored. It keeps the base alive when the panels can't.`, 'Battery bank');
      } else if (it.id === 'solar') {
        taskDone('solar');
        info(INFO[worldId].solar, 'Solar array');
      } else if (INFO[worldId][it.id]) {
        info(INFO[worldId][it.id], it.id === 'reactor' ? 'Fission reactor' : 'Lander');
      }
    },
    assignTask(id, taskId) {
      const ok = crew.assign(id, taskId);
      if (ok) taskDone('crew');
      return ok;
    },
    setCrewSpeed(k) {
      crewSpeed = k;
    },
    cancelTask(id) {
      crew.cancel(id);
    },
    watch(id) {
      watching = id || null;
      if (!watching) {
        vmRoot.visible = mode === 'walk' && space === 'outside';
      }
    },
    fire() {
      if (paused || mode !== 'walk' || space !== 'outside' || watching) return;
      sound.unlock();
      raycaster.setFromCamera(center, camera);
      const hit = raycaster.intersectObject(world.rocks, true).find((h) => !h.object.userData.pebbles);
      vm.userData.tip.getWorldPosition(tmpV);
      const end = hit ? hit.point : tmpV2.copy(raycaster.ray.direction).multiplyScalar(7).add(raycaster.ray.origin);
      beam.geometry.setFromPoints([tmpV.clone(), end.clone()]);
      beam.geometry.attributes.position.needsUpdate = true;
      spark.position.copy(end);
      beamT = 0.35;
      sound.scan();
      if (!hit) return;
      const rockKey = `${hit.object.id}:${hit.instanceId}`;
      if (scanned.has(rockKey)) {
        cb.onToast && cb.onToast({ title: 'Already scanned', text: 'Find a different rock.' });
        return;
      }
      scanned.add(rockKey);
      const facts = ROCK_FACTS[worldId];
      const f = facts[(hit.instanceId + (hit.object.userData.proto || 0)) % facts.length];
      taskDone('scan');
      scannedCount += 1;
      setTimeout(() => sound.success(), 350);
      cb.onToast && cb.onToast({ title: `🔬 Sample: ${f.name}`, text: f.text, kind: 'scan' });
    },
    toggleCam() {
      if (mode !== 'drive') return;
      driveCam = driveCam === 'cab' ? 'chase' : 'cab';
      sound.blip(800, 0.05, 0.05);
    },
    toggleLamp() {
      lampOn = !lampOn;
      sound.blip(lampOn ? 1400 : 900, 0.04, 0.05);
    },
    setPaused(p) {
      paused = p;
      if (p) {
        keys.clear();
        touch.x = touch.y = 0;
        if (document.pointerLockElement) document.exitPointerLock();
      }
    },
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      sound.rover(false);
      ro.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('pointerlockchange', onPointerLock);
      canvas.removeEventListener('pointerdown', onCanvasDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('webglcontextlost', onLost);
      if (document.pointerLockElement) document.exitPointerLock();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => {
            for (const key of ['map', 'bumpMap', 'emissiveMap']) if (m[key]) m[key].dispose();
            m.dispose();
          });
        }
      });
      post.dispose();
      renderer.dispose();
    },
  };
  return api;
}
