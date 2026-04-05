import { afterEach, expect, test } from "bun:test";
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

test("playlist rows expose individual album art anchors", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 120,
    height: 36,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  const ctx = createViewContext({ renderer });
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
        imageUrl: "https://example.com/cover.png",
        uri: "spotify:track:track-1",
      },
    ],
  });

  renderer.root.add(view.render().content as any);
  await renderOnce();

  const imageAnchor = renderer.root.findDescendantById("pl-img-0-track-1") as any;
  expect(imageAnchor).toBeTruthy();
  expect(imageAnchor.width).toBeGreaterThan(0);
  expect(imageAnchor.height).toBeGreaterThan(0);
});

test("playlist rows keep duplicate track ids unique in the render tree", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 120,
    height: 36,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  const ctx = createViewContext({ renderer });
  const view = new PlaylistView(ctx, "playlist-1", "Mix");

  Object.assign(view as any, {
    loading: false,
    tracks: [
      {
        id: "track-1",
        position: 0,
        name: "First Copy",
        artists: "Artist One",
        artistId: "artist-1",
        album: "Album One",
        albumId: "album-1",
        albumName: "Album One",
        duration: "3:00",
        imageUrl: "https://example.com/cover-a.png",
        uri: "spotify:track:track-1",
      },
      {
        id: "track-1",
        position: 1,
        name: "Second Copy",
        artists: "Artist One",
        artistId: "artist-1",
        album: "Album One",
        albumId: "album-1",
        albumName: "Album One",
        duration: "3:05",
        imageUrl: "https://example.com/cover-b.png",
        uri: "spotify:track:track-1",
      },
    ],
  });

  renderer.root.add(view.render().content as any);
  await renderOnce();

  expect(renderer.root.findDescendantById("pl-img-0-track-1")).toBeTruthy();
  expect(renderer.root.findDescendantById("pl-img-1-track-1")).toBeTruthy();
  expect(renderer.root.findDescendantById("pl-row-0-track-1")).toBeTruthy();
  expect(renderer.root.findDescendantById("pl-row-1-track-1")).toBeTruthy();
});

test("playlist header falls back to the first track art when playlist art is missing", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 120,
    height: 36,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  let reconciled: any[] = [];
  const ctx = createViewContext({
    renderer,
    inlineImageManager: {
      clearAll: async () => {},
      reconcile: async () => {},
      reconcileMany: async () => {},
      reconcileScope: async () => {},
      reconcileScopeMany: async (_scope: string, desiredStates: any[]) => {
        reconciled = desiredStates;
      },
    } as any,
  });
  const view = new PlaylistView(ctx, "playlist-1", "Mix");

  Object.assign(view as any, {
    loading: false,
    imageUrl: "",
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
        imageUrl: "https://example.com/cover.png",
        uri: "spotify:track:track-1",
      },
    ],
  });

  renderer.root.add(view.render().content as any);
  await renderOnce();
  await view.onDidRender();

  expect(reconciled.some((state) =>
    state.anchorId === "playlist-cover" &&
    state.imageUrl === "https://example.com/cover.png",
  )).toBe(true);
});
