import type { CliRenderer } from "@opentui/core";

type RendererLike = Pick<CliRenderer, "width" | "height"> & {
  resolution?: { width: number; height: number };
  terminalWidth?: number;
  terminalHeight?: number;
};

function getCellPixelWidth(renderer: RendererLike): number {
  const termWidth = Math.max(1, renderer.terminalWidth || renderer.width);
  if (!renderer.resolution?.width) return 8;
  return Math.max(1, renderer.resolution.width / termWidth);
}

function getCellPixelHeight(renderer: RendererLike): number {
  const termHeight = Math.max(1, renderer.terminalHeight || renderer.height);
  if (!renderer.resolution?.height) return 16;
  return Math.max(1, renderer.resolution.height / termHeight);
}

export function getSquareCoverHeight(renderer: RendererLike, widthCells: number): number {
  const safeWidth = Math.max(1, Math.round(widthCells));
  const pixelWidth = safeWidth * getCellPixelWidth(renderer);
  const heightCells = pixelWidth / getCellPixelHeight(renderer);
  return Math.max(1, Math.round(heightCells));
}
