// Difficulty levels. Each one is a small set of multipliers the engine applies.
// "Live NASA" starts from Astronaut and scales it with what the real Sun and Mars are doing right now:
//   · NASA DONKI, last 30 days: solar flares (X- and M-class), solar energetic particle storms (SEP),
//     and fast coronal mass ejections (CMEs ≥ 1,000 km/s)
//   · NASA Mars24 solar longitude (Ls): Mars dust-storm season is Ls 180°–330°, when Mars is nearest the Sun.
// Everything here is pure, so a saved game replays exactly: the final settings are stored in the game state.

export const LEVELS = {
  cadet: {
    id: 'cadet',
    name: 'Cadet',
    emoji: '🧒',
    blurb: 'Fewer surprises, softer particle storms, an extra spare part and fuller tanks. Great for a first mission.',
    eventRate: 0.2,
    extraFlares: 0,
    flareDoseMult: 0.75,
    startFactor: 1.15,
    spares: 2,
    dustDurationBonus: 0,
    dustSolarFactor: null,
  },
  astronaut: {
    id: 'astronaut',
    name: 'Astronaut',
    emoji: '🧑‍🚀',
    blurb: 'The standard mission, balanced so a careful crew almost always makes it home.',
    eventRate: 0.3,
    extraFlares: 0,
    flareDoseMult: 1,
    startFactor: 1,
    spares: 1,
    dustDurationBonus: 0,
    dustSolarFactor: null,
  },
  commander: {
    id: 'commander',
    name: 'Commander',
    emoji: '🎖',
    blurb: 'More events, a second particle storm, stronger flares, longer dust storms, no spare part and less in the tanks.',
    eventRate: 0.4,
    extraFlares: 1,
    flareDoseMult: 1.3,
    startFactor: 0.9,
    spares: 0,
    dustDurationBonus: 1,
    dustSolarFactor: 0.3,
  },
};

export const LIVE = {
  id: 'live',
  name: 'Live NASA',
  emoji: '📡',
  blurb: "Difficulty follows the real Sun over the last 30 days (NASA DONKI) and today's Mars dust season (NASA Mars24).",
};

export const DEFAULT_LEVEL = 'astronaut';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const round2 = (x) => Math.round(x * 100) / 100;

// Mars dust-storm season: global storms (2001, 2007, 2018) all started between Ls ~185° and ~260°.
export function dustSeason(ls) {
  if (ls == null || Number.isNaN(ls)) return { active: false, peak: false };
  return { active: ls >= 180 && ls <= 330, peak: ls >= 200 && ls <= 280 };
}

// Score the real Sun from DONKI counts: 0 = very quiet, ~1 = busy, 2+ = stormy.
export function solarActivity({ xFlares = 0, mFlares = 0, seps = 0, fastCmes = 0 } = {}) {
  return round2(xFlares * 0.35 + mFlares * 0.03 + seps * 0.5 + fastCmes * 0.12);
}

// What the real Sun did → how hard the Sun is in this mission.
function applySun(d, live, a) {
  const x = live.xFlares || 0;
  const m = live.mFlares || 0;
  const sep = live.seps || 0;
  const cme = live.fastCmes || 0;
  // Real particle storms → more particle storms in your mission.
  d.extraFlares = clamp(sep + Math.floor(x / 2), 0, 3);
  // Big X-class flares → each storm hits harder.
  d.flareDoseMult = round2(clamp(1 + x * 0.12 + m * 0.01, 0.8, 1.8));
  // Fast CMEs and flare activity → a busier event schedule.
  d.eventRate = round2(clamp(0.24 + a * 0.06, 0.22, 0.42));
  if (a < 0.3) {
    d.flareDoseMult = Math.min(d.flareDoseMult, 0.85);
    d.reasons.push('The Sun has been quiet this month, so particle storms are weaker.');
  }
  if (x) d.reasons.push(`${x} X-class flare${x > 1 ? 's' : ''} in 30 days: particle storms hit ${Math.round((d.flareDoseMult - 1) * 100)}% harder.`);
  else if (m) d.reasons.push(`${m} M-class flare${m > 1 ? 's' : ''} in 30 days.`);
  if (d.extraFlares) d.reasons.push(`${sep} real particle storm${sep === 1 ? '' : 's'} in 30 days: +${d.extraFlares} particle storm${d.extraFlares > 1 ? 's' : ''} in your mission.`);
  if (cme) d.reasons.push(`${cme} fast CME${cme > 1 ? 's' : ''} (≥ 1,000 km/s): more events overall.`);
  if (a >= 1.5) {
    d.startFactor = 0.95;
    d.reasons.push('A very stormy Sun: the supply ship launched lighter (−5% starting supplies).');
  }
}

// Build the final settings for a new game.
// live: { xFlares, mFlares, seps, fastCmes, ls, fetchedAt, offline? } or null.
export function resolveDifficulty(levelId, worldId, live = null) {
  if (levelId !== 'live') {
    const base = LEVELS[levelId] || LEVELS[DEFAULT_LEVEL];
    return { ...base, level: base.id, reasons: [] };
  }
  const d = { ...LEVELS.astronaut, id: 'live', level: 'live', name: LIVE.name, emoji: LIVE.emoji, blurb: LIVE.blurb, reasons: [] };
  const info = live || {};
  const solarKnown = !!live && !live.offline;
  if (solarKnown) {
    d.activity = solarActivity(info);
    applySun(d, info, d.activity);
  } else {
    d.offline = true;
    d.reasons.push('NASA DONKI could not be reached, so the Sun uses Astronaut settings.');
  }
  d.live = {
    xFlares: info.xFlares || 0,
    mFlares: info.mFlares || 0,
    seps: info.seps || 0,
    fastCmes: info.fastCmes || 0,
    ls: info.ls ?? null,
    fetchedAt: info.fetchedAt || null,
  };

  if (worldId === 'mars' && info.ls != null) {
    const season = dustSeason(info.ls);
    const ls = Math.round(info.ls);
    if (season.peak) {
      d.dustDurationBonus = 2;
      d.dustSolarFactor = 0.25;
      d.reasons.push(`Mars is at Ls ${ls}°, the peak of dust-storm season: storms last longer and block 75% of sunlight.`);
    } else if (season.active) {
      d.dustDurationBonus = 1;
      d.dustSolarFactor = 0.3;
      d.reasons.push(`Mars is at Ls ${ls}°, inside dust-storm season (Ls 180°–330°): longer, darker storms.`);
    } else {
      d.reasons.push(`Mars is at Ls ${ls}°, outside dust-storm season: normal dust storms.`);
    }
  }
  if (solarKnown && d.reasons.length === 0) d.reasons.push('The Sun has been average this month: standard Astronaut settings.');
  return d;
}

// Rough label for the UI.
export function activityLabel(a) {
  if (a == null) return 'unknown';
  if (a < 0.3) return 'quiet';
  if (a < 1) return 'moderate';
  if (a < 2) return 'active';
  return 'stormy';
}
