import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Persist auth cookies (~400 days) so installed apps stay signed in across
// launches. Empty value = deletion (sign out) — leave untouched.
const PERSIST_MAX_AGE = 60 * 60 * 24 * 400;
function persist(value: string, options: CookieOptions): CookieOptions {
  if (value === "") return options;
  return { ...options, maxAge: PERSIST_MAX_AGE };
}

// Supabase client for Server Components, Server Actions, and Route Handlers.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, persist(value, options)),
            );
          } catch {
            // Called from a Server Component where cookies are read-only.
            // The middleware refreshes the session, so this can be ignored.
          }
        },
      },
    },
  );
}
