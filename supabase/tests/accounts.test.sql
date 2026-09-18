begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000001', 'rls-first@example.test'),
  ('10000000-0000-0000-0000-000000000002', 'rls-second@example.test');
insert into public.accessibility_profiles (user_id, preferences) values
  ('10000000-0000-0000-0000-000000000001', '{"avoidStairs":true}'),
  ('10000000-0000-0000-0000-000000000002', '{"avoidStairs":false}');
insert into public.favorite_locations (id, user_id, label, lng, lat) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'First private place', -122.33, 47.60),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Second private place', -122.34, 47.61);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select count(*) from public.accessibility_profiles), 1::bigint, 'only own profile is visible');
select is((select count(*) from public.favorite_locations), 1::bigint, 'only own favorites are visible');
select lives_ok($$update public.accessibility_profiles set preferences = '{"avoidStairs":true}' where user_id = '10000000-0000-0000-0000-000000000001'$$, 'owner can save profile');
select throws_ok($$insert into public.favorite_locations (user_id,label,lng,lat) values ('10000000-0000-0000-0000-000000000002','forged',0,0)$$, '42501', null, 'cannot write another owner');
select throws_ok($$update public.favorite_locations set user_id = '10000000-0000-0000-0000-000000000002' where id = '20000000-0000-0000-0000-000000000001'$$, '42501', null, 'cannot transfer ownership');
with changed as (update public.accessibility_profiles set preferences = '{}' where user_id = '10000000-0000-0000-0000-000000000002' returning *)
select is((select count(*) from changed), 0::bigint, 'cannot change another profile');
with removed as (delete from public.favorite_locations where user_id = '10000000-0000-0000-0000-000000000002' returning *)
select is((select count(*) from removed), 0::bigint, 'cannot remove another favorite');
with removed as (delete from public.favorite_locations where user_id = '10000000-0000-0000-0000-000000000001' returning *)
select is((select count(*) from removed), 1::bigint, 'owner can remove favorite');
set local role anon;
select throws_ok($$select * from public.accessibility_profiles$$, '42501', null, 'anonymous profile access denied');
select throws_ok($$select * from public.favorite_locations$$, '42501', null, 'anonymous favorites access denied');
reset role;
select * from finish();
rollback;