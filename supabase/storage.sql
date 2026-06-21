-- =============================================================================
-- Recipe App — Supabase Storage setup
-- Creates the photo bucket and family-scoped access policies.
--
-- Apply after schema.sql (it depends on the is_family_member() helper).
-- Run in the Supabase SQL editor, or via supabase db push.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Bucket
-- Private bucket (public = false). Photos are served via short-lived signed
-- URLs your app generates, so only family members can view them.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recipe-photos',
  'recipe-photos',
  false,
  5242880,                                  -- 5 MB per file
  array['image/jpeg','image/png','image/webp','image/heic']
)
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- Path convention
--
--   recipe-photos / {family_id} / {recipe_id} / {filename}
--
-- The FIRST folder segment is the family_id. The policies below read that
-- segment with storage.foldername(name)[1] and check membership against it, so
-- a user can only touch photos that live under one of their families.
--
-- Example object name your app would upload to:
--   '11111111-1111-1111-1111-111111111111/<recipe-uuid>/photo.jpg'
-- -----------------------------------------------------------------------------

-- RLS is already enabled on storage.objects by Supabase; just add policies.

-- View / download: members of the family that owns the path.
create policy "recipe photos: family read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'recipe-photos'
  and is_family_member( ((storage.foldername(name))[1])::uuid )
);

-- Upload: members of the family in the path.
create policy "recipe photos: family insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'recipe-photos'
  and is_family_member( ((storage.foldername(name))[1])::uuid )
);

-- Replace/overwrite: members of the family in the path.
create policy "recipe photos: family update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'recipe-photos'
  and is_family_member( ((storage.foldername(name))[1])::uuid )
)
with check (
  bucket_id = 'recipe-photos'
  and is_family_member( ((storage.foldername(name))[1])::uuid )
);

-- Delete: members of the family in the path.
create policy "recipe photos: family delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'recipe-photos'
  and is_family_member( ((storage.foldername(name))[1])::uuid )
);

-- -----------------------------------------------------------------------------
-- App-side usage notes
-- -----------------------------------------------------------------------------
-- Upload (client, supabase-js):
--   const path = `${familyId}/${recipeId}/${crypto.randomUUID()}.jpg`;
--   await supabase.storage.from('recipe-photos').upload(path, file);
--   // then persist `path` (or its signed URL) into recipes.image_url
--
-- Display (private bucket -> signed URL, e.g. 1 hour):
--   const { data } = await supabase.storage
--     .from('recipe-photos')
--     .createSignedUrl(path, 3600);
--
-- Avatars / pantry photos: either reuse this bucket with a different top-level
-- convention, or create a parallel bucket with the same policy shape.
