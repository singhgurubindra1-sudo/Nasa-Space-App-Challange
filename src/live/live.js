// Live space data, fetched straight from the browser and cached so we stay polite to the servers.
//   CelesTrak  — current orbital elements (OMM/TLE) for Earth satellites, propagated with SGP4
//   NASA NeoWs — asteroids passing Earth this week, and orbits of famous asteroids
// Every result says where it came from and when, so the dashboard can label it "live" or not.
import { json2satrec } from '../lib/satellite.js';

const PREFIX = 'survive30sols.live.';
const NASA_KEY = (import.meta.env && import.meta.env.VITE_NASA_API_KEY) || 'DEMO_KEY';

function cacheGet(key, maxAgeMs) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return Date.now() - v.t < maxAgeMs ? v : null;
  } catch {
    return null;
  }
}
function cacheAny(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function cacheSet(key, data) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ t: Date.now(), data }));
  } catch {
    /* storage full or private mode: still works, just refetches */
  }
}

async function fetchJson(url, timeoutMs = 12000) {
  const ctl = new AbortController();
  const id = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(id);
  }
}

// Fresh cache → live fetch → stale cache → nothing. Returns { data, fetchedAt, state }.
async function cached(key, maxAgeMs, load) {
  const fresh = cacheGet(key, maxAgeMs);
  if (fresh) return { data: fresh.data, fetchedAt: fresh.t, state: 'live' };
  try {
    const data = await load();
    cacheSet(key, data);
    return { data, fetchedAt: Date.now(), state: 'live' };
  } catch (e) {
    const old = cacheAny(key);
    if (old) return { data: old.data, fetchedAt: old.t, state: 'stale', error: String(e.message || e) };
    return { data: null, fetchedAt: null, state: 'offline', error: String(e.message || e) };
  }
}

// ---------- Earth satellites (CelesTrak) ----------
const CELESTRAK = 'https://celestrak.org/NORAD/elements/gp.php';

// One satellite by NORAD number. We check the name too, so a wrong number can never show the wrong object.
export async function satelliteElements(sat) {
  const res = await cached(`gp.${sat.norad}`, 4 * 3600e3, async () => {
    const arr = await fetchJson(`${CELESTRAK}?CATNR=${sat.norad}&FORMAT=json`);
    if (!Array.isArray(arr) || !arr.length) throw new Error('no elements');
    return arr[0];
  });
  if (!res.data) return res;
  if (sat.match && !new RegExp(sat.match, 'i').test(res.data.OBJECT_NAME || '')) {
    return { data: null, state: 'offline', error: `catalog returned ${res.data.OBJECT_NAME}` };
  }
  try {
    return { ...res, satrec: json2satrec(res.data) };
  } catch (e) {
    return { data: null, state: 'offline', error: String(e.message || e) };
  }
}

// CelesTrak's "100 (or so) brightest" group — the satellites you can see with your own eyes
export async function brightestSatellites() {
  const res = await cached('gp.visual', 6 * 3600e3, () => fetchJson(`${CELESTRAK}?GROUP=visual&FORMAT=json`, 20000));
  if (!Array.isArray(res.data)) return { ...res, list: [] };
  const list = [];
  for (const omm of res.data) {
    try {
      list.push({ omm, satrec: json2satrec(omm) });
    } catch {
      /* skip bad element sets */
    }
  }
  return { ...res, list };
}

// ---------- Asteroids (NASA NeoWs) ----------
const NEOWS = 'https://api.nasa.gov/neo/rest/v1';
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

// Close approaches from 2 days ago to 4 days ahead (the feed allows 7 days at most)
export async function closeApproaches(now = Date.now()) {
  const start = isoDay(now - 2 * 864e5);
  const end = isoDay(now + 4 * 864e5);
  const res = await cached(`neo.feed.${start}`, 3 * 3600e3, async () => {
    const j = await fetchJson(`${NEOWS}/feed?start_date=${start}&end_date=${end}&api_key=${NASA_KEY}`, 20000);
    // keep only what we show, so the cache stays small
    const out = [];
    for (const day of Object.values(j.near_earth_objects || {})) {
      for (const o of day) {
        const ca = (o.close_approach_data || []).find((c) => c.orbiting_body === 'Earth') || o.close_approach_data?.[0];
        if (!ca) continue;
        out.push({
          id: o.id,
          name: o.name.replace(/[()]/g, '').trim(),
          url: o.nasa_jpl_url,
          h: o.absolute_magnitude_h,
          dMin: o.estimated_diameter?.meters?.estimated_diameter_min,
          dMax: o.estimated_diameter?.meters?.estimated_diameter_max,
          hazardous: !!o.is_potentially_hazardous_asteroid,
          sentry: !!o.is_sentry_object,
          t: ca.epoch_date_close_approach,
          missKm: +ca.miss_distance.kilometers,
          missLd: +ca.miss_distance.lunar,
          speedKms: +ca.relative_velocity.kilometers_per_second,
        });
      }
    }
    return out.sort((a, b) => a.t - b.t);
  });
  return { ...res, list: res.data || [] };
}

// Orbit of one asteroid (NeoWs lookup), cached for a day
export async function asteroidOrbit(neoId) {
  return cached(`neo.orbit.${neoId}`, 24 * 3600e3, async () => {
    const j = await fetchJson(`${NEOWS}/neo/${neoId}?api_key=${NASA_KEY}`);
    const od = j.orbital_data;
    const next = (j.close_approach_data || [])
      .filter((c) => c.orbiting_body === 'Earth' && c.epoch_date_close_approach > Date.now())
      .sort((a, b) => a.epoch_date_close_approach - b.epoch_date_close_approach)[0];
    return {
      od: {
        semi_major_axis: od.semi_major_axis,
        eccentricity: od.eccentricity,
        inclination: od.inclination,
        ascending_node_longitude: od.ascending_node_longitude,
        perihelion_argument: od.perihelion_argument,
        mean_anomaly: od.mean_anomaly,
        epoch_osculation: od.epoch_osculation,
        mean_motion: od.mean_motion,
        orbital_period: od.orbital_period,
        orbit_class: od.orbit_class?.orbit_class_description,
      },
      hazardous: !!j.is_potentially_hazardous_asteroid,
      next: next ? { date: next.close_approach_date_full || next.close_approach_date, missKm: +next.miss_distance.kilometers } : null,
    };
  });
}

export const NASA_KEY_IS_DEMO = NASA_KEY === 'DEMO_KEY';
