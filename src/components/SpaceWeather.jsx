import { useEffect, useState } from 'react';

// Live "today's space weather" from NASA DONKI (public API, demo key).
// Optional: if the network is down the game still works, and this box says so.
const API = 'https://api.nasa.gov/DONKI';
const KEY = import.meta.env.VITE_NASA_API_KEY || 'DEMO_KEY';

const iso = (d) => d.toISOString().slice(0, 10);

export default function SpaceWeather() {
  const [data, setData] = useState({ status: 'loading' });
  useEffect(() => {
    const end = new Date();
    const start = new Date(Date.now() - 30 * 864e5);
    const q = `startDate=${iso(start)}&endDate=${iso(end)}&api_key=${KEY}`;
    const ctrl = new AbortController();
    Promise.all([
      fetch(`${API}/FLR?${q}`, { signal: ctrl.signal }).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
      fetch(`${API}/SEP?${q}`, { signal: ctrl.signal }).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
    ])
      .then(([flr, sep]) => {
        flr = Array.isArray(flr) ? flr : [];
        sep = Array.isArray(sep) ? sep : [];
        const big = flr.filter((f) => /^X/.test(f.classType || ''));
        const latest = flr.slice().sort((a, b) => (a.peakTime < b.peakTime ? 1 : -1))[0];
        setData({ status: 'ok', flares: flr.length, xFlares: big.length, seps: sep.length, latest });
      })
      .catch((e) => {
        if (e && e.name === 'AbortError') return;
        setData({ status: 'error' });
      });
    return () => ctrl.abort();
  }, []);

  return (
    <div className="card weather">
      <h3>☀ Live: the real Sun, last 30 days</h3>
      {data.status === 'loading' && <p className="muted">Asking NASA's DONKI space-weather database…</p>}
      {data.status === 'error' && (
        <p className="muted">Couldn't reach NASA DONKI right now (offline, or the demo key is busy). Try the link below.</p>
      )}
      {data.status === 'ok' && (
        <>
          <div className="weather-grid">
            <div><b>{data.flares}</b><span>solar flares</span></div>
            <div><b>{data.xFlares}</b><span>X-class (biggest)</span></div>
            <div><b>{data.seps}</b><span>particle storms</span></div>
          </div>
          {data.latest && (
            <p className="muted">
              Latest flare: class <b>{data.latest.classType}</b> peaking {new Date(data.latest.peakTime).toUTCString().slice(0, 22)} UTC.
            </p>
          )}
          <p className="muted">
            {data.seps > 0
              ? 'A real particle storm happened this month. Astronauts on the Moon would have gone to their storm shelter.'
              : 'No particle storms this month: a quiet time to walk on the Moon.'}
          </p>
        </>
      )}
      <a href="https://kauai.ccmc.gsfc.nasa.gov/DONKI/" target="_blank" rel="noreferrer">Open NASA DONKI ↗</a>
    </div>
  );
}
