-- Auto-creates a public.profiles row whenever Supabase Auth creates a new
-- auth.users row. `name` and `role` come from the metadata passed at
-- supabase.auth.signUp({ options: { data: { name, role } } }) time.
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
    coalesce((new.raw_user_meta_data ->> 'role')::"Role", 'SEEKER'::"Role")
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Prisma doesn't model the auth schema, so this FK is added by hand.
-- Deleting a Supabase Auth user cascades into deleting their profile (and,
-- via the profile relations' own onDelete: Cascade, everything under it).
alter table public.profiles
  add constraint profiles_id_fkey foreign key (id) references auth.users (id) on delete cascade;

-- Minimal RLS so Supabase Realtime (subscribed to by the browser via the
-- anon/authenticated client key) can push screening_runs/notifications
-- updates to their owning employer. All writes still go through Prisma with
-- the service-role connection from the server, which bypasses RLS entirely,
-- so these policies only ever gate SELECT for realtime subscriptions.
alter table public.screening_runs enable row level security;
alter table public.notifications enable row level security;

create policy "Employers can read their own screening runs via realtime"
  on public.screening_runs for select
  using (
    exists (
      select 1
      from public.jobs
      join public.companies on companies.id = jobs."companyId"
      where jobs.id = screening_runs."jobId"
        and companies."ownerUserId" = (select auth.uid())
    )
  );

create policy "Users can read their own notifications via realtime"
  on public.notifications for select
  using ("profileId" = (select auth.uid()));
