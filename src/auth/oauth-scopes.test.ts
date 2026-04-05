import { expect, test } from "bun:test";
import { hasRequiredScopes, normalizeScopes } from "./oauth-scopes.js";

test("normalizeScopes handles space-delimited OAuth scope strings", () => {
  expect([...normalizeScopes("user-read-private user-library-read user-read-private")]).toEqual([
    "user-library-read",
    "user-read-private",
  ]);
});

test("hasRequiredScopes returns false when any configured scope is missing", () => {
  expect(hasRequiredScopes("user-read-private user-library-read", [
    "user-read-private",
    "user-library-read",
    "user-library-modify",
  ])).toBe(false);
});

test("hasRequiredScopes accepts stored scopes in any order", () => {
  expect(hasRequiredScopes("user-library-modify user-read-private user-library-read", [
    "user-read-private",
    "user-library-read",
    "user-library-modify",
  ])).toBe(true);
});
