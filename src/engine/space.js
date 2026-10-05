// Real-time astronomy for the Explorer dashboard (no three.js here, so it can be unit-tested).
// Planets: JPL Keplerian elements. Moon and Sun: low-precision almanac formulas.
// Mars clock: NASA GISS Mars24 algorithm (Allison & McEwen 2000).
import elements from '../data/elements.json' with { type: 'json' };

export const DEG = Math.PI / 180;
export const AU_KM = 149597870.7;
export const GM = { earth: 398600.4418, moon: 4902.8, mars: 42828.37 }; // km³/s²
export const RADIUS_KM = { earth: 6371, moon: 1737.4, mars: 3389.5 };
export const ELEMENTS_SOURCE = elements.source;
const OBLIQUITY = 23.43928 * DEG;

export const jdFromMs = (ms) => ms / 864e5 + 2440587.5;
const centuries = (ms) => (jdFromMs(ms) - 2451545.0) / 36525;
const wrap360 = (d) => ((d % 360) + 360) % 360;
const wrap24 = (h) => ((h % 24) + 24) % 24;

export function solveKepler(M, e) {
  let E = e < 0.8 ? M : Math.PI;
  for (let k = 0; k < 30; k++) {
    const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  return E;
}

// Position in the reference plane (x toward the reference direction, z toward the north pole).
// el: a (any length unit), e, i, node, argp (degrees), M (radians)
export function keplerXYZ(el, M) {
  const E = solveKepler(M, el.e);
  const xv = el.a * (Math.cos(E) - el.e);
  const yv = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E);
  return rotateOrbit(xv, yv, el);
}

function rotateOrbit(xv, yv, el) {
  const i = el.i * DEG;
  const O = el.node * DEG;
  const w = el.argp * DEG;
  const cO = Math.cos(O), sO = Math.sin(O), cw = Math.cos(w), sw = Math.sin(w), ci = Math.cos(i), si = Math.sin(i);
  return {
    x: (cw * cO - sw * sO * ci) * xv + (-sw * cO - cw * sO * ci) * yv,
    y: (cw * sO + sw * cO * ci) * xv + (-sw * sO + cw * cO * ci) * yv,
    z: sw * si * xv + cw * si * yv,
  };
}

// Points around a whole orbit (for drawing the ellipse)
export function orbitPoints(el, n = 180) {
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const E = (k / n) * Math.PI * 2;
    pts.push(rotateOrbit(el.a * (Math.cos(E) - el.e), el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E), el));
  }
  return pts;
}

// ---------- Planets ----------
export function planetElements(id, ms) {
  const p = elements.planets[id];
  const T = centuries(ms);
  const v = (k) => p[k][0] + p[k][1] * T;
  const peri = v('peri');
  const node = v('node');
  return { a: v('a'), e: v('e'), i: v('i'), node, argp: peri - node, M: wrap360(v('L') - peri) * DEG };
}

// Heliocentric ecliptic position in au (J2000 ecliptic)
export function planetHelio(id, ms) {
  const el = planetElements(id, ms);
  return keplerXYZ(el, el.M);
}

// Asteroid from NASA NeoWs orbital_data
export function neoElements(od) {
  const a = +od.semi_major_axis;
  return {
    a,
    e: +od.eccentricity,
    i: +od.inclination,
    node: +od.ascending_node_longitude,
    argp: +od.perihelion_argument,
    M0: +od.mean_anomaly * DEG,
    epochJd: +od.epoch_osculation,
    n: (od.mean_motion ? +od.mean_motion : 0.9856076686 / Math.pow(a, 1.5)) * DEG, // rad/day
  };
}
export function neoHelio(el, ms) {
  const M = el.M0 + el.n * (jdFromMs(ms) - el.epochJd);
  return keplerXYZ(el, M);
}

// ---------- Frames ----------
export function eqToEcl(v) {
  const c = Math.cos(OBLIQUITY), s = Math.sin(OBLIQUITY);
  return { x: v.x, y: c * v.y + s * v.z, z: -s * v.y + c * v.z };
}
export function eclToEq(v) {
  const c = Math.cos(OBLIQUITY), s = Math.sin(OBLIQUITY);
  return { x: v.x, y: c * v.y - s * v.z, z: s * v.y + c * v.z };
}
export function raDecUnit(raHours, decDeg) {
  const ra = raHours * 15 * DEG;
  const dec = decDeg * DEG;
  return { x: Math.cos(dec) * Math.cos(ra), y: Math.cos(dec) * Math.sin(ra), z: Math.sin(dec) };
}

// Voyager / New Horizons: straight-line escape at a published speed and direction
export function escapeProbe(esc, ms) {
  const years = (ms - Date.UTC(2025, 0, 1)) / (365.25 * 864e5);
  const r = esc.au2025 + esc.auPerYear * years;
  const u = eqToEcl(raDecUnit(esc.raH, esc.decDeg));
  return { x: u.x * r, y: u.y * r, z: u.z * r, r };
}

// Parker Solar Probe: real perihelion schedule (88-day orbit, 0.046 au), direction approximate
const PARKER = { tp: Date.UTC(2024, 11, 24, 11, 53), periodDays: 88, q: 0.0459, Q: 0.73 };
export function parkerProbe(ms) {
  const a = (PARKER.q + PARKER.Q) / 2;
  const e = (PARKER.Q - PARKER.q) / (PARKER.Q + PARKER.q);
  const M = (2 * Math.PI * ((ms - PARKER.tp) / 864e5)) / PARKER.periodDays;
  const el = { a, e, i: 3.4, node: 0, argp: 0 };
  const p = keplerXYZ(el, ((M % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));
  return { ...p, r: Math.hypot(p.x, p.y, p.z), el };
}

// ---------- Sun and Moon as seen from Earth ----------
export function sunEclLon(ms) {
  const d = jdFromMs(ms) - 2451545.0;
  const g = (357.528 + 0.9856003 * d) * DEG;
  return wrap360(280.46 + 0.9856474 * d + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g));
}

