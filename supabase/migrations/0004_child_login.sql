-- ══════════════════════════════════════════════════════════════════════════
-- ARAM — let a returning student sign in on a device that has never seen them.
--
-- verify_pin/verify_face both take the child_id the browser already holds, so they
-- can only answer "is this the right PIN for this child". A device that never saw
-- the child has no id to send, which is why a second browser offered registration
-- instead of login. These two functions are the missing lookup: they answer "which
-- child is this", and the client stores the id they return.
-- ══════════════════════════════════════════════════════════════════════════

-- Nickname + PIN. EMIS is optional and only narrows the search: nicknames are not
-- unique, so when several children share one the PIN decides, and if that is still
-- ambiguous the caller is told to ask for the school code rather than guessing.
create or replace function login_child_by_pin(p_nickname text, p_pin text, p_emis text default null)
returns json
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v record;
  v_match child%rowtype;
  v_matches int := 0;
  v_candidates int := 0;
begin
  if p_pin !~ '^[0-9]{4}$' then
    return json_build_object('ok', false, 'reason', 'invalid');
  end if;

  for v in
    select c.* from child c
    where lower(trim(c.nickname)) = lower(trim(p_nickname))
      and (p_emis is null or p_emis = '' or c.school_id = p_emis)
  loop
    v_candidates := v_candidates + 1;
    if not v.locked and v.pin_hash = crypt(p_pin, v.pin_hash) then
      v_matches := v_matches + 1;
      v_match := v;
    end if;
  end loop;

  if v_matches > 1 then
    return json_build_object('ok', false, 'reason', 'ambiguous');
  end if;

  if v_matches = 1 then
    update child set failed_pin_attempts = 0 where id = v_match.id;
    return json_build_object(
      'ok', true,
      'child_id', v_match.id,
      'nickname', v_match.nickname,
      'language', v_match.language,
      'age_group', v_match.age_group,
      'face_registered', (select u.face_template is not null from app_user u where u.id = v_match.user_id)
    );
  end if;

  -- Wrong PIN. Only counted against the account when the nickname picks out a
  -- single child, so a guessed nickname cannot lock out someone else's namesake.
  if v_candidates = 1 then
    update child
      set failed_pin_attempts = failed_pin_attempts + 1,
          locked = (failed_pin_attempts + 1 >= 3)
      where lower(trim(nickname)) = lower(trim(p_nickname))
        and (p_emis is null or p_emis = '' or school_id = p_emis);
  end if;

  return json_build_object('ok', false, 'reason',
    case when exists (
      select 1 from child
      where lower(trim(nickname)) = lower(trim(p_nickname)) and locked
        and (p_emis is null or p_emis = '' or school_id = p_emis)
    ) then 'locked' else 'invalid' end);
end;
$$;

-- Face. Compares the presented descriptor against every registered student face
-- (optionally only within one school) and returns the closest match inside the
-- same 0.6 threshold the rest of the app uses. No distance is returned on a miss,
-- so a caller cannot feel their way towards a stored face.
create or replace function login_child_by_face(p_descriptor jsonb, p_emis text default null)
returns json
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_best_id uuid;
  v_best_distance double precision;
begin
  if jsonb_typeof(p_descriptor) <> 'array' or jsonb_array_length(p_descriptor) <> 128 then
    return json_build_object('ok', false);
  end if;

  select c.id, d.distance into v_best_id, v_best_distance
  from child c
  join app_user u on u.id = c.user_id
  cross join lateral (
    select sqrt(sum(power(a.value::text::double precision - b.value::text::double precision, 2))) as distance
    from jsonb_array_elements(u.face_template) with ordinality a(value, position)
    join jsonb_array_elements(p_descriptor) with ordinality b(value, position) using (position)
  ) d
  where u.face_template is not null and u.is_active and not c.locked
    and (p_emis is null or p_emis = '' or c.school_id = p_emis)
  order by d.distance
  limit 1;

  if v_best_id is null or v_best_distance >= 0.6 then
    return json_build_object('ok', false);
  end if;

  return (
    select json_build_object(
      'ok', true,
      'child_id', c.id,
      'nickname', c.nickname,
      'language', c.language,
      'age_group', c.age_group,
      'face_registered', true
    )
    from child c where c.id = v_best_id
  );
end;
$$;

grant execute on function login_child_by_pin(text, text, text) to anon, authenticated;
grant execute on function login_child_by_face(jsonb, text) to anon, authenticated;
