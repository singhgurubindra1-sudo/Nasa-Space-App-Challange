import { CROPS, cropFor, G, WORLDS } from '../engine/engine.js';
import { sound } from '../audio/sound.js';

// Greenhouse control console: choose what to grow, see growth and the expected harvest.
export default function GreenhousePanel({ state, onSetCrop, onClose }) {
  const current = cropFor(state);
  const currentId = state.crop || 'mixed';
  const t = WORLDS[state.worldId].turnLabel.toLowerCase();
  const power = state.lastChoices.alloc.greenhouse;
  const powerFrac = Math.min(1, power / G.greenhouse.fullPowerKwh);
  const perSol = current.maxFoodKgPerSol * state.maturity * powerFrac;
  const solsLeft = state.maturity >= 1 ? 0 : Math.ceil(((1 - state.maturity) * current.solsToMature) / Math.max(0.05, powerFrac));

  return (
    <div className="gh-panel" role="dialog" aria-modal="true" aria-label="Greenhouse controls">
      <div className="gh-card">
        <div className="gh-head">
          <h3>🌱 Greenhouse control</h3>
          <button className="icon-btn" onClick={() => { sound.blip(700, 0.05, 0.05); onClose(); }} aria-label="Close">✕</button>
        </div>
        <div className="gh-status">
          <div><span>Growing</span><b>{current.emoji} {current.name}</b></div>
          <div><span>Growth</span><b>{Math.round(state.maturity * 100)}%</b><div className="gauge-bar"><div className="gauge-fill" style={{ width: `${state.maturity * 100}%`, background: 'var(--ok)' }} /></div></div>
          <div><span>Grow-light power</span><b>{power} kWh</b></div>
          <div><span>Harvest now</span><b>{perSol.toFixed(1)} kg/{t}</b></div>
          <div><span>Full harvest in</span><b>{solsLeft === 0 ? 'ready now' : `~${solsLeft} ${t}s`}</b></div>
        </div>
        <p className="muted small">
          The pink light is red + blue LEDs, like NASA's Veggie unit on the ISS. Plants use red and blue light most for photosynthesis, so the base doesn't waste power on green light.
          Set the power on the Plan screen.
        </p>
        <h4>Choose a crop</h4>
        <div className="gh-crops">
          {Object.entries(CROPS).map(([id, c]) => (
            <div key={id} className={`gh-crop ${currentId === id ? 'selected' : ''}`}>
              <div className="gh-crop-top">
                <span className="gh-emoji" aria-hidden="true">{c.emoji}</span>
                <div>
                  <b>{c.name}</b>
                  <small>{c.solsToMature} {t}s to grow · up to {c.maxFoodKgPerSol} kg/{t}{c.moraleBonus > 1 ? ' · big morale boost' : c.moraleBonus === 1 ? ' · morale boost' : ''}</small>
                </div>
              </div>
              <p className="small">{c.fact}</p>
              <p className="muted small">Real growing time: {c.realDays} (sped up for the game). <a href={c.url} target="_blank" rel="noreferrer">{c.source} ↗</a></p>
              {currentId === id ? (
                <span className="chip">✓ Growing now</span>
              ) : (
                <button
                  className="btn btn-secondary small-btn"
                  onClick={() => {
                    sound.success();
                    onSetCrop(id);
                  }}
                >
                  Replant with {c.name.toLowerCase()}{state.maturity > 0.05 ? ' (restarts growth!)' : ''}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
