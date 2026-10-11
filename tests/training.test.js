import { describe, it, expect } from 'vitest';
import { createGame, nextSol, conditions, replay, missionSols } from '../src/engine/engine.js';
import { smartPolicy, studentPolicy } from '../src/engine/strategies.js';
import { findTurningPoint } from '../src/engine/turningPoint.js';
import { makeRng } from '../src/engine/rng.js';
import { MODULES, FINAL, moduleSetup, modulePassed, checkObjectives, rankFor, isUnlocked, nextModule, recordResult, recordQuiz } from '../src/engine/training.js';
import { explainLoss } from '../src/engine/causes.js';
import { makeClassCode, parseClassCode, makeResultCode, parseResultCode, summarize, rankResults } from '../src/engine/classroom.js';

const play = (state, policy) => {
  let s = state;
  while (s.status === 'playing') s = nextSol(s, policy(s)).state;
  return s;
};
const lazy = (s) => ({ alloc: { lifeSupport: conditions(s).lsPowerNeeded, greenhouse: 0, shielding: 0, science: 0 }, action: 'repair' });
const maxOut = () => ({ alloc: { lifeSupport: 24, greenhouse: 12, shielding: 12, science: 12 }, action: 'explore' });

describe('training modules', () => {
  it('a careful player passes every module', () => {
    for (const m of MODULES) {
      for (let seed = 1; seed <= 5; seed++) {
        const s = play(createGame(m.worldId, seed, moduleSetup(m)), smartPolicy);
        expect(s.history.length).toBe(m.setup.sols);
        expect(checkObjectives(m, s).filter((o) => !o.ok)).toEqual([]);
      }
    }
  });

  it('every module can be failed by a one-track plan', () => {
    for (const m of MODULES) {
      const results = [lazy, maxOut].map((p) => modulePassed(m, play(createGame(m.worldId, 3, moduleSetup(m)), p)));
      expect(results).toContain(false);
    }
  });

  it('locked systems get no power and locked actions are replaced', () => {
    const m = MODULES[1]; // food: life support + greenhouse only
    const s = createGame(m.worldId, 1, moduleSetup(m));
    const { state } = nextSol(s, { alloc: { lifeSupport: 19, greenhouse: 10, shielding: 12, science: 12 }, action: 'build' });
    expect(state.history[0].alloc.shielding).toBe(0);
    expect(state.history[0].alloc.science).toBe(0);
    expect(m.setup.actions).toContain(state.history[0].action);
  });

  it('scripted events happen on their sol', () => {
    const m = MODULES[2]; // radiation: flare on sol 5
    const s = play(createGame(m.worldId, 9, moduleSetup(m)), smartPolicy);
    expect(s.history[4].eventId).toBe('solar_flare');
    expect(s.history.filter((h) => h.eventId).length).toBe(1);
  });

  it('replays and the turning point respect the module setup', () => {
    const m = MODULES[4];
    const s = play(createGame(m.worldId, 4, moduleSetup(m)), lazy);
    const r = replay(s.worldId, s.seed, s.history.map((h) => ({ alloc: h.alloc, action: h.action })), s.setup);
    expect(r.history.map((h) => h.battery)).toEqual(s.history.map((h) => h.battery));
    expect(missionSols(r)).toBe(12);
    const tp = findTurningPoint(s);
    expect(tp.sol).toBeGreaterThanOrEqual(1);
    expect(tp.sol).toBeLessThanOrEqual(12);
  });

  it('ranks and unlocking follow passed modules', () => {
    let p = {};
    expect(rankFor(p).id).toBe('cadet');
    expect(isUnlocked(p, MODULES[0])).toBe(true);
    expect(isUnlocked(p, MODULES[1])).toBe(false);
    for (const m of MODULES.slice(0, 3)) p = recordResult(p, m, play(createGame(m.worldId, 1, moduleSetup(m)), smartPolicy), 0);
    expect(rankFor(p).id).toBe('junior');
    expect(nextModule(p).id).toBe('m4');
    expect(isUnlocked(p, MODULES[3])).toBe(true);
    // A failed attempt does not count.
    const failed = play(createGame('mars', 1, moduleSetup(MODULES[3])), maxOut);
    expect(recordResult(p, MODULES[3], failed, 0)).toBe(p);
    expect(isUnlocked({ unlockAll: true }, FINAL)).toBe(true);
    expect(recordQuiz(recordQuiz({}, 'm1', 2), 'm1', 1).quiz.m1).toBe(2);
  });
});

