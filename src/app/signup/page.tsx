import Link from "next/link";
import { signup } from "../login/actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-semibold">Create your account</h1>
      <p className="mb-6 text-sm text-slate-500">
        You&apos;ll set up or join a family next.
      </p>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form action={signup} className="flex flex-col gap-3">
        {next && <input type="hidden" name="next" value={next} />}
        <input
          name="display_name"
          type="text"
          placeholder="Your name"
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
        <input
          name="password"
          type="password"
          required
          minLength={6}
          placeholder="Password (min 6 chars)"
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
        <button className="rounded-lg bg-emerald-600 px-3 py-2 font-medium text-white hover:bg-emerald-700">
          Sign up
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          className="font-medium text-emerald-700"
        >
          Sign in
        </Link>
      </p>
    </main>
  );
}
