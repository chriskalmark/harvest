"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  LayoutDashboard,
  Search,
  ShoppingBag,
} from "lucide-react";
import WeekSelector from "@/components/WeekSelector";
import { useMealPlan } from "@/lib/MealPlanProvider";
import { buildHref } from "@/lib/urlState";

const navItems = [
  { name: "Ugeplan", href: "/", icon: CalendarDays },
  { name: "Menu", href: "/menu", icon: LayoutDashboard },
  { name: "Indkøb", href: "/shop", icon: ShoppingBag },
  { name: "Opskrifter", href: "/opskrifter", icon: BookOpen },
  { name: "Udforsk", href: "/explore", icon: Search },
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

      <div className="mx-auto flex h-[75px] max-w-md items-center justify-around px-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href === "/menu" &&
              (pathname.startsWith("/meal") ||
                pathname === "/week" ||
                pathname === "/plan" ||
                pathname === "/junk")) ||
            (item.href === "/opskrifter" && pathname.startsWith("/opskrift/"));
          const Icon = item.icon;
          // Kun madplanens skærme bærer ugen med rundt i adressen. Kataloget
          // er det samme uanset uge, og ugeplanen har sin egen ?uge= — begge
          // dele ville blive forvirret af et weekRange fra den gamle menu.
          const href =
            item.href === "/" ||
            item.href === "/explore" ||
            item.href === "/opskrifter"
              ? item.href
              : buildHref(item.href, queryString, {
                  weekRange: effectiveWeekRange,
                });

          return (
            <Link
              key={item.name}
              href={href}
              /* Versaler var det dyre valg, ikke skriftstoerrelsen.
                 "OPSKRIFTER" fyldte 78px ved 10px/0.06em og braekkede til to
                 linjer paa de 74px hver fane har paa en 390px-telefon, saa
                 raekken blev skruet ned til 9px for at undgaa det. 9px fed er
                 for lille til at laese, og den aktive fane maalte samtidig
                 3,34:1 mod --surface-1 i lyst tema.
                 Uden versaler og sporing maaler "Opskrifter" 54px ved 11px --
                 stoerre skrift OG mere luft end foer -- og --harvest-green-ink
                 loefter den aktive fane til 7,58:1. */
              className={`flex min-w-0 flex-1 flex-col items-center gap-1 whitespace-nowrap text-center text-[11px] font-semibold tracking-[0] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)] rounded-xl py-1 ${
                isActive
                  ? "text-[var(--harvest-green-ink)]"
                  : "text-[var(--text-muted)]"
              }`}
            >
              <span
                className={`flex h-7 w-10 items-center justify-center rounded-[11px] transition-colors ${
                  isActive ? "bg-[var(--tint-green)]" : ""
                }`}
              >
                <Icon size={19} strokeWidth={2.2} />
              </span>
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
