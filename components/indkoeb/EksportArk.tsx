"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, ClipboardList, FileText, Share2, X } from "lucide-react";
import {
  antalIEksport,
  somTekst,
  tilPåmindelser,
} from "@/lib/weekPlan/eksport";
import type { Indkøbsliste } from "@/lib/weekPlan/indkoeb";

/**
 * Tag listen med et andet sted hen.
 *
 * DELEMENUEN er hovedvejen, ikke udklipsholderen.
 *
 * Først byggede vi det som "kopiér og indsæt i Påmindelser", fordi den app
 * skulle lave én påmindelse per linje. Det gør den ikke -- afprøvet på en
 * rigtig iPhone: hele teksten bliver til ÉN påmindelse. Antagelsen var
 * forkert, og der er ikke noget i iOS der deler tekst op af sig selv.
 *
 * Det der virker, er en Genvej. Man laver den én gang, den tager teksten
 * fra delemenuen, deler på linjeskift og laver en påmindelse per linje.
 * Derfor deler vi den NØGNE liste -- én vare per linje, ingen overskrifter,
 * ingen ugetitel -- for det er præcis hvad Genvejen skal bruge.
 *
 * Kopiering bliver som reserve, og til det man selv skal læse.
 *
 * Bemærk hvorfor der ikke er et hentet dokument eller et abonnement: appen
 * ligger bag Cloudflare Access, så alt der skulle HENTE listen udefra ville
 * ramme Access' login og fejle. Delingen sker i browseren, hvor man
 * allerede er lukket ind.
 */

type Kopieret = "paamindelser" | "tekst" | null;

/** Deling skifter ikke undervejs, saa der er intet at abonnere paa. */
const abonnérIngenting = () => () => {};
const harDeling = () => typeof navigator !== "undefined" && !!navigator.share;

export default function EksportArk({
  liste,
  ugeTitel,
  onClose,
}: {
  liste: Indkøbsliste;
  ugeTitel: string;
  onClose: () => void;
}) {
  const [kopieret, setKopieret] = useState<Kopieret>(null);
  const [fejl, setFejl] = useState<string | null>(null);
  /*
   * navigator.share findes ikke i alle browsere. Knappen tegnes kun naar
   * den goer -- en knap der ikke virker er vaerre end ingen knap.
   *
   * useSyncExternalStore og ikke en effekt: navigator findes ikke paa
   * serveren, saa svaret dér er altid nej, og React faar de to svar at
   * vide paa én gang i stedet for at skulle tegne om bagefter.
   */
  const kanDele = useSyncExternalStore(abonnérIngenting, harDeling, () => false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const antal = antalIEksport(liste);

  async function kopiér(hvad: Exclude<Kopieret, null>) {
    const tekst =
      hvad === "paamindelser"
        ? tilPåmindelser(liste)
        : somTekst(liste, ugeTitel);

    if (!tekst) {
      setFejl("Der er ikke noget tilbage at handle.");
      return;
    }

    try {
      await navigator.clipboard.writeText(tekst);
      setFejl(null);
      setKopieret(hvad);
    } catch {
      setFejl(
        "Browseren ville ikke give adgang til udklipsholderen. Prøv at markere teksten selv.",
      );
    }
  }

  async function del() {
    const tekst = tilPåmindelser(liste);
    if (!tekst) {
      setFejl("Der er ikke noget tilbage at handle.");
      return;
    }
    try {
      // Kun teksten, ingen titel. En titel ville blive til en ekstra linje
      // i delearket hos nogle modtagere -- og dermed til en påmindelse der
      // hed "Indkøb · Uge 34".
      await navigator.share({ text: tekst });
      setFejl(null);
    } catch {
      // Fortryder man i delearket, er det ikke en fejl.
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col justify-end">
      <button
        type="button"
        aria-label="Luk"
        onClick={onClose}
        className="absolute inset-0 bg-[oklch(0.2_0.03_152_/_0.5)]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="eksport-overskrift"
        className="relative mx-auto w-full max-w-md rounded-t-[32px] bg-[var(--surface-1)] px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3 shadow-[var(--shadow-elevated)]"
      >
        <div
          aria-hidden="true"
          className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--border-subtle)]"
        />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--harvest-green-ink)]">
              Tag listen med
            </p>
            <h2
              id="eksport-overskrift"
              className="mt-1 font-serif text-[1.4rem] font-extrabold leading-[1.1] tracking-[-0.02em]"
            >
              {antal} {antal === 1 ? "vare" : "varer"} mangler
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Luk"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--tint-stone)] text-[var(--text-muted)] transition active:scale-90"
          >
            <X size={18} strokeWidth={2.2} />
          </button>
        </div>

        {fejl ? (
          <p
            role="alert"
            className="mt-4 rounded-2xl border border-harvest-terracotta/30 bg-harvest-terracotta/10 px-4 py-3 text-[0.9rem] font-medium text-[var(--harvest-terracotta-ink)]"
          >
            {fejl}
          </p>
        ) : null}

        <div className="mt-5 space-y-2.5">
          {kanDele ? (
            <Valg
              ikon={<Share2 size={20} strokeWidth={2} />}
              titel="Send til Påmindelser"
              forklaring="Åbner delemenuen. Vælg genvejen «Varer til Påmindelser»."
              klaret={false}
              onClick={() => void del()}
            />
          ) : null}

          <Valg
            ikon={<ClipboardList size={20} strokeWidth={2} />}
            titel="Kopiér varerne"
            forklaring="Én vare per linje, uden overskrifter."
            klaret={kopieret === "paamindelser"}
            onClick={() => void kopiér("paamindelser")}
          />

          <Valg
            ikon={<FileText size={20} strokeWidth={2} />}
            titel="Kopiér hele listen"
            forklaring="Med afsnit og jeres egne retter. Til en note eller en besked."
            klaret={kopieret === "tekst"}
            onClick={() => void kopiér("tekst")}
          />
        </div>

        <p className="mt-4 rounded-2xl bg-[var(--tint-gold)] px-4 py-3 text-[0.85rem] leading-[1.5] text-[var(--foreground)]">
          <strong>Første gang:</strong> Påmindelser kan ikke selv dele en tekst
          op i linjer — hele listen bliver til én påmindelse. Lav genvejen
          «Varer til Påmindelser» i Genveje-appen én gang, så gør den arbejdet
          herefter. Opskriften ligger i <code>docs/paamindelser.md</code>.
        </p>
      </div>
    </div>
  );
}

function Valg({
  ikon,
  titel,
  forklaring,
  klaret,
  onClick,
}: {
  ikon: React.ReactNode;
  titel: string;
  forklaring: string;
  klaret: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3.5 rounded-[22px] bg-[var(--tint-stone)] px-4 py-3.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-1)] active:scale-[0.99]"
    >
      <span
        aria-hidden="true"
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition ${
          klaret
            ? "bg-harvest-green text-white"
            : "bg-[var(--surface-1)] text-[var(--harvest-green-ink)]"
        }`}
      >
        {klaret ? <Check size={20} strokeWidth={2.6} /> : ikon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[1rem] font-semibold text-[var(--foreground)]">
          {klaret ? "Kopieret" : titel}
        </span>
        <span className="mt-0.5 block text-[0.82rem] leading-[1.4] text-[var(--text-muted)]">
          {forklaring}
        </span>
      </span>
    </button>
  );
}
