/**
 * Laver de to hemmeligheder Harvest skal bruge for at kunne låse.
 *
 *   npx tsx scripts/lavHusstandskode.ts "din kode her"
 *
 * Selve koden bliver ALDRIG gemt nogen steder. Ud kommer et scrypt-aftryk,
 * og aftrykket kan ikke regnes tilbage til koden.
 *
 * De to linjer sættes ind i Portainer-stackens miljøvariabler.
 */

import { lavAftryk } from "../lib/auth/kodeord";
import { randomBytes } from "node:crypto";

async function main() {
  const kodeord = process.argv[2];

  if (!kodeord) {
    console.error('Brug: npx tsx scripts/lavHusstandskode.ts "din kode her"');
    process.exit(1);
  }

  if (kodeord.length < 10) {
    console.error(
      `Koden er ${kodeord.length} tegn. Brug mindst 10 -- den skal kun tastes fire gange om året.`,
    );
    process.exit(1);
  }

  const aftryk = await lavAftryk(kodeord);
  const hemmelighed = randomBytes(32).toString("hex");

  console.log("\nSæt de her to i Portainer-stackens miljø:\n");
  console.log(`HOUSEHOLD_PASSWORD_HASH=${aftryk}`);
  console.log(`SESSION_SECRET=${hemmelighed}`);
  console.log("\nSESSION_SECRET er nøglen til alle sessioner. Skifter du den,");
  console.log("bliver hver eneste telefon logget ud med det samme.\n");
}

main().catch((fejl) => {
  console.error("Kunne ikke lave aftrykket:", fejl);
  process.exit(1);
});
