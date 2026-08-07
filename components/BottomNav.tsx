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
 * Ugevælgeren hører til madplanens skærme.
 *
 * Opskriftskataloget er ikke bundet til en uge, så dér ville den være en knap
 * uden virkning. Ugeplanen har sin egen ugeskifter i den grønne flade, og to
 * ugevælgere på samme skærm — der peger på hver sin uge — ville være løgn.
 */
function showsWeekSelector(pathname: string): boolean {
  if (pathname === "/" || pathname === "/explore") return false;
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
  const queryString = searchParams.toString();
  const weekRangeFromUrl = searchParams.get("weekRange");
  const effectiveWeekRange = selectedWeekRange ?? weekRangeFromUrl;

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
          // Kun Indkoeb baerer ugen med rundt i adressen -- den gamle
          // indkoebsliste er stadig bundet til en uge. Ugeplanen har sin egen
          // ?uge=, og kataloget er det samme uanset uge, saa begge dele ville
          // blive forvirret af et weekRange fra den gamle menu.
          const href =
            item.href === "/" || item.href === "/opskrifter"
              ? item.href
              : buildHref(item.href, queryString, {
                  weekRange: effectiveWeekRange,
                });

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
