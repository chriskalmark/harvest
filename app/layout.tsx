import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { MealPlanProvider } from "@/lib/MealPlanProvider";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Harvest Meal Plan",
  description:
    "Plan the week's Trader Joe's meals and shop the list in-store, even with no signal.",
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f1e7" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1310" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${jakarta.variable} ${fraunces.variable}`}>
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
          <MealPlanProvider>
            <div className="relative mx-auto min-h-screen max-w-md pb-[120px]">
              <Header />
              {children}
              <BottomNav />
            </div>
          </MealPlanProvider>
        </Suspense>
      </body>
    </html>
  );
}
