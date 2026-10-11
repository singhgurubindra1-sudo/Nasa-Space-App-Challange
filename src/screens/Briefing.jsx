import Nova from '../components/Nova.jsx';
import StatusGauges from '../components/StatusGauges.jsx';
import { briefing } from '../engine/nova.js';
import { WORLDS, forecastFor, missionSols } from '../engine/engine.js';
import { moduleById } from '../engine/training.js';

export default function Briefing({ state, onNext, voice, onEva, onGreenhouse }) {
  const lines = briefing(state);
  const w = WORLDS[state.worldId];
  const sols = missionSols(state);
  const mod = state.setup && state.setup.module ? moduleById(state.setup.module) : null;
  const classCode = state.setup && state.setup.classCode;
  const alert = !!forecastFor(state) || state.broken || state.leak || state.batteryDeadStreak > 0;
  return (
    <div className="screen">
      <div className="sol-banner">
        <span>{w.emoji} {w.name}</span>
        <b>{w.turnLabel} {state.sol} / {sols}</b>
      </div>
      <div className="progress"><div style={{ width: `${((state.sol - 1) / sols) * 100}%` }} /></div>
      {mod && (
        <div className="card goal-card">
          <p className="muted small">🎓 {mod.id === 'final' ? 'Final exam' : `Training module ${mod.num}`} · {mod.skill}</p>
          <ul className="criteria">
            {mod.objectives.map((o) => <li key={o.id}>🎯 {o.label}</li>)}
          </ul>
        </div>
      )}
      {classCode && <p className="chip class-chip">🏫 Class mission {classCode}</p>}
      <h2 className="screen-title">Morning briefing</h2>
      <Nova lines={lines} voice={voice} mood={alert ? 'alert' : 'calm'} />
      <div className="eva-row">
        <button className="btn btn-secondary grow" onClick={onEva}>🧑‍🚀 Go outside (first-person EVA)</button>
        <button className="btn btn-ghost" onClick={onGreenhouse}>🌱 Greenhouse</button>
      </div>
      <StatusGauges s={state} />
      <button className="btn btn-primary wide sticky" onClick={onNext}>Plan today →</button>
    </div>
  );
}
