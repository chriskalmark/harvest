import { pool } from "@/lib/db";
import {
  importSkagenfoodWeekExclusive,
  isSkagenfoodImportRunning,
} from "@/lib/services/skagenfoodCatalogService";
import { formatIsoWeek, nextIsoWeek } from "@/lib/skagenfood/isoWeek";
import { SkagenfoodImportError } from "@/lib/skagenfood/normalize";
import type { IsoWeek } from "@/lib/skagenfood/types";

/**
 * Det selvhelbredende tjek: naar ugeplanen laeses, sikrer dette at den
 * KOMMENDE uges opskrifter allerede ligger i kataloget -- uden at faa
 * laeseren til at vente paa Skagenfood, og uden at nogen skal huske at koere
 * noget hver soendag.
 *
 * Fire regler holder det her sikkert:
 *
 *   1. Kaldet fra ruten venter aldrig paa dette -- se scheduleAutoImportCheck.
 *   2. Kun én hentning ad gangen, delt med den manuelle importrute
 *      (importSkagenfoodWeekExclusive i skagenfoodCatalogService.ts).
 *   3. Et forsoeg der fejlede -- eller fandt ugen utilgaengelig -- bliver
 *      staaende i skagenfood_auto_import_runs, og et nyt forsoeg paa samme
 *      uge venter mindst RETRY_COOLDOWN_MS, ogsaa efter en genstart.
 *   4. Skagenfood udstiller kun tre uger ad gangen. En kommende uge der ikke
 *      findes hos dem endnu er en normal tilstand (status "unavailable"),
 *      ikke en fejl -- det er praecis det SkagenfoodImportError.code
 *      "week_unavailable" fanger.
 *
 * Alt her skriver kun med CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT
 * EXISTS. Intet herinde fjerner en tabel, en raekke eller noget andet, der
 * allerede findes.
 */

/** Slaas fra ved at saette env-variablen til en af disse vaerdier. */
const DISABLED_ENV_VALUES = new Set([
  "false",
  "0",
  "off",
  "nej",
  "fra",
  "disabled",
]);

/** Navnet paa env-variablen der slaar den selvhelbredende hentning fra. */
export const AUTO_IMPORT_ENV_VAR = "SKAGENFOOD_AUTO_IMPORT";

export function isAutoImportEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env[AUTO_IMPORT_ENV_VAR];
  if (raw === undefined || raw.trim() === "") return true;
  return !DISABLED_ENV_VALUES.has(raw.trim().toLowerCase());
}

/** Hvor laenge der skal gaa foer et nyt forsoeg paa den samme uge -- en time. */
const RETRY_COOLDOWN_MS = 60 * 60 * 1000;

export type AutoImportRunStatus =
  "running" | "success" | "error" | "unavailable";

export interface AutoImportRunRecord {
  status: AutoImportRunStatus;
  startedAt: Date;
}

/**
 * Ren beslutningsfunktion, uden database: skal et nyt forsoeg paa den samme
 * uge springes over, fordi det seneste forsoeg er for ferskt?
 *
 * Alle tilstande -- ogsaa en "running" der aldrig naaede at blive faerdig,
 * fx fordi containeren blev genstartet midt i -- er underlagt den samme
 * afkoelingsperiode. Det er det der forhindrer et haengende forsoeg i at
 * spaerre for alt fremtidigt, og det er det der forhindrer et frisk forsoeg i
 * at blive gentaget for tit.
 */
export function shouldSkipRetry(
  latest: AutoImportRunRecord | null,
  now: Date,
  cooldownMs: number = RETRY_COOLDOWN_MS,
): boolean {
  if (!latest) return false;
  return now.getTime() - latest.startedAt.getTime() < cooldownMs;
}

// ---------------------------------------------------------------------------
// Skemaet oprettes af appen selv, foerste gang det bruges.
//
// db/init/*.sql koeres kun af Postgres' docker-entrypoint-initdb.d paa en
// TOM datamappe -- produktionens database har allerede data og faar aldrig
// nye filer i db/init til at koere. Det er derfor tabellen oprettes her, med
// CREATE TABLE IF NOT EXISTS, i stedet for i en migrationsfil ingen ville
// koere.
// ---------------------------------------------------------------------------

let schemaReady: Promise<void> | null = null;

async function createAutoImportSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS skagenfood_auto_import_runs (
      id BIGSERIAL PRIMARY KEY,
      year SMALLINT NOT NULL,
      week_number SMALLINT NOT NULL,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ,
      status TEXT NOT NULL DEFAULT 'running',
      message TEXT,
      recipe_count INTEGER,
      CONSTRAINT skagenfood_auto_import_runs_status
        CHECK (status IN ('running', 'success', 'error', 'unavailable'))
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_skagenfood_auto_import_runs_target
      ON skagenfood_auto_import_runs (year, week_number, started_at DESC)
  `);
}

async function ensureAutoImportSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = createAutoImportSchema().catch((error) => {
      // Fejlede oprettelsen, skal naeste kald proeve igen -- ikke give op for altid.
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

// ---------------------------------------------------------------------------
// Databasekald
// ---------------------------------------------------------------------------

async function weekExistsInCatalog(target: IsoWeek): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM skagenfood_weeks WHERE year = $1 AND week_number = $2 LIMIT 1`,
    [target.year, target.week],
  );
  return (result.rowCount ?? 0) > 0;
}

interface RunRow {
  status: AutoImportRunStatus;
  started_at: Date;
  finished_at: Date | null;
  message: string | null;
  recipe_count: number | null;
}

