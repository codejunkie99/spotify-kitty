import { Box, Text, CliRenderEvents, type CliRenderer, type KeyEvent } from "@opentui/core";
import type { SpotifyImageMode } from "../config.js";
import type { SpotifyUser, SpotifyPlayState } from "../types.js";
import type { SpotifyClient } from "../api/client.js";
import { renderHeaderBar } from "./components/header-bar.js";
import { renderLibrarySidebar, type SidebarItem } from "./components/library-sidebar.js";
import {
  getNowPlayingBarHeight,
  renderNowPlayingBar,
  type VisualizerThemeId,
} from "./components/now-playing-bar.js";
import { InlineImageManager } from "./media/inline-image-manager.js";
import { theme } from "./theme.js";
import { isKey, type SpotifyView, type ViewContext } from "./views/contracts.js";
import { moveSelection } from "./views/view-helpers.js";
import { HomeView } from "./views/home.js";
import { SearchView } from "./views/search.js";
import { PlaylistView } from "./views/playlist.js";
import { AlbumView } from "./views/album.js";
import { ArtistView } from "./views/artist.js";
import { LikedSongsView } from "./views/liked-songs.js";
import { QueueView } from "./views/queue.js";
import { DevicesView } from "./views/devices.js";
import { RecommendationsView } from "./views/recommendations.js";
import { PlayerView } from "./views/player.js";
import { AsyncQueue } from "../lib/async-queue.js";
import { chunk } from "../lib/pagination.js";
import {
  getPlayState, startPlayback, pausePlayback, playTrackUris,
  skipNext, skipPrevious, setVolume, setShuffle, setRepeat,
} from "../api/playback.js";
import { getUserPlaylists } from "../api/browse.js";
import { likeTrack, unlikeTrack, checkLiked, addToQueue } from "../api/library.js";

const NP_INTERVAL_MS = 3_000;
const SIDEBAR_WIDTH = 28;
const LIKED_TRACK_BATCH_SIZE = 50;

export class SpotifyApp {
  private readonly renderer: CliRenderer;
  private readonly client: SpotifyClient;
  private readonly me: SpotifyUser;
  private readonly views: SpotifyView[] = [];
  private statusMessage = "Ready";
  private renderCycle = 0;
  private playState: SpotifyPlayState | null = null;
  private playStateUpdatedAt = 0;
  private interpolatedProgressMs: number | undefined;
  private npInterval: ReturnType<typeof setInterval> | null = null;
  private progressTickInterval: ReturnType<typeof setInterval> | null = null;
  private kittySupported = false;
  private shuffleOn = false;
  private repeatMode: "off" | "track" | "context" = "off";
  private readonly likedIds = new Set<string>();
  private sidebarItems: SidebarItem[] = [];
  private sidebarSelected = 0;
  private sidebarFocused = false;
  private readonly keyQueue: AsyncQueue<KeyEvent>;
  private readonly keyHandler: (key: KeyEvent) => void;
  private readonly rendererRefreshHandler: () => void;
  private readonly viewContext: ViewContext;
  private visualizerThemeId: VisualizerThemeId = "emerald";
  private stopped = false;
  private rendering = false;
  private pendingRender = false;
  private pendingNowPlayingOnly = false;
  private pendingNowPlayingInterpolatedMs: number | undefined;

