import { Box, ScrollBox, Text } from "@opentui/core";
import type { KeyEvent } from "@opentui/core";
import type { ViewContext, SpotifyView, ViewDescriptor } from "./contracts.js";
import { isKey } from "./contracts.js";
import { getArtist, getArtistTopTracks, getArtistAlbums } from "../../api/browse.js";
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

interface ArtistTrack {
  id: string;
  name: string;
  album: string;
  duration: string;
  imageUrl: string;
  uri: string;
}

interface ArtistAlbum {
  id: string;
  name: string;
  releaseDate: string;
  imageUrl: string;
}

export class ArtistView implements SpotifyView {
  private name = "";
  private genres: string[] = [];
  private popularity = 0;
  private imageUrl = "";
  private topTracks: ArtistTrack[] = [];
  private albums: ArtistAlbum[] = [];
  private selected = 0;
  private viewMode: "tracks" | "albums" = "tracks";
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
    private readonly artistId: string,
    private readonly initialName: string,
  ) {
    this.name = initialName;
  }

  public async onEnter(): Promise<void> {
    this.ctx.setStatus(`Loading artist: ${this.name}...`);
    try {
      const [artist, topTracks, albums] = await Promise.all([
        getArtist(this.ctx.client, this.artistId),
        getArtistTopTracks(this.ctx.client, this.artistId),
        getArtistAlbums(this.ctx.client, this.artistId),
      ]);
      this.name = artist.name;
      this.genres = artist.genres ?? [];
      this.popularity = artist.popularity ?? 0;
      this.imageUrl = artist.images?.[0]?.url ?? "";
      this.topTracks = topTracks.tracks.map((t) => ({
        id: t.id,
        name: t.name,
        album: t.album.name,
        duration: formatDuration(t.duration_ms),
        imageUrl: t.album.images[0]?.url ?? "",
        uri: `spotify:track:${t.id}`,
      }));
      await this.ctx.syncLikedTrackIds(this.topTracks.map((track) => track.id));
      this.albums = albums.items.map((a) => ({
        id: a.id,
        name: a.name,
        releaseDate: a.release_date,
        imageUrl: a.images[0]?.url ?? "",
      }));
      this.ctx.setStatus(`Loaded ${this.name}`);
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
    const albums = this.visibleAlbums();
    const itemsVisible = this.viewMode === "tracks" ? tracks.length : albums.length;
    const headerCoverShellWidth = 12;
    const headerCoverWidth = Math.max(6, headerCoverShellWidth - 2);
    const headerCoverHeight = getSquareCoverHeight(this.ctx.renderer, headerCoverWidth);
    const headerCoverShellHeight = headerCoverHeight + 2;
    const rowCoverWidth = 4;
    const rowCoverHeight = getSquareCoverHeight(this.ctx.renderer, rowCoverWidth);
    const cardCoverWidth = 16;
    const cardCoverHeight = getSquareCoverHeight(this.ctx.renderer, cardCoverWidth);
    const hints = "↑↓ navigate  Enter select  / filter  t toggle tracks/albums  Esc back";
    const content = Box({ width: "100%", height: "100%", flexDirection: "column", padding: 2 });

    if (this.loading) {
      content.add(Box({ flexGrow: 1, justifyContent: "center" },
        Text({ content: "Loading artist...", color: theme.accent }) as any,
      ) as any);
      return { title: this.name || "Artist", hints, content };
    }

    // Artist header
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
    const imgShellId = "artist-image-shell";
    const imgId = "artist-image";
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
    infoBox.add(Text({ content: "ARTIST", color: theme.textDim, fontSize: 1 }) as any);
    infoBox.add(Text({ content: this.name, color: theme.text, fontWeight: "bold", fontSize: 2 }) as any);
    if (this.genres.length > 0) {
      infoBox.add(Text({ content: this.genres.slice(0, 3).join(", "), color: theme.textSecondary, fontSize: 1 }) as any);
    }
    infoBox.add(Text({ content: `Popularity: ${this.popularity}/100`, color: theme.textDim, fontSize: 1 }) as any);
    header.add(infoBox as any);
    header.add(imgArea as any);
    content.add(header as any);

    if (this.imageUrl) {
      this.pendingImages.push({
        viewId: `artist-${this.artistId}`,
        itemId: `cover-${this.artistId}`,
        imageUrl: this.imageUrl,
        anchorId: imgId,
        kind: "cover",
      });
    }

    // Toggle
    const modeText = this.viewMode === "tracks" ? "Top Tracks" : "Albums";
    const modeBg = theme.surfaceHover;
    const modeRow = Box({ width: "100%", backgroundColor: modeBg, borderRadius: 4, padding: 1, marginBottom: 1 });
    modeRow.add(Text({
      content: this.filter.query
        ? `[t] ${modeText} · ${itemsVisible} visible`
        : `[t] ${modeText}`,
      color: theme.accent,
    }) as any);
    content.add(modeRow as any);

    if (this.viewMode === "tracks") {
      const rows = tracks.map((t, i) => {
        const sel = i === this.selected;
        const bg = sel ? theme.surfaceHover : "transparent";
        const row = Box({
          id: `artist-track-row-${t.id}`,
          width: "100%",
          backgroundColor: bg,
          borderRadius: 4,
          padding: 1,
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
        row.add(Text({
          content: `${this.ctx.isLiked(t.id) ? "♥" : " "} ${i + 1}`,
          color: sel ? theme.accent : theme.textDim,
          width: 5,
        }) as any);
        const imgA = Box({
          id: `art-img-${t.id}`,
          width: rowCoverWidth,
          height: rowCoverHeight,
          backgroundColor: theme.border,
          borderRadius: 2,
        });
        row.add(imgA as any);
        const textBox = Box({ flexGrow: 1, flexDirection: "column" });
        textBox.add(Text({ content: t.name, color: sel ? theme.accent : theme.text, fontSize: 1 }) as any);
        textBox.add(Text({ content: truncateTerminalText(t.album, 36), color: theme.textDim, fontSize: 1 }) as any);
        row.add(textBox as any);
        row.add(Text({ content: t.duration, color: theme.textDim, width: 5 }) as any);

        if (t.imageUrl) {
          this.pendingImages.push({
            viewId: `artist-${this.artistId}`,
            itemId: t.id,
            imageUrl: t.imageUrl,
            anchorId: `art-img-${t.id}`,
            viewportAnchorIds: ["artist-scroll"],
            kind: "cover",
          });
        }
        return row;
      });

      content.add(ScrollBox({
        id: "artist-scroll",
        width: "100%",
        flexGrow: 1,
        viewportCulling: true,
        onMouseScroll: () => {
          this.scheduleInlineImageRefresh();
        },
        rootOptions: { backgroundColor: theme.background },
        contentOptions: { padding: 1 },
      }, ...rows) as any);
    } else {
      const grid = Box({ width: "100%", flexDirection: "row", flexWrap: "wrap", gap: 1 });
      for (let i = 0; i < albums.length; i++) {
        const a = albums[i];
        const sel = i === this.selected;
        const card = Box({
          id: `artist-album-card-${a.id}`,
          width: 18,
          backgroundColor: sel ? theme.surfaceHover : theme.surface,
          borderRadius: 4,
          padding: 1,
          onMouseDown: (event: any) => {
            if (event.button !== 0) return;
            this.selected = i;
            this.ctx.pushAlbum(a.id, a.name);
          },
        });
        const imgA = Box({
          id: `alb-img-${a.id}`,
          width: cardCoverWidth,
          height: cardCoverHeight,
          backgroundColor: theme.border,
          borderRadius: 4,
        });
        card.add(imgA as any);
        const textBox = Box({ width: "100%", flexDirection: "column" });
        textBox.add(Text({ content: truncateTerminalText(a.name, 16), color: sel ? theme.accent : theme.text, fontSize: 1 }) as any);
        textBox.add(Text({ content: a.releaseDate, color: theme.textDim, fontSize: 1 }) as any);
        card.add(textBox as any);
        grid.add(card as any);

        if (a.imageUrl) {
          this.pendingImages.push({
            viewId: `artist-${this.artistId}`,
            itemId: a.id,
            imageUrl: a.imageUrl,
            anchorId: `alb-img-${a.id}`,
            viewportAnchorIds: ["artist-scroll"],
            kind: "cover",
          });
        }
      }
      content.add(ScrollBox({
        id: "artist-scroll",
        width: "100%",
        flexGrow: 1,
        viewportCulling: true,
        onMouseScroll: () => {
          this.scheduleInlineImageRefresh();
        },
        rootOptions: { backgroundColor: theme.background },
        contentOptions: { padding: 1 },
      }, grid) as any);
    }

    if (this.filter.active || this.filter.query) {
      content.add(renderFilterOverlay(this.filter.query, `${itemsVisible} visible`) as any);
    }

    return { title: this.name, hints, content };
  }

  public async onDidRender(): Promise<void> {
    await this.reconcilePendingImages();
  }

  private async reconcilePendingImages(): Promise<void> {
    await this.ctx.inlineImageManager.reconcileScopeMany(`artist-${this.artistId}`, this.pendingImages);
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

  private visibleTracks(): ArtistTrack[] {
    return filterItemsFromQuery(
      this.topTracks,
      this.filter.query,
      (track) => `${track.name} ${track.album}`,
    );
  }

  private visibleAlbums(): ArtistAlbum[] {
    return filterItemsFromQuery(
      this.albums,
      this.filter.query,
      (album) => `${album.name} ${album.releaseDate}`,
    );
  }

  private scrollSelectedIntoView(): void {
    const itemId = this.viewMode === "tracks"
      ? this.visibleTracks()[this.selected]?.id
      : this.visibleAlbums()[this.selected]?.id;
    if (!itemId) return;
    const targetId = this.viewMode === "tracks"
      ? `artist-track-row-${itemId}`
      : `artist-album-card-${itemId}`;
    setTimeout(() => {
      const scroll = this.ctx.renderer.root.findDescendantById("artist-scroll") as any;
      scroll?.scrollChildIntoView?.(targetId);
      this.scheduleInlineImageRefresh();
    }, 0);
  }

  public async handleKey(key: KeyEvent): Promise<boolean> {
    const filterResult = applyFilterOverlayKey(this.filter, key);
    if (filterResult.handled) {
      if (filterResult.changed) {
        this.selected = 0;
      }
      return true;
    }

    const max = this.viewMode === "tracks" ? this.visibleTracks().length : this.visibleAlbums().length;
    if (isKey(key, "down", "j")) {
      this.selected = moveSelection(this.selected, 1, max);
      this.scrollSelectedIntoView();
      return true;
    }
    if (isKey(key, "up", "k")) {
      this.selected = moveSelection(this.selected, -1, max);
      this.scrollSelectedIntoView();
      return true;
    }
    if (key.name === "t") {
      this.viewMode = this.viewMode === "tracks" ? "albums" : "tracks";
      this.selected = 0;
      return true;
    }
    if (isKey(key, "enter")) {
      if (this.viewMode === "albums" && this.visibleAlbums()[this.selected]) {
        const a = this.visibleAlbums()[this.selected];
        this.ctx.pushAlbum(a.id, a.name);
      } else if (this.viewMode === "tracks" && this.visibleTracks()[this.selected]) {
        const uris = this.visibleTracks().slice(this.selected).map((t) => t.uri);
        this.ctx.playTrackUris(uris);
      }
      return true;
    }
    return false;
  }
}
