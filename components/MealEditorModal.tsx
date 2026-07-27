/**
 * Extracted Meal Editor Modal from MealCard.tsx
 * Standalone component for editing meal details
 * Supports multiple items per build field (protein, base, veg, engine)
 */
"use client";

import { FormEvent, ReactNode, useState } from "react";
import { X, Loader2, Plus, Trash2 } from "lucide-react";
import { MealIngredient, MealType, StoredMeal } from "@/lib/types";
import { DEFAULT_STORE_ZONE, MEAL_TYPES } from "@/lib/constants";
import { cardClass, inputClass, sectionLabelMutedClass } from "@/lib/uiClasses";
import { pluralize } from "@/lib/displayFormatters";

interface MealEditorModalProps {
  meal?: StoredMeal; // Optional for create mode
  defaultType?: MealType;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

type IngredientCategory = MealIngredient["category"];

type IngredientDraft = {
  name: string;
  quantity: string;
};

type EditorState = {
  name: string;
  type: MealType;
  pro: IngredientDraft[];
  base: IngredientDraft[];
  veg: IngredientDraft[];
  engine: IngredientDraft[];
  cal: string;
  p: string;
  c: string;
  f: string;
  fiber: string;
};

type ScalarEditorField = Exclude<keyof EditorState, IngredientCategory>;

const mealTypeSelectLabel: Record<MealType, string> = {
  Breakfast: "Morgenmad",
  Lunch: "Frokost",
  Dinner: "Aftensmad",
  Snack: "Mellemmåltid",
};

function createEmptyIngredientDraft(): IngredientDraft {
  return { name: "", quantity: "" };
}

function normalizeBuildItems(value: string[] | string): string[] {
  return Array.isArray(value) ? value : [value];
}

function createIngredientDrafts(
  meal: StoredMeal,
  category: IngredientCategory,
): IngredientDraft[] {
  const drafts = normalizeBuildItems(meal.build[category]).map((name) => {
    const existing = meal.ingredients?.find(
      (ingredient) =>
        ingredient.category === category && ingredient.name === name,
    );

    return {
      name,
      quantity: existing?.quantity ?? "",
    };
  });

  return drafts.length > 0 ? drafts : [createEmptyIngredientDraft()];
}

function createEditorState(
  meal?: StoredMeal,
  defaultType: MealType = "Dinner",
): EditorState {
  if (!meal) {
    // Create mode defaults
    return {
      name: "",
      type: defaultType,
      pro: [createEmptyIngredientDraft()],
      base: [createEmptyIngredientDraft()],
      veg: [createEmptyIngredientDraft()],
      engine: [createEmptyIngredientDraft()],
      cal: "0",
      p: "0",
      c: "0",
      f: "0",
      fiber: "0",
    };
  }
  return {
    name: meal.name,
    type: meal.type,
    pro: createIngredientDrafts(meal, "pro"),
    base: createIngredientDrafts(meal, "base"),
    veg: createIngredientDrafts(meal, "veg"),
    engine: createIngredientDrafts(meal, "engine"),
    cal: String(meal.macros.cal),
    p: String(meal.macros.p),
    c: String(meal.macros.c),
    f: String(meal.macros.f),
    fiber: String(meal.macros.fiber),
  };
}

function getIngredientsForPayload(
  meal: StoredMeal | undefined,
  ingredientDrafts: Record<IngredientCategory, IngredientDraft[]>,
): MealIngredient[] {
  return (
    Object.entries(ingredientDrafts) as Array<
      [IngredientCategory, IngredientDraft[]]
    >
  ).flatMap(([category, items]) =>
    items.map((item) => {
      const name = item.name.trim();
      const quantity = item.quantity.trim();
      const existing = meal?.ingredients?.find(
        (ingredient) =>
          ingredient.category === category && ingredient.name === name,
      );

      if (existing) {
        return {
          ...existing,
          name,
          quantity,
        };
      }

      return {
        name,
        quantity,
        amount: 0,
        unit: "stk",
        zone: DEFAULT_STORE_ZONE,
        category,
        macros: { cal: 0, p: 0, c: 0, f: 0, fiber: 0 },
      };
    }),
  );
}

export default function MealEditorModal({
  meal,
  defaultType = "Dinner",
  isOpen,
  onClose,
  onSaved,
}: MealEditorModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<EditorState>(() =>
    createEditorState(meal, defaultType),
  );

  const isCreateMode = !meal;

  if (!isOpen) return null;

  function updateIngredientDraft(
    field: IngredientCategory,
    index: number,
    key: keyof IngredientDraft,
    value: string,
  ) {
    setEditorState((current) => {
      const arr = [...current[field]];
      arr[index] = {
        ...arr[index],
        [key]: value,
      };
      return { ...current, [field]: arr };
    });
  }

  function addArrayItem(field: IngredientCategory) {
    setEditorState((current) => ({
      ...current,
      [field]: [...current[field], createEmptyIngredientDraft()],
    }));
  }

  function removeArrayItem(field: IngredientCategory, index: number) {
    setEditorState((current) => {
      const arr = [...current[field]];
      arr.splice(index, 1);
      // Ensure at least one item remains
      if (arr.length === 0) {
        arr.push(createEmptyIngredientDraft());
      }
      return { ...current, [field]: arr };
    });
  }

  function updateField(field: ScalarEditorField, value: string) {
    setEditorState((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetAndClose() {
    setEditorState(createEditorState(meal, defaultType));
    setMessage(null);
    setIsSaving(false);
    onClose();
  }

  async function handleSaveMeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    // Filter out rows without ingredient names before building the payload.
    const ingredientDrafts: Record<IngredientCategory, IngredientDraft[]> = {
      pro: editorState.pro
        .filter((item) => item.name.trim() !== "")
        .map((item) => ({
          name: item.name.trim(),
          quantity: item.quantity.trim(),
        })),
      base: editorState.base
        .filter((item) => item.name.trim() !== "")
        .map((item) => ({
          name: item.name.trim(),
          quantity: item.quantity.trim(),
        })),
      veg: editorState.veg
        .filter((item) => item.name.trim() !== "")
        .map((item) => ({
          name: item.name.trim(),
          quantity: item.quantity.trim(),
        })),
      engine: editorState.engine
        .filter((item) => item.name.trim() !== "")
        .map((item) => ({
          name: item.name.trim(),
          quantity: item.quantity.trim(),
        })),
    };

    const build = {
      pro: ingredientDrafts.pro.map((item) => item.name),
      base: ingredientDrafts.base.map((item) => item.name),
      veg: ingredientDrafts.veg.map((item) => item.name),
      engine: ingredientDrafts.engine.map((item) => item.name),
    };

    // Validate at least one item in each build field
    if (
      build.pro.length === 0 ||
      build.base.length === 0 ||
      build.veg.length === 0 ||
      build.engine.length === 0
    ) {
      setMessage(
        "Protein, base, grønt og energi skal hver have mindst én vare.",
      );
      return;
    }

    try {
      setIsSaving(true);

      const payload = {
        name: editorState.name.trim(),
        type: editorState.type,
        build,
        ingredients: getIngredientsForPayload(meal, ingredientDrafts),
        macros: {
          cal: Number(editorState.cal),
          p: Number(editorState.p),
          c: Number(editorState.c), // Fixed: was using editorState.cal
          f: Number(editorState.f),
          fiber: Number(editorState.fiber),
        },
      };

      let response;
      if (isCreateMode) {
        // Create new meal via POST /api/meals
        response = await fetch("/api/meals", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      } else {
        // Update existing meal via PUT /api/meals/[id]
        response = await fetch(`/api/meals/${meal.mealId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        throw new Error(
          isCreateMode
            ? "Kunne ikke oprette ny ret."
            : "Kunne ikke gemme ændringerne lige nu.",
        );
      }

      await onSaved();
      resetAndClose();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Kunne ikke gemme ændringerne lige nu.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-[var(--surface-0)]">
      <div className="mx-auto min-h-screen max-w-md px-4 pb-12 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={`text-harvest-terracotta ${sectionLabelMutedClass}`}>
              {isCreateMode ? "Ny ret" : "Ret retten til"}
            </p>
            <h2 className="mt-2 font-serif text-3xl leading-tight text-harvest-green text-[var(--foreground)]">
              {isCreateMode ? "Ny ret" : meal.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--text-muted)] shadow-[var(--shadow-card)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            aria-label="Luk"
          >
            <X size={18} />
          </button>
        </div>

        {!isCreateMode && meal && (
          <div className={`mt-5 p-4 ${cardClass}`}>
            <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
              <span className="rounded-full bg-harvest-green/10 px-3 py-1 text-harvest-green">
                {meal.appearanceCount}{" "}
                {pluralize(meal.appearanceCount, "gang", "gange")} på menuen
              </span>
              <span className="rounded-full bg-harvest-terracotta/10 px-3 py-1 text-harvest-terracotta">
                {meal.heartCount}{" "}
                {pluralize(meal.heartCount, "hjerte", "hjerter")}
              </span>
              <span className="rounded-full bg-[var(--tint-stone)] px-3 py-1 text-[var(--text-muted)]">
                {meal.lastServedAt
                  ? `Sidst serveret ${formatDate(meal.lastServedAt)}`
                  : "Første uge i rotation"}
              </span>
            </div>
          </div>
        )}

        <form onSubmit={handleSaveMeal} className="mt-5 space-y-4">
          <EditorField label="Navn på retten">
            <input
              value={editorState.name}
              onChange={(event) => updateField("name", event.target.value)}
              className={inputClassName}
              placeholder="fx. Laksebowl"
              required
            />
          </EditorField>

          <EditorField label="Type">
            <select
              value={editorState.type}
              onChange={(event) =>
                updateField("type", event.target.value as MealType)
              }
              className={inputClassName}
            >
              {MEAL_TYPES.map((mealType) => (
                <option key={mealType} value={mealType}>
                  {mealTypeSelectLabel[mealType]}
                </option>
              ))}
            </select>
          </EditorField>

          <ArrayEditorField
            label="Protein"
            items={editorState.pro}
            onChange={(index, key, value) =>
              updateIngredientDraft("pro", index, key, value)
            }
            onAdd={() => addArrayItem("pro")}
            onRemove={(index) => removeArrayItem("pro", index)}
            namePlaceholder="fx. Kylling"
            amountPlaceholder="fx. 1 pakke"
          />

          <ArrayEditorField
            label="Base"
            items={editorState.base}
            onChange={(index, key, value) =>
              updateIngredientDraft("base", index, key, value)
            }
            onAdd={() => addArrayItem("base")}
            onRemove={(index) => removeArrayItem("base", index)}
            namePlaceholder="fx. Fuldkornsris"
            amountPlaceholder="fx. 1 dl"
          />

          <ArrayEditorField
            label="Grønt"
            items={editorState.veg}
            onChange={(index, key, value) =>
              updateIngredientDraft("veg", index, key, value)
            }
            onAdd={() => addArrayItem("veg")}
            onRemove={(index) => removeArrayItem("veg", index)}
            namePlaceholder="fx. Broccoli"
            amountPlaceholder="fx. 1 dl"
          />

          <ArrayEditorField
            label="Energi"
            items={editorState.engine}
            onChange={(index, key, value) =>
              updateIngredientDraft("engine", index, key, value)
            }
            onAdd={() => addArrayItem("engine")}
            onRemove={(index) => removeArrayItem("engine", index)}
            namePlaceholder="fx. Chilicrunch"
            amountPlaceholder="fx. 2 spsk"
          />

          <div className="grid grid-cols-2 gap-3">
            <EditorField label="Kalorier">
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={editorState.cal}
                onChange={(event) => updateField("cal", event.target.value)}
                className={inputClassName}
                required
              />
            </EditorField>
            <EditorField label="Protein (g)">
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={editorState.p}
                onChange={(event) => updateField("p", event.target.value)}
                className={inputClassName}
                required
              />
            </EditorField>
            <EditorField label="Kulhydrat (g)">
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={editorState.c}
                onChange={(event) => updateField("c", event.target.value)}
                className={inputClassName}
                required
              />
            </EditorField>
            <EditorField label="Fedt (g)">
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={editorState.f}
                onChange={(event) => updateField("f", event.target.value)}
                className={inputClassName}
                required
              />
            </EditorField>
            <EditorField label="Fibre (g)">
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={editorState.fiber}
                onChange={(event) => updateField("fiber", event.target.value)}
                className={inputClassName}
                required
              />
            </EditorField>
          </div>

          {message ? (
            <p className="text-sm text-harvest-terracotta">{message}</p>
          ) : null}

          <div className="sticky bottom-4 flex gap-3 rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3 shadow-[var(--shadow-elevated)] backdrop-blur">
            <button
              type="button"
              onClick={resetAndClose}
              className="flex-1 rounded-2xl bg-[var(--tint-stone)] px-4 py-3 text-sm font-semibold text-[var(--foreground)]"
            >
              Annuller
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 rounded-2xl bg-harvest-green px-4 py-3 text-sm font-semibold text-white disabled:opacity-70"
            >
              {isSaving ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  {isCreateMode ? "Opretter" : "Gemmer"}
                </span>
              ) : isCreateMode ? (
                "Opret ret"
              ) : (
                "Gem ret"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ArrayEditorField({
  label,
  items,
  onChange,
  onAdd,
  onRemove,
  namePlaceholder,
  amountPlaceholder,
}: {
  label: string;
  items: IngredientDraft[];
  onChange: (index: number, key: keyof IngredientDraft, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  namePlaceholder: string;
  amountPlaceholder: string;
}) {
  return (
    <div className={`p-4 ${cardClass}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-harvest-terracotta">
          {label}
        </span>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1 rounded-full bg-harvest-green/10 px-3 py-1 text-[10px] font-semibold text-harvest-green transition hover:bg-harvest-green/20"
        >
          <Plus size={12} />
          Tilføj
        </button>
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className="grid flex-1 grid-cols-[minmax(0,1fr)_7rem] gap-2">
              <input
                value={item.name}
                onChange={(event) =>
                  onChange(index, "name", event.target.value)
                }
                className={inputClassName}
                placeholder={namePlaceholder}
              />
              <input
                value={item.quantity}
                onChange={(event) =>
                  onChange(index, "quantity", event.target.value)
                }
                className={inputClassName}
                placeholder={amountPlaceholder}
                aria-label={`${label}, mængde ${index + 1}`}
              />
            </div>
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-harvest-terracotta/10 text-harvest-terracotta transition hover:bg-harvest-terracotta/20"
                aria-label={`Fjern ${label.toLowerCase()} nr. ${index + 1}`}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function EditorField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className={`block p-4 ${cardClass}`}>
      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-harvest-terracotta">
        {label}
      </span>
      {children}
    </label>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("da-DK", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

const inputClassName = inputClass;
