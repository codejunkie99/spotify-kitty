import { expect, test } from "bun:test";
import { getTerminalWidth, truncateTerminalText } from "./terminal-text.js";

test("truncateTerminalText truncates ASCII content with an ellipsis", () => {
  expect(truncateTerminalText("Featured Playlists", 10)).toBe("Featured …");
});

test("truncateTerminalText respects wide emoji graphemes", () => {
  expect(truncateTerminalText("🔥party mix", 6)).toBe("🔥par…");
});

test("getTerminalWidth counts emoji as double-width cells", () => {
  expect(getTerminalWidth("A🔥B")).toBe(4);
});
