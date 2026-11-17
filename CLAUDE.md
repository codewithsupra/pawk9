# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Next.js version warning

`AGENTS.md` states this is a Next.js version (16.x, React 19.3) with breaking changes from what you may know. Before writing Next.js code, read the relevant guide in `node_modules/next/dist/docs/` (`01-app/` for the App Router) and heed deprecation notices. For example, the root layout is typed with the global `LayoutProps<"/">` helper, and the request interceptor is `src/proxy.ts` (not `middleware.ts`).

## Commands

- `npm run dev` — dev server (Turbopack). `npm run build` / `npm start` — production build / serve.
- `npm run lint` — ESLint (flat config). `npm run format` / `format:check` — Prettier.
- `npm run db:migrate` — `prisma migrate dev`. `npm run db:seed` — reset pets and re-seed. `npm run db:studio` — Prisma Studio.
- After a schema change run `db:migrate` **and** `npx prisma generate`: `migrate dev` does not regenerate the client in Prisma 7. `postinstall` also runs `prisma generate`. `migrate dev` refuses to run without a terminal: instead save the SQL from `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` as `prisma/migrations/<timestamp>_name/migration.sql`, then run `prisma migrate deploy`. In production run only `prisma migrate deploy`.
- After adding, removing or renaming a route, run `npx next typegen` if `tsc` complains about `.next/types/validator.ts` (stale generated file; the dev server does not refresh it).
- No test runner is configured.

`.env` (gitignored) holds `DATABASE_URL` and the Clerk keys. Do not read or print it.

## Architecture

PawK9 is a pet-daycare dashboard (ByteGrad course project) on the Next.js App Router, Tailwind CSS v4, shadcn/ui (style `base-nova`, built on `@base-ui/react`; add components with the `shadcn` CLI, config in `components.json`), Clerk for auth, and Prisma + Postgres for data. Path alias `@/*` → `src/*`.

**Routes** under `src/app/`: `(marketing)` is the public landing page, `sign-in/[[...sign-in]]` and `sign-up/[[...sign-up]]` are Clerk's pages, and `(priv)/app/*` is the signed-in area (`dashboard`, and `account`, which shows the user's details, plan (lifetime or subscription) and opens Clerk's modal for profile, security and billing).

### Auth and ownership

- `src/proxy.ts` protects `/app(.*)` with `auth.protect()`. The private layout calls `auth.protect()` again before querying. The same proxy redirects signed-in users from `/` to `/app/dashboard` (done there so the landing page stays static).
- Server actions are public endpoints, so each one re-checks auth itself and never relies on the page being protected.
- Users sign up in Clerk. The `User` row is created lazily by `getCurrentUser()` in `src/lib/auth.ts` (it also handles two first requests racing). `Pet.userId` is required and cascades on user delete.
- Reads go through `getPets(userId)` in `src/lib/data.ts`, whose required `userId` makes an unscoped read impossible by construction. Take it from `getCurrentUser()`, never from the client. Any new pet query must filter on `userId` too, because Postgres row-level security isn't used here, so scoping is purely in application code.
- Every pet query and mutation is scoped to the current user. `editPet`, `removePet`, `checkInPet` and `checkOutPet` match on `{ id, userId }`, so another user's pet looks like a missing one.
- Where users land after signing in or up is set by the `signInFallbackRedirectUrl` / `signUpFallbackRedirectUrl` props on `ClerkProvider` in `src/app/layout.tsx` (`/app/dashboard`). The `*_FALLBACK_REDIRECT_URL` values that `clerk init` wrote to `.env` point at `/`, so don't rely on them. Check the result in a browser with `window.Clerk.buildAfterSignInUrl()`.
- Clerk dev instances answer a first cookie-less request with a handshake redirect, even on public routes, so `curl` cannot tell you whether a route is protected. Use a browser.

### Billing (Clerk Billing, paid-only)

