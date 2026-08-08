"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { inputClass } from "@/lib/uiClasses";

/**
 * Husstandens login.
 *
 * Ét felt. Der er ingen brugernavn, ingen "glemt kode", ingen opret-konto --
 * appen har én husstand og én kode. At tegne et kontoflow ville love noget,
 * der ikke findes.
 *
 * Feltet er type="password" med autoComplete="current-password", saa
 * telefonens nøglering tilbyder at gemme koden. Det er hele forskellen paa
 * en kode man taster fire gange om aaret og en man giver op paa.
 */
export default function LoginSkaerm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [kodeord, setKodeord] = useState("");
  const [fejl, setFejl] = useState<string | null>(null);
  const [sender, setSender] = useState(false);

  /**
   * Hvor man var på vej hen, før låsen greb ind.
   *
   * Kun stier inde i appen accepteres. Uden det tjek kunne et link som
   * /login?videre=https://et-andet-sted sende én videre til en fremmed
   * side, der lignede appen og bad om koden igen.
   */
  const videre = (() => {
    const rå = searchParams.get("videre");
    if (!rå || !rå.startsWith("/") || rå.startsWith("//")) return "/";
    return rå;
  })();

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (sender || !kodeord) return;

    setSender(true);
    setFejl(null);

    try {
      const svar = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kodeord }),
      });

      if (svar.ok) {
        setKodeord("");
        // replace, ikke push: loginsiden skal ikke ligge i historikken,
        // så et tryk på tilbage fører hen til den igen.
        router.replace(videre);
        router.refresh();
        return;
      }

      const krop = (await svar.json().catch(() => null)) as {
        error?: string;
      } | null;
      setFejl(krop?.error ?? "Forkert kode.");
    } catch {
      setFejl("Kunne ikke få fat i serveren. Er der forbindelse?");
    } finally {
      setSender(false);
    }
  }

  return (
    <main className="px-4 pb-12 pt-6">
      {/* Headeren tegnes ikke paa loginsiden, saa ordmaerket staar her.
          Uden det er der ingen der siger hvilken app man er landet i. */}
      <p className="mb-5 px-1 font-serif text-[1.55rem] font-bold leading-none text-[var(--harvest-green-ink)]">
        Harvest
      </p>

      <div className="rounded-[34px] bg-[var(--field-green)] px-5 pb-9 pt-8 text-[var(--field-ink)]">
        <h1 className="font-serif text-[2rem] font-extrabold leading-[1.05] tracking-[-0.025em]">
          Aftensmad
          <br />
          hele ugen.
        </h1>
        <p className="mt-3 text-[0.9rem] font-medium text-[var(--field-ink-soft)]">
          Harvest er husstandens egen. Tast koden for at komme ind.
        </p>
      </div>

      <form
        onSubmit={send}
        className="relative -mt-5 rounded-[34px] bg-[var(--surface-1)] px-5 pb-7 pt-6"
      >
        <label
          htmlFor="husstandskode"
          className="block text-[0.9rem] font-semibold text-[var(--foreground)]"
        >
          Husstandens kode
        </label>

        <input
          id="husstandskode"
          type="password"
          value={kodeord}
          onChange={(event) => setKodeord(event.target.value)}
          autoComplete="current-password"
          autoFocus
          aria-invalid={fejl !== null}
          aria-describedby={fejl ? "login-fejl" : undefined}
          className={`${inputClass} mt-2 min-h-[48px] text-[1.05rem]`}
        />

        {fejl ? (
          <p
            id="login-fejl"
            role="alert"
            className="mt-3 rounded-2xl border border-harvest-terracotta/30 bg-harvest-terracotta/10 px-4 py-3 text-[0.9rem] font-medium text-[var(--harvest-terracotta-ink)]"
          >
            {fejl}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={sender || kodeord.length === 0}
          className="mt-5 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[22px] bg-harvest-green px-4 text-[0.95rem] font-semibold text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sender ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              Lukker op
            </>
          ) : (
            "Luk mig ind"
          )}
        </button>

        <p className="mt-4 text-[0.85rem] leading-[1.5] text-[var(--text-muted)]">
          Koden holder i 90 dage på den her telefon. Lad din nøglering gemme
          den, så slipper du for at huske den.
        </p>
      </form>
    </main>
  );
}
