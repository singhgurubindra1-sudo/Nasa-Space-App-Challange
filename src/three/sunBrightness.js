// Sun brightness setting shared by both 3D solar-system views (saved on this device).
const KEY = 'survive30sols.sunBrightness.v1';
export const SUN_MIN = 0.1;
export const SUN_MAX = 1.5;
export const SUN_DEFAULT = 0.6;

export function getSunBrightness() {
  try {
    const v = parseFloat(localStorage.getItem(KEY));
    if (v >= SUN_MIN && v <= SUN_MAX) return v;
  } catch {
    /* ignore */
  }
  return SUN_DEFAULT;
}
export function saveSunBrightness(v) {
  try {
    localStorage.setItem(KEY, String(v));
  } catch {
    /* ignore */
  }
}

// Apply a brightness (1 = the original look) to a Sun mesh, its glow sprite and its light.
export function applySunBrightness(b, { sun, glow, light }) {
  if (sun) sun.material.uniforms.brightness.value = b;
  if (glow) {
    glow.material.opacity = Math.min(1, 0.15 + 0.85 * b);
    const s = 11 * (0.55 + 0.45 * Math.min(b, 1.2));
    glow.scale.set(s, s, 1);
  }
  // planets get a bit dimmer too, but never too dark to see
  if (light) light.intensity = 3.2 * (0.55 + 0.45 * b);
}
