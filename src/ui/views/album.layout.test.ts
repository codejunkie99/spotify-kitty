import { afterEach, expect, test } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { AlbumView } from "./album.js";
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

test("album does not render a pinned selected-track card", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 120,
    height: 40,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  const ctx = createViewContext({ renderer });
  const view = new AlbumView(ctx, "album-1", "Demo Album");
  Object.assign(view as any, {
    loading: false,
    name: "Demo Album",
    artists: "Demo Artist",
    imageUrl: "https://example.com/album-cover.png",
    releaseDate: "2026-04-04",
    tracks: [
      {
        id: "track-1",
        position: 0,
        name: "Demo Track",
        trackNumber: 1,
        artists: "Demo Artist",
        duration: "2:33",
        imageUrl: "https://example.com/album-cover.png",
        uri: "spotify:track:track-1",
      },
    ],
  });

  renderer.root.add(view.render().content as any);
  await renderOnce();

  const focusCard = renderer.root.findDescendantById("alb-focus-card") as any;
  expect(focusCard).toBeFalsy();
});
