// Finds the single choice that mattered most.
// For every sol, we replay the mission with the player's choices, but swap that one sol
// for a different plan. The sol where a different choice changes the ending the most is the turning point.
import { createGame, nextSol, outcomeScore, stars, EVENTS, WORLDS, LOSS_TEXT } from './engine.js';
import { PRESETS, presetChoice } from './strategies.js';

const ALT_ACTIONS = ['build', 'repair', 'plant', 'explore', 'shelter'];
const ACTION_WORDS = {
  build: 'Build shielding',
  repair: 'Repair',
  plant: 'Plant',
  explore: 'Explore',
  shelter: 'Shelter',
};

function runFrom(start, choices, fromIndex) {
  let s = start;
  for (let i = fromIndex; i < choices.length && s.status === 'playing'; i++) s = nextSol(s, choices[i]).state;
  // If the player's run ended early, keep going with their last plan so a "rescued" mission can be scored.
  let guard = 0;
  while (s.status === 'playing' && guard++ < 40) s = nextSol(s, s.lastChoices).state;
  return s;
}

export function findTurningPoint(finalState) {
  const { worldId, seed, history } = finalState;
  const choices = history.map((h) => ({ alloc: h.alloc, action: h.action }));
  const actual = outcomeScore(finalState);

  // Rebuild the state at the start of each sol.
  const starts = [];
  let s = createGame(worldId, seed);
  for (const ch of choices) {
    starts.push(s);
    s = nextSol(s, ch).state;
  }

  let best = null; // biggest improvement available
  let key = null; // biggest loss if the player had done something else
  starts.forEach((start, i) => {
    let bestHere = null;
    let worstHere = null;
    for (const preset of Object.keys(PRESETS)) {
      for (const action of ALT_ACTIONS) {
        const alt = presetChoice(preset, start, action);
        const after = nextSol(start, alt).state;
        const end = runFrom(after, choices, i + 1);
        const score = outcomeScore(end);
        // Among equally good options, prefer the one closest to what the player did.
        const dist = distance(alt, choices[i]);
        const cand = { score, preset, action, end, alloc: alt.alloc, dist };
        if (!bestHere || score > bestHere.score + 1 || (Math.abs(score - bestHere.score) <= 1 && dist < bestHere.dist)) bestHere = cand;
        if (!worstHere || score < worstHere.score - 1 || (Math.abs(score - worstHere.score) <= 1 && dist < worstHere.dist)) worstHere = cand;
      }
    }
    const gain = bestHere.score - actual;
    if (!best || gain > best.gain + 0.01) best = { sol: i + 1, gain, ...bestHere };
    const loss = actual - worstHere.score;
    if (!key || loss > key.loss + 0.01) key = { sol: i + 1, loss, ...worstHere };
  });

  const world = WORLDS[worldId];
  const turn = world.turnLabel.toLowerCase();
  const lost = finalState.status === 'lost';
  const T = world.turnLabel;

  // Which single part of the choice (the action, or one slider) made the difference?
  const attribute = (cand, kind) => {
    const i = cand.sol - 1;
    const mine = choices[i];
    const other = { alloc: cand.alloc, action: cand.action };
    const base = outcomeScore(runFrom(nextSol(starts[i], mine).state, choices, i + 1));
    let top = null;
    for (const factor of ['action', ...Object.keys(SYSTEM_NAMES)]) {
      const hybrid = factor === 'action'
        ? { alloc: mine.alloc, action: other.action }
        : { alloc: { ...mine.alloc, [factor]: other.alloc[factor] }, action: mine.action };
      if (factor === 'action' ? hybrid.action === mine.action : Math.abs(hybrid.alloc[factor] - mine.alloc[factor]) < 0.5) continue;
      const end = runFrom(nextSol(starts[i], hybrid).state, choices, i + 1);
      const delta = kind === 'mistake' ? outcomeScore(end) - base : base - outcomeScore(end);
      if (delta > 0.5 && (!top || delta > top.delta)) top = { factor, delta, end, hybrid };
    }
    return top;
  };

  const outcomeText = (end) => {
    if (end.status === 'won' && lost) return `your crew would have survived all ${end.history.length} ${turn}s`;
    if (end.status === 'won' && finalState.status === 'won') {
      if (stars(end) !== stars(finalState)) return `the mission would have earned ${stars(end) > stars(finalState) ? 'more' : 'fewer'} stars`;
      return end.health >= finalState.health ? 'the crew would have ended healthier' : 'the crew would have ended in worse shape';
    }
    if (end.status === 'lost' && finalState.status === 'won') return `the mission would have failed: ${LOSS_TEXT[end.lossReason].toLowerCase().replace(/\.$/, '')}`;
    if (end.status === 'won') return 'your crew would have made it home';
    const more = end.history.length - finalState.history.length;
    return more > 0 ? `the mission would have lasted ${more} more ${turn}${more === 1 ? '' : 's'}` : 'the crew would have been in better shape';
  };

  const eventPart = (h, verb) => {
    const ev = h.eventId ? EVENTS[h.eventId] : null;
    const st = starts[h.sol - 1];
    const trouble = st.broken && st.leak ? ' while life support was broken and the hab was leaking'
      : st.broken ? ' while life support was broken'
        : st.leak ? ' while the hab was leaking air' : '';
    return `${trouble}${ev ? `, ${verb} ${ev.emoji} ${ev.title.replace('!', '').toLowerCase()}` : ''}`;
  };

  const pick = best && (best.gain >= 60 || (lost && best.gain > 0)) ? { ...best, kind: 'mistake' } : { ...key, kind: 'key' };
  const h = history[pick.sol - 1];
  const att = attribute(pick, pick.kind);
  const outcome = att ? outcomeText(att.end) : outcomeText(pick.end);
  let text;
  if (!att) {
    text = `On ${turn} ${pick.sol} you chose ${ACTION_WORDS[h.action]}${eventPart(h, 'the day of the')}. If you had chosen ${ACTION_WORDS[pick.action]} with ${PRESETS[pick.preset].label}, ${outcome}.`;
  } else if (att.factor === 'action') {
    text = `On ${turn} ${pick.sol} you chose ${ACTION_WORDS[h.action]}${eventPart(h, 'the day of the')}. If you had chosen ${ACTION_WORDS[att.hybrid.action]} instead, ${outcome}.`;
  } else {
    const name = SYSTEM_NAMES[att.factor];
    const from = Math.round(h.alloc[att.factor]);
    const to = Math.round(att.hybrid.alloc[att.factor]);
    text = `On ${turn} ${pick.sol} you put ${from} kWh into ${name}${eventPart(h, 'the day of the')}${h.battery < 15 ? `, leaving only ${Math.round(h.battery)} kWh in the battery` : ''}. With ${to} kWh there instead, ${outcome}.`;
  }
  return {
    kind: pick.kind,
    sol: pick.sol,
    headline: pick.kind === 'mistake' ? `Turning point: ${T} ${pick.sol}` : `Your best decision: ${T} ${pick.sol}`,
    text,
    lesson: pick.kind === 'mistake'
      ? (lost ? LOSS_TEXT[finalState.lossReason] : 'Small margins add up.')
      : 'That choice protected your margins. Real mission planners work the same way.',
  };
}

const SYSTEM_NAMES = { lifeSupport: 'life support', greenhouse: 'the greenhouse', shielding: 'shielding', science: 'science & repair' };

function distance(a, b) {
  let d = a.action === b.action ? 0 : 6;
  for (const k of Object.keys(SYSTEM_NAMES)) d += Math.abs((a.alloc[k] || 0) - (b.alloc[k] || 0));
  return d;
}