  public constructor(
    renderer: CliRenderer, client: SpotifyClient,
    me: SpotifyUser, imageMode: SpotifyImageMode,
  ) {
    this.renderer = renderer;
    this.client = client;
    this.me = me;

    const term = (process.env.TERM ?? "").toLowerCase();
    const termProgram = (process.env.TERM_PROGRAM ?? "").toLowerCase();
    this.kittySupported =
      !process.env.TMUX &&
      (term.includes("kitty") || Boolean(process.env.KITTY_WINDOW_ID) ||
        termProgram.includes("ghostty") || termProgram.includes("wezterm") ||
        termProgram.includes("warp"));

    const inlineImageManager = new InlineImageManager(
      this.renderer, this.kittySupported ? imageMode : "off",
      (msg) => { this.statusMessage = msg; },
    );

    this.viewContext = {
      renderer: this.renderer,
      inlineImageManager,
      client: this.client,
      me: this.me,
      setStatus: (msg) => { this.statusMessage = msg; },
      requestRender: () => { this.render(); },
      popView: () => { void this.popView(); },
      pushPlaylist: (id, name) => { void this.pushView(new PlaylistView(this.viewContext, id, name)); },
      pushAlbum: (id, name) => { void this.pushView(new AlbumView(this.viewContext, id, name)); },
      pushArtist: (id, name) => { void this.pushView(new ArtistView(this.viewContext, id, name)); },
      pushSearch: (initialQuery, types) => { void this.pushView(new SearchView(this.viewContext, initialQuery, types)); },
      pushLikedSongs: () => { void this.pushView(new LikedSongsView(this.viewContext)); },
      pushQueue: () => { void this.pushView(new QueueView(this.viewContext)); },
      pushRecommendations: (trackId, name) => { void this.pushView(new RecommendationsView(this.viewContext, trackId, name)); },
      pushDevices: () => { void this.pushView(new DevicesView(this.viewContext)); },
      playContext: (uri, offset) => { void this.playContext(uri, offset); },
      playTrackUris: (uris) => { void this.playUris(uris); },
      likeTrack: async (id) => { await likeTrack(this.client, id); this.likedIds.add(id); this.statusMessage = "Liked ♥"; return true; },
      unlikeTrack: async (id) => { await unlikeTrack(this.client, id); this.likedIds.delete(id); this.statusMessage = "Unliked"; },
      isLiked: (id) => this.likedIds.has(id),
      syncLikedTrackIds: async (ids) => { await this.syncLikedTrackIds(ids); },
      markLikedTrackIds: (ids) => { this.markLikedTrackIds(ids); },
      addToQueue: async (uri) => { await addToQueue(this.client, uri); this.statusMessage = "Added to queue"; },
    };

    this.keyQueue = new AsyncQueue<KeyEvent>(async (key) => {
      await this.processKeyPress(key);
    });
    this.keyHandler = (key: KeyEvent) => { this.keyQueue.enqueue(key); };
    this.rendererRefreshHandler = () => { this.render(); };
  }

  public async start(): Promise<void> {
    this.stopped = false;
    (this.renderer as any).disableStdoutInterception?.();
    (this.renderer as any).externalOutputMode = "passthrough";
    this.renderer.on(CliRenderEvents.RESIZE, this.rendererRefreshHandler);
    this.renderer.on(CliRenderEvents.CAPABILITIES, this.rendererRefreshHandler);
    await this.loadSidebar();
    await this.pushView(new HomeView(this.viewContext));
    this.renderer.keyInput.on("keypress", this.keyHandler);
    await this.refreshPlayState();
    this.npInterval = setInterval(() => { void this.refreshPlayState(); }, NP_INTERVAL_MS);
    this.progressTickInterval = setInterval(() => { this.tickProgress(); }, 1000);
  }

