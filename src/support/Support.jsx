import { useCallback, useEffect, useState } from 'react';
import { supabase, friendlyError } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { CATEGORIES, PRIORITIES, STATUS, FEEDBACK_CATS, fmtDate, EMAIL_RE } from './common.js';

const TABS = [
  { id: 'new', label: '🆘 Raise a ticket' },
  { id: 'tickets', label: '🎫 My tickets' },
  { id: 'feedback', label: '💬 Feedback' },
  { id: 'profile', label: '⚙ Profile' },
];

export default function Support({ tab: initialTab = 'new', fromScreen, onBack, onSignIn }) {
  const auth = useAuth();
  const [tab, setTab] = useState(initialTab);
  useEffect(() => setTab(initialTab), [initialTab]);
  const tabs = auth.user ? TABS : TABS.filter((t) => t.id === 'new' || t.id === 'feedback');

  return (
    <div className="screen support">
      <p className="kicker">Mission Support</p>
      <h1 className="screen-title">Help Center</h1>
      <p className="lead">Found a bug, stuck on a mission, or have an idea? Raise a ticket and the team will get back to you by email.</p>

      <div className="seg-tabs wide-tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {!auth.user && (
        <div className="notice info">
          <p>👤 You are playing as a guest. You can still raise a ticket, but <button className="link-btn inline" onClick={onSignIn}>sign in</button> to track its status and read replies here.</p>
        </div>
      )}

      {tab === 'new' && <NewTicket fromScreen={fromScreen} onCreated={() => auth.user && setTab('tickets')} />}
      {tab === 'tickets' && auth.user && <MyTickets />}
      {tab === 'feedback' && <Feedback fromScreen={fromScreen} />}
      {tab === 'profile' && auth.user && <Profile />}

      <button className="btn btn-ghost wide" onClick={onBack}>← Back to the game</button>
    </div>
  );
}

function NewTicket({ fromScreen, onCreated }) {
  const auth = useAuth();
  const [form, setForm] = useState({ email: '', category: 'bug', priority: 'normal', subject: '', description: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const email = auth.user ? auth.user.email : form.email.trim();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!EMAIL_RE.test(email)) return setError('Please enter a valid email so we can reply.');
    if (form.subject.trim().length < 3) return setError('Give the ticket a short title (3+ characters).');
    if (form.description.trim().length < 10) return setError('Tell us a bit more: at least 10 characters.');
    setBusy(true);
    const row = {
      user_id: auth.user ? auth.user.id : null,
      email,
      category: form.category,
      priority: form.priority,
      subject: form.subject.trim().slice(0, 140),
      description: form.description.trim().slice(0, 5000),
      page: String(fromScreen || 'unknown').slice(0, 60),
      user_agent: navigator.userAgent.slice(0, 400),
    };
    // Guests cannot read tickets back (row-level security), so only signed-in players ask for the id.
    const q = supabase.from('tickets').insert(row);
    const { data, error: err } = auth.user ? await q.select('id').single() : await q;
    setBusy(false);
    if (err) return setError(friendlyError(err));
    setDone(data && data.id ? data.id : true);
    setForm({ ...form, subject: '', description: '' });
  };

  if (done) {
    return (
      <div className="card notice ok">
        <h3>✅ Ticket received{done !== true ? ` · #${done}` : ''}</h3>
        <p>Thanks! Mission Support has been notified. We will reply to <b>{email}</b>.</p>
        <div className="row">
          <button className="btn btn-secondary grow" onClick={() => setDone(null)}>Raise another</button>
          {auth.user && <button className="btn btn-primary grow" onClick={onCreated}>View my tickets</button>}
        </div>
      </div>
    );
  }

  return (
    <form className="card form" onSubmit={submit} noValidate>
      {!auth.user && (
        <label className="field">
          <span>Your email (so we can reply)</span>
          <input type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" autoComplete="email" />
        </label>
      )}
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

export function TicketThread({ ticket, staff = false, onChanged }) {
  const auth = useAuth();
  const [replies, setReplies] = useState(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const { data } = await supabase.from('ticket_replies').select('*').eq('ticket_id', ticket.id).order('created_at');
    setReplies(data || []);
  }, [ticket.id]);
  useEffect(() => {
    load();
  }, [load]);

  const send = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError('');
    const { error: err } = await supabase.from('ticket_replies').insert({ ticket_id: ticket.id, author_id: auth.user.id, is_staff: staff, body: body.trim().slice(0, 5000) });
    setBusy(false);
    if (err) return setError(friendlyError(err));
    setBody('');
    load();
    onChanged && onChanged();
  };

  return (
    <div className="thread">
      <div className="msg msg-player">
        <div className="msg-meta">{ticket.email} · {fmtDate(ticket.created_at)}</div>
        <p>{ticket.description}</p>
      </div>
      {replies === null && <p className="muted small">Loading replies…</p>}
      {replies && replies.map((r) => (
        <div key={r.id} className={`msg ${r.is_staff ? 'msg-staff' : 'msg-player'}`}>
          <div className="msg-meta">{r.is_staff ? '🛰 Mission Support' : 'You'} · {fmtDate(r.created_at)}</div>
          <p>{r.body}</p>
        </div>
      ))}
      {ticket.status !== 'closed' && (
        <form onSubmit={send} className="reply-form">
          <textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder={staff ? 'Reply to the player…' : 'Add more details or answer support…'} maxLength={5000} />
          <button className="btn btn-secondary small-btn" disabled={busy || !body.trim()}>{busy ? 'Sending…' : 'Send reply'}</button>
        </form>
      )}
      {error && <p className="notice bad">⚠ {error}</p>}
    </div>
  );
}

