import { WORLDS } from '../engine/engine.js';
import { ALL_MODULES, rankFor, RANKS } from '../engine/training.js';

// Printable training certificate. Uses the browser's print dialog (Save as PDF works too).
export default function Certificate({ progress, setProgress, onBack }) {
  const passed = progress.passed || {};
  const quiz = progress.quiz || {};
  const rank = rankFor(progress);
  const name = progress.name || '';
  const quizRight = Object.values(quiz).reduce((a, b) => a + b, 0);
  const quizTotal = ALL_MODULES.filter((m) => quiz[m.id] !== undefined).reduce((t, m) => t + m.quiz.length, 0);
  const finalExam = passed.final;
  const today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="screen">
      <div className="row no-print">
        <button className="btn btn-ghost" onClick={onBack}>← Academy</button>
        <button className="btn btn-primary grow" onClick={() => window.print()} disabled={!name.trim()}>🖨 Print or save as PDF</button>
      </div>
      <label className="cert-name-input no-print">
        <span className="small">Name on the certificate</span>
        <input value={name} onChange={(e) => setProgress({ ...progress, name: e.target.value.slice(0, 30) })} placeholder="Type your name" />
      </label>

      <article className="certificate" aria-label="Training certificate">
        <p className="cert-kicker">Survive 30 Sols · Astronaut Training Academy</p>
        <h2>Certificate of Training</h2>
        <p>This certifies that</p>
        <p className="cert-name">{name.trim() || 'Your name'}</p>
        <p>has earned the rank of</p>
        <p className="cert-rank"><span aria-hidden="true">{rank.icon}</span> {rank.name}</p>
        <p className="cert-small">{rank.text}</p>

        <table className="cert-table">
          <tbody>
            {ALL_MODULES.map((m) => (
              <tr key={m.id}>
                <td>{passed[m.id] ? '✅' : '⬜'}</td>
                <td>{m.id === 'final' ? 'Final exam: 30-sol mission' : `Module ${m.num}: ${m.title}`}</td>
                <td>{passed[m.id] ? `${passed[m.id].date}${m.id === 'final' ? ` · ${WORLDS[passed[m.id].worldId].name} · ${'★'.repeat(passed[m.id].stars || 1)}` : ''}` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {quizTotal > 0 && <p className="cert-small">Training checks: {quizRight} of {quizTotal} answers correct.</p>}
        {finalExam && <p className="cert-small">Kept a crew of 4 alive for 30 {finalExam.worldId === 'moon' ? 'days on the Moon' : 'sols on Mars'}.</p>}

        <div className="cert-foot">
          <div><span className="cert-line" />Date: {today}</div>
          <div><span className="cert-line" />Teacher / mission trainer</div>
        </div>
        <p className="cert-fine">Built for NASA Space Apps 2026 with real NASA data. Not an official NASA product or qualification.</p>
      </article>

      <div className="card no-print">
        <h3>Ranks</h3>
        <ul>
          {RANKS.map((r) => <li key={r.id}>{r.icon} <b>{r.name}</b>: {r.text}</li>)}
        </ul>
      </div>
    </div>
  );
}
