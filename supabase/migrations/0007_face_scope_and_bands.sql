-- ══════════════════════════════════════════════════════════════════════════
-- ARAM — make the duplicate-face check survivable at scale.
--
-- 0006 compared every new face against every stored face in the country at a
-- single 0.6 threshold. That is the wrong error regime. 0.6 is tuned for
-- VERIFICATION ("is this the child who claims to be X?" — one comparison).
-- Duplicate detection is IDENTIFICATION ("is this anyone at all?" — N
-- comparisons), and false matches accumulate with N:
--
--     P(wrongly refused) ~= 1 - (1 - p)^N
--
-- At a per-comparison false match rate of even 0.1%, a thousand stored faces
-- refuses roughly two thirds of honest new students. Our population is worse
-- than the benchmarks that number comes from: children rather than adults,
-- one narrow age band per school, siblings, and classroom-lit tablet cameras.
--
-- Three changes:
--
--   1. SCOPE. Students are compared only against students at the same school,
--      which takes N from millions to hundreds. Staff stay global: there are
--      few of them, so N never grows enough to matter, and keeping them global
--      preserves the cross-role check that stops one person holding both a
--      student and a staff account.
--
--   2. BANDS. One threshold became two.
--        distance < 0.45  → block. Near-certain. Refuse to store, stop the flow.
--        0.45 .. 0.60     → review. Store NOTHING, let the child continue on a
--                           PIN, flag it for staff.
--        >= 0.60          → no match. Store normally.
--      The review band deliberately does not store the face. Two near-identical
--      templates would make face LOGIN ambiguous, and signing the wrong child
--      into someone else's session history is a far worse failure than that
--      child simply using their PIN.
--
--   3. OVERRIDE. Face registration becomes mandatory in the UI, so there has to
--      be a way past it for the children this gets wrong, for a broken camera,
--      and for a child with no usable face capture at all. authorise_face_skip()
--      is that door, and it needs a staff face to open.
-- ══════════════════════════════════════════════════════════════════════════

-- Distance below which a match is treated as certain enough to refuse an account.
-- Deliberately stricter than face_match_threshold(): refusing an honest child is
-- the more costly of the two errors this system can make.
create or replace function face_block_threshold()
returns double precision
language sql
immutable
as $$ select 0.45::double precision $$;

-- Replaces the 2-argument version from 0006. Dropped rather than overloaded so
-- there is no ambiguity about which one a call resolves to.
drop function if exists find_face_owner(jsonb, uuid);

