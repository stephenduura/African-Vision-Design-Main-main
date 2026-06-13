-- User profile records for Supabase Auth users.
-- The frontend upserts its own profile after login/signup, and the backend
-- reads profiles to render names, avatars, and roles without Clerk.

create table if not exists profiles (
  id text primary key,
  email text not null unique,
  name text not null,
  avatar_url text,
  member_type member_type not null default 'individual',
  role text not null default 'member',
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

alter table if exists profiles enable row level security;

drop policy if exists "profiles_select_own" on profiles;
create policy "profiles_select_own"
on profiles
for select
using (auth.uid()::text = id);

drop policy if exists "profiles_insert_own" on profiles;
create policy "profiles_insert_own"
on profiles
for insert
with check (auth.uid()::text = id);

drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own"
on profiles
for update
using (auth.uid()::text = id)
with check (auth.uid()::text = id);
