import Image from "next/image";
import { Plus } from "lucide-react";
import type { WeekPlanSlotKind } from "@/lib/weekPlan/types";

/**
 * Det runde billede i venstre side af en dagsraekke.
 *
 * Fire tilstande, og ingen af dem er et ødelagt billede-ikon:
 *
 *   tom          en stiplet cirkel med et plus -- en invitation, ikke en fejl
 *   katalog      Skagenfoods foto
 *   katalog uden foto  appens egen madklat (.photo-placeholder i globals.css)
 *   selvskrevet  rettens forbogstav i Gabarito paa varm baggrund
 *
 * Den selvskrevne ret faar med vilje sit eget udtryk. "Lasagne" har intet
 * foto og faar aldrig et; saa er et bogstav aerligere end en tom ramme.
 */
export default function DagFoto({
  slotKind,
  imageUrl,
  title,
  size,
  priority = false,
}: {
  slotKind: WeekPlanSlotKind;
  imageUrl: string | null;
  /** Rettens navn -- kun brugt til forbogstavet paa en selvskrevet ret. */
  title: string | null;
  size: number;
  /** Sandt for ugens store foto — det man allerede kigger paa maa ikke lazy-loades. */
  priority?: boolean;
}) {
  const style = { width: size, height: size };

  if (slotKind === "empty") {
    return (
      <span
        style={style}
        aria-hidden="true"
        className="grid shrink-0 place-items-center rounded-full border-2 border-dashed border-harvest-green/45 bg-[var(--tint-green)] text-harvest-green"
      >
        <Plus size={Math.round(size * 0.3)} strokeWidth={2.4} />
      </span>
    );
  }

  if (slotKind === "manual") {
    const initial = (Array.from(title?.trim() ?? "")[0] ?? "?").toUpperCase();
    return (
      <span
        style={{ ...style, fontSize: Math.round(size * 0.42) }}
        aria-hidden="true"
        className="grid shrink-0 place-items-center rounded-full bg-[var(--tint-gold)] font-serif font-extrabold leading-none text-[var(--harvest-gold-ink)]"
      >
        {initial}
      </span>
    );
  }

  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt=""
        width={size}
        height={size}
        sizes={`${size}px`}
        quality={80}
        priority={priority}
        loading={priority ? undefined : "lazy"}
        style={style}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <span
      style={{ ...style, fontSize: Math.max(9, Math.round(size * 0.09)) }}
      aria-hidden="true"
      className="photo-placeholder shrink-0"
    />
  );
}
