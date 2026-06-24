import { redirect } from "next/navigation";
import { getCurrentFamily } from "@/lib/family";
import OnlineBanner from "./OnlineBanner";
import AppNav from "./AppNav";

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
      <AppNav variant="mobile" />
      <main className="flex-1 px-4 py-4">{children}</main>
      <AppNav variant="desktop" />
    </div>
  );
}
