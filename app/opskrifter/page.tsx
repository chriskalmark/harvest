import type { Metadata } from "next";
import RecipeIndex from "@/components/recipe/RecipeIndex";
import { listCatalogRecipeCards } from "@/lib/services/recipeCatalogService";

/**
 * Hele Skagenfood-kataloget som liste. Indgangen til opskriftsvisningen.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Opskrifter — Harvest",
};

export default async function RecipesPage() {
  const recipes = await listCatalogRecipeCards();

  if (recipes.length === 0) {
    return (
      <main className="px-4">
        <div className="rounded-[34px] bg-[var(--surface-1)] p-6">
          <h1 className="font-serif text-[1.6rem] font-extrabold leading-tight text-[var(--foreground)]">
            Kataloget er tomt
          </h1>
          <p className="mt-3 text-[1.05rem] leading-relaxed text-[var(--text-muted)]">
            Der er ingen opskrifter hentet ind endnu. Kør importen af en uge, så
            står retterne her.
          </p>
        </div>
      </main>
    );
  }

  return <RecipeIndex recipes={recipes} />;
}
