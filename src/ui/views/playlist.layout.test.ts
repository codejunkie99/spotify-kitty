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

test("playlist header lays out the cover and metadata side by side", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 120,
    height: 40,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  const ctx = createViewContext({ renderer });
  const view = new PlaylistView(ctx, "playlist-1", "Demo");
  Object.assign(view as any, {
    loading: false,
    name: "Don Toliver - OCTANE",
    description: "Demo description",
    imageUrl: "",
    tracks: [
      {
        id: "track-1",
        position: 0,
        name: "E85",
        artists: "Don Toliver",
        artistId: "artist-1",
        album: "OCTANE",
        albumId: "album-1",
        albumName: "OCTANE",
        duration: "2:33",
        imageUrl: "",
        uri: "spotify:track:track-1",
      },
    ],
  });

  renderer.root.add(view.render().content as any);
  await renderOnce();

  const content = renderer.root.getChildren()[0] as any;
  const header = content.getChildren()[0] as any;
  const cover = header.findDescendantById("playlist-cover") as any;
  const infoBox = header.getChildren()[0] as any;
  const firstRow = renderer.root.findDescendantById("pl-row-0-track-1") as any;

  expect(cover).toBeTruthy();
  expect(infoBox).toBeTruthy();
  expect(firstRow).toBeTruthy();
  expect(infoBox.x + infoBox.width - 1).toBeLessThanOrEqual(cover.x + cover.width);
  expect(infoBox.y).toBeLessThanOrEqual(cover.y + 1);
  expect(cover.y + cover.height).toBeLessThanOrEqual(header.y + header.height);
  expect(firstRow.y).toBeGreaterThanOrEqual(header.y + header.height);
});

test("playlist rows render text before the album cover", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 120,
    height: 40,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  const ctx = createViewContext({ renderer });
  const view = new PlaylistView(ctx, "playlist-1", "Demo");
  Object.assign(view as any, {
    loading: false,
    name: "Demo",
    description: "Desc",
    imageUrl: "",
    tracks: [
      {
        id: "track-1",
        position: 0,
        name: "E85",
        artists: "Don Toliver",
        artistId: "artist-1",
        album: "OCTANE",
        albumId: "album-1",
        albumName: "OCTANE",
        duration: "2:33",
        imageUrl: "https://example.com/cover.png",
        uri: "spotify:track:track-1",
      },
    ],
  });

  renderer.root.add(view.render().content as any);
  await renderOnce();

  const row = renderer.root.findDescendantById("pl-row-0-track-1") as any;
  const imageAnchor = renderer.root.findDescendantById("pl-img-0-track-1") as any;
  expect(row).toBeTruthy();
  expect(imageAnchor).toBeTruthy();
  expect(imageAnchor.x).toBeGreaterThan(row.x + 12);
});

test("playlist does not render a pinned selected-track card", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 120,
    height: 40,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  const ctx = createViewContext({ renderer });
  const view = new PlaylistView(ctx, "playlist-1", "Demo");
  Object.assign(view as any, {
    loading: false,
    name: "Demo",
    description: "Desc",
    imageUrl: "",
    tracks: [
      {
        id: "track-1",
        position: 0,
        name: "E85",
        artists: "Don Toliver",
        artistId: "artist-1",
        album: "OCTANE",
        albumId: "album-1",
        albumName: "OCTANE",
        duration: "2:33",
        imageUrl: "https://example.com/cover.png",
        uri: "spotify:track:track-1",
      },
    ],
  });

  renderer.root.add(view.render().content as any);
  await renderOnce();

  const focusCard = renderer.root.findDescendantById("pl-focus-card") as any;
  expect(focusCard).toBeFalsy();
});