function MyTickets() {
  const auth = useAuth();
  const [tickets, setTickets] = useState(null);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('tickets').select('*').eq('user_id', auth.user.id).order('updated_at', { ascending: false });
    if (err) setError(friendlyError(err));
    setTickets(data || []);
  }, [auth.user.id]);
  useEffect(() => {
    load();
  }, [load]);

  if (tickets === null) return <p className="muted">Loading your tickets…</p>;
  if (error) return <p className="notice bad">⚠ {error}</p>;
  if (!tickets.length) return <div className="card"><p>No tickets yet. 🎉 If anything goes wrong, raise one from the first tab.</p></div>;
  return (
    <div className="ticket-list">
      {tickets.map((t) => (
        <div key={t.id} className={`card ticket ${open === t.id ? 'open' : ''}`}>
          <button className="ticket-head" onClick={() => setOpen(open === t.id ? null : t.id)} aria-expanded={open === t.id}>
            <span className={`status ${STATUS[t.status].cls}`}>{STATUS[t.status].label}</span>
            <b>#{t.id} {t.subject}</b>
            <span className="muted small">{CATEGORIES.find((c) => c.id === t.category)?.label} · updated {fmtDate(t.updated_at)}</span>
          </button>
          {open === t.id && <TicketThread ticket={t} onChanged={load} />}
        </div>
      ))}
    </div>
  );
}

function Feedback({ fromScreen }) {
  const auth = useAuth();
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
    const em = auth.user ? auth.user.email : email.trim() || null;
    if (em && !EMAIL_RE.test(em)) return setError('That email does not look right (or leave it empty).');
    setBusy(true);
    setError('');
    const { error: err } = await supabase.from('feedback').insert({
      user_id: auth.user ? auth.user.id : null,
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
      {!auth.user && (
        <label className="field">
          <span>Email (optional, if you'd like an answer)</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
      )}
      {error && <p className="notice bad" role="alert">⚠ {error}</p>}
      <button className="btn btn-primary wide" disabled={busy}>{busy ? '⏳ Sending…' : '💬 Send feedback'}</button>
    </form>
  );
}

function Profile() {
  const auth = useAuth();
  const [name, setName] = useState(auth.profile?.display_name || '');
  const [msg, setMsg] = useState('');
  const save = async (e) => {
    e.preventDefault();
    if (name.trim().length < 2) return setMsg('⚠ At least 2 characters.');
    try {
      await auth.updateName(name.trim());
      setMsg('✅ Saved.');
    } catch (err) {
      setMsg(`⚠ ${friendlyError(err)}`);
    }
  };
  return (
    <form className="card form" onSubmit={save}>
      <div className="profile-stats">
        <div><b>{auth.profile?.missions_won || 0}</b><span>missions won</span></div>
        <div><b>{auth.profile?.best_difficulty || '—'}</b><span>hardest level beaten</span></div>
        <div><b>{auth.profile ? new Date(auth.profile.created_at || Date.now()).toLocaleDateString() : '—'}</b><span>joined</span></div>
      </div>
      <label className="field">
        <span>Call sign</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
      </label>
      <p className="muted small">Signed in as {auth.user.email}</p>
      {msg && <p className="small">{msg}</p>}
      <button className="btn btn-primary">Save profile</button>
    </form>
  );
}
