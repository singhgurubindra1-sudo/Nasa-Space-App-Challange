// Fetches the real-world inputs for "Live NASA" difficulty, cached for 3 hours.
import { marsTime } from '../engine/space.js';

const API = 'https://api.nasa.gov/DONKI';
const KEY = import.meta.env.VITE_NASA_API_KEY || 'DEMO_KEY';
const CACHE = 'survive30sols.liveDifficulty.v1';
const TTL = 3 * 3600e3;
const iso = (d) => d.toISOString().slice(0, 10);

async function getJson(url, signal) {
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  return Array.isArray(j) ? j : [];
}

export async function fetchLiveDifficultyInputs() {
  const ls = marsTime(Date.now()).ls;
  try {
    const c = JSON.parse(localStorage.getItem(CACHE) || 'null');
    if (c && Date.now() - c.fetchedAt < TTL) return { ...c, ls, cached: true };
  } catch {
    /* ignore */
  }
  const q = `startDate=${iso(new Date(Date.now() - 30 * 864e5))}&endDate=${iso(new Date())}&api_key=${KEY}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const [flr, sep, cme] = await Promise.all([
      getJson(`${API}/FLR?${q}`, ctl.signal),
      getJson(`${API}/SEP?${q}`, ctl.signal),
      getJson(`${API}/CMEAnalysis?${q}&mostAccurateOnly=true&speed=1000&halfAngle=0&catalog=ALL`, ctl.signal).catch(() => []),
    ]);
    const out = {
      xFlares: flr.filter((f) => /^X/.test(f.classType || '')).length,
      mFlares: flr.filter((f) => /^M/.test(f.classType || '')).length,
      flares: flr.length,
      seps: sep.length,
      fastCmes: cme.filter((c) => Number(c.speed) >= 1000).length,
      fetchedAt: Date.now(),
    };
    try {
      localStorage.setItem(CACHE, JSON.stringify(out));
    } catch {
      /* ignore */
    }
    return { ...out, ls };
  } catch {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE) || 'null');
      if (c) return { ...c, ls, stale: true };
    } catch {
      /* ignore */
    }
    return { ls, offline: true };
  } finally {
    clearTimeout(timer);
  }
}
