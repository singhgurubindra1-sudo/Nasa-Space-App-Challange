import { describe, it, expect } from 'vitest';
import { createGame, nextSol, conditions, replay, stars, NEEDS, generateSchedule, G } from '../src/engine/engine.js';
import { smartPolicy, studentPolicy } from '../src/engine/strategies.js';
import { findTurningPoint } from '../src/engine/turningPoint.js';
import { makeRng } from '../src/engine/rng.js';

const play = (world, seed, policy) => {
  let s = createGame(world, seed);
  while (s.status === 'playing') s = nextSol(s, policy(s)).state;
  return s;
};

describe('NASA numbers', () => {
  it('crew of 4 uses BVAD consumables', () => {
    expect(NEEDS.o2).toBeCloseTo(3.28);
    expect(NEEDS.water).toBeCloseTo(10);
    expect(NEEDS.food).toBeCloseTo(7.2);
  });
});

describe('engine', () => {
  it('is deterministic for the same seed and choices', () => {
    const a = play('mars', 42, smartPolicy);
    const b = replay('mars', 42, a.history.map((h) => ({ alloc: h.alloc, action: h.action })));
    expect(b.history.map((h) => h.o2)).toEqual(a.history.map((h) => h.o2));
    expect(b.status).toBe(a.status);
  });

  it('never lets the player spend more power than exists', () => {
    const s = createGame('moon', 1);
    const c = conditions(s);
    const { state } = nextSol(s, { alloc: { lifeSupport: 99, greenhouse: 99, shielding: 99, science: 99 }, action: 'plant' });
    const used = Object.values(state.history[0].alloc).reduce((a, b) => a + b, 0);
    expect(used).toBeLessThanOrEqual(c.available + 0.01);
  });

  it('loses when life support gets no power', () => {
    let s = createGame('moon', 5);
    while (s.status === 'playing') s = nextSol(s, { alloc: { lifeSupport: 0, greenhouse: 0, shielding: 0, science: 0 }, action: 'plant' }).state;
    expect(s.status).toBe('lost');
    expect(s.history.length).toBeLessThan(G.sols);
  });

  it('every schedule contains the world signature event and a solar particle storm', () => {
    for (let seed = 1; seed < 50; seed++) {
      const moon = generateSchedule('moon', seed).filter(Boolean).map((e) => e.eventId);
      const mars = generateSchedule('mars', seed).filter(Boolean).map((e) => e.eventId);
      expect(moon).toContain('lunar_shadow');
      expect(moon).toContain('solar_flare');
      expect(mars).toContain('dust_storm');
      expect(mars).not.toContain('lunar_shadow');
    }
  });

  it('a careful player usually wins with stars', () => {
    let wins = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = play('mars', seed, smartPolicy);
      if (s.status === 'won') {
        wins++;
        expect(stars(s)).toBeGreaterThanOrEqual(1);
      }
    }
    expect(wins).toBeGreaterThanOrEqual(34);
  });
});

describe('turning point', () => {
  it('names a sol for a lost mission', () => {
    let lost = null;
    for (let seed = 1; !lost && seed < 200; seed++) {
      const s = play('moon', seed, studentPolicy(makeRng(seed)));
      if (s.status === 'lost') lost = s;
    }
    const tp = findTurningPoint(lost);
    expect(tp.sol).toBeGreaterThanOrEqual(1);
    expect(tp.sol).toBeLessThanOrEqual(lost.history.length);
    expect(tp.text.length).toBeGreaterThan(20);
  });
});

import { distanceKm, targetDistance, daysSinceJ2000 } from '../src/engine/orbits.js';

describe('orbits', () => {
  it('Earth–Mars distance stays between closest and farthest real values', () => {
    for (let d = 0; d < 3000; d += 37) {
      const km = distanceKm('earth', 'mars', d);
      expect(km).toBeGreaterThan(50e6);
      expect(km).toBeLessThan(410e6);
    }
  });
  it('Mars was near opposition (close to Earth) in mid-January 2025', () => {
    const km = distanceKm('earth', 'mars', daysSinceJ2000(Date.UTC(2025, 0, 16)));
    expect(km).toBeLessThan(110e6); // real: ~96 million km
  });
  it('Moon radio delay is about 1.3 seconds', () => {
    expect(targetDistance('moon', 0).lightSeconds).toBeCloseTo(1.28, 1);
  });
});

import { setCrop, CROPS } from '../src/engine/engine.js';

describe('greenhouse crops', () => {
  it('replanting resets growth; same crop does nothing', () => {
    let s = createGame('mars', 3);
    s = { ...s, maturity: 0.6 };
    expect(setCrop(s, 'mixed').maturity).toBe(0.6);
    const p = setCrop(s, 'potato');
    expect(p.crop).toBe('potato');
    expect(p.maturity).toBe(0);
  });
  it('lettuce matures faster than potatoes', () => {
    const grow = (crop) => {
      let s = setCrop(createGame('mars', 3), crop);
      for (let i = 0; i < 4; i++) s = nextSol(s, { alloc: { lifeSupport: 19, greenhouse: 10, shielding: 0, science: 0 }, action: 'repair' }).state;
      return s.maturity;
    };
    expect(grow('lettuce')).toBeGreaterThan(grow('potato'));
    expect(Object.keys(CROPS)).toEqual(expect.arrayContaining(['mixed', 'lettuce', 'potato', 'wheat', 'soybean']));
  });
});
