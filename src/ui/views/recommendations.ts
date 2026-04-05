import { Box, Text, ScrollBox } from "@opentui/core";
import type { KeyEvent } from "@opentui/core";
import type { ViewContext, SpotifyView, ViewDescriptor } from "./contracts.js";
import { isKey } from "./contracts.js";
import { getRecommendations } from "../../api/library.js";
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

interface RecTrack {
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

export class RecommendationsView implements SpotifyView {
  private tracks: RecTrack[] = [];
  private selected = 0;
  private loading = true;
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

  public constructor(
    private readonly ctx: ViewContext,
    private readonly seedTrackId: string,
    private readonly seedName: string,
  ) {}

  public async onEnter(): Promise<void> {
    this.ctx.setStatus(`Loading recommendations for "${this.seedName}"...`);
    try {
      const data = await getRecommendations(this.ctx.client, [this.seedTrackId]);
      this.tracks = data.tracks.map((t) => ({
        id: t.id,
        name: t.name,
        artists: t.artists.map((a) => a.name).join(", "),
        artistId: t.artists[0]?.id ?? "",
        album: t.album.name,
        albumId: t.album.id,
        albumName: t.album.name,
        duration: formatDuration(t.duration_ms),
        imageUrl: t.album.images[0]?.url ?? "",
        uri: `spotify:track:${t.id}`,
      }));
      await this.ctx.syncLikedTrackIds(this.tracks.map((track) => track.id));
      this.ctx.setStatus(`${this.tracks.length} recommendations`);
    } catch (e) {
      this.ctx.setStatus((e as Error).message);
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
    const hints = "↑↓ navigate  Enter play  / filter  z queue  l like  a artist  A album  Esc back";
    const content = Box({ width: "100%", height: "100%", flexDirection: "column", padding: 1 });

    const title = `Recommendations based on "${this.seedName}"`;

    if (this.loading) {
      content.add(Text({ content: "Loading...", color: theme.accent }) as any);
      return { title, hints, content };
    }

    const colHeader = Box({ width: "100%", flexDirection: "row", paddingLeft: 1, marginBottom: 1 });
    colHeader.add(Text({ content: "#", color: theme.textDim, width: 4 }) as any);
    colHeader.add(Text({ content: "", width: rowCoverWidth + 1 }) as any);
    colHeader.add(Text({ content: "Title", color: theme.textDim, flexGrow: 1 }) as any);
    colHeader.add(Text({ content: "Album", color: theme.textDim, width: 20 }) as any);
    colHeader.add(Text({ content: "Time", color: theme.textDim, width: 6 }) as any);
    content.add(colHeader as any);

    const scroll = ScrollBox({
      id: "rec-scroll",
      onMouseScroll: () => {
        this.scheduleInlineImageRefresh();
      },
      rootOptions: { backgroundColor: theme.background },
      contentOptions: { padding: 1 },
    });
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      const sel = i === this.selected;
      const liked = this.ctx.isLiked(t.id);
      const bg = sel ? theme.surfaceHover : "transparent";
      const row = Box({
        id: `rec-row-${i}`,
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
      row.add(Text({ content: `${liked ? "♥" : " "} ${i + 1}`, color: sel ? theme.accent : theme.textDim, width: 4 }) as any);
      const imageAnchorId = `rec-img-${t.id}`;
      row.add(Box({
        id: imageAnchorId,
        width: rowCoverWidth,
        height: rowCoverHeight,
        backgroundColor: theme.border,
        borderRadius: 2,
      }) as any);
      const titleCol = Box({ flexGrow: 1, flexDirection: "column" });
      titleCol.add(Text({ content: t.name, color: sel ? theme.accent : theme.text }) as any);
      titleCol.add(Text({ content: t.artists, color: theme.textDim }) as any);
      row.add(titleCol as any);
      row.add(Text({ content: truncateTerminalText(t.album, 18), color: theme.textDim, width: 20 }) as any);
      row.add(Text({ content: t.duration, color: theme.textDim, width: 6 }) as any);

      if (t.imageUrl) {
        this.pendingImages.push({
          viewId: `recommendations-${this.seedTrackId}`,
          itemId: t.id,
          imageUrl: t.imageUrl,
          anchorId: imageAnchorId,
          viewportAnchorIds: ["rec-scroll"],
          kind: "cover",
        });
      }

      scroll.add(row as any);
    }
    content.add(scroll as any);

    if (this.filter.active || this.filter.query) {
      content.add(renderFilterOverlay(this.filter.query, `${tracks.length} visible`) as any);
    }

    return { title, hints, content };
  }

  public async onDidRender(): Promise<void> {
    await this.reconcilePendingImages();
  }

  private async reconcilePendingImages(): Promise<void> {
    await this.ctx.inlineImageManager.reconcileScopeMany(`recommendations-${this.seedTrackId}`, this.pendingImages);
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
      const scroll = this.ctx.renderer.root.findDescendantById("rec-scroll") as any;
      scroll?.scrollChildIntoView?.(`rec-row-${this.selected}`);
      this.scheduleInlineImageRefresh();
    }, 0);
  }

  private visibleTracks(): RecTrack[] {
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
    if (isKey(key, "enter")) {
      const uris = tracks.slice(this.selected).map((t) => t.uri);
      if (uris.length) this.ctx.playTrackUris(uris);
      return true;
    }
    if (isKey(key, "z")) {
      const t = tracks[this.selected];
      if (t) await this.ctx.addToQueue(t.uri);
      return true;
    }
    if (isKey(key, "l")) {
      const t = tracks[this.selected];
      if (t) {
        if (this.ctx.isLiked(t.id)) await this.ctx.unlikeTrack(t.id);
        else await this.ctx.likeTrack(t.id);
      }
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
}
