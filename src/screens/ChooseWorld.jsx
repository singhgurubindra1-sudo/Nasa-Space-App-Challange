import { WORLDS, G, N } from '../engine/engine.js';
import { needsSummary } from '../engine/nova.js';

export default function ChooseWorld({ world, setWorld, onStart, onContinue, saved, onLearn }) {
  return (
    <div className="screen">
      <header className="hero">
        <p className="kicker">NASA Space Apps 2026 · Junior Astronaut Mission Trainer</p>
        <h1>Survive 30 Sols</h1>
        <p className="lead">Every {`sol`} you get one power budget and one big decision. Will your crew make it home?</p>
      </header>

      {saved && (
        <button className="btn btn-secondary wide" onClick={onContinue}>
          ▶ Continue mission: {WORLDS[saved.worldId].name}, {WORLDS[saved.worldId].turnLabel} {saved.sol}
        </button>
      )}

      <h2 className="section-title">1 · Choose your world</h2>
      <div className="worlds">
        {Object.values(WORLDS).map((w) => (
          <button key={w.id} className={`world world-${w.id} ${world === w.id ? 'selected' : ''}`} onClick={() => setWorld(w.id)} aria-pressed={world === w.id}>
            <span className="world-emoji" aria-hidden="true">{w.emoji}</span>
            <span className="world-name">{w.name}</span>
            <span className="world-place">{w.place}</span>
          </button>
        ))}
      </div>

      <div className="card world-facts">
        <h3>{WORLDS[world].emoji} {WORLDS[world].place}</h3>
        <ul>
          {WORLDS[world].facts.map((f) => <li key={f}>{f}</li>)}
          <li>⚡ Power: {WORLDS[world].reactorKwhPerSol ? `${WORLDS[world].reactorKwhPerSol} kWh/${WORLDS[world].turnLabel.toLowerCase()} from a small reactor + ` : ''}{WORLDS[world].solarClearKwhPerSol} kWh from solar on a clear {WORLDS[world].turnLabel.toLowerCase()}.</li>
          <li>☢ Radiation: {WORLDS[world].doseMsvPerSol} mSv per day ({world === 'moon' ? 'Chang\'e-4 LND' : 'Curiosity RAD'} measurement).</li>
        </ul>
        <p className="lesson">Main lesson: {WORLDS[world].lesson}</p>
      </div>

      <button className="btn btn-primary wide" onClick={onStart}>🚀 Start mission</button>

      <div className="card how">
        <h3>How to play</h3>
        <ol>
          <li><b>Briefing</b>: Nova, your AI mission controller, reports status and the forecast.</li>
          <li><b>Split the power</b> between life support, greenhouse, shielding and science & repair. Unused power charges the battery.</li>
          <li><b>Pick one action</b>: Build, Repair, Plant, Explore or Shelter.</li>
          <li><b>Event</b>: a surprise based on a real NASA story (or a calm day).</li>
          <li><b>Night report</b>: see what changed, and tap “Why?” to learn the science.</li>
        </ol>
        <p className="muted">{needsSummary()} (NASA BVAD). Win: reach {WORLDS[world].turnLabel.toLowerCase()} {G.sols} with the crew healthy and under the {G.doseLimitMsv} mSv radiation limit — that's 1/12 of NASA's {N.careerDoseLimitMsv.value} mSv career limit.</p>
      </div>

      <button className="btn btn-ghost wide" onClick={onLearn}>📘 Learn & Teacher page · NASA sources</button>
    </div>
  );
}
