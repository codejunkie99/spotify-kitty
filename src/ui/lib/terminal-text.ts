const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const COMBINING_MARK = /^\p{Mark}$/u;
const EMOJI_PRESENTATION = /\p{Extended_Pictographic}/u;

export function getTerminalWidth(input: string): number {
  let width = 0;
  for (const { segment } of segmenter.segment(input)) {
    width += getGraphemeWidth(segment);
  }
  return width;
}

export function truncateTerminalText(input: string, maxWidth: number): string {
  if (maxWidth <= 0) return "";
  if (getTerminalWidth(input) <= maxWidth) return input;
  if (maxWidth === 1) return "…";

  let result = "";
  let width = 0;

  for (const { segment } of segmenter.segment(input)) {
    const segmentWidth = getGraphemeWidth(segment);
    if (width + segmentWidth + 1 > maxWidth) {
      break;
    }
    result += segment;
    width += segmentWidth;
  }

  return `${result}…`;
}

function getGraphemeWidth(grapheme: string): number {
  if (grapheme.includes("\u200d") || EMOJI_PRESENTATION.test(grapheme)) {
    return 2;
  }

  let width = 0;
  for (const codePoint of graphemeToCodePoints(grapheme)) {
    width += getCodePointWidth(codePoint);
  }
  return width;
}

function* graphemeToCodePoints(grapheme: string): Generator<number> {
  for (const char of grapheme) {
    yield char.codePointAt(0) ?? 0;
  }
}

function getCodePointWidth(codePoint: number): number {
  if (codePoint === 0) return 0;
  if (codePoint < 32 || (codePoint >= 0x7f && codePoint < 0xa0)) return 0;
  if (isZeroWidthCodePoint(codePoint)) return 0;
  if (isWideCodePoint(codePoint)) return 2;
  return 1;
}

function isZeroWidthCodePoint(codePoint: number): boolean {
  const char = String.fromCodePoint(codePoint);
  return COMBINING_MARK.test(char)
    || (codePoint >= 0xfe00 && codePoint <= 0xfe0f)
    || codePoint === 0x200d;
}

function isWideCodePoint(codePoint: number): boolean {
  return (
    codePoint >= 0x1100 && (
      codePoint <= 0x115f
      || codePoint === 0x2329
      || codePoint === 0x232a
      || (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f)
      || (codePoint >= 0xac00 && codePoint <= 0xd7a3)
      || (codePoint >= 0xf900 && codePoint <= 0xfaff)
      || (codePoint >= 0xfe10 && codePoint <= 0xfe19)
      || (codePoint >= 0xfe30 && codePoint <= 0xfe6f)
      || (codePoint >= 0xff00 && codePoint <= 0xff60)
      || (codePoint >= 0xffe0 && codePoint <= 0xffe6)
      || (codePoint >= 0x1f300 && codePoint <= 0x1f64f)
      || (codePoint >= 0x1f900 && codePoint <= 0x1f9ff)
      || (codePoint >= 0x20000 && codePoint <= 0x3fffd)
    )
  );
}
