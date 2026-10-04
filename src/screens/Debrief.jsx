import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler,
} from 'chart.js';
import Stars from '../components/Stars.jsx';
import { stars, starCriteria, LOSS_TEXT, WORLDS, G, EVENTS } from '../engine/engine.js';
import { findTurningPoint } from '../engine/turningPoint.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler);

// Validated categorical palette (dark surface) — see README "Chart colors".
const SERIES = [
  { key: 'health', label: 'Crew health', color: '#199e70', value: (h) => h.health, unit: '%' },
  { key: 'o2', label: 'Oxygen tank', color: '#3987e5', value: (h) => (h.o2 / G.o2TankKg) * 100, unit: '%' },
  { key: 'battery', label: 'Battery', color: '#c98500', value: (h) => (h.battery / G.batteryCapacityKwh) * 100, unit: '%' },
  { key: 'dose', label: 'Radiation (of limit)', color: '#d95926', value: (h) => (h.dose / G.doseLimitMsv) * 100, unit: '%', dash: [6, 4] },
];

const ACTION_ICON = { build: '🏗', repair: '🔧', plant: '🌱', explore: '🧑‍🚀', shelter: '🛖' };

// Draws event emojis along the top and highlights the turning point.
const markers = {
  id: 'markers',
  afterDatasetsDraw(chart, _args, opts) {
    const { ctx, chartArea, scales } = chart;
    ctx.save();
    ctx.font = '14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    (opts.events || []).forEach((e) => {
      const x = scales.x.getPixelForValue(e.index);
      ctx.strokeStyle = 'rgba(148,163,184,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();
      ctx.fillText(e.emoji, x, chartArea.top - 6);
    });
    if (opts.turning !== undefined && opts.turning !== null) {
      const x = scales.x.getPixelForValue(opts.turning);
      ctx.strokeStyle = '#f8fafc';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();
    }
    ctx.restore();
  },
};

