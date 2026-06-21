# Recipe App — Architecture & Build Plan

A shared family app for grocery lists, recipes, pantry, meal plans, and macro tracking.
Built on Next.js + TypeScript, hosted on Vercel, backed by Supabase.

---

## 1. Stack at a glance

| Layer | Choice | Why |
|---|---|---|
| Frontend / API | Next.js (App Router) + TypeScript | One codebase for web + API routes; renders well on mobile browsers |
| Hosting | Vercel | First-class Next.js support; free tier covers a family easily |
| Database | Supabase Postgres | Relational model fits families/recipes/lists; strong consistency |
| Auth | Supabase Auth | Email + OAuth (Google/Apple) with minimal wiring |
| Realtime | Supabase Realtime | Live list/recipe updates across family members via Postgres change feeds |
| File storage | Supabase Storage | Recipe & pantry photos (blobs), separate from structured data |
| Access control | Postgres Row-Level Security (RLS) | Enforces "you only see your family's data" at the database, not in app code |
| Mobile (later) | PWA first, Capacitor if needed | Installable home-screen app + camera via web APIs before going native |

Picking Supabase means auth, database, realtime, and file storage come from one
service that already understands the multi-tenant pattern this app needs. That
removes the three biggest "build it yourself" burdens: accounts, live sync, and
per-family data isolation.

---

## 2. Data storage strategy

There are three distinct kinds of data, and each goes somewhere different. Mixing
them up is the most common early mistake.

### a) Structured data → Postgres (Supabase)
Families, users, recipes, ingredients, grocery lists, pantry items, meal plans,
and macro entries. This is relational data with relationships and concurrent
edits, so it needs a real database with a single source of truth and transactions.
**Local files / JSON buckets are not suitable here** — the moment two family
members edit the same list, file storage gives you race conditions and stale reads.

### b) Binary blobs → Object storage (Supabase Storage)
Photos: recipe images, pantry snapshots, user avatars. These are large and don't
belong in the database. Store the file in a storage bucket and keep only the URL
(a `text` column) in Postgres. Buckets are scoped per-family for privacy.

### c) Recipe interchange formats → import only, not your schema
The JSON-LD (Schema.org/Recipe) and h-recipe formats in the README are **publishing
standards for the web**, not a storage design. Use them as an *import path*: most
recipe sites embed Schema.org JSON-LD, so "paste a URL → parse the embedded
JSON-LD → map into our tables" is a great feature. But internally you store
recipes in normalized Postgres tables (below), not as raw JSON-LD blobs — that
keeps ingredients queryable (e.g. "what can I make from my pantry?").

### Realtime & concurrency
Supabase Realtime pushes row changes to subscribed clients over websockets, so
when one member checks off "milk" everyone sees it within a second. For conflict
handling, an `updated_at` timestamp with last-write-wins is fine for v1; grocery
checkboxes rarely collide. Revisit only if it becomes a real problem.

---

## 3. Data model

Conventions: every table has `id uuid primary key default gen_random_uuid()`,
`created_at timestamptz default now()`, and `updated_at timestamptz`. Shared
content carries `family_id`; personal content carries `user_id`.

### Core / membership

**families** — `name`
A family is the primary tenant. Most rows hang off this.

**profiles** — `user_id (FK auth.users)`, `display_name`, `avatar_url`
One row per account, extending Supabase's built-in `auth.users`.

**family_members** — `family_id`, `user_id`, `role` (`owner` | `member`)
Join table linking users to families (many-to-many leaves room for a user in
multiple families later). `role` gates admin actions like removing members.

**family_invites** — `family_id`, `email`, `token`, `expires_at`, `accepted_at`
Invite-by-link/email flow for adding members.

### Recipes

**recipes** — `family_id`, `created_by (user_id)`, `title`, `description`,
`servings`, `prep_minutes`, `cook_minutes`, `image_url`, `source_url`,
`instructions` (text or jsonb array of steps)

**ingredients** — canonical ingredient list: `name`, `default_unit`, `category`
(e.g. produce, dairy). Shared/global so the same "flour" links everywhere.

**recipe_ingredients** — `recipe_id`, `ingredient_id`, `quantity`, `unit`, `note`
Join table; this normalization is what powers pantry matching and auto-adding to
grocery lists.

### Grocery lists

**grocery_lists** — `family_id`, `name`, `is_archived`

**grocery_list_items** — `list_id`, `ingredient_id` (nullable), `free_text`
(for non-catalog items), `quantity`, `unit`, `is_checked`, `added_by`
Either references a known ingredient or holds free text so members can jot
anything.

### Pantry (Phase 2)

**pantry_items** — `family_id`, `ingredient_id`, `quantity`, `unit`,
`expires_on`, `location` (fridge/freezer/pantry)
Drives "what can I cook?" and low-stock prompts.

### Meal planning (Phase 2/3)

**meal_plans** — `family_id`, `week_start_date`

**meal_plan_entries** — `meal_plan_id`, `date`, `meal_type`
(breakfast/lunch/dinner/snack), `recipe_id` (nullable), `note`
A scheduled recipe (or freeform note) on a given day/slot.

### Macro tracking (Phase 3 — mostly personal)

**food_logs** — `user_id`, `logged_at`, `recipe_id` (nullable), `description`,
`servings`, `calories`, `protein_g`, `carbs_g`, `fat_g`
Note `user_id`, not `family_id` — macro data is personal even within a shared family.

### Row-Level Security (the important part)
Enable RLS on every table. The core policy pattern: a user can read/write a row
only if they belong to that row's family. Implement with a helper that checks
`family_id IN (select family_id from family_members where user_id = auth.uid())`.
Personal tables (`food_logs`) check `user_id = auth.uid()` instead. Getting RLS
right at the start is far easier than retrofitting multi-tenant security later.

---

## 4. Phased build roadmap

### Phase 0 — Foundations (week 1)
Scaffold Next.js + TypeScript, connect Supabase, set up auth (email + Google),
create `families` / `profiles` / `family_members`, and the invite flow. Ship a
working "sign up, create a family, invite someone, both log in" loop. Enable RLS
from day one.

### Phase 1 — V1: Lists + Recipes (the shippable core)
- **Grocery lists**: create lists, add/check/remove items, realtime sync across members.
- **Recipes**: create/edit/view recipes with ingredients and steps; photo upload to Storage.
- **Glue feature**: "add all recipe ingredients to a grocery list" — the payoff that makes the app sticky.
- This is the smallest version that's genuinely useful to your family. Stop and use it for a couple of weeks before building more.

### Phase 2 — Pantry + Meal planning
- Pantry inventory with quantities and expiry.
- "What can I make from my pantry?" matching against `recipe_ingredients`.
- Weekly meal planner; planned recipes can push missing ingredients to a list.

### Phase 3 — Macros + native polish
- Personal macro/food logging and daily totals.
- Camera-first capture: start with the browser camera API + PWA install; adopt
  Capacitor only if you want App Store / Play Store distribution and native feel.

### Cross-cutting (ongoing)
Mobile-responsive UI throughout (it's a phone app first), basic tests on the
RLS policies and the recipe-import parser, and error monitoring once real family
members are relying on it.

---

## 5. Open decisions deferred on purpose
- **Recipe import parser**: build in Phase 1 or 2? Cheap win whenever you do it.
- **Conflict resolution**: last-write-wins now; revisit only if collisions hurt.
- **Capacitor vs. PWA**: decide in Phase 3 based on whether the web camera flow is good enough.
- **Multiple families per user**: schema supports it; UI can ignore it until needed.
