const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  quot: "\"",
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
  "#39": "'",
};

export function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, token: string) => {
    const normalized = token.toLowerCase();
    if (normalized.startsWith("#x")) {
      const codePoint = Number.parseInt(normalized.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }
    if (normalized.startsWith("#")) {
      const codePoint = Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }
    return NAMED_ENTITIES[normalized] ?? entity;
  });
}

export function sanitizeSpotifyText(input: string): string {
  return decodeHtmlEntities(input.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}
