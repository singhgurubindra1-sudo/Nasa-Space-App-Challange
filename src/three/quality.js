// Graphics quality presets. "auto" picks High on desktops and Medium on phones/tablets.
const KEY = 'survive30sols.quality.v1';

export const PRESETS = {
  low: { label: 'Low', pixelRatio: 1, shadowMap: 1024, post: false, ao: false, bloom: false, terrainSeg: 220, nearSeg: 160, pebbles: 0, rocks: 0.6, aa: true },
  medium: { label: 'Medium', pixelRatio: 1.25, shadowMap: 2048, post: true, ao: false, bloom: true, terrainSeg: 260, nearSeg: 280, pebbles: 2500, rocks: 0.85, aa: false },
  high: { label: 'High', pixelRatio: 1.75, shadowMap: 4096, post: true, ao: true, bloom: true, terrainSeg: 300, nearSeg: 420, pebbles: 6000, rocks: 1, aa: false },
};

function autoLevel() {
  try {
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const small = Math.min(window.innerWidth, window.innerHeight) < 700;
    const lowMem = navigator.deviceMemory && navigator.deviceMemory <= 4;
    if (lowMem) return 'low';
    return coarse || small ? 'medium' : 'high';
  } catch {
    return 'medium';
  }
}

export function getQualityName() {
  try {
    const v = localStorage.getItem(KEY);
    if (v && PRESETS[v]) return v;
  } catch {
    /* ignore */
  }
  return 'auto';
}

export function setQualityName(name) {
  try {
    localStorage.setItem(KEY, name);
  } catch {
    /* ignore */
  }
}

export function getQuality() {
  const n = getQualityName();
  const level = n === 'auto' ? autoLevel() : n;
  return { level, ...PRESETS[level] };
}
