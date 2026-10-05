import { lazy, Suspense } from 'react';
import asteroids from '../data/asteroids.json' with { type: 'json' };

// three.js + the satellite propagator are big; load them separately.
const ExplorerStage = lazy(() => import('../components/ExplorerStage.jsx'));

const SOURCES = [
  { label: 'CelesTrak: current satellite orbital elements', url: 'https://celestrak.org/NORAD/elements/' },
  { label: 'satellite.js (SGP4 orbit propagator)', url: 'https://github.com/shashwatak/satellite-js' },
  ...asteroids.sources,
  { label: 'JPL: Approximate Positions of the Planets', url: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html' },
  { label: 'NASA GISS Mars24 sunclock algorithm', url: 'https://www.giss.nasa.gov/tools/mars24/help/algorithm.html' },
  { label: 'NASA Eyes on the Solar System (to compare)', url: 'https://eyes.nasa.gov/apps/solar-system/' },
];

export default function Dashboard({ onNext, onMission, saved, onContinue }) {
  return (
    <div className="screen">
      <section className="mission-control">
        <div className="mc-title ex-title">
          <p className="kicker">NASA Space Apps 2026 · Mission Control</p>
          <h1>Live Space Explorer</h1>
          <p className="lead">Fly from the whole galaxy down to the satellites over your head. Tap anything that moves to see what it is and where it is right now.</p>
        </div>
        <Suspense fallback={<div className="space-stage space-loading"><p>🌌 Loading the galaxy…</p></div>}>
          <ExplorerStage onMission={onMission} />
        </Suspense>
      </section>

      {saved && (
        <button className="btn btn-secondary wide" onClick={onContinue}>▶ Continue your saved mission</button>
      )}
      <button className="btn btn-primary wide launch" onClick={onNext}>🚀 Next: Mission Dashboard — run the 30-sol simulation on the Moon or Mars</button>

      <div className="card how">
        <h3>What is live here?</h3>
        <ul>
          <li><b>Earth satellites</b> — live. Orbital elements are downloaded from CelesTrak (updated several times a day from US Space Force tracking) and your browser works out each satellite's position every frame with the SGP4 model.</li>
          <li><b>Asteroids</b> — live. This week's close approaches and the orbits of famous asteroids come from NASA's NeoWs service.</li>
          <li><b>Planets, Sun and Moon</b> — computed for this exact moment from JPL orbital elements and almanac formulas (accurate to a fraction of a degree).</li>
          <li><b>Mars clock</b> — Jezero's local time and Perseverance's sol number from NASA's Mars24 algorithm.</li>
          <li><b>Moon and Mars orbiters</b> — nobody publishes their live positions, so we use their real published orbits (height, shape, tilt, lap time) and mark the position along the orbit as an estimate.</li>
        </ul>
        <p className="muted small">If you are offline, every item says so: badges show LIVE, LAST KNOWN, COMPUTED or ESTIMATE.</p>
        <p className="muted small">
          Sources:{' '}
          {SOURCES.map((s, i) => (
            <span key={s.url}>{i > 0 && ' · '}<a href={s.url} target="_blank" rel="noreferrer">{s.label}</a></span>
          ))}
        </p>
      </div>
    </div>
  );
}
