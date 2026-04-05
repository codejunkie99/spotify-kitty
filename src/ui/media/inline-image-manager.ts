import type { CliRenderer } from "@opentui/core";
import type { InlineImageBackend, InlineImagePlacement, InlineImageRequest } from "./inline-image-backend.js";
import { KittyInlineImageBackend } from "./kitty-backend.js";
import { doesRectIntersectWithin, isRectFullyVisibleWithin } from "./inline-image-visibility.js";
import { getSpotifyImageData } from "./spotify-image-preview.js";
import type { SpotifyImageMode } from "../../config.js";

type ResolvedImageMode = "kitty" | "off";

interface DesiredImageState {
  viewId: string;
  itemId: string;
  imageUrl?: string;
  anchorId?: string;
  viewportAnchorId?: string;
  viewportAnchorIds?: string[];
  strictViewportAnchorIds?: string[];
  kind?: "cover" | "avatar";
}

interface AnchorRenderable {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ActiveKittyImageState {
  imageId: string;
  imageKey: string;
  placementKey: string;
  viewId: string;
}

export class InlineImageManager {
  private readonly kittyBackend = new KittyInlineImageBackend((chunk) => {
    this.writeTerminalChunk(chunk);
  });
  private readonly activeKittyImages = new Map<string, ActiveKittyImageState>();
  private readonly desiredStatesByScope = new Map<string, DesiredImageState[]>();
  private warnedUnavailable = false;
  private warnedFailure = false;
  private reconcileSequence = 0;
  private terminalMutationChain: Promise<void> = Promise.resolve();

  public constructor(
    private readonly renderer: CliRenderer,
    private readonly configuredMode: SpotifyImageMode,
    private readonly setStatus: (message: string) => void,
  ) {}

  public isDisabled(): boolean {
    return this.resolveMode() === "off";
  }

  public async reconcile(desired: DesiredImageState | undefined): Promise<ResolvedImageMode> {
    return this.reconcileScope("default", desired);
  }

  public async reconcileMany(desiredStates: DesiredImageState[]): Promise<ResolvedImageMode> {
    return this.reconcileScopeMany("default", desiredStates);
  }

  public async reconcileScope(
    scopeId: string,
    desired: DesiredImageState | undefined,
  ): Promise<ResolvedImageMode> {
    return this.reconcileScopeMany(scopeId, desired ? [desired] : []);
  }

  public async reconcileScopeMany(
    scopeId: string,
    desiredStates: DesiredImageState[],
  ): Promise<ResolvedImageMode> {
    if (desiredStates.length > 0) {
      this.desiredStatesByScope.set(scopeId, desiredStates);
    } else {
      this.desiredStatesByScope.delete(scopeId);
    }
    return this.reconcileStoredStates();
  }

