import { readFile } from "fs/promises";
import { writeWeekMarkdown } from "@/lib/mealPlanMarkdown";
import { WeekData } from "@/lib/types";

async function main() {
  const raw = await readFile("data/current-week.json", "utf8");
  const weekData = JSON.parse(raw) as WeekData;
  const outputPath = await writeWeekMarkdown(weekData);

  console.log(
    JSON.stringify(
      {
        ok: true,
        sourceJson: "data/current-week.json",
        wroteMarkdown: outputPath,
        weekRange: weekData.weekRange,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("Failed to bootstrap current-week.md from current-week.json");
  console.error(error);
  process.exit(1);
});
