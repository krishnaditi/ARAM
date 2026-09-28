-- ══════════════════════════════════════════════════════════════════════════
-- ARAM — one email, one student account.
--
-- Nickname and PIN are not unique, and the face step is optional, so nothing
-- stopped the same child from onboarding twice. An email address is now required
-- at signup and may belong to only one student account.
--
-- Stored lower-cased and trimmed, so "Asha@Mail.com " and "asha@mail.com" are the
-- same address. The unique index is the actual guarantee: two signups racing with
-- the same email cannot both commit. Rows created before this migration have no
-- email and are left alone (NULLs never collide in a unique index).
--
-- discard_unfinished_child deletes the child row, which frees its email again.
-- ══════════════════════════════════════════════════════════════════════════

alter table child add column if not exists email text;
alter table child drop constraint if exists child_email_format;
alter table child add constraint child_email_format
  check (email is null or (email = lower(trim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'));
create unique index if not exists idx_child_email_unique on child (email) where email is not null;

-- The 5-argument version is dropped rather than kept alongside: it is granted to anon,
-- and leaving it would be a way to create an account with no email at all.
drop function if exists create_child(text, text, text, text, text);

create function create_child(
  p_emis text,
  p_language text,
  p_nickname text,
  p_age_group text,
  p_pin text,
  p_email text
) returns uuid
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_child_id uuid;
  v_user_id uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if p_pin !~ '^[0-9]{4}$' then raise exception 'PIN must be exactly 4 digits'; end if;
  if length(coalesce(trim(p_nickname), '')) = 0 then raise exception 'Nickname is required'; end if;
  if p_language not in ('en', 'hi', 'ta', 'te', 'ml') then raise exception 'Unsupported language'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'A valid email is required'; end if;

  -- Checked up front so the common case never creates an app_user row it then has to
  -- roll back. The unique index still decides a genuine race.
  if exists (select 1 from child where email = v_email) then
    raise exception 'That email is already used by another account'
      using errcode = '23505', constraint = 'idx_child_email_unique';
  end if;

  insert into school (emis) values (p_emis) on conflict (emis) do nothing;
  insert into app_user (role, display_name, preferred_language)
  values ('student', trim(p_nickname), p_language)
  returning id into v_user_id;

  insert into child (user_id, school_id, language, nickname, age_group, pin_hash, email)
  values (v_user_id, p_emis, p_language, trim(p_nickname), p_age_group, crypt(p_pin, gen_salt('bf', 10)), v_email)
  returning id into v_child_id;

  insert into student_profile (child_id, preferred_language, age_group)
  values (v_child_id, p_language, p_age_group);
  insert into student_consent (child_id) values (v_child_id);
  insert into student_preference (child_id, preferred_language) values (v_child_id, p_language);
  return v_child_id;
end;
$$;

grant execute on function create_child(text, text, text, text, text, text) to anon, authenticated;
