# To Do


cd ~/Projects/recipe_app

# 1) Preview first (writes nothing):
node scripts/import-recipes.mjs --dry "/Users/matthewcampbell/Projects/recipes/Recipes"

# 2) Real import (paste your key inline):
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhqa2N2b2xoaGhtdG5tZ3hwcnF2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjA2MzA1MiwiZXhwIjoyMDk3NjM5MDUyfQ.FvsSSS6rl13aEGQsO8pYASyL4ig0Ep--cT1CvuWMVzU \
  node scripts/import-recipes.mjs "/Users/matthewcampbell/Projects/recipes/Recipes"


# Offline Use

The app grocery list will need to function even without internet. This is a heafty feature so we will need to put some time aside for it. We already did the first two steps to provide a read-only version of the app while offline, but we will need the app to gather changes and then sync once the connection is restored.

Here is the original guidance:

Queue changes offline and sync when reconnected (check-offs, adds) — this is the real work, since Supabase has no built-in offline sync. It'd mean a local store plus a sync layer (hand-rolled, or a library like TanStack Query persistence / Replicache / PowerSync).