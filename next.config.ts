import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Add local tunnel host patterns here if you expose `next dev` behind a reverse proxy.
  images: {
    // Meal photos are 800x800 WebP hosted externally (not in /public). The
    // exact host isn't pinned in an env var anywhere in this repo, so this
    // is intentionally broad — narrow to the real host(s) once known.
    // The Next.js image optimizer needs `sharp` at runtime; it's already
    // present as an optional dependency of Next itself, and `npm ci` in the
    // Alpine build stage (Dockerfile) resolves the correct linux-musl
    // binary, so the standalone output can run the optimizer as-is.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
    formats: ["image/webp"],
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          // Open CORS is convenient for local demos. Lock this down before public deploy.
          { key: "Access-Control-Allow-Origin", value: "*" },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET,OPTIONS,PATCH,DELETE,POST,PUT",
          },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
          },
          {
            key: "Cache-Control",
            value: "no-store, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
  skipTrailingSlashRedirect: true,
  skipProxyUrlNormalize: true,
};

export default nextConfig;
