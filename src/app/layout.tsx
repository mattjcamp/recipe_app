import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Family Recipes",
  description: "Shared grocery lists, recipes, and meal plans for your family.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Mobile-first: this app is used primarily on phones.
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
