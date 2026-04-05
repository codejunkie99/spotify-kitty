import { Box, ScrollBox, Text } from "@opentui/core";
import type { KeyEvent } from "@opentui/core";
import type { ViewContext, SpotifyView, ViewDescriptor } from "./contracts.js";
import { isKey } from "./contracts.js";
import {
  getBrowseCategories,
  getFeaturedPlaylists,
  getNewReleases,
  getRecentlyPlayed,
  getUserPlaylists,
} from "../../api/browse.js";
import { theme } from "../theme.js";
import { truncateTerminalText } from "../lib/terminal-text.js";
import { moveSelection } from "./view-helpers.js";
import { getSquareCoverHeight } from "../media/cover-sizing.js";

interface HomeRowItem {
  id: string;
  name: string;
  subtitle: string;
  imageUrl: string;
  kind: "playlist" | "album" | "artist" | "track" | "category";
  uri?: string;
}

interface PendingImage {
  viewId: string;
  itemId: string;
  imageUrl: string;
  anchorId: string;
  viewportAnchorIds?: string[];
  strictViewportAnchorIds?: string[];
  kind: "cover" | "avatar";
}

interface HomeLayoutMetrics {
  contentPadding: number;
  rowBottomMargin: number;
  rowGap: number;
  rowHeight: number;
  cardWidth: number;
  cardHeight: number;
  cardPadding: number;
  imageWidth: number;
  imageHeight: number;
  textWidth: number;
  titleFontSize: 1 | 2;
}

const HOME_IMAGE_REFRESH_DELAYS_MS = [0, 60, 160, 320] as const;
function getVisibleHomeRowCount(
  rowCount: number,
  cardHeight: number,
  rendererHeight: number,
): number {
  const availableHeight = Math.max(10, rendererHeight - 14);
  const perRow = 1 + cardHeight + 1; // title + card + rowBottomMargin
  const maxRows = Math.max(1, Math.floor((availableHeight - 2) / perRow));
  return Math.min(Math.max(1, rowCount || 1), maxRows);
}

export class HomeView implements SpotifyView {
  private rows: { title: string; items: HomeRowItem[] }[] = [];
  private selectedRow = 0;
  private selectedCol = 0;
  private loading = true;
  private pendingImages: PendingImage[] = [];
  private inlineImageRefreshGeneration = 0;
  private inlineImageRefreshTimers: ReturnType<typeof setTimeout>[] = [];
  private verticalScrollTop = 0;
  private rowScrollLeft = new Map<number, number>();

  public constructor(private readonly ctx: ViewContext) {}

  public async onEnter(): Promise<void> {
    await this.load();
  }

  public onExit(): void {
    this.clearInlineImageRefreshTimers();
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.ctx.setStatus("Loading home...");

    try {
      const [featured, categories, newReleases, recentlyPlayed, playlists] =
        await Promise.all([
          getFeaturedPlaylists(this.ctx.client).catch(() => ({
            message: "",
            playlists: { items: [] },
          })),
          getBrowseCategories(this.ctx.client).catch(() => ({
            categories: { items: [] },
          })),
          getNewReleases(this.ctx.client).catch(() => ({
            albums: { items: [] },
          })),
          getRecentlyPlayed(this.ctx.client).catch(() => ({ items: [] })),
          getUserPlaylists(this.ctx.client).catch(() => ({ items: [] })),
        ]);

      this.rows = [];

      if (recentlyPlayed.items.length > 0) {
        const seen = new Set<string>();
        const uniqueRecent = recentlyPlayed.items.filter((r) => {
          if (seen.has(r.track.id)) return false;
          seen.add(r.track.id);
          return true;
        });
        this.rows.push({
          title: "Recently Played",
          items: uniqueRecent.slice(0, 12).map((r) => ({
            id: r.track.id,
            name: r.track.name,
            subtitle: r.track.artists.map((a) => a.name).join(", "),
            imageUrl: r.track.album.images[0]?.url ?? "",
            kind: "track" as const,
            uri: `spotify:track:${r.track.id}`,
          })),
        });
      }

      const featuredItems = featured.playlists.items
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
        .slice(0, 8)
        .map((p) => ({
          id: p.id,
          name: p.name,
          subtitle:
            p.description.replace(/<[^>]*>/g, "").slice(0, 60) ||
            p.owner.display_name,
          imageUrl: p.images[0]?.url ?? "",
          kind: "playlist" as const,
        }));

      if (featuredItems.length > 0) {
        this.rows.push({
          title: "Featured Playlists",
          items: featuredItems,
        });
      } else if (categories.categories.items.length > 0) {
        this.rows.push({
          title: "Browse Categories",
          items: categories.categories.items.slice(0, 8).map((category) => ({
            id: category.id,
            name: category.name,
            subtitle: "Open search",
            imageUrl: category.icons[0]?.url ?? "",
            kind: "category" as const,
          })),
        });
      }

      if (newReleases.albums.items.length > 0) {
        this.rows.push({
          title: "New Releases",
          items: newReleases.albums.items.slice(0, 8).map((a) => ({
            id: a.id,
            name: a.name,
            subtitle: a.artists.map((ar) => ar.name).join(", "),
            imageUrl: a.images[0]?.url ?? "",
            kind: "album" as const,
          })),
        });
      }

      if (playlists.items.length > 0) {
        this.rows.push({
          title: "Your Playlists",
          items: playlists.items.slice(0, 12).map((p) => ({
            id: p.id,
            name: p.name,
            subtitle: `${p.tracks.total} tracks`,
            imageUrl: p.images[0]?.url ?? "",
            kind: "playlist" as const,
          })),
        });
      }
    } catch (error) {
      this.ctx.setStatus(`Load error: ${(error as Error).message}`);
    }

    this.loading = false;
    this.ctx.setStatus("Ready");
  }