async function readLatestRun(target: IsoWeek): Promise<RunRow | null> {
  const result = await pool.query<RunRow>(
    `
      SELECT status, started_at, finished_at, message, recipe_count
      FROM skagenfood_auto_import_runs
      WHERE year = $1 AND week_number = $2
      ORDER BY started_at DESC
      LIMIT 1
    `,
    [target.year, target.week],
  );
  return result.rows[0] ?? null;
}

async function insertRunningAttempt(
  target: IsoWeek,
  now: Date,
): Promise<number> {
  const result = await pool.query<{ id: number | string }>(
    `
      INSERT INTO skagenfood_auto_import_runs (year, week_number, started_at, status)
      VALUES ($1, $2, $3, 'running')
      RETURNING id
    `,
    [target.year, target.week, now],
  );
  const id = result.rows[0]?.id;
  if (id === undefined) {
    throw new Error(
      "Kunne ikke oprette et forsøgsforløb i skagenfood_auto_import_runs.",
    );
  }
  return Number(id);
}

async function finishRun(
  id: number,
  status: "success" | "error" | "unavailable",
  message: string,
  recipeCount: number | null,
): Promise<void> {
  await pool.query(
    `
      UPDATE skagenfood_auto_import_runs
      SET status = $2, message = $3, recipe_count = $4, finished_at = NOW()
      WHERE id = $1
    `,
    [id, status, message, recipeCount],
  );
}

// ---------------------------------------------------------------------------
// Selve tjekket
// ---------------------------------------------------------------------------

/**
 * Sikrer at den kommende uge findes i kataloget -- henter den i baggrunden,
 * hvis den mangler og intet taler imod det lige nu.
 *
 * Kaldes IKKE direkte fra en rute -- se scheduleAutoImportCheck, som er den
 * variant der aldrig blokerer en side-indlaesning.
 */
export async function ensureUpcomingWeekImported(
  now: Date = new Date(),
): Promise<void> {
  const target = nextIsoWeek(now);

  await ensureAutoImportSchema();

  if (await weekExistsInCatalog(target)) return;

  const latest = await readLatestRun(target);
  if (
    shouldSkipRetry(
      latest
        ? { status: latest.status, startedAt: new Date(latest.started_at) }
        : null,
      now,
    )
  ) {
    return;
  }

  // En manuel import (eller et andet samtidigt tjek) har allerede fat --
  // vent til naeste laesning i stedet for at koe op bag den.
  if (isSkagenfoodImportRunning()) return;

  const runId = await insertRunningAttempt(target, now);

  try {
    const report = await importSkagenfoodWeekExclusive({
      target,
      // Uden opsyn skal koerslen ikke stoppe helt paa grund af faerdigretter
      // Skagenfood ikke selv har skrevet en opskrift til (fx "hvis tilkøbt").
      // De bliver udeladt af kataloget -- resten af ugen skal stadig gemmes.
      allowIncomplete: true,
    });
    const message =
      `${formatIsoWeek(target)} hentet automatisk: ${report.recipeCount} opskrifter` +
      (report.incomplete.length
        ? `, ${report.incomplete.length} udeladt som ufuldstændige.`
        : ".");
    await finishRun(runId, "success", message, report.recipeCount);
    console.log(`[skagenfood-auto-import] ${message}`);
  } catch (error) {
    if (
      error instanceof SkagenfoodImportError &&
      error.code === "week_unavailable"
    ) {
      // Normal tilstand: Skagenfood har ikke lagt ugen op endnu.
      await finishRun(runId, "unavailable", error.message, null);
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    await finishRun(runId, "error", message, null);
    // Fejlen skal vaere synlig -- her, i containerens logs -- aldrig tavs.
    console.error(
      `[skagenfood-auto-import] automatisk hentning af ${formatIsoWeek(target)} fejlede: ${message}`,
    );
  }
}

/**
 * Den variant en rute maa kalde: starter tjekket og venter IKKE paa det.
 * Enhver fejl fanges herinde -- intet herfra maa nogensinde naa en
 * uhaandteret promise-afvisning.
 */
export function scheduleAutoImportCheck(now: Date = new Date()): void {
  if (!isAutoImportEnabled()) return;
  void ensureUpcomingWeekImported(now).catch((error) => {
    console.error(
      "[skagenfood-auto-import] uventet fejl i baggrundstjekket",
      error,
    );
  });
}

// ---------------------------------------------------------------------------
// Status til udefra -- GET /api/ugeplan/import bruger denne
// ---------------------------------------------------------------------------

export interface AutoImportStatus {
  enabled: boolean;
  running: boolean;
  target: string;
  targetYear: number;
  targetWeek: number;
  targetInCatalog: boolean;
  latestRun: {
    status: AutoImportRunStatus;
    startedAt: string;
    finishedAt: string | null;
    message: string | null;
    recipeCount: number | null;
  } | null;
}

export async function getAutoImportStatus(
  now: Date = new Date(),
): Promise<AutoImportStatus> {
  const target = nextIsoWeek(now);
  await ensureAutoImportSchema();

  const [targetInCatalog, latest] = await Promise.all([
    weekExistsInCatalog(target),
    readLatestRun(target),
  ]);

  return {
    enabled: isAutoImportEnabled(),
    running: isSkagenfoodImportRunning(),
    target: formatIsoWeek(target),
    targetYear: target.year,
    targetWeek: target.week,
    targetInCatalog,
    latestRun: latest
      ? {
          status: latest.status,
          startedAt: new Date(latest.started_at).toISOString(),
          finishedAt: latest.finished_at
            ? new Date(latest.finished_at).toISOString()
            : null,
          message: latest.message,
          recipeCount: latest.recipe_count,
        }
      : null,
  };
}