  public async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    this.pendingRender = false;
    this.rendering = false;
    this.renderer.keyInput.off("keypress", this.keyHandler);
    this.renderer.off(CliRenderEvents.RESIZE, this.rendererRefreshHandler);
    this.renderer.off(CliRenderEvents.CAPABILITIES, this.rendererRefreshHandler);
    if (this.npInterval) clearInterval(this.npInterval);
    if (this.progressTickInterval) clearInterval(this.progressTickInterval);
    await this.keyQueue.onIdle();
    for (const view of this.views) await view.onExit?.();
    this.views.length = 0;
    await this.viewContext.inlineImageManager.clearAll();
    this.clearRoot();
  }

  private async loadSidebar(): Promise<void> {
    try {
      const playlists = await getUserPlaylists(this.client);
      this.sidebarItems = [
        { id: "__home", name: "Home", kind: "home" as const },
        { id: "__liked", name: "Liked Songs", kind: "liked" as const },
        { id: "__queue", name: "Queue", kind: "queue" as const },
        { id: "__section_playlists", name: "PLAYLISTS", kind: "playlist" as const, section: true },
        ...playlists.items.slice(0, 20).map((p) => ({
          id: p.id,
          name: p.name,
          kind: "playlist" as const,
        })),
      ];
    } catch { /* ignore */ }
  }

  // -- Playback --

  private async refreshPlayState(): Promise<void> {
    if (this.stopped) return;
    try {
      const state = await getPlayState(this.client);
      if (this.stopped) return;
      const trackChanged = state.item?.id !== this.playState?.item?.id;
      this.playState = state;
      this.interpolatedProgressMs = undefined;
      this.playStateUpdatedAt = Date.now();
      this.shuffleOn = state.shuffle_state ?? false;
      this.repeatMode = state.repeat_state ?? "off";
      if (trackChanged) {
        this.render();
      } else {
        this.renderNowPlayingOnly();
      }
    } catch { /* ignore */ }
  }

  private tickProgress(): void {
    if (this.stopped) return;
    if (!this.playState?.is_playing || this.playState.progress_ms == null) return;
    const elapsed = Date.now() - this.playStateUpdatedAt;
    const interpolated = this.playState.progress_ms + elapsed;
    const duration = this.playState.item?.duration_ms ?? 0;
    const clamped = Math.min(interpolated, duration);
    this.renderNowPlayingOnly(clamped);
  }

  private renderNowPlayingOnly(interpolatedProgressMs?: number): void {
    if (this.stopped) return;
    this.interpolatedProgressMs = interpolatedProgressMs;
    if (this.rendering) {
      this.pendingNowPlayingOnly = true;
      this.pendingNowPlayingInterpolatedMs = interpolatedProgressMs;
      return;
    }

    const nowPlayingSlot = this.renderer.root.findDescendantById("now-playing-slot") as any;
    if (!nowPlayingSlot) {
      const shell = this.renderer.root.findDescendantById("spotify-shell") as any;
      if (!shell) return;
      this.render();
      return;
    }

    const nextHeight = getNowPlayingBarHeight(this.playState);
    nowPlayingSlot.height = nextHeight;
    nowPlayingSlot.minHeight = nextHeight;
    nowPlayingSlot.maxHeight = nextHeight;

    for (const child of [...nowPlayingSlot.getChildren()]) {
      nowPlayingSlot.remove(child.id);
    }
    nowPlayingSlot.add(this.createNowPlayingBar(interpolatedProgressMs) as any);

    void this.renderer.idle()
      .then(async () => {
        if (this.stopped) return;
        await this.renderNowPlayingImages();
      })
      .catch((error) => {
        this.statusMessage = `Error: ${(error as Error).message}`;
        this.pendingRender = true;
      });
  }

  private createNowPlayingBar(interpolatedProgressMs?: number): ReturnType<typeof Box> {
    return renderNowPlayingBar({
      playState: this.playState,
      shuffleOn: this.shuffleOn,
      repeatMode: this.repeatMode,
      visualizerThemeId: this.visualizerThemeId,
      interpolatedProgressMs: interpolatedProgressMs ?? this.interpolatedProgressMs,
      totalWidth: this.renderer.width,
      onToggleShuffle: () => { void this.toggleShuffle(); },
      onSkipPrevious: () => { void this.doSkipPrevious(); },
      onTogglePlayPause: () => { void this.togglePlayPause(); },
      onSkipNext: () => { void this.doSkipNext(); },
      onCycleRepeat: () => { void this.cycleRepeat(); },
      onSetVolume: (value) => { void this.setVolumePercent(value); },
      onExpandPlayer: () => { void this.toggleFullscreenPlayer(); },
      onSetVisualizerTheme: (themeId) => { this.setVisualizerTheme(themeId); },
    });
  }

  private setVisualizerTheme(themeId: VisualizerThemeId): void {
    if (this.visualizerThemeId === themeId) return;
    this.visualizerThemeId = themeId;
    if (this.currentView() instanceof PlayerView) {
      this.render();
      return;
    }
    this.renderNowPlayingOnly();
  }

  private async togglePlayPause(): Promise<void> {
    const wasPlaying = this.playState?.is_playing ?? false;
    if (this.playState) {
      this.playState.is_playing = !wasPlaying;
      this.renderNowPlayingOnly();
    }
    try {
      if (wasPlaying) await pausePlayback(this.client);
      else await startPlayback(this.client);
      await this.refreshPlayState();
    } catch (e) {
      if (this.playState) {
        this.playState.is_playing = wasPlaying;
        this.renderNowPlayingOnly();
      }
      this.statusMessage = (e as Error).message || "Playback error";
    }
  }

  private async doSkipNext(): Promise<void> {
    try { await skipNext(this.client); await this.refreshPlayState(); }
    catch (e) { this.statusMessage = (e as Error).message || "Playback error"; }
  }

  private async doSkipPrevious(): Promise<void> {
    try { await skipPrevious(this.client); await this.refreshPlayState(); }
    catch (e) { this.statusMessage = (e as Error).message || "Playback error"; }
  }

  private async toggleShuffle(): Promise<void> {
    const previous = this.shuffleOn;
    this.shuffleOn = !this.shuffleOn;
    if (this.playState) this.playState.shuffle_state = this.shuffleOn;
    this.renderNowPlayingOnly();
    try {
      await setShuffle(this.client, this.shuffleOn);
      this.statusMessage = `Shuffle ${this.shuffleOn ? "on" : "off"}`;
    } catch (e) {
      this.shuffleOn = previous;
      if (this.playState) this.playState.shuffle_state = previous;
      this.renderNowPlayingOnly();
      this.statusMessage = (e as Error).message || "Playback error";
    }
  }

  private async cycleRepeat(): Promise<void> {
    const previous = this.repeatMode;
    const next = this.repeatMode === "off" ? "context" : this.repeatMode === "context" ? "track" : "off";
    this.repeatMode = next;
    if (this.playState) this.playState.repeat_state = next;
    this.renderNowPlayingOnly();
    try {
      await setRepeat(this.client, next);
      this.statusMessage = `Repeat: ${next}`;
    } catch (e) {
      this.repeatMode = previous;
      if (this.playState) this.playState.repeat_state = previous;
      this.renderNowPlayingOnly();
      this.statusMessage = (e as Error).message || "Playback error";
    }
  }

  private async adjustVolume(delta: number): Promise<void> {
    const current = this.playState?.device?.volume_percent ?? 50;
    const next = Math.max(0, Math.min(100, current + delta));
    await this.setVolumePercent(next);
  }

  private async setVolumePercent(next: number): Promise<void> {
    const previous = this.playState?.device?.volume_percent ?? null;
    if (this.playState?.device) {
      this.playState.device.volume_percent = next;
      this.renderNowPlayingOnly();
    }
    try {
      await setVolume(this.client, next);
      this.statusMessage = `Volume: ${next}%`;
    } catch (e) {
      if (this.playState?.device && previous != null) {
        this.playState.device.volume_percent = previous;
        this.renderNowPlayingOnly();
      }
      this.statusMessage = (e as Error).message || "Playback error";
    }
  }

  private async playContext(uri: string, offset?: number): Promise<void> {
    try {
      await startPlayback(this.client, uri, offset);
      this.statusMessage = "Playing...";
      await this.refreshPlayState();
    } catch (e) { this.statusMessage = (e as Error).message || "Playback error"; }
  }

  private async playUris(uris: string[]): Promise<void> {
    try {
      await playTrackUris(this.client, uris);
      this.statusMessage = "Playing...";
      await this.refreshPlayState();
    } catch (e) { this.statusMessage = (e as Error).message || "Playback error"; }
  }

  // -- View stack --

  private async pushView(view: SpotifyView): Promise<void> {
    await this.viewContext.inlineImageManager.clearAll();
    this.views.push(view);
    await view.onEnter();
    this.sidebarFocused = false;
    this.render();
  }

  private async popView(): Promise<void> {
    if (this.views.length <= 1) { await this.stop(); this.renderer.destroy(); return; }
    const current = this.views.pop();
    await current?.onExit?.();
    await this.viewContext.inlineImageManager.clearAll();
    this.render();
  }

  private markLikedTrackIds(trackIds: readonly string[]): void {
    for (const trackId of new Set(trackIds.filter(Boolean))) {
      this.likedIds.add(trackId);
    }
  }

  private async syncLikedTrackIds(trackIds: readonly string[]): Promise<void> {
    const ids = [...new Set(trackIds.filter(Boolean))];
    for (const group of chunk(ids, LIKED_TRACK_BATCH_SIZE)) {
      const likedState = await checkLiked(this.client, group);
      for (let index = 0; index < group.length; index += 1) {
        const trackId = group[index];
        if (likedState[index]) this.likedIds.add(trackId);
        else this.likedIds.delete(trackId);
      }
    }
  }

  private currentView(): SpotifyView | undefined {
    return this.views[this.views.length - 1];
  }

  private async toggleFullscreenPlayer(): Promise<void> {
    if (this.currentView() instanceof PlayerView) {
      await this.popView();
      return;
    }
    await this.openFullscreenPlayer();
  }

  private async openFullscreenPlayer(): Promise<void> {
    if (this.currentView() instanceof PlayerView) return;
    await this.pushView(new PlayerView(this.viewContext, {
      getPlayState: () => this.playState,
      getShuffleOn: () => this.shuffleOn,
      getRepeatMode: () => this.repeatMode,
      getVisualizerThemeId: () => this.visualizerThemeId,
      toggleShuffle: () => { void this.toggleShuffle(); },
      skipPrevious: () => { void this.doSkipPrevious(); },
      togglePlayPause: () => { void this.togglePlayPause(); },
      skipNext: () => { void this.doSkipNext(); },
      cycleRepeat: () => { void this.cycleRepeat(); },
      setVolume: (value) => { void this.setVolumePercent(value); },
    }));
  }

  // -- Render --

  private render(): void {
    if (this.stopped) return;
    if (this.rendering) {
      this.pendingRender = true;
      return;
    }

    this.rendering = true;
    const view = this.currentView();
    if (!view) {
      this.rendering = false;
      return;
    }
    this.renderCycle += 1;
    const cycle = this.renderCycle;
    const descriptor = view.render();
    this.clearRoot();

    const shell = Box({
      id: "spotify-shell",
      width: "100%",
      height: "100%",
      flexDirection: "column",
      backgroundColor: theme.background,
    });

    // Top bar
    shell.add(renderHeaderBar(descriptor.title, {
      canGoBack: this.views.length > 1,
      onBackClick: () => { void this.popView(); },
    }) as any);

    if (descriptor.immersive) {
      const immersiveContent = Box({
        id: "shell-content",
        flexGrow: 1,
        minHeight: 0,
        backgroundColor: theme.background,
      });
      immersiveContent.add(descriptor.content as any);
      shell.add(immersiveContent as any);
      this.renderer.root.add(shell);

      void this.renderer.idle()
        .then(async () => {
          if (cycle !== this.renderCycle || this.currentView() !== view || this.stopped) return;
          await view.onDidRender?.();
          await this.renderNowPlayingImages();
        })
        .catch((error) => {
          this.statusMessage = `Error: ${(error as Error).message}`;
          this.pendingRender = true;
        })
        .finally(() => {
          this.rendering = false;
          if (this.pendingRender && !this.stopped) {
            this.pendingRender = false;
            this.render();
            return;
          }
          if (this.pendingNowPlayingOnly && !this.stopped) {
            const pendingInterpolatedProgressMs = this.pendingNowPlayingInterpolatedMs;
            this.pendingNowPlayingOnly = false;
            this.pendingNowPlayingInterpolatedMs = undefined;
            this.renderNowPlayingOnly(pendingInterpolatedProgressMs);
          }
        });
      return;
    }

    // Middle: sidebar + content
    const middle = Box({
      id: "middle",
      width: "100%",
      flexGrow: 1,
      minHeight: 0,
      flexDirection: "row",
      backgroundColor: theme.background,
    });

    middle.add(
      renderLibrarySidebar(
        this.sidebarItems,
        this.sidebarSelected,
        SIDEBAR_WIDTH,
        this.sidebarFocused,
        (index, item) => { void this.handleSidebarItemClick(index, item); },
      ) as any,
    );

    const content = Box({
      id: "shell-content",
      flexGrow: 1,
      minHeight: 0,
      backgroundColor: theme.background,
      paddingLeft: 1,
    });
    content.add(descriptor.content as any);
    middle.add(content as any);

    shell.add(middle as any);

    // Status bar (compact)
    const statusRow = Box({
      width: "100%", height: 1, backgroundColor: theme.surface,
      flexDirection: "row", paddingLeft: 1, paddingRight: 1,
    });
    statusRow.add(Text({ content: descriptor.hints, color: theme.textDim, fontSize: 1 }) as any);
    statusRow.add(Box({ flexGrow: 1 }) as any);
    statusRow.add(Text({ content: this.statusMessage, color: theme.accent, fontSize: 1 }) as any);
    shell.add(statusRow as any);

    const nowPlayingBar = this.createNowPlayingBar() as any;
    const nowPlayingSlot = Box({
      id: "now-playing-slot",
      width: "100%",
      height: getNowPlayingBarHeight(this.playState),
      backgroundColor: theme.surface,
      flexDirection: "column",
    });
    nowPlayingSlot.add(nowPlayingBar);
    shell.add(nowPlayingSlot as any);

    this.renderer.root.add(shell);

    void this.renderer.idle()
      .then(async () => {
        if (cycle !== this.renderCycle || this.currentView() !== view || this.stopped) return;
        await view.onDidRender?.();
        await this.renderNowPlayingImages();
      })
      .catch((error) => {
        this.statusMessage = `Error: ${(error as Error).message}`;
        this.pendingRender = true;
      })
      .finally(() => {
        this.rendering = false;
        if (this.pendingRender && !this.stopped) {
          this.pendingRender = false;
          this.render();
          return;
        }
        if (this.pendingNowPlayingOnly && !this.stopped) {
          const pendingInterpolatedProgressMs = this.pendingNowPlayingInterpolatedMs;
          this.pendingNowPlayingOnly = false;
          this.pendingNowPlayingInterpolatedMs = undefined;
          this.renderNowPlayingOnly(pendingInterpolatedProgressMs);
        }
      });
  }

  private async renderNowPlayingImages(): Promise<void> {
    if (this.stopped) return;
    const track = this.playState?.item;
    if (!track?.album.images[0]?.url || !this.kittySupported) {
      await this.viewContext.inlineImageManager.reconcileScope("now-playing", undefined);
      return;
    }
    await this.viewContext.inlineImageManager.reconcileScope("now-playing", {
      viewId: "now-playing", itemId: track.id,
      imageUrl: track.album.images[0].url, anchorId: "np-art", kind: "cover",
    });
  }

  private clearRoot(): void {
    for (const child of [...this.renderer.root.getChildren()]) this.renderer.root.remove(child.id);
  }

  // -- Keys --

  private async processKeyPress(key: KeyEvent): Promise<void> {
    try {
      // View gets first shot at handling keys (important for text input in search)
      const view = this.currentView();
      let handled = false;
      if (!this.sidebarFocused && view) {
        handled = await view.handleKey(key);
      } else if (this.sidebarFocused) {
        handled = await this.handleSidebarKey(key);
      }

      if (!handled) {
        handled = await this.handleGlobalKey(key);
      }

      if (handled) {
        this.render();
      }
    } catch (error) {
      this.statusMessage = `Error: ${(error as Error).message}`;
      this.render();
    }
  }

  private async handleGlobalKey(key: KeyEvent): Promise<boolean> {
    if (isKey(key, " ")) { await this.togglePlayPause(); return true; }
    if (isKey(key, "+", "=")) { await this.adjustVolume(10); return true; }
    if (isKey(key, "-")) { await this.adjustVolume(-10); return true; }
    if (isKey(key, "escape", "q")) { await this.popView(); return true; }
    if (key.name === "tab") { this.sidebarFocused = !this.sidebarFocused; return true; }
    // Letter keys only when not in a text-input view
    if (isKey(key, "n")) { await this.doSkipNext(); return true; }
    if (isKey(key, "p")) { await this.doSkipPrevious(); return true; }
    if (isKey(key, "f")) { await this.toggleShuffle(); return true; }
    if (isKey(key, "r")) { await this.cycleRepeat(); return true; }
    if (isKey(key, "x")) { await this.toggleFullscreenPlayer(); return true; }
    if (isKey(key, "s", "/")) { await this.pushView(new SearchView(this.viewContext)); return true; }
    if (isKey(key, "d")) { await this.pushView(new DevicesView(this.viewContext)); return true; }
    if (isKey(key, "z")) { await this.pushView(new QueueView(this.viewContext)); return true; }
    if (isKey(key, "h")) {
      while (this.views.length > 1) { const v = this.views.pop(); await v?.onExit?.(); }
      await this.viewContext.inlineImageManager.clearAll();
      return true;
    }
    if (isKey(key, "<")) { await this.seek(-5000); return true; }
    if (isKey(key, ">")) { await this.seek(5000); return true; }
    return false;
  }

  private async seek(deltaMs: number): Promise<void> {
    const pos = this.playState?.progress_ms ?? 0;
    const dur = this.playState?.item?.duration_ms ?? 0;
    const target = Math.max(0, Math.min(dur, pos + deltaMs));
    try {
      const { seekTo } = await import("../api/playback.js");
      await seekTo(this.client, target);
      if (this.playState) this.playState.progress_ms = target;
      this.statusMessage = deltaMs > 0 ? "Seek +5s" : "Seek -5s";
    } catch (e) { this.statusMessage = (e as Error).message; }
  }

  private async handleSidebarKey(key: KeyEvent): Promise<boolean> {
    if (isKey(key, "down", "j")) {
      this.sidebarSelected = moveSelection(this.sidebarSelected, 1, this.sidebarItems.length);
      this.scrollSidebarSelectionIntoView();
      return true;
    }
    if (isKey(key, "up", "k")) {
      this.sidebarSelected = moveSelection(this.sidebarSelected, -1, this.sidebarItems.length);
      this.scrollSidebarSelectionIntoView();
      return true;
    }
    if (isKey(key, "enter")) {
      const item = this.sidebarItems[this.sidebarSelected];
      if (!item || item.section) return true;
      await this.activateSidebarItem(item);
      return true;
    }
    return false;
  }

  private async handleSidebarItemClick(index: number, item: SidebarItem): Promise<void> {
    if (item.section) return;
    this.sidebarFocused = true;
    this.sidebarSelected = index;
    this.render();
    await this.activateSidebarItem(item);
  }

  private async activateSidebarItem(item: SidebarItem): Promise<void> {
    if (item.kind === "home") {
      while (this.views.length > 1) { const v = this.views.pop(); await v?.onExit?.(); }
      await this.viewContext.inlineImageManager.clearAll();
    } else if (item.kind === "liked") {
      this.viewContext.pushLikedSongs();
    } else if (item.kind === "queue") {
      this.viewContext.pushQueue();
    } else if (item.kind === "playlist") {
      this.viewContext.pushPlaylist(item.id, item.name);
    } else if (item.kind === "album") {
      this.viewContext.pushAlbum(item.id, item.name);
    }
  }

  private scrollSidebarSelectionIntoView(): void {
    const item = this.sidebarItems[this.sidebarSelected];
    if (!item) return;
    setTimeout(() => {
      const scroll = this.renderer.root.findDescendantById("library-sidebar-scroll") as any;
      scroll?.scrollChildIntoView?.(`sidebar-${item.id}`);
    }, 0);
  }
}
