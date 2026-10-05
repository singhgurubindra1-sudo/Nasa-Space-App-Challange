// Bakes seamless PBR surface textures (albedo, normal, roughness) for the 3D views.
// Run: npm run textures   (needs the dev dependency "sharp")
// Everything is procedural (tileable noise), so there are no third-party image licences.
import sharp from 'sharp';
import fs from 'node:fs';

const OUT = new URL('../public/textures/surface/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const S = 1024;

// ---------- tileable noise ----------
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gradNoise(seed, period) {
  const r = rng(seed);
  const g = new Float32Array(period * period * 2);
  for (let i = 0; i < period * period; i++) {
    const a = r() * Math.PI * 2;
    g[i * 2] = Math.cos(a);
    g[i * 2 + 1] = Math.sin(a);
  }
  const dot = (ix, iy, x, y) => {
    const k = ((((iy % period) + period) % period) * period + (((ix % period) + period) % period)) * 2;
    return g[k] * (x - ix) + g[k + 1] * (y - iy);
  };
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  return (x, y) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const u = fade(x - x0);
    const v = fade(y - y0);
    const a = dot(x0, y0, x, y);
    const b = dot(x0 + 1, y0, x, y);
    const c = dot(x0, y0 + 1, x, y);
    const d = dot(x0 + 1, y0 + 1, x, y);
    return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 1.4;
  };
}
// fBm over [0,1)^2, tileable
function fbm(seed, baseFreq, oct, gain = 0.5) {
  const ns = Array.from({ length: oct }, (_, i) => gradNoise(seed + i * 101, baseFreq * 2 ** i));
  return (u, v) => {
    let s = 0;
    let a = 1;
    let n = 0;
    for (let i = 0; i < oct; i++) {
      const f = baseFreq * 2 ** i;
      s += a * ns[i](u * f, v * f);
      n += a;
      a *= gain;
    }
    return s / n;
  };
}
// Worley (cell) noise, tileable: returns [f1, f2, cellId]
function worley(seed, cells) {
  const r = rng(seed);
  const pts = [];
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) pts.push([(i + r()) / cells, (j + r()) / cells, r()]);
  return (u, v) => {
    const ci = Math.floor(u * cells);
    const cj = Math.floor(v * cells);
    let f1 = 9;
    let f2 = 9;
    let id = 0;
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        const ii = (ci + di + cells) % cells;
        const jj = (cj + dj + cells) % cells;
        const p = pts[jj * cells + ii];
        let dx = p[0] + Math.floor((ci + di) / cells) - u + (ci + di < 0 ? -1 : 0) * 0;
        let dy = p[1] - v;
        dx = p[0] - u;
        if (dx > 0.5) dx -= 1;
        if (dx < -0.5) dx += 1;
        if (dy > 0.5) dy -= 1;
        if (dy < -0.5) dy += 1;
        const d = Math.hypot(dx, dy);
        if (d < f1) {
          f2 = f1;
          f1 = d;
          id = p[2];
        } else if (d < f2) f2 = d;
      }
    }
    return [f1 * cells, f2 * cells, id];
  };
}

function field(fn) {
  const a = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) a[y * S + x] = fn(x / S, y / S);
  return a;
}
function normalFromHeight(h, strength) {
  const out = Buffer.alloc(S * S * 3);
  const at = (x, y) => h[(((y % S) + S) % S) * S + (((x % S) + S) % S)];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * S + x) * 3;
      out[i] = Math.round(((-dx / l) * 0.5 + 0.5) * 255);
      out[i + 1] = Math.round(((dy / l) * 0.5 + 0.5) * 255); // OpenGL convention (+Y up)
      out[i + 2] = Math.round(((1 / l) * 0.5 + 0.5) * 255);
    }
  }
  return out;
}
const clamp01 = (x) => Math.max(0, Math.min(1, x));
async function save(name, buf, ch, q = 88) {
  await sharp(buf, { raw: { width: S, height: S, channels: ch } }).jpeg({ quality: q, mozjpeg: true }).toFile(OUT + name);
  console.log(name, (fs.statSync(OUT + name).size / 1024).toFixed(0) + ' KB');
}
function rgbBuf(fn) {
  const b = Buffer.alloc(S * S * 3);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const [r, g, bl] = fn(x, y);
      const i = (y * S + x) * 3;
      b[i] = Math.round(clamp01(r) * 255);
      b[i + 1] = Math.round(clamp01(g) * 255);
      b[i + 2] = Math.round(clamp01(bl) * 255);
    }
  }
  return b;
}
const grayBuf = (fn) => rgbBuf((x, y) => { const v = fn(x, y); return [v, v, v]; });

