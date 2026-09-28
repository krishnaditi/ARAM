-- ══════════════════════════════════════════════════════════════════════════
-- ARAM — "Forgot PIN" by email.
--
-- A child who has forgotten their PIN enters the email they signed up with
-- (0009_child_email.sql). If it belongs to a student account, they see their
-- nickname and age group (read-only) and choose a new PIN.
--
-- The email is not verified, so knowing a child's email is enough to reset their
-- PIN. That is the trade this flow makes; every reset is written to audit_log so
-- staff can see it. The full DOB cannot be shown because it was never stored.
--
-- A reset also clears the failed-attempt counter and the lock, since a locked
-- account is the usual reason a child ends up here.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function lookup_child_by_email(p_email text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v child%rowtype;
begin
  select * into v from child where email = lower(trim(coalesce(p_email, '')));
  if not found then
    return json_build_object('ok', false, 'reason', 'not_found');
  end if;
  return json_build_object('ok', true, 'nickname', v.nickname, 'age_group', v.age_group);
end;
$$;

create or replace function reset_child_pin_by_email(p_email text, p_new_pin text)
returns json
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

  select * into v from child where email = lower(trim(coalesce(p_email, '')));
  if not found then
    return json_build_object('ok', false, 'reason', 'not_found');
  end if;

  update child
    set pin_hash = crypt(p_new_pin, gen_salt('bf', 10)),
        failed_pin_attempts = 0,
        locked = false
    where id = v.id;

  insert into audit_log (child_id, event_type, payload)
  values (v.id, 'pin_reset_by_email', json_build_object('was_locked', v.locked)::jsonb);

  return json_build_object('ok', true);
end;
$$;

grant execute on function lookup_child_by_email(text) to anon, authenticated;
grant execute on function reset_child_pin_by_email(text, text) to anon, authenticated;
