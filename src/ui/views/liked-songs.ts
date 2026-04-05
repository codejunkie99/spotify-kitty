import { Box, Text, ScrollBox } from "@opentui/core";
import type { KeyEvent } from "@opentui/core";
import type { ViewContext, SpotifyView, ViewDescriptor } from "./contracts.js";
import { isKey } from "./contracts.js";
import { getLikedTracks } from "../../api/browse.js";
import { formatDuration } from "../../lib/format.js";
import { theme } from "../theme.js";
import { renderFilterOverlay } from "../components/filter-overlay.js";
import { truncateTerminalText } from "../lib/terminal-text.js";
import { getSquareCoverHeight } from "../media/cover-sizing.js";
import {
  applyFilterOverlayKey,
  filterItemsFromQuery,
  moveSelection,
  resolveClickSelection,
  type FilterOverlayState,
} from "./view-helpers.js";

const INLINE_IMAGE_REFRESH_DELAYS_MS = [0, 60, 160, 320] as const;

interface LikedTrack {
  id: string;
  name: string;
  artists: string;
  artistId: string;
  album: string;
  albumId: string;
  albumName: string;
  duration: string;
  imageUrl: string;
  uri: string;
}

export class LikedSongsView implements SpotifyView {
  private tracks: LikedTrack[] = [];
  private selected = 0;
  private loading = true;
  private total = 0;
  private readonly filter: FilterOverlayState = { active: false, query: "" };
  private pendingImages: {
    viewId: string;
    itemId: string;
    imageUrl: string;
    anchorId: string;
    viewportAnchorIds?: string[];
    kind: "cover";
  }[] = [];
  private inlineImageRefreshGeneration = 0;
  private inlineImageRefreshTimers: ReturnType<typeof setTimeout>[] = [];

  public constructor(private readonly ctx: ViewContext) {}

  public async onEnter(): Promise<void> {
    this.ctx.setStatus("Loading liked songs...");
    try {
      await this.reloadData();
    } catch (error) {
      this.ctx.setStatus(`Error: ${(error as Error).message}`);
    }
    this.loading = false;
  }

  public onExit(): void {
    this.clearInlineImageRefreshTimers();
  }

  public render(): ViewDescriptor {
    this.pendingImages = [];
    const tracks = this.visibleTracks();
    const rowCoverWidth = 4;
    const rowCoverHeight = getSquareCoverHeight(this.ctx.renderer, rowCoverWidth);
    const hints = "↑↓ navigate  Enter play  / filter  g reload  a artist  A album  Esc back";
    const content = Box({ width: "100%", height: "100%", flexDirection: "column", padding: 1 });

    if (this.loading) {
      content.add(Text({ content: "Loading...", color: theme.accent }) as any);
      return { title: "Liked Songs", hints, content };
    }

    const header = Box({ width: "100%", marginBottom: 1 });
    header.add(Text({
      content: this.filter.query
        ? `♥ Liked Songs — ${tracks.length} of ${this.total} songs`
        : `♥ Liked Songs — ${this.total} songs`,
      color: theme.accent,
      fontWeight: "bold",
    }) as any);
    content.add(header as any);

    // Column header
    const colHeader = Box({ width: "100%", flexDirection: "row", paddingLeft: 1 });
    colHeader.add(Text({ content: "#", color: theme.textDim, width: 4 }) as any);
    colHeader.add(Text({ content: "", width: rowCoverWidth + 1 }) as any);
    colHeader.add(Text({ content: "Title", color: theme.textDim, flexGrow: 1 }) as any);
    colHeader.add(Text({ content: "Album", color: theme.textDim, width: 20 }) as any);
    colHeader.add(Text({ content: "Time", color: theme.textDim, width: 6 }) as any);
    content.add(colHeader as any);

    const scroll = ScrollBox({
      id: "liked-scroll",
      onMouseScroll: () => {
        this.scheduleInlineImageRefresh();
      },
      rootOptions: { backgroundColor: theme.background },
      contentOptions: { padding: 1 },
    });
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      const sel = i === this.selected;
      const bg = sel ? theme.surfaceHover : "transparent";
      const row = Box({
        id: `liked-row-${i}`,
        width: "100%",
        backgroundColor: bg,
        flexDirection: "row",
        paddingLeft: 1,
        onMouseDown: (event: any) => {
          if (event.button !== 0) return;
          const click = resolveClickSelection(this.selected, i, tracks.length);
          this.selected = click.selected;
          this.scrollSelectedIntoView();
          if (click.activate) {
            const uris = tracks.slice(i).map((track) => track.uri);
            this.ctx.playTrackUris(uris);
          } else {
            this.ctx.requestRender();
          }
        },
      });
      row.add(Text({ content: `♥ ${i + 1}`, color: sel ? theme.accent : theme.textDim, width: 4 }) as any);
      const imageAnchorId = `liked-img-${t.id}`;
      row.add(Box({
        id: imageAnchorId,
        width: rowCoverWidth,
        height: rowCoverHeight,
        backgroundColor: theme.border,
        borderRadius: 2,
      }) as any);
      const titleCol = Box({ flexGrow: 1, flexDirection: "column" });
      titleCol.add(Text({ content: t.name, color: sel ? theme.accent : theme.text, fontSize: 1 }) as any);
      titleCol.add(Text({ content: t.artists, color: theme.textDim, fontSize: 1 }) as any);
      row.add(titleCol as any);
      row.add(Text({ content: truncateTerminalText(t.album, 18), color: theme.textDim, width: 20 }) as any);
      row.add(Text({ content: t.duration, color: theme.textDim, width: 6 }) as any);

      if (t.imageUrl) {
        this.pendingImages.push({
          viewId: "liked-songs",
          itemId: t.id,
          imageUrl: t.imageUrl,
          anchorId: imageAnchorId,
          viewportAnchorIds: ["liked-scroll"],
          kind: "cover",
        });
      }

      scroll.add(row as any);
    }
    content.add(scroll as any);

