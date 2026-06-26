import type { MetadataRoute } from "next";

// Web app manifest — makes the app installable and launch standalone.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Family Recipes",
    short_name: "Recipes",
    description: "Shared grocery lists, recipes, and meal plans for your family.",
    id: "/",
    start_url: "/lists",
    // Scope must cover the whole app — including /login. Without this it
    // defaults to the start_url's folder (/lists), so the post-launch redirect
    // to /login lands out of scope and iOS drops the web app into Safari.
    scope: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#059669",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
