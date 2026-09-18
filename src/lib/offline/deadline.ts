// Request deadlines for client-side Supabase queries.
//
// `navigator.onLine` is true on a one-bar connection at the back of a store, so
// every query guarded by an `if (online)` check still runs there — and without
// a deadline it can stay open for as long as the OS allows, which is far longer
// than anyone will wait. Pass the signal to `.abortSignal()` and the request
// fails fast instead, letting the caller fall back to its cached copy.
//
// An aborted PostgREST call comes back as `{ error }` with an empty `code`
// (it does not throw), so callers handle it like any other query failure.

/** Queries a screen is waiting on before it can render. */
export const QUERY_TIMEOUT_MS = 8_000;

/** Writes replayed from the outbox. */
export const OP_TIMEOUT_MS = 8_000;

export function deadline(ms: number = QUERY_TIMEOUT_MS): {
  signal: AbortSignal;
  clear: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

/**
 * Run a PostgREST query under a deadline. The builder is handed the signal;
 * a timeout surfaces as a normal `{ error }` result, so callers keep whatever
 * cached value they already put on screen.
 */
export async function withDeadline<T>(
  fn: (signal: AbortSignal) => PromiseLike<T>,
  ms: number = QUERY_TIMEOUT_MS,
): Promise<T> {
  const { signal, clear } = deadline(ms);
  try {
    return await fn(signal);
  } finally {
    clear();
  }
}
