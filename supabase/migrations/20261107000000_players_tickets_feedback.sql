-- Survive 30 Sols backend: player profiles, support tickets, feedback and sign-up notifications.
-- Every table has row-level security: players only ever see their own rows; admins see everything.

create extension if not exists pg_net with schema extensions;

-- ---------- Profiles (one per auth user) ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null default 'Cadet',
  role text not null default 'player' check (role in ('player', 'admin')),
  best_difficulty text,
  missions_won int not null default 0,
  created_at timestamptz not null default now()
);

-- Security-definer helper so policies can ask "is the caller an admin?" without recursion.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin');
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

alter table public.profiles enable row level security;
create policy "profiles: read own or admin" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Players cannot promote themselves: only these columns are writable by them.
revoke update on public.profiles from authenticated;
grant update (display_name, best_difficulty, missions_won) on public.profiles to authenticated;

-- ---------- Sign-up log (one row per new player; drives the "new player" email) ----------
create table public.signup_notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  notify_status text
);
alter table public.signup_notifications enable row level security;
create policy "signups: admin read" on public.signup_notifications
  for select to authenticated using ((select public.is_admin()));

-- New auth user → profile + sign-up log row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  name text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), 'Cadet');
begin
  insert into public.profiles (id, email, display_name) values (new.id, new.email, left(name, 40))
  on conflict (id) do nothing;
  insert into public.signup_notifications (user_id, email, display_name) values (new.id, new.email, left(name, 40));
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Support tickets ----------
create table public.tickets (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  email text not null check (char_length(email) between 3 and 254),
  category text not null default 'bug' check (category in ('bug', 'account', 'gameplay', 'data', 'other')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  subject text not null check (char_length(subject) between 3 and 140),
  description text not null check (char_length(description) between 10 and 5000),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  page text check (char_length(page) <= 60),
  user_agent text check (char_length(user_agent) <= 400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  notified_at timestamptz,
  notify_status text
);
create index tickets_user_id_idx on public.tickets (user_id);
create index tickets_status_idx on public.tickets (status, created_at desc);
alter table public.tickets enable row level security;

-- Signed-in players file tickets as themselves; guests may file one with just an email.
create policy "tickets: insert own or guest" on public.tickets
  for insert to anon, authenticated
  with check (status = 'open' and (user_id is null or user_id = (select auth.uid())));
create policy "tickets: read own or admin" on public.tickets
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "tickets: admin update" on public.tickets
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
revoke insert on public.tickets from anon, authenticated;
grant insert (user_id, email, category, priority, subject, description, page, user_agent) on public.tickets to anon, authenticated;

-- Replies on a ticket (player <-> support conversation).
create table public.ticket_replies (
  id bigint generated always as identity primary key,
  ticket_id bigint not null references public.tickets (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  is_staff boolean not null default false,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index ticket_replies_ticket_idx on public.ticket_replies (ticket_id, created_at);
create index ticket_replies_author_idx on public.ticket_replies (author_id);
alter table public.ticket_replies enable row level security;
create policy "replies: read on own ticket or admin" on public.ticket_replies
  for select to authenticated using (
    (select public.is_admin())
    or exists (select 1 from public.tickets t where t.id = ticket_id and t.user_id = (select auth.uid()))
  );
create policy "replies: write on own ticket or admin" on public.ticket_replies
  for insert to authenticated with check (
    author_id = (select auth.uid())
    and (
      ((select public.is_admin()) and is_staff)
      or (not is_staff and exists (select 1 from public.tickets t where t.id = ticket_id and t.user_id = (select auth.uid())))
    )
  );

-- Keep updated_at fresh, and reopen a resolved ticket when the player answers.
create or replace function public.touch_ticket()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.tickets
     set updated_at = now(),
         status = case when not new.is_staff and status = 'resolved' then 'open' else status end
   where id = new.ticket_id;
  return new;
end;
$$;
create trigger on_ticket_reply after insert on public.ticket_replies
  for each row execute function public.touch_ticket();

create or replace function public.ticket_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end; $$;
create trigger tickets_updated_at before update on public.tickets
  for each row execute function public.ticket_updated_at();

-- ---------- Feedback ----------
create table public.feedback (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  email text check (email is null or char_length(email) between 3 and 254),
  rating int not null check (rating between 1 and 5),
  category text not null default 'general' check (category in ('general', 'fun', 'learning', 'difficulty', 'graphics', 'idea')),
  message text check (message is null or char_length(message) <= 3000),
  page text check (char_length(page) <= 60),
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  notify_status text
);
create index feedback_user_id_idx on public.feedback (user_id);
alter table public.feedback enable row level security;
create policy "feedback: insert own or guest" on public.feedback
  for insert to anon, authenticated with check (user_id is null or user_id = (select auth.uid()));
create policy "feedback: read own or admin" on public.feedback
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
revoke insert on public.feedback from anon, authenticated;
grant insert (user_id, email, rating, category, message, page) on public.feedback to anon, authenticated;

-- ---------- Email the team on every new sign-up, ticket and feedback ----------
-- pg_net calls the notify-admin Edge Function with just the table and row id. The function
-- re-reads the row with the service role and only emails rows that have not been emailed yet,
-- so calling it by hand can never send fake or duplicate mail.
create or replace function public.notify_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://tqsnopqlbvoljekbpuiv.supabase.co/functions/v1/notify-admin',
    body := jsonb_build_object('table', tg_table_name, 'id', new.id),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  -- Never block a sign-up or ticket because email is down.
  return new;
end;
$$;
create trigger signup_notify after insert on public.signup_notifications
  for each row execute function public.notify_admin();
create trigger ticket_notify after insert on public.tickets
  for each row execute function public.notify_admin();
create trigger feedback_notify after insert on public.feedback
  for each row execute function public.notify_admin();

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.notify_admin() from public, anon, authenticated;
revoke execute on function public.touch_ticket() from public, anon, authenticated;
