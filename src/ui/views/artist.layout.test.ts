import { afterEach, expect, test } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { ArtistView } from "./artist.js";
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

test("artist header cover stays contained above the track list", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 140,
    height: 40,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  const ctx = createViewContext({ renderer });
  const view = new ArtistView(ctx, "artist-1", "Taylor Swift");
  Object.assign(view as any, {
    loading: false,
    name: "Taylor Swift",
    genres: ["Pop"],
    popularity: 97,
    imageUrl: "https://example.com/artist-cover.png",
    viewMode: "tracks",
    topTracks: [
      {
        id: "track-1",
        name: "Cruel Summer",
        album: "Lover",
        duration: "2:58",
        imageUrl: "https://example.com/track-cover.png",
        uri: "spotify:track:track-1",
      },
    ],
    albums: [],
  });

  renderer.root.add(view.render().content as any);
  await renderOnce();

  const header = renderer.root.findDescendantById("artist-image-shell")?.parent as any;
  const artistImage = renderer.root.findDescendantById("artist-image") as any;
  const scroll = renderer.root.findDescendantById("artist-scroll") as any;
  const firstRow = renderer.root.findDescendantById("artist-track-row-track-1") as any;
  const infoBox = header?.getChildren?.()?.[0] as any;

  expect(header).toBeTruthy();
  expect(artistImage).toBeTruthy();
  expect(scroll).toBeTruthy();
  expect(firstRow).toBeTruthy();
  expect(infoBox).toBeTruthy();
  expect(infoBox.x + infoBox.width - 1).toBeLessThanOrEqual(artistImage.x + artistImage.width);
  expect(artistImage.y + artistImage.height).toBeLessThanOrEqual(header.y + header.height);
  expect(firstRow.y).toBeGreaterThanOrEqual(header.y + header.height);
});
