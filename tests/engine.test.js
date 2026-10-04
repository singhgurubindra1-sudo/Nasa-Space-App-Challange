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
