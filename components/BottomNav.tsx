"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BookOpen, CalendarDays, ShoppingBag } from "lucide-react";
import WeekSelector from "@/components/WeekSelector";
import { useMealPlan } from "@/lib/MealPlanProvider";
import { buildHref } from "@/lib/urlState";

/**
 * Appen handler alene om aftensmad, saa bundnavigationen goer det samme: tre
 * faner, ikke fem. Den gamle menu (/menu) og det gamle retbibliotek
 * (/explore) er ikke slettet -- ugen med de seks fotos ligger der stadig,
 * og det er brugerens beslutning at rydde den ud, ikke denne opgaves. De
 * virker begge fint naar man skriver adressen, de staar bare ikke i
 * strimlen laengere.
 */
const navItems = [
  { name: "Ugeplan", href: "/", icon: CalendarDays },
  { name: "Opskrifter", href: "/opskrifter", icon: BookOpen },
  { name: "Indkøb", href: "/shop", icon: ShoppingBag },
];

/**
 * Ugevælgeren hører til den GAMLE madplans skærme.
 *
 * Den vælger en uge fra meal_plans. Både ugeplanen og indkøb har nu deres
 * egen ugeskifter i den grønne flade, som peger på week_plans -- og to
 * ugevælgere på samme skærm, der peger på hver sin uge, ville være løgn.
 * Kataloget er det samme uanset uge, så dér ville den være en knap uden
 * virkning. Tilbage er /menu, som stadig kører på den gamle model.
 */
function showsWeekSelector(pathname: string): boolean {
  if (pathname === "/" || pathname === "/explore") return false;
  if (pathname === "/shop") return false;
  if (pathname === "/opskrifter" || pathname.startsWith("/opskrift/")) {
    return false;
  }
  return true;
}

export default function BottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { selectedWeekRange, selectWeek, weeks } = useMealPlan();

  const showWeekSelector = showsWeekSelector(pathname);
  const ugeFraUrl = searchParams.get("uge") ?? undefined;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border-subtle)] bg-[var(--surface-1)] pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_25px_rgba(0,0,0,0.04)]">
      {showWeekSelector && weeks && weeks.length > 0 && (
        <div className="px-4 py-2 border-b border-[var(--border-subtle)]">
          <WeekSelector
            weeks={weeks}
            selectedWeekRange={selectedWeekRange}
            onChange={selectWeek}
            compact={true}
          />
        </div>
      )}

      <div className="mx-auto flex h-[78px] max-w-md items-center justify-around px-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href === "/opskrifter" && pathname.startsWith("/opskrift/"));
          const Icon = item.icon;
          // Ugeplanen og Indkoeb er to sider af den samme uge, saa ?uge=
          // baeres med imellem dem: staar man i uge 34 og trykker Indkoeb,
          // skal man se uge 34's varer -- ikke denne uges.
          //
          // weekRange fra den gamle menu maa IKKE med. De to modeller taeller
          // uger paa hver sin maade, og et weekRange paa /shop pegede foer paa
          // en helt anden uge end den ?uge= sagde.
          const href =
            item.href === "/opskrifter"
              ? item.href
              : buildHref(item.href, "", { uge: ugeFraUrl });

          return (
            <Link
              key={item.name}
              href={href}
              /* Tre faner i stedet for fem giver hver fane omkring 144px paa
                 en 390px-telefon i stedet for 74px -- rigeligt rum til
                 "Opskrifter" uden versaler eller sammenpresset skrift.
                 Trykmaalet er hele linket (fuld kolonnebredde, ~54px hoejt
                 med paddingen), godt over de 44px. --harvest-green-ink
                 giver den aktive fane 7,58:1 lyst og 9,26:1 moerkt. */
              className={`flex min-w-0 flex-1 flex-col items-center gap-1.5 whitespace-nowrap text-center text-[12px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)] rounded-xl py-1.5 ${
                isActive
                  ? "text-[var(--harvest-green-ink)]"
                  : "text-[var(--text-muted)]"
              }`}
            >
              <span
                className={`flex h-8 w-11 items-center justify-center rounded-[12px] transition-colors ${
                  isActive ? "bg-[var(--tint-green)]" : ""
                }`}
              >
                <Icon size={21} strokeWidth={2.2} />
              </span>
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
