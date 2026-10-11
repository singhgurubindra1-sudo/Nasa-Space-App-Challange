import { useState } from 'react';
import { WORLDS } from '../engine/engine.js';
import { MODULES, FINAL, ALL_MODULES, RANKS, rankFor, nextRank, isUnlocked, nextModule } from '../engine/training.js';
import { parseClassCode } from '../engine/classroom.js';

// Home page: the Junior Astronaut training academy.
export default function Academy({ progress, setProgress, saved, onContinue, onStartModule, onJoinClass, onExplorer, onFreePlay, onLearn, onCertificate, onTeacher }) {
  const passed = progress.passed || {};
  const quiz = progress.quiz || {};
  const rank = rankFor(progress);
  const next = nextRank(progress);
  const upNext = nextModule(progress);
  const done = ALL_MODULES.filter((m) => passed[m.id]).length;
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const name = progress.name || '';
  const setName = (n) => setProgress({ ...progress, name: n.slice(0, 30) });

  const join = (e) => {
    e.preventDefault();
    const parsed = parseClassCode(code);
    if (!name.trim()) return setError('Type your name first, so your teacher knows whose result it is.');
    if (!parsed) return setError('That code does not look right. It looks like MARS-1A2B3CK. Check each letter.');
    setError('');
    onJoinClass(parsed);
  };

  const missing = next ? next.needs.filter((id) => !passed[id]).map((id) => (id === 'final' ? 'the final exam' : `module ${ALL_MODULES.find((m) => m.id === id).num}`)) : [];
  const todo = missing.length > 1 ? `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}` : missing[0];

  return (
    <div className="screen">
      <section className="hero academy-hero">
        <p className="kicker">NASA Space Apps 2026 · Junior Astronaut Mission Trainer</p>
        <h1>Astronaut Training Academy</h1>
        <p className="lead">Learn to keep a crew alive on the Moon and Mars, one skill at a time, using real NASA numbers.</p>
      </section>

      <div className={`card rank-card rank-${rank.id}`}>
        <div className="rank-top">
          <span className="rank-icon" aria-hidden="true">{rank.icon}</span>
          <div>
            <span className="muted small">Your rank</span>
            <h2 className="rank-name">{rank.name}</h2>
            <p className="muted small">{rank.text}</p>
          </div>
        </div>
        <div className="progress" aria-label={`${done} of ${ALL_MODULES.length} modules passed`}><div style={{ width: `${(done / ALL_MODULES.length) * 100}%` }} /></div>
        <ol className="rank-ladder">
          {RANKS.map((r) => (
            <li key={r.id} className={r === rank ? 'current' : RANKS.indexOf(r) < RANKS.indexOf(rank) ? 'done' : ''}>
              <span aria-hidden="true">{r.icon}</span> {r.name}
            </li>
          ))}
        </ol>
        <p className="small">
          {next ? <>Pass {todo} to become <b>{next.name}</b>.</> : <b>Training complete. Well done, Commander!</b>}
        </p>
        <button className="btn btn-ghost small-btn" onClick={onCertificate}>📜 {done ? 'View your certificate' : 'See the certificate you can earn'}</button>
      </div>

      {saved && (
        <button className="btn btn-secondary wide" onClick={onContinue}>
          ▶ Continue: {WORLDS[saved.worldId].name}, {WORLDS[saved.worldId].turnLabel} {saved.sol}
        </button>
      )}
      {upNext && upNext !== FINAL && isUnlocked(progress, upNext) && (
        <button className="btn btn-primary wide launch" onClick={() => onStartModule(upNext)}>
          🚀 Start module {upNext.num}: {upNext.title}
        </button>
      )}

      <h3 className="section-title">Training modules</h3>
      <div className="modules">
        {MODULES.map((m) => (
          <ModuleCard key={m.id} mod={m} progress={progress} quiz={quiz[m.id]} onStart={() => onStartModule(m)} />
        ))}
        <ModuleCard mod={FINAL} progress={progress} quiz={quiz.final} onStart={(w) => onStartModule(FINAL, w)} />
      </div>

      <div className="card classroom-card">
        <h3>🏫 Class mission</h3>
        <p className="muted small">Your teacher gives the whole class one code. Everyone plays the same mission with the same events, then compares results.</p>
        <form onSubmit={join} className="join-form">
          <label>
            <span className="small">Your name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya" autoComplete="given-name" />
          </label>
          <label>
            <span className="small">Class code</span>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="MARS-1A2B3CK" autoCapitalize="characters" spellCheck="false" />
          </label>
          <button className="btn btn-primary" type="submit">Join</button>
        </form>
        {error && <p className="bad small" role="alert">{error}</p>}
        <button className="btn btn-ghost small-btn" onClick={onTeacher}>🍎 Teacher tools: make a class code, see class results</button>
      </div>

      <h3 className="section-title">Explore more</h3>
      <div className="explore-grid">
        <button className="btn btn-ghost" onClick={onExplorer}>🌌 Live Space Explorer</button>
        <button className="btn btn-ghost" onClick={onFreePlay}>🪐 Free play: 30 sols</button>
        <button className="btn btn-ghost" onClick={onLearn}>📘 Learn & NASA data</button>
      </div>

      <label className="unlock-all small muted">
        <input type="checkbox" checked={!!progress.unlockAll} onChange={(e) => setProgress({ ...progress, unlockAll: e.target.checked })} />
        Teacher or judge preview: unlock every module
      </label>
    </div>
  );
}

function ModuleCard({ mod, progress, quiz, onStart }) {
  const passed = (progress.passed || {})[mod.id];
  const open = isUnlocked(progress, mod);
  const final = mod.id === 'final';
  const status = passed ? `✅ Passed ${passed.date}` : open ? '▶ Ready' : '🔒 Pass the module before';
  return (
    <div className={`card module ${passed ? 'module-done' : ''} ${open ? '' : 'module-locked'}`}>
      <div className="module-head">
        <span className="module-icon" aria-hidden="true">{mod.icon}</span>
        <div className="grow">
          <span className="muted small">{final ? 'Final exam' : `Module ${mod.num}`} · {mod.worldId ? `${WORLDS[mod.worldId].emoji} ${WORLDS[mod.worldId].name}` : '🌕 or 🔴'}</span>
          <h4>{final ? mod.title.replace('Final exam: ', '') : mod.title}</h4>
        </div>
      </div>
      <p className="small">{mod.brief}</p>
      <p className="muted small">Skill: {mod.skill}</p>
      <div className="chips">
        <span className={`chip ${passed ? 'chip-ok' : ''}`}>{status}</span>
        {quiz !== undefined && <span className="chip">🧠 Quiz {quiz}/{mod.quiz.length}</span>}
      </div>
      {open && (final ? (
        <div className="row">
          <button className="btn btn-secondary grow" onClick={() => onStart('moon')}>🌕 Moon exam</button>
          <button className="btn btn-secondary grow" onClick={() => onStart('mars')}>🔴 Mars exam</button>
        </div>
      ) : (
        <button className="btn btn-secondary small-btn" onClick={() => onStart()}>{passed ? '↻ Practise again' : '🚀 Start'}</button>
      ))}
    </div>
  );
}
