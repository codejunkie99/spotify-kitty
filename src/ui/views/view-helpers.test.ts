import { expect, test } from "bun:test";
import {
  applyFilterOverlayKey,
  filterItemsFromQuery,
  getPlaybackOffset,
  moveSelection,
  resolveClickSelection,
  shouldShowSearchEmptyState,
} from "./view-helpers.js";

test("does not show empty search state while the user is still typing", () => {
  expect(shouldShowSearchEmptyState({
    inputMode: true,
    loading: false,
    query: "lo",
    resultsCount: 0,
    hasSearched: false,
  })).toBe(false);
});

test("shows empty search state after a submitted empty search", () => {
  expect(shouldShowSearchEmptyState({
    inputMode: false,
    loading: false,
    query: "lofi",
    resultsCount: 0,
    hasSearched: true,
  })).toBe(true);
});

test("moveSelection never returns a negative index for empty collections", () => {
  expect(moveSelection(0, 1, 0)).toBe(0);
  expect(moveSelection(0, -1, 0)).toBe(0);
});

test("getPlaybackOffset returns undefined for empty collections", () => {
  expect(getPlaybackOffset(0, 0)).toBeUndefined();
  expect(getPlaybackOffset(2, 5)).toBe(2);
});

test("filterItemsFromQuery matches all words case-insensitively", () => {
  expect(filterItemsFromQuery(
    ["Daily Mix", "Focus Flow", "Late Night Coding"],
    "night cod",
    (item) => item,
  )).toEqual(["Late Night Coding"]);
});

test("applyFilterOverlayKey opens the filter and appends printable characters", () => {
  const state = { active: false, query: "" };

  expect(applyFilterOverlayKey(state, { name: "/", sequence: "/" } as any)).toEqual({
    handled: true,
    changed: false,
    submit: false,
  });
  expect(state).toEqual({ active: true, query: "" });

  expect(applyFilterOverlayKey(state, { name: "l", sequence: "l" } as any)).toEqual({
    handled: true,
    changed: true,
    submit: false,
  });
  expect(state).toEqual({ active: true, query: "l" });
});

test("applyFilterOverlayKey clears and closes the filter on escape", () => {
  const state = { active: true, query: "lofi" };

  expect(applyFilterOverlayKey(state, { name: "escape", sequence: "\u001b" } as any)).toEqual({
    handled: true,
    changed: true,
    submit: false,
  });
  expect(state).toEqual({ active: false, query: "" });
});

test("resolveClickSelection selects on first click and activates on second click", () => {
  expect(resolveClickSelection(0, 2, 5)).toEqual({ selected: 2, activate: false });
  expect(resolveClickSelection(2, 2, 5)).toEqual({ selected: 2, activate: true });
});

test("resolveClickSelection ignores out-of-range clicks", () => {
  expect(resolveClickSelection(1, 9, 3)).toEqual({ selected: 1, activate: false });
});
