import { afterEach, expect, mock, test } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { QueueView } from "./queue.js";
import type { ViewContext } from "./contracts.js";

const renderers: { destroy: () => void }[] = [];

afterEach(() => {
  while (renderers.length > 0) {
    renderers.pop()?.destroy();
  }
});

function createViewContext(overrides: Partial<ViewContext>): ViewContext {
  return {
    renderer: overrides.renderer!,
    inlineImageManager: {
      clearAll: async () => {},
      reconcile: async () => {},
      reconcileMany: async () => {},
      reconcileScope: async () => {},
      reconcileScopeMany: async () => {},
    } as any,
    client: {} as any,
    me: {} as any,
    setStatus: () => {},
    requestRender: () => {},
    popView: () => {},
    pushPlaylist: () => {},
    pushAlbum: () => {},
    pushArtist: () => {},
    pushSearch: () => {},
    pushLikedSongs: () => {},
    pushQueue: () => {},
    pushRecommendations: () => {},
    pushDevices: () => {},
    playContext: () => {},
    playTrackUris: () => {},
    likeTrack: async () => true,
    unlikeTrack: async () => {},
    isLiked: () => false,
    syncLikedTrackIds: async () => {},
    markLikedTrackIds: () => {},
    addToQueue: async () => {},
    ...overrides,
  };
}

test("queue rows keep duplicate track ids unique in the render tree", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 120,
    height: 36,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  const ctx = createViewContext({ renderer });
  const view = new QueueView(ctx);

  Object.assign(view as any, {
    loading: false,
    queue: [
      {
        rowKey: "0-track-1",
        id: "track-1",
        name: "First Copy",
        artists: "Artist One",
        duration: "3:00",
        imageUrl: "https://example.com/cover-a.png",
      },
      {
        rowKey: "1-track-1",
        id: "track-1",
        name: "Second Copy",
        artists: "Artist One",
        duration: "3:05",
        imageUrl: "https://example.com/cover-b.png",
      },
    ],
  });

  renderer.root.add(view.render().content as any);
  await renderOnce();

  expect(renderer.root.findDescendantById("queue-img-0-track-1")).toBeTruthy();
  expect(renderer.root.findDescendantById("queue-img-1-track-1")).toBeTruthy();
  expect(renderer.root.findDescendantById("queue-row-0-track-1")).toBeTruthy();
  expect(renderer.root.findDescendantById("queue-row-1-track-1")).toBeTruthy();
});

test("queue view reloads when pressing g", async () => {
  const { renderer } = await createTestRenderer({
    width: 120,
    height: 36,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  const ctx = createViewContext({ renderer });
  const view = new QueueView(ctx);
  const reloadData = mock(async () => {});

  Object.assign(view as any, {
    loading: false,
    queue: [],
    reloadData,
  });

  const handled = await view.handleKey({ name: "g", sequence: "g" } as any);

  expect(handled).toBe(true);
  expect(reloadData).toHaveBeenCalledTimes(1);
});
