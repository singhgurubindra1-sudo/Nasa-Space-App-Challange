// Junior Astronaut training academy: short modules that teach one skill at a time,
// then a full 30-sol final exam. Each module is a normal mission with a `setup`
// (see createGame) plus objectives checked at the end.
import { G, WORLDS, NEEDS } from './engine.js';

const allHistory = (state, test) => state.history.length > 0 && state.history.every(test);

export const MODULES = [
  {
    id: 'm1',
    num: 1,
    icon: '⚡',
    title: 'Power basics',
    skill: 'Split the power budget and keep a battery margin',
    worldId: 'mars',
    setup: {
      sols: 5,
      events: [],
      actions: ['explore', 'repair'],
      batteryStartKwh: 10,
      novaTip: 'Training module 1: our battery is almost empty (10 kWh). Feed life support first, earn some science, and leave power unspent so the battery charges.',
    },
    brief: 'Mars, 5 sols, no surprises. The battery starts nearly empty. Charge it up and still get science done.',
    objectives: [
      { id: 'survive', label: 'Keep the crew alive for 5 sols', check: (s) => s.status === 'won' },
      { id: 'battery', label: 'Finish with 50+ kWh in the battery (a safe margin)', check: (s) => s.battery >= 50 },
      { id: 'science', label: 'Earn 25+ science points', check: (s) => s.science >= 25 },
    ],
    quiz: [
      {
        q: 'What happens to power you do not spend today?',
        options: ['It charges the battery for later', 'It is lost forever', 'It turns into oxygen'],
        answer: 0,
        why: 'Unspent power charges the battery (90% of it is stored). A full battery is your backup for bad days.',
      },
      {
        q: 'Why does the Mars base need such a big solar array?',
        options: ['Mars has no night', 'Mars gets only about 43% of the sunlight Earth gets', 'Mars is closer to the Sun'],
        answer: 1,
        why: 'Mars is about 1.5 times farther from the Sun, so sunlight there is 586 W/m² instead of 1,361 W/m² (NASA Mars Fact Sheet).',
      },
    ],
  },
  {
    id: 'm2',
    num: 2,
    icon: '🌱',
    title: 'Food and the greenhouse',
    skill: 'Grow food before the packaged food runs out',
    worldId: 'mars',
    setup: {
      sols: 10,
      events: [],
      systems: ['lifeSupport', 'greenhouse'],
      actions: ['plant', 'explore', 'repair'],
      foodStartKg: 50,
      novaTip: 'Training module 2: we only have 50 kg of packaged food, about 7 sols. Power the greenhouse early: plants need time to grow.',
    },
    brief: 'Mars, 10 sols. Only 7 sols of packaged food on board. Grow the rest.',
    objectives: [
      { id: 'survive', label: 'Keep the crew alive for 10 sols', check: (s) => s.status === 'won' },
      { id: 'fed', label: 'The crew never goes hungry', check: (s) => allHistory(s, (h) => !h.hungry) },
    ],
    quiz: [
      {
        q: 'About how much packaged food does one astronaut eat per day (NASA BVAD)?',
        options: ['0.2 kg', '1.8 kg', '10 kg'],
        answer: 1,
        why: `NASA's Baseline Values and Assumptions Document lists about 1.8 kg per person per day, so a crew of 4 needs ${NEEDS.food.toFixed(1)} kg.`,
      },
      {
        q: 'Where was the first lettuce eaten in space grown?',
        options: ["In NASA's Veggie unit on the ISS", 'In the Apollo 11 lunar module', 'On the Perseverance rover'],
        answer: 0,
        why: "In August 2015 ISS astronauts ate red romaine lettuce grown in NASA's Veggie plant growth system.",
      },
    ],
  },
  {
    id: 'm3',
    num: 3,
    icon: '☢',
    title: 'Radiation and shelter',
    skill: 'Read the forecast, shield the hab and shelter from storms',
    worldId: 'moon',
    setup: {
      sols: 8,
      events: [{ sol: 5, id: 'solar_flare' }],
      systems: ['lifeSupport', 'greenhouse', 'shielding'],
      actions: ['build', 'shelter', 'plant'],
      novaTip: 'Training module 3: the Moon has no air to stop radiation. Build shielding, and listen for my storm warnings.',
    },
    brief: 'Moon, 8 days. A solar particle storm is coming. Keep the radiation dose low.',
    objectives: [
      { id: 'survive', label: 'Keep the crew alive for 8 days', check: (s) => s.status === 'won' },
      { id: 'dose', label: 'Keep the total dose at 15 mSv or less', check: (s) => s.dose <= 15 },
    ],
    quiz: [
      {
        q: 'Nova warns that a solar particle storm arrives today. What is the best move?',
        options: ['Go exploring before it arrives', 'Shelter behind water, supplies and regolith', 'Switch off life support to save power'],
        answer: 1,
        why: 'Solar protons are fairly easy to block. Astronauts plan to hide in the best-shielded part of the hab until the storm passes.',
      },
      {
        q: 'Why is the radiation dose higher on the Moon than on Mars?',
        options: ['The Moon is closer to the Sun', 'The Moon is hotter', 'The Moon has no air, while Mars has a thin atmosphere that helps a little'],
        answer: 2,
        why: "Chang'e-4 measured about 1.37 mSv/day on the Moon; Curiosity measured about 0.67 mSv/day on Mars.",
      },
    ],
  },
  {
    id: 'm4',
    num: 4,
    icon: '🔧',
    title: 'Repairs and spare parts',
    skill: 'Fix failures fast and keep the workshop ready',
    worldId: 'mars',
    setup: {
      sols: 10,
      events: [{ sol: 3, id: 'part_failure' }, { sol: 7, id: 'part_failure' }],
      novaTip: 'Training module 4: we carry only one spare part. If things break twice, the workshop (6+ kWh in Science & repair) must print another.',
    },
    brief: 'Mars, 10 sols, all systems on. Life support will break. Twice. You have one spare.',
    objectives: [
      { id: 'survive', label: 'Keep the crew alive for 10 sols', check: (s) => s.status === 'won' },
      { id: 'fixed', label: 'Life support is working at the end', check: (s) => !s.broken && !s.leak },
      { id: 'health', label: 'Crew health 70 or more', check: (s) => s.health >= 70 },
    ],
    quiz: [
      {
        q: 'Life support breaks and you have no spare parts. How can you still fix it in this game?',
        options: ['Give Science & repair 6+ kWh so the workshop prints a part, then Repair', 'Wait: it fixes itself', 'Choose Explore'],
        answer: 0,
        why: 'Bases far from Earth plan to make parts on site. NASA has tested 3D printing on the ISS for exactly this reason.',
      },
      {
        q: 'Why do Moon and Mars bases need more spare parts than the ISS?',
        options: ['Parts wear out faster there', 'A new part from Earth takes days (Moon) or months (Mars) to arrive', 'Astronauts there are clumsier'],
        answer: 1,
        why: 'The ISS gets cargo every few months and is hours from Earth. Mars help is 6 to 9 months away.',
      },
    ],
  },
  {
    id: 'm5',
    num: 5,
    icon: '🌪',
    title: 'Power crisis',
    skill: 'Prepare for a dust storm before it hits',
    worldId: 'mars',
    setup: {
      sols: 12,
      events: [{ sol: 4, id: 'dust_storm', duration: 5 }, { sol: 10, id: 'cold_snap', duration: 2 }],
      novaTip: 'Training module 5: dust is building over Jezero. A full battery is our only backup. Cut what we can live without when the storm comes.',
    },
    brief: 'Mars, 12 sols. A 5-sol dust storm, then a cold snap. Never let the battery die.',
    objectives: [
      { id: 'survive', label: 'Keep the crew alive for 12 sols', check: (s) => s.status === 'won' },
      { id: 'battery', label: 'The battery never runs empty', check: (s) => allHistory(s, (h) => h.battery >= 3) },
    ],
    quiz: [
      {
        q: 'Nova forecasts a dust storm tomorrow. What should you do today?',
        options: ['Spend everything on science while the Sun shines', 'Charge the battery and plan to cut non-essential systems', 'Nothing: storms never last long'],
        answer: 1,
        why: 'Engineers call this margin: stored energy that carries you through days with little sunlight.',
      },
      {
        q: 'Which NASA rover went silent after the 2018 planet-wide dust storm?',
        options: ['Curiosity', 'Perseverance', 'Opportunity'],
        answer: 2,
        why: "Opportunity's solar panels could not make enough power. NASA ended the mission in February 2019 after almost 15 years.",
      },
    ],
  },
];

