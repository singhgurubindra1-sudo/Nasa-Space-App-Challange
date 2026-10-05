// Junior astronauts who carry out the Commander's orders in real time:
// they plan a route around the base, walk it, cycle through the airlock for jobs inside,
// do the work with the right tool and pose, report progress, and radio back when done.
import * as THREE from 'three';
import { createAstronaut, animateAstronaut, poseAstronaut, setProp, setHelmet } from './astronaut.js';
import { JUNIORS, taskById, isSpecialist } from '../engine/crew.js';

// Walkable waypoints outside (they go around the habitat modules, battery and greenhouse wall)
function outsideGraph(worldId) {
  const N = {
    air: [7.2, 0.6], yardE: [9.5, 4], yardSE: [7, 10.5], southW: [0.5, 10.5], ghOut: [-3.2, 9], ghIn: [-6.2, 9.3],
    ghRack: [-7.0, 10.1], yardN: [8.5, -6.5], northW: [0, -4.5], shieldWork: [-4.5, -2.6], samples: [15, 16],
    idleA: [10, 1.5], idleB: [8.5, 6.8], idleC: [6, -4.8],
    solar: worldId === 'mars' ? [13.4, -7.6] : [16.4, -12.6],
  };
  const E = [
    ['air', 'yardE'], ['air', 'yardN'], ['air', 'idleA'], ['yardE', 'idleA'], ['yardE', 'yardSE'], ['yardE', 'idleB'], ['yardE', 'samples'],
    ['yardSE', 'southW'], ['yardSE', 'idleB'], ['southW', 'ghOut'], ['ghOut', 'ghIn'], ['ghIn', 'ghRack'], ['yardN', 'solar'],
    ['yardN', 'northW'], ['yardN', 'idleC'], ['air', 'idleC'], ['northW', 'shieldWork'],
  ];
  if (worldId === 'moon') {
    N.reactor = [-22.5, -17.5];
    E.push(['northW', 'reactor']);
  }
  return { N, E };
}

function shortestPath(graph, from, to) {
  const { N, E } = graph;
  const adj = {};
  for (const k in N) adj[k] = [];
  for (const [a, b] of E) {
    const d = Math.hypot(N[a][0] - N[b][0], N[a][1] - N[b][1]);
    adj[a].push([b, d]);
    adj[b].push([a, d]);
  }
  const dist = { [from]: 0 };
  const prev = {};
  const open = new Set(Object.keys(N));
  while (open.size) {
    let u = null;
    for (const k of open) if (dist[k] !== undefined && (u === null || dist[k] < dist[u])) u = k;
    if (u === null || u === to) break;
    open.delete(u);
    for (const [v, d] of adj[u]) {
      const nd = dist[u] + d;
      if (dist[v] === undefined || nd < dist[v]) {
        dist[v] = nd;
        prev[v] = u;
      }
    }
  }
  const path = [];
  for (let k = to; k; k = prev[k]) path.unshift(k);
  return path[0] === from ? path : [from, to];
}

const TASK_NODE = { greenhouse: 'ghRack', shield: 'shieldWork', solar: 'solar', samples: 'samples', reactor: 'reactor' };
const TASK_FACE = { greenhouse: -Math.PI / 2, shield: 0, solar: Math.PI / 2, samples: 0.8, reactor: -2.4 };
const INSIDE_STATION = { repair: 'lifeSupport', lab: 'lab' };
const PHASE_TEXT = { idle: 'Standing by', walk: 'Walking', airlock: 'Cycling the airlock', work: 'Working', rest: 'Resting' };

