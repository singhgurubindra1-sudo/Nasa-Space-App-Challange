import { useState } from 'react';
import StatusGauges from '../components/StatusGauges.jsx';
import WhyCard from '../components/WhyCard.jsx';
import { EVENTS, CALM, WORLDS, G } from '../engine/engine.js';

export default function EventReport({ state, report, onNext }) {
  const [showReport, setShowReport] = useState(false);
  const w = WORLDS[state.worldId];
  const ev = report.event;
  const card = ev ? EVENTS[ev.id] : null;
  const over = state.status !== 'playing';

  return (
    <div className="screen">
      <div className="sol-banner">
        <span>{w.emoji} {w.name}</span>
        <b>{w.turnLabel} {report.sol} / {G.sols}</b>
      </div>

      {!showReport ? (
        <>
          <h2 className="screen-title">Event</h2>
          <div className={`event-card ${ev ? `event-${ev.id}` : 'event-calm'}`}>
            <div className="event-emoji" aria-hidden="true">{ev ? ev.emoji : CALM.emoji}</div>
            <h3>{ev ? ev.title : CALM.title}</h3>
            <p className="event-effect">{ev ? ev.effectText : CALM.effectText}</p>
            {report.eventNote && <p className="muted">{report.eventNote}</p>}
          </div>
          {card && <WhyCard why={card.why} />}
          <button className="btn btn-primary wide sticky" onClick={() => setShowReport(true)}>Night report →</button>
        </>
      ) : (
        <>
          <h2 className="screen-title">Night report</h2>
          <div className="card log">
            {report.messages.length ? report.messages.map((m) => <p key={m}>{m}</p>) : <p>A normal {w.turnLabel.toLowerCase()} of work.</p>}
            {report.foodGrown > 0 && <p>🌱 The greenhouse grew {report.foodGrown} kg of food.</p>}
            <p>☢ Radiation today: {report.dose} mSv.</p>
          </div>
          <StatusGauges s={state} before={report.before} />
          <button className="btn btn-primary wide sticky" onClick={onNext}>
            {over ? 'Mission debrief →' : `Next ${w.turnLabel.toLowerCase()} →`}
          </button>
        </>
      )}
    </div>
  );
}
