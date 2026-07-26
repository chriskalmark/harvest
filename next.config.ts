import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Add local tunnel host patterns here if you expose `next dev` behind a reverse proxy.
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          // Open CORS is convenient for local demos. Lock this down before public deploy.
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version" },
          { key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" },
        ]
      }
    ]
  },
  skipTrailingSlashRedirect: true,
  skipProxyUrlNormalize: true,
};

export default nextConfig;
