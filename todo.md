# To Do




# Offline Use

The app grocery list will need to function even without internet. This is a heafty feature so we will need to put some time aside for it. We already did the first two steps to provide a read-only version of the app while offline, but we will need the app to gather changes and then sync once the connection is restored.

Here is the original guidance:

Queue changes offline and sync when reconnected (check-offs, adds) — this is the real work, since Supabase has no built-in offline sync. It'd mean a local store plus a sync layer (hand-rolled, or a library like TanStack Query persistence / Replicache / PowerSync).