import { afterEach, expect, mock, test } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { HomeView } from "./home.js";
import type { ViewContext } from "./contracts.js";
import { SpotifyApp } from "../app.js";
import type { SpotifyPlayState, SpotifyUser } from "../../types.js";

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

function createUser(): SpotifyUser {
  return {
    id: "user-1",
    display_name: "Avid",
    email: "avid@example.com",
    images: [],
    country: "IN",
    product: "premium",
  };
}

function createPlayState(): SpotifyPlayState {
  return {
    is_playing: true,
    item: {
      id: "track-1",
      name: "HIGHS AND LOWS",
      duration_ms: 111000,
      explicit: false,
      preview_url: null,
      track_number: 1,
      artists: [{ id: "artist-1", name: "Kanye West", external_urls: { spotify: "" } }],
      album: {
        id: "album-1",
        name: "BULLY",
        images: [],
        artists: [],
        release_date: "",
        total_tracks: 1,
        external_urls: { spotify: "" },
      },
      external_urls: { spotify: "" },
    },
    progress_ms: 12000,
    shuffle_state: false,
    repeat_state: "off",
    device: {
      id: "device-1",
      name: "MacBook",
      is_active: true,
      volume_percent: 30,
    },
  };
}

test("home schedules more than one image refresh while scroll settles", async () => {
  const reconcileScopeMany = mock(async () => "kitty" as const);
  const ctx = createViewContext({
    renderer: {
      idle: async () => {},
    } as any,
    inlineImageManager: {
      clearAll: async () => {},
      reconcile: async () => "kitty" as const,
      reconcileMany: async () => "kitty" as const,
      reconcileScope: async () => "kitty" as const,
      reconcileScopeMany,
    } as any,
  });

  const view = new HomeView(ctx);
  Object.assign(view as any, {
    pendingImages: [
      {
        viewId: "home",
        itemId: "item-1",
        imageUrl: "https://example.com/cover.png",
        anchorId: "img-1",
        viewportAnchorIds: ["home-scroll"],
        kind: "cover",
      },
    ],
  });

  (view as any).scheduleInlineImageRefresh();
  await new Promise((resolve) => setTimeout(resolve, 350));

  expect(reconcileScopeMany.mock.calls.length).toBeGreaterThan(1);
});

test("home hides horizontal scrollbar chrome for row rails", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 120,
    height: 40,
    testing: true,
  });
  renderers.push(renderer);

  const ctx = createViewContext({
    renderer: {
      ...renderer,
      idle: async () => {},
    } as any,
  });

  const view = new HomeView(ctx);
  Object.assign(view as any, {
    loading: false,
    rows: [
      {
        title: "Recently Played",
        items: [
          {
            id: "track-1",
            name: "HIGHS AND LOWS",
            subtitle: "Kanye West, Ye",
            imageUrl: "https://example.com/cover.png",
            kind: "track",
            uri: "spotify:track:track-1",
          },
          {
            id: "track-2",
            name: "ALL THE LOVE",
            subtitle: "Kanye West, Ye",
            imageUrl: "https://example.com/cover-2.png",
            kind: "track",
            uri: "spotify:track:track-2",
          },
        ],
      },
    ],
  });

  const descriptor = view.render();
  renderer.root.add(descriptor.content as any);
  await renderOnce();
  await view.onDidRender();

  const rowScroll = renderer.root.findDescendantById("home-row-scroll-0") as any;
  expect(rowScroll).toBeTruthy();
  expect(rowScroll.horizontalScrollBar?.visible).toBe(false);
  expect(rowScroll.horizontalScrollBar?.slider?.visible).toBe(false);
  expect(rowScroll.horizontalScrollBar?.slider?.height).toBe(0);
  expect(rowScroll.wrapper?.getChildren?.().map((child: any) => child.id)).not.toContain(rowScroll.horizontalScrollBar?.id);
});

