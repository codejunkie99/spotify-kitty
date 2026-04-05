import { Jimp, JimpMime } from "jimp";

const inlineImageCache = new Map<string, Promise<SpotifyImageData | undefined>>();

export interface SpotifyImageData {
  cacheKey: string;
  width: number;
  height: number;
  pngData: Buffer;
}

function fitBoundingSize(
  sourceWidth: number,
  sourceHeight: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  const safeSourceWidth = Math.max(1, sourceWidth);
  const safeSourceHeight = Math.max(1, sourceHeight);
  const scale = Math.min(maxWidth / safeSourceWidth, maxHeight / safeSourceHeight, 1);
  return {
    width: Math.max(1, Math.round(safeSourceWidth * scale)),
    height: Math.max(1, Math.round(safeSourceHeight * scale)),
  };
}

export async function getSpotifyImageData(
  imageUrl: string,
  options: { maxWidthPx: number; maxHeightPx: number },
): Promise<SpotifyImageData | undefined> {
  const normalized = {
    maxWidthPx: Math.max(16, Math.round(options.maxWidthPx)),
    maxHeightPx: Math.max(16, Math.round(options.maxHeightPx)),
  };
  const cacheKey = `${imageUrl}::inline::${normalized.maxWidthPx}x${normalized.maxHeightPx}`;
  const cached = inlineImageCache.get(cacheKey);
  if (cached) return cached;

  const pending = (async (): Promise<SpotifyImageData | undefined> => {
    try {
      const image = await Jimp.read(imageUrl);
      const target = fitBoundingSize(
        image.bitmap.width,
        image.bitmap.height,
        normalized.maxWidthPx,
        normalized.maxHeightPx,
      );
      image.resize({ w: target.width, h: target.height });
      const pngData = await image.getBuffer(JimpMime.png);
      return {
        cacheKey: `${imageUrl}::${target.width}x${target.height}`,
        width: target.width,
        height: target.height,
        pngData,
      };
    } catch {
      return undefined;
    }
  })();

  inlineImageCache.set(cacheKey, pending);
  return pending;
}
