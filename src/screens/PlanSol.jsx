import { useEffect, useState } from 'react';
import { conditions, forecastFor, G, WORLDS, SYSTEMS } from '../engine/engine.js';

const SYS = {
  lifeSupport: { icon: '🫁', name: 'Life support', what: 'Makes oxygen, recycles 98% of water, heats the hab.' },
  greenhouse: { icon: '🌱', name: 'Greenhouse', what: `Grows food. Needs ~${G.greenhouse.solsToMature} days of power before big harvests. Below ${G.greenhouse.minPowerToSurvive} kWh plants wilt.` },
  shielding: { icon: '🛡', name: 'Shielding', what: 'Robots pile regolith (moon/mars soil) over the hab. Blocks radiation for the rest of the mission.' },
  science: { icon: '🔬', name: 'Science & repair', what: 'Earns science points. 6+ kWh lets the workshop print a spare part.' },
};

const ACT = {
  build: { icon: '🏗', name: 'Build', what: `+${G.shielding.buildActionPercent}% shielding` },
  repair: { icon: '🔧', name: 'Repair', what: 'Fix broken parts or leaks (uses a spare)' },
  plant: { icon: '🌱', name: 'Plant', what: 'Greenhouse grows faster' },
  explore: { icon: '🧑‍🚀', name: 'Explore', what: 'Science + morale, but extra radiation' },
  shelter: { icon: '🛖', name: 'Shelter', what: 'Hide from particle storms (−75% storm dose)' },
};

export default function PlanSol({ state, onLaunch, onBack, onAllocChange }) {
  const w = WORLDS[state.worldId];
  const c = conditions(state);
  const [alloc, setAlloc] = useState(() => {
    // Start from yesterday's plan, trimmed to fit today's power (least important first).
    const a = { ...state.lastChoices.alloc };
    let over = SYSTEMS.reduce((t, k) => t + a[k], 0) - c.available;
    for (const k of ['science', 'shielding', 'greenhouse', 'lifeSupport']) {
      if (over <= 0) break;
      const cut = Math.min(a[k], Math.ceil(over));
      a[k] -= cut;
      over -= cut;
    }
    return a;
  });
  const [action, setAction] = useState(state.broken || state.leak ? 'repair' : state.lastChoices.action);
  useEffect(() => {
    if (onAllocChange) onAllocChange(alloc);
  }, [alloc, onAllocChange]);
  const used = SYSTEMS.reduce((s, k) => s + Number(alloc[k]), 0);
  const left = Math.round((c.available - used) * 10) / 10;
  const net = c.generation - used;
  const batteryAfter = Math.max(0, Math.min(G.batteryCapacityKwh, net >= 0 ? state.battery + net * G.batteryChargeEfficiency : state.battery + net));
  const fc = forecastFor(state);

  const set = (k, v) => {
    v = Number(v);
    const others = used - alloc[k];
    v = Math.min(v, Math.max(0, Math.floor((c.available - others) * 10) / 10));
    setAlloc({ ...alloc, [k]: v });
  };

  const warnings = [];
  if (alloc.lifeSupport < c.lsPowerNeeded) warnings.push(`Life support needs ${c.lsPowerNeeded} kWh${state.broken ? ' (double, because it is broken)' : ''}. Below that, oxygen and water reserves drain.`);
  if (batteryAfter < 3) warnings.push('The battery will be EMPTY tonight. Two empty nights in a row shut the base down.');
  if (alloc.greenhouse > 0 && alloc.greenhouse < G.greenhouse.minPowerToSurvive) warnings.push(`The greenhouse needs at least ${G.greenhouse.minPowerToSurvive} kWh or the plants wilt.`);
  if (action === 'repair' && (state.broken || state.leak) && state.spares === 0 && alloc.science < 6) warnings.push('No spare parts: give Science & repair 6+ kWh so the workshop can print one.');

  return (
    <div className="screen">
      <div className="sol-banner">
        <span>{w.emoji} {w.name}</span>
        <b>{w.turnLabel} {state.sol} / {G.sols}</b>
      </div>
      <h2 className="screen-title">Plan the {w.turnLabel.toLowerCase()}</h2>
      {fc && <div className="forecast-strip">📡 {fc}</div>}

      <div className="power-card">
        <div className="power-row">
          <div><span className="muted">Today's power</span><b>{c.generation} kWh</b><small>☀ {c.solar}{c.reactor ? ` + ⚛ ${c.reactor}` : ''}{c.solarFactor < 1 ? ` (solar ${Math.round((1 - c.solarFactor) * 100)}% down)` : ''}</small></div>
          <div><span className="muted">+ Battery</span><b>{Math.round(state.battery)} kWh</b></div>
          <div className={left < 0 ? 'bad' : ''}><span className="muted">Power left</span><b>{left} / {c.available}</b></div>
        </div>
        <div className="budget-bar" aria-hidden="true">
          {SYSTEMS.map((k) => (
            <div key={k} className={`seg seg-${k}`} style={{ width: `${(alloc[k] / c.available) * 100}%` }} />
          ))}
        </div>
        <p className="battery-after">🔋 Battery tonight: <b className={batteryAfter < 10 ? 'bad' : ''}>{Math.round(batteryAfter)} kWh</b> {net > 0 ? `(charging +${Math.round(net * G.batteryChargeEfficiency)})` : net < 0 ? `(draining ${Math.round(net)})` : ''}</p>
      </div>

      <div className="sliders">
        {SYSTEMS.map((k) => (
          <div key={k} className={`slider slider-${k}`}>
            <label htmlFor={`s-${k}`}>
              <span><span aria-hidden="true">{SYS[k].icon}</span> {SYS[k].name}</span>
              <b>{alloc[k]} kWh</b>
            </label>
            <input id={`s-${k}`} type="range" min="0" max={G.sliderMax[k]} step="1" value={alloc[k]} onChange={(e) => set(k, e.target.value)} />
            <small className="muted">
              {SYS[k].what}
              {k === 'lifeSupport' && <> <b>Needs {c.lsPowerNeeded} today.</b></>}
            </small>
          </div>
        ))}
      </div>

      <h3 className="section-title">Pick one action</h3>
      <div className="actions">
        {Object.entries(ACT).map(([id, a]) => (
          <button key={id} className={`action ${action === id ? 'selected' : ''}`} onClick={() => setAction(id)} aria-pressed={action === id}>
            <span className="action-icon" aria-hidden="true">{a.icon}</span>
            <span className="action-name">{a.name}</span>
            <small>{id === 'explore' && w.exploreWaterKg ? `Science + ${w.exploreWaterKg} kg ice water, extra radiation` : a.what}</small>
          </button>
        ))}
      </div>

      {warnings.length > 0 && (
        <div className="warnings" role="alert">
          {warnings.map((t) => <p key={t}>⚠ {t}</p>)}
        </div>
      )}

      <div className="row sticky">
        <button className="btn btn-ghost" onClick={onBack}>← Briefing</button>
        <button className="btn btn-primary grow" onClick={() => onLaunch({ alloc, action })}>Run the {w.turnLabel.toLowerCase()} ▶</button>
      </div>
    </div>
  );
}
