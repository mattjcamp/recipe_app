import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegister from "./ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "Family Recipes",
  description: "Shared grocery lists, recipes, and meal plans for your family.",
  manifest: "/manifest.webmanifest",
  // Launch in standalone mode when added to a home screen.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Family Recipes",
  },
  other: {
    // iOS Safari only enters standalone mode with the apple-prefixed meta;
    // Next's appleWebApp.capable now emits only "mobile-web-app-capable", so we
    // set both explicitly.
    "apple-mobile-web-app-capable": "yes",
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Mobile-first: this app is used primarily on phones.
  maximumScale: 1,
  themeColor: "#059669",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
