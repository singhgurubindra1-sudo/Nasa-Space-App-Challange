// Graphics quality presets. "Auto" looks at the graphics chip and screen, then the
// performance governor (perf.js) fine-tunes resolution while you play.
const KEY = 'survive30sols.quality.v2';

export const PRESETS = {
  low: {
    label: 'Low', pixelRatio: 0.85, shadowMap: 1024, shadowEvery: 4, post: false, ao: false, bloom: false, smaa: false,
    terrainSeg: 140, nearSeg: 120, pebbles: 0, rocks: 0.5, rockDetail: 1, baseFps: 30,
  },
  medium: {
    label: 'Medium', pixelRatio: 1, shadowMap: 1024, shadowEvery: 3, post: true, ao: false, bloom: true, smaa: false,
    terrainSeg: 180, nearSeg: 200, pebbles: 1200, rocks: 0.7, rockDetail: 2, baseFps: 30,
  },
  high: {
    label: 'High', pixelRatio: 1.5, shadowMap: 2048, shadowEvery: 2, post: true, ao: false, bloom: true, smaa: true,
    terrainSeg: 240, nearSeg: 300, pebbles: 3000, rocks: 1, rockDetail: 2, baseFps: 45,
  },
  ultra: {
    label: 'Ultra', pixelRatio: 2, shadowMap: 4096, shadowEvery: 1, post: true, ao: true, bloom: true, smaa: true,
    terrainSeg: 300, nearSeg: 420, pebbles: 6000, rocks: 1, rockDetail: 3, baseFps: 60,
  },
};

let gpuName = null;
export function gpuInfo() {
  if (gpuName !== null) return gpuName;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    gpuName = (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl ? gl.getParameter(gl.RENDERER) : '') || '';
    const lose = gl && gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
  } catch {
    gpuName = '';
  }
  return gpuName;
}

function autoLevel() {
  try {
    const gpu = gpuInfo();
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const lowMem = navigator.deviceMemory && navigator.deviceMemory <= 4;
    const cores = navigator.hardwareConcurrency || 4;
    if (/SwiftShader|llvmpipe|Software|Basic Render/i.test(gpu)) return 'low'; // no real GPU
    if (lowMem || cores <= 2) return 'low';
    if (coarse) return /Apple GPU|Adreno \(TM\) [7-9]\d\d|Mali-G7\d|Mali-G[6-9]\d\d/i.test(gpu) ? 'medium' : 'low';
    // Desktop/laptop: dedicated GPUs get High, integrated graphics get Medium
    if (/RTX|GTX 1[0-9]{3}|GTX [2-9]\d{2}|Radeon RX|Radeon Pro|Arc A|Apple M\d (Pro|Max|Ultra)/i.test(gpu)) return 'high';
    return 'medium';
  } catch {
    return 'medium';
  }
}

export function getQualityName() {
  try {
    const v = localStorage.getItem(KEY);
    if (v && (PRESETS[v] || v === 'auto')) return v;
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
  return { level, auto: n === 'auto', ...PRESETS[level] };
}
