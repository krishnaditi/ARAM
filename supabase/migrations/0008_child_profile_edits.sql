-- ══════════════════════════════════════════════════════════════════════════
-- ARAM — letting a child see and change their own details.
--
-- Three things a child can now do from their profile: rename themselves, change
-- their PIN, and withdraw the camera/voice opt-ins they gave at onboarding.
--
-- On the PIN challenge. The caller must present nickname, age band AND the current
-- PIN. Only the last of those actually proves anything: the nickname is printed on
-- the same screen, and the age band is a three-year bucket, so a guessed birthday
-- in roughly the right range passes. They are there as friction, so that finding an
-- unlocked device is not a one-tap account takeover. The current PIN is the control.
--
-- The date of birth itself is NOT sent here and is not stored anywhere — the device
-- derives the band from what the child types and sends only the band, exactly as it
-- does at signup. That is the whole reason the check can only ever be coarse, and it
-- is the right trade: a stored DOB (even hashed — a school child's birthday has only
-- a few thousand possibilities) would be worth more to an attacker than this check
-- is worth to us.
-- ══════════════════════════════════════════════════════════════════════════

-- Rename. child.nickname is the login key and app_user.display_name mirrors it, so
-- both move together or a child could rename themselves out of their own account.
create or replace function update_child_nickname(p_child_id uuid, p_nickname text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_clean text := trim(coalesce(p_nickname, ''));
begin
  if length(v_clean) = 0 or length(v_clean) > 80 then
    return json_build_object('ok', false, 'reason', 'invalid');
  end if;

  select user_id into v_user_id from child where id = p_child_id;
  if not found then
    raise exception 'Student not found';
  end if;

  update child set nickname = v_clean where id = p_child_id;
  if v_user_id is not null then
    update app_user set display_name = v_clean, updated_at = now() where id = v_user_id;
  end if;

  insert into audit_log (child_id, event_type, payload)
  values (p_child_id, 'nickname_changed', '{}'::jsonb);

  return json_build_object('ok', true, 'nickname', v_clean);
end;
$$;

-- Change the PIN. Refuses a locked account: a child who has been locked out needs a
-- staff unlock, not a self-service reset, or the lockout would mean nothing.
create or replace function change_child_pin(
  p_child_id uuid,
  p_nickname text,
  p_age_group text,
  p_current_pin text,
  p_new_pin text
) returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v child%rowtype;
begin
  if p_new_pin !~ '^[0-9]{4}$' then
    return json_build_object('ok', false, 'reason', 'invalid_new_pin');
  end if;

  select * into v from child where id = p_child_id;
  if not found then
    raise exception 'Student not found';
  end if;
  if v.locked then
    return json_build_object('ok', false, 'reason', 'locked');
  end if;

  if lower(trim(coalesce(p_nickname, ''))) <> lower(trim(v.nickname)) then
    return json_build_object('ok', false, 'reason', 'details_mismatch');
  end if;
  if coalesce(p_age_group, '') <> coalesce(v.age_group, '') then
    return json_build_object('ok', false, 'reason', 'details_mismatch');
  end if;

  -- A wrong current PIN counts against the same 3-attempt budget as the login screen,
  -- so this cannot be used as an unlimited oracle for guessing it.
  if v.pin_hash <> crypt(p_current_pin, v.pin_hash) then
    update child
      set failed_pin_attempts = failed_pin_attempts + 1,
          locked = (failed_pin_attempts + 1 >= 3)
      where id = p_child_id
      returning * into v;
    return json_build_object(
      'ok', false,
      'reason', case when v.locked then 'locked' else 'wrong_pin' end,
      'remaining_attempts', greatest(0, 3 - v.failed_pin_attempts)
    );
  end if;

  if crypt(p_new_pin, v.pin_hash) = v.pin_hash then
    return json_build_object('ok', false, 'reason', 'same_pin');
  end if;

  update child
    set pin_hash = crypt(p_new_pin, gen_salt('bf', 10)),
        failed_pin_attempts = 0
    where id = p_child_id;

  insert into audit_log (child_id, event_type, payload)
  values (p_child_id, 'pin_changed', '{}'::jsonb);

  return json_build_object('ok', true);
end;
$$;

-- Withdrawing consent has to be as easy as giving it, so camera and voice are
-- editable. Parent consent and child assent are NOT: those are the record that the
-- session was lawful to begin with, and a child cannot retro-fit them either way.
create or replace function update_child_optins(
  p_child_id uuid,
  p_camera_opt_in boolean,
  p_voice_opt_in boolean
) returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  update child
    set biometric_opt_in = p_camera_opt_in,
        voice_opt_in = p_voice_opt_in
    where id = p_child_id;
  if not found then
    raise exception 'Student not found';
  end if;

  update student_consent
    set camera_opt_in = p_camera_opt_in,
        voice_opt_in = p_voice_opt_in,
        updated_at = now()
    where child_id = p_child_id;

  insert into audit_log (child_id, event_type, payload)
  values (
    p_child_id, 'optins_changed',
    json_build_object('camera', p_camera_opt_in, 'voice', p_voice_opt_in)::jsonb
  );

  return json_build_object('ok', true);
end;
$$;

-- Server truth for the profile screen. The EMIS school name/district are not in this
-- database (they come from the registry lookup on the device), so they are not here.
create or replace function get_child_profile(p_child_id uuid)
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
    raise exception 'Student not found';
  end if;

  return json_build_object(
    'nickname', v.nickname,
    'age_group', v.age_group,
    'language', v.language,
    'school_id', v.school_id,
    'parent_consent', v.parent_consent,
    'child_assent', v.child_assent,
    'camera_opt_in', v.biometric_opt_in,
    'voice_opt_in', v.voice_opt_in,
    'locked', v.locked,
    'created_at', v.created_at,
    'face_registered', (
      select u.face_template is not null from app_user u where u.id = v.user_id
    ),
    'sessions', (select count(*) from session where child_id = p_child_id)
  );
end;
$$;

grant execute on function update_child_nickname(uuid, text) to anon, authenticated;
grant execute on function change_child_pin(uuid, text, text, text, text) to anon, authenticated;
grant execute on function update_child_optins(uuid, boolean, boolean) to anon, authenticated;
grant execute on function get_child_profile(uuid) to anon, authenticated;