describe('why the mission failed', () => {
  it('explains every kind of loss with steps and a fix', () => {
    const seen = new Set();
    for (let seed = 1; seed < 400; seed++) {
      for (const w of ['moon', 'mars']) {
        const s = play(createGame(w, seed), studentPolicy(makeRng(seed)));
        if (s.status !== 'lost') continue;
        const why = explainLoss(s);
        expect(why.steps.length).toBeGreaterThan(0);
        expect(why.fix).toBeTruthy();
        seen.add(s.lossReason);
      }
    }
    expect(seen.has('health')).toBe(true);
    expect(seen.has('battery')).toBe(true);
  });

  it('blames the cold when life support is starved', () => {
    const s = play(createGame('mars', 2), () => ({ alloc: { lifeSupport: 8, greenhouse: 10, shielding: 6, science: 4 }, action: 'plant' }));
    expect(s.status).toBe('lost');
    const why = explainLoss(s);
    expect(why.steps.join(' ')).toMatch(/life support/i);
  });

  it('says nothing for a mission that was won', () => {
    expect(explainLoss(play(createGame('mars', 1), smartPolicy))).toBeNull();
  });
});

describe('classroom codes', () => {
  it('class codes round-trip and catch typos', () => {
    for (const seed of [0, 1, 123456, 32 ** 6 - 1]) {
      const code = makeClassCode('moon', seed);
      expect(parseClassCode(code)).toEqual({ worldId: 'moon', seed, code });
      expect(parseClassCode(code.toLowerCase().replace('-', ' '))).toEqual({ worldId: 'moon', seed, code });
    }
    const code = makeClassCode('mars', 987654);
    const typo = code.slice(0, 6) + (code[6] === 'A' ? 'B' : 'A') + code.slice(7);
    expect(parseClassCode(typo)).toBeNull();
    // An O typed for a zero still finds the same mission.
    const zero = makeClassCode('mars', 0);
    expect(parseClassCode(zero.replace(/0/g, 'O')).seed).toBe(0);
    expect(parseClassCode('hello')).toBeNull();
  });

  it('result codes round-trip, including non-English names', () => {
    const s = play(createGame('mars', 5, { classCode: 'MARS-000005X' }), smartPolicy);
    const code = makeResultCode({ name: 'Ananya ☆ अनन्या', classCode: 'MARS-000005X', state: s, stars: 3, turningSol: 7 });
    const r = parseResultCode(code);
    expect(r.name).toBe('Ananya ☆ अनन्या');
    expect(r.won).toBe(s.status === 'won');
    expect(r.turningSol).toBe(7);
    expect(parseResultCode('S30-notbase64!!')).toBeNull();
  });

  it('the class board ranks and summarizes', () => {
    const rows = [
      { name: 'A', won: false, sols: 12, stars: 0, health: 0, dose: 10, lossReason: 'health', turningSol: 9 },
      { name: 'B', won: true, sols: 30, stars: 2, health: 80, dose: 20, lossReason: null, turningSol: 9 },
      { name: 'C', won: false, sols: 20, stars: 0, health: 0, dose: 12, lossReason: 'health', turningSol: 4 },
    ];
    expect(rankResults(rows).map((r) => r.name)).toEqual(['B', 'C', 'A']);
    const sum = summarize(rows);
    expect(sum.survivalRate).toBe(33);
    expect(sum.topLoss).toEqual(['health', 2]);
    expect(sum.topTurning).toEqual(['9', 2]);
  });

  it('a class mission gives every student the same events', () => {
    const { worldId, seed } = parseClassCode(makeClassCode('moon', 4242));
    const a = createGame(worldId, seed, { classCode: 'x' });
    const b = createGame(worldId, seed, { classCode: 'x' });
    expect(a.schedule).toEqual(b.schedule);
  });
});