test("home row images are strict against the vertical home viewport and loose against their horizontal rail", () => {
  const ctx = createViewContext({
    renderer: {
      width: 120,
      height: 30,
    } as any,
  });

  const view = new HomeView(ctx);
  Object.assign(view as any, {
    loading: false,
    rows: [
      {
        title: "Recently Played",
        items: [
          {
            id: "track-1",
            name: "HIGHS AND LOWS",
            subtitle: "Kanye West, Ye",
            imageUrl: "https://example.com/cover.png",
            kind: "track",
            uri: "spotify:track:track-1",
          },
        ],
      },
    ],
  });

  view.render();

  expect((view as any).pendingImages).toContainEqual(expect.objectContaining({
    viewId: "home",
    itemId: "0-0-track-1",
    anchorId: "img-0-0-track-1",
    viewportAnchorIds: ["home-scroll", "home-row-scroll-0"],
    strictViewportAnchorIds: ["home-scroll"],
  }));
});

test("home cards keep both title and subtitle visible", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 120,
    height: 30,
    testing: true,
  });
  renderers.push(renderer);

  const ctx = createViewContext({
    renderer: {
      ...renderer,
      idle: async () => {},
    } as any,
  });

  const view = new HomeView(ctx);
  Object.assign(view as any, {
    loading: false,
    rows: [
      {
        title: "Recently Played",
        items: [
          {
            id: "track-1",
            name: "I Adore You (feat. Daecolm)",
            subtitle: "HUGEL, Topic, Arash feat. Daecolm",
            imageUrl: "https://example.com/cover.png",
            kind: "track",
            uri: "spotify:track:track-1",
          },
        ],
      },
    ],
  });

  const descriptor = view.render();
  renderer.root.add(descriptor.content as any);
  await renderOnce();

  const card = renderer.root.findDescendantById("card-0-0-track-1") as any;
  expect(card).toBeTruthy();
  expect(card.height).toBeGreaterThanOrEqual(8);

  const imageArea = renderer.root.findDescendantById("img-0-0-track-1") as any;
  expect(imageArea).toBeTruthy();
  expect(imageArea.height).toBeGreaterThanOrEqual(4);

  const textNodes = [renderer.root.findDescendantById("card-0-0-track-1")]
    .flatMap((node: any) => node?.getChildren?.() ?? [])
    .flatMap((node: any) => node?.getChildren?.() ?? [])
    .filter((node: any) => typeof node?.plainText === "string");

  expect(textNodes.map((node: any) => node.plainText)).toContain("I Adore You (fea…");
  expect(textNodes.map((node: any) => node.plainText)).toContain("HUGEL, Topic, Ar…");
});

test("home uses a compact shelf layout on shorter terminals so lower rows fit above the footer", () => {
  const ctx = createViewContext({
    renderer: {
      width: 120,
      height: 42,
    } as any,
  });

  const view = new HomeView(ctx);
  Object.assign(view as any, {
    loading: false,
    rows: [
      { title: "Recently Played", items: [] },
      { title: "Browse Categories", items: [] },
      { title: "New Releases", items: [] },
    ],
  });

  const metrics = (view as any).getLayoutMetrics();
  expect(metrics.rowHeight).toBeLessThan(17);
  expect(metrics.cardHeight).toBeLessThan(16);
  expect(metrics.contentPadding).toBe(0);
});

test("home keeps the new releases row fully inside the viewport across terminal heights", async () => {
  for (const height of [42, 70]) {
    const { renderer, renderOnce } = await createTestRenderer({
      width: 120,
      height,
      testing: true,
      useMouse: true,
    });
    renderers.push(renderer);

    const client = {
      put: async () => {},
      get: async () => createPlayState(),
    };

    const app = new SpotifyApp(renderer as any, client as any, createUser(), "off");
    (app as any).playState = createPlayState();

    const view = new HomeView((app as any).viewContext);
    Object.assign(view as any, {
      loading: false,
      rows: [
        {
          title: "Recently Played",
          items: Array.from({ length: 8 }, (_, index) => ({
            id: `recent-${index}`,
            name: `Track ${index}`,
            subtitle: "Artist",
            imageUrl: "",
            kind: "track",
            uri: `spotify:track:${index}`,
          })),
        },
        {
          title: "Browse Categories",
          items: Array.from({ length: 8 }, (_, index) => ({
            id: `cat-${index}`,
            name: `Category ${index}`,
            subtitle: "Open search",
            imageUrl: "",
            kind: "category",
          })),
        },
        {
          title: "New Releases",
          items: Array.from({ length: 8 }, (_, index) => ({
            id: `new-${index}`,
            name: `Album ${index}`,
            subtitle: "Artist",
            imageUrl: "",
            kind: "album",
          })),
        },
      ],
    });
    (app as any).views.push(view);

    (app as any).render();
    await renderOnce();

    const scroll = renderer.root.findDescendantById("home-scroll") as any;
    const lastRow = renderer.root.findDescendantById("home-row-2") as any;

    expect(scroll).toBeTruthy();
    expect(lastRow).toBeTruthy();
    expect(lastRow.y + lastRow.height).toBeLessThanOrEqual(scroll.y + scroll.height);
  }
});