export function createCrewSim({ scene, worldId, heightAt, gravity, interior, footprints, onEvent }) {
  const graph = outsideGraph(worldId);
  const idleNodes = ['idleA', 'idleB', 'idleC'];
  const members = JUNIORS.map((j, i) => {
    const model = createAstronaut({ bandColor: j.color, skin: j.skin, hair: j.hair });
    scene.add(model);
    const [x, z] = graph.N[idleNodes[i]];
    return {
      ...j, model, space: 'outside', x, z, heading: Math.PI * (0.3 + i * 0.5), phase: 'idle', path: [], task: null, progress: 0,
      timer: 0, home: idleNodes[i], stepPhase: i, lastStep: 1, pod: i, after: null,
    };
  });

  const yAt = (m) => (m.space === 'inside' ? interior.floorY : heightAt(m.x, m.z));

  function nearestNode(x, z) {
    let best = null;
    for (const k in graph.N) {
      if (k === 'reactor' && worldId !== 'moon') continue;
      const d = Math.hypot(graph.N[k][0] - x, graph.N[k][1] - z);
      if (!best || d < best.d) best = { k, d };
    }
    return best.k;
  }

  function outsideRoute(m, toNode) {
    const start = nearestNode(m.x, m.z);
    return shortestPath(graph, start, toNode).map((k) => graph.N[k]);
  }

  function insideRoute(m, station) {
    // Straight down the centre aisle, then step to the station
    return [[m.x, interior.door.z], [station.x, interior.door.z], [station.x, station.z]];
  }

  function stationFor(taskId, m) {
    if (taskId === 'rest') {
      const p = interior.pods[m.pod];
      return { x: p.x, z: interior.door.z + 0.62, pod: p };
    }
    const s = interior.stations.find((st) => st.id === INSIDE_STATION[taskId]);
    return { x: s.x, z: interior.door.z + s.standZ };
  }

  function assign(id, taskId) {
    const m = members.find((x) => x.id === id);
    const task = taskById(taskId);
    if (!m || !task) return false;
    setProp(m.model, task.prop);
    m.task = task;
    m.progress = 0;
    m.model.rotation.set(0, m.heading, 0);
    if (task.inside) {
      if (m.space === 'outside') {
        m.path = outsideRoute(m, 'air');
        m.after = 'enter';
      } else {
        const st = stationFor(taskId, m);
        m.path = insideRoute(m, st);
        m.after = 'work';
      }
    } else if (m.space === 'inside') {
      m.path = [[m.x, interior.door.z], [interior.door.x, interior.door.z]];
      m.after = 'exit';
    } else {
      m.path = outsideRoute(m, TASK_NODE[taskId]);
      m.after = 'work';
    }
    m.phase = 'walk';
    onEvent && onEvent('start', m, task);
    return true;
  }

  function cancel(id) {
    const m = members.find((x) => x.id === id);
    if (!m || !m.task) return;
    m.task = null;
    m.after = null;
    setProp(m.model, null);
    m.phase = 'walk';
    m.path = m.space === 'outside' ? outsideRoute(m, m.home) : [[m.x, interior.door.z]];
    m.after = 'home';
  }

  function arrive(m) {
    const t = m.task;
    if (m.after === 'enter') {
      m.phase = 'airlock';
      m.timer = 1.6;
      m.after = 'inside';
      return;
    }
    if (m.after === 'exit') {
      m.phase = 'airlock';
      m.timer = 1.6;
      m.after = 'outside';
      return;
    }
    if (m.after === 'work' && t) {
      m.phase = t.id === 'rest' ? 'rest' : 'work';
      m.progress = 0;
      if (TASK_FACE[t.id] !== undefined) m.heading = TASK_FACE[t.id];
      if (t.inside && t.id !== 'rest') m.heading = 0; // face the wall station
      return;
    }
    m.phase = 'idle';
    m.after = null;
  }

  function update(dt, t) {
    for (const m of members) {
      const speed = gravity < 2.5 ? 1.5 : 1.35;
      if (m.phase === 'walk' && m.path.length) {
        const [tx, tz] = m.path[0];
        const dx = tx - m.x;
        const dz = tz - m.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.15) {
          m.path.shift();
          if (!m.path.length) arrive(m);
        } else {
          const step = Math.min(d, speed * dt);
          m.x += (dx / d) * step;
          m.z += (dz / d) * step;
          const want = Math.atan2(dx, dz);
          let diff = ((want - m.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          m.heading += diff * Math.min(1, dt * 8);
          m.stepPhase += dt * speed * 2.6;
          const sgn = Math.sign(Math.sin(m.stepPhase * 2));
          if (sgn !== m.lastStep && m.space === 'outside' && footprints) footprints.add(m.x, yAt(m), m.z, m.heading - Math.PI / 2 + Math.PI / 2, sgn, t);
          m.lastStep = sgn;
        }
        animateAstronaut(m.model, m.stepPhase, 1, gravity);
      } else if (m.phase === 'airlock') {
        m.timer -= dt;
        m.model.visible = false;
        if (m.timer <= 0) {
          m.model.visible = true;
          if (m.after === 'inside') {
            m.space = 'inside';
            m.x = interior.door.x;
            m.z = interior.door.z;
            setHelmet(m.model, false);
            const st = stationFor(m.task.id, m);
            m.path = insideRoute(m, st);
            m.after = 'work';
            m.phase = 'walk';
          } else {
            m.space = 'outside';
            m.x = graph.N.air[0];
            m.z = graph.N.air[1];
            setHelmet(m.model, true);
            m.path = m.task ? outsideRoute(m, TASK_NODE[m.task.id]) : outsideRoute(m, m.home);
            m.after = m.task ? 'work' : 'home';
            m.phase = 'walk';
          }
        }
      } else if (m.phase === 'work' || m.phase === 'rest') {
        const dur = m.task.seconds * (isSpecialist(m.id, m.task.id) ? 0.65 : 1);
        m.progress = Math.min(1, m.progress + dt / dur);
        poseAstronaut(m.model, t + m.pod, m.task.pose);
        if (m.progress >= 1) {
          const task = m.task;
          onEvent && onEvent('done', m, task);
          setProp(m.model, null);
          m.task = null;
          m.phase = 'idle';
          m.model.rotation.set(0, m.heading, 0);
        }
      } else {
        // idle: breathe and look around
        animateAstronaut(m.model, t + m.pod * 3, 0, gravity);
      }

      // Place the model
      if (m.phase === 'rest' && m.task) {
        const p = interior.pods[m.pod];
        m.model.position.set(p.x + 0.85, p.y + 0.12, p.z);
        m.model.rotation.set(-Math.PI / 2, Math.PI / 2, 0, 'YXZ');
      } else {
        m.model.position.set(m.x, yAt(m), m.z);
        m.model.rotation.set(0, m.heading, 0, 'XYZ');
      }
    }
  }

  function status() {
    return members.map((m) => {
      let where = m.space === 'inside' ? 'in the habitat' : 'outside';
      let text = PHASE_TEXT[m.phase];
      if (m.phase === 'walk' && m.task) {
        const left = m.path.reduce((acc, p, i) => acc + Math.hypot(p[0] - (i ? m.path[i - 1][0] : m.x), p[1] - (i ? m.path[i - 1][1] : m.z)), 0);
        text = `Walking to ${m.task.place.toLowerCase()} · ${Math.round(left)} m`;
      } else if (m.phase === 'walk') text = 'Heading back';
      else if (m.phase === 'airlock') text = m.after === 'inside' ? 'Cycling the airlock (going in)' : 'Cycling the airlock (going out)';
      else if ((m.phase === 'work' || m.phase === 'rest') && m.task) text = `${m.task.label} · ${Math.round(m.progress * 100)}%`;
      return {
        id: m.id, name: m.name, role: m.role, emoji: m.emoji, color: m.color,
        phase: m.phase, text, where, progress: m.progress, busy: !!m.task, taskId: m.task ? m.task.id : null,
      };
    });
  }

  return {
    members,
    assign,
    cancel,
    update,
    status,
    get(id) {
      return members.find((m) => m.id === id);
    },
  };
}
