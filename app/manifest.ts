import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Harvest Meal Plan",
    short_name: "Harvest",
    description:
      "Plan the week's Trader Joe's meals and shop the list in-store, even with no signal.",
    start_url: "/menu",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f1e7",
    theme_color: "#42584a",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
