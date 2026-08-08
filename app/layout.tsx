import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Gabarito, Schibsted_Grotesk } from "next/font/google";
import AppRamme from "@/components/AppRamme";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import "./globals.css";

const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const gabarito = Gabarito({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Harvest — Ugens menu",
  description:
    "Planlæg ugens aftensmad og handl listen i butikken, selv uden signal.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Harvest",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  // Matches --background in app/globals.css for each scheme (was a stale
  // sage/cream value that no longer matched the rendered page).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#a9ddb2" },
    { media: "(prefers-color-scheme: dark)", color: "#141d16" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="da"
      suppressHydrationWarning
      className={`${schibsted.variable} ${gabarito.variable}`}
    >
      <head>
        <Script
          id="harvest-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const stored = localStorage.getItem('harvest-theme');
                  if (stored !== 'light') {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {
                  // ignore
                }
              })();
            `,
          }}
        />
      </head>
      <body>
        <ServiceWorkerRegister />
        <Suspense fallback={null}>
          <AppRamme>{children}</AppRamme>
        </Suspense>
      </body>
    </html>
  );
}