-- p_scope_school_id null  → compare against every active account (staff registration)
-- p_scope_school_id set   → compare against all staff, plus students at that school
create or replace function find_face_owner(
  p_descriptor jsonb,
  p_exclude_user_id uuid,
  p_scope_school_id text
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid;
  v_role text;
  v_distance double precision;
begin
  if jsonb_typeof(p_descriptor) <> 'array' or jsonb_array_length(p_descriptor) <> 128 then
    return json_build_object('found', false);
  end if;

  select u.id, u.role::text, d.distance
    into v_user_id, v_role, v_distance
  from app_user u
  left join child c on c.user_id = u.id
  cross join lateral (
    select sqrt(sum(power(a.value::text::double precision - b.value::text::double precision, 2))) as distance
    from jsonb_array_elements(u.face_template) with ordinality a(value, position)
    join jsonb_array_elements(p_descriptor) with ordinality b(value, position) using (position)
  ) d
  where u.face_template is not null
    -- A stored template that is empty or the wrong shape makes sum() return NULL,
    -- and a NULL distance slipping past the band test below would refuse every
    -- face in the school. One bad row must not do that.
    and jsonb_typeof(u.face_template) = 'array'
    and jsonb_array_length(u.face_template) = 128
    and u.is_active
    and (p_exclude_user_id is null or u.id <> p_exclude_user_id)
    and (
      p_scope_school_id is null                       -- unscoped: everyone
      or u.role <> 'student'                          -- staff are always in scope
      or c.school_id is not distinct from p_scope_school_id  -- students: same school only
    )
  order by d.distance
  limit 1;

  if v_user_id is null or v_distance is null or v_distance >= face_match_threshold() then
    return json_build_object('found', false);
  end if;

  -- Role and a two-value band. Never the distance, the name, or the id: a caller
  -- must not be able to feel their way towards a stored template by watching a
  -- number move as they vary the descriptor.
  return json_build_object(
    'found', true,
    'role', v_role,
    'band', case when v_distance < face_block_threshold() then 'block' else 'review' end
  );
end;
$$;

-- ─────────────────────────── Student face ───────────────────────────
create or replace function register_face(p_child_id uuid, p_descriptor jsonb)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid;
  v_school_id text;
  v_owner json;
  v_band text;
begin
  if jsonb_typeof(p_descriptor) <> 'array' or jsonb_array_length(p_descriptor) <> 128 then
    raise exception 'Invalid face descriptor';
  end if;

  select c.user_id, c.school_id into v_user_id, v_school_id
  from child c where c.id = p_child_id;
  if v_user_id is null then
    raise exception 'Student not found';
  end if;

  v_owner := find_face_owner(p_descriptor, v_user_id, v_school_id);

  if (v_owner ->> 'found')::boolean then
    v_band := v_owner ->> 'band';
    -- child_id is left null on purpose: audit_log cascades on child delete, and these
    -- rows have to outlive the half-made account discard_unfinished_child removes.
    insert into audit_log (event_type, payload)
    values (
      case when v_band = 'block' then 'face_duplicate_blocked' else 'face_duplicate_review' end,
      json_build_object(
        'child_id', p_child_id,
        'school_id', v_school_id,
        'existing_role', v_owner ->> 'role'
      )::jsonb
    );

    if v_band = 'block' then
      return json_build_object('ok', false, 'reason', 'duplicate', 'existing_role', v_owner ->> 'role');
    end if;

    -- Review band: nothing stored, but onboarding is not stopped.
    return json_build_object('ok', true, 'stored', false, 'review', true);
  end if;

  update app_user set face_template = p_descriptor, updated_at = now() where id = v_user_id;
  return json_build_object('ok', true, 'stored', true, 'review', false);
end;
$$;

-- ─────────────────────────── Staff face ───────────────────────────
-- Unchanged rule, but now calling the 3-argument find_face_owner with a null scope:
-- staff are checked against every account, in every school and every role.
create or replace function create_staff_user(
  p_role app_user_role,
  p_display_name text,
  p_language text default 'en',
  p_employee_code text default null,
  p_school_id text default null,
  p_face_template jsonb default null
) returns uuid
language plpgsql
security definer
set search_path = public, extensions
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
  if p_face_template is not null
     and (find_face_owner(p_face_template, null, null) ->> 'found')::boolean then
    raise exception 'That face is already registered to another account'
      using errcode = '23505';
  end if;

  insert into app_user (role, display_name, preferred_language, face_template)
  values (p_role, trim(p_display_name), p_language, p_face_template)
  returning id into v_user_id;

  insert into staff_profile (user_id, employee_code, school_id)
  values (v_user_id, p_employee_code, p_school_id);
  return v_user_id;
end;
$$;

-- ─────────────────────── Staff override of the face step ───────────────────────
-- Face registration is mandatory from here, which means it WILL stand between a real
-- child and an account: a camera that will not start, a face the matcher refuses, a
-- child whose capture never resolves. This is the way past, and it costs a staff face
-- to use — matched at the strict threshold, because it bypasses a control.
--
-- It stores no face and grants no session. All it does is record that a named adult
-- authorised this child to continue without one.
create or replace function authorise_face_skip(p_child_id uuid, p_staff_descriptor jsonb)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_staff_id uuid;
  v_staff_name text;
  v_staff_role text;
  v_distance double precision;
begin
  if not exists (select 1 from child where id = p_child_id) then
    raise exception 'Student not found';
  end if;
  if jsonb_typeof(p_staff_descriptor) <> 'array' or jsonb_array_length(p_staff_descriptor) <> 128 then
    return json_build_object('ok', false);
  end if;

  select u.id, u.display_name, u.role::text, d.distance
    into v_staff_id, v_staff_name, v_staff_role, v_distance
  from app_user u
  cross join lateral (
    select sqrt(sum(power(a.value::text::double precision - b.value::text::double precision, 2))) as distance
    from jsonb_array_elements(u.face_template) with ordinality a(value, position)
    join jsonb_array_elements(p_staff_descriptor) with ordinality b(value, position) using (position)
  ) d
  where u.face_template is not null
    and jsonb_typeof(u.face_template) = 'array'
    and jsonb_array_length(u.face_template) = 128
    and u.is_active
    and u.role in ('headmaster', 'counsellor', 'admin')
  order by d.distance
  limit 1;

  if v_staff_id is null or v_distance is null or v_distance >= face_block_threshold() then
    return json_build_object('ok', false);
  end if;

  insert into audit_log (child_id, event_type, payload)
  values (
    p_child_id, 'face_step_overridden',
    json_build_object('staff_user_id', v_staff_id, 'staff_role', v_staff_role)::jsonb
  );

  return json_build_object('ok', true, 'staff_name', v_staff_name);
end;
$$;

grant execute on function register_face(uuid, jsonb) to anon, authenticated;
grant execute on function authorise_face_skip(uuid, jsonb) to anon, authenticated;

-- Still not granted: these are only ever called from inside the SECURITY DEFINER
-- functions above, which run as the owner. Exposing find_face_owner() directly would
-- hand anyone an oracle for "is this face in your database".
revoke execute on function face_block_threshold() from public;
revoke execute on function find_face_owner(jsonb, uuid, text) from public;
