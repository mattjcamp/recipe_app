import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Recipe/pantry photos are served from Supabase Storage signed URLs.
  // Add your project's storage hostname here to use next/image with them.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },
};

export default nextConfig;
