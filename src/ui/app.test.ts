import { afterEach, expect, test } from "bun:test";
import { Box } from "@opentui/core";
import { createTestRenderer } from "@opentui/core/testing";
import { SpotifyApp } from "./app.js";
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

test("togglePlayPause updates footer state before the Spotify request completes", async () => {
  const { renderer } = await createTestRenderer({
    width: 120,
    height: 20,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  let resolvePut: (() => void) | null = null;
  const nextState = createPlayState({ is_playing: false });
  const client = {
    put: () => new Promise<void>((resolve) => { resolvePut = resolve; }),
    get: async () => nextState,
  };

  const app = new SpotifyApp(renderer as any, client as any, createUser(), "off");
  (app as any).playState = createPlayState({ is_playing: true });
  let rerenders = 0;
  (app as any).renderNowPlayingOnly = () => {
    rerenders += 1;
  };

  const pending = (app as any).togglePlayPause();

  expect((app as any).playState.is_playing).toBe(false);
  expect(rerenders).toBe(1);

  resolvePut?.();
  await pending;
});

test("footer control actions update local state immediately", async () => {
  const { renderer } = await createTestRenderer({
    width: 120,
    height: 20,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  let resolvePut: (() => void) | null = null;
  let lastPath = "";
  const nextState = createPlayState({ shuffle_state: true, repeat_state: "context", device: { id: "device-1", name: "MacBook", is_active: true, volume_percent: 70 } as any });
  const client = {
    put: (path: string) => {
      lastPath = path;
      return new Promise<void>((resolve) => { resolvePut = resolve; });
    },
    get: async () => nextState,
  };

  const app = new SpotifyApp(renderer as any, client as any, createUser(), "off");
  (app as any).playState = createPlayState({ shuffle_state: false, repeat_state: "off", device: { id: "device-1", name: "MacBook", is_active: true, volume_percent: 30 } });
  (app as any).shuffleOn = false;
  (app as any).repeatMode = "off";
  let rerenders = 0;
  (app as any).renderNowPlayingOnly = () => {
    rerenders += 1;
  };

  const shufflePending = (app as any).toggleShuffle();
  expect(lastPath).toBe("/me/player/shuffle");
  expect((app as any).shuffleOn).toBe(true);
  expect(rerenders).toBe(1);
  resolvePut?.();
  await shufflePending;

  const repeatPending = (app as any).cycleRepeat();
  expect(lastPath).toBe("/me/player/repeat");
  expect((app as any).repeatMode).toBe("context");
  expect(rerenders).toBe(2);
  resolvePut?.();
  await repeatPending;

  const volumePending = (app as any).setVolumePercent(70);
  expect(lastPath).toBe("/me/player/volume");
  expect((app as any).playState.device.volume_percent).toBe(70);
  expect(rerenders).toBe(3);
  resolvePut?.();
  await volumePending;
});

test("immersive views hide the shell sidebar and footer player", async () => {
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
      title: "Now Playing",
      hints: "Esc back",
      immersive: true,
      content: Box({ id: "immersive-view", width: "100%", height: "100%" }),
    }),
  });

  (app as any).render();
  await renderOnce();

  expect(renderer.root.findDescendantById("immersive-view")).toBeTruthy();
  expect(renderer.root.findDescendantById("library-sidebar")).toBeFalsy();
  expect(renderer.root.findDescendantById("now-playing-bar")).toBeFalsy();
});

test("loadSidebar caps playlist items to the first 20 entries", async () => {
  const { renderer } = await createTestRenderer({
    width: 120,
    height: 24,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  const playlists = Array.from({ length: 25 }, (_, index) => ({
    id: `playlist-${index + 1}`,
    name: `Playlist ${index + 1}`,
  }));

  const client = {
    get: async (_path: string, params?: Record<string, string>) => {
      const offset = Number(params?.offset ?? "0");
      const limit = Number(params?.limit ?? "50");
      return {
        items: playlists.slice(offset, offset + limit),
        total: playlists.length,
      };
    },
    put: async () => {},
  };

  const app = new SpotifyApp(renderer as any, client as any, createUser(), "off");
  await (app as any).loadSidebar();

  const sidebarItems = (app as any).sidebarItems;
  const playlistItems = sidebarItems.filter((item: any) => item.kind === "playlist" && !item.section);

  expect(playlistItems).toHaveLength(20);
  expect(playlistItems[0].id).toBe("playlist-1");
  expect(playlistItems[19].id).toBe("playlist-20");
});
