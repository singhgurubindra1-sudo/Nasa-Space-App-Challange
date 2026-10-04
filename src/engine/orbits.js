// Where the planets are on a given date, with circular orbits (good to a few percent for
// the inner planets; Mars's orbit is the most oval, so its distance can be off by up to ~10%).
import data from '../data/planets.json' with { type: 'json' };

export const PLANETS = data.planets;
export const MOON = data.moon;
export const TARGETS = data.targets;
export const ORBIT_SOURCES = data.sources;

const J2000_MS = Date.UTC(2000, 0, 1, 12);
const DAY_MS = 864e5;
const LIGHT_KM_S = 299792.458;
const deg = Math.PI / 180;

export const daysSinceJ2000 = (ms) => (ms - J2000_MS) / DAY_MS;
export const dateFromDays = (days) => new Date(J2000_MS + days * DAY_MS);

export function orbitAngle(body, days) {
  return body.meanLongitudeJ2000Deg * deg + (2 * Math.PI * days) / body.periodDays;
}

// Heliocentric position in au, in the plane of the ecliptic.
export function positionAu(body, days) {
  const a = orbitAngle(body, days);
  return { x: body.au * Math.cos(a), y: body.au * Math.sin(a) };
}

const byId = Object.fromEntries(PLANETS.map((p) => [p.id, p]));

export function distanceKm(idA, idB, days) {
  const a = positionAu(byId[idA], days);
  const b = positionAu(byId[idB], days);
  return Math.hypot(a.x - b.x, a.y - b.y) * data.auKm;
}

// How far the mission target is from Earth on this day, and how long a radio message takes.
export function targetDistance(target, days) {
  const km = target === 'moon' ? MOON.distanceKm : distanceKm('earth', 'mars', days);
  return { km, lightSeconds: km / LIGHT_KM_S };
}

export function formatDelay(seconds) {
  if (seconds < 60) return `${seconds.toFixed(1)} seconds`;
  return `${(seconds / 60).toFixed(1)} minutes`;
}
