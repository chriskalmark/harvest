import { Suspense } from "react";
import IndkoebSkaerm from "@/components/indkoeb/IndkoebSkaerm";

/**
 * Indkøb.
 *
 * Skærmen viser hvad ugeplanen kræver, ikke en liste man selv fører. Indtil
 * nu læste den den GAMLE madplan (meal_plans), som ugeplanlæggeren aldrig
 * skriver til -- så man kunne planlægge en hel uge og stå med en tom eller
 * forældet indkøbsliste. Nu regnes listen ud af ugens egne retter.
 *
 * Suspense fordi skærmen læser ?uge= af adressen.
 */
export default function ShopPage() {
  return (
    <Suspense fallback={null}>
      <IndkoebSkaerm />
    </Suspense>
  );
}
