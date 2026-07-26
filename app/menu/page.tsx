"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Loader2, Plus, Home } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import JunkMenuPanel from "@/components/JunkMenuPanel";
import HouseholdGoodsPanel from "@/components/HouseholdGoodsPanel";
import MenuMealCard from "@/components/MenuMealCard";
import MealPlanGate from "@/components/MealPlanGate";
import MealSwapPickerModal from "@/components/MealSwapPickerModal";
import { MEAL_TYPES } from "@/lib/constants";
import { useMealPlanMutations } from "@/lib/hooks/useMealPlanMutations";
import { useMealPlan } from "@/lib/MealPlanProvider";
import { ListCategory, MealType, StoredMeal, HouseholdGoodsItem } from "@/lib/types";
import { sectionLabelColorClass } from "@/lib/uiClasses";
import { buildHref } from "@/lib/urlState";

const MENU_GROUPS: { type: MealType; label: string }[] = [
  { type: "Breakfast", label: "Breakfasts" },
  { type: "Lunch", label: "Lunches" },
  { type: "Dinner", label: "Dinners" },
];

type MenuTab = MealType | "Junk" | "Household";
type MenuGroup = { type: MealType; label: string; meals: StoredMeal[] };
type MenuTabOption = { type: MenuTab; label: string; iconOnly?: boolean };

type PickerTarget = {
  mode: "swap" | "add";
  type: MealType;
  slotOrder?: number;
  mealId?: number;
};

function parseMenuTab(raw: string | null): MenuTab | null {
  if (raw === "Junk" || raw === "Household") return raw;
  return MEAL_TYPES.includes(raw as MealType) ? (raw as MealType) : null;
}

