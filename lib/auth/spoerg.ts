import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";

/**
 * Spørger om en adgangskode UDEN at den kommer forbi skallen.
 *
 * Det her er ikke pynt. Gav man koden som argument -- lav-kode "min kode" --
 * blev den ændret undervejs, hver gang den indeholdt et tegn skallen selv
 * bruger:
 *
 *   $  bliver til en variabel        "kode$1" -> "kode"
 *   !  bliver til historik i zsh     "kode!23" -> noget helt andet
 *   `  bliver til en kommando
 *
 * Så stod der ét i aftrykket og noget andet i browseren, og der var ingen
 * måde at se hvorfor. Dertil: et argument står i skallens historik og kan
 * ses i `ps` af enhver anden bruger på maskinen.
 *
 * Læses den herfra, går den direkte fra tastaturet ind i programmet.
 */
export function spørgOmKode(spørgsmål: string): Promise<string> {
  return new Promise((løs, afvis) => {
    if (!stdin.isTTY) {
      afvis(
        new Error(
          "Koden skal tastes ind. Kør kommandoen i en terminal, ikke gennem en pipe.",
        ),
      );
      return;
    }

    const linje = createInterface({ input: stdin, output: stdout });

    stdout.write(spørgsmål);

    // Slår ekkoet fra, så koden ikke står på skærmen bag én.
    const skjult = stdout.write.bind(stdout);
    let skjuler = true;
    (stdout as unknown as { write: typeof stdout.write }).write = ((
      tekst: string | Uint8Array,
      ...resten: unknown[]
    ) => {
      if (skjuler && typeof tekst === "string" && !tekst.includes("\n")) {
        return true;
      }
      return (skjult as (...a: unknown[]) => boolean)(tekst, ...resten);
    }) as typeof stdout.write;

    linje.question("", (svar) => {
      skjuler = false;
      (stdout as unknown as { write: typeof stdout.write }).write = skjult;
      stdout.write("\n");
      linje.close();
      løs(svar);
    });
  });
}