  public render(): ViewDescriptor {
    this.captureScrollState();
    this.pendingImages = [];
    const hints = "↑↓←→ navigate  Enter select  s search  q back";
    const metrics = this.getLayoutMetrics();

    if (this.loading) {
      return {
        title: "Home",
        hints,
        content: Box(
          {
            width: "100%",
            height: "100%",
            justifyContent: "center",
            alignItems: "center",
          },
          Text({ content: "Loading...", color: theme.accent }),
        ),
      };
    }

    if (this.rows.length === 0) {
      return {
        title: "Home",
        hints,
        content: Box(
          {
            width: "100%",
            height: "100%",
            justifyContent: "center",
            alignItems: "center",
          },
          Text({
            content: "No content found. Make sure you're logged in.",
            color: theme.textSecondary,
          }),
        ),
      };
    }

    const content = Box({
      width: "100%",
      height: "100%",
      flexDirection: "column",
      padding: metrics.contentPadding,
      onMouseScroll: () => {
        this.scheduleInlineImageRefresh();
      },
    });
    const scroll = ScrollBox({
      id: "home-scroll",
      width: "100%",
      flexGrow: 1,
      viewportCulling: false,
      onMouseScroll: () => {
        this.scheduleInlineImageRefresh();
      },
      rootOptions: { backgroundColor: theme.background },
      contentOptions: { paddingRight: 1 },
    });
    scroll.scrollTop = this.verticalScrollTop;

    const visibleRows = getVisibleHomeRowCount(
      this.rows.length,
      metrics.cardHeight,
      this.ctx.renderer.height,
    );

    for (let r = 0; r < visibleRows; r++) {
      const row = this.rows[r];
      const rowBox = Box({
        id: `home-row-${r}`,
        width: "100%",
        flexDirection: "column",
        marginBottom: metrics.rowBottomMargin,
      });
      const titleText = Text({
        content: row.title,
        color: theme.text,
        fontWeight: "bold",
        fontSize: metrics.titleFontSize,
      });
      rowBox.add(titleText as any);

      const cards = row.items.map((item, c) =>
        this.renderCard(
          item,
          r,
          c,
          r === this.selectedRow && c === this.selectedCol,
          metrics,
        ),
      );

      const rowScroll = ScrollBox(
        {
          id: `home-row-scroll-${r}`,
          width: "100%",
          height: metrics.rowHeight,
          scrollX: true,
          scrollY: false,
          horizontalScrollbarOptions: {
            visible: false,
            height: 0,
            trackOptions: {
              visible: false,
              height: 0,
            },
          },
          onMouseScroll: () => {
            this.scheduleInlineImageRefresh();
          },
          rootOptions: { backgroundColor: theme.background },
          contentOptions: { flexDirection: "row", gap: metrics.rowGap },
        },
        ...cards,
      );
      rowScroll.scrollLeft = this.rowScrollLeft.get(r) ?? 0;
      rowBox.add(rowScroll as any);
      scroll.add(rowBox as any);
    }

    content.add(scroll as any);
    return { title: "Home", hints, content };
  }

