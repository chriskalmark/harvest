import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  getMealPlanByWeekRange,
  listMealPlanWeeks,
} from "@/lib/services/mealPlanService";
import { buildWidgetItems } from "@/lib/domain/mealPlanWidget";
import { getWeekStartDateOnly, toSortValueFromDateOnly } from "@/lib/weekRange";

/**
 * Bearer-token-tjek i konstant tid. Begge sider hashes foerst, saa
 * timingSafeEqual altid faar buffere af samme laengde — ellers ville
 * tokenets laengde kunne laeses ud af et kast.
 */
function isAuthorized(request: NextRequest, expectedToken: string): boolean {
  const header = request.headers.get("authorization");
  if (!header) return false;

  const match = /^Bearer\s+(\S.*)$/i.exec(header.trim());
  if (!match) return false;

  const provided = createHash("sha256").update(match[1].trim()).digest();
  const expected = createHash("sha256").update(expectedToken).digest();
  return timingSafeEqual(provided, expected);
}

export async function GET(request: NextRequest) {
  const token = process.env.WIDGET_TOKEN;
  if (!token) {
    // Uden en noegle maa ruten aldrig svare med data.
    return NextResponse.json(
      { error: "WIDGET_TOKEN is not configured" },
      { status: 503 },
    );
  }

  if (!isAuthorized(request, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Kun indevaerende uge. Findes den ikke, svarer buildWidgetItems med en
    // venlig linje i stedet for at fejle.
    const weekStart = getWeekStartDateOnly();
    const weeks = await listMealPlanWeeks();
    const week = weeks.find(
      (option) => option.sortValue === toSortValueFromDateOnly(weekStart),
    );
    const mealPlan = week ? await getMealPlanByWeekRange(week.weekRange) : null;

    const response = NextResponse.json({
      title: "Harvest · madplan",
      updated: new Date().toISOString(),
      layout: "list",
      data: { items: buildWidgetItems(mealPlan?.meals ?? []) },
    });
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  } catch (error) {
    console.error("API GET /api/widget failed", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
