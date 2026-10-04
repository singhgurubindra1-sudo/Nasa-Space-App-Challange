// Survive 30 Sols — game rules.
// Everything is a pure function: nextSol(state, choices) returns a brand-new state.
// All numbers come from src/data/numbers.json and all events from src/data/events.json.

import numbers from '../data/numbers.json' with { type: 'json' };
import eventData from '../data/events.json' with { type: 'json' };
import { makeRng, randInt, pickWeighted } from './rng.js';

export const N = numbers.nasa;
export const G = numbers.game;
export const WORLDS = numbers.worlds;
export const EVENTS = Object.fromEntries(eventData.events.map((e) => [e.id, e]));
export const CALM = eventData.calm;
export const SYSTEMS = ['lifeSupport', 'greenhouse', 'shielding', 'science'];
export const ACTIONS = ['build', 'repair', 'plant', 'explore', 'shelter'];

const round1 = (x) => Math.round(x * 10) / 10;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// Per-sol crew needs, straight from NASA BVAD values.
export const NEEDS = {
  o2: G.crew * N.o2PerAstronautKg.value, // 3.28 kg
  water: G.crew * N.waterPerAstronautKg.value, // 10 kg
  food: G.crew * N.foodPerAstronautKg.value, // 7.2 kg
};

// ---------- Event schedule (rolled once at the start, so forecasts are honest) ----------

export function generateSchedule(worldId, seed) {
  const rng = makeRng(seed ^ 0x9e3779b9);
  const pool = eventData.events.filter((e) => (e.worlds[worldId] || 0) > 0);
  const schedule = Array.from({ length: G.sols + 1 }, () => null);
  const blockedUntil = { long: 0 };
  const counts = {};
  const signature = worldId === 'mars' ? 'dust_storm' : 'lunar_shadow';

  const place = (sol, ev) => {
    const duration = randInt(rng, ev.durationMin, ev.durationMax);
    schedule[sol] = { eventId: ev.id, duration, forecast: ev.forecast, falseAlarm: false };
    counts[ev.id] = (counts[ev.id] || 0) + 1;
    if (duration > 1) blockedUntil.long = sol + duration;
  };

  // Guarantee the world's signature challenge and one particle storm, so every run teaches the main lesson.
  place(randInt(rng, 9, 15), EVENTS[signature]);
  const flareSol = (() => {
    let s;
    do s = randInt(rng, 5, 26);
    while (schedule[s]);
    return s;
  })();
  place(flareSol, EVENTS.solar_flare);

  for (let sol = 3; sol <= G.sols; sol++) {
    if (schedule[sol]) continue;
    if (rng() > 0.3) continue;
    const options = pool
      .filter((e) => {
        const isLong = e.durationMax > 1;
        if (isLong && sol <= blockedUntil.long + 2) return false;
        if (isLong && schedule.some((x, i) => x && x.duration > 1 && i > sol && i <= sol + e.durationMax + 2)) return false;
        if (e.id === 'supply_lander' && (sol < 10 || counts[e.id] >= 1)) return false;
        if ((counts[e.id] || 0) >= 2) return false;
        return true;
      })
      .map((e) => ({ value: e, weight: e.worlds[worldId] }));
    if (!options.length) continue;
    place(sol, pickWeighted(rng, options));
  }

  // A few false alarms: real space-weather forecasts are not perfect.
  const forecastable = pool.filter((e) => e.forecast && e.id !== 'supply_lander');
  for (let sol = 4; sol <= G.sols; sol++) {
    if (!schedule[sol] && rng() < 0.06) {
      const ev = forecastable[Math.floor(rng() * forecastable.length)];
      schedule[sol] = { eventId: null, duration: 0, forecast: ev.forecast, falseAlarm: true };
    }
  }
  return schedule;
}

// ---------- New game ----------

export function createGame(worldId, seed) {
  if (!WORLDS[worldId]) throw new Error(`Unknown world ${worldId}`);
  return {
    version: 1,
    worldId,
    seed,
    sol: 1,
    status: 'playing',
    lossReason: null,
    battery: G.batteryStartKwh,
    o2: G.o2StartKg,
    water: G.waterStartKg,
    food: G.foodStartKg,
    health: G.health.start,
    morale: G.morale.start,
    dose: 0,
    shield: 0,
    maturity: 0,
    science: 0,
    spares: 1,
    crop: 'mixed',
    broken: false,
    leak: false,
    active: [], // ongoing multi-sol events: { id, remaining, solarFactor?, lifeSupportExtraKwh? }
    batteryDeadStreak: 0,
    schedule: generateSchedule(worldId, seed),
    history: [],
    lastChoices: defaultChoices(),
  };
}

