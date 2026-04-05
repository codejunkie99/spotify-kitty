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

test("search results stay compact instead of wrapping into oversized rows", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 80,
    height: 30,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  const ctx = createViewContext({ renderer });
  const view = new SearchView(ctx);

  Object.assign(view as any, {
    inputMode: false,
    loading: false,
    hasSearched: true,
    query: "made for you",
    results: [
      {
        id: "playlist-1",
        name: "An Extremely Long Playlist Name That Should Not Wrap Across Multiple Visual Rows In Search",
        subtitle: "A Surprisingly Long Owner Name That Also Needs To Stay On One Compact Row",
        imageUrl: "",
        kind: "playlist",
      },
    ],
  });

  renderer.root.add(view.render().content as any);
  await renderOnce();

  const row = renderer.root.findDescendantById("search-row-0") as any;
  expect(row).toBeTruthy();
  expect(row.height).toBeLessThanOrEqual(2);
});

test("search input renders the label and query without overlapping text nodes", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 80,
    height: 24,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  const ctx = createViewContext({ renderer });
  const view = new SearchView(ctx);

  renderer.root.add(view.render().content as any);
  await renderOnce();

  const content = renderer.root.getChildren()[0] as any;
  const inputRow = content.getChildren()[0] as any;
  expect(inputRow).toBeTruthy();
  expect(inputRow.getChildren().length).toBe(1);
});

test("typing from the results screen starts a fresh query", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 80,
    height: 24,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  const ctx = createViewContext({ renderer });
  const view = new SearchView(ctx);

  Object.assign(view as any, {
    inputMode: false,
    loading: false,
    hasSearched: true,
    query: "drake",
    results: [
      {
        id: "playlist-1",
        name: "Drake Mix",
        subtitle: "Playlist",
        imageUrl: "",
        kind: "playlist",
      },
    ],
  });

  const handled = await view.handleKey({ name: "x", sequence: "x" } as any);
  expect(handled).toBe(true);

  renderer.root.add(view.render().content as any);
  await renderOnce();

  const content = renderer.root.getChildren()[0] as any;
  const inputRow = content.getChildren()[0] as any;
  expect(inputRow.getChildren()?.[0]?.plainText).toContain("Search: x");
});

test("search input shows a submit hint once a query is typed", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 80,
    height: 24,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  const ctx = createViewContext({ renderer });
  const view = new SearchView(ctx);

  Object.assign(view as any, {
    inputMode: true,
    loading: false,
    hasSearched: false,
    query: "obscure query",
    results: [],
  });

  renderer.root.add(view.render().content as any);
  await renderOnce();

  const content = renderer.root.getChildren()[0] as any;
  const helperBox = content.getChildren()[1] as any;
  expect(helperBox).toBeTruthy();
  expect((helperBox.getChildren()?.[0] as any)?.plainText).toBe("Press Enter to search Spotify");
});

test("search shows quick matches while typing demo-friendly queries", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 80,
    height: 24,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  const ctx = createViewContext({ renderer });
  const view = new SearchView(ctx);

  Object.assign(view as any, {
    inputMode: true,
    loading: false,
    hasSearched: false,
    query: "stayin alive",
    results: [],
  });

  renderer.root.add(view.render().content as any);
  await renderOnce();

  const content = renderer.root.getChildren()[0] as any;
  const previewRow = renderer.root.findDescendantById("search-preview-row-0") as any;
  expect(previewRow).toBeTruthy();
  expect(previewRow.getChildren()?.[0]?.plainText).toContain("Stayin' Alive");

  const footerHint = content.getChildren().at(-1) as any;
  expect(footerHint.getChildren()?.[0]?.plainText).toBe("Press Enter for live Spotify results");
});

