import { copyFile, readFile } from "fs/promises";
import path from "path";
import { extractWeekDataFromMarkdown, writeWeekDataJson } from "@/lib/mealPlanMarkdown";
import { upsertMealPlan } from "@/lib/services/mealPlanService";
import { closePool } from "@/lib/db";

function fmtMs(ms: number) {
  return `${(ms / 1000).toFixed(2)}s`;
}

function log(line: string) {
  console.log(`[workflow] ${line}`);
}

async function main() {
  const startedAt = Date.now();
  const backupArg = process.argv[2];

  if (!backupArg) {
    throw new Error(
      'Missing backup file argument. Example: "npm run meal-plan:workflow -- data/mealplans/backup-week-2026-04-27.md"'
    );
  }

  const backupPath = path.normalize(backupArg);
  const currentWeekPath = path.normalize("data/current-week.md");

  log(`Copying "${backupPath}" -> "${currentWeekPath}"`);
  let t = Date.now();
  await copyFile(backupPath, currentWeekPath);
  log(`Copied (${fmtMs(Date.now() - t)})`);

  log("Reading data/current-week.md");
  t = Date.now();
  const markdown = await readFile(currentWeekPath, "utf8");
  log(`Read markdown (${fmtMs(Date.now() - t)})`);

  log("Parsing week data from markdown");
  t = Date.now();
  const weekData = extractWeekDataFromMarkdown(markdown);
  log(`Parsed weekRange="${weekData.weekRange}" (${fmtMs(Date.now() - t)})`);

  log("Writing data/current-week.json");
  t = Date.now();
  const wroteJson = await writeWeekDataJson(weekData);
  log(`Wrote ${wroteJson} (${fmtMs(Date.now() - t)})`);

  log("Upserting meal plan into Postgres");
  t = Date.now();
  const mealPlan = await upsertMealPlan(weekData, {
    source: backupPath,
    generationContext: {
      workflow: "publishFromBackup",
      copiedFrom: backupPath,
      publishedFrom: currentWeekPath,
      publishedAt: new Date().toISOString(),
    },
  });
  log(`Upserted mealPlanId=${mealPlan.id} (${fmtMs(Date.now() - t)})`);

  log(`Done (${fmtMs(Date.now() - startedAt)})`);
  console.log(
    JSON.stringify(
      {
        ok: true,
        backupPath,
        currentWeekPath,
        wroteJson,
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
  .catch((error) => {
    console.error("[workflow] Failed");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await closePool();
    } catch (error) {
      console.error("[workflow] Failed to close Postgres pool cleanly");
      console.error(error);
      process.exitCode = process.exitCode ?? 1;
    }
  });

