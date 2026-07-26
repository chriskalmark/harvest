export function stripTraderJoesForDisplay(name: string) {
  const stripped = name
    .replace(/\btrader\s+joe(?:'|’)?s\b/gi, "")
    .replace(/^[\s:–—-]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return stripped.length > 0 ? stripped : name;
}