  private activateItem(item: HomeRowItem): void {
    if (item.kind === "playlist") {
      this.ctx.pushPlaylist(item.id, item.name);
    } else if (item.kind === "album") {
      this.ctx.pushAlbum(item.id, item.name);
    } else if (item.kind === "artist") {
      this.ctx.pushArtist(item.id, item.name);
    } else if (item.kind === "category") {
      this.ctx.pushSearch(item.name, ["playlist"]);
    } else if (item.kind === "track" && item.uri) {
      this.ctx.playTrackUris([item.uri]);
    }
  }

  private renderCard(
    item: HomeRowItem,
    rowIndex: number,
    colIndex: number,
    selected: boolean,
    metrics: HomeLayoutMetrics,
  ): ReturnType<typeof Box> {
    const bgColor = selected ? theme.surfaceHover : theme.surfaceMuted;
    const itemKey = `${rowIndex}-${colIndex}-${item.id}`;
    const cardId = `card-${itemKey}`;
    const imgId = `img-${itemKey}`;

    const card = Box({
      id: cardId,
      width: metrics.cardWidth,
      height: metrics.cardHeight,
      backgroundColor: bgColor,
      borderRadius: 4,
      flexDirection: "column",
      padding: metrics.cardPadding,
      onMouseDown: (event: any) => {
        if (event.button !== 0) return;
        this.activateItem(item);
      },
    });

    // Image area
    const imgArea = Box({
      id: imgId,
      width: metrics.imageWidth,
      height: metrics.imageHeight,
      backgroundColor: selected ? theme.surfaceRaised : theme.surface,
      borderRadius: 4,
      marginBottom: 1,
    });
    card.add(imgArea as any);

    // Text info
    const infoBox = Box({ width: "100%", flexDirection: "column" });
    const textWidth = metrics.textWidth;
    const nameText = Text({
      content: truncateTerminalText(item.name, textWidth),
      color: selected ? theme.accentHover : theme.text,
      fontWeight: selected ? "bold" : "medium",
      fontSize: 1,
      width: textWidth,
    });
    const subText = Text({
      content: truncateTerminalText(item.subtitle, textWidth),
      color: selected ? theme.cool : theme.textSecondary,
      fontSize: 1,
      width: textWidth,
    });
    infoBox.add(nameText as any);
    infoBox.add(subText as any);
    card.add(infoBox as any);

    if (item.imageUrl) {
      this.pendingImages.push({
        viewId: "home",
        itemId: itemKey,
        imageUrl: item.imageUrl,
        anchorId: imgId,
        viewportAnchorIds: [`home-row-scroll-${rowIndex}`],
        kind: "cover",
      });
    }

    return card;
  }

  private getLayoutMetrics(): HomeLayoutMetrics {
    const availableWidth = Math.max(20, this.ctx.renderer.width - 30);
    const cardsPerRow = Math.max(3, Math.min(6, Math.floor(availableWidth / 24)));
    const cardWidth = Math.floor(availableWidth / cardsPerRow);
    const cardPadding = 1;
    const imageWidth = cardWidth - 2;
    const imageHeight = getSquareCoverHeight(this.ctx.renderer, imageWidth);
    const cardHeight = imageHeight + 3 + 2; // image + 2 text lines + 1 margin + padding
    return {
      contentPadding: 1,
      rowBottomMargin: 1,
      rowGap: 0,
      rowHeight: cardHeight,
      cardWidth,
      cardHeight,
      cardPadding,
      imageWidth,
      imageHeight,
      textWidth: imageWidth,
      titleFontSize: cardWidth >= 22 ? 2 : 1,
    };
  }

  private captureScrollState(): void {
    const root = (this.ctx.renderer as any)?.root;
    if (!root?.findDescendantById) return;

    const verticalScroll = root.findDescendantById("home-scroll") as any;
    if (typeof verticalScroll?.scrollTop === "number") {
      this.verticalScrollTop = verticalScroll.scrollTop;
    }

    const nextRowScrollLeft = new Map<number, number>();
    for (let rowIndex = 0; rowIndex < this.rows.length; rowIndex += 1) {
      const rowScroll = root.findDescendantById(
        `home-row-scroll-${rowIndex}`,
      ) as any;
      if (typeof rowScroll?.scrollLeft === "number") {
        nextRowScrollLeft.set(rowIndex, rowScroll.scrollLeft);
      } else if (this.rowScrollLeft.has(rowIndex)) {
        nextRowScrollLeft.set(rowIndex, this.rowScrollLeft.get(rowIndex)!);
      }
    }
    this.rowScrollLeft = nextRowScrollLeft;
  }

