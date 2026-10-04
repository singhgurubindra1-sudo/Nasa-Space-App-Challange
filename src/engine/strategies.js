// Ready-made power plans. Used by the "turning point" finder (what if you had done X?)
// and by the balance script that plays 1,000 random games.
import { conditions, forecastFor, G, foodSols } from './engine.js';

const fit = (alloc, available) => {
  // Keep a little in the battery, then trim the least important systems first.
  const order = ['science', 'shielding', 'greenhouse', 'lifeSupport'];
  let total = Object.values(alloc).reduce((a, b) => a + b, 0);
  for (const k of order) {
    if (total <= available) break;
    const cut = Math.min(alloc[k], total - available);
    alloc[k] -= cut;
    total -= cut;
  }
  return alloc;
};

const lsFor = (c) => Math.min(G.sliderMax.lifeSupport, c.lsPowerNeeded);

export const PRESETS = {
  balanced: {
    label: 'a balanced plan (life support, greenhouse, shielding and a charged battery)',
    alloc: (st, c) => fit({ lifeSupport: lsFor(c), greenhouse: 8, shielding: 6, science: 4 }, c.generation + Math.max(0, st.battery - 15)),
  },
  saver: {
    label: 'saving power in the battery',
    alloc: (st, c) => fit({ lifeSupport: lsFor(c), greenhouse: 5, shielding: 0, science: 0 }, c.generation + Math.max(0, st.battery - 20)),
  },
  shield: {
    label: 'putting power into shielding',
    alloc: (st, c) => fit({ lifeSupport: lsFor(c), greenhouse: 5, shielding: G.sliderMax.shielding, science: 0 }, c.generation + Math.max(0, st.battery - 10)),
  },
  grow: {
    label: 'putting power into the greenhouse',
    alloc: (st, c) => fit({ lifeSupport: lsFor(c), greenhouse: G.sliderMax.greenhouse, shielding: 2, science: 2 }, c.generation + Math.max(0, st.battery - 10)),
  },
  workshop: {
    label: 'running the science & repair workshop',
    alloc: (st, c) => fit({ lifeSupport: lsFor(c), greenhouse: 5, shielding: 0, science: 8 }, c.generation + Math.max(0, st.battery - 10)),
  },
};

export function presetChoice(name, state, action) {
  const c = conditions(state);
  return { alloc: PRESETS[name].alloc(state, c), action };
}

// A sensible player: reads the forecast and reacts.
export function smartPolicy(state) {
  const c = conditions(state);
  const fc = forecastFor(state) || '';
  let action = 'plant';
  if (state.broken || state.leak) action = 'repair';
  else if (/particle storm|Shelter/i.test(fc)) action = 'shelter';
  else if (state.maturity < 0.6) action = 'plant';
  else if (state.shield < 60 && state.worldId === 'moon') action = 'build';
  else action = 'explore';
  let preset = 'balanced';
  if (/storm|shadow|cold/i.test(fc) && !/particle/i.test(fc)) preset = 'saver';
  if (state.battery < 15) preset = 'saver';
  if ((state.broken || state.leak) && state.spares === 0) preset = 'workshop';
  const alloc = PRESETS[preset].alloc(state, c);
  if (foodSols(state.food) < 4) alloc.greenhouse = Math.max(alloc.greenhouse, 10);
  return { alloc, action };
}

// A first-time student: tries things, half-reads the forecast, sometimes overspends.
export function studentPolicy(rng) {
  return (state) => {
    const c = conditions(state);
    const fc = forecastFor(state) || '';
    const readsForecast = rng() < 0.4;
    const r = () => rng();
    const alloc = {
      lifeSupport: Math.round(c.lsNeed * (0.85 + r() * 0.35)),
      greenhouse: Math.round(r() * G.sliderMax.greenhouse),
      shielding: Math.round(r() * G.sliderMax.shielding),
      science: Math.round(r() * G.sliderMax.science),
    };
    const careful = rng() < 0.55;
    if (careful) {
      // Keep spending within today's generation.
      let total = Object.values(alloc).reduce((a, b) => a + b, 0);
      for (const k of ['science', 'shielding', 'greenhouse']) {
        if (total <= c.generation) break;
        const cut = Math.min(alloc[k], total - c.generation);
        alloc[k] -= cut;
        total -= cut;
      }
    }
    let action = ['build', 'plant', 'explore', 'repair', 'shelter'][Math.floor(r() * 5)];
    if ((state.broken || state.leak) && rng() < 0.6) action = 'repair';
    if (readsForecast && /particle storm/i.test(fc)) action = 'shelter';
    if (readsForecast && /storm|shadow|cold/i.test(fc) && !/particle/i.test(fc)) {
      alloc.shielding = 0;
      alloc.science = 0;
    }
    return { alloc, action };
  };
}
