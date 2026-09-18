# Accounts and Private Preferences

The app integrates Supabase Auth and Postgres for email/password accounts, private access preferences, and explicitly saved destination favorites. Without configuration it remains usable in guest mode. Fresh deployments must provision their own project; the repository does not provision one automatically.

## Current Local Deployment

- Connected to a local development project in US West (Oregon), on the Free plan. Local configuration in `.env.local` contains only the project URL and publishable client key; no database password or secret API key was copied into the app.
- Applied the account migration through the dashboard SQL editor. Ten live pgTAP ownership tests passed, including cross-user writes and anonymous-read denial. Test users and records were rolled back. SQL-editor execution does not register this migration in the CLI migration history; reconcile that history before adopting `supabase db push` rather than rerunning the initial create-table migration.
- Email registration and email confirmation are enabled. The server password minimum is 12 characters. Site URL is `http://localhost:5180/`; allowed redirects are that URL and `http://localhost:5180/?account=recovery`. Add the real HTTPS deployment URL before public launch.
- Verified the live auth settings endpoint, anonymous HTTP denial for both private tables, and the running app's registration form without HTTP mocks. Inbox delivery, confirmed-user sign-in, password recovery, and cross-device persistence still need end-to-end verification.
- **Public email registration remains blocked on custom SMTP.** The project currently uses Supabase's default mail service, which sends only to project-team email addresses and currently permits two emails per hour. Keep email confirmation enabled. Configure a verified sending domain and provider credentials directly in your project's SMTP settings in the [Supabase dashboard](https://supabase.com/dashboard), not in chat or `VITE_*` variables. See [Supabase's mail restrictions](https://supabase.com/docs/guides/auth/auth-smtp). Do not invite app users into the administrative team as a workaround.

## Deployment Setup

1. Create a Supabase project in the appropriate region. Apply [the migration](../supabase/migrations/202609170001_accounts.sql) with the SQL editor or the Supabase CLI. The migration enables and forces row-level security and grants only authenticated access, scoped to `auth.uid()` for reads and writes.
2. Enable email/password authentication and email confirmation. Set a password minimum of at least 12 characters in Supabase too; the browser is not a security boundary. Configure production SMTP, rate limits, and the provider's abuse protections before opening public registration.
3. Set the Auth Site URL to the deployed app URL. Add exact allowed redirect URLs for that URL and the same URL with `?account=recovery`. For local development, allow `http://localhost:5180/` and `http://localhost:5180/?account=recovery`. PKCE email links must be opened in the browser that requested them.
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to local environment configuration or your hosting build environment. The key must be the new `sb_publishable_...` key from Supabase's API Keys page. Do not use a secret key, service-role key, or database password. Restart Vite or rebuild after configuration changes. Existing ORS configuration is independent.
5. Before release, run the SQL ownership tests in [supabase/tests/accounts.test.sql](../supabase/tests/accounts.test.sql) against a disposable Supabase test project with pgTAP enabled. Then validate real email confirmation, password recovery, sign-in/out, and two-user isolation on the deployed instance. Mocked browser tests do not prove deployed RLS or email delivery.

## Data and Session Boundaries

- Email and credentials are handled by Supabase Auth. Passwords are never stored by application code. The SDK persists its session on the device; sign out on shared devices. Production must use HTTPS.
- Guest preferences remain in browser localStorage. Signing in does not automatically upload them. A new account starts with default preferences; only explicit profile saves are sent to the backend.
- Signed-in preferences and favorites are loaded from the account, never mirrored into guest localStorage. Account changes clear prior private in-memory data and discard stale reads. A failed profile load blocks routing and saving rather than routing with an unknown person's requirements. Reload retries the load.
- Profile saves are confirmed by the server before the UI closes. Favorites are saved only through an explicit action; there is no location-history table or automatic route-history upload.
- Local Patches remain device-local and shared by that browser's guest workflow; they are not made private by signing in. Signing out restores the guest profile. Favorites may be removed individually. Full account deletion is currently an operator action through Supabase Auth; cascading foreign keys remove the associated private rows.
- ORS receives route coordinates and the selected restrictions, but not the account email or mobility aid list. Geocoding and map/baseline requests use their existing external services.
- The database constrains payload size and location bounds. The client normalizes preference fields; RLS, not client filtering, enforces ownership. Keep the service-role key exclusively in trusted administrative environments.

## Verification Boundary

The repository includes unit and browser tests with mocked Supabase HTTP responses plus executable SQL authorization tests. Vitest also applies the actual migration in PGlite (embedded PostgreSQL) and verifies owner reads/writes, cross-user denial, anonymous denial, coordinate constraints, and cascading deletion. Its small `auth.uid()` fixture is not a live Supabase Auth service. The current local deployment's live verification is recorded above; other deployments must repeat it. Email delivery and complete account workflows are not established solely by a successful build or database-policy test.