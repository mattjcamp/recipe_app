# Setup

Phase 1 scaffold: shared grocery lists + recipes on Next.js (App Router) +
Supabase.

## 1. Supabase project
1. Create a project at https://supabase.com.
2. In the SQL editor, run the files in `supabase/` in order:
   - `schema.sql` — tables, RLS policies, triggers
   - `seed.sql` — starter ingredient catalog
   - `storage.sql` — recipe-photos bucket + policies
   - `invites.sql` — secure accept/preview functions for family invites
3. Enable Realtime for `grocery_list_items` (Database → Replication, or it's on
   by default for the `supabase_realtime` publication — add the table if not).
4. (Optional) In Auth settings, keep "Confirm email" on for production.

## 2. Environment
```
cp .env.local.example .env.local
```
Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from
Project Settings → API.

## 3. Run
```
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
npm run build      # production build
```

## What's here
- `middleware.ts` + `src/lib/supabase/*` — auth session refresh, route gating,
  browser/server clients.
- `src/app/login`, `signup`, `onboarding` — auth and family creation.
- `src/app/(app)/lists` — grocery lists; the detail view subscribes to Supabase
  Realtime so checked-off items sync live across family members.
- `src/app/(app)/recipes` — recipe list/create/detail, including the
  "add ingredients to a grocery list" glue feature.

- `src/app/(app)/family` — manage members and send invite links.
- `src/app/join/[token]` — public page where an invitee previews and accepts an
  invite; sign-in/sign-up carry a `next` param back to the join page.

## Not yet built (later phases)
Recipe photo upload wiring, pantry, meal planner, macros, and recipe URL import
(parse Schema.org JSON-LD).
