import { useEffect, useRef, useState } from 'react';
import { createBaseScene } from '../three/baseScene.js';
import { conditions, G, WORLDS } from '../engine/engine.js';

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

function labelText(id, s, c) {
  switch (id) {
    case 'hab': return `🏠 Habitat · ❤ ${Math.round(s.health)}%`;
    case 'shield': return `🛡 Regolith shield ${Math.round(s.shield)}%`;
    case 'greenhouse': return `🌱 Greenhouse ${Math.round(s.maturity * 100)}%`;
    case 'solar': return `☀ Solar ${c.solar} kWh`;
    case 'battery': return `🔋 ${Math.round(s.battery)}/${G.batteryCapacityKwh} kWh`;
    case 'reactor': return `⚛ Reactor ${c.reactor} kWh`;
    case 'antenna': return '📡 Link to Earth';
    case 'lander': return '🚀 Lander';
    case 'rover': return '🚙 Rover';
    default: return id;
  }
}

// Persistent 3D view of the base. Stays mounted across briefing / plan / event screens.
export default function BaseView({ state, report, screen, preview, onEva }) {
  const canvasRef = useRef(null);
  const apiRef = useRef(null);
  const labelRefs = useRef({});
  const playedRef = useRef(null);
  const [ids, setIds] = useState([]);
  const [failed, setFailed] = useState(false);
  const [showLabels, setShowLabels] = useState(() => window.innerWidth > 520);
  const worldId = state.worldId;
  const w = WORLDS[worldId];

  useEffect(() => {
    if (!webglAvailable()) {
      setFailed(true);
      return undefined;
    }
    let api;
    try {
      const reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      api = createBaseScene({ canvas: canvasRef.current, worldId, reducedMotion, onContextLost: () => setFailed('lost') });
    } catch (e) {
      console.warn('3D base view unavailable', e);
      setFailed(true);
      return undefined;
    }
    apiRef.current = api;
    setIds(api.labelIds);
    api.onLabels((pos) => {
      for (const id in pos) {
        const el = labelRefs.current[id];
        if (!el) continue;
        const p = pos[id];
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
        el.style.visibility = p.visible ? '' : 'hidden';
      }
    });
    return () => {
      api.dispose();
      apiRef.current = null;
    };
  }, [worldId]);

  // Feed game state into the scene.
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    const shown = screen === 'event' && report ? report.after : state;
    const active = state.active.map((a) => a.id);
    // On the event screen, a brand-new storm/shadow is already "rolling in".
    const newId = screen === 'event' && report && report.event ? report.event.id : null;
    api.update({
      storm: active.includes('dust_storm') || newId === 'dust_storm' ? 1 : 0,
      dark: active.includes('lunar_shadow') || newId === 'lunar_shadow' ? 1 : 0,
      cold: active.includes('cold_snap') || newId === 'cold_snap' ? 1 : 0,
      shield: shown.shield,
      maturity: shown.maturity,
      battery: shown.battery / G.batteryCapacityKwh,
      ghPower: preview ? preview.greenhouse : state.lastChoices.alloc.greenhouse,
      lsFrac: preview ? Math.min(1, preview.lifeSupport / Math.max(1, conditions(state).lsPowerNeeded)) : 1,
      alarm: state.broken || state.leak,
      crop: state.crop || 'mixed',
    });
    if (newId && playedRef.current !== `${report.sol}-${newId}`) {
      playedRef.current = `${report.sol}-${newId}`;
      api.playEvent(newId);
    }
  }, [state, report, screen, preview, ids]);

  if (failed) {
    return failed === 'lost' ? (
      <div className="space-fallback">
        <p>🪐 The 3D base view stopped. <button className="btn btn-secondary small-btn" onClick={() => window.location.reload()}>Restart 3D view</button></p>
      </div>
    ) : null;
  }

  const c = conditions(state);
  return (
    <div className={`base-stage base-${worldId} ${screen === 'plan' ? 'base-compact' : ''}`}>
      <canvas ref={canvasRef} className="space-canvas" aria-label={`3D view of your base at ${w.place}. Drag to look around.`} />
      <div className="space-labels">
        {ids.map((id) => (
          <span key={id} ref={(el) => { labelRefs.current[id] = el; }} className={`base-label ${showLabels ? '' : 'base-label-hidden'}`}>
            {labelText(id, state, c)}
          </span>
        ))}
      </div>
      <div className="base-hud">
        <span className="space-chip">{w.emoji} {w.place}</span>
        {onEva && <button className="space-chip eva-chip" onClick={onEva}>🧑‍🚀 EVA</button>}
        <button className="space-chip" onClick={() => setShowLabels(!showLabels)} aria-pressed={showLabels}>
          {showLabels ? 'Hide labels' : 'Show labels'}
        </button>
      </div>
      <p className="base-credit">3D impression made in code · drag to look around</p>
    </div>
  );
}
