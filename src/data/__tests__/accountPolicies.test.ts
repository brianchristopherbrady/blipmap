import migration from "../../../supabase/migrations/202609170001_accounts.sql?raw";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const first = "10000000-0000-0000-0000-000000000001";
const second = "10000000-0000-0000-0000-000000000002";
let database: PGlite;

beforeAll(async () => {
  database = new PGlite();
  await database.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid$$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  await database.exec(migration);
}, 30000);

beforeEach(async () => {
  await database.exec(`reset role; truncate auth.users cascade;
    insert into auth.users values ('${first}'), ('${second}');
    insert into public.accessibility_profiles (user_id, preferences) values ('${first}', '{"avoidStairs":true}'), ('${second}', '{"avoidStairs":false}');
    insert into public.favorite_locations (user_id, label, lng, lat) values ('${first}', 'First private place', 0, 0), ('${second}', 'Second private place', 1, 1);
    set role authenticated;
  `);
  await database.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: first, role: "authenticated" })]);
});

afterAll(async () => { await database?.close(); });

describe("account ownership policies in PostgreSQL", () => {
  it("returns only the current owner's profile and favorites", async () => {
    const profiles = await database.query("select user_id from public.accessibility_profiles");
    const favorites = await database.query("select user_id from public.favorite_locations");
    expect(profiles.rows).toEqual([{ user_id: first }]);
    expect(favorites.rows).toEqual([{ user_id: first }]);
  });
  it("permits owner saves and deletes", async () => {
    const saved = await database.query("update public.accessibility_profiles set preferences = '{\"avoidStairs\":false}' returning preferences");
    expect(saved.rows).toEqual([{ preferences: { avoidStairs: false } }]);
    const removed = await database.query("delete from public.favorite_locations returning user_id");
    expect(removed.rows).toEqual([{ user_id: first }]);
  });
  it("rejects cross-user inserts, upserts, and ownership transfers", async () => {
    await expect(database.query("insert into public.favorite_locations (user_id,label,lng,lat) values ($1,'forged',0,0)", [second])).rejects.toMatchObject({ code: "42501" });
    await expect(database.query("insert into public.accessibility_profiles (user_id) values ($1) on conflict (user_id) do update set preferences = '{}'", [second])).rejects.toMatchObject({ code: "42501" });
    await expect(database.query("update public.favorite_locations set user_id = $1", [second])).rejects.toMatchObject({ code: "42501" });
  });
  it("does not update or delete another user's data through explicit filters", async () => {
    expect((await database.query("update public.accessibility_profiles set preferences = '{}' where user_id = $1 returning *", [second])).rows).toEqual([]);
    expect((await database.query("delete from public.favorite_locations where user_id = $1 returning *", [second])).rows).toEqual([]);
  });
  it("denies anonymous access and invalid coordinates", async () => {
    await expect(database.query("insert into public.favorite_locations (user_id,label,lng,lat) values ($1,'invalid',181,0)", [first])).rejects.toMatchObject({ code: "23514" });
    await database.exec("reset role; set role anon;");
    await expect(database.query("select * from public.accessibility_profiles")).rejects.toMatchObject({ code: "42501" });
    await expect(database.query("select * from public.favorite_locations")).rejects.toMatchObject({ code: "42501" });
  });
  it("cascades private data deletion when an operator deletes the auth account", async () => {
    await database.exec("reset role;");
    await database.query("delete from auth.users where id = $1", [first]);
    expect((await database.query("select * from public.accessibility_profiles where user_id = $1", [first])).rows).toEqual([]);
    expect((await database.query("select * from public.favorite_locations where user_id = $1", [first])).rows).toEqual([]);
  });
});