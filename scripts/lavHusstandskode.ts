/**
 * Laver de to hemmeligheder Harvest skal bruge for at kunne låse.
 *
 *   npm run lav-kode
 *
 * Koden TASTES ind — den gives ikke som argument. Det er ikke pynt:
 * gav man den som argument, blev den ændret undervejs hver gang den
 * indeholdt et tegn skallen selv bruger ($ blev til en variabel, ! til
 * historik i zsh). Så stod der ét i aftrykket og noget andet i browseren,
 * og "Forkert kode" var det eneste spor.
 *
 * Selve koden bliver aldrig gemt. Ud kommer et scrypt-aftryk, og et aftryk
 * kan ikke regnes tilbage til koden.
 */

import { randomBytes } from "node:crypto";
import { lavAftryk } from "../lib/auth/kodeord";
import { spørgOmKode } from "../lib/auth/spoerg";

async function main() {
  if (process.argv[2]) {
    console.error(
      "\nGiv ikke koden som argument -- skallen kan ændre den undervejs,",
    );
    console.error("og den ender i din historik. Kør bare:  npm run lav-kode\n");
    process.exit(1);
  }

  const kode = await spørgOmKode("Vælg husstandens kode (den vises ikke): ");

  if (kode.length < 10) {
    console.error(
      `\nKoden er ${kode.length} tegn. Brug mindst 10 -- den skal kun tastes fire gange om året.\n`,
    );
    process.exit(1);
  }

  const igen = await spørgOmKode("Tast den én gang til: ");

  if (kode !== igen) {
    console.error("\nDe to var ikke ens. Prøv igen.\n");
    process.exit(1);
  }

  const aftryk = await lavAftryk(kode);
  const hemmelighed = randomBytes(32).toString("hex");

  console.log(`\nKoden er ${kode.length} tegn. Sæt de her to i Portainer:\n`);
  console.log(`HOUSEHOLD_PASSWORD_HASH=${aftryk}`);
  console.log(`SESSION_SECRET=${hemmelighed}`);
  console.log("\nIndsæt kun det der står EFTER lighedstegnet i value-feltet.");
  console.log("Aftrykket har tre punktummer. Nøglen har ingen.");
  console.log("\nSESSION_SECRET er nøglen til alle sessioner. Skifter du den,");
  console.log("bliver hver eneste telefon logget ud med det samme.\n");
}

main().catch((fejl) => {
  console.error("\nKunne ikke lave aftrykket:", fejl.message ?? fejl, "\n");
  process.exit(1);
});