- Everything under `/app` needs the `pro` plan (`PRO_PLAN` in `src/lib/constants.ts`; $39/month or $348/year, for users). It is enforced in three places: `src/proxy.ts` (signed-in users without the plan are redirected to `/pricing`; non-GET requests such as server action calls get a 403), the private layout, and `hasProPlan()` in `src/lib/auth.ts`, which every server action calls after the sign-in check.
- `/pricing` is public and renders Clerk's `<PricingTable />`. The default `free_user` plan exists but is hidden (`publicly_visible: false`) so visitors cannot pick it. Clerk does not allow deleting the default plan.
- Clerk Billing is recurring subscriptions only, in USD, with no tax/VAT and no 3D Secure support, so the one-time lifetime purchase is a separate Stripe flow (below).
- Plans live in the Clerk instance, not in the repo. Change them with `clerk config patch --file <json> --instance dev --dry-run` (then without `--dry-run`), or in the Dashboard. `amount` is in cents. Never target `--instance prod` without the user's say-so; production also needs a Stripe account.
- Access is checked with `has({ plan })` from `auth()`, so no billing webhooks are needed. The plan comes from the session token, which can lag right after checkout. If a new subscriber is bounced back to `/pricing`, reloading refreshes the session.
- `clerk enable billing --dry-run` can silently copy Clerk's whole skill bundle into the project (`.claude/skills`, `.agents/skills`, `skills-lock.json`). Pass `--no-skills`, and delete those folders if they appear (they add lint noise).

### Lifetime purchase (Stripe, $899 one-time)

