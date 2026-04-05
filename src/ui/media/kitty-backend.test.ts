import { expect, test } from "bun:test";
import type { InlineImageRequest } from "./inline-image-backend.js";
import { KittyInlineImageBackend } from "./kitty-backend.js";

test("kitty backend emits a single stdout write per image placement", async () => {
  const writes: string[] = [];
  const backend = new KittyInlineImageBackend((chunk) => {
    writes.push(chunk);
  });
  const request: InlineImageRequest = {
    imageId: "track-1",
    imageKey: "track-1::64x64",
    placement: {
      x: 10,
      y: 5,
      width: 6,
      height: 3,
      pixelWidth: 60,
      pixelHeight: 48,
    },
    asset: {
      cacheKey: "track-1",
      width: 64,
      height: 64,
      pngData: Buffer.from("png-data"),
    },
  };

  await backend.show(request);

  expect(writes).toHaveLength(1);
  expect(writes[0]).toContain("\u001b7");
  expect(writes[0]).toContain("\u001b[6;11H");
  expect(writes[0]).toContain("\u001b_G");
  expect(writes[0]).toContain("\u001b\\");
  expect(writes[0]).toEndWith("\u001b8");
});
