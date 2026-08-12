"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, ShoppingCart, X } from "lucide-react";

/**
 * Send ugens indkøbsliste til Bilka ToGo-kurven.
 *
 * HVORFOR DET ER BYGGET SÅDAN HER
 *
 * Kurven hænger på din egen Bilka-session, som kun findes i din browser.
 * Serveren kan ikke nå den; forsøg endte i en anonym kurv ingen kunne se.
 *
 * Og siden her kan ikke bare kalde Bilkas API i baggrunden -- det blev
 * afprøvet og blokeret. Men den kan NAVIGERE et vindue. Navigerer browseren
 * til kurv-adressen, er den førstepart hos Bilka, cookien sendes, og varen
 * lander rigtigt. Målt: kurven gik fra 708,35 til 719,35 ved en ren
 * navigation fra et fremmed domæne, mens et baggrundskald fra samme side
 * ikke rykkede en øre.
 *
 * Derfor de to trin. Først åbnes ét vindue, hvor du logger ind -- det SKAL
 * ske på et tryk, ellers spærrer browseren for pop op. Bagefter genbruges
 * netop det vindue til én navigation pr. vare.
 *
 * Vi kan ikke læse svarene undervejs; vinduet hører til Bilka. Derfor ender
 * turen på kurvsiden, så du selv ser hvad der kom i. Det er den eneste
 * prøve der ikke kan lyve.
 */

interface BilkaVare {
  navn: string;
  produktId: string;
  produktNavn: string;
  antal: number;
  hvorfor: string | null;
  url: string;
}

interface BilkaSvar {
  weekLabel: string;
  varer: BilkaVare[];
  uden: string[];
  kurvUrl: string;
  loginUrl: string;
}

type Trin = "henter" | "login" | "sender" | "færdig" | "fejl";

/** Bilka skal nå at behandle hvert kald, før det næste kommer. */
const PAUSE_MS = 700;

