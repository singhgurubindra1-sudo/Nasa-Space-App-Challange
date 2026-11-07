// notify-admin: emails the Survive 30 Sols team when a player signs up, files a ticket or sends feedback.
//
// Called by Postgres triggers (pg_net) with { table, id } only. The function re-reads the row with the
// service role and emails it only if notified_at is still empty, so anyone calling this URL by hand can
// neither invent content nor trigger duplicate mail.
//
// Secrets (Supabase dashboard → Edge Functions → Secrets):
//   RESEND_API_KEY   API key from https://resend.com (free tier is fine)
//   ADMIN_EMAIL      where notifications go (comma-separated for several)
//   FROM_EMAIL       optional, defaults to "Survive 30 Sols <onboarding@resend.dev>"
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const TABLES = ['signup_notifications', 'tickets', 'feedback'] as const;
type Table = (typeof TABLES)[number];

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function compose(table: Table, row: Record<string, any>) {
  if (table === 'signup_notifications') {
    return {
      subject: `🚀 New player signed up: ${row.display_name || row.email}`,
      html: `<h2>A new cadet joined Survive 30 Sols</h2>
        <p><b>Name:</b> ${esc(row.display_name)}<br><b>Email:</b> ${esc(row.email)}<br><b>When:</b> ${esc(row.created_at)}</p>`,
    };
  }
  if (table === 'tickets') {
    return {
      subject: `🎫 Ticket #${row.id} [${row.priority}/${row.category}] ${row.subject}`,
      html: `<h2>New support ticket #${row.id}</h2>
        <p><b>From:</b> ${esc(row.email)} ${row.user_id ? '(signed in)' : '(guest)'}<br>
        <b>Category:</b> ${esc(row.category)} · <b>Priority:</b> ${esc(row.priority)}<br>
        <b>Page:</b> ${esc(row.page)}<br><b>Browser:</b> ${esc(row.user_agent)}</p>
        <h3>${esc(row.subject)}</h3><p style="white-space:pre-wrap">${esc(row.description)}</p>`,
    };
  }
  const stars = '★'.repeat(row.rating) + '☆'.repeat(5 - row.rating);
  return {
    subject: `💬 Feedback ${stars} (${row.category})`,
    html: `<h2>New player feedback</h2>
      <p><b>Rating:</b> ${stars}<br><b>Category:</b> ${esc(row.category)}<br>
      <b>From:</b> ${esc(row.email || 'anonymous')}<br><b>Page:</b> ${esc(row.page)}</p>
      <p style="white-space:pre-wrap">${esc(row.message || '(no message)')}</p>`,
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  let body: { table?: string; id?: number };
  try {
    body = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }
  const table = body.table as Table;
  const id = Number(body.id);
  if (!TABLES.includes(table) || !Number.isInteger(id)) return new Response('Bad request', { status: 400 });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const { data: row, error } = await db.from(table).select('*').eq('id', id).is('notified_at', null).maybeSingle();
  if (error) return new Response(error.message, { status: 500 });
  if (!row) return Response.json({ ok: true, skipped: 'already notified or missing' });

  const key = Deno.env.get('RESEND_API_KEY');
  const to = (Deno.env.get('ADMIN_EMAIL') || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!key || !to.length) {
    await db.from(table).update({ notify_status: 'skipped: RESEND_API_KEY or ADMIN_EMAIL not set' }).eq('id', id);
    return Response.json({ ok: true, skipped: 'email not configured' });
  }

  const { subject, html } = compose(table, row);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('FROM_EMAIL') || 'Survive 30 Sols <onboarding@resend.dev>',
      to,
      subject,
      html,
      ...(table === 'tickets' && row.email ? { reply_to: row.email } : {}),
    }),
  });
  const status = res.ok ? 'sent' : `error ${res.status}: ${(await res.text()).slice(0, 200)}`;
  await db.from(table).update({ notified_at: res.ok ? new Date().toISOString() : null, notify_status: status }).eq('id', id);
  return Response.json({ ok: res.ok, status });
});
