// A labelled bar gauge. `good` = which direction is safe: 'high' (more is better) or 'low' (less is better).
export default function Gauge({ icon, label, value, max, text, good = 'high', warnAt = 0.35, badAt = 0.15, delta }) {
  const frac = Math.max(0, Math.min(1, value / max));
  const danger = good === 'high' ? frac : 1 - frac;
  const level = danger <= badAt ? 'bad' : danger <= warnAt ? 'warn' : 'ok';
  return (
    <div className={`gauge gauge-${level}`} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value * 10) / 10}>
      <div className="gauge-top">
        <span className="gauge-label"><span aria-hidden="true">{icon}</span> {label}</span>
        <span className="gauge-text">
          {text}
          {delta !== undefined && Math.abs(delta) >= 0.05 && (
            <span className={`delta ${(delta > 0) === (good === 'high') ? 'delta-good' : 'delta-bad'}`}>
              {delta > 0 ? '▲' : '▼'} {Math.abs(Math.round(delta * 10) / 10)}
            </span>
          )}
        </span>
      </div>
      <div className="gauge-bar"><div className="gauge-fill" style={{ width: `${frac * 100}%` }} /></div>
    </div>
  );
}
