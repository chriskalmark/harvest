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
 * Udklipsholderen og ikke et hentet dokument. Grunden er praktisk: appen
 * ligger bag Cloudflare Access, så alt der skulle HENTE listen udefra --
 * en Genvej, en kalenderfil, et abonnement -- ville ramme Access' login og
 * fejle. Kopiering sker i browseren, hvor man allerede er lukket ind.
 *
 * Formatet til Påmindelser er én vare per linje og intet andet. Apples
 * Påmindelser laver én påmindelse per linje når man indsætter, så en
 * overskrift ville blive til en påmindelse man skulle krydse af.
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
    try {
      await navigator.share({
        title: `Indkøb · ${ugeTitel}`,
        text: somTekst(liste, ugeTitel),
      });
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
          <Valg
            ikon={<ClipboardList size={20} strokeWidth={2} />}
            titel="Kopiér til Påmindelser"
            forklaring="Én vare per linje. Indsæt i Påmindelser — den laver én påmindelse per linje."
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

          {kanDele ? (
            <Valg
              ikon={<Share2 size={20} strokeWidth={2} />}
              titel="Del …"
              forklaring="Åbner telefonens delemenu."
              klaret={false}
              onClick={() => void del()}
            />
          ) : null}
        </div>

        {kopieret === "paamindelser" ? (
          <p className="mt-4 rounded-2xl bg-[var(--tint-green)] px-4 py-3 text-[0.88rem] leading-[1.5] text-[var(--harvest-green-ink)]">
            Åbn Påmindelser, lav en ny liste, og hold fingeren nede i den tomme
            liste → <strong>Indsæt</strong>. Bliver det til én lang påmindelse i
            stedet for mange, så sig til — så laver vi en anden vej.
          </p>
        ) : null}
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
