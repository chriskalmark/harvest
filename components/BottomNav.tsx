"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutDashboard, Search, ShoppingBag } from "lucide-react";
import WeekSelector from "@/components/WeekSelector";
import { useMealPlan } from "@/lib/MealPlanProvider";
import { buildHref } from "@/lib/urlState";

const navItems = [
  { name: "Menu", href: "/menu", icon: LayoutDashboard },
  { name: "Indkøb", href: "/shop", icon: ShoppingBag },
  { name: "Udforsk", href: "/explore", icon: Search },
];

export default function BottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { selectedWeekRange, selectWeek, weeks } = useMealPlan();

  const showWeekSelector = pathname !== "/explore";
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
                pathname === "/junk"));
          const Icon = item.icon;
          const href =
            item.href === "/explore"
              ? item.href
              : buildHref(item.href, queryString, {
                  weekRange: effectiveWeekRange,
                });

          return (
            <Link
              key={item.name}
              href={href}
              className={`flex w-1/3 flex-col items-center gap-1 text-[10px] font-bold uppercase tracking-[0.06em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)] rounded-xl py-1 ${
                isActive ? "text-harvest-green" : "text-[var(--text-muted)]"
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
