import { seedMealPlanFromJson } from "@/lib/services/mealPlanService";
import { createRouteHandler } from "@/lib/apiUtils";

export const POST = createRouteHandler(async () => {
  const mealPlan = await seedMealPlanFromJson();
  return { mealPlan, seeded: true };
});
