-- ══════════════════════════════════════════════════════════════════════════
-- ARAM — initial schema, RLS, and in-region security RPCs.
--
-- Deploy to a Supabase project created in the ap-south-1 (Mumbai) region so all
-- personal data stays in India (DPDP). All sensitive logic (PIN hashing/verify,
-- consent, session creation) runs INSIDE the database via SECURITY DEFINER
-- functions — never in a global Edge Function.
--
-- Data minimisation, matching the approved prototype:
--   • no full name (nickname only)   • no DOB (coarse age_group only)
--   • PIN stored only as a bcrypt hash (pgcrypto)   • biometrics never stored
-- ══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─────────────────────────────── Tables ───────────────────────────────

create table if not exists school (
  emis        text primary key,
  district    text,
  created_at  timestamptz not null default now()
);

create table if not exists child (
  id                  uuid primary key default gen_random_uuid(),
  school_id           text references school (emis),
  language            text not null default 'en' check (language in ('en', 'ta')),
  nickname            text not null,               -- display only, not a legal name
  age_group           text not null,               -- derived band; full DOB never stored
  pin_hash            text not null,               -- bcrypt via pgcrypto crypt()
  parent_consent      boolean not null default false,
  parent_consent_at   timestamptz,
  child_assent        boolean not null default false,
  child_assent_at     timestamptz,
  biometric_opt_in    boolean not null default false, -- camera
  voice_opt_in        boolean not null default false,
  failed_pin_attempts smallint not null default 0,
  locked              boolean not null default false,
  created_at          timestamptz not null default now()
);

create table if not exists session (
  id                 uuid primary key default gen_random_uuid(),
  child_id           uuid not null references child (id) on delete cascade,
  session_number     integer not null,
  started_at         timestamptz not null default now(),
  status             text not null default 'in_progress'
                       check (status in ('in_progress', 'completed', 'abandoned')),
  band               text check (band in ('green', 'amber', 'red')),
  red_emergency_flag boolean not null default false
);
create index if not exists idx_session_child on session (child_id);

create table if not exists audit_log (
  id          uuid primary key default gen_random_uuid(),
  child_id    uuid references child (id) on delete cascade,
  session_id  uuid references session (id) on delete set null,
  event_type  text not null,   -- e.g. clinician_alert, clinician_alert_reoffer_shown
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_child on audit_log (child_id);

-- ─────────────────────────────── RLS ───────────────────────────────
-- The anon/auth client never selects these tables directly; every access goes
-- through the SECURITY DEFINER RPCs below. RLS is enabled with NO permissive
-- policies, so direct table reads/writes from the client are denied by default.

alter table school     enable row level security;
alter table child      enable row level security;
alter table session    enable row level security;
alter table audit_log  enable row level security;

-- ─────────────────────────── Security RPCs ───────────────────────────

-- Create a CHILD record (identity + hashed PIN). Consents default false and are
-- written atomically with session creation in finalize_onboarding().
create or replace function create_child(
  p_emis text,
  p_language text,
  p_nickname text,
  p_age_group text,
  p_pin text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN must be exactly 4 digits';
  end if;
  if length(coalesce(trim(p_nickname), '')) = 0 then
    raise exception 'Nickname is required';
  end if;

  insert into school (emis) values (p_emis) on conflict (emis) do nothing;

  insert into child (school_id, language, nickname, age_group, pin_hash)
  values (
    p_emis,
    p_language,
    trim(p_nickname),
    p_age_group,
    crypt(p_pin, gen_salt('bf', 10))
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Write both consents + opt-ins and create SESSION #1 atomically.
-- Refuses to create a session unless BOTH parent consent and child assent are true.
create or replace function finalize_onboarding(
  p_child_id uuid,
  p_parent_consent boolean,
  p_child_assent boolean,
  p_camera_opt_in boolean,
  p_voice_opt_in boolean
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_number integer;
begin
  if not (p_parent_consent and p_child_assent) then
    raise exception 'Both parent consent and child assent are required';
  end if;

  update child set
    parent_consent    = true,
    parent_consent_at = now(),
    child_assent      = true,
    child_assent_at   = now(),
    biometric_opt_in  = p_camera_opt_in,
    voice_opt_in      = p_voice_opt_in
  where id = p_child_id;

  if not found then
    raise exception 'Child not found';
  end if;

  select coalesce(max(session_number), 0) + 1 into v_number
  from session where child_id = p_child_id;

  insert into session (child_id, session_number)
  values (p_child_id, v_number)
  returning id into v_session_id;

  return json_build_object('session_id', v_session_id, 'session_number', v_number);
end;
$$;

-- Verify a PIN. Rate-limited: 3 wrong attempts locks the account.
create or replace function verify_pin(p_child_id uuid, p_pin text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v child%rowtype;
  v_ok boolean;
begin
  select * into v from child where id = p_child_id;
  if not found then
    return json_build_object('ok', false, 'remaining_attempts', 0, 'locked', true);
  end if;
  if v.locked then
    return json_build_object('ok', false, 'remaining_attempts', 0, 'locked', true);
  end if;

  v_ok := (v.pin_hash = crypt(p_pin, v.pin_hash));

  if v_ok then
    update child set failed_pin_attempts = 0 where id = p_child_id;
    return json_build_object('ok', true, 'remaining_attempts', 3, 'locked', false);
  else
    update child
      set failed_pin_attempts = failed_pin_attempts + 1,
          locked = (failed_pin_attempts + 1 >= 3)
      where id = p_child_id
      returning * into v;
    return json_build_object(
      'ok', false,
      'remaining_attempts', greatest(0, 3 - v.failed_pin_attempts),
      'locked', v.locked
    );
  end if;
end;
$$;

-- Returning-user home context. A clinician_alert audit event that has not yet been
-- re-offered marks clinician_alert_pending = true (drives the S11 re-offer branch).
create or replace function get_returning_context(p_child_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_sessions integer;
  v_last timestamptz;
  v_pending boolean;
begin
  select nickname into v_name from child where id = p_child_id;

  select count(*), max(started_at) into v_sessions, v_last
  from session where child_id = p_child_id;

  select exists (
    select 1 from audit_log a
    where a.child_id = p_child_id
      and a.event_type = 'clinician_alert'
      and not exists (
        select 1 from audit_log r
        where r.child_id = p_child_id
          and r.event_type = 'clinician_alert_reoffer_shown'
          and r.created_at > a.created_at
      )
  ) into v_pending;

  return json_build_object(
    'name', coalesce(v_name, ''),
    'days_since_last', coalesce(extract(day from (now() - v_last))::int, 0),
    'streak', 0,
    'sessions_completed', coalesce(v_sessions, 0),
    'buddies_unlocked', 0,
    'achievements', 0,
    'clinician_alert_pending', coalesce(v_pending, false)
  );
end;
$$;

-- Record that the clinician-alert re-offer was shown (clears the pending flag once).
create or replace function clear_clinician_alert(p_child_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_log (child_id, event_type)
  values (p_child_id, 'clinician_alert_reoffer_shown');
end;
$$;

-- Expose only the RPCs to the anon/auth roles — never the base tables.
grant execute on function create_child(text, text, text, text, text) to anon, authenticated;
grant execute on function finalize_onboarding(uuid, boolean, boolean, boolean, boolean) to anon, authenticated;
grant execute on function verify_pin(uuid, text) to anon, authenticated;
grant execute on function get_returning_context(uuid) to anon, authenticated;
grant execute on function clear_clinician_alert(uuid) to anon, authenticated;
