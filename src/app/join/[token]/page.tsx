import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { acceptInvite } from "./actions";

type Preview = {
  family_id: string;
  family_name: string;
  email: string;
  expired: boolean;
  accepted: boolean;
};

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: previewData } = await supabase.rpc("get_invite_preview", {
    invite_token: token,
  });
  const preview = (previewData as Preview[] | null)?.[0] ?? null;

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 text-center">
      {children}
    </main>
  );

  if (!preview) {
    return (
      <Shell>
        <h1 className="mb-2 text-2xl font-semibold">Invite not found</h1>
        <p className="text-sm text-slate-500">
          This invite link is invalid. Ask a family member to send a new one.
        </p>
      </Shell>
    );
  }

  if (preview.accepted || preview.expired) {
    return (
      <Shell>
        <h1 className="mb-2 text-2xl font-semibold">
          {preview.accepted ? "Invite already used" : "Invite expired"}
        </h1>
        <p className="text-sm text-slate-500">
          Ask a member of {preview.family_name} to send you a fresh invite.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="mb-1 text-2xl font-semibold">
        Join {preview.family_name}
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        You&apos;ve been invited to share grocery lists, recipes, and meal plans.
      </p>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {user ? (
        <form action={acceptInvite}>
          <input type="hidden" name="token" value={token} />
          <button className="w-full rounded-lg bg-emerald-600 px-3 py-2 font-medium text-white hover:bg-emerald-700">
            Accept invite
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-500">
            Sign in or create an account to join.
          </p>
          <Link
            href={`/login?next=${encodeURIComponent(`/join/${token}`)}`}
            className="rounded-lg bg-emerald-600 px-3 py-2 font-medium text-white hover:bg-emerald-700"
          >
            Sign in
          </Link>
          <Link
            href={`/signup?next=${encodeURIComponent(`/join/${token}`)}`}
            className="rounded-lg border border-slate-300 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50"
          >
            Create account
          </Link>
        </div>
      )}
    </Shell>
  );
}
