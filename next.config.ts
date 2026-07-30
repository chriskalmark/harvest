import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Add local tunnel host patterns here if you expose `next dev` behind a reverse proxy.
  images: {
    // Madfotos ligger lokalt. De serveres fra /app/public/meals, som er et
    // named volume, og image_url er en relativ sti ("/meals/<slug>.webp").
    // Lokale stier kraever ingen remotePatterns — og en aaben remotePattern
    // ville lade hvem som helst bruge optimizeren som proxy for vilkaarlige
    // eksterne billeder. Tilfoej kun remotePatterns hvis billeder en dag
    // faktisk hentes fra et andet host, og navngiv da det host praecist.
    formats: ["image/webp"],
    // Next 16 afviser enhver quality-vaerdi, der ikke staar her, med 400 —
    // ikke med en advarsel. PhotoPlaceholder beder om 80, saa 80 skal staa
    // her, ellers indlaeses ingen madfotos overhovedet.
    qualities: [80],
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
