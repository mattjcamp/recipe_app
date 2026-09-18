// The current family id, remembered locally.
//
// Several screens need it only to build a storage path, and they normally learn
// it from a query — which means they don't have it offline, which is exactly
// when a photo is most likely to be taken. The app layout writes it on every
// load, so it's there when the network isn't.

const KEY = "recipe-app:family-id";

export function cacheFamilyId(id: string): void {
  if (!id) return;
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    // private mode or blocked storage — callers fall back to their prop
  }
}

export function cachedFamilyId(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}
