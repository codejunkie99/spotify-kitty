import { afterEach, expect, test } from "bun:test";
import { Box, ScrollBox } from "@opentui/core";
import { createTestRenderer } from "@opentui/core/testing";
import { SpotifyApp } from "./app.js";
import { getNowPlayingBarHeight } from "./components/now-playing-bar.js";
import type { SpotifyPlayState, SpotifyUser } from "../types.js";

const renderers: { destroy: () => void }[] = [];

afterEach(() => {
  while (renderers.length > 0) {
    renderers.pop()?.destroy();
  }
});

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

function createPlayState(overrides: Partial<SpotifyPlayState> = {}): SpotifyPlayState {
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
    ...overrides,
  };
}

test("footer-only rerenders keep the now playing bar inside a fixed-height slot", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 120,
    height: 24,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  const client = {
    put: async () => {},
    get: async () => createPlayState(),
  };

  const app = new SpotifyApp(renderer as any, client as any, createUser(), "off");
  (app as any).playState = createPlayState();
  (app as any).views.push({
    onEnter: () => {},
    handleKey: () => false,
    render: () => ({
      title: "Home",
      hints: "Esc back",
      content: Box({ id: "view-body", width: "100%", height: "100%" }),
    }),
  });

  (app as any).render();
  await renderOnce();

  const middleBefore = renderer.root.findDescendantById("middle") as any;
  const slotBefore = renderer.root.findDescendantById("now-playing-slot") as any;
  const barBefore = renderer.root.findDescendantById("now-playing-bar") as any;

  expect(slotBefore).toBeTruthy();
  expect(barBefore?.parent?.id).toBe("now-playing-slot");
  expect(slotBefore.height).toBe(getNowPlayingBarHeight(createPlayState()));
  expect(barBefore.height).toBe(getNowPlayingBarHeight(createPlayState()));

  (app as any).renderNowPlayingOnly(15000);
  await renderOnce();

  const middleAfter = renderer.root.findDescendantById("middle") as any;
  const slotAfter = renderer.root.findDescendantById("now-playing-slot") as any;
  const barAfter = renderer.root.findDescendantById("now-playing-bar") as any;

  expect(slotAfter).toBeTruthy();
  expect(slotAfter.height).toBe(slotBefore.height);
  expect(slotAfter.y).toBe(slotBefore.y);
  expect(middleAfter.height).toBe(middleBefore.height);
  expect(barAfter?.parent?.id).toBe("now-playing-slot");
  expect(barAfter.height).toBe(slotAfter.height);
  expect(slotAfter.getChildren().length).toBe(1);
});

test("footer-only rerenders do not rebuild the active view content", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 120,
    height: 24,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  const client = {
    put: async () => {},
    get: async () => createPlayState(),
  };

  let renderCount = 0;
  const app = new SpotifyApp(renderer as any, client as any, createUser(), "off");
  (app as any).playState = createPlayState();
  (app as any).views.push({
    onEnter: () => {},
    handleKey: () => false,
    render: () => {
      renderCount += 1;
      return {
        title: "Home",
        hints: "Esc back",
        content: Box({ id: "view-body", width: "100%", height: "100%" }),
      };
    },
  });

  (app as any).render();
  await renderOnce();

  const contentBefore = renderer.root.findDescendantById("shell-content") as any;
  const viewBodyBefore = renderer.root.findDescendantById("view-body") as any;

  expect(renderCount).toBe(1);
  expect(contentBefore).toBeTruthy();
  expect(viewBodyBefore).toBeTruthy();

  (app as any).renderNowPlayingOnly(15000);
  await renderOnce();

  const contentAfter = renderer.root.findDescendantById("shell-content") as any;
  const viewBodyAfter = renderer.root.findDescendantById("view-body") as any;

  expect(renderCount).toBe(1);
  expect(contentAfter).toBe(contentBefore);
  expect(viewBodyAfter).toBe(viewBodyBefore);
});

test("footer-only rerenders preserve scrollbox offsets in the active view", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 120,
    height: 24,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  const client = {
    put: async () => {},
    get: async () => createPlayState(),
  };

  const app = new SpotifyApp(renderer as any, client as any, createUser(), "off");
  (app as any).playState = createPlayState();
  (app as any).views.push({
    onEnter: () => {},
    handleKey: () => false,
    render: () => ({
      title: "Home",
      hints: "Esc back",
      content: Box(
        { id: "view-body", width: "100%", height: "100%", flexDirection: "column" },
        ScrollBox(
          {
            id: "home-scroll",
            width: "100%",
            height: 8,
            scrollY: true,
          },
          Box({ id: "home-row-0", width: "100%", height: 12 }),
        ),
        ScrollBox(
          {
            id: "home-row-scroll-0",
            width: 20,
            height: 4,
            scrollX: true,
            scrollY: false,
            contentOptions: { flexDirection: "row" },
          },
          Box({ id: "card-0", width: 30, height: 3 }),
          Box({ id: "card-1", width: 30, height: 3 }),
        ),
      ),
    }),
  });

  (app as any).render();
  await renderOnce();

  const verticalBefore = renderer.root.findDescendantById("home-scroll") as any;
  const horizontalBefore = renderer.root.findDescendantById("home-row-scroll-0") as any;

  verticalBefore.scrollTop = 4;
  horizontalBefore.scrollLeft = 9;

  (app as any).renderNowPlayingOnly(15000);
  await renderOnce();

  const verticalAfter = renderer.root.findDescendantById("home-scroll") as any;
  const horizontalAfter = renderer.root.findDescendantById("home-row-scroll-0") as any;

  expect(verticalAfter).toBe(verticalBefore);
  expect(horizontalAfter).toBe(horizontalBefore);
  expect(verticalAfter.scrollTop).toBe(4);
  expect(horizontalAfter.scrollLeft).toBe(9);
});

test("shell content stops above the footer player instead of running underneath it", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 120,
    height: 24,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  const client = {
    put: async () => {},
    get: async () => createPlayState(),
  };

  const app = new SpotifyApp(renderer as any, client as any, createUser(), "off");
  (app as any).playState = createPlayState();
  (app as any).views.push({
    onEnter: () => {},
    handleKey: () => false,
    render: () => ({
      title: "Search",
      hints: "Esc back",
      content: Box({ id: "view-body", width: "100%", height: "100%" }),
    }),
  });

  (app as any).render();
  await renderOnce();

  const middle = renderer.root.findDescendantById("middle") as any;
  const shellContent = renderer.root.findDescendantById("shell-content") as any;
  const statusRow = renderer.root.getChildren()[0]?.getChildren()?.find((child: any) => child.height === 1) as any;
  const footer = renderer.root.findDescendantById("now-playing-slot") as any;

  expect(middle).toBeTruthy();
  expect(shellContent).toBeTruthy();
  expect(footer).toBeTruthy();
  expect(shellContent.height).toBeLessThanOrEqual(middle.height);
  expect(middle.y + middle.height).toBeLessThanOrEqual(footer.y);
  expect(shellContent.y + shellContent.height).toBeLessThanOrEqual(footer.y);
  expect(statusRow.y + statusRow.height).toBeLessThanOrEqual(footer.y);
});