- Access to `/app` is **an active Pro plan OR lifetime**. `hasAccess(user)` in `src/lib/auth.ts` is the single rule for the layout and every server action. The proxy applies the same rule but only has the Clerk id, so it checks the Clerk plan first (free, it is in the session) and only queries `hasLifetimeAccessByClerkId()` for users without the plan.
- Flow: `/pricing` shows an offer under Clerk's table, whose form calls the `startLifetimeCheckout` server action (`src/actions/billing.ts`). It creates a Stripe Checkout Session with the price set **server-side** (`LIFETIME_PRICE_CENTS`) and metadata `{ userId, product: "lifetime" }`, then redirects to Stripe.
- Access is granted by `fulfillLifetimePurchase()` (`src/lib/purchases.ts`), called from two places that race on purpose: the webhook `src/app/api/webhooks/stripe/route.ts` and the success page `/checkout/success` (via `claimCheckoutSession()` in `src/lib/checkout.ts`, which refuses a session that belongs to a different user). It only grants for a paid, one-time `payment` of exactly the lifetime price in USD, and is idempotent: `User.lifetimeStripeSessionId` is unique and the write is `updateMany where lifetimePurchasedAt is null`. A second payment by the same user keeps the first grant and logs "needs a refund".
- The webhook must stay public (it is outside `/app`; never call `auth.protect()` on it). It reads the raw body for signature verification, and treats missing config as a 500, not as a bad signature.
- Env vars (in `.env`, never commit): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and in production `APP_URL` (used for Stripe's return URLs; it is required there because trusting the Host header would let a request choose where Stripe redirects the customer).
- Local testing: `stripe listen --forward-to localhost:3000/api/webhooks/stripe` prints the `whsec_...` secret. Test card `4242 4242 4242 4242`.
- Not handled: refunds do not revoke lifetime access, and a user who buys lifetime while subscribed is not told to cancel the subscription.

### Redirects

All redirect rules are defined in `src/lib/redirects.ts`, which has no imports because `next.config.ts` loads it by relative path. They live in three places depending on what decides them:

- **Static rules** (`/app`, legacy `/login` `/signup` `/dashboard` `/account` `/profile`, ...) go through `redirects()` in `next.config.ts`, which runs before the proxy. Add new ones to `staticRedirects`.
- **Signed-in rules** (`/`, `/sign-in`, `/sign-up` go to the dashboard) are decided in `src/proxy.ts` using the pure `getSignedInRedirect()`. They match exact paths only, because Clerk's multi-step flows (`/sign-in/sso-callback`, ...) can already be signed in mid-flow. GET/HEAD only.
- **Signed-out access to `/app/*`** is `auth.protect()` in the proxy. It redirects to sign-in with `redirect_url`.
- Post sign-in, sign-up and sign-out destinations are props on `ClerkProvider` in `src/app/layout.tsx`.

### Data (Prisma 7 + Postgres)

- `prisma/schema.prisma`, migrations in `prisma/migrations`, config in `prisma.config.ts`. Local development uses a Postgres database `pawk9_dev` (Homebrew `postgresql@14`; start it with `brew services start postgresql@14`; `DATABASE_URL=postgresql://<your-os-user>@localhost:5432/pawk9_dev` in `.env`). Production is Neon. Migrations were reset to one Postgres baseline (`*_init_postgres`) when the app left SQLite; the old SQLite file `prisma/dev.db` (gitignored) is no longer used and can be deleted.
- The client is cached on `globalThis` in dev (to survive hot reloads), keyed on a fingerprint of the generated models. After a schema change run `db:migrate` + `prisma generate`, and a reload builds a fresh client. If you ever see `Unknown argument <newField>` from a long-running dev server, it is a stale client: restart `npm run dev`. Test scripts run in fresh processes, so they cannot catch this; to be sure, exercise the path through the running server.
- Prisma 7 needs a driver adapter: `src/lib/db.ts` builds the client with `@prisma/adapter-pg` and caches it on `globalThis` for hot reloads. The generated client is in `src/generated/prisma` (gitignored).
- Keep `prisma`, `@prisma/client` and the adapter on the same version. The `prisma` CLI's npm `latest` tag points at an 8.0 release candidate, so pin 7.10.x when installing.
- `prisma/seed.ts` resets pets and gives **every user in the database** a copy of the sample pets, and keeps existing users. The sample pets use Unsplash photos (`images.unsplash.com/photo-...`, an allowed host in `next.config.ts`). Re-running the seed deletes **every** pet, including ones you added; to change only the sample pets' fields, update them by name instead. A newly signed-in user starts with no pets: sign in once, then run `npm run db:seed`.

### Validation: one zod source (`src/lib/validations.ts`)

- `petFormSchema` validates form input on the client (react-hook-form + `zodResolver`) and on the server (every action re-parses the `FormData`). `petSchema` parses database rows into the UI's `Pet`. `petIdSchema` validates ids.
- `Pet` in `src/lib/types.ts` is inferred from `petSchema`. Do not hand-write it.
- Owner contact (`ownerEmail`, `ownerPhone` on `Pet`, both optional): the email is trimmed and lowercased; the phone has spaces, dots, dashes and brackets stripped (stored as e.g. `+14155552671`, or digits only if no country code was typed) and must be 7-15 digits. Country-code handling is deliberately left to whatever sends SMS. These are personal data: they travel only in the owner's own scoped queries and are never logged.
- **zod leaves a cleared optional field out of its output entirely** (the key is missing, not `undefined`). The optimistic edit builds the new pet by spreading the form values over the old one, so `PetForm` names `notes`, `ownerEmail` and `ownerPhone` explicitly; without that a cleared field would keep showing its old value until the server answered. Do the same for any new optional field. On the server, `editPet` treats the form as a full replacement, so an omitted optional field is cleared.
- The default pet image is applied by a zod transform. Components use `pet.imageUrl` directly. The database stores `null` for "no custom image" (the actions map the default URL back to `null`), so changing `DEFAULT_PET_IMAGE` in `src/lib/constants.ts` updates existing pets.

### Mutations and optimistic UI

Pet state lives in `PetContextProvider` (`src/contexts/pet-context-provider.tsx`): a confirmed `pets` list from the server, plus `useOptimistic` over it for add, edit, remove, check in and check out. They all follow the same flow:

1. `PetForm` validates with zod, then `startTransition(...)`; inside it `flushSync(onFormSubmission)` closes the dialog immediately (updates inside an async transition are otherwise held until it finishes).
2. The context function applies the optimistic change, awaits the server action, and on success commits the saved pet with `flushSync` so the optimistic revert never flashes the old state.
3. On failure it shows a toast and returns. The optimistic change reverts by itself when the transition ends. Do not hand-roll an undo (the only exception is the selection on add, which is plain state).

Gotchas:

- Call the optimistic setter directly inside the transition, never inside `flushSync`, or React logs "optimistic state update occurred outside a transition".
- Remove, check in and check out are driven by `useTransition` in `PetButton`, since they are buttons and not forms. Remove asks for confirmation first (it deletes the pet and its history for good).
- Add and edit need JavaScript. A react-hook-form submit is a client handler, so they are no longer plain form posts. The actions still take `(prevState, formData)`, and their "echo the typed values back" code (`echoValues`) has no remaining caller.

Search state is a separate `SearchContextProvider`. `useFilteredPets()` in `src/lib/hooks.ts` derives the visible list.

### Stays (check in / check out)

- A `Stay` is one visit: `checkedInAt`, and `checkedOutAt` (null while the pet is in). A pet is "checked in" while it has a stay with a null `checkedOutAt`; `getCurrentStay()` / `isCheckedIn()` in `src/lib/stays.ts` are the only definition of that. `Stay.userId` duplicates the pet's owner so every query can be scoped to the user directly.
- **At most one open stay per pet.** The database enforces it with a partial unique index (`Stay_one_open_per_pet`, written by hand in the baseline migration since Prisma can't express it), and `checkInPet` also locks the pet row inside its `$transaction` so concurrent check-ins queue instead of failing (tested with 8 simultaneous check-ins: exactly one stay). Keep any new code that creates stays going through it.
- **Concurrency on Postgres:** transactions run side by side, so a "check, then create" is only safe after locking the row that owns the data. `src/lib/locks.ts` has `lockPet` / `lockUser` (`SELECT … FOR UPDATE`); call them first thing in the transaction. Used by `checkInPet`, `requestBooking` (the 5-request cap) and `sendPhotoToOwner` (the hourly limit). SQLite used to serialize transactions, so this was never needed before; any new check-then-write needs it too.
- `checkInPet` / `checkOutPet` are idempotent and return the pet's whole recent-stays list, which the client swaps in wholesale. That makes two tabs that disagreed heal on the next action, and means the optimistic temp stay is replaced by the real one.
- `Pet.stays` holds only the 10 most recent visits (`recentStays` in `src/lib/data.ts`); older history stays in the database. `petSelect` is the one select used for every query that returns a pet, so reads and the results of create/update stay identical.
- "Remove" (`removePet`) deletes the pet and its stays (cascade). Before stays existed, "checkout" meant that; do not reintroduce the word for it.
- The "Current guests" stat counts checked-in pets across all pets (not just the ones the search box shows). Times are shown in the browser's locale; the details panel only renders after a pet is selected on the client, so there is no server-rendered date to mismatch.

### Photos (private storage)

- A `Photo` row records a file's `key`, verified `contentType` and size, scoped to a pet and user. The bytes live in the storage layer, `src/lib/storage.ts`, which has two backends behind three functions (`putObject`, `getObject`, `deleteObject`): **private Vercel Blob** when `BLOB_READ_WRITE_TOKEN` is set (production), and a folder on local disk (`STORAGE_DIR`, default `./storage`, gitignored) otherwise (development only). In production without the token it throws instead of writing to a disk that gets wiped. Leave the token unset locally unless you are testing Blob. Blob objects are written with `access: "private"`, `allowOverwrite: false` and no random suffix (the key is already a UUID). The Blob path has not been exercised against a real store yet; the first preview deploy is its first test. Nothing else touches files.
- Photos are private. There is no public file URL: `GET /api/photos/[id]` (`src/app/api/photos/[id]/route.ts`) answers only a signed-in user with access who owns the pet (401 / 403 / otherwise 404, so it never confirms a photo exists). It serves the type we verified at upload, with `nosniff` and `private` caching. Because of that, thumbnails use `<Image unoptimized>`: Next's image optimizer fetches without the user's cookies and would get a 401.
- Upload (`addPetPhoto` in `src/actions/photos.ts`) trusts nothing from the client: the type is read from the file's own bytes (`detectImageType`, JPEG/PNG/WebP only, **SVG refused** since it can carry scripts), size is capped at 3 MB, and a pet may have 50 photos. The file is written first and removed again if the database insert fails; `removePet` deletes the pet's files too (the cascade only removes rows). Keys are generated by the server and re-checked in `storage.ts` against path tricks.
- The browser shrinks photos to 1600px and re-encodes them as JPEG before upload (`src/lib/client-image.ts`), which also drops EXIF (GPS location). The server can't rely on that, since actions are public endpoints. The upload limit for server actions is raised to 4 MB in `next.config.ts` (the default 1 MB is below a phone photo); keep it under Vercel's 4.5 MB request limit.
- `Pet.photos` holds only the 12 most recent photos (ids and dates, never keys). Both actions return the pet's whole recent list, which the client swaps in.
- Sending a photo to an owner (email/SMS) cannot use `/api/photos/[id]`, because an email client has no session. Messages link to `/p/<token>` instead (`src/app/p/[token]/route.ts`, public): `createPhotoToken(photoId)` in `src/lib/photo-links.ts` makes an HMAC-signed token that names one photo and expires after 7 days (`PHOTO_LINK_TTL_MS`); a forged, expired or deleted-photo token is the same plain 404. Needs `PHOTO_LINK_SECRET` (32+ chars) in `.env`; generate a new one per environment. Changing it invalidates every link already sent. Anyone holding a link can open that one photo until it expires, so never put one in logs.
- Email: the mail icon on a thumbnail calls `sendPhotoToOwner` (`src/actions/photos.ts`), which re-checks auth, finds the photo scoped to the user, requires the pet's `ownerEmail`, and sends through Resend (`src/lib/email.ts`; the link base comes from `getAppUrl`, so production needs `APP_URL`). Env: `RESEND_API_KEY`, and `RESEND_FROM` (an address on a domain verified in Resend). Without `RESEND_FROM` it uses Resend's test sender `onboarding@resend.dev`, which only delivers to the Resend account owner's own email. Replies go to the daycare user's email. Names are HTML-escaped. Each send is recorded in `PhotoSend` (no address stored) and shown as a "Sent <date>" badge (`Photo.lastSentAt`, derived in `photoSchema` from the newest send). Limits (`src/lib/constants.ts`): a photo can't be re-sent within 24 h, and a user may send 30 per rolling hour. The check and the record are written in one transaction _before_ the email goes out, so double clicks can't both pass; if sending fails the record is deleted so a failure doesn't count. Like uploads, sending runs on plain loading state, not a transition (a transition holds back the list update).

### Online booking (in progress)

- Plan: owners book and pay for a stay; money goes to the daycare through **Stripe Connect Express** with a 5% platform fee. Built so far: `User.dailyRateCents` (null = no rate = no bookings; set on the account page via `setDailyRate` in `src/actions/settings.ts`, typed in dollars, parsed by `dailyRateSchema`, $1-$1,000) and the `Booking` model (`BookingStatus`: PENDING_PAYMENT / CONFIRMED / CANCELLED).
- A booking covers every day from `startDate` to `endDate` inclusive (UTC-midnight dates). `dailyRateCents`, `days` and `amountCents` are snapshots taken at booking time, so later rate changes never alter it. Always compute them on the server.
- Known gap: deleting a pet cascades to its bookings, which would erase payment records. Decide this (block removal, or keep bookings) before taking real payments.
- Booking link: each pet can have a public link `/book/<code>`. `Pet.bookingCode` is a random 128-bit code (not a signed token) created the first time the daycare clicks "Copy booking link" (`getBookingLink` in `src/actions/bookings.ts`, which refuses until a daily rate is set). It is stored so a link can be switched off by clearing the column; there is no UI for that yet. `/book/[code]` is public (outside `/app`), noindex, and selects only the pet name, daycare name and rate (never contact details); a wrong code, removed pet or missing rate all show the same "not available" page. It awaits `connection()` because it reads today's date.
- `src/lib/bookings.ts` has the pure price maths (`quoteBooking`: inclusive days, no past dates, at most 60 days) used by the page for a preview. When payment is added the server must recompute with it and never trust a price from the browser. "Today" is the UTC date, so an owner far from UTC may see a one-day edge.
- `startBookingCheckout(code, start, end)` (`src/actions/bookings.ts`) is a **public action with no sign-in**: the link's code is the only credential, so it decides everything itself. The price is the daycare's current rate times the days (the browser sends none); yesterday (UTC) is the earliest allowed day; it refuses dates overlapping a CONFIRMED booking of that pet; the same dates again reuse the open request; and a link may hold at most 5 unpaid requests created in the last 2 hours (`MAX_OPEN_BOOKING_REQUESTS_PER_PET`, `OPEN_REQUEST_WINDOW_MS`). It then creates a Stripe Checkout Session as a **destination charge** (`transfer_data.destination` = the daycare's account, `application_fee_amount` = `platformFee()`, `BOOKING_FEE_PERCENT` = 5), expiring after 35 minutes, and returns its URL. A second click reuses the still-open session. Gap: it doesn't check that the daycare still has an active plan, and there is no per-IP limit.
- Stripe Connect (Express): `User.stripeAccountId` (unique) is created on first click of "Connect Stripe to get paid" (`startStripeOnboarding` in `src/actions/connect.ts`), which returns Stripe's hosted onboarding URL (Stripe collects bank and identity details). The account is created in `CONNECT_COUNTRY` (`src/lib/constants.ts`, "US"): **it can't change after creation**, and without it Stripe silently uses the platform's country (NL here; a NL platform can create US/GB accounts but not IN). Two clicks at once create two Stripe accounts, and the loser is deleted. `syncConnectStatus` (`src/lib/connect.ts`) asks Stripe on every Account page load and stores `User.stripeChargesEnabled` (= `charges_enabled && details_submitted`); on a Stripe outage it falls back to the stored value. Booking links, the public page and `requestBooking` all require `stripeChargesEnabled`, read from the database so public pages never call Stripe. No `account.updated` webhook yet, so the flag only refreshes when the daycare opens the Account page.
- **A booking is confirmed only by the webhook** (`fulfillBookingPayment` in `src/lib/booking-payments.ts`, called from `/api/webhooks/stripe` when `metadata.product === "booking"`); the `/book/<code>/thanks` page proves nothing. It checks paid + exact amount + usd, locks the pet, and is idempotent. A payment it can't honour is **refunded in full automatically** (`reverse_transfer` and `refund_application_fee`, idempotency key per payment): the request was cancelled first, overlapping dates were confirmed first, or a second payment arrived for an already-paid booking. `checkout.session.expired` cancels the request, but only if that session is the booking's _latest_ (`Booking.stripeSessionId`). Cancelling a request also expires its payment page. A pet with a CONFIRMED booking ending today or later can't be removed (`removePet`). Tested end to end in Stripe test mode with real payments and refunds (checkout session, confirm, replay, overlap, cancelled-then-paid, duplicate, wrong amount, expiry, removal guard).
- **Money maths to know:** with destination charges PawK9 pays Stripe's processing fees out of its own fee. In test mode on a NL platform a $135 booking cost about $6.56 in Stripe fees against a $6.75 platform fee, i.e. almost nothing left. The platform account settles in EUR, so the transfer to a US daycare is made in EUR and converted. Revisit the fee percent, the platform's country or currency, and charge type before launch.
- Not built yet: the `account.updated` webhook, daycare-initiated refunds or cancellation of a paid booking, a bookings view of what the daycare earns net of fees, emails to the daycare or owner when a booking is confirmed.
- Bookings list: `/app/bookings` (`getBookings(userId)` in `src/lib/data.ts`, newest 100) shows each request with its status. The daycare can cancel a request that is still PENDING_PAYMENT (`cancelBookingRequest`, matched on owner + status in one `updateMany`); cancelled requests stop counting toward the 5-request cap. A CONFIRMED booking can't be cancelled there (needs a refund). Booking days are UTC midnight, so display them with `timeZone: "UTC"`.

### next.config.ts

- `cacheComponents: true` and `partialPrefetching: true` are enabled. Anything that reads request data (Clerk's `auth()`, Prisma queries in server components) must sit under a `<Suspense>` boundary, which is why the pets query lives in `PetDataProvider` and not in the layout body.
- Reading the clock in a component under `cacheComponents` trips the same "blocking route" check, so `AppFooter` computes its year inside `"use cache"` with `cacheLife("days")`.
- Awaiting `searchParams` does **not** make the rest of a page dynamic. Anything time-dependent after it (Prisma, Stripe and `new Date()` all call `Date.now()`) is flagged "Blocking Route ... unstable value Date.now()" in dev unless the page awaits `connection()` from `next/server` first. `src/app/checkout/success/page.tsx` does this. The error only appears once a request gets past the sign-in check and does real work, so signed-out testing will not reveal it.
- Remote images (`next/image`) are allowed only from `images.unsplash.com` (`/photo-*`); the sample pets use those. Everything else is local in `public/`: `pet-placeholder.svg` (the default for pets without a photo, `DEFAULT_PET_IMAGE`) and `pawk9-preview.jpg` (the landing-page hero, a real screenshot of the dashboard with sample data). The form accepts any `http(s)` image URL, so a saved URL on another host makes `next/image` throw at render time. Nothing depends on `bytegrad.com` any more (a network that cannot resolve it broke the old placeholder).
- Tailwind is processed by a custom Turbopack rule routing `*.css` through `@tailwindcss/turbopack`. There is no `tailwind.config`; theme config lives in `src/app/globals.css`.

### Testing server actions without the UI

The action files import `next/cache` and `@clerk/nextjs/server`, which only work inside a Next request. To call them from a `tsx` script, stub both with `module.registerHooks` (resolve each specifier to a small stub file); the database stays real. Clean up any rows the script creates.
