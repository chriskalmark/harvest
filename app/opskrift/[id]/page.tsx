import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import RecipeScreen from "@/components/recipe/RecipeScreen";
import { getCatalogRecipe } from "@/lib/services/recipeCatalogService";

/**
 * Én opskrift fra Skagenfood-kataloget.
 *
 * Siden henter selv fra databasen paa serveren i stedet for at lade browseren
 * kalde et API bagefter. Ved komfuret er det forskellen paa at faa trin 1 med
 * det samme og at se en spinner med vaade haender.
 */

export const dynamic = "force-dynamic";

function parseRecipeId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const recipeId = parseRecipeId(id);
  const recipe = recipeId === null ? null : await getCatalogRecipe(recipeId);
  return { title: recipe ? `${recipe.name} — Harvest` : "Opskrift — Harvest" };
}

export default async function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const recipeId = parseRecipeId(id);
  if (recipeId === null) notFound();

  const recipe = await getCatalogRecipe(recipeId);
  if (!recipe) {
    return (
      <main className="px-4">
        <div className="rounded-[34px] bg-[var(--surface-1)] p-6">
          <h1 className="font-serif text-[1.6rem] font-extrabold leading-tight text-[var(--foreground)]">
            Den opskrift er ikke i kataloget
          </h1>
          <p className="mt-3 text-[1.05rem] leading-relaxed text-[var(--text-muted)]">
            Opskrift {recipeId} er ikke hentet ind endnu. Importér den uge, den
            hører til, så ligger den her bagefter.
          </p>
          <Link
            href="/opskrifter"
            className="mt-5 inline-flex min-h-[44px] items-center rounded-2xl bg-[var(--tint-green)] px-4 py-3 text-[0.95rem] font-semibold text-[var(--harvest-green-ink)]"
          >
            Se alle opskrifter
          </Link>
        </div>
      </main>
    );
  }

  return <RecipeScreen recipe={recipe} />;
}
