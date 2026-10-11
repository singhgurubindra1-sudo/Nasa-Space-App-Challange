// Explains WHY a mission failed as a short chain of cause → effect, using what the engine
// recorded each sol (record.causes, lifeSupportFraction, hungry, battery, ...).
import { G, WORLDS, EVENTS, NEEDS } from './engine.js';

const sum = (hist, key) => hist.reduce((t, h) => t + ((h.causes && h.causes[key]) || 0), 0);
const solList = (hist) => {
  const sols = hist.map((h) => h.sol);
  if (!sols.length) return '';
  // "3–6" for a run, "3, 5 and 9" otherwise.
  const runs = [];
  for (const n of sols) {
    const last = runs[runs.length - 1];
    if (last && n === last[1] + 1) last[1] = n;
    else runs.push([n, n]);
  }
  const parts = runs.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`));
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
};
// "sol 4" or "sols 4–6 and 9".
const on = (T, hist) => `${T}${hist.length === 1 ? '' : 's'} ${solList(hist)}`;
// Only events that cut power or raise the power bill.
const powerEvent = (id) => id && (EVENTS[id].effect.solarFactor !== undefined || !!EVENTS[id].effect.lifeSupportExtraKwh);
const eventsDuring = (hist) => [...new Set(hist.map((h) => h.eventId).filter(powerEvent))].map((id) => `${EVENTS[id].emoji} ${EVENTS[id].title.replace('!', '').toLowerCase()}`);

// Why was life support short on these sols? Broken part, too little power given, or not enough power existed.
function lifeSupportReasons(state, short, T) {
  const out = [];
  const broken = short.filter((h) => h.brokenAtStart);
  if (broken.length) out.push(`Life support was broken on ${on(T, broken)}, so it needed double power. Repairing it fast is the fix.`);
  const starved = short.filter((h) => !h.brokenAtStart && h.alloc.lifeSupport < h.lsPowerNeeded && h.available >= h.lsPowerNeeded);
  if (starved.length) {
    const h = starved[0];
    out.push(`On ${on(T, starved)} you gave life support less than it needed (${starved.length > 1 ? 'for example ' : ''}${h.alloc.lifeSupport} of ${h.lsPowerNeeded} kWh${starved.length > 1 ? ` on ${T} ${h.sol}` : ''}), even though the power was there.`);
  }
  const noPower = short.filter((h) => h.available < h.lsPowerNeeded);
  if (noPower.length) {
    const ev = eventsDuring(state.history.filter((h) => h.sol <= noPower[noPower.length - 1].sol && h.sol >= noPower[0].sol - 5));
    out.push(`On ${on(T, noPower)} there wasn't enough power at all: the battery was empty${ev.length ? ` after the ${ev.join(' and ')}` : ''}. A fuller battery before bad days is the fix.`);
  }
  return out;
}

