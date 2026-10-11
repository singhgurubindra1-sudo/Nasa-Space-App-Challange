// Classroom mode without a server. The teacher shares a class code (world + seed), so
// every student plays the same mission with the same events. At the end each student gets
// a short result code to hand in, and the teacher pastes them into the class board.
// Crockford base 32: no I, L, O or U, so a code on the board can't be misread.
const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const PREFIX = { moon: 'MOON', mars: 'MARS' };
export const MAX_CLASS_SEED = 32 ** 6; // 6 digits

const check = (body) => ALPHA[[...body].reduce((t, ch, i) => t + ALPHA.indexOf(ch) * (i + 1), 0) % 32];

export const newClassSeed = () => Math.floor(Math.random() * MAX_CLASS_SEED);

// MARS-1A2B3CK: world, 6 base-32 seed digits, 1 check character (catches typos).
export function makeClassCode(worldId, seed) {
  let n = seed % MAX_CLASS_SEED;
  let body = '';
  for (let i = 0; i < 6; i++) {
    body = ALPHA[n % 32] + body;
    n = Math.floor(n / 32);
  }
  return `${PREFIX[worldId]}-${body}${check(body)}`;
}

export function parseClassCode(text) {
  const clean = String(text || '').toUpperCase().replace(/\s+/g, '');
  const m = clean.match(/^(MOON|MARS)-?([0-9A-Z]{7})$/);
  if (!m) return null;
  // Look-alikes typed by mistake still work.
  const chars = m[2].replace(/O/g, '0').replace(/[IL]/g, '1');
  if ([...chars].some((ch) => !ALPHA.includes(ch))) return null;
  const body = chars.slice(0, 6);
  if (check(body) !== chars[6]) return null;
  const seed = [...body].reduce((t, ch) => t * 32 + ALPHA.indexOf(ch), 0);
  return { worldId: m[1].toLowerCase(), seed, code: `${m[1]}-${chars}` };
}

// Student result: a compact, copy-pasteable code. Not secret and not tamper-proof (it's a classroom game).
const toB64 = (str) => btoa(String.fromCharCode(...new TextEncoder().encode(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/-/g, '+').replace(/_/g, '/')), (ch) => ch.charCodeAt(0)));

export function makeResultCode({ name, classCode, state, stars, turningSol }) {
  const r = {
    n: String(name || 'Student').slice(0, 30),
    c: classCode,
    w: state.status === 'won' ? 1 : 0,
    d: state.history.length,
    s: stars || 0,
    h: Math.round(state.health),
    r: Math.round(state.dose * 10) / 10,
    x: Math.round(state.science),
    l: state.lossReason || '',
    t: turningSol || 0,
  };
  return `S30-${toB64(JSON.stringify(r))}`;
}

export function parseResultCode(text) {
  const m = String(text || '').trim().match(/^S30-([A-Za-z0-9_-]+)$/);
  if (!m) return null;
  try {
    const r = JSON.parse(fromB64(m[1]));
    if (typeof r.n !== 'string' || typeof r.d !== 'number') return null;
    return {
      name: r.n, classCode: r.c, won: !!r.w, sols: r.d, stars: r.s, health: r.h,
      dose: r.r, science: r.x, lossReason: r.l || null, turningSol: r.t || null,
    };
  } catch {
    return null;
  }
}

// Class summary for the teacher board.
export function summarize(results) {
  const n = results.length;
  if (!n) return null;
  const won = results.filter((r) => r.won).length;
  const count = (key) => {
    const m = {};
    for (const r of results) if (r[key]) m[r[key]] = (m[r[key]] || 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1])[0] || null;
  };
  return {
    n,
    won,
    survivalRate: Math.round((won / n) * 100),
    avgSols: Math.round((results.reduce((t, r) => t + r.sols, 0) / n) * 10) / 10,
    topLoss: count('lossReason'),
    topTurning: count('turningSol'),
  };
}

export function rankResults(results) {
  return [...results].sort((a, b) => b.won - a.won || b.stars - a.stars || b.sols - a.sols || b.health - a.health || a.dose - b.dose);
}
