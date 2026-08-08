import type { Metadata } from "next";
import { Suspense } from "react";
import LoginSkaerm from "@/components/LoginSkaerm";

export const metadata: Metadata = {
  title: "Log ind — Harvest",
  // Siden må ikke ende i en søgemaskine. Den røber ikke noget, men et
  // login-resultat for husstandens adresse er ikke til nogen nytte.
  robots: { index: false, follow: false },
};

/** Suspense fordi skærmen læser ?videre= af adressen. */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginSkaerm />
    </Suspense>
  );
}
