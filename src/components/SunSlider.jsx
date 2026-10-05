import { useState } from 'react';
import { getSunBrightness, saveSunBrightness, SUN_MIN, SUN_MAX, SUN_DEFAULT } from '../three/sunBrightness.js';

// "☀ Sun brightness" slider. Calls onChange(value) live; the choice is remembered on this device.
export default function SunSlider({ onChange }) {
  const [v, setV] = useState(getSunBrightness);
  const set = (x) => {
    setV(x);
    saveSunBrightness(x);
    onChange(x);
  };
  return (
    <div className="sun-slider" title="Sun brightness">
      <button className="sun-step" onClick={() => set(Math.max(SUN_MIN, +(v - 0.1).toFixed(2)))} aria-label="Dimmer Sun">−</button>
      <label>
        <span aria-hidden="true">☀</span>
        <span className="sr-only">Sun brightness</span>
        <input type="range" min={SUN_MIN} max={SUN_MAX} step="0.05" value={v} onChange={(e) => set(+e.target.value)} aria-valuetext={`${Math.round(v * 100)}%`} />
      </label>
      <button className="sun-step" onClick={() => set(Math.min(SUN_MAX, +(v + 0.1).toFixed(2)))} aria-label="Brighter Sun">+</button>
      <button className="sun-val" onClick={() => set(SUN_DEFAULT)} title="Reset to default">{Math.round(v * 100)}%</button>
    </div>
  );
}