// ---------- Moon regolith: fine grey dust, small craterlets, scattered bright fragments ----------
async function moon() {
  const n1 = fbm(11, 4, 6);
  const n2 = fbm(12, 32, 4);
  const cr = worley(13, 5);
  const cr2 = worley(14, 16);
  const grain = fbm(16, 96, 3);
  const peb = worley(15, 60);
  const h = field((u, v) => {
    let z = n1(u, v) * 0.6 + n2(u, v) * 0.25 + grain(u, v) * 0.12;
    for (const [w, depth] of [[cr, 0.35], [cr2, 0.18]]) {
      const [f1, , id] = w(u, v);
      if (id < 0.45) continue; // only some cells hold a craterlet
      const rad = 0.12 + id * 0.18;
      if (f1 < rad) z -= depth * (1 - (f1 / rad) ** 2);
      z += depth * 0.35 * Math.exp(-(((f1 - rad) / 0.08) ** 2));
    }
    const [p1, , pid] = peb(u, v);
    if (pid > 0.7 && p1 < 0.18) z += 0.25 * (1 - p1 / 0.18);
    return z;
  });
  const b = rgbBuf((x, y) => {
    const u = x / S;
    const v = y / S;
    const z = h[y * S + x];
    const base = 0.47 + n1(u * 2, v * 2) * 0.08 + n2(u, v) * 0.05 + z * 0.06;
    const [p1, , pid] = peb(u, v);
    const bright = pid > 0.82 && p1 < 0.12 ? 0.18 : 0;
    const g = base + bright;
    return [g, g, g * 0.985];
  });
  await save('moon_albedo.jpg', b, 3);
  await save('moon_normal.jpg', normalFromHeight(h, 10), 3, 90);
  await save('moon_rough.jpg', grayBuf((x, y) => 0.88 + n2(x / S, y / S) * 0.06), 3, 80);
}

// ---------- Mars regolith: red-orange dust, wind ripples, many small dark pebbles ----------
async function mars() {
  const n1 = fbm(21, 4, 6);
  const n2 = fbm(22, 24, 4);
  const rip = fbm(23, 6, 3);
  const peb = worley(24, 40);
  const peb2 = worley(25, 90);
  const grain = fbm(26, 96, 3);
  const h = field((u, v) => {
    let z = n1(u, v) * 0.5 + n2(u, v) * 0.15;
    z += Math.sin((u * 1 + rip(u, v) * 0.06) * Math.PI * 2 * 22) * 0.06; // ripples
    z += grain(u, v) * 0.1;
    for (const [w, th, amp] of [[peb, 0.86, 0.6], [peb2, 0.88, 0.3]]) {
      const [f1, , id] = w(u, v);
      const rad = 0.18 + id * 0.25;
      if (id > th && f1 < rad) z += amp * Math.sqrt(1 - (f1 / rad) ** 2);
    }
    return z;
  });
  const b = rgbBuf((x, y) => {
    const u = x / S;
    const v = y / S;
    const t = n1(u * 2, v * 2) * 0.5 + 0.5;
    const gr = grain(u, v) * 0.05;
    // Jezero regolith in Perseverance images: dusty brown-tan, not bright orange
    let r = 0.52 + t * 0.1 + n2(u, v) * 0.05 + gr;
    let g = 0.36 + t * 0.07 + n2(u, v) * 0.04 + gr * 0.8;
    let bl = 0.26 + t * 0.05 + gr * 0.6;
    for (const [w, th] of [[peb, 0.86], [peb2, 0.88]]) {
      const [f1, , id] = w(u, v);
      const rad = 0.18 + id * 0.25;
      if (id > th && f1 < rad) {
        const shade = 0.78 + (f1 / rad) * 0.12; // darker centre, soft edge
        const grey = id > 0.93; // a few basalt-grey stones
        r *= grey ? 0.62 : shade;
        g *= grey ? 0.78 : shade * 0.97;
        bl *= grey ? 0.95 : shade * 0.95;
      }
    }
    return [r, g, bl];
  });
  await save('mars_albedo.jpg', b, 3);
  await save('mars_normal.jpg', normalFromHeight(h, 10), 3, 90);
  await save('mars_rough.jpg', grayBuf((x, y) => 0.9 + n2(x / S, y / S) * 0.05), 3, 80);
}