export default function BilkaArk({
  uge,
  onClose,
}: {
  uge: string;
  onClose: () => void;
}) {
  const [trin, setTrin] = useState<Trin>("henter");
  const [data, setData] = useState<BilkaSvar | null>(null);
  const [fejl, setFejl] = useState<string | null>(null);
  const [sendt, setSendt] = useState(0);

  /** Vinduet vi åbnede. Det skal genbruges -- et nyt ville blive spærret. */
  const vindue = useRef<Window | null>(null);

  useEffect(() => {
    let afbrudt = false;

    (async () => {
      try {
        const svar = await fetch(
          `/api/bilka/kurv?uge=${encodeURIComponent(uge)}`,
          { cache: "no-store" },
        );
        const krop = (await svar.json()) as {
          data?: { bilka?: BilkaSvar };
          error?: string;
        };
        if (afbrudt) return;

        if (!svar.ok || !krop.data?.bilka) {
          setFejl(krop.error ?? "Kunne ikke slå varerne op hos Bilka.");
          setTrin("fejl");
          return;
        }
        setData(krop.data.bilka);
        setTrin("login");
      } catch {
        if (!afbrudt) {
          setFejl("Kunne ikke få fat i serveren.");
          setTrin("fejl");
        }
      }
    })();

    return () => {
      afbrudt = true;
    };
  }, [uge]);

  function åbnBilka() {
    if (!data) return;
    // Navngivet vindue, saa vi kan navigere netop det bagefter.
    vindue.current = window.open(data.loginUrl, "harvest-bilka");
    if (!vindue.current) {
      setFejl(
        "Browseren spærrede vinduet. Tillad pop op for mad.lmar.io, og prøv igen.",
      );
      setTrin("fejl");
    }
  }

  async function send() {
    if (!data) return;

    const w = vindue.current;
    if (!w || w.closed) {
      setFejl(
        "Bilka-vinduet er lukket. Tryk «Åbn Bilka» igen, log ind, og fortsæt derfra.",
      );
      setTrin("fejl");
      return;
    }

    setTrin("sender");
    setSendt(0);

    for (const [nummer, vare] of data.varer.entries()) {
      if (w.closed) {
        setFejl(`Vinduet blev lukket efter ${nummer} af ${data.varer.length}.`);
        setTrin("fejl");
        return;
      }
      w.location.href = vare.url;
      setSendt(nummer + 1);
      await new Promise((r) => setTimeout(r, PAUSE_MS));
    }

    // Slut paa kurvsiden, saa han selv ser resultatet.
    w.location.href = data.kurvUrl;
    w.focus();
    setTrin("færdig");
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
        aria-labelledby="bilka-overskrift"
        className="relative mx-auto flex max-h-[88vh] w-full max-w-md flex-col rounded-t-[32px] bg-[var(--surface-1)] shadow-[var(--shadow-elevated)]"
      >
        <div className="shrink-0 rounded-t-[32px] border-b border-[var(--border-subtle)] px-5 pb-4 pt-3">
          <div
            aria-hidden="true"
            className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--border-subtle)]"
          />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--harvest-green-ink)]">
                Bilka ToGo
              </p>
              <h2
                id="bilka-overskrift"
                className="mt-1 font-serif text-[1.4rem] font-extrabold leading-[1.1] tracking-[-0.02em]"
              >
                {data ? data.weekLabel : "Henter varerne"}
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
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-4">
          {trin === "henter" ? (
            <p className="flex items-center gap-2 py-6 text-[0.95rem] text-[var(--text-muted)]">
              <Loader2 size={18} className="animate-spin text-harvest-green" />
              Slår varerne op hos Bilka …
            </p>
          ) : null}

          {trin === "fejl" ? (
            <p
              role="alert"
              className="rounded-2xl border border-harvest-terracotta/30 bg-harvest-terracotta/10 px-4 py-3 text-[0.9rem] font-medium text-[var(--harvest-terracotta-ink)]"
            >
              {fejl}
            </p>
          ) : null}

          {data && trin !== "henter" ? (
            <>
              <p className="text-[0.95rem] leading-[1.5] text-[var(--foreground)]">
                <strong>{data.varer.length} varer</strong> er klar.
                {data.uden.length > 0 ? (
                  <>
                    {" "}
                    {data.uden.length} kunne ikke findes hos Bilka og springes
                    over: {data.uden.join(", ")}.
                  </>
                ) : null}
              </p>

              {trin === "login" || trin === "fejl" ? (
                <div className="mt-5">
                  <Skridt nummer={1} titel="Åbn Bilka og log ind">
                    Vinduet åbner ved siden af. Er du allerede logget ind,
                    behøver du ikke gøre noget.
                  </Skridt>
                  <button
                    type="button"
                    onClick={åbnBilka}
                    className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[22px] border border-[var(--border-subtle)] px-4 text-[0.95rem] font-semibold text-[var(--harvest-green-ink)] transition active:scale-[0.99]"
                  >
                    <ExternalLink size={17} strokeWidth={2.2} />
                    Åbn Bilka
                  </button>

                  <div className="mt-6">
                    <Skridt nummer={2} titel="Kom tilbage og fortsæt">
                      Så sendes varerne én ad gangen, og vinduet ender på
                      kurven, så du kan se resultatet.
                    </Skridt>
                  </div>
                  <button
                    type="button"
                    onClick={() => void send()}
                    disabled={data.varer.length === 0}
                    className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[22px] bg-harvest-green px-4 text-[0.95rem] font-semibold text-white transition active:scale-[0.99] disabled:opacity-50"
                  >
                    <ShoppingCart size={17} strokeWidth={2.2} />
                    Fortsæt — send {data.varer.length} varer
                  </button>
                </div>
              ) : null}

              {trin === "sender" ? (
                <div className="mt-6">
                  <p
                    aria-live="polite"
                    className="font-serif text-[1.2rem] font-bold"
                  >
                    Sender {sendt} af {data.varer.length} …
                  </p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--tint-stone)]">
                    <div
                      className="h-full rounded-full bg-harvest-green transition-[width] duration-300"
                      style={{
                        width: `${(sendt / Math.max(1, data.varer.length)) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="mt-3 text-[0.88rem] leading-[1.5] text-[var(--text-muted)]">
                    Luk ikke Bilka-vinduet imens. Det skifter side for hver vare
                    — sådan skal det se ud.
                  </p>
                </div>
              ) : null}

              {trin === "færdig" ? (
                <div className="mt-6 rounded-[24px] bg-[var(--tint-green)] px-4 py-4">
                  <p className="font-serif text-[1.2rem] font-bold text-[var(--foreground)]">
                    {data.varer.length} varer sendt
                  </p>
                  <p className="mt-2 text-[0.9rem] leading-[1.5] text-[var(--foreground)]">
                    Bilka-vinduet står nu på kurven. Kig den igennem — det er
                    den eneste rigtige kvittering.
                  </p>
                </div>
              ) : null}

              <ul className="mt-6 border-t border-[var(--border-subtle)] pt-4">
                {data.varer.map((vare) => (
                  <li
                    key={vare.produktId}
                    className="flex items-baseline justify-between gap-3 border-b border-[var(--border-subtle)] py-2.5 last:border-b-0"
                  >
                    <span className="min-w-0">
                      <span className="block text-[0.95rem] font-semibold text-[var(--foreground)]">
                        {vare.produktNavn}
                      </span>
                      <span className="block text-[0.8rem] text-[var(--text-muted)]">
                        {vare.navn}
                        {vare.hvorfor ? ` · ${vare.hvorfor}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 font-serif text-[1rem] font-bold text-[var(--harvest-green-ink)]">
                      ×{vare.antal}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Skridt({
  nummer,
  titel,
  children,
}: {
  nummer: number;
  titel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--tint-green)] font-serif text-[0.9rem] font-bold text-[var(--harvest-green-ink)]">
        {nummer}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-[var(--foreground)]">
          {titel}
        </span>
        <span className="mt-0.5 block text-[0.88rem] leading-[1.45] text-[var(--text-muted)]">
          {children}
        </span>
      </span>
    </div>
  );
}
