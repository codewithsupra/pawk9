# Deploying PawK9

Stack: **Vercel** (hosting + private photo storage), **Neon** (Postgres), **Clerk** (sign-in, subscriptions), **Stripe** (lifetime purchase and booking payments), **Resend** (email).

Do the steps in order. Nothing here has been run against production yet: the first preview deployment is the first real test of Vercel Blob and the live-mode services.

## 1. Accounts and domain

- [ ] Buy a domain (needed for Clerk live, Stripe live and Resend). Examples below use `pawk9.example`.
- [ ] Accounts: Vercel, Neon, Clerk (already), Stripe (already), Resend (already).
- [ ] Make a support mailbox and set `CONTACT_EMAIL` (shown on the privacy and terms pages).
- [ ] Have the privacy policy and terms (`/privacy`, `/terms`) read by a lawyer. They are drafts, and the terms have no governing-law clause yet.

## 2. Database (Neon)

- [ ] Create a Neon project. Use the **pooled** connection string as `DATABASE_URL` (serverless functions open many short connections).
- [ ] Make a second Neon branch (for example `dev`) for Preview deployments, so a preview never touches production data.
- [ ] Never run `npm run db:seed` against production: it deletes every pet.
- [ ] Migrations run during the build (`build:vercel` = `prisma migrate deploy && next build`). They are only ever _applied_ in production, never generated there.

## 3. Photo storage (Vercel Blob)

- [ ] In the Vercel project: Storage, create a **private** Blob store, connect it to the project. This adds `BLOB_READ_WRITE_TOKEN`.
- [ ] Without that variable the app **refuses to store photos in production** (by design).

## 4. Email (Resend)

- [ ] Add and verify your domain in Resend (DNS records).
- [ ] Set `RESEND_FROM` to an address on that domain, for example `hello@pawk9.example`. Without it only Resend's test sender is used, which can only email your own address.

## 5. Sign-in and subscriptions (Clerk)

- [ ] In the Clerk Dashboard create the **production instance** for your domain (this is separate from the dev instance and needs DNS records).
- [ ] Production Clerk Billing needs your own Stripe account connected. Re-create the Pro plan there ($39/month, $348/year; keep the slug `pro`; hide the free plan). Plans do not copy between instances.
- [ ] Copy the production keys into Vercel (Production environment only): `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (`pk_live_...`), `CLERK_SECRET_KEY` (`sk_live_...`).
- [ ] Also set the four Clerk URL variables the same as in `.env` (sign-in/up URLs and fallback redirects). `/app/dashboard` is the fallback redirect.

## 6. Payments (Stripe, live mode)

- [ ] Activate your Stripe account (business details, bank account).
- [ ] Enable **Connect** in live mode (Settings, Connect). The connected-account country is fixed in `CONNECT_COUNTRY` (`src/lib/constants.ts`, "US"); confirm it before anyone connects, it cannot change per account afterwards.
- [ ] Set `STRIPE_SECRET_KEY` to the live key (`sk_live_...`).
- [ ] Add a webhook endpoint `https://pawk9.example/api/webhooks/stripe` listening to `checkout.session.completed` and `checkout.session.async_payment_succeeded`, and put its signing secret in `STRIPE_WEBHOOK_SECRET`.
- [ ] Test once with a real small payment, then refund it.

## 7. Vercel project

- [ ] Import the Git repository.
- [ ] **Build Command:** `npm run build:vercel`. Node 24.
- [ ] Environment variables (Production):

| Variable                                     | Value                                                                                                                                  |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                               | Neon pooled connection string (production branch)                                                                                      |
| `APP_URL`                                    | `https://pawk9.example` (no trailing slash). **Required**: Stripe and email links are built from it                                    |
| `PHOTO_LINK_SECRET`                          | New random string, 32+ characters (`openssl rand -base64 48`). Different from dev. Changing it breaks every photo link already emailed |
| `BLOB_READ_WRITE_TOKEN`                      | Added by the Blob store (step 3)                                                                                                       |
| `RESEND_API_KEY`, `RESEND_FROM`              | Step 4                                                                                                                                 |
| `NEXT_PUBLIC_CLERK_*`, `CLERK_SECRET_KEY`    | Step 5                                                                                                                                 |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Step 6                                                                                                                                 |
| `CONTACT_EMAIL`                              | Support address shown on the legal pages                                                                                               |

- [ ] Preview environment: use the dev Clerk keys, Stripe **test** keys, the Neon `dev` branch and a separate Blob store.
- [ ] Add the domain, then check https works.

## 8. First deployment checks

- [ ] `https://pawk9.example/api/health` returns `{"ok":true}`.
- [ ] Sign up, subscribe (or buy lifetime), reach the dashboard.
- [ ] Add a pet, upload a photo (this proves Blob), email it to yourself, open the link in a private window.
- [ ] Connect Stripe from Account, make a booking from a booking link, confirm the payment arrives.
- [ ] Add an uptime monitor on `/api/health`.

## 9. Not done yet (know these before real customers)

- **Booking checkout is built and was tested end to end in Stripe test mode, but not with real money.** Before taking live payments, read the "Money maths" note in `CLAUDE.md`: PawK9 pays Stripe's fees out of its 8% fee (`BOOKING_FEE_PERCENT`); recheck the margin with real live-mode fees. Also decide the platform's country/currency (it currently settles in EUR, so US daycares are paid via a currency conversion).
- No error monitoring yet (Sentry needs your DSN).
- No Content-Security-Policy (other security headers are on). Add one only after testing it on a preview: Clerk and Stripe load from several hosts.
- No `account.updated` Stripe webhook: a daycare's "Stripe connected" status refreshes only when they open the Account page.
- Refunding a lifetime purchase does not remove access.
- Unpaid booking requests never expire.
- Deleting a pet deletes its bookings, including paid ones.
- No backups beyond what Neon provides: check the retention window of your Neon plan.
