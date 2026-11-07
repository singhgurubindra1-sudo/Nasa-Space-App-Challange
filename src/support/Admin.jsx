import { useCallback, useEffect, useState } from 'react';
import { supabase, friendlyError } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { TicketThread } from './Support.jsx';
import { CATEGORIES, STATUS, fmtDate } from './common.js';

export default function Admin({ onBack }) {
  const auth = useAuth();
  const [tab, setTab] = useState('tickets');
  if (!auth.isAdmin) {
    return (
      <div className="screen">
        <h1 className="screen-title">Admin</h1>
        <div className="card"><p>This page is for the Mission Support team only.</p></div>
        <button className="btn btn-ghost wide" onClick={onBack}>← Back</button>
      </div>
    );
  }
  return (
    <div className="screen support">
      <p className="kicker">Mission Support · Admin</p>
      <h1 className="screen-title">Operations console</h1>
      <div className="seg-tabs wide-tabs" role="tablist">
        {[['tickets', '🎫 Tickets'], ['signups', '🧑‍🚀 New players'], ['feedback', '💬 Feedback']].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'tickets' && <AllTickets />}
      {tab === 'signups' && <Signups />}
      {tab === 'feedback' && <FeedbackList />}
      <button className="btn btn-ghost wide" onClick={onBack}>← Back to the game</button>
    </div>
  );
}

function AllTickets() {
  const [filter, setFilter] = useState('active');
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    let q = supabase.from('tickets').select('*').order('updated_at', { ascending: false }).limit(200);
    if (filter === 'active') q = q.in('status', ['open', 'in_progress']);
    else if (filter !== 'all') q = q.eq('status', filter);
    const { data, error: err } = await q;
    if (err) setError(friendlyError(err));
    setRows(data || []);
  }, [filter]);
  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id, status) => {
    const { error: err } = await supabase.from('tickets').update({ status }).eq('id', id);
    if (err) setError(friendlyError(err));
    load();
  };

  const counts = (rows || []).reduce((m, r) => ({ ...m, [r.priority]: (m[r.priority] || 0) + 1 }), {});
  return (
    <>
      <div className="row">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter tickets">
          <option value="active">Open + in progress</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          <option value="all">All</option>
        </select>
        <button className="btn btn-ghost small-btn" onClick={load}>↻ Refresh</button>
        <span className="muted small grow right">{rows ? `${rows.length} tickets` : ''}{counts.urgent ? ` · ${counts.urgent} urgent` : ''}</span>
      </div>
      {error && <p className="notice bad">⚠ {error}</p>}
      {rows === null && <p className="muted">Loading…</p>}
      {rows && !rows.length && <div className="card"><p>Nothing here. 🎉</p></div>}
      {rows && rows.map((t) => (
        <div key={t.id} className={`card ticket prio-${t.priority}`}>
          <button className="ticket-head" onClick={() => setOpen(open === t.id ? null : t.id)} aria-expanded={open === t.id}>
            <span className={`status ${STATUS[t.status].cls}`}>{STATUS[t.status].label}</span>
            <b>#{t.id} {t.subject}</b>
            <span className="muted small">
              {t.priority.toUpperCase()} · {CATEGORIES.find((c) => c.id === t.category)?.label} · {t.email}{t.user_id ? '' : ' (guest)'} · {fmtDate(t.created_at)}
              {t.notify_status ? ` · email: ${t.notify_status}` : ''}
            </span>
          </button>
          {open === t.id && (
            <>
              <div className="row">
                {Object.entries(STATUS).map(([k, v]) => (
                  <button key={k} className={`chip chip-btn ${t.status === k ? 'on' : ''}`} onClick={() => setStatus(t.id, k)}>{v.label}</button>
                ))}
              </div>
              <p className="muted small">Page: {t.page || '—'} · {t.user_agent || ''}</p>
              <TicketThread ticket={t} staff onChanged={load} />
            </>
          )}
        </div>
      ))}
    </>
  );
}

function Signups() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    supabase.from('signup_notifications').select('*').order('created_at', { ascending: false }).limit(200).then(({ data }) => setRows(data || []));
  }, []);
  if (rows === null) return <p className="muted">Loading…</p>;
  return (
    <div className="card">
      <h3>{rows.length} newest players</h3>
      <table className="table">
        <thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Email alert</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}><td>{r.display_name}</td><td>{r.email}</td><td>{fmtDate(r.created_at)}</td><td className="muted small">{r.notify_status || 'pending'}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FeedbackList() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    supabase.from('feedback').select('*').order('created_at', { ascending: false }).limit(200).then(({ data }) => setRows(data || []));
  }, []);
  if (rows === null) return <p className="muted">Loading…</p>;
  const avg = rows.length ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : 0;
  return (
    <>
      <div className="card profile-stats">
        <div><b>{rows.length}</b><span>responses</span></div>
        <div><b>{avg.toFixed(1)} ★</b><span>average rating</span></div>
      </div>
      {rows.map((r) => (
        <div key={r.id} className="card">
          <b className="stars-inline">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</b> <span className="chip">{r.category}</span>
          <p>{r.message || <span className="muted">(no message)</span>}</p>
          <p className="muted small">{r.email || 'anonymous'} · {r.page} · {fmtDate(r.created_at)}</p>
        </div>
      ))}
    </>
  );
}
