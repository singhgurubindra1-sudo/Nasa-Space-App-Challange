import { useEffect, useState } from 'react';
import { supabase, friendlyError } from '../lib/supabase.js';
import { CATEGORIES, PRIORITIES, FEEDBACK_CATS, EMAIL_RE } from './common.js';

const TABS = [
  { id: 'new', label: '🆘 Raise a ticket' },
  { id: 'feedback', label: '💬 Feedback' },
];

export default function Support({ tab: initialTab = 'new', fromScreen, onBack }) {
  const [tab, setTab] = useState(TABS.some((t) => t.id === initialTab) ? initialTab : 'new');
  useEffect(() => setTab(TABS.some((t) => t.id === initialTab) ? initialTab : 'new'), [initialTab]);

  return (
    <div className="screen support">
      <p className="kicker">Mission Support</p>
      <h1 className="screen-title">Help Center</h1>
      <p className="lead">Found a bug, stuck on a mission, or have an idea? Raise a ticket and the team will get back to you by email.</p>

      <div className="seg-tabs wide-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === 'new' && <NewTicket fromScreen={fromScreen} />}
      {tab === 'feedback' && <Feedback fromScreen={fromScreen} />}

      <button className="btn btn-ghost wide" onClick={onBack}>← Back to the game</button>
    </div>
  );
}

function NewTicket({ fromScreen }) {
  const [form, setForm] = useState({ email: '', category: 'bug', priority: 'normal', subject: '', description: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const email = form.email.trim();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!EMAIL_RE.test(email)) return setError('Please enter a valid email so we can reply.');
    if (form.subject.trim().length < 3) return setError('Give the ticket a short title (3+ characters).');
    if (form.description.trim().length < 10) return setError('Tell us a bit more: at least 10 characters.');
    setBusy(true);
    const row = {
      user_id: null,
      email,
      category: form.category,
      priority: form.priority,
      subject: form.subject.trim().slice(0, 140),
      description: form.description.trim().slice(0, 5000),
      page: String(fromScreen || 'unknown').slice(0, 60),
      user_agent: navigator.userAgent.slice(0, 400),
    };
    // Tickets are write-only from the website (row-level security), so we don't read the row back.
    const { error: err } = await supabase.from('tickets').insert(row);
    setBusy(false);
    if (err) return setError(friendlyError(err));
    setDone(true);
    setForm({ ...form, subject: '', description: '' });
  };

  if (done) {
    return (
      <div className="card notice ok">
        <h3>✅ Ticket received</h3>
        <p>Thanks! Mission Support has been notified. We will reply to <b>{email}</b>.</p>
        <button className="btn btn-secondary" onClick={() => setDone(null)}>Raise another</button>
      </div>
    );
  }

  return (
    <form className="card form" onSubmit={submit} noValidate>
      <label className="field">
        <span>Your email (so we can reply)</span>
        <input type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" autoComplete="email" />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Type</span>
          <select value={form.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
        </label>
        <label className="field">
          <span>Priority</span>
          <select value={form.priority} onChange={set('priority')}>{PRIORITIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
        </label>
      </div>
      <label className="field">
        <span>Title</span>
        <input value={form.subject} onChange={set('subject')} maxLength={140} placeholder="e.g. Rover gets stuck near the habitat" />
      </label>
      <label className="field">
        <span>What happened? <small className="muted">What did you expect, and what did you see?</small></span>
        <textarea rows={6} value={form.description} onChange={set('description')} maxLength={5000} placeholder="Steps to reproduce, which world, which sol…" />
        <small className="muted right">{form.description.length} / 5000</small>
      </label>
      <p className="muted small">We also attach the page you came from ({fromScreen || 'unknown'}) and your browser type, to help us fix bugs faster.</p>
      {error && <p className="notice bad" role="alert">⚠ {error}</p>}
      <button className="btn btn-primary wide" disabled={busy}>{busy ? '⏳ Sending…' : '📨 Submit ticket'}</button>
    </form>
  );
}

function Feedback({ fromScreen }) {
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState('general');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) return setError('Tap a star to rate the game first.');
    const em = email.trim() || null;
    if (em && !EMAIL_RE.test(em)) return setError('That email does not look right (or leave it empty).');
    setBusy(true);
    setError('');
    const { error: err } = await supabase.from('feedback').insert({
      user_id: null,
      email: em,
      rating,
      category,
      message: message.trim().slice(0, 3000) || null,
      page: String(fromScreen || 'unknown').slice(0, 60),
    });
    setBusy(false);
    if (err) return setError(friendlyError(err));
    setDone(true);
  };

  if (done) {
    return (
      <div className="card notice ok">
        <h3>🙏 Thank you!</h3>
        <p>Your feedback helps us make Survive 30 Sols better for every student.</p>
        <button className="btn btn-secondary" onClick={() => { setDone(false); setRating(0); setMessage(''); }}>Send more</button>
      </div>
    );
  }
  return (
    <form className="card form" onSubmit={submit} noValidate>
      <div className="field">
        <span>How much do you like the game?</span>
        <div className="star-rate" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button type="button" key={n} role="radio" aria-checked={rating === n} className={n <= rating ? 'on' : ''} onClick={() => setRating(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`}>★</button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>About</span>
        <div className="chips">
          {FEEDBACK_CATS.map((c) => (
            <button type="button" key={c.id} className={`chip chip-btn ${category === c.id ? 'on' : ''}`} onClick={() => setCategory(c.id)} aria-pressed={category === c.id}>{c.label}</button>
          ))}
        </div>
      </div>
      <label className="field">
        <span>Tell us more (optional)</span>
        <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={3000} placeholder="What was the best part? What was confusing?" />
      </label>
      <label className="field">
        <span>Email (optional, if you'd like an answer)</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </label>
      {error && <p className="notice bad" role="alert">⚠ {error}</p>}
      <button className="btn btn-primary wide" disabled={busy}>{busy ? '⏳ Sending…' : '💬 Send feedback'}</button>
    </form>
  );
}
