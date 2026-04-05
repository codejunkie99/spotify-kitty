import { expect, test } from "bun:test";
import { shouldAutoOpenBrowser } from "./oauth-session.js";

test("auto-opening the OAuth browser is allowed when there is no recent launch", () => {
  expect(shouldAutoOpenBrowser(undefined, 1_000)).toBe(true);
});

test("auto-opening the OAuth browser is suppressed during the cooldown window", () => {
  expect(shouldAutoOpenBrowser(5_000, 5_500)).toBe(false);
});

test("auto-opening the OAuth browser resumes after the cooldown window", () => {
  expect(shouldAutoOpenBrowser(5_000, 66_000)).toBe(true);
});
