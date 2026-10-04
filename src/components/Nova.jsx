import { useEffect } from 'react';

export function NovaFace({ size = 64, mood = 'calm' }) {
  const eye = mood === 'alert' ? '#f87171' : '#7dd3fc';
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="nova-face">
      <rect x="30" y="2" width="4" height="10" rx="2" fill="#94a3b8" />
      <circle cx="32" cy="3" r="3" fill={eye} />
      <rect x="8" y="12" width="48" height="40" rx="14" fill="#e2e8f0" />
      <rect x="14" y="20" width="36" height="22" rx="10" fill="#0f172a" />
      <circle cx="25" cy="31" r="4.5" fill={eye} />
      <circle cx="39" cy="31" r="4.5" fill={eye} />
      <rect x="20" y="54" width="24" height="6" rx="3" fill="#94a3b8" />
    </svg>
  );
}

export function speak(lines, enabled) {
  try {
    if (!enabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(lines.join(' ').replace(/[^\p{L}\p{N}\s.,:;!?'%°−-]/gu, ''));
    u.rate = 1.02;
    u.pitch = 1.1;
    window.speechSynthesis.speak(u);
  } catch {
    /* voice is a nice-to-have */
  }
}

export default function Nova({ lines, voice, mood }) {
  useEffect(() => {
    speak(lines, voice);
    return () => {
      try {
        window.speechSynthesis && window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    };
  }, [lines.join('|'), voice]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="nova">
      <NovaFace mood={mood} />
      <div className="bubble">
        <div className="bubble-name">CAPCOM Nova</div>
        {lines.map((l, i) => (
          <p key={i} className={l.startsWith('Forecast') ? 'forecast' : ''}>{l}</p>
        ))}
      </div>
    </div>
  );
}
