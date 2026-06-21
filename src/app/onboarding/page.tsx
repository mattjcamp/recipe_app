import { redirect } from "next/navigation";
import { getCurrentFamily } from "@/lib/family";
import { createClient } from "@/lib/supabase/server";
import { createFamily, acceptPendingInvite } from "./actions";

type PendingInvite = { token: string; family_id: string; family_name: string };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Already in a family? Skip onboarding.
  const family = await getCurrentFamily();
  if (family) redirect("/lists");

  const { error } = await searchParams;

  // Any invites addressed to this user's email that they haven't accepted yet?
  const supabase = await createClient();
  const { data: pendingData } = await supabase.rpc("list_my_pending_invites");
  const pending = (pendingData as PendingInvite[] | null) ?? [];

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-semibold">Set up your family</h1>
      <p className="mb-6 text-sm text-slate-500">
        A family shares grocery lists, recipes, and meal plans.
      </p>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {pending.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-slate-600">
            You&apos;ve been invited
          </h2>
          <ul className="flex flex-col gap-2">
            {pending.map((inv) => (
              <li
                key={inv.token}
                className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3"
              >
                <span className="font-medium">{inv.family_name}</span>
                <form action={acceptPendingInvite}>
                  <input type="hidden" name="token" value={inv.token} />
                  <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">
                    Join
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <p className="my-4 text-center text-xs uppercase tracking-wide text-slate-400">
            or start your own
          </p>
        </section>
      )}

      <form action={createFamily} className="flex flex-col gap-3">
        <input
          name="name"
          type="text"
          required
          placeholder="Family name (e.g. The Campbells)"
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
        <button className="rounded-lg bg-emerald-600 px-3 py-2 font-medium text-white hover:bg-emerald-700">
          Create family
        </button>
      </form>
    </main>
  );
}
