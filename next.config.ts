import type { NextConfig } from "next";

// Salon photos are served from the Supabase Storage bucket of this project.
const supabaseUrl = process.env.SALONFLOW_SUPABASE_URL ? new URL(process.env.SALONFLOW_SUPABASE_URL) : null;
const localSupabase = supabaseUrl ? ["127.0.0.1", "localhost"].includes(supabaseUrl.hostname) : false;

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: supabaseUrl
      ? [
          {
            protocol: supabaseUrl.protocol.replace(":", "") as "http" | "https",
            hostname: supabaseUrl.hostname,
            port: supabaseUrl.port,
            pathname: "/storage/v1/object/public/salon-media/**",
          },
        ]
      : [],
    // Only for the local test stack (Supabase on 127.0.0.1); never in production.
    dangerouslyAllowLocalIP: localSupabase,
  },
  experimental: {
    // Photos are resized in the browser first; this leaves room for a large original.
    serverActions: { bodySizeLimit: "4mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
