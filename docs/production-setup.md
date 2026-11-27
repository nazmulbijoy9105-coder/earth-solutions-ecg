# Production setup: Neon Auth and Resend

## Current state

- Neon PostgreSQL 17 and Managed Better Auth are provisioned in the dedicated `peopole-ai` project.
- The application now has a same-origin auth proxy at `/api/neon-auth/*` and a backend JWT verification endpoint at `/api/auth/me`.
- Application sign-up is intentionally disabled in Neon until production email delivery and legacy account claiming are verified.
- Existing JSON account records have not been imported. Their password hashes and legacy role labels are not trusted as Neon Auth credentials or privileges.
- The proposed application schema is in migration `1789504075586_neon-auth-application-schema.js`; it has been tested on a disposable Neon migration branch, not applied to the default branch.

## Required server environment

Configure these only in the backend environment (Render / Vercel server-side functions as applicable):

- `DATABASE_URL`: Neon connection string for the intended environment/branch. Never expose it to browser JavaScript.
- `NEON_AUTH_BASE_URL`: Managed Better Auth base URL for the same Neon branch.
- `NEON_AUTH_JWKS_URL`: that branch's JWKS endpoint.
- `ALLOWED_ORIGIN`: exact deployed application origin registered as a Neon Auth trusted origin.

Do not use a production Neon branch for preview deployments. Use a separate Neon branch and separate environment variables for preview testing.

## Configure Resend for Neon Auth

Neon Auth uses SMTP for verification and password-reset messages. In Resend:

1. Add a sending domain that you control.
2. Publish and verify the DNS records Resend provides (including SPF and DKIM; configure DMARC for the domain).
3. Create a sending API key restricted to the verified domain where possible.
4. Choose a sender address on that verified domain, such as `accounts@YOUR_DOMAIN`.

In the Neon Console, open the Peopole AI project's Auth configuration and configure a **standard SMTP** email provider:

| Setting | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Your Resend API key |
| Sender email | The verified sender address |
| Sender name | `Peopole AI` |

