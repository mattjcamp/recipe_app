import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentFamily } from "@/lib/family";
import OnlineBanner from "./OnlineBanner";

// Layout for all signed-in, in-a-family pages. Provides the nav chrome and
// enforces that the user has completed onboarding.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const family = await getCurrentFamily();
  if (!family) redirect("/onboarding");

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <OnlineBanner />
      <main className="flex-1 px-4 py-4">{children}</main>

      <nav className="sticky bottom-0 grid grid-cols-3 border-t border-slate-200 bg-white">
        <Link
          href="/lists"
          className="py-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          🛒 Lists
        </Link>
        <Link
          href="/recipes"
          className="py-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          📖 Recipes
        </Link>
        <Link
          href="/family"
          className="py-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          👪 Family
        </Link>
      </nav>
    </div>
  );
}
