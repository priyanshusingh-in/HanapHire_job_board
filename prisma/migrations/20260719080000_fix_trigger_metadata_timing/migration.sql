-- Bug fix: supabase.auth.admin.createUser({ app_metadata }) does not have
-- raw_app_meta_data populated at the exact instant the AFTER INSERT trigger
-- fires — verified empirically (the CASE/COALESCE logic is correct in
-- isolation; the live app_metadata that reaches the trigger row was empty).
-- Result: every admin-created EMPLOYER/ADMIN account silently became a
-- SEEKER. Never caught earlier because every account created before this
-- fix already existed (ensureAuthUser's early-return-if-exists skipped
-- re-creation), so the buggy path was never actually exercised until fresh
-- e2e test accounts hit it.
--
-- Fix: also react to UPDATEs on auth.users, and ONLY ever trust
-- raw_app_meta_data for a role change there — never raw_user_meta_data,
-- which stays user-editable post-signup and must never affect role (that's
-- the exact escalation path the previous hardening migration closed).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.profiles (id, email, name, role)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data ->> 'name', ''),
      coalesce(
        case
          when new.raw_app_meta_data ->> 'role' in ('SEEKER', 'EMPLOYER', 'ADMIN')
            then (new.raw_app_meta_data ->> 'role')::"Role"
        end,
        case
          when new.raw_user_meta_data ->> 'role' in ('SEEKER', 'EMPLOYER')
            then (new.raw_user_meta_data ->> 'role')::"Role"
        end,
        'SEEKER'::"Role"
      )
    )
    on conflict (id) do nothing;
  elsif tg_op = 'UPDATE' then
    if new.raw_app_meta_data ->> 'role' in ('SEEKER', 'EMPLOYER', 'ADMIN')
       and new.raw_app_meta_data ->> 'role' is distinct from old.raw_app_meta_data ->> 'role' then
      update public.profiles
      set role = (new.raw_app_meta_data ->> 'role')::"Role"
      where id = new.id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert or update on auth.users
  for each row execute function public.handle_new_user();