export default function Debrief({ state, onAgain, onOther, onLearn }) {
  const w = WORLDS[state.worldId];
  const n = stars(state);
  const won = state.status === 'won';
  const crit = starCriteria(state);
  const [tp, setTp] = useState(null);
  const [table, setTable] = useState(false);
  const canvas = useRef(null);

  // The turning-point finder replays the mission ~4,000 times; let the page paint first.
  useEffect(() => {
    const id = setTimeout(() => setTp(findTurningPoint(state)), 30);
    return () => clearTimeout(id);
  }, [state]);

  const labels = useMemo(() => state.history.map((h) => `${w.turnLabel} ${h.sol}`), [state, w]);

  useEffect(() => {
    if (!canvas.current) return;
    const chart = new Chart(canvas.current, {
      type: 'line',
      data: {
        labels,
        datasets: SERIES.map((s) => ({
          label: s.label,
          data: state.history.map((h) => Math.round(s.value(h))),
          borderColor: s.color,
          backgroundColor: s.color,
          borderWidth: 2,
          borderDash: s.dash,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBorderColor: '#131c2e',
          pointHoverBorderWidth: 2,
          tension: 0.25,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 22 } },
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: {
            min: 0, max: 100,
            ticks: { color: '#94a3b8', callback: (v) => `${v}%`, stepSize: 25 },
            grid: { color: 'rgba(148,163,184,0.12)' },
            border: { display: false },
          },
          x: { ticks: { color: '#94a3b8', maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { display: false } },
        },
        plugins: {
          legend: { position: 'bottom', labels: { color: '#e2e8f0', boxWidth: 14, boxHeight: 3, padding: 14 } },
          tooltip: {
            backgroundColor: '#0b1220',
            borderColor: 'rgba(148,163,184,0.3)',
            borderWidth: 1,
            titleColor: '#f8fafc',
            bodyColor: '#e2e8f0',
            callbacks: {
              title: (items) => {
                const h = state.history[items[0].dataIndex];
                const ev = h.eventId ? ` · ${EVENTS[h.eventId].emoji} ${EVENTS[h.eventId].title}` : '';
                return `${w.turnLabel} ${h.sol}${ev}`;
              },
              label: (item) => ` ${item.dataset.label}: ${item.formattedValue}%`,
              footer: (items) => {
                const h = state.history[items[0].dataIndex];
                return `Action: ${ACTION_ICON[h.action]} ${h.action}`;
              },
            },
          },
          markers: {
            events: state.history.filter((h) => h.eventId).map((h) => ({ index: h.sol - 1, emoji: EVENTS[h.eventId].emoji })),
            turning: tp ? tp.sol - 1 : null,
          },
        },
      },
      plugins: [markers],
    });
    return () => chart.destroy();
  }, [state, labels, tp, w]);

  return (
    <div className="screen">
      <h2 className="screen-title">Mission debrief</h2>
      <div className={`card verdict ${won ? 'verdict-won' : 'verdict-lost'}`}>
        <div className="verdict-emoji" aria-hidden="true">{won ? (n === 3 ? '🏅' : '🎉') : '🚨'}</div>
        <h3>{won ? `The crew made it! ${G.sols} ${w.turnLabel.toLowerCase()}s on ${w.name === 'Moon' ? 'the Moon' : 'Mars'}.` : `Mission abort on ${w.turnLabel.toLowerCase()} ${state.history.length}`}</h3>
        {!won && <p>{LOSS_TEXT[state.lossReason]}</p>}
        <Stars n={n} />
        {n === 3 && <p className="badge">🏅 Mission Ready badge earned!</p>}
        <ul className="criteria">
          {crit.map((c) => (
            <li key={c.id} className={c.ok ? 'ok' : 'no'}>{c.ok ? '✅' : '⬜'} {c.label}</li>
          ))}
        </ul>
        <p className="muted small">Survive = ★ · meet 2 goals = ★★ · meet 3+ goals = ★★★</p>
      </div>

      <div className="card turning">
        {tp ? (
          <>
            <h3>🎯 {tp.headline}</h3>
            <p>{tp.text}</p>
            <p className="muted">{tp.lesson}</p>
          </>
        ) : (
          <p className="muted">Nova is replaying your mission thousands of times to find the choice that mattered most…</p>
        )}
      </div>

      <div className="card">
        <h3>Your mission, {w.turnLabel.toLowerCase()} by {w.turnLabel.toLowerCase()}</h3>
        <p className="muted small">All lines are % of safe range. Radiation counts up toward the limit; the others should stay high. Emojis mark events; the dotted white line is the turning point.</p>
        <div className="chart-wrap"><canvas ref={canvas} role="img" aria-label="Line chart of crew health, oxygen, battery and radiation dose over the mission" /></div>
        <button className="btn btn-ghost small-btn" onClick={() => setTable(!table)} aria-expanded={table}>
          {table ? 'Hide' : 'Show'} table of every choice
        </button>
        {table && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>{w.turnLabel}</th><th>🫁</th><th>🌱</th><th>🛡</th><th>🔬</th><th>Action</th><th>Event</th><th>❤</th><th>🔋</th><th>☢ mSv</th></tr>
              </thead>
              <tbody>
                {state.history.map((h) => (
                  <tr key={h.sol} className={tp && tp.sol === h.sol ? 'hl' : ''}>
                    <td>{h.sol}</td>
                    <td>{h.alloc.lifeSupport}</td>
                    <td>{h.alloc.greenhouse}</td>
                    <td>{h.alloc.shielding}</td>
                    <td>{h.alloc.science}</td>
                    <td>{ACTION_ICON[h.action]}</td>
                    <td>{h.eventId ? EVENTS[h.eventId].emoji : ''}</td>
                    <td>{Math.round(h.health)}</td>
                    <td>{Math.round(h.battery)}</td>
                    <td>{h.dose.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h3>What real mission planners would say</h3>
        <ul>
          <li>⚡ Power is the master resource: every other system depends on it.</li>
          <li>🛡 Shielding, food and spare parts cost something now but save the mission later.</li>
          <li>{w.id === 'moon' ? '🌑 On the Moon, no air means more radiation, and shadows mean you must store energy.' : '🌪 On Mars, dust storms can steal your sunlight for days. Margins and backups win.'}</li>
          <li>📡 Real missions plan for bad events with margins and backups, and they read the forecast.</li>
        </ul>
      </div>

      <div className="row">
        <button className="btn btn-primary grow" onClick={onAgain}>↻ Play {w.name} again</button>
        <button className="btn btn-secondary grow" onClick={onOther}>Try {w.id === 'moon' ? 'Mars 🔴' : 'the Moon 🌕'}</button>
      </div>
      <button className="btn btn-ghost wide" onClick={onLearn}>📘 Learn more · Teacher page</button>
    </div>
  );
}
