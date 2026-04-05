import { afterEach, expect, mock, test } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { LikedSongsView } from "./liked-songs.js";
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

test("liked songs view reloads when pressing g", async () => {
  const { renderer } = await createTestRenderer({
    width: 120,
    height: 36,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  const ctx = createViewContext({ renderer });
  const view = new LikedSongsView(ctx);
  const reloadData = mock(async () => {});

  Object.assign(view as any, {
    loading: false,
    tracks: [],
    reloadData,
  });

  const handled = await view.handleKey({ name: "g", sequence: "g" } as any);

  expect(handled).toBe(true);
  expect(reloadData).toHaveBeenCalledTimes(1);
});