export const CROPS = Object.fromEntries(Object.entries(G.crops).filter(([k]) => !k.startsWith('_')));

export function cropFor(state) {
  return CROPS[state.crop] || CROPS.mixed;
}

// Replanting with a different crop starts the greenhouse over from seedlings.
export function setCrop(state, crop) {
  if (!CROPS[crop] || (state.crop || 'mixed') === crop) return state;
  return { ...state, crop, maturity: 0 };
}

export function defaultChoices() {
  return {
    alloc: { lifeSupport: G.lifeSupportNeedKwh, greenhouse: 8, shielding: 6, science: 4 },
    action: 'plant',
  };
}

// ---------- What today looks like (used by the briefing and plan screens) ----------

export function conditions(state) {
  const world = WORLDS[state.worldId];
  let solarFactor = 1;
  let lsExtra = world.lifeSupportExtraKwh;
  for (const a of state.active) {
    if (a.solarFactor !== undefined) solarFactor = Math.min(solarFactor, a.solarFactor);
    if (a.lifeSupportExtraKwh) lsExtra += a.lifeSupportExtraKwh;
  }
  const solar = round1(world.solarClearKwhPerSol * solarFactor);
  const generation = round1(world.reactorKwhPerSol + solar);
  const lsNeed = G.lifeSupportNeedKwh + lsExtra;
  // A broken part halves efficiency, so it takes twice the power to do the same job.
  const lsPowerNeeded = state.broken ? lsNeed * 2 : lsNeed;
  return {
    solar,
    reactor: world.reactorKwhPerSol,
    generation,
    available: round1(generation + state.battery),
    lsNeed,
    lsPowerNeeded,
    solarFactor,
  };
}

export function forecastFor(state) {
  const entry = state.schedule[state.sol];
  return entry && entry.forecast ? entry.forecast : null;
}

export function foodSols(food) {
  return food / NEEDS.food;
}

// Scale allocations down if the player asks for more than exists.
export function clampAlloc(alloc, available) {
  const out = {};
  for (const k of SYSTEMS) out[k] = clamp(Number(alloc[k]) || 0, 0, G.sliderMax[k]);
  const total = SYSTEMS.reduce((s, k) => s + out[k], 0);
  if (total > available && total > 0) {
    const f = available / total;
    for (const k of SYSTEMS) out[k] = Math.floor(out[k] * f * 10) / 10;
  }
  return out;
}

// ---------- One sol ----------