function MenuContent({
  groups,
  junkList,
  householdGoods,
  weekRange,
  mealPlanId,
  queryString,
  onOpenMeal,
  onUpdate,
  onSwapMeal,
  onRemoveMeal,
  onAddMeal,
  isSaving,
  mutationError,
}: {
  groups: MenuGroup[];
  junkList: ListCategory[];
  householdGoods: HouseholdGoodsItem[];
  weekRange?: string;
  mealPlanId?: number;
  queryString: string;
  onOpenMeal: (meal: StoredMeal) => void;
  onUpdate: () => void | Promise<void>;
  onSwapMeal: (meal: StoredMeal) => void;
  onRemoveMeal: (meal: StoredMeal) => void;
  onAddMeal: (type: MealType) => void;
  isSaving: boolean;
  mutationError: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabFromUrl = parseMenuTab(searchParams.get("type"));
  const tabs: MenuTabOption[] = useMemo(
    () => [
      ...MENU_GROUPS.map((group) => ({ type: group.type, label: group.type })),
      { type: "Junk", label: "Junk" },
      { type: "Household", label: "Household", iconOnly: true },
    ],
    []
  );

  const activeTab =
    tabFromUrl && tabs.some((tab) => tab.type === tabFromUrl)
      ? tabFromUrl
      : tabs[0]?.type;

  const activeGroup = groups.find((g) => g.type === activeTab);

  const touchStart = useRef<{ x: number; y: number } | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;

    if (Math.abs(dy) > Math.abs(dx)) return;
    if (Math.abs(dx) < 50) return;

    const currentIndex = tabs.findIndex((tab) => tab.type === activeTab);
    const nextIndex =
      dx < 0
        ? Math.min(currentIndex + 1, tabs.length - 1)
        : Math.max(currentIndex - 1, 0);

    if (nextIndex !== currentIndex) {
      router.push(
        buildHref("/menu", queryString, { type: tabs[nextIndex].type }),
        { scroll: false }
      );
    }
  }

  if (tabs.length === 0 || !activeTab) {
    return null;
  }

  return (
    <>
      {mutationError ? (
        <div className="mb-4 rounded-2xl border border-harvest-terracotta/25 bg-harvest-terracotta/10 px-4 py-3 text-sm font-medium text-harvest-terracotta">
          {mutationError}
        </div>
      ) : null}

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <Link
            key={tab.type}
            href={buildHref("/menu", queryString, { type: tab.type })}
            scroll={false}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] transition-all ${
              activeTab === tab.type
                ? tab.type === "Junk"
                  ? "bg-harvest-purple text-white shadow dark:bg-[var(--surface-3)] dark:text-harvest-purple dark:shadow-none"
                  : tab.type === "Household"
                    ? "bg-[var(--text-muted)] text-white shadow dark:bg-[var(--surface-3)] dark:text-[var(--foreground)] dark:shadow-none"
                    : "bg-harvest-green text-white shadow dark:bg-[var(--surface-3)] dark:text-harvest-green dark:shadow-none"
                : "bg-[var(--card-border)] text-[var(--muted-text)]"
            }`}
            aria-label={tab.iconOnly ? "Household goods" : undefined}
          >
            {tab.iconOnly ? <Home size={14} strokeWidth={2.5} /> : tab.label}
          </Link>
        ))}
      </div>

      <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {activeTab === "Junk" ? (
          <JunkMenuPanel
            data={junkList}
            weekRange={weekRange}
            mealPlanId={mealPlanId}
            onUpdate={onUpdate}
          />
        ) : activeTab === "Household" ? (
          <HouseholdGoodsPanel
            data={householdGoods}
            weekRange={weekRange}
            onUpdate={onUpdate}
          />
        ) : (
          <section>
            {mealPlanId
              ? activeGroup?.meals.map((meal) => (
                  <MenuMealCard
                    key={`${meal.mealId}-${meal.slotOrder}`}
                    meal={meal}
                    mealPlanId={mealPlanId}
                    isActionSaving={isSaving}
                    onOpenMeal={() => onOpenMeal(meal)}
                    onSwap={() => onSwapMeal(meal)}
                    onRemove={() => onRemoveMeal(meal)}
                    onChanged={async () => {
                      await onUpdate();
                    }}
                  />
                ))
              : null}

            <button
              type="button"
              disabled={isSaving}
              onClick={() => onAddMeal(activeTab as MealType)}
              className="mb-2.5 flex w-full items-center justify-center gap-2 rounded-[18px] border border-dashed border-[var(--card-border)] bg-[var(--surface-1)] px-4 py-4 text-sm font-semibold text-harvest-green transition active:scale-[0.99] disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Plus size={16} />
              )}
              Add {activeTab}
            </button>
          </section>
        )}
      </div>
    </>
  );
}

export default function MenuPage() {
  const { plan, isLoading, error, refresh } = useMealPlan();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = useMemo(() => searchParams.toString(), [searchParams]);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);

  const {
    swapMeal,
    removeMeal,
    addMeal,
    isSaving,
    mutationError,
    resetMutationState,
  } = useMealPlanMutations({
    weekRange: plan?.weekRange,
    onUpdate: refresh,
  });

  function openMeal(meal: StoredMeal) {
    router.push(buildHref(`/meal/${meal.mealId}`, queryString));
  }

  function openSwapPicker(meal: StoredMeal) {
    resetMutationState();
    setPickerTarget({
      mode: "swap",
      type: meal.type,
      slotOrder: meal.slotOrder,
      mealId: meal.mealId,
    });
  }

  function openAddPicker(type: MealType) {
    resetMutationState();
    setPickerTarget({ mode: "add", type });
  }

  async function handleRemoveMeal(meal: StoredMeal) {
    const confirmed = window.confirm(`Remove "${meal.name}" from this week's menu?`);
    if (!confirmed) return;
    resetMutationState();
    await removeMeal(meal.slotOrder);
  }

  async function handlePickerConfirm(mealId: number): Promise<boolean> {
    if (!pickerTarget) return false;

    if (pickerTarget.mode === "swap" && pickerTarget.slotOrder !== undefined) {
      const success = await swapMeal(pickerTarget.slotOrder, mealId);
      if (success) setPickerTarget(null);
      return success;
    }

    if (pickerTarget.mode === "add") {
      const success = await addMeal(pickerTarget.type, mealId);
      if (success) setPickerTarget(null);
      return success;
    }

    return false;
  }

  return (
    <MealPlanGate
      plan={plan}
      isLoading={isLoading}
      error={error}
      loadingMessage="Plating this week's menu..."
      onSeeded={refresh}
    >
      {(readyPlan) => {
        const groups = MENU_GROUPS.map((group) => ({
          ...group,
          meals: readyPlan.meals
            .filter((meal) => meal.type === group.type)
            .sort((a, b) => a.slotOrder - b.slotOrder),
        }));

        const weekMealIds = readyPlan.meals.map((meal) => meal.mealId);

        return (
          <main className="px-4 pb-8">
            <p className={`mb-5 ${sectionLabelColorClass.green}`}>The Menu</p>

            <MenuContent
              groups={groups}
              junkList={readyPlan.junkList}
              householdGoods={readyPlan.householdGoods}
              weekRange={readyPlan.weekRange}
              mealPlanId={readyPlan.id}
              queryString={queryString}
              onOpenMeal={openMeal}
              onUpdate={refresh}
              onSwapMeal={openSwapPicker}
              onRemoveMeal={handleRemoveMeal}
              onAddMeal={openAddPicker}
              isSaving={isSaving}
              mutationError={mutationError}
            />

            {pickerTarget ? (
              <MealSwapPickerModal
                isOpen
                mode={pickerTarget.mode}
                slotType={pickerTarget.type}
                currentMealId={pickerTarget.mealId}
                weekMealIds={weekMealIds}
                isSaving={isSaving}
                onClose={() => setPickerTarget(null)}
                onConfirm={handlePickerConfirm}
              />
            ) : null}
          </main>
        );
      }}
    </MealPlanGate>
  );
}
