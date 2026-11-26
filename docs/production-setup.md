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
