import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamily } from "@/lib/family";
import type { FamilyMember, FamilyInvite, Profile } from "@/lib/database.types";
import Link from "next/link";
import { createInvite, revokeInvite, removeMember } from "./actions";
import CopyLink from "./CopyLink";

export default async function FamilyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const family = await getCurrentFamily();
  if (!family) redirect("/onboarding");

  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: memberRows } = await supabase
    .from("family_members")
    .select("id, user_id, role")
    .eq("family_id", family.familyId);

  const members = (memberRows as Pick<
    FamilyMember,
    "id" | "user_id" | "role"
  >[]) ?? [];

  // profiles aren't directly FK-linked to family_members, so fetch separately.
  const { data: profileRows } = await supabase
    .from("profiles")
    .select("user_id, display_name")
    .in(
      "user_id",
      members.map((m) => m.user_id),
    );

  const nameByUser = new Map(
    ((profileRows as Pick<Profile, "user_id" | "display_name">[]) ?? []).map(
      (p) => [p.user_id, p.display_name],
    ),
  );

  const { data: inviteRows } = await supabase
    .from("family_invites")
    .select("*")
    .eq("family_id", family.familyId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });

  const invites = (inviteRows as FamilyInvite[]) ?? [];
  const isOwner = family.role === "owner";

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">{family.name}</h1>
      <p className="mb-6 text-sm text-slate-500">Manage members and invites.</p>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <Link
        href="/family/lists"
        className="mb-2 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 hover:border-emerald-300"
      >
        <span className="font-medium">🛒 Grocery lists</span>
        <span className="text-slate-300">›</span>
      </Link>
      <Link
        href="/family/catalog"
        className="mb-6 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 hover:border-emerald-300"
      >
        <span className="font-medium">🧺 Item catalog</span>
        <span className="text-slate-300">›</span>
      </Link>

      <section className="mb-8">
        <h2 className="mb-2 font-semibold">Members</h2>
        <ul className="flex flex-col gap-2">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
            >
              <span>
                {nameByUser.get(m.user_id) || "Member"}
                {m.user_id === user?.id && (
                  <span className="ml-2 text-xs text-slate-400">(you)</span>
                )}
                {m.role === "owner" && (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
                    owner
                  </span>
                )}
              </span>
              {isOwner && m.user_id !== user?.id && (
                <form action={removeMember}>
                  <input type="hidden" name="member_id" value={m.id} />
                  <button className="text-sm text-slate-400 hover:text-red-600">
                    Remove
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Invite someone</h2>
        <form action={createInvite} className="mb-4 flex gap-2">
          <input
            name="email"
            type="email"
            required
            placeholder="their@email.com"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
          />
          <button className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700">
            Invite
          </button>
        </form>

        {invites.length === 0 ? (
          <p className="text-sm text-slate-500">No pending invites.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="rounded-lg border border-slate-200 bg-white px-4 py-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">{inv.email}</span>
                  <form action={revokeInvite}>
                    <input type="hidden" name="invite_id" value={inv.id} />
                    <button className="text-sm text-slate-400 hover:text-red-600">
                      Revoke
                    </button>
                  </form>
                </div>
                <CopyLink token={inv.token} />
                <p className="mt-1 text-xs text-slate-400">
                  Expires {new Date(inv.expires_at).toLocaleDateString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
