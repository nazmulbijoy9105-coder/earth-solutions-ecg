# Earth Solutions ECG — Production Release Gates

**Assessment date:** 27 November 2026  
**Assessment scope:** repository remediation branch, GitHub Actions, connected Neon project, connected Vercel account  
**Current release decision:** **NO-GO for live customer onboarding or paid transactions**

This document separates repository CI evidence from live infrastructure evidence. A green test suite is not a production approval.

## 1. Verified repository evidence

- Remediation PR: [#27](https://github.com/nazmulbijoy9105-coder/earth-solutions-ecg/pull/27), draft and unmerged.
- Latest assessed branch head at this report: `aa0ecff7f1632d457e10f470fb8d4f7c245187a3`.
- GitHub Actions run [#179](https://github.com/nazmulbijoy9105-coder/earth-solutions-ecg/actions/runs/45922495202): successful; 25 tests passed, 0 failed.
- The run passed `npm audit` with 0 reported vulnerabilities, JavaScript syntax checks, migration CLI loading, and the seven-migration chain against a clean disposable PostgreSQL 17 database.
- The CI schema assertion expects 15 application tables. This is a CI-only schema rehearsal; it does not mean the connected Neon production branch has those tables.
- Added a forced-RLS tenant isolation migration for all 15 application tables, separate `earth_app_runtime` and `earth_app_admin` non-login group roles, and separate runtime/admin connection pools. Both roles are designed as non-superuser and non-BYPASSRLS; neither may own application tables.
- All application persistence queries now require a trusted identity context and use transaction-local PostgreSQL settings. Customer identity comes from a verified Neon Auth bearer token or a server-issued signed HttpOnly guest cookie; client-supplied owner IDs are ignored.
- Chat conversations/messages, daily quota rows, inquiries, analytics and push subscriptions are scoped to authenticated account or signed guest identity. Payment order/event tables have owner policies, but payment APIs are not implemented.
- CI includes PostgreSQL RLS integration tests for guest and authenticated customer read/write isolation, verifies that setting a session variable cannot self-promote the runtime role to admin, and verifies that only the separate admin database role can read across tenants.
- Added an explicitly irreversible quota-ownership migration rather than silently destroying account-owned quota rows during rollback. Restore-based rollback must be planned and tested.

## 2. Live Neon infrastructure findings

The connected Neon project named `peopole-ai` has two branches:

| Branch | Observed state | Application schema |
|---|---|---|
| `main` (default) | Ready | **0 public application tables**; Neon Auth tables only |
| `production-readiness-staging-2026-11-27` | Ready | **14 public application tables**; no `free_message_usage` |

Additional read-only catalog checks found:

- No `public.pgmigrations` migration ledger on either branch at the time of inspection.
- `free_message_usage` is absent from both branches.
- No public-table RLS policies were present on staging at the time of the read-only inspection.
- All 14 staging application tables had both `relrowsecurity = false` and `relforcerowsecurity = false`.
- The staging application tables are owned by `peopole_app`.
- The connected runtime role `peopole_app` has `rolbypassrls = true`, as well as role/database creation privileges. This role cannot serve as a tenant-isolated runtime principal.
- The production branch has not received the application's ordered migration chain. The staging schema was created separately and is not a migration-runner rehearsal.

**Consequence:** the code now contains and CI-tests the isolation design, but the connected Neon branches remain unchanged. Do not point the application at the current default branch. Do not claim production tenant isolation until the nine-migration chain is applied to a restored staging branch, the two separate login roles are provisioned and verified, and the app is configured to use the correct `DATABASE_URL` and `ADMIN_DATABASE_URL`.

## 3. Neon Auth findings

Read-only configuration inspection returned:

- Production branch: email/password enabled, new sign-up disabled, email verification required, OTP verification configured.
- Production email provider is the shared Neon sender `auth@mail.myneon.app`; no evidence of the planned Resend SMTP sender-domain setup was returned.
- Staging branch has sign-up enabled and OTP verification required. Staging settings do not prove production email deliverability.
- Both branches trust `https://earth-solutions-ecg.vercel.app`.
- No production browser lifecycle test evidence was found for sign-up, OTP, sign-in, sign-out, password reset, session restoration and revocation.

**Consequence:** keep new customer registration disabled until a verified production sender domain and the complete account lifecycle have been tested.

## 4. Vercel and deployment findings

- The connected Vercel account context reports a Hobby plan.
- Project discovery by repository and project name returned no matching project.
- Deployment lookup for the remediation branch returned `notLinked`: no preview deployment could be inspected for this repository.
- Earlier GitHub Vercel status checks reported deployment rate-limit failures. No current live Vercel deployment SHA or browser verification is evidenced here.
- The production URL could not be inspected through the available web retrieval path; this is not proof that the URL is down.

**Consequence:** verify the actual Vercel project link, environment variables, deployment target, production commit SHA, domains and browser journeys before any release.

## 5. Backup and recovery findings

- Neon project history retention observed: 21,600 seconds (6 hours).
- Snapshot listing returned no snapshots.
- No completed restore rehearsal, RPO/RTO record, or independently verified backup schedule was evidenced.

**Consequence:** six-hour history retention and an empty snapshot listing are not sufficient proof of enterprise backup/recovery. Define business RPO/RTO, configure a durable backup policy, and complete a restore rehearsal.

## 6. Mandatory release gates

| Gate | Required evidence | Current status |
|---|---|---|
| Production database | Ordered migrations run on the intended production branch; schema and migration ledger reconciled | **Blocked** |
| Tenant isolation | Non-owner, non-BYPASSRLS runtime role; RLS + FORCE RLS; trusted per-request identity context; cross-tenant read/write denial tests | **Code + CI verified; live Neon provisioning and deployment blocked** |
| Account lifecycle | Verified sender domain; OTP, sign-in/out, reset, session refresh/revocation, browser/mobile E2E | **Blocked** |
| Customer ownership | Authenticated accounts and signed guests own conversations, messages, quota, analytics, inquiries and push subscriptions; payments require separate API work | **Code + CI verified for implemented data paths; live deployment and payment APIs blocked** |
| Payments | Merchant sandbox and production credentials; signed callbacks; idempotency; refunds; reconciliation; audit trail | **Not implemented** |
| Push | Complete VAPID configuration; real browser subscription and delivery tests; endpoint ownership protections | **Partially implemented; delivery unverified** |
| Privacy/data governance | Privacy notice, retention, export, deletion, consent, incident response and access audit | **Blocked** |
| Operations | Monitoring, alerting, secret-safe logs, tested backups, restore, capacity/load and penetration tests | **Blocked** |
| Immigration content | Authoritative sources, version/effective dates, freshness monitoring and independent review | **Blocked** |
| Live deployment | Correct Vercel/Render project links, production env, deployed SHA, health checks, customer journey and rollback evidence | **Blocked** |

## 7. Release controls

Until all mandatory gates pass:

1. Keep PR #27 in draft; do not merge or deploy.
2. Keep customer sign-up disabled.
3. Keep paid checkout/payment claims disabled; do not accept screenshots or chat messages as proof of payment.
4. Do not expose immigration guidance as verified or guaranteed advice.
5. Do not run production migrations or change production Neon settings without a reviewed migration plan and explicit approval.
6. Test all schema/RLS changes on a disposable branch first, then run an isolated restore rehearsal before production cutover.

## 8. What this report does not claim

This assessment does not certify legal compliance, payment settlement, production tenant isolation (the code has not been applied to the connected Neon branches), production availability, security against penetration testing, or customer readiness. It records the evidence observed on the date above. Re-run the checks after every infrastructure or release change.
