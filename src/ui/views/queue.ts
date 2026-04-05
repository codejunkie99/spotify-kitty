import { Box, Text, ScrollBox } from "@opentui/core";
import type { KeyEvent } from "@opentui/core";
import type { ViewContext, SpotifyView, ViewDescriptor } from "./contracts.js";
import { isKey } from "./contracts.js";
import { getQueue } from "../../api/playback.js";
import { formatDuration } from "../../lib/format.js";
import { theme } from "../theme.js";
import { renderFilterOverlay } from "../components/filter-overlay.js";
import { getSquareCoverHeight } from "../media/cover-sizing.js";
import { truncateTerminalText } from "../lib/terminal-text.js";
import {
  applyFilterOverlayKey,
  filterItemsFromQuery,
  moveSelection,
  resolveClickSelection,
  type FilterOverlayState,
} from "./view-helpers.js";

const INLINE_IMAGE_REFRESH_DELAYS_MS = [0, 60, 160, 320] as const;

interface QueueTrack {
  rowKey: string;
  id: string;
  name: string;
  artists: string;
  duration: string;
  imageUrl: string;
}

export class QueueView implements SpotifyView {
  private currentTrack: QueueTrack | null = null;
  private queue: QueueTrack[] = [];
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

  public constructor(private readonly ctx: ViewContext) {}

  public async onEnter(): Promise<void> {
    this.ctx.setStatus("Loading queue...");
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
    const queue = this.visibleQueue();
    const rowCoverWidth = 4;
    const rowCoverHeight = getSquareCoverHeight(this.ctx.renderer, rowCoverWidth);
    const textWidth = Math.max(20, this.ctx.renderer.width - 50);
    const hints = "↑↓ navigate  / filter  g reload  Esc back";
    const content = Box({ width: "100%", height: "100%", flexDirection: "column", padding: 1 });

    if (this.loading) {
      content.add(Text({ content: "Loading queue...", color: theme.accent }) as any);
      return { title: "Queue", hints, content };
    }

    // Now playing
    if (this.currentTrack) {
      content.add(Text({ content: "Now playing", color: theme.textDim, fontWeight: "bold" }) as any);
      const npRow = Box({ width: "100%", backgroundColor: theme.surface, padding: 1, marginBottom: 1 });
      const currentImageAnchorId = "queue-current-img";
      npRow.add(Box({
        id: currentImageAnchorId,
        width: rowCoverWidth,
        height: rowCoverHeight,
        backgroundColor: theme.border,
        borderRadius: 2,
      }) as any);
      const npText = Box({ flexDirection: "column" });
      npText.add(Text({
        content: truncateTerminalText(this.currentTrack.name, textWidth),
        color: theme.accent,
      }) as any);
      npText.add(Text({
        content: truncateTerminalText(this.currentTrack.artists, textWidth),
        color: theme.textDim,
      }) as any);
      npRow.add(npText as any);
      content.add(npRow as any);

      if (this.currentTrack.imageUrl) {
        this.pendingImages.push({
          viewId: "queue",
          itemId: `current-${this.currentTrack.id}`,
          imageUrl: this.currentTrack.imageUrl,
          anchorId: currentImageAnchorId,
          kind: "cover",
        });
      }
    }

    // Up next
    content.add(Text({
      content: this.filter.query ? `Next up (${queue.length} of ${this.queue.length})` : `Next up (${this.queue.length})`,
      color: theme.textDim,
      fontWeight: "bold",
    }) as any);

    const scroll = ScrollBox({
      id: "queue-scroll",
      onMouseScroll: () => {
        this.scheduleInlineImageRefresh();
      },
      rootOptions: { backgroundColor: theme.background },
      contentOptions: { padding: 1 },
    });
    for (let i = 0; i < queue.length; i++) {
      const t = queue[i];
      const sel = i === this.selected;
      const bg = sel ? theme.surfaceHover : "transparent";
      const row = Box({
        id: `queue-row-${t.rowKey}`,
        width: "100%",
        backgroundColor: bg,
        flexDirection: "row",
        paddingLeft: 1,
        onMouseDown: (event: any) => {
          if (event.button !== 0) return;
          const click = resolveClickSelection(this.selected, i, queue.length);
          this.selected = click.selected;
          this.scrollSelectedIntoView();
          if (!click.activate) {
            this.ctx.requestRender();
          }
        },
      });
      row.add(Text({ content: `${i + 1}`, color: sel ? theme.accent : theme.textDim, width: 4 }) as any);
      const imageAnchorId = `queue-img-${t.rowKey}`;
      row.add(Box({
        id: imageAnchorId,
        width: rowCoverWidth,
        height: rowCoverHeight,
        backgroundColor: theme.border,
        borderRadius: 2,
      }) as any);
      const titleCol = Box({ flexGrow: 1, flexDirection: "column" });
      titleCol.add(Text({
        content: truncateTerminalText(t.name, textWidth),
        color: sel ? theme.accent : theme.text,
        fontSize: 1,
      }) as any);
      titleCol.add(Text({
        content: truncateTerminalText(t.artists, textWidth),
        color: theme.textDim,
        fontSize: 1,
      }) as any);
      row.add(titleCol as any);
      row.add(Text({ content: t.duration, color: theme.textDim, width: 6 }) as any);

      if (t.imageUrl) {
        this.pendingImages.push({
          viewId: "queue",
          itemId: t.rowKey,
          imageUrl: t.imageUrl,
          anchorId: imageAnchorId,
          viewportAnchorIds: ["queue-scroll"],
          kind: "cover",
        });
      }

      scroll.add(row as any);
    }
    content.add(scroll as any);

    if (this.filter.active || this.filter.query) {
      content.add(renderFilterOverlay(this.filter.query, `${queue.length} visible`) as any);
    }

    if (queue.length === 0) {
      content.add(Text({ content: "Queue is empty", color: theme.textDim }) as any);
    }

    return { title: "Queue", hints, content };
  }