    if (this.filter.active || this.filter.query) {
      content.add(renderFilterOverlay(this.filter.query, `${tracks.length} visible`) as any);
    }

    return { title: "Liked Songs", hints, content };
  }

  public async onDidRender(): Promise<void> {
    await this.reconcilePendingImages();
  }

  private async reconcilePendingImages(): Promise<void> {
    await this.ctx.inlineImageManager.reconcileScopeMany("liked-songs", this.pendingImages);
  }

  private scheduleInlineImageRefresh(): void {
    this.inlineImageRefreshGeneration += 1;
    const generation = this.inlineImageRefreshGeneration;
    this.clearInlineImageRefreshTimers();

    for (const delayMs of INLINE_IMAGE_REFRESH_DELAYS_MS) {
      const timer = setTimeout(() => {
        void this.ctx.renderer.idle()
          .then(async () => {
            if (generation !== this.inlineImageRefreshGeneration) return;
            await this.reconcilePendingImages();
          })
          .catch(() => {});
      }, delayMs);
      this.inlineImageRefreshTimers.push(timer);
    }
  }

  private clearInlineImageRefreshTimers(): void {
    for (const timer of this.inlineImageRefreshTimers) {
      clearTimeout(timer);
    }
    this.inlineImageRefreshTimers = [];
  }

  private scrollSelectedIntoView(): void {
    setTimeout(() => {
      const scroll = this.ctx.renderer.root.findDescendantById("liked-scroll") as any;
      scroll?.scrollChildIntoView?.(`liked-row-${this.selected}`);
      this.scheduleInlineImageRefresh();
    }, 0);
  }

  private visibleTracks(): LikedTrack[] {
    return filterItemsFromQuery(
      this.tracks,
      this.filter.query,
      (track) => `${track.name} ${track.artists} ${track.album}`,
    );
  }

  public async handleKey(key: KeyEvent): Promise<boolean> {
    const filterResult = applyFilterOverlayKey(this.filter, key);
    if (filterResult.handled) {
      if (filterResult.changed) {
        this.selected = 0;
      }
      return true;
    }

    const tracks = this.visibleTracks();

    if (isKey(key, "down", "j")) {
      this.selected = moveSelection(this.selected, 1, tracks.length);
      this.scrollSelectedIntoView();
      return true;
    }
    if (isKey(key, "up", "k")) {
      this.selected = moveSelection(this.selected, -1, tracks.length);
      this.scrollSelectedIntoView();
      return true;
    }
    if (isKey(key, "g")) {
      this.ctx.setStatus("Refreshing liked songs...");
      await this.reloadData();
      return true;
    }
    if (isKey(key, "enter")) {
      const t = tracks[this.selected];
      if (t) {
        const uris = tracks.slice(this.selected).map((tr) => tr.uri);
        this.ctx.playTrackUris(uris);
      }
      return true;
    }
    if (isKey(key, "z")) {
      const t = tracks[this.selected];
      if (t) await this.ctx.addToQueue(t.uri);
      return true;
    }
    if (isKey(key, "r")) {
      const t = tracks[this.selected];
      if (t) this.ctx.pushRecommendations(t.id, t.name);
      return true;
    }
    if (isKey(key, "a")) {
      const t = tracks[this.selected];
      if (t?.artistId) this.ctx.pushArtist(t.artistId, t.artists.split(",")[0].trim());
      return true;
    }
    if (key.sequence === "A") {
      const t = tracks[this.selected];
      if (t?.albumId) this.ctx.pushAlbum(t.albumId, t.albumName);
      return true;
    }
    return false;
  }

  private async reloadData(): Promise<void> {
    const data = await getLikedTracks(this.ctx.client);
    this.total = data.total;
    this.tracks = data.items.map((i) => ({
      id: i.track.id,
      name: i.track.name,
      artists: i.track.artists.map((a) => a.name).join(", "),
      artistId: i.track.artists[0]?.id ?? "",
      album: i.track.album.name,
      albumId: i.track.album.id,
      albumName: i.track.album.name,
      duration: formatDuration(i.track.duration_ms),
      imageUrl: i.track.album.images[0]?.url ?? "",
      uri: `spotify:track:${i.track.id}`,
    }));
    this.selected = Math.max(0, Math.min(this.selected, Math.max(0, this.tracks.length - 1)));
    this.ctx.markLikedTrackIds(this.tracks.map((track) => track.id));
    this.ctx.setStatus(`${this.total} liked songs`);
  }
}
