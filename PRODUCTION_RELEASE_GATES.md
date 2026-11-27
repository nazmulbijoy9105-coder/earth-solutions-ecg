# Earth Solutions ECG — Production Release Gates

**Assessment date:** 27 November 2026  
**PR:** [#27](https://github.com/nazmulbijoy9105-coder/earth-solutions-ecg/pull/27) — draft, open, unmerged  
**Current release decision:** **NO-GO for live customer onboarding or paid transactions**

This report separates repository code and CI evidence from live infrastructure evidence. A passing test suite is not production approval.

## 1. Repository implementation and CI evidence

- Latest code-tested commit: `cbe616ad9d2ba5ce1968c8cb90d8d968891b1484`.
- CI run [#268](https://github.com/nazmulbijoy9105-coder/earth-solutions-ecg/actions/runs/45956382616): **30 tests passed, 0 failed**.
- `npm audit`: 0 vulnerabilities in the locked CI dependency tree.
- The full **nine-migration** chain applied to clean PostgreSQL 17; CI verified all 15 required application tables.
- The subsequent PR-head commit `f9e35015c3d4433e4e4fac5b42030a445fe26a9a` updates release documentation only. Re-run CI on the final head before merge.

### Database ownership and tenant isolation

- Migration `1789504075591_tenant-isolation-runtime-role` enables and forces RLS on all 15 application tables.
- It transfers ownership of all 15 application tables away from the previous web principal to the dedicated migration principal, then creates separate non-login, non-superuser, non-BYPASSRLS group roles: `earth_app_runtime` and `earth_app_admin`.
- Customer runtime and privileged admin operations use separate pools and credentials: `DATABASE_URL` and `ADMIN_DATABASE_URL`. The customer login must be a member of `earth_app_runtime` only; the admin login must be a member of `earth_app_admin` only. Neither login may own application tables.
- All application persistence queries require an explicit identity context and run in a transaction with transaction-local PostgreSQL settings.
- Customer identity is derived from a verified Neon Auth bearer token or a server-issued signed HttpOnly guest cookie using `GUEST_SESSION_SECRET`. Client-supplied owner IDs are ignored on chat, history, analytics and push APIs.
- Chat conversations/messages, daily quota rows, inquiries, analytics and push subscriptions are scoped to the authenticated account or signed guest. Payment tables have owner policies, but payment APIs are not implemented.
- CI creates separate test login roles and runs readiness through both real non-owner logins. PostgreSQL integration tests cover guest and authenticated account read/write isolation, denial of cross-tenant writes, rate-limit bucket isolation, inability of the runtime role to self-promote using a session variable, non-login/non-owner/non-BYPASSRLS role properties, denial of customer self-promotion to admin, denial of forged paid payment records, and cross-tenant visibility through the separate admin database role.
- Runtime SQL privileges are restricted by use: inquiry/analytics/audit writes only; payment-order creation only in `pending` state with no customer update/delete; payment events read-only; quota rows cannot be deleted by the runtime role; verified immigration sources are read-only; push subscriptions and customer conversations retain only the operations their flows need.
- Migration `1789504075592_account-owned-guest-quota` extends daily quota ownership to authenticated accounts. It is intentionally non-reversible; rollback requires a verified restore and reviewed data migration rather than silent deletion.

### Security boundary

The PostgreSQL identity settings are set by trusted server code and protect against missing tenant predicates and ordinary IDOR mistakes. Custom PostgreSQL settings can be changed by a principal holding the database credential; this RLS design is not a defense against a compromised runtime credential or arbitrary SQL execution. Maintain parameterized queries, secret isolation, SQL-injection testing and penetration testing. Admin privilege is separated at the database-login level, not through a client-controlled role field.

Historical `anon_*` guest rows are not automatically assigned to signed guest identities: the former client-supplied IDs did not prove ownership. Decide whether to export, retain inaccessible or retire those rows before cutover.

## 2. Live Neon infrastructure findings

Read-only inspection of the connected Neon project `peopole-ai` found:

| Branch | Observed state | Application schema |
|---|---|---|
| `main` (default) | Ready | 0 public application tables; Neon Auth tables only |
| `production-readiness-staging-2026-11-27` | Ready | 14 public application tables; no `free_message_usage` |

Additional observations at inspection time:

- Neither branch had a `public.pgmigrations` migration ledger.
- Staging had no public-table RLS policies; all 14 observed application tables had RLS and FORCE RLS disabled.
- Staging application tables were owned by `peopole_app`.
- The observed `peopole_app` role had `rolbypassrls=true` and role/database creation privileges.
- Production had not received the ordered application migration chain. Staging was populated separately and was not a migration-runner rehearsal.

**Consequence:** the new RLS architecture is code- and CI-tested, but the connected Neon branches remain unchanged. Do not point customer traffic at the current default branch. Do not claim production isolation until the nine-migration chain is run on an isolated restored Neon staging branch, separate login roles are provisioned and verified, and the application uses the correct two connection strings.

## 3. Neon Auth

- Production branch inspection showed email/password enabled, sign-up disabled, email verification required and OTP configured.
- Production used the shared Neon sender `auth@mail.myneon.app`; no verified Resend sender-domain setup was evidenced.
- Staging sign-up/OTP settings do not prove production delivery.
- No production browser lifecycle evidence was found for sign-up, OTP, sign-in/out, password reset, session restoration or revocation.

Keep new customer registration disabled until a verified sender domain and full account lifecycle are tested.

## 4. Render and Vercel

- Render service was observed as live on `main` commit `2726d017bb46c252cc6086c2995b3a80f0154fe7`, not this remediation branch.
- Render's build log reported seven npm audit findings, while the remediation CI lockfile reported zero. The lockfiles differ; the live Render build must be rebuilt from the reviewed lockfile and audited before closing this discrepancy.
- Render logs reported invalid/incomplete VAPID configuration; push delivery was disabled.
- No Render health-check path was configured at inspection time. The runbook recommends `/readyz`; it has not been applied to the live service.
- Vercel project discovery returned no matching linked project and remediation preview lookup returned `notLinked`. No live Vercel deployment SHA or browser verification is evidenced.

## 5. Backup and recovery

- Neon history retention observed: 21,600 seconds (6 hours).
- Snapshot listing returned no snapshots.
- No completed restore rehearsal, RPO/RTO record or independently verified backup schedule was evidenced.

## 6. Release gates

| Gate | Current status |
|---|---|
| Tenant-isolation implementation | **Code + CI verified; live Neon migration and role provisioning outstanding** |
| Production database and ownership | **Blocked — current production branch has no application schema** |
| Customer-owned data paths | **Code + CI verified for implemented chat, quota, inquiry, analytics and push paths; payments remain unimplemented** |
| Account lifecycle and SMTP/OTP | **Blocked — real provider and browser tests outstanding** |
| VAPID delivery | **Blocked — live credentials and delivery test outstanding** |
| Backups and restore | **Blocked — no restore evidence** |
| Monitoring and alert routing | **Partially implemented — scraper and alert destination not verified** |
| Browser customer journeys | **Blocked — no production-equivalent browser evidence** |
| Live deployment and rollback | **Blocked — correct project linkage, environment, deployed SHA and rollback evidence outstanding** |

## 7. Required cutover sequence

1. Create an isolated Neon staging branch from a verified restore or controlled copy.
2. Run all nine migrations with a migration-owner credential that has the required role-creation privileges.
3. Create separate login roles. Customer traffic: `earth_app_login LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`, then `GRANT earth_app_runtime TO earth_app_login;`. Admin operations: `earth_app_admin_login LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`, then `GRANT earth_app_admin TO earth_app_admin_login;`.
4. Verify each login's flags, exact memberships, absence of table ownership and inability to inherit the other role.
5. Set `DATABASE_URL`, `ADMIN_DATABASE_URL`, `GUEST_SESSION_SECRET`, `ALLOWED_ORIGIN` and other required secrets in the server environment. Never expose admin credentials or the guest signing secret to the browser.
6. Verify `/readyz`, then run cross-tenant read/write denial tests against Neon using two authenticated customers and two guests.
7. Resolve historical guest-row treatment and rehearse restore/rollback.
8. Complete SMTP/OTP, browser journeys, monitoring alerts, VAPID delivery, backup restore, load and penetration testing before release approval.

## 8. Change-control statement

No production Neon migration, role creation, Render configuration change, deployment, restart, secret update, merge or customer-data mutation was performed. PR #27 remains draft and unmerged.
