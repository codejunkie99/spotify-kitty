import { Box, Text, ScrollBox } from "@opentui/core";
import type { KeyEvent } from "@opentui/core";
import type { ViewContext, SpotifyView, ViewDescriptor } from "./contracts.js";
import { isKey } from "./contracts.js";
import { getAlbum } from "../../api/browse.js";
import { formatDuration } from "../../lib/format.js";
import { theme } from "../theme.js";
import { renderFilterOverlay } from "../components/filter-overlay.js";
import { getSquareCoverHeight } from "../media/cover-sizing.js";
import {
  applyFilterOverlayKey,
  filterItemsFromQuery,
  getPlaybackOffset,
  moveSelection,
  resolveClickSelection,
  type FilterOverlayState,
} from "./view-helpers.js";

const INLINE_IMAGE_REFRESH_DELAYS_MS = [0, 60, 160, 320] as const;

interface AlbumTrack {
  id: string;
  position: number;
  name: string;
  trackNumber: number;
  artists: string;
  duration: string;
  imageUrl: string;
  uri: string;
}

export class AlbumView implements SpotifyView {
  private name = "";
  private artists = "";
  private imageUrl = "";
  private releaseDate = "";
  private tracks: AlbumTrack[] = [];
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
    private readonly albumId: string,
    private readonly initialName: string,
  ) {
    this.name = initialName;
  }

  public async onEnter(): Promise<void> {
    this.ctx.setStatus(`Loading album: ${this.name}...`);
    try {
      const data = await getAlbum(this.ctx.client, this.albumId);
      this.name = data.name;
      this.artists = data.artists.map((a) => a.name).join(", ");
      this.imageUrl = data.images[0]?.url ?? "";
      this.releaseDate = data.release_date;
      this.tracks = data.tracks.items.map((t, index) => ({
        id: t.id,
        position: index,
        name: t.name,
        trackNumber: t.track_number,
        artists: t.artists.map((a) => a.name).join(", "),
        duration: formatDuration(t.duration_ms),
        imageUrl: data.images[0]?.url ?? "",
        uri: `spotify:track:${t.id}`,
      }));
      await this.ctx.syncLikedTrackIds(this.tracks.map((track) => track.id));
      this.ctx.setStatus(`Loaded ${this.tracks.length} tracks`);
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
    const headerCoverWidth = 10;
    const headerCoverHeight = getSquareCoverHeight(this.ctx.renderer, headerCoverWidth);
    const rowCoverWidth = 4;
    const rowCoverHeight = getSquareCoverHeight(this.ctx.renderer, rowCoverWidth);
    const hints = "↑↓ navigate  Enter play  / filter  Esc back";
    const content = Box({ width: "100%", height: "100%", flexDirection: "column", padding: 2 });

    if (this.loading) {
      content.add(Box({ flexGrow: 1, justifyContent: "center" },
        Text({ content: "Loading album...", color: theme.accent }) as any,
      ) as any);
      return { title: this.name || "Album", hints, content };
    }

    // Album header
    const header = Box({
      width: "100%",
      backgroundColor: theme.surface,
      borderRadius: 6,
      padding: 2,
      marginBottom: 1,
      flexDirection: "row",
      alignItems: "flex-start",
    });
    const imgId = "album-cover";
    const imgArea = Box({
      id: imgId,
      width: headerCoverWidth,
      height: headerCoverHeight,
      backgroundColor: theme.border,
      borderRadius: 4,
    });
    header.add(imgArea as any);
    const infoBox = Box({ flexGrow: 1, flexDirection: "column", paddingLeft: 2 });
    infoBox.add(Text({ content: "ALBUM", color: theme.textDim, fontSize: 1 }) as any);
    infoBox.add(Text({ content: this.name, color: theme.text, fontWeight: "bold", fontSize: 2 }) as any);
    infoBox.add(Text({ content: this.artists, color: theme.textSecondary, fontSize: 1 }) as any);
    infoBox.add(Text({
      content: this.filter.query
        ? `${this.releaseDate}  •  ${tracks.length} of ${this.tracks.length} tracks`
        : `${this.releaseDate}  •  ${this.tracks.length} tracks`,
      color: theme.textDim,
      fontSize: 1,
    }) as any);
    header.add(infoBox as any);
    content.add(header as any);

    if (this.imageUrl) {
      this.pendingImages.push({
        viewId: `album-${this.albumId}`,
        itemId: `cover-${this.albumId}`,
        imageUrl: this.imageUrl,
        anchorId: imgId,
        kind: "cover",
      });
    }

    // Tracks
    const trackRows = tracks.map((t, index) => {
      const sel = index === this.selected;
      const bg = sel ? theme.surfaceHover : "transparent";
      const row = Box({
        id: `alb-row-${t.id}`,
        width: "100%",
        backgroundColor: bg,
        borderRadius: 4,
        padding: 1,
        onMouseDown: (event: any) => {
          if (event.button !== 0) return;
          const click = resolveClickSelection(this.selected, index, tracks.length);
          this.selected = click.selected;
          this.scrollSelectedIntoView();
          if (click.activate) {
            const offset = getPlaybackOffset(t.position, this.tracks.length);
            if (offset !== undefined) {
              this.ctx.playContext(`spotify:album:${this.albumId}`, offset);
            }
          } else {
            this.ctx.requestRender();
          }
        },
      });
      row.add(Text({
        content: `${this.ctx.isLiked(t.id) ? "♥" : " "} ${t.trackNumber}`,
        color: sel ? theme.accent : theme.textDim,
        width: 5,
      }) as any);
      const imageAnchorId = `alb-img-${t.id}`;
      row.add(Box({
        id: imageAnchorId,
        width: rowCoverWidth,
        height: rowCoverHeight,
        backgroundColor: theme.border,
        borderRadius: 2,
      }) as any);
      const textBox = Box({ flexGrow: 1, flexDirection: "column" });
      textBox.add(Text({ content: t.name, color: sel ? theme.accent : theme.text, fontSize: 1 }) as any);
      textBox.add(Text({ content: t.artists, color: theme.textDim, fontSize: 1 }) as any);
      row.add(textBox as any);
      row.add(Text({ content: t.duration, color: theme.textDim, width: 5 }) as any);

      if (t.imageUrl) {
        this.pendingImages.push({
          viewId: `album-${this.albumId}`,
          itemId: t.id,
          imageUrl: t.imageUrl,
          anchorId: imageAnchorId,
          viewportAnchorIds: ["alb-scroll"],
          kind: "cover",
        });
      }

      return row as any;
    });
    content.add(ScrollBox({
      id: "alb-scroll",
      width: "100%",
      flexGrow: 1,
      viewportCulling: true,
      onMouseScroll: () => {
        this.scheduleInlineImageRefresh();
      },
      rootOptions: { backgroundColor: "#121212" },
      contentOptions: { padding: 1 },
    }, ...trackRows) as any);

    if (this.filter.active || this.filter.query) {
      content.add(renderFilterOverlay(this.filter.query, `${tracks.length} visible`) as any);
    }

    return { title: this.name, hints, content };
  }

  public async onDidRender(): Promise<void> {
    await this.reconcilePendingImages();
  }

  private async reconcilePendingImages(): Promise<void> {
    await this.ctx.inlineImageManager.reconcileScopeMany(`album-${this.albumId}`, this.pendingImages);
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
    const t = this.visibleTracks()[this.selected];
    if (!t) return;
    setTimeout(() => {
      const scroll = this.ctx.renderer.root.findDescendantById("alb-scroll") as any;
      scroll?.scrollChildIntoView?.(`alb-row-${t.id}`);
      this.scheduleInlineImageRefresh();
    }, 0);
  }

  private visibleTracks(): AlbumTrack[] {
    return filterItemsFromQuery(
      this.tracks,
      this.filter.query,
      (track) => `${track.trackNumber} ${track.name} ${track.artists}`,
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
      const offset = getPlaybackOffset(tracks[this.selected]?.position ?? 0, this.tracks.length);
      if (offset !== undefined) {
        this.ctx.playContext(`spotify:album:${this.albumId}`, offset);
      }
      return true;
    }
    if (isKey(key, "z")) {
      const t = tracks[this.selected];
      if (t) await this.ctx.addToQueue(`spotify:track:${t.id}`);
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
    return false;
  }
}
