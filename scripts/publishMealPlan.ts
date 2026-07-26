import { readFile } from "fs/promises";
import {
  extractWeekDataFromMarkdown,
  writeWeekDataJson,
} from "@/lib/mealPlanMarkdown";
import { upsertMealPlan } from "@/lib/services/mealPlanService";
import { closePool } from "@/lib/db";

async function main() {
  const startedAt = Date.now();
  const stepStartedAt = () => Date.now();
  const fmtMs = (ms: number) => `${(ms / 1000).toFixed(2)}s`;
  const logStep = (label: string) => console.log(`[publish] ${label}`);

  logStep("Reading data/current-week.md");
  let t = stepStartedAt();
  const markdown = await readFile("data/current-week.md", "utf8");
  logStep(`Read markdown (${fmtMs(Date.now() - t)})`);

  logStep("Parsing week data from markdown");
  t = stepStartedAt();
  const weekData = extractWeekDataFromMarkdown(markdown);
  logStep(`Parsed weekRange="${weekData.weekRange}" (${fmtMs(Date.now() - t)})`);

  logStep("Syncing data/current-week.json from markdown");
  t = stepStartedAt();
  await writeWeekDataJson(weekData);
  logStep(`Synced JSON (${fmtMs(Date.now() - t)})`);

  logStep("Upserting meal plan into Postgres");
  t = stepStartedAt();
  const mealPlan = await upsertMealPlan(weekData, {
    source: "current-week.md",
    generationContext: {
      publishedFrom: "data/current-week.md",
      publishedAt: new Date().toISOString(),
    },
  });
  logStep(
    `Upserted mealPlanId=${mealPlan.id} (${fmtMs(Date.now() - t)})`
  );

  logStep(`Done (${fmtMs(Date.now() - startedAt)})`);
  console.log(
    JSON.stringify(
      {
        ok: true,
        mealPlanId: mealPlan.id,
        weekRange: mealPlan.weekRange,
        source: mealPlan.source,
        mealCount: mealPlan.meals.length,
      },
      null,
      2
    )
  );
}

main()
  .catch((error: unknown) => {
    console.error("[publish] Failed to publish meal plan from markdown");
    if (error && typeof error === "object") {
      const errObj = error as Record<string, unknown>;
      const code = errObj.code;
      const message = errObj.message;
      if (
        code === "22P02" &&
        typeof message === "string" &&
        message.includes("malformed array literal")
      ) {
      console.error(
        "[publish] Hint: The meals table stores build pillars as TEXT[] (arrays). Ensure meal.build.pro/base/veg/engine are arrays of strings, not plain strings."
      );
    }
    }
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await closePool();
    } catch (error) {
      console.error("[publish] Failed to close Postgres pool cleanly");
      console.error(error);
      process.exitCode = process.exitCode ?? 1;
    }
  });
