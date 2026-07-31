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
          // Ingen CORS-headere med vilje.
          //
          // Appens egne skaerme kalder same-origin og har derfor ikke brug for
          // dem. Uden dem kan fremmede websites ikke laese eller aendre
          // madplanen fra din browser — og de fleste ruter kraever ingen
          // godkendelse, saa det var reelt aabent.
          //
          // GET /api/widget er beskyttet af WIDGET_TOKEN og er tiltaenkt
          // serverside-kald (Home Assistant og lignende henter fra deres egen
          // backend, hvor CORS ikke gaelder). Et browser-dashboard ville skulle
          // laegge tokenet i klient-JavaScript, hvor enhver kan laese det —
          // saa den vej boer ikke aabnes med CORS, men med en anden loesning.
          //
          // Skal en bestemt frontend paa et andet domaene have adgang, saa
          // tilfoej praecis det ene domaene her. Aldrig "*".
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
