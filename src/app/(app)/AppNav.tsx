"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type LinkDef = {
  href: string;
  label: string;
  icon: string;
  offlineOk: boolean;
};

// Lists & Pantry are local-first (work offline); Recipes & Family need a
// connection, so they're disabled when offline.
const LINKS: LinkDef[] = [
  { href: "/lists", label: "Lists", icon: "🛒", offlineOk: true },
  { href: "/pantry", label: "Pantry", icon: "🥫", offlineOk: true },
  { href: "/recipes", label: "Recipes", icon: "📖", offlineOk: false },
  { href: "/family", label: "Family", icon: "👪", offlineOk: false },
];

function useOffline() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return offline;
}

// Bottom tab bar on desktop; top hamburger menu on phones.
export default function AppNav({ variant }: { variant: "mobile" | "desktop" }) {
  const pathname = usePathname();
  const offline = useOffline();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  if (variant === "desktop") {
    return (
      <nav className="sticky bottom-0 hidden grid-cols-4 border-t border-slate-200 bg-white sm:grid">
        {LINKS.map((l) => {
          if (offline && !l.offlineOk) {
            return (
              <span
                key={l.href}
                title="Needs a connection"
                className="cursor-not-allowed py-3 text-center text-sm font-medium text-slate-300"
              >
                {l.icon} {l.label}
              </span>
            );
          }
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`py-3 text-center text-sm font-medium hover:bg-slate-50 ${
                isActive(l.href) ? "text-emerald-700" : "text-slate-700"
              }`}
            >
              {l.icon} {l.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  // mobile
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white sm:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="font-semibold">Family Recipes</span>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Menu"
          aria-expanded={open}
          className="rounded-lg px-2 py-1 text-xl leading-none hover:bg-slate-100"
        >
          {open ? "✕" : "☰"}
        </button>
      </div>
      {open && (
        <nav className="border-t border-slate-200">
          {LINKS.map((l) => {
            if (offline && !l.offlineOk) {
              return (
                <div
                  key={l.href}
                  className="px-4 py-3 text-sm font-medium text-slate-300"
                >
                  {l.icon} {l.label}{" "}
                  <span className="text-xs">· offline</span>
                </div>
              );
            }
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`block px-4 py-3 text-sm font-medium hover:bg-slate-50 ${
                  isActive(l.href) ? "text-emerald-700" : "text-slate-700"
                }`}
              >
                {l.icon} {l.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
