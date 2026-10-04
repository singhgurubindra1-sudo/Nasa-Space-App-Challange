import { useEffect, useRef, useState } from 'react';
import { createFppScene } from '../three/fppScene.js';
import { sound } from '../audio/sound.js';
import { G, WORLDS } from '../engine/engine.js';
import GreenhousePanel from './GreenhousePanel.jsx';

const TASKS = [
  { id: 'scan', text: 'Scan 3 rock samples', count: 3 },
  { id: 'solar', text: 'Inspect the solar array' },
  { id: 'greenhouse', text: 'Check the greenhouse controls' },
  { id: 'drive', text: 'Drive the rover to the survey beacon' },
  { id: 'airlock', text: 'Return to the airlock' },
];

const CARDINAL = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };

function Compass({ heading, beacon }) {
  // 180°-wide strip like in shooter games, with a marker for the survey beacon
  const marks = [];
  const first = Math.ceil((heading - 90) / 15) * 15;
  for (let m = first; m <= heading + 90; m += 15) {
    const deg = ((m % 360) + 360) % 360;
    const label = CARDINAL[deg];
    marks.push(
      <span key={m} className={`cmp-tick ${label ? 'cmp-major' : ''}`} style={{ left: `${50 + ((m - heading) / 180) * 100}%` }}>
        {label || deg}
      </span>,
    );
  }
  const rel = ((beacon - heading + 540) % 360) - 180;
  return (
    <div className="cmp" aria-label={`Heading ${Math.round(heading)} degrees`}>
      {marks}
      <span className="cmp-now">{Math.round(heading)}°</span>
      {Math.abs(rel) < 90 && <span className="cmp-beacon" style={{ left: `${50 + (rel / 180) * 100}%` }}>◆</span>}
    </div>
  );
}

