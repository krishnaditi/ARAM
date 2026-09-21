-- ══════════════════════════════════════════════════════════════════════════
-- ARAM — cluster selection (C01–C06).
--
-- What a child picks at the start of a session lands in two places:
--
--   cluster_flag    one row per CANONICAL issue id the child confirmed, with the
--                   feelings they attached and the rank they gave it. This is the
--                   prevalence table. An item that is cross-listed into a second
--                   sub-cluster still produces exactly ONE row — the unique
--                   constraint on (session_id, issue_id) makes double counting
--                   impossible rather than merely unlikely.
--
--   safeguard_flag  amber and red disclosures, written the MOMENT they are made,
--                   not on confirm. A child who backs out of a disclosure has
--                   still made it, and staff still need to see it. Nothing in
--                   this schema can retract one.
--
-- Free text a child typed themselves is stored on the cluster_flag row. It is the
-- only free-form personal content the app holds, so it stays inside the database
-- behind the same SECURITY DEFINER wall as everything else.
-- ══════════════════════════════════════════════════════════════════════════

-- Sessions after the first are opened here, when the child enters C01.
alter table session add column if not exists amber_count integer not null default 0;

create table if not exists cluster_flag (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references session (id) on delete cascade,
  child_id       uuid references child (id) on delete cascade,
  -- Canonical issue id from the taxonomy (e.g. 'a1', 'lv3'), or 'free_<sub>_<n>'.
  issue_id       text not null,
  cluster_id     text not null,
  sub_id         text not null,
  -- Where the child actually tapped it. Browse-path analysis only — never a count.
  entry_sub_id   text,
  feeling_tags   text[] not null default '{}',
  flag           text check (flag in ('amber', 'red')),
  free_text      text,
  priority_rank  integer not null,
  created_at     timestamptz not null default now(),
  -- One canonical id = one row = one count, per session.
  unique (session_id, issue_id)
);
create index if not exists idx_cluster_flag_session on cluster_flag (session_id);
create index if not exists idx_cluster_flag_issue on cluster_flag (issue_id);

create table if not exists safeguard_flag (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references session (id) on delete cascade,
  child_id    uuid references child (id) on delete cascade,
  issue_id    text not null,
  severity    text not null check (severity in ('amber', 'red')),
  cluster_id  text,
  sub_id      text,
  -- 'review_24_48h' for amber, 'immediate' for red. Set by the RPC, not the client.
  escalation  text not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_safeguard_session on safeguard_flag (session_id);
create index if not exists idx_safeguard_severity on safeguard_flag (severity, created_at desc);

alter table cluster_flag    enable row level security;
alter table safeguard_flag  enable row level security;

-- ─────────────────────────── Security RPCs ───────────────────────────

-- Opens a SESSION for this sitting. Onboarding creates session #1; every later
-- "Start session" tap comes through here.
create or replace function start_session(p_child_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_number integer;
begin
  if not exists (select 1 from child where id = p_child_id and parent_consent and child_assent) then
    raise exception 'Child not found, or consent not on record';
  end if;

  select coalesce(max(session_number), 0) + 1 into v_number
  from session where child_id = p_child_id;

  insert into session (child_id, session_number)
  values (p_child_id, v_number)
  returning id into v_session_id;

  return json_build_object('session_id', v_session_id, 'session_number', v_number);
end;
$$;

-- Amber or red, written immediately on disclosure. Red also flips the session's
-- red_emergency_flag, which is what makes the assessment be skipped downstream.
create or replace function raise_safeguard_flag(
  p_session_id uuid,
  p_issue_id text,
  p_severity text,
  p_cluster_id text,
  p_sub_id text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_child_id uuid;
  v_id uuid;
begin
  if p_severity not in ('amber', 'red') then
    raise exception 'severity must be amber or red';
  end if;

  select child_id into v_child_id from session where id = p_session_id;
  if v_child_id is null then
    raise exception 'Session not found';
  end if;

  insert into safeguard_flag (session_id, child_id, issue_id, severity, cluster_id, sub_id, escalation)
  values (
    p_session_id, v_child_id, p_issue_id, p_severity, p_cluster_id, p_sub_id,
    case when p_severity = 'red' then 'immediate' else 'review_24_48h' end
  )
  returning id into v_id;

  if p_severity = 'red' then
    update session set red_emergency_flag = true, band = 'red' where id = p_session_id;
    insert into audit_log (child_id, session_id, event_type, payload)
    values (v_child_id, p_session_id, 'red_emergency_cluster', json_build_object('issue_id', p_issue_id)::jsonb);
  end if;

  return v_id;
end;
$$;

-- Writes the whole confirmed basket in one transaction and moves the session on.
-- p_items is the JSON array the client sends; each element carries issue_id,
-- cluster_id, sub_id, entry_sub_id, feeling_tags, flag, free_text, priority_rank.
create or replace function save_cluster_selection(p_session_id uuid, p_items jsonb)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_child_id uuid;
  v_amber integer;
  v_rows integer;
begin
  select child_id into v_child_id from session where id = p_session_id;
  if v_child_id is null then
    raise exception 'Session not found';
  end if;

  insert into cluster_flag (
    session_id, child_id, issue_id, cluster_id, sub_id, entry_sub_id,
    feeling_tags, flag, free_text, priority_rank
  )
  select
    p_session_id,
    v_child_id,
    item ->> 'issue_id',
    item ->> 'cluster_id',
    item ->> 'sub_id',
    item ->> 'entry_sub_id',
    coalesce(
      (select array_agg(tag) from jsonb_array_elements_text(item -> 'feeling_tags') as tag),
      '{}'
    ),
    nullif(item ->> 'flag', ''),
    nullif(item ->> 'free_text', ''),
    (item ->> 'priority_rank')::integer
  from jsonb_array_elements(p_items) as item
  -- Re-confirming a basket must not double count; the newest rank wins.
  on conflict (session_id, issue_id) do update set
    feeling_tags  = excluded.feeling_tags,
    priority_rank = excluded.priority_rank,
    free_text     = excluded.free_text;

  get diagnostics v_rows = row_count;

  select count(*) into v_amber
  from safeguard_flag where session_id = p_session_id and severity = 'amber';

  -- Carried into the assessment so band routing can weight safeguarding load
  -- alongside symptom severity.
  update session set amber_count = v_amber where id = p_session_id;

  insert into audit_log (child_id, session_id, event_type, payload)
  values (
    v_child_id, p_session_id, 'cluster_selection_complete',
    json_build_object('n_issues', v_rows, 'amber', v_amber)::jsonb
  );

  return json_build_object('rows', v_rows, 'amber_count', v_amber);
end;
$$;

grant execute on function start_session(uuid) to anon, authenticated;
grant execute on function raise_safeguard_flag(uuid, text, text, text, text) to anon, authenticated;
grant execute on function save_cluster_selection(uuid, jsonb) to anon, authenticated;
