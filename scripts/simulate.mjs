// Balance test: plays 1,000 simulated missions per world and prints win rates.
// Target from the build plan: about 40–60% wins for a first-time player.
// Usage: npm run simulate            (default 1000 runs)
//        node scripts/simulate.mjs 5000
import { createGame, nextSol, stars, G } from '../src/engine/engine.js';
import { smartPolicy, studentPolicy } from '../src/engine/strategies.js';
import { makeRng } from '../src/engine/rng.js';

const RUNS = Number(process.argv[2]) || 1000;

function play(worldId, seed, policy) {
  let s = createGame(worldId, seed);
  while (s.status === 'playing') s = nextSol(s, policy(s)).state;
  return s;
}

function summarize(label, results) {
  const wins = results.filter((r) => r.status === 'won');
  const losses = {};
  for (const r of results) if (r.status === 'lost') losses[r.lossReason] = (losses[r.lossReason] || 0) + 1;
  const starCounts = [0, 0, 0, 0];
  for (const r of results) starCounts[stars(r)]++;
  const avgSol = results.reduce((a, r) => a + r.history.length, 0) / results.length;
  const pct = (n) => `${((100 * n) / results.length).toFixed(1)}%`;
  console.log(`  ${label.padEnd(16)} wins ${pct(wins.length).padStart(6)} | avg sols ${avgSol.toFixed(1).padStart(4)} | ` +
    `stars 1/2/3: ${pct(starCounts[1])} ${pct(starCounts[2])} ${pct(starCounts[3])} | losses ${JSON.stringify(losses)}`);
  return wins.length / results.length;
}

const report = {};
for (const worldId of ['moon', 'mars']) {
  console.log(`\n${worldId.toUpperCase()} — ${RUNS} runs each (${G.sols} sols)`);
  const rng = makeRng(worldId === 'moon' ? 1 : 2);
  const student = [];
  const smart = [];
  for (let i = 0; i < RUNS; i++) {
    const seed = Math.floor(rng() * 2 ** 31);
    student.push(play(worldId, seed, studentPolicy(makeRng(seed + 7))));
    smart.push(play(worldId, seed, smartPolicy));
  }
  report[worldId] = {
    student: summarize('first-try player', student),
    smart: summarize('careful player', smart),
  };
}

const ok = Object.values(report).every((r) => r.student >= 0.35 && r.student <= 0.65 && r.smart >= 0.85);
console.log(`\nTarget: first-try 40–60% wins, careful player 85%+ → ${ok ? 'BALANCED ✅' : 'NEEDS TUNING ⚠'}`);