// Geocentric Moon: ecliptic longitude/latitude (deg) and distance (km), good to ~0.3°
export function moonGeo(ms) {
  const d = jdFromMs(ms) - 2451545.0;
  const L = 218.316 + 13.176396 * d;
  const M = (134.963 + 13.064993 * d) * DEG;
  const F = (93.272 + 13.22935 * d) * DEG;
  const D = (297.85 + 12.190749 * d) * DEG;
  const Ms = (357.529 + 0.98560028 * d) * DEG;
  const lon = L + 6.289 * Math.sin(M) + 1.274 * Math.sin(2 * D - M) + 0.658 * Math.sin(2 * D) + 0.214 * Math.sin(2 * M) - 0.186 * Math.sin(Ms);
  const lat = 5.128 * Math.sin(F);
  const km = 385001 - 20905 * Math.cos(M) - 3699 * Math.cos(2 * D - M) - 2956 * Math.cos(2 * D);
  return { lon: wrap360(lon), lat, km };
}

export function moonPhase(ms) {
  const elong = wrap360(moonGeo(ms).lon - sunEclLon(ms));
  const illum = (1 - Math.cos(elong * DEG)) / 2;
  const names = ['New Moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full Moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
  return { elong, illum, name: names[Math.round(elong / 45) % 8], subsolarLon: wrap360(180 - elong) };
}

// ---------- Mars clock (Mars24) ----------
export function marsTime(ms) {
  const jdTT = jdFromMs(ms) + 69.184 / 86400;
  const dt = jdTT - 2451545.0;
  const M = (19.3871 + 0.52402073 * dt) * DEG;
  const alpha = 270.3871 + 0.524038496 * dt;
  const nuM = (10.691 + 3.0e-7 * dt) * Math.sin(M) + 0.623 * Math.sin(2 * M) + 0.05 * Math.sin(3 * M) + 0.005 * Math.sin(4 * M) + 0.0005 * Math.sin(5 * M);
  const ls = wrap360(alpha + nuM);
  const lsR = ls * DEG;
  const eot = 2.861 * Math.sin(2 * lsR) - 0.071 * Math.sin(4 * lsR) + 0.002 * Math.sin(6 * lsR) - nuM; // degrees
  const msd = (dt - 4.5) / 1.0274912517 + 44796.0 - 0.0009626;
  const mtc = wrap24(24 * msd);
  const decl = Math.asin(0.42565 * Math.sin(lsR)) / DEG + 0.25 * Math.sin(lsR);
  // the Sun is overhead where local true solar time is 12:00
  const subsolarLonE = wrap360(180 - mtc * 15 - eot + 180) - 180;
  return { msd, mtc, ls, eot, decl, subsolarLonE };
}

export function marsLocal(ms, lonE) {
  const t = marsTime(ms);
  const lmst = wrap24(t.mtc + lonE / 15);
  return { ...t, lmst, ltst: wrap24(lmst + t.eot / 15) };
}

// Mission sol number (landing day = sol 0), counted in local mean solar days at the site
export function missionSol(landingIso, lonE, ms) {
  const local = (m) => marsTime(m).msd + lonE / 360;
  return Math.floor(local(ms)) - Math.floor(local(Date.parse(landingIso)));
}

export function marsSeason(ls) {
  if (ls < 90) return 'northern spring';
  if (ls < 180) return 'northern summer';
  if (ls < 270) return 'northern autumn';
  return 'northern winter';
}

export const fmtClock = (h) => {
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

// ---------- Orbiters around the Moon and Mars ----------
// Orbit size, shape, tilt and period are the published ones; where the spacecraft is along the
// orbit right now is an estimate (these spacecraft are not publicly tracked in real time).
export function hashAngle(str, salt = 0) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return ((h >>> 0) % 36000) / 100;
}

export function orbiterElements(id, orbit, body) {
  const R = RADIUS_KM[body];
  const rp = R + orbit.periKm;
  const ra = R + orbit.apoKm;
  const a = (rp + ra) / 2;
  const e = (ra - rp) / (ra + rp);
  const n = Math.sqrt(GM[body] / (a * a * a)); // rad/s
  return {
    a, e, i: orbit.incDeg,
    node: orbit.raanDeg ?? hashAngle(id, 1),
    argp: orbit.argPeriDeg ?? hashAngle(id, 2),
    n,
    M0: hashAngle(id, 3) * DEG,
    periodS: (2 * Math.PI) / n,
  };
}

export function orbiterState(el, body, ms) {
  const M = (el.M0 + el.n * (ms / 1000)) % (2 * Math.PI);
  const p = keplerXYZ(el, M);
  const r = Math.hypot(p.x, p.y, p.z);
  const speed = Math.sqrt(GM[body] * (2 / r - 1 / el.a));
  return { ...p, r, altKm: r - RADIUS_KM[body], speed };
}

// Planet-fixed lat/lon (deg) to a unit vector (x toward lon 0, z toward north)
export function latLonUnit(lat, lon) {
  const la = lat * DEG, lo = lon * DEG;
  return { x: Math.cos(la) * Math.cos(lo), y: Math.cos(la) * Math.sin(lo), z: Math.sin(la) };
}
