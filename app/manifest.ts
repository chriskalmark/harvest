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
    // Matches the current green design system (see app/globals.css):
    // --background and --harvest-green-deep, not the old sage/cream palette.
    background_color: "#a9ddb2",
    theme_color: "#0e7235",
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
