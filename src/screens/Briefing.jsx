import Nova from '../components/Nova.jsx';
import StatusGauges from '../components/StatusGauges.jsx';
import { briefing } from '../engine/nova.js';
import { WORLDS, G, forecastFor } from '../engine/engine.js';

export default function Briefing({ state, onNext, voice, onEva, onGreenhouse }) {
  const lines = briefing(state);
  const w = WORLDS[state.worldId];
  const alert = !!forecastFor(state) || state.broken || state.leak || state.batteryDeadStreak > 0;
  return (
    <div className="screen">
      <div className="sol-banner">
        <span>{w.emoji} {w.name}</span>
        <b>{w.turnLabel} {state.sol} / {G.sols}</b>
      </div>
      <div className="progress"><div style={{ width: `${((state.sol - 1) / G.sols) * 100}%` }} /></div>
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
