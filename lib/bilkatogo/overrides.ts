import fs from "node:fs";
import path from "node:path";
import type { OverrideMap } from "@/lib/bilkatogo/matching";

/**
 * Faste varer: varenavn -> Bilka produkt-id.
 *
 * Laa foerst inde i pushToBilka.ts. Da API-ruten skulle bruge den samme
 * mapping, blev den flyttet herud i stedet for at blive skrevet to steder
 * -- to kopier ville foer eller siden vaere blevet uenige om, hvad
 * "letmaelk" betyder.
 *
 * Noegler der starter med _ (fx _comment i eksempelfilen) og tomme
 * vaerdier springes over.
 */

export const STANDARD_STI = "data/bilkatogo-overrides.json";

export function loadOverrides(fil?: string | null): OverrideMap {
  const target = fil ?? path.join(process.cwd(), STANDARD_STI);
  const abs = path.isAbsolute(target)
    ? target
    : path.join(process.cwd(), target);

  if (!fs.existsSync(abs)) {
    if (fil) throw new Error(`Override-fil ikke fundet: ${abs}`);
    return {};
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(fs.readFileSync(abs, "utf8")) as Record<string, unknown>;
  } catch {
    // En oedelagt fil maa ikke vaelte hele indkoebslisten. Uden faste
    // varer slaas alt bare op, som foer filen fandtes.
    return {};
  }

  const map: OverrideMap = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith("_")) continue;
    if (typeof value === "string" && value.trim().length > 0) {
      map[key.trim().toLowerCase()] = value.trim();
    }
  }
  return map;
}
