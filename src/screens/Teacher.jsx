import { useMemo, useState } from 'react';
import { WORLDS, EVENTS, LOSS_TEXT, generateSchedule } from '../engine/engine.js';
import { makeClassCode, parseClassCode, parseResultCode, summarize, rankResults, newClassSeed } from '../engine/classroom.js';

// Classroom mode, no server needed: the teacher makes a code, students hand back result codes.
export default function Teacher({ onBack }) {
  const [world, setWorld] = useState('mars');
  const [code, setCode] = useState(null);
  const [pasted, setPasted] = useState('');
  const [filter, setFilter] = useState('');

  const parsed = useMemo(() => {
    const tokens = pasted.split(/\s+/).filter(Boolean);
    const results = tokens.map(parseResultCode);
    return { results: results.filter(Boolean), bad: results.filter((r) => !r).length };
  }, [pasted]);
  const classes = [...new Set(parsed.results.map((r) => r.classCode))];
  const active = filter && classes.includes(filter) ? filter : classes[0] || '';
  const rows = rankResults(parsed.results.filter((r) => r.classCode === active));
  const sum = summarize(rows);
  const cls = parseClassCode(active);
  const turnLabel = cls ? WORLDS[cls.worldId].turnLabel.toLowerCase() : 'sol';
  const eventOn = (sol) => {
    if (!cls || !sol) return null;
    const e = generateSchedule(cls.worldId, cls.seed)[sol];
    return e && e.eventId ? `${EVENTS[e.eventId].emoji} ${EVENTS[e.eventId].title.replace('!', '')}` : null;
  };

  return (
    <div className="screen">
      <div className="row">
        <button className="btn btn-ghost" onClick={onBack}>← Academy</button>
      </div>
      <h2 className="screen-title">🍎 Teacher tools</h2>

      <div className="card">
        <h3>1 · Make a class code</h3>
        <p className="muted small">Everyone who types this code plays the same 30-sol mission with the same events on the same days, so results are fair to compare.</p>
        <div className="worlds">
          {Object.values(WORLDS).map((x) => (
            <button key={x.id} className={`world world-${x.id} ${world === x.id ? 'selected' : ''}`} onClick={() => { setWorld(x.id); setCode(null); }} aria-pressed={world === x.id}>
              <span className="world-emoji" aria-hidden="true">{x.emoji}</span>
              <span className="world-name">{x.name}</span>
            </button>
          ))}
        </div>
        <button className="btn btn-primary wide" onClick={() => setCode(makeClassCode(world, newClassSeed()))}>{code ? '↻ Make a different code' : 'Make class code'}</button>
        {code && (
          <div className="class-code">
            <span className="muted small">Write this on the board</span>
            <b>{code}</b>
            <span className="small">Students: Training Academy → Class mission → type your name and this code → Join.</span>
          </div>
        )}
      </div>

      <div className="card">
        <h3>2 · Collect results</h3>
        <p className="muted small">When a student finishes, the debrief shows a result code starting with <code>S30-</code>. Ask students to paste it into a shared doc or chat, then paste them all here (one per line, or separated by spaces).</p>
        <textarea className="paste" rows="5" value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="S30-eyJuIjoi…" spellCheck="false" />
        {parsed.bad > 0 && <p className="small bad">{parsed.bad} line{parsed.bad > 1 ? 's' : ''} could not be read (check they were copied in full).</p>}
        {classes.length > 1 && (
          <label className="small">Class code:{' '}
            <select value={active} onChange={(e) => setFilter(e.target.value)}>
              {classes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        )}
      </div>

      {sum && (
        <>
          <div className="card">
            <h3>3 · Class board {active && <span className="muted small">· {active}</span>}</h3>
            <div className="weather-grid">
              <div><b>{sum.n}</b><br /><span className="muted small">students</span></div>
              <div><b>{sum.survivalRate}%</b><br /><span className="muted small">crews survived</span></div>
              <div><b>{sum.avgSols}</b><br /><span className="muted small">average {turnLabel}s</span></div>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>#</th><th>Name</th><th>Result</th><th>★</th><th>❤</th><th>☢ mSv</th><th>🔬</th><th>Turning point</th></tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={`${r.name}-${i}`}>
                      <td>{i + 1}</td>
                      <td>{r.name}</td>
                      <td>{r.won ? '✅ Survived' : `🚨 ${turnLabel} ${r.sols}`}</td>
                      <td>{r.stars}</td>
                      <td>{r.health}</td>
                      <td>{r.dose}</td>
                      <td>{r.science}</td>
                      <td>{r.turningSol ? `${turnLabel} ${r.turningSol}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <h3>4 · Talk about it</h3>
            <ul>
              {sum.topLoss && <li>{sum.topLoss[1]} crew{sum.topLoss[1] > 1 ? 's' : ''} failed because: <b>{LOSS_TEXT[sum.topLoss[0]]}</b> Ask a student who survived what they did differently.</li>}
              {sum.topTurning && <li>{sum.topTurning[1]} student{sum.topTurning[1] > 1 ? 's' : ''} had their turning point on <b>{turnLabel} {sum.topTurning[0]}</b>{eventOn(Number(sum.topTurning[0])) ? <> — the day of the <b>{eventOn(Number(sum.topTurning[0]))}</b></> : ''}. What warning did Nova give the day before?</li>}
              <li>Compare the top two students: same events, different choices. Which choice made the difference?</li>
              <li>Exit ticket: “The one thing I would do differently is…”</li>
            </ul>
          </div>
        </>
      )}
      <p className="muted small">Nothing is uploaded: codes are worked out in this browser. Result codes are not secret and could be edited, so treat the board as a discussion tool, not a test.</p>
    </div>
  );
}