  private scrollSelectionIntoView(): void {
    const row = this.rows[this.selectedRow];
    const item = row?.items[this.selectedCol];
    if (!row || !item) return;

    setTimeout(() => {
      const verticalScroll = this.ctx.renderer.root.findDescendantById(
        "home-scroll",
      ) as any;
      verticalScroll?.scrollChildIntoView?.(`home-row-${this.selectedRow}`);

      const horizontalScroll = this.ctx.renderer.root.findDescendantById(
        `home-row-scroll-${this.selectedRow}`,
      ) as any;
      horizontalScroll?.scrollChildIntoView?.(
        `card-${this.selectedRow}-${this.selectedCol}-${item.id}`,
      );
      this.scheduleInlineImageRefresh();
    }, 0);
  }

  public async handleKey(key: KeyEvent): Promise<boolean> {
    if (this.loading) return false;

    const metrics = this.getLayoutMetrics();
    const visibleRows = getVisibleHomeRowCount(
      this.rows.length,
      metrics.cardHeight,
      this.ctx.renderer.height,
    );
    const maxRow = visibleRows - 1;
    const maxCol = this.rows[this.selectedRow]?.items.length - 1 ?? 0;

    if (isKey(key, "down", "j")) {
      this.selectedRow = Math.min(this.selectedRow + 1, maxRow);
      this.selectedCol = Math.min(
        this.selectedCol,
        this.rows[this.selectedRow]?.items.length - 1 ?? 0,
      );
      this.scrollSelectionIntoView();
      return true;
    }
    if (isKey(key, "up", "k")) {
      this.selectedRow = Math.max(this.selectedRow - 1, 0);
      this.selectedCol = Math.min(
        this.selectedCol,
        this.rows[this.selectedRow]?.items.length - 1 ?? 0,
      );
      this.scrollSelectionIntoView();
      return true;
    }
    if (isKey(key, "right", "l")) {
      this.selectedCol = moveSelection(this.selectedCol, 1, maxCol + 1);
      this.scrollSelectionIntoView();
      return true;
    }
    if (isKey(key, "left", "h")) {
      this.selectedCol = moveSelection(this.selectedCol, -1, maxCol + 1);
      this.scrollSelectionIntoView();
      return true;
    }
    if (isKey(key, "enter")) {
      const item = this.rows[this.selectedRow]?.items[this.selectedCol];
      if (!item) return false;
      this.activateItem(item);
      return true;
    }

    return false;
  }

  public async onDidRender(): Promise<void> {
    this.suppressRowScrollbars();
    await this.reconcilePendingImages();
  }

  private suppressRowScrollbars(): void {
    for (let rowIndex = 0; rowIndex < this.rows.length; rowIndex += 1) {
      const rowScroll = this.ctx.renderer.root.findDescendantById(
        `home-row-scroll-${rowIndex}`,
      ) as any;
      const horizontalScrollBar = rowScroll?.horizontalScrollBar;
      if (!horizontalScrollBar) continue;

      horizontalScrollBar.visible = false;
      horizontalScrollBar.height = 0;

      if (horizontalScrollBar.slider) {
        horizontalScrollBar.slider.visible = false;
        horizontalScrollBar.slider.height = 0;
      }

      if (horizontalScrollBar.startArrow) {
        horizontalScrollBar.startArrow.visible = false;
      }

      if (horizontalScrollBar.endArrow) {
        horizontalScrollBar.endArrow.visible = false;
      }

      rowScroll.wrapper?.remove?.(horizontalScrollBar.id);
    }
  }

  private async reconcilePendingImages(): Promise<void> {
    // Retry with delay — layout needs time to compute anchor positions
    for (let attempt = 0; attempt < 4; attempt++) {
      const result = await this.ctx.inlineImageManager.reconcileScopeMany(
        "home",
        this.pendingImages,
      );
      if (result === "kitty") return;
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  private scheduleInlineImageRefresh(): void {
    if (this.pendingImages.length === 0) return;

    this.inlineImageRefreshGeneration += 1;
    const generation = this.inlineImageRefreshGeneration;
    this.clearInlineImageRefreshTimers();

    for (const delayMs of HOME_IMAGE_REFRESH_DELAYS_MS) {
      const timer = setTimeout(() => {
        void this.ctx.renderer
          .idle()
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
}
