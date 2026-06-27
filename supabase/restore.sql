-- =============================================================================
-- Recipe App — family backup restore
-- Atomically replaces a family's data with the contents of a backup payload.
--
-- Why a SECURITY DEFINER function instead of client-side delete + insert:
--   * Atomic. The wipe and re-insert run in one transaction, so a failure
--     rolls everything back and the family's existing data is left intact
--     (no half-wiped state).
--   * Privileged. Runs as the function owner, so the bulk delete isn't blocked
--     by per-row RLS the way the client-issued deletes were.
--
-- The caller must be the OWNER of their family. family_id and the user-owned
-- columns are forced to the current family / caller, so a backup restores
-- cleanly even into a different family id.
--
-- Apply after schema.sql.
-- =============================================================================

create or replace function public.restore_family_data(payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_family uuid;
begin
  if v_uid is null then
    raise exception 'You must be signed in to restore a backup';
  end if;

  select fm.family_id into v_family
  from family_members fm
  where fm.user_id = v_uid and fm.role = 'owner'
  limit 1;

  if v_family is null then
    raise exception 'Only the family owner can restore a backup';
  end if;

  -- 1. Wipe the family's current content (children before parents).
  delete from meal_plan_entries where family_id = v_family;
  delete from meal_recipes where meal_id in (select id from meals where family_id = v_family);
  delete from meals where family_id = v_family;
  delete from grocery_list_items where list_id in (select id from grocery_lists where family_id = v_family);
  delete from grocery_lists where family_id = v_family;
  delete from pantry_items where family_id = v_family;
  delete from recipe_ingredients where recipe_id in (select id from recipes where family_id = v_family);
  delete from recipes where family_id = v_family;
  delete from ingredients where family_id = v_family;
  delete from locations where family_id = v_family;

  -- 2. Re-insert from the backup (parents before children).
  insert into locations select * from jsonb_populate_recordset(null::locations,
    (select coalesce(jsonb_agg(r || jsonb_build_object('family_id', to_jsonb(v_family))), '[]'::jsonb)
       from jsonb_array_elements(coalesce(payload->'tables'->'locations','[]'::jsonb)) r));

  insert into ingredients select * from jsonb_populate_recordset(null::ingredients,
    (select coalesce(jsonb_agg(r || jsonb_build_object('family_id', to_jsonb(v_family))), '[]'::jsonb)
       from jsonb_array_elements(coalesce(payload->'tables'->'ingredients','[]'::jsonb)) r));

  insert into recipes select * from jsonb_populate_recordset(null::recipes,
    (select coalesce(jsonb_agg(r || jsonb_build_object('family_id', to_jsonb(v_family), 'created_by', to_jsonb(v_uid))), '[]'::jsonb)
       from jsonb_array_elements(coalesce(payload->'tables'->'recipes','[]'::jsonb)) r));

  insert into recipe_ingredients select * from jsonb_populate_recordset(null::recipe_ingredients,
    coalesce(payload->'tables'->'recipe_ingredients','[]'::jsonb));

  insert into grocery_lists select * from jsonb_populate_recordset(null::grocery_lists,
    (select coalesce(jsonb_agg(r || jsonb_build_object('family_id', to_jsonb(v_family))), '[]'::jsonb)
       from jsonb_array_elements(coalesce(payload->'tables'->'grocery_lists','[]'::jsonb)) r));

  insert into grocery_list_items select * from jsonb_populate_recordset(null::grocery_list_items,
    (select coalesce(jsonb_agg(r || jsonb_build_object('added_by', to_jsonb(v_uid))), '[]'::jsonb)
       from jsonb_array_elements(coalesce(payload->'tables'->'grocery_list_items','[]'::jsonb)) r));

  insert into pantry_items select * from jsonb_populate_recordset(null::pantry_items,
    (select coalesce(jsonb_agg(r || jsonb_build_object('family_id', to_jsonb(v_family))), '[]'::jsonb)
       from jsonb_array_elements(coalesce(payload->'tables'->'pantry_items','[]'::jsonb)) r));

  insert into meals select * from jsonb_populate_recordset(null::meals,
    (select coalesce(jsonb_agg(r || jsonb_build_object('family_id', to_jsonb(v_family))), '[]'::jsonb)
       from jsonb_array_elements(coalesce(payload->'tables'->'meals','[]'::jsonb)) r));

  insert into meal_recipes select * from jsonb_populate_recordset(null::meal_recipes,
    coalesce(payload->'tables'->'meal_recipes','[]'::jsonb));

  insert into meal_plan_entries select * from jsonb_populate_recordset(null::meal_plan_entries,
    (select coalesce(jsonb_agg(r || jsonb_build_object('family_id', to_jsonb(v_family))), '[]'::jsonb)
       from jsonb_array_elements(coalesce(payload->'tables'->'meal_plan_entries','[]'::jsonb)) r));
end;
$$;

revoke execute on function public.restore_family_data(jsonb) from public, anon;
grant  execute on function public.restore_family_data(jsonb) to authenticated;
