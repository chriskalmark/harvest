/**
 * Kontrastmaaling paa de tokens temaet faktisk er skrevet i.
 *
 * Farverne i globals.css staar i oklch(). WCAG regner paa relativ luminans i
 * sRGB. Uden en konvertering her kan ingen test svare paa om en etiket er
 * laesbar -- og projektet har allerede haft fire runder hvor kontrast blev
 * skoennet med oejet og bagefter maalt til under graensen.
 *
 * Alfa haandteres som browseren goer det: farven lagt over sin baggrund med
 * kildeover-kompositering, FOER luminansen regnes. En chip paa
 * oklch(... / 0.16) er ikke sin egen farve, den er en blanding.
 */

export type Rgb = { r: number; g: number; b: number };

/** oklch(L C H / A) -- vinkel i grader, L som 0..1. */
export type Oklch = { l: number; c: number; h: number; a: number };

/**
 * Parser praecis den skrivemaade globals.css bruger:
 *   oklch(0.615 0.152 149)
 *   oklch(0.72 0.13 148 / 0.16)
 *   oklch(1 0 0 / 0.05)
 * og de faa hex-vaerdier der stadig staar tilbage i chip-tokens.
 */
export function parseColor(input: string): Oklch | Rgb {
  const text = input.trim();

  if (text.startsWith("#")) {
    const hex = text.slice(1);
    const wide =
      hex.length === 3
        ? hex
            .split("")
            .map((ch) => ch + ch)
            .join("")
        : hex;
    if (wide.length !== 6) {
      throw new Error(`Ukendt hex-farve: ${input}`);
    }
    return {
      r: parseInt(wide.slice(0, 2), 16) / 255,
      g: parseInt(wide.slice(2, 4), 16) / 255,
      b: parseInt(wide.slice(4, 6), 16) / 255,
    };
  }

  const match = text.match(/^oklch\(\s*([^)]+)\)$/i);
  if (!match) {
    throw new Error(`Ukendt farve: ${input}`);
  }

  const [colorPart, alphaPart] = match[1].split("/");
  const parts = colorPart.trim().split(/\s+/);
  if (parts.length < 3) {
    throw new Error(`oklch mangler led: ${input}`);
  }

  return {
    l: Number(parts[0]),
    c: Number(parts[1]),
    h: Number(parts[2]),
    a: alphaPart === undefined ? 1 : Number(alphaPart.trim()),
  };
}

function isOklch(value: Oklch | Rgb): value is Oklch {
  return (value as Oklch).l !== undefined;
}

/** OKLab -> lineaer sRGB, efter Bjoern Ottossons egne matricer. */
export function oklchToLinearRgb(color: Oklch): {
  r: number;
  g: number;
  b: number;
} {
  const hRad = (color.h * Math.PI) / 180;
  const a = color.c * Math.cos(hRad);
  const b = color.c * Math.sin(hRad);

  const l_ = color.l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = color.l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = color.l - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

function linearToSrgbChannel(value: number): number {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped <= 0.0031308
    ? clamped * 12.92
    : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
}

function srgbToLinearChannel(value: number): number {
  return value <= 0.04045
    ? value / 12.92
    : Math.pow((value + 0.055) / 1.055, 2.4);
}

/** Farven som browseren maler den, uden alfa. */
export function toSrgb(color: Oklch | Rgb): Rgb {
  if (!isOklch(color)) return color;
  const linear = oklchToLinearRgb(color);
  return {
    r: linearToSrgbChannel(linear.r),
    g: linearToSrgbChannel(linear.g),
    b: linearToSrgbChannel(linear.b),
  };
}

/**
 * Laeg en farve med alfa oven paa sin baggrund. Det er dette skridt et
 * oejemaal springer over, og praecis dér chips med /0.16 bliver misvurderet.
 */
export function composite(over: string, under: Rgb): Rgb {
  const parsed = parseColor(over);
  const alpha = isOklch(parsed) ? parsed.a : 1;
  const top = toSrgb(parsed);
  return {
    r: top.r * alpha + under.r * (1 - alpha),
    g: top.g * alpha + under.g * (1 - alpha),
    b: top.b * alpha + under.b * (1 - alpha),
  };
}

/** Laeg en hel stak af halvgennemsigtige lag oven paa en uigennemsigtig bund. */
export function stack(base: string, layers: string[]): Rgb {
  let current = toSrgb(parseColor(base));
  for (const layer of layers) {
    current = composite(layer, current);
  }
  return current;
}

export function relativeLuminance(color: Rgb): number {
  const r = srgbToLinearChannel(color.r);
  const g = srgbToLinearChannel(color.g);
  const b = srgbToLinearChannel(color.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x kontrastforhold, altid >= 1. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Kontrasten mellem en tekstfarve og den flade den ligger paa, hvor fladen kan
 * vaere bygget af flere halvgennemsigtige lag. Tekstfarven kompositeres ogsaa,
 * saa en etiket med alfa maales som den ser ud.
 */
export function measure(
  textColor: string,
  surfaceBase: string,
  surfaceLayers: string[] = [],
): number {
  const surface = stack(surfaceBase, surfaceLayers);
  const text = composite(textColor, surface);
  return contrastRatio(text, surface);
}

/** Afrundet til én decimal, som tallene skrives i rapporter. */
export function ratio(
  textColor: string,
  surfaceBase: string,
  surfaceLayers: string[] = [],
): number {
  return Math.round(measure(textColor, surfaceBase, surfaceLayers) * 100) / 100;
}