function Joystick({ onMove }) {
  const ref = useRef(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const start = useRef(null);
  const handle = (e) => {
    const t = [...e.changedTouches].find((x) => x.identifier === start.current?.id);
    if (!t) return;
    const dx = t.clientX - start.current.x;
    const dy = t.clientY - start.current.y;
    const r = 46;
    const l = Math.min(r, Math.hypot(dx, dy));
    const a = Math.atan2(dy, dx);
    const x = Math.cos(a) * l;
    const y = Math.sin(a) * l;
    setKnob({ x, y });
    onMove(x / r, -y / r);
  };
  return (
    <div
      ref={ref}
      className="joy"
      onTouchStart={(e) => {
        const t = e.changedTouches[0];
        start.current = { id: t.identifier, x: t.clientX, y: t.clientY };
        sound.unlock();
      }}
      onTouchMove={handle}
      onTouchEnd={() => {
        start.current = null;
        setKnob({ x: 0, y: 0 });
        onMove(0, 0);
      }}
    >
      <div className="joy-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

export default function FppView({ state, onClose, onSetCrop }) {
  const canvasRef = useRef(null);
  const apiRef = useRef(null);
  const lookTouch = useRef(null);
  const [hud, setHud] = useState(null);
  const [tasks, setTasks] = useState({});
  const [toast, setToast] = useState(null);
  const [gh, setGh] = useState(false);
  const [help, setHelp] = useState(true);
  const [locked, setLocked] = useState(false);
  const [muted, setMuted] = useState(sound.muted);
  const [failed, setFailed] = useState(false);
  const w = WORLDS[state.worldId];
  const isTouch = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  useEffect(() => {
    let api;
    try {
      api = createFppScene({
        canvas: canvasRef.current,
        worldId: state.worldId,
        onContextLost: () => setFailed(true),
        cb: {
          onHud: setHud,
          onTasks: setTasks,
          onToast: setToast,
          onOpenGreenhouse: () => setGh(true),
          onLockChange: setLocked,
        },
      });
    } catch (e) {
      console.warn('FPP unavailable', e);
      setFailed(true);
      return undefined;
    }
    apiRef.current = api;
    window.__fpp = api; // handy for automated tests and debugging
    sound.unlock();
    sound.startAmbient(state.worldId);
    sound.radio();
    return () => {
      api.dispose();
      apiRef.current = null;
      if (window.__fpp === api) delete window.__fpp;
      sound.stopAll();
    };
  }, [state.worldId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the 3D world in sync with the game state (storms, shadow, greenhouse, shield…)
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    const active = state.active.map((a) => a.id);
    api.update({
      visual: {
        storm: active.includes('dust_storm') ? 1 : 0,
        dark: active.includes('lunar_shadow') ? 1 : 0,
        cold: active.includes('cold_snap') ? 1 : 0,
        shield: state.shield,
        maturity: state.maturity,
        battery: state.battery / G.batteryCapacityKwh,
        ghPower: state.lastChoices.alloc.greenhouse,
        lsFrac: 1,
        alarm: state.broken || state.leak,
        crop: state.crop || 'mixed',
      },
      info: { battery: state.battery, capacity: G.batteryCapacityKwh },
    });
    sound.setStorm(active.includes('dust_storm') ? 1 : 0);
  }, [state]);

  useEffect(() => {
    if (apiRef.current) apiRef.current.setPaused(gh || help);
  }, [gh, help]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), toast.kind === 'scan' ? 7000 : 6000);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    const onEsc = (e) => {
      if (e.code === 'Escape' && gh) setGh(false);
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [gh]);

  const api = () => apiRef.current;
  const driving = hud && hud.mode === 'drive';
  const doneCount = TASKS.filter((t) => (t.count ? (tasks[t.id] || 0) >= t.count : tasks[t.id])).length;

  if (failed) {
    return (
      <div className="fpp">
        <div className="fpp-help">
          <div className="gh-card">
            <h3>First-person mode needs 3D graphics</h3>
            <p>This browser has WebGL turned off, or the graphics card stopped. You can still manage the greenhouse below.</p>
            <button className="btn btn-primary wide" onClick={onClose}>Back to mission</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`fpp fpp-${state.worldId}`}>
      <canvas
        ref={canvasRef}
        className="fpp-canvas"
        onTouchStart={(e) => {
          const t = e.changedTouches[0];
          lookTouch.current = { id: t.identifier, x: t.clientX, y: t.clientY };
          sound.unlock();
        }}
        onTouchMove={(e) => {
          const t = [...e.changedTouches].find((x) => x.identifier === lookTouch.current?.id);
          if (!t || !api()) return;
          api().look((t.clientX - lookTouch.current.x) * 1.4, (t.clientY - lookTouch.current.y) * 1.4);
          lookTouch.current = { id: t.identifier, x: t.clientX, y: t.clientY };
        }}
        onTouchEnd={() => { lookTouch.current = null; }}
      />
      <div className="visor" aria-hidden="true" />
      {driving && hud.driveCam === 'cab' && <div className="cab-frame" aria-hidden="true" />}

      {/* Top: compass + controls */}
      <div className="fpp-top">
        {hud && <Compass heading={hud.heading} beacon={hud.beaconBearing} />}
        <div className="fpp-top-btns">
          <button className="icon-btn" onClick={() => { const m = !muted; setMuted(m); sound.setMuted(m); }} aria-pressed={!muted} title="Sound">{muted ? '🔇' : '🔊'}</button>
          <button className="icon-btn" onClick={() => setHelp(true)} title="Controls">❔</button>
          <button className="icon-btn" onClick={onClose} title="Back to mission">✕ <span className="hide-sm">Exit EVA</span></button>
        </div>
      </div>

      {/* Left: suit status */}
      {hud && (
        <div className="fpp-suit">
          <div className="fpp-row"><span>🫁 Suit O₂</span><b className={hud.suitO2 < 25 ? 'bad' : ''}>{Math.round(hud.suitO2)}%</b></div>
          <div className="gauge-bar"><div className="gauge-fill" style={{ width: `${hud.suitO2}%`, background: hud.suitO2 < 25 ? 'var(--bad)' : 'var(--ok)' }} /></div>
          <div className="fpp-row"><span>⬇ Gravity</span><b>{hud.gravity} m/s²</b></div>
          <div className="fpp-row"><span>☢ Dose rate</span><b>{Math.round((w.doseMsvPerSol / 24) * 1000)} µSv/h</b></div>
          <div className="fpp-row"><span>◆ Beacon</span><b>{Math.round(hud.beaconDist)} m</b></div>
        </div>
      )}

      {/* Right: tasks */}
      <div className="fpp-tasks">
        <b>Commander tasks {doneCount}/{TASKS.length}</b>
        {TASKS.map((t) => {
          const v = tasks[t.id];
          const done = t.count ? (v || 0) >= t.count : !!v;
          return <div key={t.id} className={done ? 'done' : ''}>{done ? '✅' : '⬜'} {t.text}{t.count ? ` (${Math.min(v || 0, t.count)}/${t.count})` : ''}</div>;
        })}
      </div>

      {/* Crosshair */}
      {!driving && <div className={`crosshair ${hud && hud.aimRock ? 'aim' : ''}`} aria-hidden="true" />}
      {hud && hud.aimRock && !driving && <div className="aim-hint">{isTouch ? 'Tap 🔬 to scan sample' : 'Click to scan sample'}</div>}

      {/* Interaction prompt */}
      {hud && hud.prompt && (
        <button className="fpp-prompt" onClick={() => api() && api().use()}>
          <kbd>{isTouch ? 'USE' : 'E'}</kbd> {hud.prompt.label}
        </button>
      )}

      {/* Rover dashboard */}
      {driving && hud.rover && (
        <div className="dash">
          <div className="dash-speed"><b>{hud.rover.kmh.toFixed(0)}</b><span>km/h{hud.rover.reverse ? ' R' : ''}</span></div>
          <div className="dash-grid">
            <div><span>🔋 Rover battery</span><b className={hud.rover.battery < 20 ? 'bad' : ''}>{Math.round(hud.rover.battery)}%</b></div>
            <div><span>🧭 Heading</span><b>{Math.round(hud.heading)}°</b></div>
            <div><span>↕ Pitch</span><b>{hud.rover.pitch.toFixed(0)}°</b></div>
            <div><span>↔ Roll</span><b>{hud.rover.roll.toFixed(0)}°</b></div>
          </div>
          {hud.rover.airborne && <div className="dash-air">AIRBORNE — low gravity!</div>}
          {hud.rover.battery < 1 && <div className="dash-air">Battery flat: crawl back to the base battery bank to recharge</div>}
          <button className="btn btn-ghost small-btn" onClick={() => api() && api().toggleCam()}>🎥 {hud.driveCam === 'cab' ? 'Chase camera' : 'Cab view'}</button>
        </div>
      )}

      {/* Toast / fact card */}
      {toast && (
        <div className={`fpp-toast ${toast.kind === 'scan' ? 'scan' : ''}`} role="status">
          <b>{toast.title}</b>
          <p>{toast.text}</p>
        </div>
      )}

      {/* Touch controls */}
      {isTouch && !gh && !help && (
        <>
          <Joystick onMove={(x, y) => api() && api().setTouchMove(x, y)} />
          <div className="touch-btns">
            {!driving && <button className="tbtn tbtn-fire" onTouchStart={(e) => { e.preventDefault(); api() && api().fire(); }}>🔬</button>}
            {!driving && <button className="tbtn" onTouchStart={(e) => { e.preventDefault(); api() && api().jump(); }}>⤒<small>Jump</small></button>}
            {!driving && (
              <button className="tbtn" onTouchStart={(e) => { e.preventDefault(); api() && api().setSprint(true); }} onTouchEnd={() => api() && api().setSprint(false)}>»<small>Sprint</small></button>
            )}
            <button className="tbtn" onTouchStart={(e) => { e.preventDefault(); api() && api().use(); }}>✋<small>Use</small></button>
            <button className="tbtn" onTouchStart={(e) => { e.preventDefault(); api() && api().toggleLamp(); }}>🔦<small>Lamp</small></button>
          </div>
        </>
      )}

      {!isTouch && !locked && !help && !gh && !driving && <div className="lock-hint">Click to look around · Esc to free the mouse</div>}

      {help && (
        <div className="fpp-help" role="dialog" aria-modal="true" aria-label="EVA controls">
          <div className="gh-card">
            <h3>🧑‍🚀 EVA: you are the Commander</h3>
            <p className="muted">You're outside on {w.id === 'moon' ? 'the Moon' : 'Mars'} at {w.place}. Walk the base, scan rocks with your sample scanner, check the greenhouse and drive the rover to the survey beacon.</p>
            {isTouch ? (
              <ul>
                <li>Left thumb: joystick to walk or drive</li>
                <li>Right side: drag to look around</li>
                <li>🔬 scan · ⤒ jump · » sprint · ✋ use · 🔦 helmet lamp</li>
              </ul>
            ) : (
              <ul>
                <li><kbd>W A S D</kbd> walk / drive · <kbd>Mouse</kbd> look</li>
                <li><kbd>Click</kbd> scan rock · <kbd>Space</kbd> jump · <kbd>Shift</kbd> sprint</li>
                <li><kbd>E</kbd> use / board rover · <kbd>C</kbd> rover camera · <kbd>L</kbd> helmet lamp</li>
              </ul>
            )}
            <p className="muted small">
              {w.id === 'moon'
                ? '🔇 Sound check: the Moon has no air, so you only hear sounds inside your suit — breathing, the fan, the radio, and footsteps through your boots.'
                : '🌬 Sound check: Mars air is very thin (less than 1% of Earth’s pressure), so wind sounds faint and muffled. NASA’s Perseverance recorded real Martian wind with its microphones.'}
            </p>
            <button
              className="btn btn-primary wide"
              onClick={() => {
                sound.unlock();
                sound.startAmbient(state.worldId);
                setHelp(false);
              }}
            >
              Start EVA
            </button>
          </div>
        </div>
      )}

      {gh && (
        <GreenhousePanel
          state={state}
          onSetCrop={onSetCrop}
          onClose={() => setGh(false)}
        />
      )}
    </div>
  );
}