export function explainLoss(state) {
  if (state.status !== 'lost') return null;
  const world = WORLDS[state.worldId];
  const T = world.turnLabel.toLowerCase();
  const hist = state.history;
  const end = hist[hist.length - 1];
  const steps = [];
  let title;
  let fix;

  switch (state.lossReason) {
    case 'health': {
      const cold = sum(hist, 'cold');
      const hunger = sum(hist, 'hunger');
      const morale = sum(hist, 'lowMorale');
      const parts = [
        { k: 'cold', v: cold, t: 'cold and stale air (life support running under 75%)' },
        { k: 'hunger', v: hunger, t: 'hunger (no food left)' },
        { k: 'morale', v: morale, t: 'very low morale (stress)' },
      ].filter((p) => p.v > 0).sort((a, b) => b.v - a.v);
      title = "The crew's health ran out";
      if (parts.length) steps.push(`Health was lost to ${parts.map((p) => `${p.t}: −${Math.round(p.v)}`).join('; ')}.`);
      const main = parts[0] ? parts[0].k : null;
      if (main === 'cold') {
        const short = hist.filter((h) => h.lifeSupportFraction < G.health.coldThreshold);
        steps.push(`Life support ran below 75% on ${on(T, short)}. The crew got cold and the air got worse.`);
        steps.push(...lifeSupportReasons(state, short, T));
        fix = 'Give life support everything it needs first, every single day. Everything else comes second.';
      } else if (main === 'hunger') {
        const hungry = hist.filter((h) => h.hungry);
        const weak = hist.filter((h) => h.alloc.greenhouse < G.greenhouse.minPowerToSurvive);
        steps.push(`The food ran out on ${T} ${hungry[0].sol}. A crew of 4 eats ${NEEDS.food.toFixed(1)} kg a day.`);
        if (weak.length) steps.push(`The greenhouse got less than ${G.greenhouse.minPowerToSurvive} kWh on ${weak.length} ${T}s, so the plants could not grow (or wilted).`);
        fix = 'Power the greenhouse early. Plants need about a week before big harvests, so start before the food gets low.';
      } else if (main === 'morale') {
        steps.push('Morale stayed under 30 for a long time. Stress made the crew ill.');
        fix = 'Fresh greenhouse food, science work and calm days lift morale. Avoid long stretches of cold or hunger.';
      }
      break;
    }
    case 'oxygen':
    case 'water': {
      const what = state.lossReason === 'oxygen' ? 'oxygen' : 'water';
      title = `The ${what} ran out`;
      const short = hist.filter((h) => h.lifeSupportFraction < 1);
      if (short.length) steps.push(`Life support ran below 100% on ${on(T, short)}, so the crew used up the ${what} reserve.`);
      steps.push(...lifeSupportReasons(state, short, T));
      const leak = sum(hist, 'o2Leak');
      if (what === 'oxygen' && leak > 0) {
        const leaky = hist.filter((h) => h.leakAtStart);
        steps.push(`A micrometeoroid hole leaked ${leak.toFixed(1)} kg of oxygen${leaky.length ? ` (still leaking on ${on(T, leaky)})` : ''}. Repair stops the leak.`);
      }
      fix = 'Keep life support at 100%. If something breaks or leaks, Repair the same day.';
      break;
    }
    case 'dose': {
      title = 'Too much radiation';
      const cosmic = sum(hist, 'cosmic');
      const flare = sum(hist, 'flare');
      const explore = sum(hist, 'explore');
      steps.push(`The crew got ${state.dose.toFixed(1)} mSv, over the ${G.doseLimitMsv} mSv mission limit: cosmic rays ${cosmic.toFixed(1)}, solar storms ${flare.toFixed(1)}, trips outside ${explore.toFixed(1)}.`);
      const flareDays = hist.filter((h) => h.eventId === 'solar_flare');
      const unsheltered = flareDays.filter((h) => h.action !== 'shelter');
      if (unsheltered.length) steps.push(`On ${on(T, unsheltered)} a particle storm hit and the crew was not in the shelter (shelter cuts storm dose by 75%).`);
      if (end.shield < 40) steps.push(`Shielding was only ${Math.round(end.shield)}% by the end. More regolith on the roof blocks part of every day's dose.`);
      const trips = hist.filter((h) => h.action === 'explore').length;
      if (trips >= 6) steps.push(`The crew went outside ${trips} times. Each trip adds extra dose.`);
      fix = 'Build shielding early, it keeps working every day. When Nova warns of a particle storm, Shelter.';
      break;
    }
    case 'battery': {
      title = 'The power ran out';
      const last = hist.slice(-4);
      const over = last.filter((h) => Object.values(h.alloc).reduce((a, b) => a + b, 0) > h.generation);
      const ev = eventsDuring(hist.slice(-7));
      if (ev.length) steps.push(`The ${ev.join(' and ')} cut the power the base could make.`);
      if (over.length) steps.push(`On ${on(T, over)} the base spent more than it made, so the battery drained.`);
      steps.push(`The battery was empty two ${T}s in a row and the base shut down.`);
      fix = ev.length
        ? 'When Nova forecasts a storm, shadow or cold snap, charge the battery first and cut shielding and science until it passes.'
        : 'Spend no more than the base makes each day. Unspent power charges the battery, your backup for bad days.';
      break;
    }
    default:
      return null;
  }
  return { title, steps: steps.filter(Boolean), fix };
}
