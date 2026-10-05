import { JUNIORS, tasksFor, isSpecialist, canAssign, daily, taskById } from '../engine/crew.js';
import { sound } from '../audio/sound.js';

// The Senior Astronaut's crew command board: give each Junior Astronaut an order,
// follow their progress live, and watch them work.
export default function CrewPanel({ state, crew, watching, fast, onFast, onAssign, onCancel, onWatch, onClose }) {
  const d = daily(state);
  const tasks = tasksFor(state.worldId);
  const byId = Object.fromEntries((crew || []).map((c) => [c.id, c]));

  return (
    <div className="crew-panel" role="dialog" aria-label="Crew command">
      <div className="gh-card crew-card">
        <div className="gh-head">
          <h3>👥 Crew command</h3>
          <button className="icon-btn" onClick={() => { sound.blip(700, 0.05, 0.05); onClose(); }} aria-label="Close">✕</button>
        </div>
        <p className="muted small">
          You are the Senior Astronaut. Give each junior one task per sol. ★ marks their specialty: specialists work faster and get 50% more done.
          Finished tasks change your mission (growth, shielding, science, morale).
        </p>
        <button className={`btn btn-ghost small-btn ${fast ? 'on' : ''}`} onClick={() => onFast(!fast)} aria-pressed={fast}>
          ⏩ {fast ? 'Fast-forward ON (crew works 4× faster)' : 'Fast-forward crew work'}
        </button>
        <div className="crew-list">
          {JUNIORS.map((j) => {
            const st = byId[j.id];
            const doneToday = d.crew[j.id];
            const busy = st && st.busy;
            return (
              <div key={j.id} className="crew-member" style={{ borderColor: j.color }}>
                <div className="crew-top">
                  <span className="crew-badge" style={{ background: j.color }}>{j.emoji}</span>
                  <div className="crew-id">
                    <b>{j.name}</b> <span className="muted small">Junior · {j.role}</span>
                    <div className="crew-status small">
                      {busy ? st.text : doneToday ? `✅ Done for this sol: ${taskById(doneToday).label}` : st ? `${st.text} · ${st.where}` : 'Standing by'}
                    </div>
                    {busy && <div className="gauge-bar"><div className="gauge-fill" style={{ width: `${Math.round(st.progress * 100)}%`, background: j.color }} /></div>}
                  </div>
                  <div className="crew-actions">
                    <button className={`icon-btn ${watching === j.id ? 'on' : ''}`} onClick={() => onWatch(watching === j.id ? null : j.id)} title={`Watch ${j.name}`}>
                      👁 <span className="hide-sm">{watching === j.id ? 'Stop' : 'Watch'}</span>
                    </button>
                    {busy && <button className="icon-btn" onClick={() => onCancel(j.id)} title="Call back">📻 <span className="hide-sm">Recall</span></button>}
                  </div>
                </div>
                {!busy && !doneToday && canAssign(state, j.id) && (
                  <div className="crew-tasks">
                    {tasks.map((t) => (
                      <button
                        key={t.id}
                        className={`crew-task ${isSpecialist(j.id, t.id) ? 'spec' : ''}`}
                        onClick={() => {
                          sound.blip(1100, 0.05, 0.05);
                          onAssign(j.id, t.id);
                        }}
                      >
                        <span aria-hidden="true">{t.emoji}</span> {t.label}{isSpecialist(j.id, t.id) ? ' ★' : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