  private async reconcileStoredStates(): Promise<ResolvedImageMode> {
    const sequence = ++this.reconcileSequence;
    const mode = this.resolveMode();
    const desiredStates = [...this.desiredStatesByScope.values()].flat();
    if (mode !== "kitty") {
      if (sequence !== this.reconcileSequence) return mode;
      await this.hideAllKittyImages();
      return mode;
    }

    if (desiredStates.length === 0) {
      if (sequence !== this.reconcileSequence) return mode;
      await this.hideAllKittyImages();
      return mode;
    }

    const desiredImageIds = new Set<string>();

    for (const desired of desiredStates) {
      if (!desired.imageUrl || !desired.anchorId || !desired.itemId) continue;

      const placement = this.getPlacementForAnchor(
        desired.anchorId,
        desired.viewportAnchorIds ?? (desired.viewportAnchorId ? [desired.viewportAnchorId] : undefined),
        desired.strictViewportAnchorIds,
        desired.kind === "avatar" ? "fully-visible" : "allow-clipped",
      );
      if (!placement) continue;

      const imageId = `${desired.viewId}:${desired.kind ?? "cover"}:${desired.itemId}`;
      desiredImageIds.add(imageId);

      let asset;
      try {
        asset = await getSpotifyImageData(desired.imageUrl, {
          maxWidthPx: placement.pixelWidth,
          maxHeightPx: placement.pixelHeight,
        });
      } catch (error) {
        await this.hideKittyImageById(imageId);
        if (!this.warnedFailure) {
          this.warnedFailure = true;
          this.setStatus(`Image processing failed: ${(error as Error).message}`);
        }
        continue;
      }

      if (sequence !== this.reconcileSequence) return mode;
      if (!asset) {
        await this.hideKittyImageById(imageId);
        continue;
      }

      const displayPlacement = this.computeDisplayPlacement(placement, asset.width, asset.height);
      const request: InlineImageRequest = {
        imageId,
        imageKey: `${desired.imageUrl}::${asset.width}x${asset.height}`,
        placement: displayPlacement,
        asset: { cacheKey: asset.cacheKey, width: asset.width, height: asset.height, pngData: asset.pngData },
      };
      const placementKey = this.formatPlacementKey(displayPlacement);

      const active = this.activeKittyImages.get(imageId);
      const isUnchanged = active?.imageKey === request.imageKey && active.placementKey === placementKey;
      if (isUnchanged) continue;

      try {
        if (active) {
          await this.enqueueTerminalMutation(async () => {
            await this.kittyBackend.update(request);
          });
        } else {
          await this.enqueueTerminalMutation(async () => {
            await this.kittyBackend.show(request);
          });
        }
      } catch (error) {
        await this.hideKittyImageById(imageId);
        if (!this.warnedFailure) {
          this.warnedFailure = true;
          this.setStatus(`Kitty rendering failed: ${(error as Error).message}`);
        }
        continue;
      }

      if (sequence !== this.reconcileSequence) {
        return mode;
      }

      this.activeKittyImages.set(imageId, { imageId, imageKey: request.imageKey, placementKey, viewId: desired.viewId });
    }

    if (sequence !== this.reconcileSequence) return mode;
    await this.hideImagesNotInSet(desiredImageIds);
    return mode;
  }

  public async clearView(viewId: string): Promise<void> {
    let changed = false;

    for (const [scopeId, desiredStates] of this.desiredStatesByScope) {
      const nextStates = desiredStates.filter((state) => state.viewId !== viewId);
      if (nextStates.length === desiredStates.length) continue;
      changed = true;
      if (nextStates.length > 0) {
        this.desiredStatesByScope.set(scopeId, nextStates);
      } else {
        this.desiredStatesByScope.delete(scopeId);
      }
    }

    if (this.desiredStatesByScope.delete(viewId)) {
      changed = true;
    }

    if (changed) {
      await this.reconcileStoredStates();
      return;
    }

    this.reconcileSequence += 1;
    const idsToHide = [...this.activeKittyImages.values()]
      .filter((state) => state.viewId === viewId)
      .map((state) => state.imageId);
    for (const id of idsToHide) {
      await this.hideKittyImageById(id);
    }
  }

  public async clearAll(): Promise<void> {
    this.reconcileSequence += 1;
    this.desiredStatesByScope.clear();
    await this.enqueueTerminalMutation(async () => {
      await this.kittyBackend.clearAll();
    });
    this.activeKittyImages.clear();
  }

  private resolveMode(): ResolvedImageMode {
    if (this.configuredMode === "off") return "off";
    const kittyAvailable = this.kittyBackend.isAvailable(this.renderer);
    if (kittyAvailable) return "kitty";
    if (this.configuredMode === "kitty" && !this.warnedUnavailable) {
      this.warnedUnavailable = true;
      this.setStatus("Kitty graphics unavailable in this terminal.");
    }
    return "off";
  }

  private async hideKittyImageById(imageId: string): Promise<void> {
    if (!this.activeKittyImages.has(imageId)) return;
    await this.enqueueTerminalMutation(async () => {
      await this.kittyBackend.hide(imageId);
    });
    this.activeKittyImages.delete(imageId);
  }

  private async hideAllKittyImages(): Promise<void> {
    for (const imageId of [...this.activeKittyImages.keys()]) {
      await this.hideKittyImageById(imageId);
    }
  }

  private async hideImagesNotInSet(desiredImageIds: Set<string>): Promise<void> {
    for (const imageId of [...this.activeKittyImages.keys()].filter((id) => !desiredImageIds.has(id))) {
      await this.hideKittyImageById(imageId);
    }
  }

  private async enqueueTerminalMutation<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.terminalMutationChain.then(async () => {
      await this.renderer.idle().catch(() => {});
      return operation();
    });
    this.terminalMutationChain = run.then(() => undefined, () => undefined);
    return run;
  }

