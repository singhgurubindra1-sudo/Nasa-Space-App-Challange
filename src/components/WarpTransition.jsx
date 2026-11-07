import { useEffect, useRef } from 'react';

// Hyperspace jump shown when you move to another page: stars stretch into streaks, a flash, then the
// new page fades in behind it. Pure canvas, about 1 second, skipped for people who prefer less motion.
const DURATION = 1100;

export default function WarpTransition({ label, onDone, short = false }) {
  const canvasRef = useRef(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    resize();
    const total = reduce ? 300 : short ? 600 : DURATION;
    const stars = Array.from({ length: reduce ? 0 : 420 }, () => ({
      a: Math.random() * Math.PI * 2,
      d: Math.random() * 0.9 + 0.02,
      s: Math.random() * 0.8 + 0.4,
      hue: Math.random() < 0.15 ? 28 : Math.random() < 0.5 ? 200 : 220,
    }));
    const t0 = performance.now();
    let raf = 0;
    const frame = (now) => {
      const t = Math.min(1, (now - t0) / total);
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.hypot(cx, cy);
      // Speed ramps up, peaks at ~60%, then the scene opens.
      const speed = t < 0.6 ? (t / 0.6) ** 2 : 1;
      const fadeOut = t > 0.72 ? 1 - (t - 0.72) / 0.28 : 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(3, 7, 18, ${0.35 + 0.65 * (1 - speed * 0.6)})`;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (const st of stars) {
        st.d += 0.004 + speed * 0.05 * st.s;
        if (st.d > 1.2) st.d = 0.02 + Math.random() * 0.1;
        const r1 = st.d * R;
        const r0 = Math.max(0, r1 - (8 + speed * 0.45 * R * st.s) * st.d);
        const c = Math.cos(st.a);
        const s = Math.sin(st.a);
        ctx.strokeStyle = `hsla(${st.hue}, 90%, ${70 + 25 * speed}%, ${Math.min(1, 0.25 + st.d) * fadeOut})`;
        ctx.lineWidth = (0.6 + st.d * 2.2) * dpr;
        ctx.beginPath();
        ctx.moveTo(cx + c * r0, cy + s * r0);
        ctx.lineTo(cx + c * r1, cy + s * r1);
        ctx.stroke();
      }
      // Central glow and the jump flash.
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * (0.15 + speed * 0.35));
      glow.addColorStop(0, `rgba(186, 230, 253, ${0.55 * speed * fadeOut})`);
      glow.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      if (t > 0.55 && t < 0.8) {
        ctx.fillStyle = `rgba(224, 242, 254, ${0.5 * Math.sin(((t - 0.55) / 0.25) * Math.PI)})`;
        ctx.fillRect(0, 0, w, h);
      }
      canvas.style.opacity = String(t > 0.72 ? fadeOut : 1);
      if (t < 1) raf = requestAnimationFrame(frame);
      else doneRef.current();
    };
    raf = requestAnimationFrame(frame);
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [short]);

  return (
    <div className="warp" aria-hidden="true">
      <canvas ref={canvasRef} />
      {label && !short && <p className="warp-label">{label}</p>}
    </div>
  );
}
