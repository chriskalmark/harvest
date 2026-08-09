/**
 * Passer aftrykket til koden?
 *
 *   npm run tjek-kode
 *
 * Indsæt aftrykket fra Portainer, tast koden, få ja eller nej. Ingen af
 * delene forlader maskinen, og koden kommer aldrig forbi skallen.
 *
 * Findes fordi "Forkert kode" ikke siger HVAD der er galt. Med den her ved
 * man på 30 sekunder om fejlen er aftrykket eller noget helt andet.
 */

import { passerKodeord } from "../lib/auth/kodeord";
import { spørgOmKode } from "../lib/auth/spoerg";
import { createInterface } from "node:readline";

function spørgSynligt(spørgsmål: string): Promise<string> {
  const linje = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((løs) =>
    linje.question(spørgsmål, (svar) => {
      linje.close();
      løs(svar.trim());
    }),
  );
}

async function main() {
  console.log(
    "\nIndsæt aftrykket fra Portainer (HOUSEHOLD_PASSWORD_HASH) og tast din kode.\n",
  );

  const aftryk = await spørgSynligt("Aftryk: ");

  if (!aftryk) {
    console.error("\nDer kom intet aftryk.\n");
    process.exit(1);
  }

  const dele = aftryk.split(".");
  console.log(`\n  længde:      ${aftryk.length} tegn`);
  console.log(`  dele:        ${dele.length} (skal være 4)`);
  console.log(`  starter med: ${dele[0]} (skal være scrypt)`);
  if (aftryk.includes("$")) {
    console.log("  ADVARSEL:    indeholder $ — det er det gamle format");
  }
  if (aftryk !== aftryk.trim()) {
    console.log("  ADVARSEL:    der er mellemrum i enderne");
  }

  const kode = await spørgOmKode("\nKode (den vises ikke): ");

  if (!kode) {
    console.error("\nDer kom ingen kode.\n");
    process.exit(1);
  }

  const passer = await passerKodeord(kode, aftryk);

  if (passer) {
    console.log("\n  JA — den kode passer til det aftryk.");
    console.log(
      "  Kommer du stadig ikke ind, er det ikke aftrykket der er galt.\n",
    );
    return;
  }

  console.log("\n  NEJ — den kode passer ikke til det aftryk.");
  console.log(`  Du tastede ${kode.length} tegn.`);
  console.log("  Lav et nyt aftryk med:  npm run lav-kode\n");
  process.exitCode = 1;
}

main().catch((fejl) => {
  console.error("\nKunne ikke tjekke:", fejl.message ?? fejl, "\n");
  process.exit(1);
});
