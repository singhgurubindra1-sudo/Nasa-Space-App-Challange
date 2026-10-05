// Crew tasks: the Commander (you) assigns a task to a Junior Astronaut; when they finish it,
// its effect is applied to the game. Each Junior can finish one task per sol, so the bonus
// is a small, fair reward for managing your crew well (not something you can farm).
import crew from '../data/crew.json' with { type: 'json' };
import { G } from './engine.js';

export const JUNIORS = crew.juniors;
export const CREW_TASKS = crew.tasks;
export const COMMANDER = crew.commander;
export const taskById = (id) => CREW_TASKS.find((t) => t.id === id);
export const juniorById = (id) => JUNIORS.find((j) => j.id === id);

export function tasksFor(worldId) {
  return CREW_TASKS.filter((t) => !t.world || t.world === worldId);
}

export function isSpecialist(juniorId, taskId) {
  const j = juniorById(juniorId);
  return !!(j && j.specialty.includes(taskId));
}

// Per-sol bookkeeping (resets automatically when the sol changes).
export function daily(state) {
  const d = state.daily;
  if (d && d.sol === state.sol) return d;
  return { sol: state.sol, crew: {}, meal: false, analyzed: 0 };
}

export function canAssign(state, juniorId) {
  return state.status === 'playing' && !daily(state).crew[juniorId];
}

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const round1 = (x) => Math.round(x * 10) / 10;

// Apply a finished task. Returns { state, text } (state unchanged if not allowed).
export function applyCrewTask(state, juniorId, taskId) {
  const task = taskById(taskId);
  const j = juniorById(juniorId);
  if (!task || !j) return { state, text: 'Unknown task.' };
  if (!canAssign(state, juniorId)) return { state, text: `${j.name} has already finished a task this sol.` };
  const k = isSpecialist(juniorId, taskId) ? 1.5 : 1;
  const e = task.effect;
  const s = { ...state };
  const parts = [];
  if (e.maturity) {
    const before = s.maturity;
    s.maturity = clamp(s.maturity + e.maturity * k, 0, 1);
    parts.push(`+${Math.round((s.maturity - before) * 100)}% greenhouse growth`);
  }
  if (e.shield) {
    const before = s.shield;
    s.shield = clamp(s.shield + e.shield * k, 0, 100);
    parts.push(`+${round1(s.shield - before)}% shielding`);
  }
  if (e.battery) {
    const before = s.battery;
    s.battery = clamp(s.battery + e.battery * k, 0, G.batteryCapacityKwh);
    parts.push(`+${round1(s.battery - before)} kWh battery`);
  }
  if (e.science) {
    s.science = s.science + Math.round(e.science * k);
    parts.push(`+${Math.round(e.science * k)} science`);
  }
  if (e.morale) {
    s.morale = clamp(s.morale + e.morale * k, 0, 100);
    parts.push(`+${round1(e.morale * k)} morale`);
  }
  if (e.health) {
    s.health = clamp(s.health + e.health * k, 0, 100);
    parts.push(`+${round1(e.health * k)} health`);
  }
  if (e.repair) {
    if (s.broken || s.leak) {
      if (s.spares > 0) {
        s.spares -= 1;
        s.broken = false;
        s.leak = false;
        parts.push('life support fixed (used 1 spare part)');
      } else {
        parts.push('could not fix it: no spare parts left. Use the Repair action with 6+ kWh in Science & repair so the workshop can print one');
      }
    } else {
      s.morale = clamp(s.morale + 2, 0, 100);
      parts.push('nothing broken: preventive maintenance, +2 morale');
    }
  }
  const d = daily(state);
  s.daily = { ...d, crew: { ...d.crew, [juniorId]: taskId } };
  return { state: s, text: `${j.name}: ${task.done} (${parts.join(', ')})${k > 1 ? ' ★ specialist bonus' : ''}` };
}

export function shareMeal(state) {
  const d = daily(state);
  if (d.meal) return { state, text: 'The crew already ate together this sol.' };
  return {
    state: { ...state, morale: clamp(state.morale + COMMANDER.meal.morale, 0, 100), daily: { ...d, meal: true } },
    text: `${COMMANDER.meal.text} (+${COMMANDER.meal.morale} morale)`,
  };
}

// Turn rocks scanned on EVA into science points at the lab bench.
export function analyzeSamples(state, count) {
  const d = daily(state);
  const n = Math.max(0, Math.min(count, 5 - d.analyzed));
  if (n === 0) return { state, text: count > 0 ? 'The lab can process 5 samples per sol. Try again tomorrow.' : 'No new samples. Scan rocks outside with your sample scanner first.' };
  const pts = n * COMMANDER.samplePoints;
  return {
    state: { ...state, science: state.science + pts, daily: { ...d, analyzed: d.analyzed + n } },
    text: `Analysed ${n} sample${n > 1 ? 's' : ''} in the lab: +${pts} science.`,
    used: n,
  };
}
