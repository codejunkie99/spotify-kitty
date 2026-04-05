import { afterEach, expect, test } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { renderNowPlayingBar } from "./now-playing-bar.js";

const renderers: { destroy: () => void }[] = [];

afterEach(() => {
  while (renderers.length > 0) {
    renderers.pop()?.destroy();
  }
});

test("now playing bar exposes clickable transport controls", async () => {
  const { renderer, mockMouse, renderOnce } = await createTestRenderer({
    width: 120,
    height: 12,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  let playClicks = 0;
  renderer.root.add(renderNowPlayingBar({
    playState: {
      is_playing: true,
      item: {
        id: "track-1",
        name: "made for you",
        duration_ms: 181000,
        explicit: false,
        preview_url: null,
        track_number: 1,
        artists: [{ id: "artist-1", name: "Jessica Baio", external_urls: { spotify: "" } }],
        album: {
          id: "album-1",
          name: "made for you",
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
        volume_percent: 50,
      },
    },
    shuffleOn: false,
    repeatMode: "off",
    totalWidth: 120,
    onTogglePlayPause: () => {
      playClicks += 1;
    },
  }) as any);

  await renderOnce();

  const playButton = renderer.root.findDescendantById("np-play-button") as any;
  expect(playButton).toBeTruthy();

  const xCandidates = [...new Set([
    playButton.x,
    playButton.x + Math.max(0, Math.floor((playButton.width ?? 1) / 2)),
    playButton.x + Math.max(0, (playButton.width ?? 1) - 1),
  ])];
  const yCandidates = [...new Set([
    playButton.y,
    playButton.y + Math.max(0, Math.floor((playButton.height ?? 1) / 2)),
    playButton.y + Math.max(0, (playButton.height ?? 1) - 1),
  ])];

  for (const x of xCandidates) {
    for (const y of yCandidates) {
      if (playClicks > 0) break;
      await mockMouse.click(x, y);
    }
  }

  expect(playClicks).toBe(1);
});

test("now playing bar exposes a clickable fullscreen expand control", async () => {
  const { renderer, mockMouse, renderOnce } = await createTestRenderer({
    width: 120,
    height: 12,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  let expandClicks = 0;
  renderer.root.add(renderNowPlayingBar({
    playState: {
      is_playing: true,
      item: {
        id: "track-1",
        name: "made for you",
        duration_ms: 181000,
        explicit: false,
        preview_url: null,
        track_number: 1,
        artists: [{ id: "artist-1", name: "Jessica Baio", external_urls: { spotify: "" } }],
        album: {
          id: "album-1",
          name: "made for you",
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
        volume_percent: 50,
      },
    },
    shuffleOn: false,
    repeatMode: "off",
    totalWidth: 120,
    onExpandPlayer: () => {
      expandClicks += 1;
    },
  }) as any);

  await renderOnce();

  const expandButton = renderer.root.findDescendantById("np-expand-button") as any;
  expect(expandButton).toBeTruthy();
  expect(expandButton.getChildren?.()?.[0]?.plainText).toBe("⤢ Expand");

  await mockMouse.click(expandButton.x + 1, expandButton.y);
  expect(expandClicks).toBe(1);
});

test("now playing bar exposes clickable visualizer theme swatches", async () => {
  const { renderer, mockMouse, renderOnce } = await createTestRenderer({
    width: 120,
    height: 12,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  let selectedTheme = "";
  renderer.root.add(renderNowPlayingBar({
    playState: {
      is_playing: true,
      item: {
        id: "track-1",
        name: "Dracula",
        duration_ms: 181000,
        explicit: false,
        preview_url: null,
        track_number: 1,
        artists: [{ id: "artist-1", name: "Tame Impala", external_urls: { spotify: "" } }],
        album: {
          id: "album-1",
          name: "Dracula",
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
        name: "iPhone",
        is_active: true,
        volume_percent: 70,
      },
    },
    shuffleOn: false,
    repeatMode: "off",
    totalWidth: 120,
    onSetVisualizerTheme: (themeId) => {
      selectedTheme = themeId;
    },
  }) as any);

  await renderOnce();

  const violetSwatch = renderer.root.findDescendantById("np-palette-violet") as any;
  expect(violetSwatch).toBeTruthy();
  await mockMouse.click(violetSwatch.x, violetSwatch.y);
  expect(selectedTheme).toBe("violet");
});

test("now playing bar shows clear icon labels for transport states", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 120,
    height: 12,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  renderer.root.add(renderNowPlayingBar({
    playState: {
      is_playing: true,
      item: {
        id: "track-1",
        name: "made for you",
        duration_ms: 181000,
        explicit: false,
        preview_url: null,
        track_number: 1,
        artists: [{ id: "artist-1", name: "Jessica Baio", external_urls: { spotify: "" } }],
        album: {
          id: "album-1",
          name: "made for you",
          images: [],
          artists: [],
          release_date: "",
          total_tracks: 1,
          external_urls: { spotify: "" },
        },
        external_urls: { spotify: "" },
      },
      progress_ms: 12000,
      shuffle_state: true,
      repeat_state: "track",
      device: {
        id: "device-1",
        name: "MacBook",
        is_active: true,
        volume_percent: 50,
      },
    },
    shuffleOn: true,
    repeatMode: "track",
    totalWidth: 120,
  }) as any);

  await renderOnce();

  expect(renderer.root.findDescendantById("np-shuffle-button")?.getChildren?.()?.[0]?.plainText).toBe("⇄");
  expect(renderer.root.findDescendantById("np-prev-button")?.getChildren?.()?.[0]?.plainText).toBe("⏮");
  expect(renderer.root.findDescendantById("np-play-button")?.getChildren?.()?.[0]?.plainText).toBe("⏸ Pause");
  expect(renderer.root.findDescendantById("np-next-button")?.getChildren?.()?.[0]?.plainText).toBe("⏭");
  expect(renderer.root.findDescendantById("np-repeat-button")?.getChildren?.()?.[0]?.plainText).toBe("↻ 1");
});

test("now playing bar play button switches label when playback is paused", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 120,
    height: 12,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  renderer.root.add(renderNowPlayingBar({
    playState: {
      is_playing: false,
      item: {
        id: "track-1",
        name: "made for you",
        duration_ms: 181000,
        explicit: false,
        preview_url: null,
        track_number: 1,
        artists: [{ id: "artist-1", name: "Jessica Baio", external_urls: { spotify: "" } }],
        album: {
          id: "album-1",
          name: "made for you",
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
        volume_percent: 50,
      },
    },
    shuffleOn: false,
    repeatMode: "off",
    totalWidth: 120,
  }) as any);

  await renderOnce();

  expect(renderer.root.findDescendantById("np-play-button")?.getChildren?.()?.[0]?.plainText).toBe("▶ Play");
});

test("now playing bar places transport controls below the artwork row", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 120,
    height: 14,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  renderer.root.add(renderNowPlayingBar({
    playState: {
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
    },
    shuffleOn: false,
    repeatMode: "off",
    totalWidth: 120,
  }) as any);

  await renderOnce();

  const art = renderer.root.findDescendantById("np-art") as any;
  const play = renderer.root.findDescendantById("np-play-button") as any;
  expect(art).toBeTruthy();
  expect(play).toBeTruthy();
  expect(play.y).toBeGreaterThanOrEqual(art.y + art.height);
});

test("now playing bar nests the artwork anchor inside a larger shell", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 120,
    height: 16,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  renderer.root.add(renderNowPlayingBar({
    playState: {
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
    },
    shuffleOn: false,
    repeatMode: "off",
    totalWidth: 120,
  }) as any);

  await renderOnce();

  const shell = renderer.root.findDescendantById("np-art-shell") as any;
  const art = renderer.root.findDescendantById("np-art") as any;
  expect(shell).toBeTruthy();
  expect(art).toBeTruthy();
  expect(shell.width).toBeGreaterThan(art.width);
  expect(shell.height).toBeGreaterThan(art.height);
  expect(shell.width - art.width).toBeLessThanOrEqual(2);
  expect(shell.height - art.height).toBeLessThanOrEqual(2);
  expect(art.x).toBeGreaterThan(shell.x);
  expect(art.y).toBeGreaterThan(shell.y);
});

test("now playing bar gives live track rows more vertical breathing room", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 120,
    height: 16,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  renderer.root.add(renderNowPlayingBar({
    playState: {
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
    },
    shuffleOn: false,
    repeatMode: "off",
    totalWidth: 120,
  }) as any);

  await renderOnce();

  const bodyRow = renderer.root.findDescendantById("np-body-row") as any;
  expect(bodyRow).toBeTruthy();
  expect(bodyRow.height).toBeGreaterThanOrEqual(6);
});

test("now playing bar renders a visualizer strip while playing", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 120,
    height: 16,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  renderer.root.add(renderNowPlayingBar({
    playState: {
      is_playing: true,
      item: {
        id: "track-1",
        name: "Stayin Alive",
        duration_ms: 281000,
        explicit: false,
        preview_url: null,
        track_number: 1,
        artists: [{ id: "artist-1", name: "Bee Gees", external_urls: { spotify: "" } }],
        album: {
          id: "album-1",
          name: "Stayin Alive",
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
        name: "iPhone",
        is_active: true,
        volume_percent: 100,
      },
    },
    shuffleOn: false,
    repeatMode: "off",
    totalWidth: 120,
  }) as any);

  await renderOnce();

  const visualizer = renderer.root.findDescendantById("np-visualizer") as any;
  const progressRow = renderer.root.findDescendantById("np-progress-row") as any;
  const elapsed = renderer.root.findDescendantById("np-elapsed") as any;
  const remaining = renderer.root.findDescendantById("np-remaining") as any;
  const controlsRow = renderer.root.findDescendantById("np-controls-row") as any;
  expect(visualizer).toBeTruthy();
  expect(progressRow).toBeTruthy();
  expect(controlsRow).toBeTruthy();
  expect(elapsed?.plainText).toBeTruthy();
  expect(remaining?.plainText).toContain("-");
  expect(visualizer.plainText ?? "").toMatch(/[▁▂▃▄▅▆▇█]/);
  expect((visualizer.plainText ?? "").length).toBeGreaterThanOrEqual(18);
  expect(visualizer.y).toBe(progressRow.y);
  expect(controlsRow.y).toBeLessThan(progressRow.y);
});

test("now playing bar marks the selected visualizer palette in the footer", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 120,
    height: 16,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  renderer.root.add(renderNowPlayingBar({
    playState: {
      is_playing: true,
      item: {
        id: "track-1",
        name: "Dracula",
        duration_ms: 181000,
        explicit: false,
        preview_url: null,
        track_number: 1,
        artists: [{ id: "artist-1", name: "Tame Impala", external_urls: { spotify: "" } }],
        album: {
          id: "album-1",
          name: "Dracula",
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
        name: "iPhone",
        is_active: true,
        volume_percent: 100,
      },
    },
    shuffleOn: false,
    repeatMode: "off",
    totalWidth: 120,
    visualizerThemeId: "amber",
  }) as any);

  await renderOnce();

  const visualizer = renderer.root.findDescendantById("np-visualizer") as any;
  const amberSwatch = renderer.root.findDescendantById("np-palette-amber") as any;
  expect(visualizer).toBeTruthy();
  expect(amberSwatch).toBeTruthy();
  expect(amberSwatch.getChildren?.()?.[0]?.plainText).toBe(" ✓ ");
  expect(visualizer.fg?.buffer?.[0]).toBeCloseTo(0.9647058844566345, 3);
  expect(visualizer.fg?.buffer?.[1]).toBeCloseTo(0.7568627595901489, 3);
  expect(visualizer.fg?.buffer?.[2]).toBeCloseTo(0.46666666865348816, 3);
});

test("now playing bar uses a larger artwork anchor for demo mode emphasis", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 120,
    height: 16,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  renderer.root.add(renderNowPlayingBar({
    playState: {
      is_playing: true,
      item: {
        id: "track-1",
        name: "STAY (with Justin Bieber)",
        duration_ms: 141000,
        explicit: false,
        preview_url: null,
        track_number: 1,
        artists: [{ id: "artist-1", name: "The Kid LAROI", external_urls: { spotify: "" } }],
        album: {
          id: "album-1",
          name: "STAY",
          images: [],
          artists: [],
          release_date: "",
          total_tracks: 1,
          external_urls: { spotify: "" },
        },
        external_urls: { spotify: "" },
      },
      progress_ms: 23000,
      shuffle_state: false,
      repeat_state: "off",
      device: {
        id: "device-1",
        name: "MacBook",
        is_active: true,
        volume_percent: 80,
      },
    },
    shuffleOn: false,
    repeatMode: "off",
    totalWidth: 120,
  }) as any);

  await renderOnce();

  const shell = renderer.root.findDescendantById("np-art-shell") as any;
  const art = renderer.root.findDescendantById("np-art") as any;
  expect(shell).toBeTruthy();
  expect(art).toBeTruthy();
  expect(shell.width).toBeGreaterThanOrEqual(11);
  expect(shell.height).toBeGreaterThanOrEqual(6);
  expect(art.width).toBeGreaterThanOrEqual(8);
  expect(art.height).toBeGreaterThanOrEqual(4);
});

test("now playing bar softens the visualizer treatment when playback is paused", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 120,
    height: 16,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  const paused = renderNowPlayingBar({
    playState: {
      is_playing: false,
      item: {
        id: "track-1",
        name: "Stayin Alive",
        duration_ms: 281000,
        explicit: false,
        preview_url: null,
        track_number: 1,
        artists: [{ id: "artist-1", name: "Bee Gees", external_urls: { spotify: "" } }],
        album: {
          id: "album-1",
          name: "Stayin Alive",
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
        name: "iPhone",
        is_active: true,
        volume_percent: 100,
      },
    },
    shuffleOn: false,
    repeatMode: "off",
    totalWidth: 120,
  }) as any;
  renderer.root.add(paused);
  await renderOnce();
  const pausedText = (renderer.root.findDescendantById("np-visualizer") as any)?.plainText ?? "";

  expect(pausedText).not.toBe("");
  expect(pausedText).toMatch(/·/);
  expect(pausedText).not.toMatch(/[▁▂▃▄▅▆▇█]/);
});

test("now playing bar omits the device label from the footer chrome", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 140,
    height: 16,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  renderer.root.add(renderNowPlayingBar({
    playState: {
      is_playing: true,
      item: {
        id: "track-1",
        name: "Type Shit",
        duration_ms: 228000,
        explicit: false,
        preview_url: null,
        track_number: 1,
        artists: [{ id: "artist-1", name: "Future", external_urls: { spotify: "" } }],
        album: {
          id: "album-1",
          name: "WE DON'T TRUST YOU",
          images: [],
          artists: [],
          release_date: "",
          total_tracks: 1,
          external_urls: { spotify: "" },
        },
        external_urls: { spotify: "" },
      },
      progress_ms: 10000,
      shuffle_state: false,
      repeat_state: "off",
      device: {
        id: "device-1",
        name: "Avid’s MacBook Pro",
        is_active: true,
        volume_percent: 96,
      },
    },
    shuffleOn: false,
    repeatMode: "off",
    totalWidth: 140,
  }) as any);

  await renderOnce();

  expect(renderer.root.findDescendantById("np-meta-label")).toBeFalsy();
  expect(renderer.root.findDescendantById("np-volume-slider")).toBeTruthy();
});

test("now playing bar moves no-device status into the controls row when idle", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 180,
    height: 12,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  renderer.root.add(renderNowPlayingBar({
    playState: null,
    shuffleOn: false,
    repeatMode: "off",
    totalWidth: 180,
  }) as any);

  await renderOnce();

  expect(renderer.root.findDescendantById("np-meta-label")).toBeFalsy();
  const play = renderer.root.findDescendantById("np-play-button") as any;
  expect(play).toBeTruthy();
  expect(renderer.root.findDescendantById("np-device-status")).toBeFalsy();
});

test("now playing bar does not reserve artwork space when idle", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 180,
    height: 12,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  renderer.root.add(renderNowPlayingBar({
    playState: null,
    shuffleOn: false,
    repeatMode: "off",
    totalWidth: 180,
  }) as any);

  await renderOnce();

  expect(renderer.root.findDescendantById("np-art")).toBeFalsy();
});

test("now playing bar exposes a clickable volume slider", async () => {
  const { renderer, mockMouse, renderOnce } = await createTestRenderer({
    width: 120,
    height: 12,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  let nextVolume = -1;
  renderer.root.add(renderNowPlayingBar({
    playState: {
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
    },
    shuffleOn: false,
    repeatMode: "off",
    totalWidth: 120,
    onSetVolume: (value) => {
      nextVolume = value;
    },
  }) as any);

  await renderOnce();

  const slider = renderer.root.findDescendantById("np-volume-slider") as any;
  expect(slider).toBeTruthy();

  const targetX = slider.x + Math.max(1, slider.width - 2);
  const targetY = slider.y;
  await mockMouse.click(targetX, targetY);

  expect(nextVolume).toBeGreaterThan(70);
});

test("now playing bar keeps transport button widths stable across play states", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 120,
    height: 12,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  const playing = renderNowPlayingBar({
    playState: {
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
    },
    shuffleOn: false,
    repeatMode: "off",
    totalWidth: 120,
  }) as any;
  renderer.root.add(playing);
  await renderOnce();
  const playingWidth = (renderer.root.findDescendantById("np-play-button") as any)?.width;
  renderer.root.remove(playing.id);

  const paused = renderNowPlayingBar({
    playState: {
      is_playing: false,
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
    },
    shuffleOn: false,
    repeatMode: "off",
    totalWidth: 120,
  }) as any;
  renderer.root.add(paused);
  await renderOnce();
  const pausedWidth = (renderer.root.findDescendantById("np-play-button") as any)?.width;

  expect(playingWidth).toBe(pausedWidth);
  expect(playingWidth).toBe(20);
});

test("now playing bar increases transport hit targets for the demo layout", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 120,
    height: 12,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  renderer.root.add(renderNowPlayingBar({
    playState: {
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
    },
    shuffleOn: false,
    repeatMode: "off",
    totalWidth: 120,
  }) as any);
  await renderOnce();

  expect((renderer.root.findDescendantById("np-shuffle-button") as any)?.width).toBe(8);
  expect((renderer.root.findDescendantById("np-prev-button") as any)?.width).toBe(8);
  expect((renderer.root.findDescendantById("np-play-button") as any)?.width).toBe(20);
  expect((renderer.root.findDescendantById("np-next-button") as any)?.width).toBe(8);
  expect((renderer.root.findDescendantById("np-repeat-button") as any)?.width).toBe(10);
});
