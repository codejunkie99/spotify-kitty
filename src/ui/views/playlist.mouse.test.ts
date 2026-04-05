import { afterEach, expect, mock, test } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { PlaylistView } from "./playlist.js";
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

test("clicking a playlist row selects first and activates on second click", async () => {
  const { renderer, mockMouse, renderOnce } = await createTestRenderer({
    width: 120,
    height: 36,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  const playContext = mock(() => {});
  const requestRender = mock(() => {});
  const ctx = createViewContext({ renderer, playContext, requestRender });
  const view = new PlaylistView(ctx, "playlist-1", "Mix");

  Object.assign(view as any, {
    loading: false,
    tracks: [
      {
        id: "track-1",
        position: 0,
        name: "First Track",
        artists: "Artist One",
        artistId: "artist-1",
        album: "Album One",
        albumId: "album-1",
        albumName: "Album One",
        duration: "3:00",
        imageUrl: "",
        uri: "spotify:track:track-1",
      },
      {
        id: "track-2",
        position: 1,
        name: "Second Track",
        artists: "Artist Two",
        artistId: "artist-2",
        album: "Album Two",
        albumId: "album-2",
        albumName: "Album Two",
        duration: "4:00",
        imageUrl: "",
        uri: "spotify:track:track-2",
      },
    ],
  });

  renderer.root.add(view.render().content as any);
  await renderOnce();

  const row = renderer.root.findDescendantById("pl-row-1-track-2") as any;
  await mockMouse.click(row.x + 1, row.y + 1);
  expect((view as any).selected).toBe(1);
  expect(requestRender).toHaveBeenCalledTimes(1);
  expect(playContext).toHaveBeenCalledTimes(0);

  renderer.root.remove(renderer.root.getChildren()[0].id);
  renderer.root.add(view.render().content as any);
  await renderOnce();

  const sameRow = renderer.root.findDescendantById("pl-row-1-track-2") as any;
  await mockMouse.click(sameRow.x + 1, sameRow.y + 1);
  expect(playContext).toHaveBeenCalledWith("spotify:playlist:playlist-1", 1);
});
