begin;

create table public.accessibility_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  constraint preferences_object check (jsonb_typeof(preferences) = 'object' and octet_length(preferences::text) <= 10000)
);

create table public.favorite_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 500),
  lng double precision not null check (lng between -180 and 180),
  lat double precision not null check (lat between -90 and 90),
  unique (user_id, label, lng, lat)
);
create index favorite_locations_owner on public.favorite_locations(user_id);

alter table public.accessibility_profiles enable row level security;
alter table public.accessibility_profiles force row level security;
alter table public.favorite_locations enable row level security;
alter table public.favorite_locations force row level security;

revoke all on public.accessibility_profiles, public.favorite_locations from anon, authenticated;
grant select, insert, update, delete on public.accessibility_profiles, public.favorite_locations to authenticated;

create policy profiles_owner on public.accessibility_profiles for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy favorites_owner on public.favorite_locations for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

commit;