Keep the API key in the Neon Auth SMTP password field. Do not put it in Git, frontend code, issue comments, or this file. Resend documents port 465 for SMTPS and the username/API-key pairing. See [Resend SMTP configuration](https://resend.com/changelog/smtp-service).

After configuring SMTP, send a test email to an address you control. Verify delivery, spam placement, and the sender domain before enabling sign-up. Then test:
- new account OTP verification;
- sign-in for verified accounts;
- resend verification code;
- password reset;
- password-reset session revocation.

Only then change Neon Auth's `disable_sign_up` setting to false.

## Legacy account preservation

The existing `data/users.json` contains legacy records and password hashes. Do not bulk-create Neon Auth users with those hashes or automatically grant their old `admin` labels.

The migration flow must:
1. Preserve the old account metadata in `legacy_account_imports`.
2. Exclude old password hashes from the application database import.
3. Require email ownership verification / password reset before linking an account.
4. Require a separately reviewed admin promotion for any legacy admin account.
5. Reconcile source record counts, linked accounts, rejected records, and unresolved claims.

## Deployment guardrails

- Do not deploy or merge without explicit approval.
- Do not enable sign-up while the Neon Auth provider is still the shared development sender.
- Do not treat a valid Neon Auth identity as an application administrator. App roles must come from `app_user_profiles` and be checked server-side.
- Do not enable payment fulfillment until bKash/Nagad merchant credentials, callback verification, idempotency, and reconciliation tests are complete.


## Staging database rehearsal (2026-11-27)

A separate, non-default Neon branch named `production-readiness-staging-2026-11-27` was created for schema rehearsal. Its branch ID is `br-summer-mode-bi9r3gts`. The new application tables were created there, and the legacy metadata import was checked:

| Record type | Imported to staging branch |
|---|---:|
| Legacy account metadata | 4 |
| Analytics events | 4 |
| Inquiries | 0 |
| Push subscriptions | 0 |
| Linked Neon Auth profiles | 0 |
| Legacy password hashes | 0 |
| Admin privileges granted | 0 |

The four legacy account records remain in `legacy_account_imports` with `review_required` status. Their old role labels are preserved as labels only. No password hashes were copied and no Neon Auth account was created or linked.

This branch is a rehearsal/data-preservation branch, **not** a production branch and **not** a completed `node-pg-migrate` execution. The equivalent DDL was tested on disposable Neon migration branches and the durable staging schema was then created separately. The default Neon branch has not received these application tables. Run the actual ordered migration chain against a fresh disposable branch before applying it to the default branch.

The source JSON stores were removed from the remediation branch after their metadata was preserved in the private staging branch. Their historical Git commits may still contain the old password hashes; deleting current files does not erase repository history. Treat any real legacy passwords as exposed and require password reset. No Git history rewrite has been performed.

To import from a separately secured local backup, set `LEGACY_DATA_DIR` to the directory containing the four JSON files, run the dry-run first, then review the report. Only run with `--apply` and `CONFIRM_LEGACY_IMPORT=1` against the intended non-production database after checking that the same records are not already present.


## Legacy account claiming

After Neon Auth registration is enabled, an authenticated user can explicitly request a legacy account claim from the account dialog. The server uses only the email address in the verified Neon Auth token; it does not accept a client-supplied email. The claim:
- links at most one legacy record to one verified Neon Auth identity;
- creates an application profile with role `user` only;
- preserves a legacy `admin` label for audit but never converts it to admin privileges;
- keeps legacy records with status `pending` suspended;
- records the claim in `audit_events`;
- rejects records already linked to another identity.

Admin promotion requires a separate, reviewed action after identity and business authorization checks.


## Ordered migration and staging transfer commands

On a fresh **non-production** Neon branch, place that branch's connection string in a local `.env.local` file (never commit it), then run:

```bash
npm ci
npm run migrate
```

The CI workflow independently executes all five migration files against a clean PostgreSQL 17 service database and verifies the 15 required application tables. Before running the migration chain against any Neon branch, confirm that the branch is disposable and that the migration history is empty.

After the target branch has the complete schema, transfer the sanitized metadata from the rehearsal branch:

```bash
LEGACY_SOURCE_DATABASE_URL='(rehearsal branch connection string)' DATABASE_URL='(target branch connection string)' node scripts/transfer-staging-metadata.js
```

Review the dry-run counts. Only after approval, run:

```bash
LEGACY_SOURCE_DATABASE_URL='(rehearsal branch connection string)' DATABASE_URL='(target branch connection string)' CONFIRM_LEGACY_TRANSFER=1 node scripts/transfer-staging-metadata.js --apply
```

The transfer uses one target transaction and is idempotent by legacy ID, analytics fingerprint and push endpoint. It does not transfer passwords, linked Auth identities or admin privileges.


## Frontend SDK packaging note

The account UI currently loads a pinned `@neon/auth@0.8.2` browser module from esm.sh. This keeps the initial integration lightweight, but the SDK is not yet part of the npm lockfile or the site's own build artifact. Before production release, bundle or vendor the exact reviewed SDK version and add a restrictive Content Security Policy; do not treat the current CDN-loaded UI as final supply-chain hardening.


## Authorization and RLS release blocker

The current migration set defines ownership columns and the application performs server-side ownership checks for guest conversations, but it does **not** yet enable PostgreSQL row-level security policies or prove a least-privilege runtime role. Do not expose the database URL to the browser or Neon Data API. Before production, create a non-owner runtime role, define and test RLS policies for user-owned records, and verify that direct cross-user SQL access is denied. Admin access must remain fail-closed until the database-backed role review is complete.


## Chat API abuse controls

The chat APIs now use PostgreSQL-backed fixed-window buckets keyed by SHA-256 hashes of the guest ID and, when available, the client IP. The initial limits are 30 requests per guest ID and 120 requests per IP per 10-minute window. The raw IP is not stored in the rate-limit table. This is a baseline control, not a replacement for WAF-level protection, account-based quotas, monitoring, or a scheduled global cleanup of expired rate-limit rows.
