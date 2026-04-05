import { expect, test } from "bun:test";
import { AsyncQueue } from "./async-queue.js";

test("processes enqueued items sequentially without dropping any", async () => {
  const processed: number[] = [];
  const queue = new AsyncQueue<number>(async (value) => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    processed.push(value);
  });

  queue.enqueue(1);
  queue.enqueue(2);
  queue.enqueue(3);

  await queue.onIdle();

  expect(processed).toEqual([1, 2, 3]);
});

test("handles items enqueued while processing is already in flight", async () => {
  const processed: number[] = [];
  const queue = new AsyncQueue<number>(async (value) => {
    processed.push(value);
    if (value === 1) {
      queue.enqueue(2);
    }
  });

  queue.enqueue(1);

  await queue.onIdle();

  expect(processed).toEqual([1, 2]);
});