test("search shows quick matches for tame while typing", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 100,
    height: 28,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  const ctx = createViewContext({ renderer });
  const view = new SearchView(ctx);

  Object.assign(view as any, {
    inputMode: true,
    loading: false,
    hasSearched: false,
    query: "tame",
    results: [],
  });

  renderer.root.add(view.render().content as any);
  await renderOnce();

  const previewRow = renderer.root.findDescendantById("search-preview-row-0") as any;
  expect(previewRow).toBeTruthy();
  expect(previewRow.getChildren()?.[0]?.plainText).toContain("Tame Impala");
});

test("search submits on return as well as enter", async () => {
  const { renderer } = await createTestRenderer({
    width: 80,
    height: 24,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  const ctx = createViewContext({ renderer });
  const view = new SearchView(ctx);

  let searched = false;
  Object.assign(view as any, {
    query: "lights off",
    inputMode: true,
    doSearch: async () => {
      searched = true;
    },
  });

  const handled = await view.handleKey({ name: "return", sequence: "\r" } as any);
  expect(handled).toBe(true);
  expect(searched).toBe(true);
  expect((view as any).inputMode).toBe(false);
});

test("search submits on keypad enter from kitty keyboards", async () => {
  const { renderer } = await createTestRenderer({
    width: 80,
    height: 24,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  const ctx = createViewContext({ renderer });
  const view = new SearchView(ctx);

  let searched = false;
  Object.assign(view as any, {
    query: "stayin alive",
    inputMode: true,
    doSearch: async () => {
      searched = true;
    },
  });

  const handled = await view.handleKey({
    name: "kpenter",
    sequence: "\u001b[57414u",
    source: "kitty",
    code: "[57414u",
  } as any);

  expect(handled).toBe(true);
  expect(searched).toBe(true);
  expect((view as any).inputMode).toBe(false);
});

test("search keeps quick matches visible while live results are loading", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 100,
    height: 28,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  const ctx = createViewContext({ renderer });
  const view = new SearchView(ctx);

  Object.assign(view as any, {
    inputMode: false,
    loading: true,
    hasSearched: true,
    query: "stayin alive",
    results: [],
  });

  renderer.root.add(view.render().content as any);
  await renderOnce();

  const loadingLabel = renderer.root.findDescendantById("search-loading-label") as any;
  const previewRow = renderer.root.findDescendantById("search-preview-row-0") as any;
  expect(loadingLabel).toBeTruthy();
  expect((loadingLabel.getChildren()?.[0] as any)?.plainText).toBe("Searching Spotify...");
  expect(previewRow).toBeTruthy();
  expect((previewRow.getChildren()?.[0] as any)?.plainText).toContain("Stayin' Alive");
});

test("search keeps existing live results visible during refresh", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 100,
    height: 28,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  const ctx = createViewContext({ renderer });
  const view = new SearchView(ctx);

  Object.assign(view as any, {
    inputMode: false,
    loading: true,
    hasSearched: true,
    query: "lights off",
    results: [
      {
        id: "track-1",
        name: "Turn The Lights Off",
        subtitle: "Kato x Jon",
        imageUrl: "",
        kind: "track",
      },
    ],
  });

  renderer.root.add(view.render().content as any);
  await renderOnce();

  const loadingLabel = renderer.root.findDescendantById("search-loading-label") as any;
  const liveRow = renderer.root.findDescendantById("search-row-0") as any;
  expect(loadingLabel).toBeTruthy();
  expect(liveRow).toBeTruthy();
  expect((liveRow.getChildren()?.[0] as any)?.plainText).toContain("Turn The Lights Off");
});

test("pressing enter on a track result starts playback", async () => {
  const { renderer } = await createTestRenderer({
    width: 100,
    height: 28,
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
    query: "fire fire",
    selected: 0,
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

  const handled = await view.handleKey({ name: "return", sequence: "\r" } as any);
  expect(handled).toBe(true);
  expect(playTrackUris).toHaveBeenCalledWith(["spotify:track:35dt2bP4CcBzepyufQbvYZ"]);
});
