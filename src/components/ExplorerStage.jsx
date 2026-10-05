import { useEffect, useRef, useState, useCallback } from 'react';
import { createExplorer, KIND_COLORS } from '../three/explorerScene.js';
import { satelliteElements, brightestSatellites, closeApproaches, asteroidOrbit, NASA_KEY_IS_DEMO } from '../live/live.js';
import catalog from '../data/spacecraft.json' with { type: 'json' };
import asteroids from '../data/asteroids.json' with { type: 'json' };

export const MODES = [
  { id: 'galaxy', icon: '🌌', label: 'Galaxy', caption: 'The Milky Way: about 100,000 light years across with 100–400 billion stars. The Sun sits in a small arm 26,000 light years from the centre. Tap the Sun to zoom into our Solar System.' },
  { id: 'solar', icon: '☀️', label: 'Solar System', caption: 'Planets where they are right now (JPL orbital elements), deep-space probes and famous asteroids. Distances are squeezed so everything fits.' },
  { id: 'earth', icon: '🌍', label: 'Earth orbit', caption: 'Live satellites moving in real time from today\'s CelesTrak orbital data. Earth turns and the day/night line is where it really is now.' },
  { id: 'neo', icon: '☄️', label: 'Asteroids', caption: 'Asteroids flying past Earth this week, live from NASA NeoWs. Distance from Earth is to scale on a log ruler (each ring is 10× further).' },
  { id: 'moon', icon: '🌕', label: 'Moon', caption: 'Lit by the real Sun angle, so you see today\'s Moon phase. South-pole landing sites (where your base is), the empty north pole, Apollo sites and orbiters.' },
  { id: 'mars', icon: '🔴', label: 'Mars', caption: 'Real Mars clock (NASA Mars24): local time at Jezero right now, the north polar ice cap, rovers, orbiters, Phobos and Deimos.' },
];

const WARPS = [
  { v: 1, label: '1×' },
  { v: 60, label: '1 min/s' },
  { v: 600, label: '10 min/s' },
  { v: 3600, label: '1 h/s' },
  { v: 86400, label: '1 day/s' },
];

