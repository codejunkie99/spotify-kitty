import { expect, mock, test } from "bun:test";

mock.module("./spotify-image-preview.js", () => ({
  getSpotifyImageData: async () => ({
    cacheKey: "mock-image",
    width: 64,
    height: 64,
    pngData: Buffer.from("png"),
  }),
}));

const { InlineImageManager } = await import("./inline-image-manager.js");

test("scoped reconciliations keep now-playing art alive while page art updates", async () => {
  const backend = {
    isAvailable: () => true,
    show: mock(async () => {}),
    update: mock(async () => {}),
    hide: mock(async () => {}),
    clearAll: mock(async () => {}),
  };

  const renderer = {
    width: 120,
    height: 40,
    idle: async () => {},
    root: {
      findDescendantById(id: string) {
        if (id === "playlist-cover") return { x: 2, y: 2, width: 10, height: 10 };
        if (id === "np-art") return { x: 2, y: 34, width: 6, height: 3 };
        return undefined;
      },
    },
  };

  const manager = new InlineImageManager(renderer as any, "kitty", () => {});
  (manager as any).kittyBackend = backend;

  await manager.reconcileScope("playlist-1", {
    viewId: "playlist-1",
    itemId: "cover",
    imageUrl: "https://example.com/playlist.png",
    anchorId: "playlist-cover",
    kind: "cover",
  });

  await manager.reconcileScope("now-playing", {
    viewId: "now-playing",
    itemId: "track-1",
    imageUrl: "https://example.com/track.png",
    anchorId: "np-art",
    kind: "cover",
  });

  expect(backend.show).toHaveBeenCalledTimes(2);
  expect(backend.hide).toHaveBeenCalledTimes(0);

  await manager.reconcileScope("playlist-1", undefined);

  expect(backend.hide).toHaveBeenCalledTimes(1);
  expect(backend.hide).toHaveBeenCalledWith("playlist-1:cover:cover");
});

test("inline image writes wait for renderer idle before issuing kitty commands", async () => {
  const events: string[] = [];
  const backend = {
    isAvailable: () => true,
    show: mock(async () => {
      events.push("show");
    }),
    update: mock(async () => {}),
    hide: mock(async () => {}),
    clearAll: mock(async () => {}),
  };

  const renderer = {
    width: 120,
    height: 40,
    idle: async () => {
      events.push("idle");
    },
    root: {
      findDescendantById(id: string) {
        if (id === "playlist-cover") return { x: 2, y: 2, width: 10, height: 10 };
        return undefined;
      },
    },
  };

  const manager = new InlineImageManager(renderer as any, "kitty", () => {});
  (manager as any).kittyBackend = backend;

  await manager.reconcileScope("playlist-1", {
    viewId: "playlist-1",
    itemId: "cover",
    imageUrl: "https://example.com/playlist.png",
    anchorId: "playlist-cover",
    kind: "cover",
  });

  expect(events).toEqual(["idle", "show"]);
});

test("cover art stays visible while its anchor is only partially clipped by the viewport", async () => {
  const backend = {
    isAvailable: () => true,
    show: mock(async () => {}),
    update: mock(async () => {}),
    hide: mock(async () => {}),
    clearAll: mock(async () => {}),
  };

  const renderer = {
    width: 120,
    height: 40,
    idle: async () => {},
    root: {
      findDescendantById(id: string) {
        if (id === "row-cover") return { x: 55, y: 8, width: 20, height: 8 };
        if (id === "rail-viewport") return { x: 10, y: 5, width: 60, height: 20 };
        return undefined;
      },
    },
  };

  const manager = new InlineImageManager(renderer as any, "kitty", () => {});
  (manager as any).kittyBackend = backend;

  await manager.reconcileScope("home", {
    viewId: "home",
    itemId: "item-1",
    imageUrl: "https://example.com/cover.png",
    anchorId: "row-cover",
    viewportAnchorIds: ["rail-viewport"],
    kind: "cover",
  });

  expect(backend.show).toHaveBeenCalledTimes(1);
});

