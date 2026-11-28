# Render deployment configuration — review required

This file is an operator runbook. It does not change the existing Render service and must not be treated as an applied configuration change.

## Existing service

- Service: `earth-solutions-ecg`
- Build command: `npm ci`
- Start command: `npm start`
- Runtime: Node.js 24.x (must match `package.json`)
- Health check path: `/readyz`
- Liveness endpoint: `/healthz` (process-only; do not use as the customer-readiness gate)

Do not apply these settings to the live service until the branch has passed CI, the production database has been migrated and isolated, and the service owner has approved the change. Do not create a second Render service from a Blueprint as a shortcut.

## Why npm ci

The live Render build previously reported seven npm audit findings while the remediation branch CI reported zero. The observed live deployment was on a different commit from the remediation branch. Compare the exact deployed SHA and lockfile before attributing the difference to npm itself.

Use `npm ci` so Render installs the committed lockfile without silently resolving a different dependency tree. After applying the build-command change, record the build log's Node and npm versions, deployed SHA, and `npm audit --omit=dev` plus full `npm audit` output. Do not call the issue resolved until the production build uses the reviewed lockfile and the audit is clean or every exception has a documented owner and expiry.

## Readiness contract

- `/healthz` returns 200 when the Node process is alive. It does not prove database availability.
- `/readyz` returns 200 only when production runtime configuration is complete, the application schema and migration ledger exist, the customer and admin connections use separate inherited memberships in their respective non-login roles, neither login is superuser/BYPASSRLS/CREATEROLE/CREATEDB or a table owner, all required application tables have forced RLS and policies, and the runtime login is not a member of the admin role. It checks the presence and basic shape of required secrets, not whether external providers will accept them.
- `/api/health` remains a compatibility alias for `/readyz`.
- A 503 from `/readyz` is intentional. Do not weaken the check to make a deployment appear healthy.

**Push endpoint trust boundary:** browser-supplied subscription endpoints are accepted only for recognized public push-service hosts (Google FCM, Mozilla Push, Apple Push and Microsoft WNS). Stored endpoints are revalidated immediately before delivery to reduce SSRF risk from old or tampered records. Admin broadcast click targets are restricted to same-origin paths. Do not broaden this allowlist without security review; the push endpoint is a user-provided outbound destination.

**Rate-limit scope limitation:** the Express-wide IP limiter is an in-process, per-instance safeguard with a bounded 10,000-key map. It is not a distributed/global quota and resets on process restart; multiple instances can each admit traffic independently. Chat has a separate database-backed quota path, but this does not make every endpoint globally rate-limited. Before horizontally scaling or exposing expensive endpoints, add a shared atomic limiter (for example Redis/Upstash) or a reviewed database-backed limiter, and test concurrency and fail-open/fail-closed behavior.

The application ignores client-supplied owner IDs for chat, history, analytics and push APIs. Guests receive a signed, HttpOnly, SameSite cookie-backed identity; signed-in requests use a verified Neon Auth JWT. The server sets transaction-local PostgreSQL identity and hashed rate-limit bucket context for application queries. Runtime SQL grants are restricted: customers cannot self-assign admin, mark payment orders paid, write payment events, delete quota rows or read unverified source material. The presence of an RLS policy is not proof that its predicate is correct.

**Important trust boundary:** PostgreSQL custom settings such as `app.auth_user_id` are mutable by a database session. These policies rely on the application server to set them only after verifying the Neon Auth JWT or signed guest cookie. They do not defend against arbitrary SQL execution under the shared runtime credential: an attacker with SQL injection capable of issuing arbitrary statements could attempt to change those settings. Parameterized SQL, no user-controlled SQL fragments, strict query boundaries, and injection testing are mandatory. Do not describe this GUC-based design as cryptographically isolated from a fully compromised runtime session. A stronger boundary for that threat model requires database-verified signed claims or a function-only/per-tenant-role architecture.

Before enabling customer traffic, run cross-tenant read/write denial tests using two distinct authenticated customers and two guest identities, including profiles, conversations, messages, quota, payment and push records.

## Environment variable handling

