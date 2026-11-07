import { describe, it, expect } from 'vitest';
import { createGame, nextSol, generateSchedule, replay, G } from '../src/engine/engine.js';
import { resolveDifficulty, dustSeason, solarActivity } from '../src/engine/difficulty.js';
import { smartPolicy } from '../src/engine/strategies.js';
import { findTurningPoint } from '../src/engine/turningPoint.js';

const flares = (sched) => sched.filter((e) => e && e.eventId === 'solar_flare').length;
const play = (world, seed, diff) => {
  let s = createGame(world, seed, diff);
  while (s.status === 'playing') s = nextSol(s, smartPolicy(s)).state;
  return s;
};

describe('difficulty levels', () => {
  it('astronaut is the default and matches the original game', () => {
    const a = createGame('mars', 11);
    const b = createGame('mars', 11, 'astronaut');
    expect(a.schedule).toEqual(b.schedule);
    expect(a.battery).toBe(G.batteryStartKwh);
    expect(a.spares).toBe(1);
  });

  it('cadet starts with more, commander with less', () => {
    const c = createGame('moon', 3, 'cadet');
    const k = createGame('moon', 3, 'commander');
    expect(c.food).toBeGreaterThan(G.foodStartKg);
    expect(k.food).toBeLessThan(G.foodStartKg);
    expect(c.spares).toBe(2);
    expect(k.spares).toBe(0);
  });

  it('commander has at least as many particle storms as astronaut', () => {
    for (let seed = 1; seed < 40; seed++) {
      const a = flares(generateSchedule('moon', seed, resolveDifficulty('astronaut', 'moon')));
      const k = flares(generateSchedule('moon', seed, resolveDifficulty('commander', 'moon')));
      expect(k).toBeGreaterThanOrEqual(Math.min(a + 1, 2));
    }
  });

  it('a careful player wins less often on harder levels', () => {
    const wins = (lvl) => Array.from({ length: 60 }, (_, i) => play('mars', 1000 + i, lvl)).filter((s) => s.status === 'won').length;
    expect(wins('cadet')).toBeGreaterThanOrEqual(wins('astronaut'));
    expect(wins('astronaut')).toBeGreaterThan(wins('commander'));
  });

  it('replays and turning points use the stored difficulty', () => {
    const d = resolveDifficulty('commander', 'mars');
    const s = play('mars', 77, d);
    const r = replay('mars', 77, s.history.map((h) => ({ alloc: h.alloc, action: h.action })), s.difficulty);
    expect(r.history.map((h) => h.o2)).toEqual(s.history.map((h) => h.o2));
    expect(() => findTurningPoint(s)).not.toThrow();
  });
});

describe('Live NASA difficulty', () => {
  it('a quiet Sun makes storms weaker, a stormy Sun makes them stronger and more frequent', () => {
    const quiet = resolveDifficulty('live', 'moon', { xFlares: 0, mFlares: 2, seps: 0, fastCmes: 0 });
    const stormy = resolveDifficulty('live', 'moon', { xFlares: 4, mFlares: 30, seps: 2, fastCmes: 3 });
    expect(quiet.flareDoseMult).toBeLessThan(1);
    expect(stormy.flareDoseMult).toBeGreaterThan(1.3);
    expect(stormy.extraFlares).toBeGreaterThanOrEqual(2);
    expect(stormy.eventRate).toBeGreaterThan(quiet.eventRate);
    expect(solarActivity({ xFlares: 4, mFlares: 30, seps: 2, fastCmes: 3 })).toBeGreaterThan(2);
  });

  it('Mars dust season (Ls 180–330) makes dust storms longer and darker', () => {
    expect(dustSeason(230)).toEqual({ active: true, peak: true });
    expect(dustSeason(60).active).toBe(false);
    const d = resolveDifficulty('live', 'mars', { ls: 240 });
    expect(d.dustDurationBonus).toBe(2);
    expect(d.dustSolarFactor).toBeLessThan(0.4);
    const sched = generateSchedule('mars', 5, d).filter((e) => e && e.eventId === 'dust_storm');
    expect(sched.every((e) => e.duration >= 5)).toBe(true);
  });

  it('falls back to Astronaut settings for the Sun when NASA is offline', () => {
    const d = resolveDifficulty('live', 'moon', { offline: true, ls: 10 });
    expect(d.offline).toBe(true);
    expect(d.flareDoseMult).toBe(1);
    expect(d.extraFlares).toBe(0);
  });

  it('the dust-season storm really blocks more sunlight in play', () => {
    const d = resolveDifficulty('live', 'mars', { ls: 240, offline: true });
    let s = createGame('mars', 5, d);
    let seen = null;
    while (s.status === 'playing' && !seen) {
      s = nextSol(s, smartPolicy(s)).state;
      seen = s.active.find((a) => a.id === 'dust_storm');
    }
    expect(seen.solarFactor).toBe(0.25);
  });
});