const BADGES = {
  live: ['LIVE DATA', 'b-live'],
  stale: ['LAST KNOWN', 'b-stale'],
  computed: ['COMPUTED NOW', 'b-comp'],
  model: ['REAL ORBIT · POSITION ESTIMATED', 'b-model'],
  estimate: ['ESTIMATE (OFFLINE)', 'b-model'],
  predicted: ['PREDICTED', 'b-pred'],
  offline: ['OFFLINE', 'b-model'],
  fixed: ['FACT', 'b-comp'],
};
const KIND_LABEL = {
  station: 'Space station', satellite: 'Satellite', telescope: 'Space telescope', orbiter: 'Orbiter', probe: 'Space probe', moonlet: 'Moon',
  base: 'Your base', lander: 'Lander', rover: 'Rover', heritage: 'Historic site', poi: 'Place', asteroid: 'Asteroid', hazardous: 'Asteroid · potentially hazardous',
  planet: 'World', star: 'Star', galaxy: 'Galaxy', bright: 'Satellite (bright)',
};

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}
const ago = (t) => {
  if (!t) return '';
  const m = Math.round((Date.now() - t) / 60000);
  return m < 2 ? 'just now' : m < 120 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

export default function ExplorerStage({ onMission }) {
  const canvasRef = useRef(null);
  const apiRef = useRef(null);
  const labelRefs = useRef({});
  const clockRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [mode, setModeState] = useState('galaxy');
  const [objs, setObjs] = useState([]);
  const [labels, setLabels] = useState([]);
  const [selId, setSelId] = useState(null);
  const [info, setInfo] = useState(null);
  const [warp, setWarp] = useState(1);
  const [isLive, setIsLive] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [bright, setBright] = useState(false);
  const [fade, setFade] = useState(false);
  const [version, setVersion] = useState(0);
  const [status, setStatus] = useState({
    tle: { ok: 0, done: 0, total: catalog.earth.length, stale: 0, fetchedAt: null },
    neo: { state: 'loading', count: 0, fetchedAt: null },
    orbits: { ok: 0, done: 0, total: asteroids.famous.length },
    bright: { state: 'idle', count: 0 },
  });

  const refreshLists = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    setObjs(api.objects().map((o) => ({ id: o.id, name: o.name, kind: o.kind, color: o.color })));
    setLabels(api.labelObjects().map((o) => ({ id: o.id, name: o.name, kind: o.kind, color: o.color })));
  }, []);

  // ---------- create the 3D scene ----------
  useEffect(() => {
    if (!webglAvailable()) {
      setFailed(true);
      return undefined;
    }
    let api;
    try {
      const reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      api = createExplorer({
        canvas: canvasRef.current,
        reducedMotion,
        onContextLost: () => setFailed('lost'),
        onSelect: (id) => setSelId(id),
      });
    } catch (e) {
      console.warn('3D view unavailable', e);
      setFailed(true);
      return undefined;
    }
    apiRef.current = api;
    api.setMode('galaxy');
    refreshLists();
    let lastClock = 0;
    api.onLabels((state, ms) => {
      for (const id in state) {
        const el = labelRefs.current[id];
        if (!el) continue;
        const s = state[id];
        el.style.transform = `translate(${s.x}px, ${s.y + Math.min(s.r, 300) + 8}px) translateX(-50%)`;
        el.style.visibility = s.visible ? '' : 'hidden';
      }
      const now = performance.now();
      if (now - lastClock > 250 && clockRef.current) {
        lastClock = now;
        const d = new Date(ms);
        clockRef.current.textContent = `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 19)} UTC`;
      }
    });
    return () => {
      api.dispose();
      apiRef.current = null;
    };
  }, [refreshLists]);

  // ---------- live data ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Earth satellites, four at a time
      const queue = [...catalog.earth];
      const worker = async () => {
        while (queue.length && !cancelled) {
          const sat = queue.shift();
          const res = await satelliteElements(sat);
          if (cancelled) return;
          if (apiRef.current) apiRef.current.setTle(sat.id, res);
          setStatus((s) => ({
            ...s,
            tle: {
              ...s.tle,
              done: s.tle.done + 1,
              ok: s.tle.ok + (res.satrec ? 1 : 0),
              stale: s.tle.stale + (res.satrec && res.state === 'stale' ? 1 : 0),
              fetchedAt: res.fetchedAt ? Math.max(res.fetchedAt, s.tle.fetchedAt || 0) : s.tle.fetchedAt,
            },
          }));
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
    })();
    (async () => {
      const res = await closeApproaches();
      if (cancelled) return;
      if (apiRef.current) apiRef.current.setNeos(res.list, res.state);
      setStatus((s) => ({ ...s, neo: { state: res.list.length ? res.state : 'offline', count: res.list.length, fetchedAt: res.fetchedAt, error: res.error } }));
      setVersion((v) => v + 1);
      for (const a of asteroids.famous) {
        const r = await asteroidOrbit(a.neo);
        if (cancelled) return;
        if (apiRef.current) apiRef.current.setAsteroidOrbit(a.id, r);
        setStatus((s) => ({ ...s, orbits: { ...s.orbits, done: s.orbits.done + 1, ok: s.orbits.ok + (r.data ? 1 : 0) } }));
        if (!r.data && r.state === 'offline' && /HTTP 429/.test(r.error || '')) break; // rate-limited: stop asking
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!bright || status.bright.state !== 'idle') return;
    setStatus((s) => ({ ...s, bright: { state: 'loading', count: 0 } }));
    brightestSatellites().then((res) => {
      if (apiRef.current) {
        apiRef.current.setBright(res.list);
        apiRef.current.showBright(true);
      }
      setStatus((s) => ({ ...s, bright: { state: res.list.length ? res.state : 'offline', count: res.list.length } }));
    });
  }, [bright, status.bright.state]);
  useEffect(() => {
    if (apiRef.current && mode === 'earth' && status.bright.state !== 'idle') apiRef.current.showBright(bright);
  }, [bright, mode, status.bright.state]);

  // NEO list arrived → refresh labels if that view is open
  useEffect(() => {
    refreshLists();
  }, [version, refreshLists]);

  // ---------- selection & info panel ----------
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return undefined;
    api.select(selId);
    if (!selId) {
      setInfo(null);
      return undefined;
    }
    const tick = () => setInfo(api.readout(selId));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [selId]);

  const setMode = (m) => {
    if (m === mode) return;
    setFade(true);
    setTimeout(() => {
      if (!apiRef.current) return;
      apiRef.current.setMode(m);
      setModeState(m);
      setSelId(null);
      refreshLists();
      setFade(false);
    }, 220);
  };

  const stageRef = useRef(null);
  const pick = (id, fly = false) => {
    setSelId(id);
    if (fly && apiRef.current) apiRef.current.focus(id);
    if (fly && stageRef.current) {
      const r = stageRef.current.getBoundingClientRect();
      if (r.top < -r.height * 0.3 || r.bottom > window.innerHeight + r.height * 0.3) stageRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };
  const changeWarp = (v) => {
    setWarp(v);
    setIsLive(v === 1 && isLive);
    if (apiRef.current) apiRef.current.setWarp(v);
  };
  const goLive = () => {
    setWarp(1);
    setIsLive(true);
    if (apiRef.current) apiRef.current.live();
  };
  const jumpTo = (ms) => {
    if (!apiRef.current) return;
    apiRef.current.setTime(ms);
    setIsLive(false);
  };

  if (failed) {
    return (
      <div className="space-fallback">
        {failed === 'lost' ? (
          <p>🪐 The 3D view stopped (the graphics card was busy). <button className="btn btn-secondary small-btn" onClick={() => window.location.reload()}>Restart 3D view</button></p>
        ) : (
          <p>🪐 The 3D explorer needs WebGL, which this browser has turned off. You can still go to the mission dashboard below.</p>
        )}
      </div>
    );
  }

  const modeInfo = MODES.find((m) => m.id === mode);
  const tle = status.tle;
  const tleChip = tle.done < tle.total && tle.ok === 0 ? ['…', 'Loading satellites'] : tle.ok ? [tle.stale ? 'stale' : 'live', `${tle.ok}/${tle.total} satellites live`] : ['off', 'Satellites: offline estimates'];
  const neoChip = status.neo.state === 'loading' ? ['…', 'Loading asteroids'] : status.neo.count ? [status.neo.state === 'stale' ? 'stale' : 'live', `${status.neo.count} asteroid flybys this week`] : ['off', 'Asteroid feed offline'];
  const grouped = {};
  for (const o of objs) (grouped[KIND_LABEL[o.kind] || o.kind] = grouped[KIND_LABEL[o.kind] || o.kind] || []).push(o);
  const badge = info ? BADGES[info.badge] || BADGES.computed : null;
  const data = info && info.data;

  return (
    <div className="explorer">
      <div className="ex-tabs" role="tablist" aria-label="Explorer views">
        {MODES.map((m) => (
          <button key={m.id} role="tab" aria-selected={mode === m.id} className={mode === m.id ? 'on' : ''} onClick={() => setMode(m.id)}>
            <span aria-hidden="true">{m.icon}</span> {m.label}
          </button>
        ))}
      </div>

      <div className="ex-stage" ref={stageRef}>
        <canvas ref={canvasRef} className={`space-canvas ${fade ? 'ex-fade' : ''}`} aria-label={`3D ${modeInfo.label} view. Drag to rotate, pinch or scroll to zoom, tap an object for live information.`} />
        <div className="space-labels">
          {showLabels && labels.map((l) => (
            <button
              key={`${mode}-${l.id}`}
              ref={(el) => { labelRefs.current[l.id] = el; }}
              className={`ex-label ${selId === l.id ? 'sel' : ''}`}
              style={{ '--c': l.color }}
              onClick={() => pick(l.id)}
            >
              {l.name}
            </button>
          ))}
        </div>

        <div className="ex-top">
          <div className="ex-status">
            <span className={`ex-chip c-${tleChip[0]}`} title={tle.fetchedAt ? `CelesTrak elements fetched ${ago(tle.fetchedAt)}` : 'CelesTrak'}>🛰 {tleChip[1]}</span>
            <span className={`ex-chip c-${neoChip[0]}`} title={status.neo.fetchedAt ? `NASA NeoWs fetched ${ago(status.neo.fetchedAt)}` : 'NASA NeoWs'}>☄ {neoChip[1]}</span>
          </div>
          <div className="ex-tools">
            <button className={`ex-chip ${showLabels ? 'on' : ''}`} onClick={() => setShowLabels(!showLabels)} aria-pressed={showLabels}>🏷 Labels</button>
            {mode === 'earth' && (
              <button className={`ex-chip ${bright ? 'on' : ''}`} onClick={() => setBright(!bright)} aria-pressed={bright} title="CelesTrak's ~150 brightest satellites">
                ✨ {status.bright.state === 'loading' ? 'Loading…' : bright && status.bright.count ? `${status.bright.count} bright sats` : bright && status.bright.state === 'offline' ? 'Unavailable' : 'Bright sats'}
              </button>
            )}
            <button className="ex-chip" onClick={() => { setSelId(null); apiRef.current && apiRef.current.home(); }}>🔭 Reset view</button>
          </div>
        </div>

        {mode !== 'galaxy' && (
          <div className="ex-time">
            <button className={`ex-live ${isLive && warp === 1 ? 'on' : ''}`} onClick={goLive} title="Back to real time">● LIVE</button>
            <b ref={clockRef} className="ex-clock">—</b>
            <div className="ex-warp" role="group" aria-label="Time speed">
              {WARPS.map((w) => (
                <button key={w.v} className={warp === w.v ? 'on' : ''} onClick={() => changeWarp(w.v)} aria-pressed={warp === w.v}>{w.label}</button>
              ))}
            </div>
          </div>
        )}

        {info && (
          <aside className="ex-info" aria-live="polite">
            <button className="ex-close" onClick={() => setSelId(null)} aria-label="Close">✕</button>
            <span className="ex-kind" style={{ '--c': KIND_COLORS[info.kind] || '#94a3b8' }}>{KIND_LABEL[info.kind] || info.kind}</span>
            <h3>{info.name}</h3>
            <span className={`ex-badge ${badge[1]}`}>{badge[0]}</span>
            {data && (data.agency || data.launched || data.status) && (
              <p className="ex-meta">
                {data.agency && <span>{data.agency}</span>}
                {data.launched && <span>Launched {data.launched}</span>}
                {data.status && <span>{data.status}</span>}
              </p>
            )}
            {data && data.purpose && <p>{data.purpose}</p>}
            <dl className="ex-rows">
              {info.rows.map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
            {data && data.facts && (
              <ul className="ex-facts">{data.facts.map((f) => <li key={f}>{f}</li>)}</ul>
            )}
            {info.note && <p className="muted small">{info.note}</p>}
            <div className="ex-actions">
              <button className="btn btn-secondary small-btn" onClick={() => apiRef.current && apiRef.current.focus(info.id)}>🎯 Fly to</button>
              {info.id === 'g-sun' && <button className="btn btn-primary small-btn" onClick={() => setMode('solar')}>☀️ Enter the Solar System</button>}
              {info.id === 'p-earth' && <button className="btn btn-primary small-btn" onClick={() => setMode('earth')}>🛰 See live satellites</button>}
              {(info.action === 'moon' && mode !== 'moon') && <button className="btn btn-primary small-btn" onClick={() => setMode('moon')}>🌕 Explore the Moon</button>}
              {(info.action === 'mars' && mode !== 'mars') && <button className="btn btn-primary small-btn" onClick={() => setMode('mars')}>🔴 Explore Mars</button>}
              {((info.action === 'moon' && mode === 'moon') || (info.action === 'mars' && mode === 'mars')) && (
                <button className="btn btn-primary small-btn" onClick={() => onMission(mode)}>🚀 Run the 30-sol simulation here</button>
              )}
              {info.id === 'neo-apophis2029' && <button className="btn btn-secondary small-btn" onClick={() => { jumpTo(Date.parse('2029-04-13T09:46:00Z')); changeWarp(3600); }}>⏩ Watch the 2029 flyby</button>}
              {(data && data.url) || info.url ? <a className="btn btn-ghost small-btn" href={(data && data.url) || info.url} target="_blank" rel="noreferrer">More info ↗</a> : null}
            </div>
          </aside>
        )}
      </div>

      <p className="ex-caption"><b>{modeInfo.icon} {modeInfo.label}.</b> {modeInfo.caption}</p>

      <div className="ex-list">
        {Object.entries(grouped).map(([g, list]) => (
          <div key={g} className="ex-group">
            <h4>{g} <small>{list.length}</small></h4>
            <div className="ex-items">
              {list.map((o) => (
                <button key={o.id} className={selId === o.id ? 'on' : ''} style={{ '--c': o.color }} onClick={() => pick(o.id, true)}>{o.name}</button>
              ))}
            </div>
          </div>
        ))}
        {mode === 'neo' && status.neo.state === 'offline' && (
          <p className="muted small">The NASA asteroid feed could not be reached right now{status.neo.error ? ` (${status.neo.error})` : ''}. {NASA_KEY_IS_DEMO ? 'The shared DEMO_KEY allows 30 requests an hour; a free personal key from api.nasa.gov raises that (set VITE_NASA_API_KEY).' : ''} The predicted 2029 Apophis flyby is still shown.</p>
        )}
        {mode === 'earth' && tle.done === tle.total && tle.ok === 0 && (
          <p className="muted small">Live orbital elements from CelesTrak could not be loaded, so satellite positions are estimates (real heights and tilts). Geostationary weather satellites are still in their true spots.</p>
        )}
      </div>
    </div>
  );
}
