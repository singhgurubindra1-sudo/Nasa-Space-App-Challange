import { useState } from 'react';

export default function WhyCard({ why, startOpen = false }) {
  const [open, setOpen] = useState(startOpen);
  if (!why) return null;
  return (
    <div className={`why ${open ? 'why-open' : ''}`}>
      <button className="why-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        📘 {open ? why.title : 'Why? (learn the real science)'}
      </button>
      {open && (
        <div className="why-body">
          <p>{why.text}</p>
          <a href={why.url} target="_blank" rel="noreferrer">Source: {why.source} ↗</a>
        </div>
      )}
    </div>
  );
}
