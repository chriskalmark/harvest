import { closePool } from "@/lib/db";
import {
  formatIsoWeek,
  isoWeekOf,
  nextIsoWeek,
} from "@/lib/skagenfood/isoWeek";
import { SkagenfoodImportError } from "@/lib/skagenfood/normalize";
import { importSkagenfoodWeek } from "@/lib/services/skagenfoodCatalogService";
import type { IsoWeek } from "@/lib/skagenfood/types";

/**
 * Henter en uges opskrifter fra Skagenfood ind i kataloget.
 *
 *   npm run catalog:skagenfood                      -> næste uge (standard)
 *   npm run catalog:skagenfood -- --uge=denne       -> indeværende uge
 *   npm run catalog:skagenfood -- --uge=34          -> uge 34 i år
 *   npm run catalog:skagenfood -- --uge=34 --aar=2026
 *   npm run catalog:skagenfood -- --proev           -> hent og validér, skriv intet
 *   npm run catalog:skagenfood -- --spring-ufuldstændige-over
 *       -> udelad de retter Skagenfood ikke selv har skrevet færdig
 *          (fx færdigretter "hvis tilkøbt") i stedet for at stoppe kørslen.
 *          De bliver aldrig gemt halve — de bliver ikke gemt.
 *
 * Standarden er næste uge, fordi det er den kørsel der gentages: hver søndag
 * hentes den kommende uges opskrifter, mens Skagenfood stadig har dem liggende.
 */

interface Options {
  target: IsoWeek;
  dryRun: boolean;
  allowIncomplete: boolean;
  concurrency: number;
  label: string;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function readFlag(args: string[], ...names: string[]): string | null {
  for (const name of names) {
    const exact = args.find((arg) => arg.startsWith(`--${name}=`));
    if (exact) return exact.slice(name.length + 3);
    const index = args.indexOf(`--${name}`);
    if (index >= 0 && args[index + 1] && !args[index + 1].startsWith("--")) {
      return args[index + 1];
    }
  }
  return null;
}

function hasFlag(args: string[], ...names: string[]): boolean {
  return names.some((name) => args.includes(`--${name}`));
}

function parseOptions(args: string[], now: Date): Options {
  const dryRun = hasFlag(args, "proev", "prøv", "dry-run");
  const allowIncomplete = hasFlag(
    args,
    "spring-ufuldstaendige-over",
    "spring-ufuldstændige-over",
  );
  const concurrencyRaw = readFlag(args, "samtidige", "concurrency");
  const concurrency = concurrencyRaw ? Number(concurrencyRaw) : 4;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) {
    fail("--samtidige skal være et helt tal mellem 1 og 16.");
  }

  const weekRaw = (readFlag(args, "uge", "week") ?? "naeste").toLowerCase();
  const yearRaw = readFlag(args, "aar", "år", "year");

  if (["naeste", "næste", "next"].includes(weekRaw)) {
    if (yearRaw) {
      fail(
        "--aar kan kun bruges sammen med et ugenummer, ikke med --uge=næste.",
      );
    }
    return {
      target: nextIsoWeek(now),
      dryRun,
      allowIncomplete,
      concurrency,
      label: "næste uge",
    };
  }

  if (["denne", "nu", "current"].includes(weekRaw)) {
    if (yearRaw) {
      fail(
        "--aar kan kun bruges sammen med et ugenummer, ikke med --uge=denne.",
      );
    }
    return {
      target: isoWeekOf(now),
      dryRun,
      allowIncomplete,
      concurrency,
      label: "denne uge",
    };
  }

  const week = Number(weekRaw);
  if (!Number.isInteger(week) || week < 1 || week > 53) {
    fail(
      `--uge skal være "næste", "denne" eller et ugenummer mellem 1 og 53. Fik "${weekRaw}".`,
    );
  }

  const year = yearRaw ? Number(yearRaw) : isoWeekOf(now).year;
  if (!Number.isInteger(year) || year < 2020 || year > 2100) {
    fail(`--aar skal være et årstal mellem 2020 og 2100. Fik "${yearRaw}".`);
  }

  return {
    target: { year, week },
    dryRun,
    allowIncomplete,
    concurrency,
    label: "valgt uge",
  };
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2), new Date());

  console.log(
    `Skagenfood-henter — ${options.label}: ${formatIsoWeek(options.target)}` +
      (options.dryRun ? " (prøvekørsel)" : ""),
  );

  const report = await importSkagenfoodWeek({
    target: options.target,
    dryRun: options.dryRun,
    allowIncomplete: options.allowIncomplete,
    concurrency: options.concurrency,
    onProgress: (message) => console.log(message),
  });

  console.log("");
  console.log(report.displayName);
  console.log(`  Måltidskasser:        ${report.boxCount}`);
  console.log(`  Ret-pladser:          ${report.slotCount}`);
  if (report.slotsWithoutRecipe > 0) {
    console.log(`  Pladser uden ret:     ${report.slotsWithoutRecipe}`);
  }
  console.log(`  Unikke opskrifter:    ${report.recipeCount}`);
  console.log(
    `  Kilde:                ${report.fromSearch} via søgning, ${report.fromPage} via opskriftssiden`,
  );

  if (report.incomplete.length > 0) {
    console.log("");
    console.log(
      `  ${report.incomplete.length} ret(ter) er ikke skrevet færdig hos Skagenfood og blev UDELADT:`,
    );
    for (const entry of report.incomplete) {
      console.log(
        `    · ${entry.title || `id ${entry.recipeId}`} (id ${entry.recipeId})`,
      );
    }
    console.log("  De ligger ikke i kataloget — hverken hele eller halve.");
  }

  if (report.dryRun) {
    console.log("");
    console.log(
      "Prøvekørsel: alt blev hentet og validéret, intet blev skrevet.",
    );
    return;
  }

  console.log(`  Skrevne kasse-retter: ${report.storedBoxRecipes}`);
  if (report.removedBoxes > 0) {
    console.log(`  Fjernede kasser:      ${report.removedBoxes}`);
  }
  console.log(`  Opskrifter i alt:     ${report.recipesInCatalog}`);
}

main()
  .then(() => closePool())
  .catch(async (error) => {
    await closePool().catch(() => {});
    if (error instanceof SkagenfoodImportError) {
      console.error("");
      console.error("Skagenfood-henteren stoppede:");
      console.error(error.message);
    } else {
      console.error("Skagenfood-henteren fejlede:");
      console.error(error);
    }
    process.exit(1);
  });
