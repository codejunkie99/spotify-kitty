import { expect, test } from "bun:test";
import { chunk, collectOffsetPages } from "./pagination.js";

test("collectOffsetPages keeps fetching until total items are collected", async () => {
  const offsets: number[] = [];
  const items = await collectOffsetPages(
    async (offset, limit) => {
      offsets.push(offset);
      const source = ["a", "b", "c", "d", "e"];
      return {
        items: source.slice(offset, offset + limit),
        total: source.length,
      };
    },
    2,
  );

  expect(items).toEqual(["a", "b", "c", "d", "e"]);
  expect(offsets).toEqual([0, 2, 4]);
});

test("chunk splits items into stable fixed-size groups", () => {
  expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
});
