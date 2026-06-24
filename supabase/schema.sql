-- =============================================================================
-- Recipe App — Supabase schema
-- Postgres + Row-Level Security. Designed to run on a fresh Supabase project.
-- Apply with: supabase db push   (or paste into the SQL editor)
-- =============================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- -----------------------------------------------------------------------------
-- Shared helpers
-- -----------------------------------------------------------------------------

-- Keep updated_at fresh on any UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- NOTE: the family-membership helper functions (is_family_member /
-- is_family_owner) are defined AFTER the family_members table below, because
-- `language sql` function bodies are validated against referenced tables at
-- creation time.

-- =============================================================================
-- Core / membership
-- =============================================================================

create table families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Extends auth.users with app-level profile fields.
create table profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table family_members (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'member' check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  unique (family_id, user_id)
);

create table family_invites (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  email       text not null,
  token       text not null unique default encode(gen_random_bytes(16), 'hex'),
  invited_by  uuid references auth.users(id) on delete set null,
  expires_at  timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);

-- Membership helpers (defined here, now that family_members exists).
-- SECURITY DEFINER so they bypass RLS — this is what prevents infinite
-- recursion when family_members' own policies need to check membership.
create or replace function public.is_family_member(target_family uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from family_members
    where family_id = target_family and user_id = auth.uid()
  );
$$;

create or replace function public.is_family_owner(target_family uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from family_members
    where family_id = target_family and user_id = auth.uid() and role = 'owner'
  );
$$;

