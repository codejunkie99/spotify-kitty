import { afterEach, expect, mock, test } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { SearchView } from "./search.js";
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

test("clicking a search result activates it on the first click", async () => {
  const { renderer, mockMouse, renderOnce } = await createTestRenderer({
    width: 120,
    height: 36,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  const pushPlaylist = mock(() => {});
  const ctx = createViewContext({ renderer, pushPlaylist });
  const view = new SearchView(ctx);

  Object.assign(view as any, {
    inputMode: false,
    loading: false,
    hasSearched: true,
    selected: 0,
    query: "disco",
    results: [
      {
        id: "playlist-1",
        name: "Disco Essentials",
        subtitle: "OpenAI",
        imageUrl: "",
        kind: "playlist",
      },
      {
        id: "playlist-2",
        name: "Saturday Night Fever",
        subtitle: "OpenAI",
        imageUrl: "",
        kind: "playlist",
      },
    ],
  });

  renderer.root.add(view.render().content as any);
  await renderOnce();

  const row = renderer.root.findDescendantById("search-row-1") as any;
  await mockMouse.click(row.x + 1, row.y);

  expect((view as any).selected).toBe(1);
  expect(pushPlaylist).toHaveBeenCalledWith("playlist-2", "Saturday Night Fever");
});

test("clicking a track result starts playback on the first click", async () => {
  const { renderer, mockMouse, renderOnce } = await createTestRenderer({
    width: 120,
    height: 36,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  const playTrackUris = mock(() => {});
  const ctx = createViewContext({ renderer, playTrackUris });
  const view = new SearchView(ctx);

  Object.assign(view as any, {
    inputMode: false,
    loading: false,
    hasSearched: true,
    selected: 0,
    query: "fire fire",
    results: [
      {
        id: "35dt2bP4CcBzepyufQbvYZ",
        name: "Fire Fire",
        subtitle: "Shimza, AR/CO, Kasango",
        imageUrl: "",
        kind: "track",
      },
    ],
  });

  renderer.root.add(view.render().content as any);
  await renderOnce();

  const row = renderer.root.findDescendantById("search-row-0") as any;
  await mockMouse.click(row.x + 1, row.y);

  expect(playTrackUris).toHaveBeenCalledWith(["spotify:track:35dt2bP4CcBzepyufQbvYZ"]);
});
