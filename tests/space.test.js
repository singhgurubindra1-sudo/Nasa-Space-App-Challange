import { describe, it, expect } from 'vitest';
import { planetHelio, marsTime, marsLocal, missionSol, moonPhase, moonGeo, orbiterElements, orbiterState, escapeProbe, solveKepler } from '../src/engine/space.js';
import { closeApproaches } from '../src/live/live.js';
import { json2satrec, propagate, eciToGeodetic, gstime } from '../src/lib/satellite.js';
import catalog from '../src/data/spacecraft.json' with { type: 'json' };

const lon = (p) => ((Math.atan2(p.y, p.x) * 180) / Math.PI + 360) % 360;

describe('real-time astronomy', () => {
  it('puts Earth where it is at J2000 (JPL elements)', () => {
    const e = planetHelio('earth', Date.UTC(2000, 0, 1, 12));
    expect(e.x).toBeCloseTo(-0.177, 2);
    expect(e.y).toBeCloseTo(0.967, 2);
  });
  it('lines up Earth and Mars at the January 2025 opposition', () => {
    const t = Date.UTC(2025, 0, 16);
    expect(Math.abs(lon(planetHelio('earth', t)) - lon(planetHelio('mars', t)))).toBeLessThan(1);
  });
  it('matches the Mars24 worked example (2000-01-06 00:00 UTC)', () => {
    const t = marsTime(Date.UTC(2000, 0, 6));
    expect(t.msd).toBeCloseTo(44795.9998, 2);
    expect(t.ls).toBeCloseTo(277.19, 1);
  });
  it('gives Perseverance a mid-afternoon landing and a sensible sol count', () => {
    expect(marsLocal(Date.parse('2021-02-18T20:44:00Z'), 77.45).lmst).toBeGreaterThan(15.5);
    expect(marsLocal(Date.parse('2021-02-18T20:44:00Z'), 77.45).lmst).toBeLessThan(16.2);
    expect(missionSol('2021-02-18T20:44:00Z', 77.45, Date.UTC(2023, 11, 13, 12))).toBeGreaterThanOrEqual(999);
    expect(missionSol('2021-02-18T20:44:00Z', 77.45, Date.UTC(2023, 11, 13, 12))).toBeLessThanOrEqual(1001);
  });
  it('knows full and new Moon', () => {
    expect(moonPhase(Date.UTC(2025, 8, 7, 18, 9)).illum).toBeGreaterThan(0.99);
    expect(moonPhase(Date.UTC(2025, 8, 21, 19, 54)).illum).toBeLessThan(0.01);
    const d = moonGeo(Date.now()).km;
    expect(d).toBeGreaterThan(355000);
    expect(d).toBeLessThan(407000);
  });
  it('solves Kepler and gets real orbit periods for orbiters and moons', () => {
    const E = solveKepler(1, 0.5);
    expect(E - 0.5 * Math.sin(E)).toBeCloseTo(1, 10);
    const phobos = catalog.mars.orbiters.find((o) => o.id === 'phobos');
    expect(orbiterElements('phobos', phobos.orbit, 'mars').periodS / 3600).toBeCloseTo(7.65, 1);
    const lro = catalog.moon.orbiters.find((o) => o.id === 'lro');
    const el = orbiterElements('lro', lro.orbit, 'moon');
    expect(el.periodS / 60).toBeGreaterThan(110);
    expect(el.periodS / 60).toBeLessThan(125);
    const st = orbiterState(el, 'moon', Date.now());
    expect(st.altKm).toBeGreaterThan(39);
    expect(st.altKm).toBeLessThan(171);
  });
  it('puts Voyager 1 about one light-day out in late 2026', () => {
    const v = escapeProbe(catalog.helio.find((h) => h.id === 'voyager1').escape, Date.UTC(2026, 10, 15));
    expect(v.r).toBeGreaterThan(170);
    expect(v.r).toBeLessThan(176);
  });
});

describe('live data', () => {
  it('propagates CelesTrak OMM elements with SGP4', () => {
    const omm = { OBJECT_NAME: 'ISS (ZARYA)', OBJECT_ID: '1998-067A', EPOCH: '2026-10-05T00:00:00.000', MEAN_MOTION: 15.5, ECCENTRICITY: 0.0004, INCLINATION: 51.64, RA_OF_ASC_NODE: 120, ARG_OF_PERICENTER: 40, MEAN_ANOMALY: 200, EPHEMERIS_TYPE: 0, CLASSIFICATION_TYPE: 'U', NORAD_CAT_ID: 25544, ELEMENT_SET_NO: 999, REV_AT_EPOCH: 1000, BSTAR: 0.0002, MEAN_MOTION_DOT: 0.0001, MEAN_MOTION_DDOT: 0 };
    const d = new Date(Date.UTC(2026, 9, 5, 1));
    const pv = propagate(json2satrec(omm), d);
    const g = eciToGeodetic(pv.position, gstime(d));
    expect(g.height).toBeGreaterThan(380);
    expect(g.height).toBeLessThan(460);
    expect(Math.abs((g.latitude * 180) / Math.PI)).toBeLessThanOrEqual(51.7);
  });
  it('reports offline honestly when the asteroid feed cannot be reached', async () => {
    const real = globalThis.fetch;
    globalThis.fetch = () => Promise.reject(new Error('offline'));
    try {
      const res = await closeApproaches();
      expect(res.state).toBe('offline');
      expect(res.list).toEqual([]);
    } finally {
      globalThis.fetch = real;
    }
  });
  it('every Earth satellite has a NORAD number and a name check', () => {
    for (const s of catalog.earth) {
      expect(s.norad).toBeGreaterThan(0);
      expect(s.match).toBeTruthy();
      expect(s.url).toMatch(/^https:/);
    }
  });
});
