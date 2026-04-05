import { expect, test } from "bun:test";
import { doesRectIntersectWithin, isRectFullyVisibleWithin } from "./inline-image-visibility.js";

test("treats a rect fully inside the viewport as visible", () => {
  expect(isRectFullyVisibleWithin(
    { x: 12, y: 8, width: 20, height: 8 },
    { x: 10, y: 5, width: 60, height: 20 },
  )).toBe(true);
});

test("treats a rect clipped by the viewport edge as not fully visible", () => {
  expect(isRectFullyVisibleWithin(
    { x: 55, y: 8, width: 20, height: 8 },
    { x: 10, y: 5, width: 60, height: 20 },
  )).toBe(false);
});

test("treats a rect clipped by the viewport edge as still intersecting", () => {
  expect(doesRectIntersectWithin(
    { x: 55, y: 8, width: 20, height: 8 },
    { x: 10, y: 5, width: 60, height: 20 },
  )).toBe(true);
});

test("treats zero-sized rects as not visible", () => {
  expect(isRectFullyVisibleWithin(
    { x: 12, y: 8, width: 0, height: 8 },
    { x: 10, y: 5, width: 60, height: 20 },
  )).toBe(false);
  expect(doesRectIntersectWithin(
    { x: 12, y: 8, width: 0, height: 8 },
    { x: 10, y: 5, width: 60, height: 20 },
  )).toBe(false);
});
