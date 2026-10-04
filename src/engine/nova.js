// Nova, the AI CAPCOM. Pre-written lines (no live AI calls) so the demo can never fail.
import { conditions, forecastFor, foodSols, NEEDS, WORLDS, G } from './engine.js';

export function briefing(state) {
  const world = WORLDS[state.worldId];
  const c = conditions(state);
  const T = world.turnLabel;
  const lines = [];

  if (state.sol === 1) {
    lines.push(`Welcome to ${world.place}, Commander. This is Nova, your CAPCOM.`);
    lines.push(`Your job: keep 4 crew alive for 30 ${T.toLowerCase()}s. Every ${T.toLowerCase()} you split the power and pick one action.`);
    lines.push(world.id === 'moon'
      ? 'Tip: the Moon has no air, so radiation is high. Shielding pays off. Watch for shadows that cut our solar power.'
      : 'Tip: we run on sunlight only. Keep the battery charged and watch the dust forecast.');
  } else {
    lines.push(`${T} ${state.sol}, Commander.`);
  }

  // Status: the most worrying thing first.
  const worries = [];
  if (state.broken) worries.push({ p: 0, t: 'Life support is broken and runs at half power. Choose Repair today!' });
  if (state.leak) worries.push({ p: 0, t: 'We are leaking oxygen. Choose Repair today!' });
  if ((state.broken || state.leak) && state.spares === 0) worries.push({ p: 0, t: 'No spare parts left: put at least 6 kWh into Science & repair so the workshop can print one.' });
  if (state.batteryDeadStreak > 0) worries.push({ p: 0, t: 'The battery is EMPTY. If it is empty again tonight, the base shuts down. Leave power unspent to charge it!' });
  if (state.o2 < 6) worries.push({ p: 1, t: `Oxygen is low: ${state.o2.toFixed(1)} kg. Give life support at least ${c.lsPowerNeeded} kWh.` });
  if (foodSols(state.food) < 4) worries.push({ p: 1, t: `Only ${foodSols(state.food).toFixed(1)} ${T.toLowerCase()}s of food left. The greenhouse needs power.` });
  if (state.dose > G.doseLimitMsv * 0.7) worries.push({ p: 1, t: `Radiation dose is ${state.dose.toFixed(1)} of ${G.doseLimitMsv} mSv. More shielding, fewer trips outside.` });
  if (state.health < 50) worries.push({ p: 1, t: 'The crew is not well. Full life support and food will help them recover.' });
  if (state.morale < 35) worries.push({ p: 2, t: 'Crew morale is low. Fresh greenhouse food and science work cheer people up.' });
  if (state.battery < 15 && state.batteryDeadStreak === 0) worries.push({ p: 2, t: `Battery is only at ${Math.round(state.battery)} kWh. A small margin.` });
  const active = state.active.map((a) => a.id);
  if (active.includes('dust_storm')) worries.push({ p: 1, t: `The dust storm is still blocking the Sun. Solar is down to ${c.solar} kWh.` });
  if (active.includes('lunar_shadow')) worries.push({ p: 1, t: 'We are in shadow. No solar power: the reactor and battery are all we have.' });
  if (active.includes('cold_snap')) worries.push({ p: 1, t: `It is very cold. Life support needs ${c.lsNeed} kWh today.` });
  worries.sort((a, b) => a.p - b.p);
  if (state.sol > 1) {
    if (worries.length) lines.push(...worries.slice(0, 2).map((w) => w.t));
    else lines.push(pickCalm(state));
  }

  const fc = forecastFor(state);
  lines.push(fc ? `Forecast: ${fc}` : 'Forecast: nothing unusual expected. Good day to get ahead.');
  return lines;
}

function pickCalm(state) {
  const options = [
    'All systems nominal. The crew sends their thanks.',
    'Everything looks good. Margins are healthy.',
    'Quiet night. The crew slept well.',
    state.maturity > 0.5 ? 'The greenhouse is green and growing. Fresh salad tonight!' : 'The seedlings are coming up. Keep the greenhouse powered.',
    state.shield > 50 ? 'The regolith cover is getting thick. Good work.' : 'More regolith on the roof would cut our radiation dose.',
  ];
  return options[state.sol % options.length];
}

export function needsSummary() {
  return `4 crew need ${NEEDS.o2.toFixed(2)} kg oxygen, ${NEEDS.water.toFixed(0)} kg water and ${NEEDS.food.toFixed(1)} kg food every day.`;
}
