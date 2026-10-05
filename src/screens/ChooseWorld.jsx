import { lazy, Suspense, useState } from 'react';
import { WORLDS, G, N } from '../engine/engine.js';
import { needsSummary } from '../engine/nova.js';
import { TARGETS, ORBIT_SOURCES, targetDistance, formatDelay, daysSinceJ2000 } from '../engine/orbits.js';

// three.js is big; load it separately so the game screens stay fast.
const SolarSystem = lazy(() => import('../components/SolarSystem.jsx'));

const fmtKm = (km) => (km >= 1e6 ? `${(km / 1e6).toFixed(1)} million km` : `${Math.round(km).toLocaleString()} km`);

export default function ChooseWorld({ world, setWorld, onStart, onContinue, saved, onLearn, onExplorer }) {
  const [focused, setFocused] = useState(null);
  const [simDays, setSimDays] = useState(() => daysSinceJ2000(Date.now()));
  const todayDays = daysSinceJ2000(Date.now());
  const w = WORLDS[world];
  const t = TARGETS[world];
  const today = targetDistance(world, todayDays);
  const sim = targetDistance(world, simDays);

  const choose = (id) => {
    setWorld(id);
    setFocused(id);
  };

  return (
    <div className="screen">
      <section className="mission-control">
        <div className="mc-title">
          <p className="kicker">Mission Dashboard · Step 2</p>
          <h1>Survive 30 Sols</h1>
          <p className="lead">Choose your destination. Every sol you get one power budget and one big decision.</p>
        </div>
        <Suspense fallback={<div className="space-stage space-loading"><p>🛰 Loading the solar system…</p></div>}>
          <SolarSystem selected={world} focused={focused} onSelect={choose} onOverview={() => setFocused(null)} onDays={setSimDays} />
        </Suspense>
        <p className="mc-note muted small">
          Planets start where they really are today and move with their real orbital periods (NASA fact sheets).
          Sizes and distances are squeezed so everything fits on screen.
        </p>
      </section>

      {onExplorer && <button className="btn btn-ghost wide" onClick={onExplorer}>← Back to the Live Space Explorer</button>}

      {saved && (
        <button className="btn btn-secondary wide" onClick={onContinue}>
          ▶ Continue mission: {WORLDS[saved.worldId].name}, {WORLDS[saved.worldId].turnLabel} {saved.sol}
        </button>
      )}

      <h2 className="section-title">Choose your mission</h2>
      <div className="worlds">
        {Object.values(WORLDS).map((x) => (
          <button key={x.id} className={`world world-${x.id} ${world === x.id ? 'selected' : ''}`} onClick={() => choose(x.id)} aria-pressed={world === x.id}>
            <span className="world-emoji" aria-hidden="true">{x.emoji}</span>
            <span className="world-name">{x.name}</span>
            <span className="world-place">{x.place}</span>
          </button>
        ))}
      </div>

      <div className={`card target-card target-${world}`}>
        <h3>{w.emoji} Target: {w.name} · {w.place}</h3>
        <div className="target-stats">
          <div>
            <span>Distance from Earth today</span>
            <b>{fmtKm(today.km)}</b>
          </div>
          <div>
            <span>Radio message delay</span>
            <b>{formatDelay(today.lightSeconds)}</b>
          </div>
          <div>
            <span>Travel time</span>
            <b>{t.travel}</b>
          </div>
          <div>
            <span>Gravity</span>
            <b>{t.gravity}</b>
          </div>
          <div>
            <span>Length of a day</span>
            <b>{t.day}</b>
          </div>
          <div>
            <span>Temperature</span>
            <b>{t.temperature}</b>
          </div>
          <div>
            <span>Surface radiation</span>
            <b>{t.radiation}</b>
          </div>
          <div>
            <span>⚡ Base power</span>
            <b>{w.reactorKwhPerSol ? `${w.reactorKwhPerSol} kWh reactor + ` : ''}{w.solarClearKwhPerSol} kWh solar</b>
          </div>
        </div>
        {world === 'mars' && Math.abs(simDays - todayDays) > 20 && (
          <p className="muted small">On the sim date above, Mars is {fmtKm(sim.km)} away and a radio message takes {formatDelay(sim.lightSeconds)}.</p>
        )}
        <ul>
          {w.facts.map((f) => <li key={f}>{f}</li>)}
        </ul>
        <p className="lesson">Main lesson: {w.lesson}</p>
        <p className="muted small">
          Sources:{' '}
          {[...t.sources, ...ORBIT_SOURCES.slice(1, 2)].map((s, i) => (
            <span key={s.url}>{i > 0 && ' · '}<a href={s.url} target="_blank" rel="noreferrer">{s.label}</a></span>
          ))}
        </p>
      </div>

      <button className="btn btn-primary wide launch" onClick={onStart}>🚀 Launch mission to {world === 'moon' ? 'the Moon' : 'Mars'}</button>

      <div className="card how">
        <h3>How to play</h3>
        <ol>
          <li><b>Briefing</b>: Nova, your AI mission controller, reports status and the forecast.</li>
          <li><b>Split the power</b> between life support, greenhouse, shielding and science & repair. Unused power charges the battery.</li>
          <li><b>Pick one action</b>: Build, Repair, Plant, Explore or Shelter.</li>
          <li><b>Event</b>: a surprise based on a real NASA story (or a calm day).</li>
          <li><b>Night report</b>: see what changed, and tap “Why?” to learn the science.</li>
        </ol>
        <p className="muted">{needsSummary()} (NASA BVAD). Win: reach {w.turnLabel.toLowerCase()} {G.sols} with the crew healthy and under the {G.doseLimitMsv} mSv radiation limit — that's 1/12 of NASA's {N.careerDoseLimitMsv.value} mSv career limit.</p>
      </div>

      <button className="btn btn-ghost wide" onClick={onLearn}>📘 Learn & Teacher page · NASA sources</button>
    </div>
  );
}