Verify presence in Render's dashboard without copying values into tickets, logs, source control, screenshots, or chat. At minimum, verify the configured production values for:

- `DATABASE_URL` (customer-facing runtime login; member of `earth_app_runtime` only)
- `ADMIN_DATABASE_URL` (separate privileged admin login; member of `earth_app_admin` only; use only from the server-side admin pool, never expose to browser)
- `NEON_AUTH_BASE_URL`
- `ALLOWED_ORIGIN`
- `GROQ_API_KEY` (required for production AI chat readiness)
- `VAPID_PUBLIC`, `VAPID_PRIVATE`, `VAPID_EMAIL` (if push is enabled)
- `METRICS_TOKEN` (generate a high-entropy random token; configure the monitoring scraper to send it as a Bearer token)
- `GUEST_SESSION_SECRET` (at least 32 random bytes; required by the production readiness gate; keep stable across instances and restarts; never expose it to the browser)

Never print secret values. A present variable is not proof that the credential is valid or points to the intended production resource.

## External gates not solved by a Git commit

1. Provision and migrate the intended production database through the reviewed nine-migration chain, using a dedicated migration credential. Migration `1789504075591` creates the non-login `earth_app_owner`, `earth_app_runtime`, and `earth_app_admin` group roles, transfers all 15 application tables to `earth_app_owner`, and forces RLS. The owner role must not be used by the web process. After the migration, create two login roles through Neon with **read-only access scoped to the `public` schema** (the group roles supply the narrowly scoped DML grants): `earth_app_runtime_login` and `earth_app_admin_login`. Then grant `earth_app_runtime` to `earth_app_runtime_login` with `INHERIT TRUE, SET TRUE`, and grant `earth_app_admin` to `earth_app_admin_login` with the same membership options. Use the runtime connection string only as `DATABASE_URL`; use the admin connection string only as `ADMIN_DATABASE_URL`. After provisioning, remove the Neon API's broad direct read-only grants so access comes only from the intended group role:
```sql
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM earth_app_runtime_login, earth_app_admin_login;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM earth_app_runtime_login, earth_app_admin_login;
```
Also inspect `pg_default_acl`. Revoke any default table grants that the Neon role-provisioning operation added for the database/migration owner (in the inspected staging project this was `peopole_app`):
```sql
ALTER DEFAULT PRIVILEGES FOR ROLE peopole_app IN SCHEMA public
  REVOKE SELECT ON TABLES FROM earth_app_runtime_login, earth_app_admin_login;
```
Use the actual role shown by `pg_default_acl` in the target project; do not assume it is named `peopole_app`. Re-check privileges on legacy tables such as `users`, `user_sessions`, and `admin_sessions`: neither application login should be able to read them. Both logins must be non-owners, non-superusers, non-BYPASSRLS, non-CREATEROLE and non-CREATEDB; runtime must not be an admin member and admin must not be a runtime member. The application uses a separate admin pool; never use either login for migrations. Keep the admin connection secret restricted to the application server. Verify `rolsuper=false`, `rolbypassrls=false`, `rolinherit=true`, no table ownership, forced RLS on all 15 tables, at least one reviewed policy per table, and exact role memberships. Never use the migration-owner connection string for the web process.
2. Verify Neon Auth email sender configuration, OTP, password recovery, sign-in/out, refresh and revocation in a real browser.
3. Generate and set a matching VAPID key pair, subscribe a real browser, and confirm delivery and unsubscribe.
4. Configure durable backups, retention, restore testing, and written RPO/RTO.
5. Configure an external Prometheus-compatible scraper for `/metrics` using `Authorization: Bearer <METRICS_TOKEN>`; set alerts for availability, elevated 5xx rates, latency, and resource pressure, then verify a test alert reaches an on-call recipient. The endpoint exposes process and aggregate request metrics only; it does not itself deliver alerts.
6. Run complete browser journeys against a staging deployment with production-equivalent settings.
7. Record the deployed commit SHA, migration version, rollback point, test evidence and approver.

Until these gates are evidenced, the release decision remains **NO-GO for live customer onboarding and paid transactions**.