-- =============================================================================
-- Locations (store / aisle / aisle number) — family-scoped, reusable
-- =============================================================================
create table locations (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families(id) on delete cascade,
  store      text,
  aisle      text,
  aisle_num  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on locations (family_id);

-- =============================================================================
-- Recipes
-- =============================================================================

-- Per-family reusable item catalog.
create table ingredients (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references families(id) on delete cascade,
  name         text not null,
  default_unit text,
  quantity     numeric,                    -- default quantity, flows into list items
  category     text,                       -- (legacy; no longer surfaced in the UI)
  aisle        text,                       -- (legacy free-text; superseded by location_id)
  notes        text,                       -- default notes
  image_path   text,                       -- default photo (recipe-photos bucket)
  location_id  uuid references locations(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (family_id, name)
);
create index on ingredients (family_id);

create table recipes (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references families(id) on delete cascade,
  created_by   uuid references auth.users(id) on delete set null,
  title        text not null,
  description  text,
  servings     int,
  prep_minutes int,
  cook_minutes int,
  image_url    text,
  source_url   text,
  instructions jsonb not null default '[]'::jsonb,  -- array of step strings
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table recipe_ingredients (
  id            uuid primary key default gen_random_uuid(),
  recipe_id     uuid not null references recipes(id) on delete cascade,
  ingredient_id uuid references ingredients(id) on delete set null,
  free_text     text,                      -- fallback if not in catalog
  quantity      numeric,
  unit          text,
  note          text,
  sort_order    int not null default 0
);

-- =============================================================================
-- Grocery lists
-- =============================================================================

create table grocery_lists (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  name        text not null,
  kind        text not null default 'grocery' check (kind in ('grocery','pantry')),
  is_archived boolean not null default false,
  is_favorite boolean not null default false,  -- the one shown on the Lists tab
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- At most one favorite grocery list, and one pantry, per family.
create unique index grocery_lists_one_favorite_per_family
  on grocery_lists (family_id) where is_favorite;
create unique index grocery_lists_one_pantry_per_family
  on grocery_lists (family_id) where kind = 'pantry';

create table grocery_list_items (
  id            uuid primary key default gen_random_uuid(),
  list_id       uuid not null references grocery_lists(id) on delete cascade,
  ingredient_id uuid references ingredients(id) on delete set null,
  free_text     text,
  quantity      numeric,
  unit          text,
  is_checked    boolean not null default false,
  image_path    text,                       -- camera photo in recipe-photos bucket
  notes         text,
  aisle         text,                       -- (legacy free-text; superseded by location_id)
  location_id   uuid references locations(id) on delete set null,
  added_by      uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (ingredient_id is not null or free_text is not null)
);

-- =============================================================================
-- Pantry (Phase 2)
-- =============================================================================

create table pantry_items (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families(id) on delete cascade,
  ingredient_id uuid references ingredients(id) on delete set null,
  free_text     text,
  quantity      numeric,
  unit          text,
  location      text,                       -- fridge, freezer, pantry
  expires_on    date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (ingredient_id is not null or free_text is not null)
);

-- =============================================================================
-- Meal planning (Phase 2/3)
-- =============================================================================

create table meal_plans (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references families(id) on delete cascade,
  week_start_date date not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (family_id, week_start_date)
);

create table meal_plan_entries (
  id           uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references meal_plans(id) on delete cascade,
  entry_date   date not null,
  meal_type    text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  recipe_id    uuid references recipes(id) on delete set null,
  note         text,
  created_at   timestamptz not null default now()
);

-- =============================================================================
-- Meals — a named collection of recipes (later scheduled on a weekly plan)
-- =============================================================================
create table meals (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on meals (family_id);

create table meal_recipes (
  id         uuid primary key default gen_random_uuid(),
  meal_id    uuid not null references meals(id) on delete cascade,
  recipe_id  uuid not null references recipes(id) on delete cascade,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (meal_id, recipe_id)
);
create index on meal_recipes (meal_id);
create index on meal_recipes (recipe_id);

-- =============================================================================
-- Macro tracking (Phase 3 — personal, user-scoped not family-scoped)
-- =============================================================================

create table food_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  logged_at   timestamptz not null default now(),
  recipe_id   uuid references recipes(id) on delete set null,
  description text,
  servings    numeric default 1,
  calories    numeric,
  protein_g   numeric,
  carbs_g     numeric,
  fat_g       numeric,
  created_at  timestamptz not null default now()
);

-- =============================================================================
-- Indexes (foreign keys + hot lookups)
-- =============================================================================

create index on family_members (user_id);
create index on family_members (family_id);
create index on family_invites (token);
create index on recipes (family_id);
create index on recipe_ingredients (recipe_id);
create index on recipe_ingredients (ingredient_id);
create index on grocery_lists (family_id);
create index on grocery_list_items (list_id);
create index on pantry_items (family_id);
create index on meal_plans (family_id);
create index on meal_plan_entries (meal_plan_id);
create index on food_logs (user_id);

-- =============================================================================
-- updated_at triggers
-- =============================================================================

create trigger trg_families_updated      before update on families            for each row execute function set_updated_at();
create trigger trg_profiles_updated       before update on profiles            for each row execute function set_updated_at();
create trigger trg_recipes_updated        before update on recipes             for each row execute function set_updated_at();
create trigger trg_grocery_lists_updated  before update on grocery_lists       for each row execute function set_updated_at();
create trigger trg_grocery_items_updated  before update on grocery_list_items  for each row execute function set_updated_at();
create trigger trg_pantry_updated         before update on pantry_items        for each row execute function set_updated_at();
create trigger trg_meal_plans_updated     before update on meal_plans          for each row execute function set_updated_at();
create trigger trg_locations_updated      before update on locations           for each row execute function set_updated_at();
create trigger trg_meals_updated          before update on meals               for each row execute function set_updated_at();

-- =============================================================================
-- Row-Level Security
-- Enable on every table, then add policies. Default-deny once enabled.
-- =============================================================================

alter table families           enable row level security;
alter table profiles           enable row level security;
alter table family_members     enable row level security;
alter table family_invites     enable row level security;
alter table ingredients        enable row level security;
alter table recipes            enable row level security;
alter table recipe_ingredients enable row level security;
alter table grocery_lists      enable row level security;
alter table grocery_list_items enable row level security;
alter table pantry_items       enable row level security;
alter table meal_plans         enable row level security;
alter table meal_plan_entries  enable row level security;
alter table food_logs          enable row level security;
alter table locations          enable row level security;
alter table meals              enable row level security;
alter table meal_recipes       enable row level security;

-- ---- families -------------------------------------------------------------
-- Members can see their families; any authenticated user can create one.
create policy families_select on families
  for select using (is_family_member(id));
create policy families_insert on families
  for insert with check (auth.uid() is not null);
create policy families_update on families
  for update using (is_family_owner(id));
create policy families_delete on families
  for delete using (is_family_owner(id));

-- ---- profiles -------------------------------------------------------------
-- You manage your own profile; you can read profiles of people in your families.
create policy profiles_select_own on profiles
  for select using (user_id = auth.uid());
create policy profiles_select_family on profiles
  for select using (
    exists (
      select 1 from family_members me
      join family_members them on them.family_id = me.family_id
      where me.user_id = auth.uid() and them.user_id = profiles.user_id
    )
  );
create policy profiles_upsert on profiles
  for insert with check (user_id = auth.uid());
create policy profiles_update on profiles
  for update using (user_id = auth.uid());

-- ---- family_members -------------------------------------------------------
-- Read members of your families (uses SECURITY DEFINER helper to avoid recursion).
create policy members_select on family_members
  for select using (is_family_member(family_id));
-- A user inserts their OWN membership (join via invite); owners can also add.
create policy members_insert on family_members
  for insert with check (user_id = auth.uid() or is_family_owner(family_id));
create policy members_delete on family_members
  for delete using (user_id = auth.uid() or is_family_owner(family_id));
create policy members_update on family_members
  for update using (is_family_owner(family_id));

-- ---- family_invites -------------------------------------------------------
create policy invites_select on family_invites
  for select using (is_family_member(family_id));
create policy invites_insert on family_invites
  for insert with check (is_family_member(family_id));
create policy invites_delete on family_invites
  for delete using (is_family_owner(family_id));

-- ---- ingredients (per-family catalog) -------------------------------------
create policy ingredients_all on ingredients
  for all using (is_family_member(family_id))
  with check (is_family_member(family_id));

-- ---- recipes --------------------------------------------------------------
create policy recipes_all on recipes
  for all using (is_family_member(family_id))
  with check (is_family_member(family_id));

-- ---- recipe_ingredients (scoped through parent recipe) ---------------------
create policy recipe_ingredients_all on recipe_ingredients
  for all using (
    exists (select 1 from recipes r
            where r.id = recipe_ingredients.recipe_id
              and is_family_member(r.family_id))
  )
  with check (
    exists (select 1 from recipes r
            where r.id = recipe_ingredients.recipe_id
              and is_family_member(r.family_id))
  );

-- ---- grocery_lists --------------------------------------------------------
create policy grocery_lists_all on grocery_lists
  for all using (is_family_member(family_id))
  with check (is_family_member(family_id));

-- ---- grocery_list_items (scoped through parent list) -----------------------
create policy grocery_items_all on grocery_list_items
  for all using (
    exists (select 1 from grocery_lists l
            where l.id = grocery_list_items.list_id
              and is_family_member(l.family_id))
  )
  with check (
    exists (select 1 from grocery_lists l
            where l.id = grocery_list_items.list_id
              and is_family_member(l.family_id))
  );

-- ---- pantry_items ---------------------------------------------------------
create policy pantry_all on pantry_items
  for all using (is_family_member(family_id))
  with check (is_family_member(family_id));

-- ---- meal_plans -----------------------------------------------------------
create policy meal_plans_all on meal_plans
  for all using (is_family_member(family_id))
  with check (is_family_member(family_id));

-- ---- meal_plan_entries (scoped through parent plan) ------------------------
create policy meal_plan_entries_all on meal_plan_entries
  for all using (
    exists (select 1 from meal_plans mp
            where mp.id = meal_plan_entries.meal_plan_id
              and is_family_member(mp.family_id))
  )
  with check (
    exists (select 1 from meal_plans mp
            where mp.id = meal_plan_entries.meal_plan_id
              and is_family_member(mp.family_id))
  );

-- ---- food_logs (personal) -------------------------------------------------
create policy food_logs_all on food_logs
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---- locations ------------------------------------------------------------
create policy locations_all on locations
  for all using (is_family_member(family_id))
  with check (is_family_member(family_id));

-- ---- meals ----------------------------------------------------------------
create policy meals_all on meals
  for all using (is_family_member(family_id))
  with check (is_family_member(family_id));

create policy meal_recipes_all on meal_recipes
  for all using (
    exists (select 1 from meals m
            where m.id = meal_recipes.meal_id and is_family_member(m.family_id))
  )
  with check (
    exists (select 1 from meals m
            where m.id = meal_recipes.meal_id and is_family_member(m.family_id))
  );

-- =============================================================================
-- Auto-create a profile row when a new auth user signs up.
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- Create a family + add the creator as owner, atomically.
--
-- Done as a SECURITY DEFINER function because a plain
-- `insert into families ... returning id` fails under RLS: the RETURNING clause
-- is checked against the SELECT policy (is_family_member), but the creator is
-- not a member yet at insert time. The function sidesteps that and guarantees
-- the family + owner membership are created together.
-- =============================================================================
create or replace function public.create_family(family_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to create a family';
  end if;
  if coalesce(trim(family_name), '') = '' then
    raise exception 'Family name is required';
  end if;

  insert into families (name) values (trim(family_name)) returning id into new_id;
  insert into family_members (family_id, user_id, role)
  values (new_id, auth.uid(), 'owner');

  return new_id;
end;
$$;

revoke execute on function public.create_family(text) from public, anon;
grant  execute on function public.create_family(text) to authenticated;

-- =============================================================================
-- Function privilege hardening (satisfies Supabase security advisors).
-- RLS helpers must stay executable by `authenticated` (policies call them),
-- but nothing here should be reachable by anon or the public role.
-- =============================================================================
revoke execute on function public.handle_new_user()       from public, anon, authenticated;
revoke execute on function public.is_family_member(uuid)   from public, anon;
revoke execute on function public.is_family_owner(uuid)    from public, anon;
