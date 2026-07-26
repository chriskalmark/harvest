import { seedMealPlanFromJson } from "@/lib/services/mealPlanService";

async function main() {
  const mealPlan = await seedMealPlanFromJson();

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

main().catch((error) => {
  console.error("Failed to seed meal plan");
  console.error(error);
  process.exit(1);
});
