import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const PREFS = 'survive30sols.tour.v1';
export const tourPrefs = {
  get() {
    try {
      return JSON.parse(localStorage.getItem(PREFS) || '{}');
    } catch {
      return {};
    }
  },
  set(patch) {
    try {
      localStorage.setItem(PREFS, JSON.stringify({ ...tourPrefs.get(), ...patch }));
    } catch {
      /* private mode */
    }
  },
  markSeen(id) {
    const p = tourPrefs.get();
    tourPrefs.set({ seen: { ...(p.seen || {}), [id]: true } });
  },
};

const PAD = 8;

function findTarget(sel) {
  if (!sel) return null;
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return el;
}

// Spotlight tour: dims the page, cuts a hole around the target and shows a tip card next to it.
export default function Tour({ tour, onDone }) {
  const steps = tour.steps;
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const [card, setCard] = useState({ top: 0, left: 0, place: 'center' });
  const cardRef = useRef(null);
  const step = steps[i];

  const measure = useCallback(() => {
    const el = findTarget(step.target);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    // Very tall targets (like the 3D stage) are clipped to the viewport.
    const top = Math.max(r.top, 4);
    const bottom = Math.min(r.bottom, vh - 4);
    setRect({ top: top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: Math.max(0, bottom - top) + PAD * 2 });
  }, [step]);

  // Scroll the target into view, then measure.
  useEffect(() => {
    const el = findTarget(step.target);
    if (el) {
      const r = el.getBoundingClientRect();
      const fits = r.top >= 60 && r.bottom <= window.innerHeight - 160;
      if (!fits) el.scrollIntoView({ block: r.height > window.innerHeight * 0.6 ? 'start' : 'center', behavior: 'smooth' });
    }
    measure();
    const t = setTimeout(measure, 450);
    return () => clearTimeout(t);
  }, [step, measure]);

  useEffect(() => {
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true });
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure);
    };
  }, [measure]);

  // Place the tip card below the target, or above if there is no room, or centered.
  useLayoutEffect(() => {
    const c = cardRef.current;
    if (!c) return;
    const ch = c.offsetHeight;
    const cw = Math.min(360, window.innerWidth - 32);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!rect) {
      setCard({ top: Math.max(16, (vh - ch) / 2), left: (vw - cw) / 2, place: 'center' });
      return;
    }
    const left = Math.min(Math.max(16, rect.left + rect.width / 2 - cw / 2), vw - cw - 16);
    if (rect.top + rect.height + 12 + ch < vh) setCard({ top: rect.top + rect.height + 12, left, place: 'below' });
    else if (rect.top - 12 - ch > 0) setCard({ top: rect.top - 12 - ch, left, place: 'above' });
    else setCard({ top: Math.max(16, vh - ch - 16), left, place: 'inside' });
  }, [rect, i]);

  const finish = useCallback(() => onDone(), [onDone]);
  const next = useCallback(() => (i < steps.length - 1 ? setI(i + 1) : finish()), [i, steps.length, finish]);
  const prev = useCallback(() => i > 0 && setI(i - 1), [i]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') finish();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, finish]);

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {rect ? (
        <div className="tour-hole" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} />
      ) : (
        <div className="tour-dim" />
      )}
      <div ref={cardRef} className={`tour-card place-${card.place}`} style={{ top: card.top, left: card.left }}>
        <p className="tour-kicker">{tour.title} · {i + 1} / {steps.length}</p>
        <h3 id="tour-title">{step.title}</h3>
        <p>{step.text}</p>
        <div className="tour-dots" aria-hidden="true">{steps.map((_, k) => <i key={k} className={k === i ? 'on' : k < i ? 'done' : ''} />)}</div>
        <div className="tour-actions">
          <button className="link-btn" onClick={finish}>Skip tour</button>
          <span className="grow" />
          {i > 0 && <button className="btn btn-ghost small-btn" onClick={prev}>Back</button>}
          <button className="btn btn-primary small-btn" onClick={next} autoFocus>{i < steps.length - 1 ? 'Next →' : 'Got it! ✓'}</button>
        </div>
      </div>
    </div>
  );
}

// First-ever visit: a short welcome that explains the whole site in three steps.
export function Welcome({ onTour, onSkip, onSignUp }) {
  return (
    <div className="modal-backdrop">
      <div className="modal welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
        <div className="welcome-rocket" aria-hidden="true">🚀</div>
        <h2 id="welcome-title">Welcome to Survive 30 Sols</h2>
        <p className="muted">A NASA Space Apps 2026 mission trainer. Here’s how it works:</p>
        <ol className="welcome-steps">
          <li><span>🌌</span><div><b>Explore</b><small>Fly through a live map of space: real satellites, planets and asteroids, right now.</small></div></li>
          <li><span>🪐</span><div><b>Choose a mission</b><small>Pick the Moon or Mars and a difficulty. Live NASA mode uses the real Sun’s activity.</small></div></li>
          <li><span>🧑‍🚀</span><div><b>Survive 30 sols</b><small>Split your power, make one big decision a day, and bring your crew of 4 home.</small></div></li>
        </ol>
        <button className="btn btn-primary wide" onClick={onTour} autoFocus>👉 Show me around (1 min)</button>
        <div className="row">
          <button className="btn btn-secondary grow" onClick={onSignUp}>✨ Create account</button>
          <button className="btn btn-ghost grow" onClick={onSkip}>Skip, I'll explore</button>
        </div>
        <p className="muted small center">You can replay the tour from the ❔ button at the top, on any page.</p>
      </div>
    </div>
  );
}
