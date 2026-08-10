import type { PoolClient } from "pg";

/**
 * Hvilken husstand hører en e-mail til?
 *
 * Én tabel, to kolonner. Der er ingen id'er, ingen roller og ingen
 * invitationskoder -- husstanden er et navn, og en person hører til én.
 * Skal det laves om, er det en ny beslutning, ikke et hul der skal fyldes.
 */

/**
 * Husstandsnavnet for en ny bruger.
 *
 * Bogstaver, tal og bindestreg, udledt af e-mailen. To familier med
 * samme fornavn hos hver sin udbyder får ikke samme husstand, fordi hele
 * adressen indgår -- "anna@a.dk" bliver til "anna-a-dk".
 */
export function husstandsnavnFor(email: string): string {
  const rent = email
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return rent || "husstand";
}

export async function findHusstand(
  client: PoolClient,
  email: string,
): Promise<string | null> {
  const result = await client.query(
    `SELECT husstand FROM brugere WHERE email = $1`,
    [email.toLowerCase()],
  );
  return result.rows[0] ? String(result.rows[0].husstand) : null;
}

/**
 * Husstanden for en e-mail -- oprettes hvis den ikke findes.
 *
 * ON CONFLICT DO NOTHING plus en læsning bagefter: to faner åbnet samtidig
 * af en ny bruger må ikke give to husstande. Den der taber kapløbet, læser
 * den vinderen skrev.
 */
export async function sikrHusstand(
  client: PoolClient,
  email: string,
): Promise<string> {
  const rent = email.toLowerCase();

  await client.query(
    `INSERT INTO brugere (email, husstand)
     VALUES ($1, $2)
     ON CONFLICT (email) DO NOTHING`,
    [rent, husstandsnavnFor(rent)],
  );

  const result = await client.query(
    `SELECT husstand FROM brugere WHERE email = $1`,
    [rent],
  );

  if (!result.rows[0]) {
    // Kan kun ske hvis rækken blev slettet mellem de to sætninger.
    throw new Error(`Kunne ikke oprette husstand for ${rent}.`);
  }
  return String(result.rows[0].husstand);
}

/** Hvem deler husstand med hvem. Til husstandsskærmen. */
export async function medlemmer(
  client: PoolClient,
  husstand: string,
): Promise<{ email: string; createdAt: string }[]> {
  const result = await client.query(
    `SELECT email, created_at FROM brugere
      WHERE husstand = $1
      ORDER BY created_at ASC, email ASC`,
    [husstand],
  );
  return result.rows.map((row) => ({
    email: String(row.email),
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

/**
 * Flytter en e-mail over i en anden husstand.
 *
 * Sådan kommer en ægtefælle med i stedet for at få sin egen tomme uge.
 * Den gamle husstands planer bliver stående -- de slettes ikke, fordi
 * nogen skifter hold.
 */
export async function flytTilHusstand(
  client: PoolClient,
  email: string,
  husstand: string,
): Promise<void> {
  await client.query(
    `INSERT INTO brugere (email, husstand)
     VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET husstand = EXCLUDED.husstand`,
    [email.toLowerCase(), husstand],
  );
}
