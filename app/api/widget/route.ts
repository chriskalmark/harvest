import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  getMealPlanByWeekRange,
  listMealPlanWeeks,
} from "@/lib/services/mealPlanService";
import {
  buildWidgetItems,
  WIDGET_WINDOW_DAYS,
  WidgetWeekDinners,
} from "@/lib/domain/mealPlanWidget";
import { WeekOption } from "@/lib/types";
import {
  addDays,
  fromDateOnlyString,
  getWeekStartDateOnly,
  toDateOnlyString,
  toSortValueFromDateOnly,
} from "@/lib/weekRange";

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

/** Henter aftensretterne for den ugeplan der starter paa den givne mandag. */
async function readWeekDinners(
  weeks: WeekOption[],
  weekStartDateOnly: string,
): Promise<WidgetWeekDinners | null> {
  const week = weeks.find(
    (option) => option.sortValue === toSortValueFromDateOnly(weekStartDateOnly),
  );
  if (!week) return null;

  const mealPlan = await getMealPlanByWeekRange(week.weekRange);
  if (!mealPlan) return null;

  return {
    weekStartDateOnly,
    dinnerNames: mealPlan.meals
      .filter((meal) => meal.type === "Dinner")
      .sort((a, b) => a.slotOrder - b.slotOrder)
      .map((meal) => meal.name),
  };
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
    const today = fromDateOnlyString(toDateOnlyString(new Date()));
    const lastDay = addDays(today, WIDGET_WINDOW_DAYS - 1);

    // Vinduet paa syv dage kan spaende over to ugeplaner.
    const weekStarts = Array.from(
      new Set([getWeekStartDateOnly(today), getWeekStartDateOnly(lastDay)]),
    );
    const weeks = await listMealPlanWeeks();
    const dinnersPerWeek = await Promise.all(
      weekStarts.map((weekStart) => readWeekDinners(weeks, weekStart)),
    );

    const response = NextResponse.json({
      title: "Harvest · madplan",
      updated: new Date().toISOString(),
      layout: "list",
      data: {
        items: buildWidgetItems(
          dinnersPerWeek.filter((week) => week !== null),
          today,
        ),
      },
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
