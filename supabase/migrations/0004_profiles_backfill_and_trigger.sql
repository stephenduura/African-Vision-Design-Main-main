-- Keep public.profiles synced with Supabase Auth users.
-- This backfills existing users and auto-creates a profile for every new signup.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_name text;
  profile_member_type member_type;
  profile_role text;
begin
  profile_name :=
    nullif(coalesce(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      split_part(coalesce(new.email, ''), '@', 1),
      'Member'
    ), '');

  profile_member_type :=
    case new.raw_user_meta_data->>'member_type'
      when 'organization' then 'organization'::member_type
      when 'volunteer' then 'volunteer'::member_type
      else 'individual'::member_type
    end;

  profile_role :=
    case
      when coalesce(new.raw_app_meta_data->>'role', '') = 'admin' then 'admin'
      else 'member'
    end;

  insert into public.profiles (
    id,
    email,
    name,
    avatar_url,
    member_type,
    role,
    created_at,
    updated_at
  )
  values (
    new.id::text,
    coalesce(new.email, ''),
    profile_name,
    nullif(new.raw_user_meta_data->>'avatar_url', ''),
    profile_member_type,
    profile_role,
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (id) do update
  set
    email = excluded.email,
    name = excluded.name,
    avatar_url = excluded.avatar_url,
    member_type = excluded.member_type,
    role = excluded.role,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_profiles_updated_at();

insert into public.profiles (
  id,
  email,
  name,
  avatar_url,
  member_type,
  role,
  created_at,
  updated_at
)
select
  u.id::text,
  coalesce(u.email, ''),
  nullif(
    coalesce(
      u.raw_user_meta_data->>'name',
      u.raw_user_meta_data->>'full_name',
      split_part(coalesce(u.email, ''), '@', 1),
      'Member'
    ),
    ''
  ),
  nullif(u.raw_user_meta_data->>'avatar_url', ''),
  case u.raw_user_meta_data->>'member_type'
    when 'organization' then 'organization'::member_type
    when 'volunteer' then 'volunteer'::member_type
    else 'individual'::member_type
  end,
  case
    when coalesce(u.raw_app_meta_data->>'role', '') = 'admin' then 'admin'
    else 'member'
  end,
  coalesce(u.created_at, now()),
  now()
from auth.users u
on conflict (id) do update
set
  email = excluded.email,
  name = excluded.name,
  avatar_url = excluded.avatar_url,
  member_type = excluded.member_type,
  role = excluded.role,
  updated_at = now();
