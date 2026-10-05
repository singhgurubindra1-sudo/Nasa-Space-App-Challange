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
            ['auto', `Auto (${active})`, 'Best for this device'],
            ['high', 'High', 'Ambient occlusion, 4K shadows, 6,000 pebbles. Gaming PCs.'],
            ['medium', 'Medium', 'Bloom and glare, 2K shadows. Laptops and newer phones.'],
            ['low', 'Low', 'No post-effects. Older phones and school Chromebooks.'],
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