export function nextSol(state, choices) {
  if (state.status !== 'playing') return state;
  const world = WORLDS[state.worldId];
  const s = structuredClone(state);
  const c = conditions(state);
  const alloc = clampAlloc(choices.alloc, c.available);
  const action = ACTIONS.includes(choices.action) ? choices.action : 'plant';
  const used = SYSTEMS.reduce((sum, k) => sum + alloc[k], 0);
  const msgs = [];
  const before = snapshot(state);

  // 1. Power: spare generation charges the battery, overspending drains it.
  const net = c.generation - used;
  s.battery = net >= 0
    ? Math.min(G.batteryCapacityKwh, s.battery + net * G.batteryChargeEfficiency)
    : Math.max(0, s.battery + net);

  // 2. The chosen action.
  let shelter = false;
  if (action === 'repair') {
    if (!s.broken && !s.leak) {
      s.morale += 3;
      msgs.push('Nothing was broken, so the crew did maintenance and felt more confident (+3 morale).');
    } else if (s.spares > 0) {
      s.spares -= 1;
      s.broken = false;
      s.leak = false;
      msgs.push('Repaired with a spare part. Everything is working again.');
    } else if (alloc.science >= 6) {
      s.broken = false;
      s.leak = false;
      msgs.push('No spares left, but the workshop (6+ kWh to Science & repair) printed a new part. Fixed!');
    } else {
      msgs.push('Repair failed: no spare part, and the workshop needs at least 6 kWh in Science & repair to make one.');
    }
  } else if (action === 'build') {
    s.shield += G.shielding.buildActionPercent;
    msgs.push(`Robots piled extra regolith on the hab (+${G.shielding.buildActionPercent}% shielding).`);
  } else if (action === 'plant') {
    if (alloc.greenhouse >= G.greenhouse.minPowerToSurvive) {
      s.maturity += G.greenhouse.plantBoost;
      msgs.push('New seedlings planted. The greenhouse grows faster.');
    } else {
      msgs.push(`Planting failed: the greenhouse needs at least ${G.greenhouse.minPowerToSurvive} kWh of light and heat.`);
    }
  } else if (action === 'explore') {
    const pts = world.id === 'mars' ? G.science.exploreMars : G.science.exploreMoon;
    s.science += pts;
    s.morale += 4;
    s.dose += world.exploreDoseMsv;
    if (world.exploreWaterKg) {
      s.water += world.exploreWaterKg;
      msgs.push(`Moonwalk to a shadowed crater: mined ${world.exploreWaterKg} kg of water from ice, +${pts} science.`);
    } else {
      msgs.push(`Rover trip to the old Jezero river delta: rock samples for signs of ancient life, +${pts} science.`);
    }
  } else if (action === 'shelter') {
    shelter = true;
    s.morale -= 2;
    msgs.push('The crew spent the day in the storm shelter, behind water tanks and supplies.');
  }

  // 3. Life support: makes oxygen, recycles water, heats the hab.
  const eff = s.broken ? 0.5 : 1;
  const f = clamp((alloc.lifeSupport * eff) / c.lsNeed, 0, 1);
  s.o2 += f * NEEDS.o2 - NEEDS.o2;
  if (s.leak) s.o2 -= 1.5;
  s.water -= NEEDS.water * (1 - N.waterRecovery.value * f);
  if (f < 1) msgs.push(`Life support ran at ${Math.round(f * 100)}%. Oxygen and water reserves were used to cover the gap.`);

  // 4. Greenhouse.
  const gh = G.greenhouse;
  const crop = cropFor(s);
  if (alloc.greenhouse >= gh.minPowerToSurvive) {
    s.maturity += Math.min(1, alloc.greenhouse / gh.fullPowerKwh) / crop.solsToMature;
  } else if (s.maturity > 0) {
    s.maturity -= gh.wiltPerSol;
    msgs.push('The greenhouse got too little power and the plants wilted.');
  }
  s.maturity = clamp(s.maturity, 0, 1);
  const grown = crop.maxFoodKgPerSol * s.maturity * Math.min(1, alloc.greenhouse / gh.fullPowerKwh);
  s.food += grown - NEEDS.food;
  const hungry = s.food < 0;
  if (hungry) msgs.push('The food ran out. The crew went hungry!');

  // 5. Shielding and science.
  s.shield = clamp(s.shield + alloc.shielding * G.shielding.percentPerKwh, 0, 100);
  s.science += alloc.science * G.science.pointsPerKwh;

  // 6. Radiation from cosmic rays, every sol.
  const gcr = world.doseMsvPerSol * (1 - (s.shield / 100) * G.shielding.maxCosmicRayBlock) * (shelter ? G.shelter.cosmicFactor : 1);
  s.dose += gcr;

  // 7. Today's event.
  const entry = state.schedule[state.sol];
  let event = null;
  let eventNote = null;
  if (entry && entry.eventId) {
    const ev = EVENTS[entry.eventId];
    const d = entry.duration;
    event = { id: ev.id, duration: d, title: ev.title, emoji: ev.emoji, effectText: ev.effectText.replace('{d}', d) };
    const e = ev.effect;
    if (e.flare) {
      const flare = world.flareDoseMsv * (1 - (s.shield / 100) * G.shielding.maxFlareBlock) * (shelter ? G.shelter.flareFactor : 1);
      s.dose += flare;
      s.morale -= 3;
      eventNote = `The particle storm added ${round1(flare)} mSv${shelter ? ' (sheltering cut it by 75%)' : ''}.`;
    }
    if (e.breakLifeSupport) {
      s.broken = true;
      s.morale -= 5;
    }
    if (e.leak) {
      s.leak = true;
      s.o2 -= 1.5;
      s.morale -= 5;
    }
    if (e.food) s.food += e.food;
    if (e.spares) s.spares += e.spares;
    if (e.o2) s.o2 += e.o2;
    if (e.food) s.morale += 10;
    if (e.solarFactor !== undefined || e.lifeSupportExtraKwh) s.morale -= 4;
    event.newActive = e.solarFactor !== undefined || e.lifeSupportExtraKwh
      ? { id: ev.id, remaining: d, solarFactor: e.solarFactor, lifeSupportExtraKwh: e.lifeSupportExtraKwh }
      : null;
  } else {
    s.morale += 1;
    if (entry && entry.falseAlarm) eventNote = CALM.falseAlarm;
  }

  // Ongoing events tick down; today's new one starts tomorrow.
  s.active = s.active.map((a) => ({ ...a, remaining: a.remaining - 1 })).filter((a) => a.remaining > 0);
  if (event && event.newActive) s.active.push(event.newActive);

  // 8. Crew health and morale.
  const H = G.health;
  if (f < H.coldThreshold) {
    s.health -= (H.coldThreshold - f) * H.coldPenalty;
    s.morale -= 3;
  }
  if (hungry) s.health -= H.hungerPenalty;
  if (s.morale < 30) s.health -= H.lowMoralePenalty;
  if (f >= 1 && !hungry && s.morale >= 50) s.health += H.recoverPerSol;
  s.morale += G.morale.dailyDrift;
  if (s.maturity > 0.5 && alloc.greenhouse >= gh.minPowerToSurvive) s.morale += crop.moraleBonus; // fresh food!
  if (alloc.science >= 6) s.morale += 1;
  if (foodSols(Math.max(0, s.food)) < 3) s.morale -= 4;
  if (s.health < 50) s.morale -= 3;

  // Clamp everything to its tank size.
  s.o2 = clamp(s.o2, 0, G.o2TankKg);
  s.water = clamp(s.water, 0, G.waterTankKg);
  s.food = clamp(s.food, 0, G.foodMaxKg);
  s.health = clamp(s.health, 0, 100);
  s.morale = clamp(s.morale, 0, 100);
  s.battery = clamp(s.battery, 0, G.batteryCapacityKwh);

  // 9. Battery-dead check.
  s.batteryDeadStreak = s.battery < 3 ? s.batteryDeadStreak + 1 : 0;
  if (s.batteryDeadStreak === 1) msgs.push('⚠ Battery is empty! If it is empty again tomorrow, the base shuts down.');

  // 10. Win / lose.
  let lossReason = null;
  if (s.o2 <= 0) lossReason = 'oxygen';
  else if (s.water <= 0) lossReason = 'water';
  else if (s.health <= 0) lossReason = 'health';
  else if (s.dose > G.doseLimitMsv) lossReason = 'dose';
  else if (s.batteryDeadStreak >= G.batteryDeadSolsToLose) lossReason = 'battery';

  const record = {
    sol: state.sol,
    alloc,
    action,
    generation: c.generation,
    solar: c.solar,
    lifeSupportFraction: round1(f),
    eventId: event ? event.id : null,
    forecast: entry ? entry.forecast : null,
    ...snapshot(s),
  };
  s.history = [...state.history, record];
  s.lastChoices = { alloc, action };

  if (lossReason) {
    s.status = 'lost';
    s.lossReason = lossReason;
  } else if (state.sol >= G.sols) {
    s.status = 'won';
  } else {
    s.sol = state.sol + 1;
  }

  return {
    state: s,
    report: {
      sol: state.sol,
      event,
      eventNote,
      messages: msgs,
      before,
      after: snapshot(s),
      lifeSupportFraction: f,
      foodGrown: round1(grown),
      dose: round1(s.dose - before.dose),
    },
  };
}

