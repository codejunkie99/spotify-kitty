import { expect, test } from "bun:test";
import { decodeHtmlEntities, sanitizeSpotifyText } from "./html-text.js";

test("decodeHtmlEntities decodes common HTML entities", () => {
  expect(decodeHtmlEntities("PIMMIE &quot;DON&apos;T COME HOME&quot; &amp; more")).toBe(
    "PIMMIE \"DON'T COME HOME\" & more",
  );
});

test("sanitizeSpotifyText removes tags and decodes entities", () => {
  expect(sanitizeSpotifyText("COVER: PIMMIE &quot;DON'T COME HOME&quot; <b>now</b>")).toBe(
    "COVER: PIMMIE \"DON'T COME HOME\" now",
  );
});
