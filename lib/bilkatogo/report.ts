import type { AddLineResult, ShoppingMatch } from "@/lib/bilkatogo/types";

/**
 * Læsbar opsummering af en matching, til terminalen.
 *
 * Formålet er at gøre tvivl synlig. En override er sikker og nævnes kort. Et
 * søgetræf kan være forkert, så det vises med sine alternativer og deres id'er,
 * klar til at kopiere over i override-filen. En vare uden hit skjules ikke; den
 * står for sig, fordi den kræver en beslutning.
 */

function line(match: ShoppingMatch): string {
  if (match.source === "override") {
    return `  [fast]  ${match.query} ×${match.count} -> ${match.match?.productId}`;
  }
  if (match.source === "none") {
    return `  [?]     ${match.query} ×${match.count} -> INTET HIT`;
  }
  const chosen = match.match;
  const alts = match.alternatives
    .slice(0, 4)
    .map((a) => `${a.productId} ${a.name}`)
    .join(" | ");
  const altLine = alts ? `\n           alt: ${alts}` : "";
  return (
    `  [søgt]  ${match.query} ×${match.count} -> ` +
    `${chosen?.productId} ${chosen?.name}${altLine}`
  );
}

export function formatMatchReport(matches: ShoppingMatch[]): string {
  const overrides = matches.filter((m) => m.source === "override");
  const searched = matches.filter((m) => m.source === "search");
  const missing = matches.filter((m) => m.source === "none");

  const parts: string[] = [];
  parts.push(
    `Match: ${matches.length} varer -> ` +
      `${overrides.length} faste, ${searched.length} søgt, ${missing.length} uden hit.`,
  );
  parts.push("");
  for (const m of matches) parts.push(line(m));

  if (missing.length > 0) {
    parts.push("");
    parts.push(
      `${missing.length} vare(r) fik intet hit og bliver ikke lagt i kurven. ` +
        "Ret søgeordet, eller læg et id i override-filen.",
    );
  }
  if (searched.length > 0) {
    parts.push("");
    parts.push(
      "Ramte en søgning forkert? Kopier det rigtige id fra alt-linjen over i " +
        "override-filen, så er varen fast næste gang.",
    );
  }
  return parts.join("\n");
}

export function formatPushReport(results: AddLineResult[]): string {
  const ok = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  const withMessage = ok.filter((r) => r.message);

  const parts: string[] = [];
  parts.push(
    `Kurv: ${ok.length}/${results.length} lagt i, ${failed.length} fejlede.`,
  );
  for (const r of withMessage) {
    parts.push(`  besked: ${r.line.productId} ×${r.line.count} -> ${r.message}`);
  }
  for (const r of failed) {
    parts.push(`  FEJL:  ${r.line.productId} ×${r.line.count} -> ${r.error}`);
  }
  return parts.join("\n");
}
