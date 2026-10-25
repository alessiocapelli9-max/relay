# Relay

Family care planning by Alessio Capelli. Standard Next.js application for GitHub + Vercel, with Supabase accounts and PostgreSQL shared plans. The existing visual design and deterministic scheduler are retained.

## Run locally

Use Node 22.13 or newer. Run `npm ci`, copy `.env.example` to `.env.local`, supply the Supabase project URL and publishable key, then run `npm run dev`. No service-role key belongs in this application. Without configuration, the public page works and login reports that setup is incomplete.

## Deploy

1. Create the Supabase project and apply `supabase/migrations/202610240001_relay.sql` once. Supabase CLI users can link the project and run `supabase db push`. Keep migration history immutable after application.
2. Create a private GitHub repository from this directory. Do not upload `.env.local`, dependencies, build output, or any production plan backups.
3. Import that repository in Vercel as Next.js. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the production environment before building. No payment or paid service is assumed by this repository.
4. Set the Supabase Auth Site URL to the Vercel production origin. Allow the exact `/auth/callback` URL, including the reset callback `/auth/callback?next=/reset-password`. Add localhost only for development. Avoid broad production redirect wildcards.
5. Enable email/password authentication, keep email confirmation enabled, and configure a sender through custom SMTP before inviting real users. The default Supabase mail service is restricted to project-team addresses and is unsuitable for public signup/password reset. Configure the minimum password length to 12 or more in Supabase as well as the UI.
6. Optional Google sign-in: configure a Google OAuth web client with the callback supplied by Supabase, enable the Google provider, and set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` in Vercel. Redeploy after changes to public environment values. The button remains hidden until enabled.
7. Verify email confirmation, password reset, Google login if enabled, two-account joining, cloud save after reload, and stale-write recovery on the deployed origin before switching visitors to it.

Official setup references: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Google](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [Vercel environment variables](https://vercel.com/docs/environment-variables).

## Existing plans

Keep the existing Site running during migration. Each owner can download a backup from Plan settings on the old Site, then import that JSON when creating a plan here. Existing ChatGPT identities and room codes do not transfer to independent accounts; create new invitations after importing. No production data has been exported or changed by this code preparation.

## Data and access

- Supabase manages passwords and authenticated sessions. Server requests verify users through `auth.getUser()`.
- The app only needs a publishable key. Privileged keys are not used.
- Plan tables live in an unexposed schema with RLS enabled and no client table grants.
- The `relay_api` function checks `auth.uid()` and room membership for every operation. Owners control codes and members; all room members can collaborate on the plan.
- Codes expire after seven days. Rotation and revocation prevent future joins; removal revokes access and disables the current code.
- Revision checks and row locks prevent silent overwrite of another member's work. Unsaved conflicts remain on the page and can be downloaded.
- Open idle plans refresh approximately every 15 seconds. Notifications and SMS are not implemented.

## Checks

`npm run typecheck`, `npm test`, and `npm run build`.

The database test executes the actual migration and permission function in PGlite PostgreSQL, covering identity, isolation, invitations, stale revisions, removal, code expiry, rate limiting and direct-table denial. Hosted email delivery and OAuth require real project configuration and must be checked separately.