export const FINAL = {
  id: 'final',
  num: 6,
  icon: '🎓',
  title: 'Final exam: Full 30-sol mission',
  skill: 'Put every skill together with random events',
  brief: 'Moon or Mars, 30 sols, every system and every kind of event. Survive to earn the rank of Commander.',
  objectives: [
    { id: 'survive', label: `Keep the crew alive for ${G.sols} sols`, check: (s) => s.status === 'won' },
  ],
  quiz: [
    {
      q: 'In a base, which resource does every other system depend on?',
      options: ['Science points', 'Power', 'Morale'],
      answer: 1,
      why: 'Oxygen, water recycling, heat and food all run on electricity. Power is the master resource.',
    },
    {
      q: "This game's mission dose limit (50 mSv) is 1/12 of NASA's career limit. What is the career limit?",
      options: ['60 mSv', '600 mSv', '6,000 mSv'],
      answer: 1,
      why: 'NASA-STD-3001 sets a 600 mSv career effective dose limit for astronauts.',
    },
  ],
};

export const ALL_MODULES = [...MODULES, FINAL];
export const moduleById = (id) => ALL_MODULES.find((m) => m.id === id);

// The setup passed to createGame for a module.
export function moduleSetup(mod) {
  if (mod.id === 'final') return { module: 'final' };
  return { ...mod.setup, module: mod.id };
}
export function moduleWorld(mod, chosen) {
  return mod.worldId || chosen || 'mars';
}

