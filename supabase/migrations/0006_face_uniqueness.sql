-- ══════════════════════════════════════════════════════════════════════════
-- ARAM — one face, one account.
--
-- Face registration used to overwrite app_user.face_template unconditionally, so
-- the same child could register twice (different nickname, different PIN) and end
-- up with two accounts, two session histories, and two halves of a safeguarding
-- picture that nobody could join back together.
--
-- From here a descriptor is refused if it already belongs to ANY active account:
-- every school, and every role. Checking across roles as well as schools closes a
-- real hole — the same person holding both a student and a staff account.
--
-- A refusal is deliberately quiet about WHO the face matched. Like
-- login_child_by_face, no distance is returned on a hit, so a caller cannot feel
-- their way towards a stored template by trying descriptors and watching the
-- number move.
--
-- Face matching is statistical, so this WILL occasionally refuse someone it has
-- never seen (siblings, and the plain fact that a 128-d descriptor is not an
-- identity). Nothing here locks a child out on its own: the face step stays
-- optional, and a refused child can still finish onboarding with a PIN. The
-- audit_log row is what lets staff find the ones the machine got wrong.
-- ══════════════════════════════════════════════════════════════════════════

-- The one place the match distance is defined for the database. Mirrors
-- FACE_MATCH_THRESHOLD in src/lib/faceApi.ts and backend/main.py; 0.6 is the
-- figure the rest of the app already uses for verification and face login.
create or replace function face_match_threshold()
returns double precision
language sql
immutable
as $$ select 0.6::double precision $$;

-- The closest active account to a descriptor, ignoring one user id so that a child
-- retaking their own photo matches only themselves and is not told they are a
-- duplicate of themselves.
create or replace function find_face_owner(p_descriptor jsonb, p_exclude_user_id uuid default null)
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
  cross join lateral (
    select sqrt(sum(power(a.value::text::double precision - b.value::text::double precision, 2))) as distance
    from jsonb_array_elements(u.face_template) with ordinality a(value, position)
    join jsonb_array_elements(p_descriptor) with ordinality b(value, position) using (position)
  ) d
  where u.face_template is not null
    -- Length-checked on the way in: a stored template that is empty or the wrong
    -- shape would make sum() return NULL, and a NULL distance passing the threshold
    -- test below would refuse EVERY face in the school. One bad row must not do that.
    and jsonb_typeof(u.face_template) = 'array'
    and jsonb_array_length(u.face_template) = 128
    and u.is_active
    and (p_exclude_user_id is null or u.id <> p_exclude_user_id)
  order by d.distance
  limit 1;

  if v_user_id is null or v_distance is null or v_distance >= face_match_threshold() then
    return json_build_object('found', false);
  end if;

  -- Role only. Never the distance, never the name, never the id of the match.
  return json_build_object('found', true, 'role', v_role);
end;
$$;

-- ─────────────────────────── Student face ───────────────────────────
-- Returns json now instead of void, so a duplicate is an ordinary answer the UI can
-- act on rather than an exception the child sees as "something went wrong".
drop function if exists register_face(uuid, jsonb);
create function register_face(p_child_id uuid, p_descriptor jsonb)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid;
  v_owner json;
begin
  if jsonb_typeof(p_descriptor) <> 'array' or jsonb_array_length(p_descriptor) <> 128 then
    raise exception 'Invalid face descriptor';
  end if;

  select c.user_id into v_user_id from child c where c.id = p_child_id;
  if v_user_id is null then
    raise exception 'Student not found';
  end if;

  v_owner := find_face_owner(p_descriptor, v_user_id);
  if (v_owner ->> 'found')::boolean then
    -- child_id is left null on purpose: audit_log cascades on child delete, and this
    -- row has to outlive the half-made account that discard_unfinished_child removes.
    insert into audit_log (event_type, payload)
    values (
      'face_duplicate_blocked',
      json_build_object('child_id', p_child_id, 'existing_role', v_owner ->> 'role')::jsonb
    );
    return json_build_object('ok', false, 'reason', 'duplicate', 'existing_role', v_owner ->> 'role');
  end if;

  update app_user set face_template = p_descriptor, updated_at = now() where id = v_user_id;
  return json_build_object('ok', true);
end;
$$;

-- ─────────────────────────── Staff face ───────────────────────────
-- Same rule, raised as a unique violation (23505) so the API can answer 409 without
-- string-matching an error message.
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
  if p_face_template is not null and (find_face_owner(p_face_template, null) ->> 'found')::boolean then
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

-- ─────────────────── Discarding the duplicate account ───────────────────
-- The child row is created at S03, before the face step, so a duplicate detected at
-- S05b has already produced an account. This removes it.
--
-- It is exposed to anon like every other RPC, so it is bounded to records that never
-- finished onboarding: both consents still false AND no session rows. A finished
-- account can never be deleted through this path, whatever id is passed in.
create or replace function discard_unfinished_child(p_child_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v child%rowtype;
begin
  select * into v from child where id = p_child_id;
  if not found then
    return json_build_object('ok', true, 'removed', false);
  end if;

  if v.parent_consent or v.child_assent
     or exists (select 1 from session where child_id = p_child_id) then
    return json_build_object('ok', false, 'reason', 'finalised');
  end if;

  insert into audit_log (event_type, payload)
  values (
    'duplicate_onboarding_discarded',
    json_build_object('child_id', p_child_id, 'school_id', v.school_id)::jsonb
  );

  -- app_user cascades to child; the second delete covers a legacy row with no user.
  if v.user_id is not null then
    delete from app_user where id = v.user_id;
  end if;
  delete from child where id = p_child_id;

  return json_build_object('ok', true, 'removed', true);
end;
$$;

-- register_face lost its 0002 grant when it was dropped and recreated with a new
-- return type, so it is re-granted here.
grant execute on function register_face(uuid, jsonb) to anon, authenticated;
grant execute on function discard_unfinished_child(uuid) to anon, authenticated;

-- face_match_threshold() and find_face_owner() are NOT granted. They are only ever
-- called from inside the SECURITY DEFINER functions above, which run as the owner.
-- Exposing find_face_owner() directly would hand anyone an oracle for "is this face
-- in your database", which is exactly what this migration exists to protect.
revoke execute on function face_match_threshold() from public;
revoke execute on function find_face_owner(jsonb, uuid) from public;