  public async onDidRender(): Promise<void> {
    await this.reconcilePendingImages();
  }

  private async reconcilePendingImages(): Promise<void> {
    await this.ctx.inlineImageManager.reconcileScopeMany("queue", this.pendingImages);
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
    const rowKey = this.visibleQueue()[this.selected]?.rowKey;
    if (!rowKey) return;
    setTimeout(() => {
      const scroll = this.ctx.renderer.root.findDescendantById("queue-scroll") as any;
      scroll?.scrollChildIntoView?.(`queue-row-${rowKey}`);
      this.scheduleInlineImageRefresh();
    }, 0);
  }

  private visibleQueue(): QueueTrack[] {
    return filterItemsFromQuery(
      this.queue,
      this.filter.query,
      (track) => `${track.name} ${track.artists}`,
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

    const queue = this.visibleQueue();

    if (isKey(key, "down", "j")) {
      this.selected = moveSelection(this.selected, 1, queue.length);
      this.scrollSelectedIntoView();
      return true;
    }
    if (isKey(key, "up", "k")) {
      this.selected = moveSelection(this.selected, -1, queue.length);
      this.scrollSelectedIntoView();
      return true;
    }
    if (isKey(key, "g")) {
      this.ctx.setStatus("Refreshing queue...");
      await this.reloadData();
      return true;
    }
    return false;
  }

  private async reloadData(): Promise<void> {
    const data = await getQueue(this.ctx.client);
    if (data.currently_playing) {
      const t = data.currently_playing;
      this.currentTrack = {
        rowKey: `current-${t.id}`,
        id: t.id,
        name: t.name,
        artists: t.artists.map((a) => a.name).join(", "),
        duration: formatDuration(t.duration_ms),
        imageUrl: t.album.images[0]?.url ?? "",
      };
    } else {
      this.currentTrack = null;
    }
    this.queue = (data.queue ?? [])
      .filter((t): t is NonNullable<typeof t> => t != null)
      .slice(0, 30)
      .map((t, index) => ({
        rowKey: `${index}-${t.id}`,
        id: t.id,
        name: t.name,
        artists: t.artists.map((a) => a.name).join(", "),
        duration: formatDuration(t.duration_ms),
        imageUrl: t.album.images[0]?.url ?? "",
      }));
    this.selected = Math.max(0, Math.min(this.selected, Math.max(0, this.queue.length - 1)));
    this.ctx.setStatus(`Queue: ${this.queue.length} tracks`);
  }
}
