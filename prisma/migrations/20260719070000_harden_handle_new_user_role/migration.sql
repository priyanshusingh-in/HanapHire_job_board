-- Security fix: raw_user_meta_data is user-editable at signup time (anyone
-- calling the Auth API directly, not just our UI, can set arbitrary metadata).
-- The previous version of this trigger trusted that value for role
-- assignment, which let a self-signup request grant itself ADMIN.
--
-- Trusted role assignment (e.g. the seed script's admin account) must come
-- from raw_app_meta_data, which only the service role can set via
-- supabase.auth.admin.createUser({ app_metadata }). Public self-signup via
-- supabase.auth.signUp({ options: { data } }) can only ever reach
-- raw_user_meta_data, which is now whitelisted to SEEKER/EMPLOYER only —
-- ADMIN can never be self-assigned.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
  );
  return new;
end;
$$;
