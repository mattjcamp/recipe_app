"use client";

import { useOnline } from "@/lib/useOnline";

// Wraps a control that can't work without a connection — typically a form bound
// to a server action, which a cached page will happily render and then fail on.
// Shows `fallback` instead of leaving a button that does nothing.
export default function OnlineOnly({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const online = useOnline();
  if (!online) return <>{fallback ?? null}</>;
  return <>{children}</>;
}