test("strict viewport anchors hide cover art when a card is only partially visible in that viewport", async () => {
  const backend = {
    isAvailable: () => true,
    show: mock(async () => {}),
    update: mock(async () => {}),
    hide: mock(async () => {}),
    clearAll: mock(async () => {}),
  };

  const renderer = {
    width: 120,
    height: 40,
    idle: async () => {},
    root: {
      findDescendantById(id: string) {
        if (id === "row-cover") return { x: 55, y: 8, width: 20, height: 8 };
        if (id === "home-viewport") return { x: 0, y: 0, width: 120, height: 30 };
        if (id === "rail-viewport") return { x: 10, y: 5, width: 60, height: 20 };
        return undefined;
      },
    },
  };

  const manager = new InlineImageManager(renderer as any, "kitty", () => {});
  (manager as any).kittyBackend = backend;

  await manager.reconcileScope("home", {
    viewId: "home",
    itemId: "item-1",
    imageUrl: "https://example.com/cover.png",
    anchorId: "row-cover",
    viewportAnchorIds: ["home-viewport", "rail-viewport"],
    strictViewportAnchorIds: ["rail-viewport"],
    kind: "cover",
  });

  expect(backend.show).toHaveBeenCalledTimes(0);
});

test("home cover art stays visible while horizontally clipped but fully inside the vertical viewport", async () => {
  const backend = {
    isAvailable: () => true,
    show: mock(async () => {}),
    update: mock(async () => {}),
    hide: mock(async () => {}),
    clearAll: mock(async () => {}),
  };

  const renderer = {
    width: 140,
    height: 40,
    idle: async () => {},
    root: {
      findDescendantById(id: string) {
        if (id === "row-cover") return { x: 64, y: 8, width: 20, height: 8 };
        if (id === "home-viewport") return { x: 0, y: 0, width: 140, height: 30 };
        if (id === "rail-viewport") return { x: 10, y: 5, width: 60, height: 20 };
        return undefined;
      },
    },
  };

  const manager = new InlineImageManager(renderer as any, "kitty", () => {});
  (manager as any).kittyBackend = backend;

  await manager.reconcileScope("home", {
    viewId: "home",
    itemId: "item-1",
    imageUrl: "https://example.com/cover.png",
    anchorId: "row-cover",
    viewportAnchorIds: ["home-viewport", "rail-viewport"],
    strictViewportAnchorIds: ["home-viewport"],
    kind: "cover",
  });

  expect(backend.show).toHaveBeenCalledTimes(1);
});

test("home cover art hides before leaking when vertically clipped by the home viewport", async () => {
  const backend = {
    isAvailable: () => true,
    show: mock(async () => {}),
    update: mock(async () => {}),
    hide: mock(async () => {}),
    clearAll: mock(async () => {}),
  };

  const renderer = {
    width: 140,
    height: 40,
    idle: async () => {},
    root: {
      findDescendantById(id: string) {
        if (id === "row-cover") return { x: 24, y: 24, width: 20, height: 8 };
        if (id === "home-viewport") return { x: 0, y: 0, width: 140, height: 30 };
        if (id === "rail-viewport") return { x: 10, y: 5, width: 100, height: 25 };
        return undefined;
      },
    },
  };

  const manager = new InlineImageManager(renderer as any, "kitty", () => {});
  (manager as any).kittyBackend = backend;

  await manager.reconcileScope("home", {
    viewId: "home",
    itemId: "item-1",
    imageUrl: "https://example.com/cover.png",
    anchorId: "row-cover",
    viewportAnchorIds: ["home-viewport", "rail-viewport"],
    strictViewportAnchorIds: ["home-viewport"],
    kind: "cover",
  });

  expect(backend.show).toHaveBeenCalledTimes(0);
});