  private writeTerminalChunk(chunk: string): void {
    const rendererWithWriteOut = this.renderer as { writeOut?: (chunk: string) => unknown };
    if (typeof rendererWithWriteOut.writeOut === "function") {
      rendererWithWriteOut.writeOut(chunk);
      return;
    }
    process.stdout.write(chunk);
  }

  private getPlacementForAnchor(
    anchorId: string,
    viewportAnchorIds: string[] | undefined,
    strictViewportAnchorIds: string[] | undefined,
    visibilityMode: "allow-clipped" | "fully-visible" = "allow-clipped",
  ): InlineImagePlacement | undefined {
    const anchor = this.renderer.root.findDescendantById(anchorId) as AnchorRenderable | undefined;
    if (!anchor) return undefined;

    const x = Math.floor(anchor.x);
    const y = Math.floor(anchor.y);
    const width = Math.floor(anchor.width);
    const height = Math.floor(anchor.height);
    if (width <= 0 || height <= 0) return undefined;

    const strictViewportAnchorIdSet = new Set(strictViewportAnchorIds ?? []);

    for (const viewportAnchorId of viewportAnchorIds ?? []) {
      const viewport = this.renderer.root.findDescendantById(viewportAnchorId) as AnchorRenderable | undefined;
      if (!viewport) return undefined;

      const rect = { x, y, width, height };
      const viewportRect = {
        x: Math.floor(viewport.x),
        y: Math.floor(viewport.y),
        width: Math.floor(viewport.width),
        height: Math.floor(viewport.height),
      };

      const viewportVisibilityMode = strictViewportAnchorIdSet.has(viewportAnchorId)
        ? "fully-visible"
        : visibilityMode;

      const visible = viewportVisibilityMode === "fully-visible"
        ? isRectFullyVisibleWithin(rect, viewportRect)
        : doesRectIntersectWithin(rect, viewportRect);

      if (!visible) return undefined;

      const fullyVisible = isRectFullyVisibleWithin(
        rect,
        viewportRect,
      );

      // Fully visible anchors are the safest path. Cover art may stay rendered a bit longer
      // while it scrolls out of frame, but avatars should remain strict.
      if (viewportVisibilityMode === "fully-visible" && !fullyVisible) return undefined;
    }

    const cellPixelWidth = this.getCellPixelWidth();
    const cellPixelHeight = this.getCellPixelHeight();

    return {
      x,
      y,
      width,
      height,
      pixelWidth: Math.max(16, Math.round(width * cellPixelWidth)),
      pixelHeight: Math.max(16, Math.round(height * cellPixelHeight)),
    };
  }

  private getCellPixelWidth(): number {
    const resolution = (this.renderer as { resolution?: { width: number; height: number } }).resolution;
    const termWidth = Math.max(1, (this.renderer as { terminalWidth?: number }).terminalWidth || this.renderer.width);
    if (!resolution?.width) return 8;
    return Math.max(1, resolution.width / termWidth);
  }

  private getCellPixelHeight(): number {
    const resolution = (this.renderer as { resolution?: { width: number; height: number } }).resolution;
    const termHeight = Math.max(1, (this.renderer as { terminalHeight?: number }).terminalHeight || this.renderer.height);
    if (!resolution?.height) return 16;
    return Math.max(1, resolution.height / termHeight);
  }

  private formatPlacementKey(p: InlineImagePlacement): string {
    return `${p.x},${p.y},${p.width},${p.height},${p.pixelWidth},${p.pixelHeight}`;
  }

  private computeDisplayPlacement(
    base: InlineImagePlacement,
    imagePixelWidth: number,
    imagePixelHeight: number,
  ): InlineImagePlacement {
    const cellPixelHeight = Math.max(1, base.pixelHeight / Math.max(1, base.height));
    const targetHeightPx = Math.min(
      base.pixelHeight,
      Math.max(cellPixelHeight, Math.round((base.pixelWidth * imagePixelHeight) / Math.max(1, imagePixelWidth))),
    );
    const heightCells = Math.max(1, Math.min(base.height, Math.round(targetHeightPx / cellPixelHeight)));
    const renderHeightPx = Math.max(1, Math.round(heightCells * cellPixelHeight));

    return {
      ...base,
      height: heightCells,
      pixelHeight: renderHeightPx,
    };
  }
}
