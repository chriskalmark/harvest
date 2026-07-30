import assert from "node:assert/strict";
import {
  buildWidgetItems,
  NO_MEAL_PLAN_ITEM,
  type WidgetMeal,
} from "@/lib/domain/mealPlanWidget";

function meal(
  type: WidgetMeal["type"],
  name: string,
  slotOrder: number,
): WidgetMeal {
  return { type, name, slotOrder };
}

{
  // Ugens fire aftensretter kommer ud i slot-raekkefoelge, uden datoer.
  const items = buildWidgetItems([
    meal("Dinner", "Ovnbagt torsk", 2),
    meal("Dinner", "Lasagne", 4),
    meal("Dinner", "Kikaertegryde", 3),
    meal("Dinner", "Kylling i fad", 5),
  ]);
  assert.deepEqual(items, [
    "Ovnbagt torsk",
    "Kikaertegryde",
    "Lasagne",
    "Kylling i fad",
  ]);
}

{
  // Morgenmad og frokost hoerer ikke med — kun aftensmaden skifter i ugen.
  const items = buildWidgetItems([
    meal("Breakfast", "Skyr med havregryn", 0),
    meal("Lunch", "Rugbroedsmad", 1),
    meal("Dinner", "Tacos", 2),
    meal("Snack", "Naetter", 6),
  ]);
  assert.deepEqual(items, ["Tacos"]);
}

{
  // Ingen retter i ugen giver en venlig linje, ikke et tomt kort.
  assert.deepEqual(buildWidgetItems([]), [NO_MEAL_PLAN_ITEM]);
}

{
  // En uge helt uden aftensmad er ogsaa en tom tilstand.
  const items = buildWidgetItems([meal("Breakfast", "Skyr", 0)]);
  assert.deepEqual(items, [NO_MEAL_PLAN_ITEM]);
}

{
  // Ingen af punkterne maa have et dato- eller ugedagspraefiks.
  const items = buildWidgetItems([meal("Dinner", "Tacos", 0)]);
  for (const item of items) {
    assert.ok(
      !/^(I dag|I morgen|Mandag|Tirsdag|Onsdag|Torsdag|Fredag|Loerdag|Søndag|Lørdag|Soendag)\b/.test(
        item,
      ),
      `punktet maa ikke starte med en dag: ${item}`,
    );
    assert.ok(!item.includes(" · "), `punktet maa ikke have praefiks: ${item}`);
  }
}

console.log("meal plan widget: OK");
