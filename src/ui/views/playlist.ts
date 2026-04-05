import { Box, ScrollBox, Text } from "@opentui/core";
import type { KeyEvent } from "@opentui/core";
import type { ViewContext, SpotifyView, ViewDescriptor } from "./contracts.js";
import { isKey } from "./contracts.js";
import { getPlaylist } from "../../api/browse.js";
import { formatDuration } from "../../lib/format.js";
import { sanitizeSpotifyText } from "../../lib/html-text.js";
import { theme } from "../theme.js";
import { renderFilterOverlay } from "../components/filter-overlay.js";
import { truncateTerminalText } from "../lib/terminal-text.js";
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

interface TrackItem {
  id: string;
  position: number;
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

export class PlaylistView implements SpotifyView {
  private name = "";
  private description = "";
  private imageUrl = "";
  private tracks: TrackItem[] = [];
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
    private readonly playlistId: string,
    private readonly initialName: string,
  ) {
    this.name = initialName;
  }

  public async onEnter(): Promise<void> {
    this.ctx.setStatus(`Loading playlist: ${this.name}...`);
    try {
      const data = await getPlaylist(this.ctx.client, this.playlistId);
      this.name = sanitizeSpotifyText(data.name);
      this.description = sanitizeSpotifyText(data.description);
      this.imageUrl = data.images[0]?.url ?? "";
      this.tracks = data.tracks.items
        .filter((t) => t.track)
        .map((t, index) => ({
          id: t.track!.id,
          position: index,
          name: t.track!.name,
          artists: t.track!.artists.map((a) => a.name).join(", "),
          artistId: t.track!.artists[0]?.id ?? "",
          album: t.track!.album.name,
          albumId: t.track!.album.id,
          albumName: t.track!.album.name,
          duration: formatDuration(t.track!.duration_ms),
          imageUrl: t.track!.album.images[0]?.url ?? "",
          uri: `spotify:track:${t.track!.id}`,
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
    const headerCoverShellWidth = 12;
    const headerCoverWidth = Math.max(6, headerCoverShellWidth - 2);
    const headerCoverHeight = getSquareCoverHeight(this.ctx.renderer, headerCoverWidth);
    const headerCoverShellHeight = headerCoverHeight + 2;
    const rowCoverWidth = 6;
    const rowCoverHeight = getSquareCoverHeight(this.ctx.renderer, rowCoverWidth);
    const rowHeight = rowCoverHeight + 2;
    const rowTextWidth = Math.max(18, this.ctx.renderer.width - 56);
    const headerImageUrl =
      this.imageUrl ||
      this.tracks.find((track) => track.imageUrl)?.imageUrl ||
      tracks.find((track) => track.imageUrl)?.imageUrl ||
      "";
    const hints = "↑↓ navigate  Enter play  / filter  a artist  A album  Esc back";
    const content = Box({ width: "100%", height: "100%", flexDirection: "column", padding: 2 });

    if (this.loading) {
      content.add(Box({ flexGrow: 1, justifyContent: "center" },
        Text({ content: "Loading playlist...", color: theme.accent }) as any,
      ) as any);
      return { title: this.name || "Playlist", hints, content };
    }

    // Playlist header
    const header = Box({
      width: "100%",
      height: Math.max(headerCoverShellHeight + 2, 9),
      backgroundColor: theme.surface,
      borderRadius: 6,
      padding: 2,
      marginBottom: 2,
      flexDirection: "row",
      alignItems: "center",
    });
    const imgShellId = "playlist-cover-shell";
    const imgId = "playlist-cover";
    const imgArea = Box({
      id: imgShellId,
      width: headerCoverShellWidth,
      height: headerCoverShellHeight,
      backgroundColor: theme.border,
      borderRadius: 4,
      justifyContent: "center",
      alignItems: "center",
    });
    imgArea.add(Box({
      id: imgId,
      width: headerCoverWidth,
      height: headerCoverHeight,
      backgroundColor: theme.border,
      borderRadius: 3,
    }) as any);
    const infoBox = Box({ flexGrow: 1, flexDirection: "column", justifyContent: "center", paddingRight: 3 });
    infoBox.add(Text({ content: "PLAYLIST", color: theme.textDim, fontSize: 1 }) as any);
    infoBox.add(Text({ content: this.name, color: theme.text, fontWeight: "bold", fontSize: 2 }) as any);
    if (this.description) {
      infoBox.add(Text({
        content: truncateTerminalText(this.description, 72),
        color: theme.textSecondary,
        fontSize: 1,
      }) as any);
    }
    infoBox.add(Text({
      content: this.filter.query
        ? `${tracks.length} of ${this.tracks.length} tracks`
        : `${this.tracks.length} tracks`,
      color: theme.textDim,
      fontSize: 1,
    }) as any);
    header.add(infoBox as any);
    header.add(imgArea as any);
    content.add(header as any);

    if (headerImageUrl) {
      this.pendingImages.push({
        viewId: `playlist-${this.playlistId}`,
        itemId: `cover-${this.playlistId}`,
        imageUrl: headerImageUrl,
        anchorId: imgId,
        kind: "cover",
      });
    }

    // Tracks in ScrollBox
    const trackRows = tracks.map((t, i) => {
      const rowKey = `${t.position}-${t.id}`;
      const selected = i === this.selected;
      const bg = selected ? theme.surfaceHover : "transparent";
      const row = Box({
        id: `pl-row-${rowKey}`,
        width: "100%",
        height: rowHeight,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: bg,
        borderRadius: 4,
        paddingLeft: 1,
        paddingRight: 1,
        onMouseDown: (event: any) => {
          if (event.button !== 0) return;
          const click = resolveClickSelection(this.selected, i, tracks.length);
          this.selected = click.selected;
          this.scrollSelectedIntoView();
          if (click.activate) {
            const offset = getPlaybackOffset(t.position, this.tracks.length);
            if (offset !== undefined) {
              this.ctx.playContext(`spotify:playlist:${this.playlistId}`, offset);
            }
          } else {
            this.ctx.requestRender();
          }
        },
      });
      row.add(Text({
        content: `${this.ctx.isLiked(t.id) ? "♥" : " "} ${t.position + 1}`,
        color: selected ? theme.accent : theme.textDim,
        width: 5,
      }) as any);
      const textBox = Box({ flexGrow: 1, flexDirection: "column", justifyContent: "center" });
      textBox.add(Text({
        content: truncateTerminalText(t.name, rowTextWidth),
        color: selected ? theme.accent : theme.text,
        fontSize: 1,
      }) as any);
      textBox.add(Text({
        content: truncateTerminalText(t.artists, rowTextWidth),
        color: theme.textDim,
        fontSize: 1,
      }) as any);
      row.add(textBox as any);
      row.add(Text({ content: t.duration, color: theme.textDim, width: 6 }) as any);
      const imageAnchorId = `pl-img-${rowKey}`;
      const artBox = Box({
        id: imageAnchorId,
        width: rowCoverWidth,
        height: rowCoverHeight,
        backgroundColor: theme.border,
        borderRadius: 2,
        marginLeft: 1,
      });
      row.add(artBox as any);

      if (t.imageUrl) {
        this.pendingImages.push({
          viewId: `playlist-${this.playlistId}`,
          itemId: rowKey,
          imageUrl: t.imageUrl,
          anchorId: imageAnchorId,
          viewportAnchorIds: ["pl-scroll"],
          kind: "cover",
        });
      }

      return row;
    });

    content.add(ScrollBox(
      {
        id: "pl-scroll",
        width: "100%",
        flexGrow: 1,
        viewportCulling: true,
        onMouseScroll: () => {
          this.scheduleInlineImageRefresh();
        },
        rootOptions: { backgroundColor: theme.background },
        contentOptions: { padding: 1 },
      },
      ...trackRows,
    ) as any);

    if (this.filter.active || this.filter.query) {
      content.add(renderFilterOverlay(
        this.filter.query,
        `${tracks.length} visible`,
      ) as any);
    }

    return { title: this.name, hints, content };
  }

  public async onDidRender(): Promise<void> {
    await this.reconcilePendingImages();
  }

  private async reconcilePendingImages(): Promise<void> {
    await this.ctx.inlineImageManager.reconcileScopeMany(`playlist-${this.playlistId}`, this.pendingImages);
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
      const scroll = this.ctx.renderer.root.findDescendantById("pl-scroll") as any;
      scroll?.scrollChildIntoView?.(`pl-row-${t.position}-${t.id}`);
      this.scheduleInlineImageRefresh();
    }, 0);
  }

  private visibleTracks(): TrackItem[] {
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
      const offset = getPlaybackOffset(tracks[this.selected]?.position ?? 0, this.tracks.length);
      if (offset !== undefined) {
        this.ctx.playContext(`spotify:playlist:${this.playlistId}`, offset);
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
