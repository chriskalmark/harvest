import { readFile } from "fs/promises";
import {
  extractWeekDataFromMarkdown,
  writeWeekDataJson,
} from "@/lib/mealPlanMarkdown";

async function main() {
  const startedAt = Date.now();
  const stepStartedAt = () => Date.now();
  const fmtMs = (ms: number) => `${(ms / 1000).toFixed(2)}s`;
  const logStep = (label: string) => console.log(`[sync] ${label}`);

  logStep("Reading data/current-week.md");
  let t = stepStartedAt();
  const markdown = await readFile("data/current-week.md", "utf8");
  logStep(`Read markdown (${fmtMs(Date.now() - t)})`);

  logStep("Parsing week data from markdown");
  t = stepStartedAt();
  const weekData = extractWeekDataFromMarkdown(markdown);
  logStep(`Parsed weekRange="${weekData.weekRange}" (${fmtMs(Date.now() - t)})`);

  logStep("Writing data/current-week.json");
  t = stepStartedAt();
  const outputPath = await writeWeekDataJson(weekData);
  logStep(`Wrote ${outputPath} (${fmtMs(Date.now() - t)})`);

  logStep(`Done (${fmtMs(Date.now() - startedAt)})`);
  console.log(
    JSON.stringify(
      {
        ok: true,
        syncedFrom: "data/current-week.md",
        wroteJson: outputPath,
        weekRange: weekData.weekRange,
        mealCount: weekData.meals.length,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("[sync] Failed to sync markdown plan into current-week.json");
  console.error(error);
  process.exit(1);
});
