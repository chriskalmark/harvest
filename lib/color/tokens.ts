import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Laeser temaets tokens ud af globals.css, saa en kontrasttest maaler DEN
 * farve der staar i stilarket -- ikke en kopi der langsomt bliver forkert.
 *
 * To blokke betyder noget: :root (lyst) og :root.dark. Sidstnaevnte er den
 * klasse temaknappen saetter. @media (prefers-color-scheme: dark) er en
 * tvilling af :root.dark; den er med her netop for at kunne bevise at de to
 * ikke er drevet fra hinanden -- det er sket én gang og kostede tre etiketter
 * under 2:1 for alle der brugte knappen.
 */

export type Theme = "light" | "dark" | "media-dark";

const CSS_PATH = path.join(process.cwd(), "app", "globals.css");

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Finder én regelblok og returnerer alt mellem dens ydre kroegede parenteser. */
function blockBody(css: string, selector: string): string {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`Fandt ikke blokken ${selector}`);
  const open = css.indexOf("{", start);
  if (open === -1) throw new Error(`Blokken ${selector} har ingen krop`);

  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`Blokken ${selector} blev aldrig lukket`);
}

function declarations(body: string): Map<string, string> {
  const out = new Map<string, string>();
  // Kun deklarationer i blokkens eget niveau; indlejrede regler springes over.
  const flat = body.replace(/[^;{}]*\{[\s\S]*?\}/g, "");
  for (const line of flat.split(";")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const name = line.slice(0, idx).trim();
    if (!name.startsWith("--")) continue;
    out.set(name, line.slice(idx + 1).trim());
  }
  return out;
}

let cache: Map<Theme, Map<string, string>> | null = null;

function load(): Map<Theme, Map<string, string>> {
  if (cache) return cache;
  const css = stripComments(readFileSync(CSS_PATH, "utf8"));

  const light = declarations(blockBody(css, ":root {"));
  const dark = new Map(light);
  for (const [k, v] of declarations(blockBody(css, ":root.dark {"))) {
    dark.set(k, v);
  }

  // Tvillingen inde i @media staar paa :root:not(.light), saa den lyse
  // knap kan vinde over systemets moerke praeference.
  const mediaBody = blockBody(css, "@media (prefers-color-scheme: dark)");
  const mediaDark = new Map(light);
  for (const [k, v] of declarations(
    blockBody(mediaBody, ":root:not(.light)"),
  )) {
    mediaDark.set(k, v);
  }

  cache = new Map<Theme, Map<string, string>>([
    ["light", light],
    ["dark", dark],
    ["media-dark", mediaDark],
  ]);
  return cache;
}

/**
 * Slaar et token op og foelger var(--x)-kaeden til den ender paa en rigtig
 * farve. --surface-1 er var(--card-bg), som er den faktiske oklch.
 */
export function token(name: string, theme: Theme): string {
  const table = load().get(theme);
  if (!table) throw new Error(`Ukendt tema: ${theme}`);

  let value = table.get(name);
  if (value === undefined) throw new Error(`Ukendt token: ${name} (${theme})`);

  for (let hops = 0; hops < 8; hops += 1) {
    const ref = value.match(/^var\(\s*(--[\w-]+)\s*\)$/);
    if (!ref) return value;
    const next = table.get(ref[1]);
    if (next === undefined) {
      throw new Error(`${name} peger paa ukendt token ${ref[1]} (${theme})`);
    }
    value = next;
  }
  throw new Error(`For mange var()-hop fra ${name}`);
}

/** Alle tokennavne der findes i det lyse tema. */
export function tokenNames(): string[] {
  return [...(load().get("light") as Map<string, string>).keys()];
}
