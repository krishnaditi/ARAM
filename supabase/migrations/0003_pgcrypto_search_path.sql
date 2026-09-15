-- ══════════════════════════════════════════════════════════════════════════
-- ARAM — make the SECURITY DEFINER RPCs find pgcrypto on hosted Supabase.
--
-- 0001/0002 declare every RPC as `security definer set search_path = public`.
-- That is correct on a plain PostgreSQL box, where `create extension pgcrypto`
-- installs crypt()/gen_salt() into `public`. Hosted Supabase, however, ships
-- pgcrypto pre-installed in the `extensions` schema, so the `create extension
-- if not exists` in 0001 is a no-op and the locked-down search_path hides
-- crypt()/gen_salt() from inside the functions:
--
--   psycopg.errors.UndefinedFunction: function gen_salt(unknown, integer)
--   does not exist  —  CONTEXT: PL/pgSQL function create_child(...)
--
-- Appending `extensions` to the search_path fixes the hosted case and is inert
-- on plain PostgreSQL: schemas listed in a search_path that do not exist are
-- ignored rather than raising. The prefix stays `public` first, so this does
-- not widen what an untrusted schema could shadow.
--
-- Applied to every SECURITY DEFINER function in `public` rather than only the
-- four that call pgcrypto today, so RPCs added later cannot regress the same way.
-- ══════════════════════════════════════════════════════════════════════════

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute format(
      'alter function %s set search_path = public, extensions',
      fn.signature
    );
  end loop;
end $$;
