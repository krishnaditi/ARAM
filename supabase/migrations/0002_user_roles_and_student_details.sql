-- ARAM — shared users, staff roles, and detailed student data.
-- Apply after 0001_init.sql in the same Supabase project.
-- All tables remain inaccessible directly to anon/authenticated clients; use RPCs.

do $$
begin
  create type app_user_role as enum ('student', 'parent', 'headmaster', 'counsellor', 'admin');
exception
  when duplicate_object then null;
end $$;

create table if not exists app_user (
  id                  uuid primary key default gen_random_uuid(),
  role                app_user_role not null,
  display_name        text not null check (length(trim(display_name)) > 0),
  preferred_language  text not null default 'en'
                        check (preferred_language in ('en', 'hi', 'ta', 'te', 'ml')),
  face_template       jsonb,
  auth_user_id        uuid unique,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_app_user_role_active on app_user (role, is_active);

create table if not exists admin_credential (
  user_id       uuid primary key references app_user (id) on delete cascade,
  username      text unique not null,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

-- A student already has a child row from 0001. This link gives every account one
-- common identity without duplicating the student's private onboarding record.
alter table child add column if not exists user_id uuid references app_user (id) on delete cascade;
alter table child drop constraint if exists child_language_check;
alter table child add constraint child_language_check
  check (language in ('en', 'hi', 'ta', 'te', 'ml'));
create unique index if not exists idx_child_user_id on child (user_id) where user_id is not null;

create table if not exists staff_profile (
  user_id             uuid primary key references app_user (id) on delete cascade,
  employee_code       text unique,
  organisation_name   text,
  school_id           text references school (emis),
  phone               text,
  email               text,
  created_at          timestamptz not null default now(),
  -- Parent accounts may be identified only through the parent_student link.
  check (length(coalesce(phone, '')) > 0 or length(coalesce(email, '')) > 0 or employee_code is not null or school_id is null)
);

-- Staff can be linked to multiple schools; parents can be linked to multiple children.
create table if not exists user_school (
  user_id             uuid not null references app_user (id) on delete cascade,
  school_id           text not null references school (emis) on delete cascade,
  relationship        text not null check (relationship in ('parent', 'headmaster', 'counsellor', 'admin')),
  created_at          timestamptz not null default now(),
  primary key (user_id, school_id, relationship)
);

create table if not exists parent_student (
  parent_user_id      uuid not null references app_user (id) on delete cascade,
  child_id            uuid not null references child (id) on delete cascade,
  relationship        text not null default 'parent' check (relationship in ('parent', 'guardian')),
  verified_at         timestamptz,
  created_at          timestamptz not null default now(),
  primary key (parent_user_id, child_id)
);

-- Detailed, privacy-conscious student profile. Never store DOB or legal name here.
create table if not exists student_profile (
  child_id            uuid primary key references child (id) on delete cascade,
  preferred_language  text not null default 'en'
                        check (preferred_language in ('en', 'hi', 'ta', 'te', 'ml')),
  age_group           text not null,
  gender              text,
  accessibility_needs jsonb not null default '{}'::jsonb,
  learning_context    jsonb not null default '{}'::jsonb,
  trusted_contacts    jsonb not null default '[]'::jsonb,
  emergency_plan      jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists student_consent (
  child_id            uuid primary key references child (id) on delete cascade,
  parent_consent     boolean not null default false,
  parent_consent_at  timestamptz,
  child_assent       boolean not null default false,
  child_assent_at    timestamptz,
  camera_opt_in      boolean not null default false,
  voice_opt_in       boolean not null default false,
  expires_at          timestamptz,
  updated_at          timestamptz not null default now()
);

create table if not exists student_preference (
  child_id            uuid primary key references child (id) on delete cascade,
  speech_on           boolean not null default true,
  preferred_language  text not null default 'en'
                        check (preferred_language in ('en', 'hi', 'ta', 'te', 'ml')),
  theme               text not null default 'system',
  updated_at          timestamptz not null default now()
);

create table if not exists student_assessment (
  id                  uuid primary key default gen_random_uuid(),
  child_id            uuid not null references child (id) on delete cascade,
  session_id          uuid references session (id) on delete cascade,
  assessment_type     text not null check (assessment_type in ('check_in', 'wellbeing', 'safety')),
  answers             jsonb not null default '{}'::jsonb,
  score               numeric,
  band                text check (band in ('green', 'amber', 'red')),
  completed_at        timestamptz not null default now()
);
create index if not exists idx_student_assessment_child on student_assessment (child_id, completed_at desc);

create table if not exists student_support_event (
  id                  uuid primary key default gen_random_uuid(),
  child_id            uuid not null references child (id) on delete cascade,
  actor_user_id       uuid references app_user (id) on delete set null,
  event_type          text not null check (event_type in ('note', 'referral', 'alert', 'follow_up')),
  details             jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);
create index if not exists idx_student_support_child on student_support_event (child_id, created_at desc);

alter table app_user enable row level security;
alter table admin_credential enable row level security;
alter table staff_profile enable row level security;
alter table user_school enable row level security;
alter table parent_student enable row level security;
alter table student_profile enable row level security;
alter table student_consent enable row level security;
alter table student_preference enable row level security;
alter table student_assessment enable row level security;
alter table student_support_event enable row level security;

-- Create a non-student account. Authentication must be added before production;
-- this RPC deliberately does not accept or store a password.
create or replace function create_staff_user(
  p_role app_user_role,
  p_display_name text,
  p_language text default 'en',
  p_employee_code text default null,
  p_school_id text default null,
  p_face_template jsonb default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if p_role not in ('parent', 'headmaster', 'counsellor', 'admin') then
    raise exception 'Invalid staff role';
  end if;
  if length(trim(coalesce(p_display_name, ''))) = 0 then
    raise exception 'Display name is required';
  end if;
  insert into app_user (role, display_name, preferred_language, face_template)
  values (p_role, trim(p_display_name), p_language, p_face_template)
  returning id into v_user_id;

  insert into staff_profile (user_id, employee_code, school_id)
  values (v_user_id, p_employee_code, p_school_id);
  return v_user_id;
end;
$$;

-- Seed the local testing administrator once. The password is stored only as bcrypt.
do $$
declare
  v_admin_id uuid;
begin
  select id into v_admin_id
  from app_user
  where role = 'admin' and display_name = 'Administrator'
  limit 1;
  if v_admin_id is null then
    insert into app_user (role, display_name, preferred_language)
    values ('admin', 'Administrator', 'en')
    returning id into v_admin_id;
    insert into staff_profile (user_id, employee_code, organisation_name)
    values (v_admin_id, 'ADMIN-LOCAL', 'ARAM');
  end if;
  insert into admin_credential (user_id, username, password_hash)
  values (v_admin_id, 'admin', crypt('aram-admin', gen_salt('bf', 10)))
  on conflict (username) do nothing;
end;
$$;

create or replace function verify_admin(p_username text, p_password text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_user app_user%rowtype;
begin
  select u.* into v_user
  from admin_credential c
  join app_user u on u.id = c.user_id
  where c.username = trim(p_username)
    and u.is_active
    and c.password_hash = crypt(p_password, c.password_hash);
  if not found then return json_build_object('ok', false); end if;
  return json_build_object('ok', true, 'user_id', v_user.id,
                           'display_name', v_user.display_name,
                           'preferred_language', v_user.preferred_language);
end;
$$;

create or replace function set_user_language(p_user_id uuid, p_language text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_language not in ('en', 'hi', 'ta', 'te', 'ml') then
    raise exception 'Unsupported language';
  end if;
  update app_user set preferred_language = p_language, updated_at = now()
  where id = p_user_id and is_active;
  if not found then raise exception 'Active user not found'; end if;
end;
$$;

-- Keep the existing student onboarding API while creating the normalized identity
-- and detailed student records introduced by this migration.
create or replace function create_child(
  p_emis text,
  p_language text,
  p_nickname text,
  p_age_group text,
  p_pin text
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_child_id uuid;
  v_user_id uuid;
begin
  if p_pin !~ '^[0-9]{4}$' then raise exception 'PIN must be exactly 4 digits'; end if;
  if length(coalesce(trim(p_nickname), '')) = 0 then raise exception 'Nickname is required'; end if;
  if p_language not in ('en', 'hi', 'ta', 'te', 'ml') then raise exception 'Unsupported language'; end if;

  insert into school (emis) values (p_emis) on conflict (emis) do nothing;
  insert into app_user (role, display_name, preferred_language)
  values ('student', trim(p_nickname), p_language)
  returning id into v_user_id;

  insert into child (user_id, school_id, language, nickname, age_group, pin_hash)
  values (v_user_id, p_emis, p_language, trim(p_nickname), p_age_group, crypt(p_pin, gen_salt('bf', 10)))
  returning id into v_child_id;

  insert into student_profile (child_id, preferred_language, age_group)
  values (v_child_id, p_language, p_age_group);
  insert into student_consent (child_id) values (v_child_id);
  insert into student_preference (child_id, preferred_language) values (v_child_id, p_language);
  return v_child_id;
end;
$$;

-- Store only the face descriptor, never the captured photo.
create or replace function register_face(p_child_id uuid, p_descriptor jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if jsonb_typeof(p_descriptor) <> 'array' or jsonb_array_length(p_descriptor) <> 128 then
    raise exception 'Invalid face descriptor';
  end if;
  update app_user u set face_template = p_descriptor, updated_at = now()
  from child c
  where c.id = p_child_id and c.user_id = u.id;
  if not found then raise exception 'Student not found'; end if;
end;
$$;

create or replace function verify_face(p_child_id uuid, p_descriptor jsonb)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_template jsonb;
  v_distance double precision;
begin
  select u.face_template into v_template
  from app_user u
  join child c on c.user_id = u.id
  where c.id = p_child_id and u.is_active;

  if v_template is null or jsonb_typeof(p_descriptor) <> 'array' or jsonb_array_length(p_descriptor) <> 128 then
    return json_build_object('ok', false, 'distance', 'Infinity'::float8);
  end if;

  select sqrt(sum(power(a.value::text::double precision - b.value::text::double precision, 2)))
    into v_distance
  from jsonb_array_elements(v_template) with ordinality a(value, position)
  join jsonb_array_elements(p_descriptor) with ordinality b(value, position)
    using (position);

  return json_build_object('ok', v_distance < 0.6, 'distance', v_distance);
end;
$$;

-- Return only dashboard-safe summary data. Detailed student records require a separate,
-- audited authorization layer before exposing them to staff dashboards.
create or replace function get_user_dashboard_summary(p_user_id uuid)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_user app_user%rowtype;
  v_students integer := 0;
  v_sessions integer := 0;
  v_alerts integer := 0;
begin
  select * into v_user from app_user where id = p_user_id and is_active;
  if not found then raise exception 'Active user not found'; end if;

  if v_user.role = 'parent' then
    select count(*) into v_students from parent_student where parent_user_id = p_user_id;
  elsif v_user.role in ('headmaster', 'counsellor', 'admin') then
    select count(distinct c.id), count(distinct s.id), count(*) filter (where a.event_type = 'clinician_alert')
      into v_students, v_sessions, v_alerts
      from child c
      left join session s on s.child_id = c.id
      left join audit_log a on a.child_id = c.id;
  end if;

  return json_build_object(
    'user_id', v_user.id,
    'role', v_user.role,
    'display_name', v_user.display_name,
    'preferred_language', v_user.preferred_language,
    'students', v_students,
    'sessions', v_sessions,
    'alerts', v_alerts
  );
end;
$$;

grant execute on function create_staff_user(app_user_role, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function verify_admin(text, text) to anon, authenticated;
grant execute on function set_user_language(uuid, text) to anon, authenticated;
grant execute on function get_user_dashboard_summary(uuid) to anon, authenticated;
grant execute on function register_face(uuid, jsonb) to anon, authenticated;
grant execute on function verify_face(uuid, jsonb) to anon, authenticated;