// ---------- Rock: fractured grey stone with mineral speckles (tinted per world in the material) ----------
async function rock() {
  const n1 = fbm(31, 3, 6);
  const n2 = fbm(32, 40, 3);
  const cr = worley(33, 14);
  const warp = fbm(34, 4, 3);
  const crackAt = (u, v) => {
    const wu = (u + warp(u, v) * 0.06 + 1) % 1;
    const wv = (v + warp(v, u) * 0.06 + 1) % 1;
    const [f1, f2] = cr(wu, wv);
    return Math.min(1, Math.max(0, ((f2 - f1) - 0.02) * 14)); // 0 in the crack, 1 elsewhere
  };
  const h = field((u, v) => n1(u, v) * 0.7 + n2(u, v) * 0.25 + crackAt(u, v) * 0.25);
  const b = rgbBuf((x, y) => {
    const u = x / S;
    const v = y / S;
    const c = crackAt(u, v);
    const speck = n2(u * 3, v * 3) > 0.62 ? 0.12 : 0;
    const g = 0.52 + n1(u, v) * 0.16 + n2(u, v) * 0.06 + speck - (1 - c) * 0.12;
    return [g, g * 0.98, g * 0.96];
  });
  await save('rock_albedo.jpg', b, 3);
  await save('rock_normal.jpg', normalFromHeight(h, 22), 3, 90);
}

// ---------- Hardware: crinkled gold foil (MLI), suit fabric weave, habitat panels ----------
async function hardware() {
  const n = fbm(41, 8, 5);
  const w = worley(42, 18);
  const foilH = field((u, v) => {
    const [f1, f2] = w(u, v);
    return n(u, v) * 0.5 + (f2 - f1) * 0.8;
  });
  await save('foil_normal.jpg', normalFromHeight(foilH, 30), 3, 88);
  const weave = field((u, v) => {
    const a = Math.sin(u * Math.PI * 2 * 128) * Math.sign(Math.sin(v * Math.PI * 2 * 64));
    const b2 = Math.sin(v * Math.PI * 2 * 128) * Math.sign(Math.sin(u * Math.PI * 2 * 64));
    return (a + b2) * 0.25 + n(u, v) * 0.15;
  });
  await save('fabric_normal.jpg', normalFromHeight(weave, 3), 3, 85);
  const panel = field((u, v) => {
    const cu = (u * 4) % 1;
    const cv = (v * 4) % 1;
    const seam = Math.min(cu, 1 - cu, cv, 1 - cv) < 0.012 ? -1 : 0;
    const rivU = Math.abs(cu - 0.04) < 0.01 || Math.abs(cu - 0.96) < 0.01;
    const rivet = rivU && ((cv * 10) % 1) < 0.1 ? 0.6 : 0;
    return seam + rivet + n(u * 2, v * 2) * 0.05;
  });
  await save('panel_normal.jpg', normalFromHeight(panel, 6), 3, 88);
}

await moon();
await mars();
await rock();
await hardware();