test("home compact layout keeps cover art tall enough for demo-sized shells", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 120,
    height: 42,
    testing: true,
    useMouse: true,
  });
  renderers.push(renderer);

  const client = {
    put: async () => {},
    get: async () => createPlayState(),
  };

  const app = new SpotifyApp(renderer as any, client as any, createUser(), "off");
  (app as any).playState = createPlayState();

  const view = new HomeView((app as any).viewContext);
  Object.assign(view as any, {
    loading: false,
    rows: [
      {
        title: "Recently Played",
        items: [
          {
            id: "recent-0",
            name: "Track 0",
            subtitle: "Artist",
            imageUrl: "",
            kind: "track",
            uri: "spotify:track:0",
          },
        ],
      },
      { title: "Browse Categories", items: [] },
      { title: "New Releases", items: [] },
    ],
  });
  (app as any).views.push(view);

  (app as any).render();
  await renderOnce();

  const imageArea = renderer.root.findDescendantById("img-0-0-recent-0") as any;
  expect(imageArea).toBeTruthy();
  expect(imageArea.height).toBeGreaterThanOrEqual(4);
});

test("home preserves vertical and horizontal scroll positions across rerenders", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 120,
    height: 40,
    testing: true,
  });
  renderers.push(renderer);

  const ctx = createViewContext({
    renderer: {
      ...renderer,
      idle: async () => {},
    } as any,
  });

  const view = new HomeView(ctx);
  Object.assign(view as any, {
    loading: false,
    rows: [
      {
        title: "Recently Played",
        items: Array.from({ length: 10 }, (_, index) => ({
          id: `recent-${index}`,
          name: `Track ${index}`,
          subtitle: "Artist",
          imageUrl: "",
          kind: "track",
          uri: `spotify:track:${index}`,
        })),
      },
      {
        title: "Browse Categories",
        items: Array.from({ length: 10 }, (_, index) => ({
          id: `cat-${index}`,
          name: `Category ${index}`,
          subtitle: "Open search",
          imageUrl: "",
          kind: "category",
        })),
      },
      {
        title: "New Releases",
        items: Array.from({ length: 10 }, (_, index) => ({
          id: `new-${index}`,
          name: `Album ${index}`,
          subtitle: "Artist",
          imageUrl: "",
          kind: "album",
        })),
      },
    ],
  });

  let descriptor = view.render();
  renderer.root.add(descriptor.content as any);
  await renderOnce();

  const verticalBefore = renderer.root.findDescendantById("home-scroll") as any;
  const rowBefore = renderer.root.findDescendantById("home-row-scroll-0") as any;
  expect(verticalBefore).toBeTruthy();
  expect(rowBefore).toBeTruthy();

  verticalBefore.scrollTop = 7;
  rowBefore.scrollLeft = 9;

  renderer.root.remove(descriptor.content.id);
  descriptor = view.render();
  renderer.root.add(descriptor.content as any);
  await renderOnce();

  const verticalAfter = renderer.root.findDescendantById("home-scroll") as any;
  const rowAfter = renderer.root.findDescendantById("home-row-scroll-0") as any;
  expect(verticalAfter.scrollTop).toBeGreaterThanOrEqual(1);
  expect(verticalAfter.scrollTop).toBeLessThanOrEqual(7);
  expect(rowAfter.scrollLeft).toBe(9);
});
