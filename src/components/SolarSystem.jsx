import { useEffect, useRef, useState } from 'react';
import { createSolarScene } from '../three/solarScene.js';
import { daysSinceJ2000, dateFromDays } from '../engine/orbits.js';

const LABELS = {
  sun: 'Sun', mercury: 'Mercury', venus: 'Venus', earth: 'Earth', jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune',
};
const SPEEDS = [
  { v: 0, label: 'Pause' },
  { v: 1, label: '1 day/s' },
  { v: 8, label: '8 days/s' },
  { v: 40, label: '40 days/s' },
];

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

export default function SolarSystem({ selected, focused, onSelect, onOverview, onDays }) {
  const canvasRef = useRef(null);
  const apiRef = useRef(null);
  const labelRefs = useRef({});
  const dateRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [speed, setSpeed] = useState(() => (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 8));
  const [toast, setToast] = useState(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onDaysRef = useRef(onDays);
  onDaysRef.current = onDays;

  useEffect(() => {
    if (!webglAvailable()) {
      setFailed(true);
      return undefined;
    }
    let api;
    try {
      const reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      api = createSolarScene({
        canvas: canvasRef.current,
        startDays: daysSinceJ2000(Date.now()),
        reducedMotion,
        onContextLost: () => setFailed('lost'),
        onPick: (id, info) => {
          if (id === 'moon' || id === 'mars') onSelectRef.current(id);
          else setToast(`${info.name}: not a mission target in this game. Try the Moon or Mars!`);
        },
      });
    } catch (e) {
      console.warn('3D view unavailable', e);
      setFailed(true);
      return undefined;
    }
    apiRef.current = api;
    let lastDay = -1;
    let lastReport = 0;
    api.onLabels((state, days) => {
      for (const id in state) {
        const el = labelRefs.current[id];
        if (!el) continue;
        const s = state[id];
        const target = id === 'moon' || id === 'mars';
        const gap = Math.min(s.r, 400);
        el.style.transform = target
          ? `translate(${s.x}px, ${s.y + gap + 10}px) translateX(-50%)`
          : `translate(${s.x}px, ${s.y - gap - 4}px) translate(-50%, -100%)`;
        // visibility (not opacity) so off-screen labels can't take keyboard focus
        el.style.visibility = s.visible ? '' : 'hidden';
      }
      const d = Math.floor(days);
      if (d !== lastDay) {
        lastDay = d;
        if (dateRef.current) dateRef.current.textContent = dateFromDays(days).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        const now = performance.now();
        if (onDaysRef.current && now - lastReport > 250) {
          lastReport = now;
          onDaysRef.current(days);
        }
      }
    });
    return () => {
      api.dispose();
      apiRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!apiRef.current) return;
    apiRef.current.setSelected(selected);
  }, [selected]);

  useEffect(() => {
    if (!apiRef.current) return;
    if (focused) apiRef.current.setFocus(focused);
    else apiRef.current.overview();
  }, [focused]);

  useEffect(() => {
    if (apiRef.current) apiRef.current.setSpeed(speed);
  }, [speed]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  if (failed) {
    return (
      <div className="space-fallback">
        {failed === 'lost' ? (
          <p>
            🪐 The 3D view stopped (the graphics card was busy).{' '}
            <button className="btn btn-secondary small-btn" onClick={() => window.location.reload()}>Restart 3D view</button>
          </p>
        ) : (
          <p>🪐 The 3D solar system needs WebGL, which this browser has turned off. You can still pick a world below.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-stage">
      <canvas ref={canvasRef} className="space-canvas" aria-label="3D solar system. Drag to rotate, scroll or pinch to zoom. Tap the Moon or Mars to choose a mission." />
      <div className="space-labels" aria-hidden="false">
        {Object.entries(LABELS).map(([id, name]) => (
          <span key={id} ref={(el) => { labelRefs.current[id] = el; }} className="space-label">{name}</span>
        ))}
        {['moon', 'mars'].map((id) => (
          <button
            key={id}
            ref={(el) => { labelRefs.current[id] = el; }}
            className={`space-target space-target-${id} ${selected === id ? 'selected' : ''}`}
            onClick={() => onSelect(id)}
          >
            {id === 'moon' ? '🌕 Moon' : '🔴 Mars'}
            <small>{selected === id ? 'Selected ✓' : 'Tap to choose'}</small>
          </button>
        ))}
      </div>

      <div className="space-hud space-hud-top">
        <div className="space-date">
          <span className="muted">Sim date</span>
          <b ref={dateRef}>—</b>
        </div>
        <div className="space-speed" role="group" aria-label="Simulation speed">
          {SPEEDS.map((s) => (
            <button key={s.v} className={speed === s.v ? 'selected' : ''} onClick={() => setSpeed(s.v)} aria-pressed={speed === s.v}>{s.label}</button>
          ))}
        </div>
      </div>

      <div className="space-hud space-hud-bottom">
        {focused ? (
          <button className="space-chip" onClick={onOverview}>🔭 Back to solar system</button>
        ) : (
          <span className="space-chip muted">Drag to rotate · pinch/scroll to zoom</span>
        )}
      </div>
      {toast && <div className="space-toast" role="status">{toast}</div>}
    </div>
  );
}