export function snapshot(s) {
  return {
    o2: round1(s.o2),
    water: round1(s.water),
    food: round1(s.food),
    battery: round1(s.battery),
    health: round1(s.health),
    morale: round1(s.morale),
    dose: Math.round(s.dose * 100) / 100,
    shield: round1(s.shield),
    science: round1(s.science),
    maturity: Math.round(s.maturity * 100) / 100,
  };
}

// ---------- Scoring ----------

export const LOSS_TEXT = {
  oxygen: 'The oxygen ran out.',
  water: 'The water ran out.',
  health: "The crew's health hit zero.",
  dose: 'The crew passed the mission radiation limit and had to be evacuated.',
  battery: 'The battery was dead two sols in a row and the base shut down.',
};

export function starCriteria(state) {
  return [
    { id: 'health', label: 'Crew health 70+', ok: state.health >= 70 },
    { id: 'dose', label: `Radiation dose ≤ ${G.doseLimitMsv * 0.7} mSv (70% of the limit)`, ok: state.dose <= G.doseLimitMsv * 0.7 },
    { id: 'food', label: `Food left for 3+ ${WORLDS[state.worldId].turnLabel.toLowerCase()}s`, ok: foodSols(state.food) >= 3 },
    { id: 'science', label: `Science ${G.science.starTarget}+ points`, ok: state.science >= G.science.starTarget },
  ];
}

export function stars(state) {
  if (state.status !== 'won') return 0;
  const met = starCriteria(state).filter((c) => c.ok).length;
  return 1 + (met >= 2 ? 1 : 0) + (met >= 3 ? 1 : 0);
}

// One number that says how well a mission went, used by the debrief and the balance script.
export function outcomeScore(state) {
  if (state.status === 'won') return 1000 + stars(state) * 150 + state.health + Math.min(state.science, 150) / 3;
  return state.history.length * 25 + state.health / 2;
}

// Replay a list of choices from a fresh start (same seed = same events).
export function replay(worldId, seed, choicesList) {
  let s = createGame(worldId, seed);
  for (const ch of choicesList) {
    if (s.status !== 'playing') break;
    s = nextSol(s, ch).state;
  }
  return s;
}
