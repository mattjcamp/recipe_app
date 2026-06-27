-- =============================================================================
-- Recipe App — recipe publishing (public sharing)
-- A published recipe is reachable at /<family-slug>/<recipe-slug> by anyone.
-- Apply after schema.sql.
-- =============================================================================

alter table recipes  add column if not exists published boolean not null default false;
alter table recipes  add column if not exists slug text;
alter table families add column if not exists slug text;

create unique index if not exists families_slug_key      on families (slug)            where slug is not null;
create unique index if not exists recipes_family_slug_key on recipes  (family_id, slug) where slug is not null;

-- Lowercase, non-alphanumeric -> hyphen, trimmed.
create or replace function public.slugify(input text)
returns text language sql immutable as $$
  select coalesce(
    nullif(trim(both '-' from regexp_replace(lower(coalesce(input,'')), '[^a-z0-9]+', '-', 'g')), ''),
    'item');
$$;

-- Publish / unpublish a recipe; assigns a unique family + recipe slug on first
-- publish (avoiding words the app uses as routes). Caller must belong to the
-- recipe's family. Returns the slugs so the app can build the public URL.
create or replace function public.publish_recipe(p_recipe_id uuid, p_published boolean)
returns table(family_slug text, recipe_slug text)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_family uuid; v_title text; v_rslug text; v_fname text; v_fslug text;
  base text; candidate text; n int;
  reserved text[] := array['recipes','family','lists','plan','login','signup',
    'onboarding','join','auth','api','r','share','p','sw','manifest','offline',
    'favicon','icon-192','icon-512','_next','public'];
begin
  if v_uid is null then raise exception 'You must be signed in'; end if;

  select r.family_id, r.title, r.slug into v_family, v_title, v_rslug
  from recipes r where r.id = p_recipe_id;
  if v_family is null then raise exception 'Recipe not found'; end if;
  if not exists (select 1 from family_members where family_id = v_family and user_id = v_uid) then
    raise exception 'Not allowed';
  end if;

  select slug, name into v_fslug, v_fname from families where id = v_family;
  if v_fslug is null then
    base := slugify(v_fname); candidate := base; n := 1;
    while (candidate = any(reserved)) or exists (select 1 from families where slug = candidate) loop
      n := n + 1; candidate := base || '-' || n::text;
    end loop;
    update families set slug = candidate where id = v_family;
    v_fslug := candidate;
  end if;

  if v_rslug is null then
    base := slugify(v_title); candidate := base; n := 1;
    while exists (select 1 from recipes where family_id = v_family and slug = candidate) loop
      n := n + 1; candidate := base || '-' || n::text;
    end loop;
    update recipes set slug = candidate where id = p_recipe_id;
    v_rslug := candidate;
  end if;

  update recipes set published = p_published where id = p_recipe_id;
  family_slug := v_fslug; recipe_slug := v_rslug; return next;
end; $$;

revoke execute on function public.publish_recipe(uuid, boolean) from public, anon;
grant  execute on function public.publish_recipe(uuid, boolean) to authenticated;

-- Anonymous read access to PUBLISHED content (additive to the family policies).
-- anon also needs execute on is_family_member so the existing policies evaluate.
grant execute on function public.is_family_member(uuid) to anon;

drop policy if exists "recipes public read" on recipes;
create policy "recipes public read" on recipes
  for select to anon, authenticated using (published = true);

drop policy if exists "recipe_ingredients public read" on recipe_ingredients;
create policy "recipe_ingredients public read" on recipe_ingredients
  for select to anon, authenticated
  using (exists (select 1 from recipes r where r.id = recipe_ingredients.recipe_id and r.published));

drop policy if exists "families public read" on families;
create policy "families public read" on families
  for select to anon, authenticated
  using (exists (select 1 from recipes r where r.family_id = families.id and r.published));

-- Storage: photos of published recipes are readable by anyone.
create or replace function public.is_published_recipe_photo(object_name text)
returns boolean language plpgsql security definer stable set search_path = public as $$
declare parts text[]; rid uuid;
begin
  parts := storage.foldername(object_name);
  if array_length(parts,1) < 3 or parts[2] <> 'recipes' then return false; end if;
  begin rid := parts[3]::uuid; exception when others then return false; end;
  return exists (select 1 from recipes where id = rid and published);
end; $$;
grant execute on function public.is_published_recipe_photo(text) to anon, authenticated;

drop policy if exists "published recipe photos public read" on storage.objects;
create policy "published recipe photos public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'recipe-photos' and public.is_published_recipe_photo(name));
