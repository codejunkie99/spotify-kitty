// Inline image backend interface and types

export interface InlineImagePlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  pixelWidth: number;
  pixelHeight: number;
}

export interface InlineImageAsset {
  cacheKey: string;
  width: number;
  height: number;
  pngData: Buffer;
}

export interface InlineImageRequest {
  imageId: string;
  imageKey: string;
  placement: InlineImagePlacement;
  asset: InlineImageAsset;
}

export interface InlineImageBackend {
  readonly name: string;
  isAvailable(renderer: unknown): boolean;
  show(request: InlineImageRequest): Promise<void>;
  update(request: InlineImageRequest): Promise<void>;
  hide(imageId: string): Promise<void>;
  clearAll(): Promise<void>;
}
