import { useState } from 'react';

// A short knowledge check: pick an answer, see why, move on. Reports the score once at the end.
export default function Quiz({ questions, onDone }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const q = questions[i];

  const pick = (k) => {
    if (picked !== null) return;
    setPicked(k);
    if (k === q.answer) setScore(score + 1);
  };
  const next = () => {
    if (i + 1 < questions.length) {
      setI(i + 1);
      setPicked(null);
    } else {
      setFinished(true);
      onDone(score);
    }
  };

  if (finished) {
    return (
      <div className="quiz">
        <p><b>🧠 Training check: {score} / {questions.length}</b> {score === questions.length ? 'Perfect!' : 'Read the explanations and try the module again to improve.'}</p>
      </div>
    );
  }
  return (
    <div className="quiz">
      <p className="muted small">🧠 Training check · question {i + 1} of {questions.length}</p>
      <p><b>{q.q}</b></p>
      <div className="quiz-options">
        {q.options.map((o, k) => (
          <button
            key={o}
            className={`quiz-option ${picked === null ? '' : k === q.answer ? 'right' : k === picked ? 'wrong' : ''}`}
            onClick={() => pick(k)}
            disabled={picked !== null}
          >
            {picked !== null && k === q.answer ? '✅ ' : picked === k ? '❌ ' : ''}{o}
          </button>
        ))}
      </div>
      {picked !== null && (
        <>
          <p className="small">{picked === q.answer ? 'Correct! ' : 'Not quite. '}{q.why}</p>
          <button className="btn btn-primary small-btn" onClick={next}>{i + 1 < questions.length ? 'Next question →' : 'Finish'}</button>
        </>
      )}
    </div>
  );
}
