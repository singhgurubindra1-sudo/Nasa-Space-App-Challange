import { useState } from 'react';
import { getQualityName, setQualityName, getQuality } from '../three/quality.js';

// Graphics quality picker. Changing it reloads the page so every 3D scene rebuilds.
export default function GraphicsMenu({ className = 'icon-btn' }) {
  const [open, setOpen] = useState(false);
  const current = getQualityName();
  const active = getQuality().level;
  const pick = (name) => {
    setQualityName(name);
    window.location.reload();
  };
  return (
    <div className="gfx">
      <button className={className} onClick={() => setOpen(!open)} aria-expanded={open} title="Graphics quality">
        ⚙ <span className="hide-sm">Graphics</span>
      </button>
      {open && (
        <div className="gfx-menu" role="menu">
          <b>Graphics quality</b>
          {[
            ['auto', `Auto (now: ${active})`, 'Picks a level for your graphics chip, then adjusts resolution live to stay smooth'],
            ['ultra', 'Ultra', 'Ambient occlusion, 4K shadows, 6,000 pebbles. Gaming PCs only.'],
            ['high', 'High', 'Glare, sharp 2K shadows, anti-aliasing. Laptops with a graphics card.'],
            ['medium', 'Medium', 'Glare and soft shadows. Most laptops, Chromebooks and newer phones.'],
            ['low', 'Low', 'No post-effects, lower resolution. Older phones and computers.'],
          ].map(([id, label, note]) => (
            <button key={id} role="menuitemradio" aria-checked={current === id} className={current === id ? 'on' : ''} onClick={() => pick(id)}>
              <span>{label}</span>
              <small>{note}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
