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
- `/readyz` returns 200 only when the application schema and migration ledger exist, the database runtime role is not superuser or BYPASSRLS, and customer-owned tables have forced RLS policies while not being owned by the runtime role.
- `/api/health` remains a compatibility alias for `/readyz`.
- A 503 from `/readyz` is intentional. Do not weaken the check to make a deployment appear healthy.

The application now ignores client-supplied owner IDs for chat, analytics and push APIs. Guests receive a signed, HttpOnly, SameSite cookie-backed identity; signed-in requests use a verified Neon Auth JWT. The server sets transaction-local PostgreSQL identity context for every application query. The presence of an RLS policy is not proof that its predicate is correct. Before enabling customer traffic, run cross-tenant read/write denial tests using two distinct authenticated customers and two guest identities.

## Environment variable handling

Verify presence in Render's dashboard without copying values into tickets, logs, source control, screenshots, or chat. At minimum, verify the configured production values for:

- `DATABASE_URL`
- `NEON_AUTH_BASE_URL`
- `ALLOWED_ORIGIN`
- `GROQ_API_KEY` (if AI chat is enabled)
- `VAPID_PUBLIC`, `VAPID_PRIVATE`, `VAPID_EMAIL` (if push is enabled)\n- `METRICS_TOKEN` (generate a high-entropy random token; configure the monitoring scraper to send it as a Bearer token)\n- `GUEST_SESSION_SECRET` (at least 32 random bytes; keep stable across instances and restarts; never expose it to the browser)

Never print secret values. A present variable is not proof that the credential is valid or points to the intended production resource.

## External gates not solved by a Git commit

1. Provision and migrate the intended production database through the reviewed migration chain. Create a separate login role, e.g. `earth_app_login`, with `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOBYPASSRLS`, grant membership in `earth_app_runtime` to that login, and use only the login role in Render's `DATABASE_URL`. The login must not own tables and must not be a member of any BYPASSRLS role. Then grant the group role: `GRANT earth_app_runtime TO earth_app_login;` and grant only `CONNECT` on the intended database as required. Verify `rolsuper=false`, `rolbypassrls=false`, `rolinherit=true`, no table ownership, and no membership in privileged roles. Never use the migration-owner connection string for the web process.
2. Verify Neon Auth email sender configuration, OTP, password recovery, sign-in/out, refresh and revocation in a real browser.
3. Generate and set a matching VAPID key pair, subscribe a real browser, and confirm delivery and unsubscribe.
4. Configure durable backups, retention, restore testing, and written RPO/RTO.
5. Configure an external Prometheus-compatible scraper for `/metrics` using `Authorization: Bearer <METRICS_TOKEN>`; set alerts for availability, elevated 5xx rates, latency, and resource pressure, then verify a test alert reaches an on-call recipient. The endpoint exposes process and aggregate request metrics only; it does not itself deliver alerts.
6. Run complete browser journeys against a staging deployment with production-equivalent settings.
7. Record the deployed commit SHA, migration version, rollback point, test evidence and approver.

Until these gates are evidenced, the release decision remains **NO-GO for live customer onboarding and paid transactions**.
