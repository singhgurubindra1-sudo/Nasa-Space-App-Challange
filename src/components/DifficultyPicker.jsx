import { LEVELS, LIVE, resolveDifficulty, activityLabel } from '../engine/difficulty.js';

const OPTIONS = [LEVELS.cadet, LEVELS.astronaut, LEVELS.commander, LIVE];

// liveStatus: 'idle' | 'loading' | 'ready' ; live: inputs from fetchLiveDifficultyInputs()
export default function DifficultyPicker({ level, setLevel, world, live, liveStatus }) {
  const d = resolveDifficulty(level, world, live);
  return (
    <div className="difficulty-picker">
      <h2 className="section-title">Difficulty</h2>
      <div className="diff-grid" role="radiogroup" aria-label="Difficulty">
        {OPTIONS.map((o) => (
          <button key={o.id} role="radio" aria-checked={level === o.id} className={`diff diff-${o.id} ${level === o.id ? 'selected' : ''}`} onClick={() => setLevel(o.id)}>
            <span className="diff-emoji" aria-hidden="true">{o.emoji}</span>
            <span className="diff-name">{o.name}</span>
            {o.id === 'live' && <span className="live-dot" aria-hidden="true" />}
          </button>
        ))}
      </div>
      <div className="card diff-card">
        <p>{d.blurb}</p>
        {level === 'live' && liveStatus === 'loading' && <p className="muted small">📡 Reading the last 30 days of NASA space-weather data…</p>}
        {level === 'live' && liveStatus === 'ready' && (
          <>
            {!d.offline && (
              <div className="weather-grid">
                <div><b>{d.live.xFlares}</b><span>X-class flares</span></div>
                <div><b>{d.live.mFlares}</b><span>M-class flares</span></div>
                <div><b>{d.live.seps}</b><span>particle storms</span></div>
                <div><b>{d.live.fastCmes}</b><span>fast CMEs</span></div>
              </div>
            )}
            <p className="small">Sun this month: <b className={`act-${activityLabel(d.offline ? null : d.activity)}`}>{d.offline ? 'unknown (offline)' : activityLabel(d.activity)}</b>{live && live.stale ? ' · using the last saved reading' : ''}</p>
            <ul className="small">{d.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          </>
        )}
        <dl className="diff-stats small">
          <div><dt>Events</dt><dd>{Math.round((d.eventRate / 0.3) * 100)}%</dd></div>
          <div><dt>Particle storms</dt><dd>{1 + d.extraFlares}+</dd></div>
          <div><dt>Storm strength</dt><dd>×{d.flareDoseMult}</dd></div>
          <div><dt>Starting supplies</dt><dd>{Math.round(d.startFactor * 100)}%</dd></div>
          <div><dt>Spare parts</dt><dd>{d.spares}</dd></div>
          {world === 'mars' && <div><dt>Dust storms</dt><dd>{d.dustSolarFactor != null ? `−${Math.round((1 - d.dustSolarFactor) * 100)}% sun` : '−60% sun'}{d.dustDurationBonus ? `, +${d.dustDurationBonus} sols` : ''}</dd></div>}
        </dl>
        {level === 'live' && (
          <p className="muted small">
            Sources: <a href="https://kauai.ccmc.gsfc.nasa.gov/DONKI/" target="_blank" rel="noreferrer">NASA DONKI (flares, SEP, CME)</a> · <a href="https://www.giss.nasa.gov/tools/mars24/help/algorithm.html" target="_blank" rel="noreferrer">NASA Mars24 (season, Ls)</a> · <a href="https://science.nasa.gov/mission/mer-opportunity/" target="_blank" rel="noreferrer">NASA: Opportunity and the 2018 dust storm</a>
          </p>
        )}
      </div>
    </div>
  );
}
