/**
 * Udskriver retbiblioteket, som en madplan-forfatter har brug for det.
 *
 * Databasen husker allerede hjerter, hvor mange gange en ret har vaeret paa
 * menuen, og hvornaar den sidst blev serveret — men intet i arbejdsgangen
 * laeste de tal, saa variation paa tvaers af uger afhang af hukommelse.
 * Koer denne foer du skriver en ny uge.
 */

import { listMeals } from "@/lib/services/mealService";
import { closePool } from "@/lib/db";
import { MEAL_TYPES } from "@/lib/constants";
import type { MealType } from "@/lib/types";

const DAG = 24 * 60 * 60 * 1000;

function dageSiden(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAG);
}

function anbefaling(dage: number | null, hjerter: number): string {
  if (dage === null) return "aldrig serveret — oplagt at prøve";
  if (dage < 14) return `serveret for ${dage} dage siden — undgå denne uge`;
  if (hjerter > 0)
    return `hjerte, sidst for ${dage} dage siden — god at gentage`;
  return `sidst for ${dage} dage siden — fri`;
}

async function main() {
  for (const type of MEAL_TYPES as readonly MealType[]) {
    const { meals } = await listMeals({ type }, "lastServedAt", "asc", 100, 0);

    if (meals.length === 0) continue;

    console.log(`\n=== ${type} (${meals.length}) ===`);
    for (const meal of meals) {
      const dage = dageSiden(meal.lastServedAt);
      console.log(
        [
          meal.name.padEnd(46).slice(0, 46),
          `${meal.macros.cal} kcal`.padStart(9),
          `${meal.macros.p} g pro`.padStart(9),
          `${meal.heartCount} ♥`.padStart(4),
          `${meal.appearanceCount}x`.padStart(4),
          anbefaling(dage, meal.heartCount),
        ].join("  "),
      );
    }
  }

  console.log(
    "\nRegel: undgå retter serveret inden for 14 dage. Prioritér hjerter.",
  );
  console.log("Retter uden servering er de bedste kandidater til variation.\n");
}

main()
  .catch((error) => {
    console.error("Kunne ikke læse biblioteket:", error);
    process.exitCode = 1;
  })
  .finally(closePool);
