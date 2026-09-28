-- ══════════════════════════════════════════════════════════════════════════
-- ARAM — show the signup email on the child's profile.
--
-- The device never stores the email (0009_child_email.sql), so the profile screen
-- reads it from here. Same function as 0008, with `email` added.
-- ══════════════════════════════════════════════════════════════════════════

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
    'email', v.email,
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