export function checkObjectives(mod, state) {
  return mod.objectives.map((o) => ({ id: o.id, label: o.label, ok: !!o.check(state) }));
}
export function modulePassed(mod, state) {
  return checkObjectives(mod, state).every((o) => o.ok);
}

// ---------- Ranks ----------

export const RANKS = [
  { id: 'cadet', name: 'Cadet', icon: '🧒', needs: [], text: 'Starting training.' },
  { id: 'junior', name: 'Junior Astronaut', icon: '🧑‍🚀', needs: ['m1', 'm2', 'm3'], text: 'Knows power, food and radiation.' },
  { id: 'specialist', name: 'Mission Specialist', icon: '🛠', needs: ['m1', 'm2', 'm3', 'm4', 'm5'], text: 'Can handle failures and power crises.' },
  { id: 'commander', name: 'Commander', icon: '🎖', needs: ['m1', 'm2', 'm3', 'm4', 'm5', 'final'], text: 'Kept a crew alive for a full 30-sol mission.' },
];

export function rankFor(progress) {
  const passed = progress.passed || {};
  let rank = RANKS[0];
  for (const r of RANKS) if (r.needs.every((id) => passed[id])) rank = r;
  return rank;
}
export function nextRank(progress) {
  const i = RANKS.indexOf(rankFor(progress));
  return RANKS[i + 1] || null;
}

export function isUnlocked(progress, mod) {
  if (progress.unlockAll) return true;
  const i = ALL_MODULES.indexOf(mod);
  return i === 0 || !!(progress.passed || {})[ALL_MODULES[i - 1].id];
}
export function nextModule(progress) {
  const passed = progress.passed || {};
  return ALL_MODULES.find((m) => !passed[m.id]) || null;
}

// Record a finished module. Pure: returns new progress.
export function recordResult(progress, mod, state, starCount) {
  if (!modulePassed(mod, state)) return progress;
  const prev = (progress.passed || {})[mod.id];
  const entry = {
    date: prev ? prev.date : new Date().toISOString().slice(0, 10),
    worldId: state.worldId,
    health: Math.round(state.health),
    stars: Math.max(starCount || 0, prev ? prev.stars || 0 : 0),
  };
  return { ...progress, passed: { ...(progress.passed || {}), [mod.id]: entry } };
}
export function recordQuiz(progress, modId, score) {
  const quiz = progress.quiz || {};
  return { ...progress, quiz: { ...quiz, [modId]: Math.max(score, quiz[modId] || 0) } };
}

export const worldName = (id) => (id === 'moon' ? 'the Moon' : WORLDS[id].name);
