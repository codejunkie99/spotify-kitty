import type { InlineImageBackend, InlineImageRequest } from "./inline-image-backend.js";

const ESC = "\u001b";
const ST = `${ESC}\\`;
const KITTY_DATA_CHUNK_SIZE = 4096;

interface DisplayedImageState {
  kittyImageId: number;
}

export class KittyInlineImageBackend implements InlineImageBackend {
  public readonly name = "kitty";
  private readonly displayedByImageId = new Map<string, DisplayedImageState>();
  private nextKittyImageId = 1;

  public constructor(
    private readonly writeChunk: (chunk: string) => void = (chunk) => {
      process.stdout.write(chunk);
    },
  ) {}

  public isAvailable(renderer: unknown): boolean {
    if (Boolean(process.env.TMUX)) return false;

    const capabilities = (renderer as { capabilities?: Record<string, unknown> })?.capabilities;
    if (capabilities?.kitty_graphics === true) return true;

    const term = (process.env.TERM ?? "").toLowerCase();
    const termProgram = (process.env.TERM_PROGRAM ?? "").toLowerCase();
    if (term.includes("kitty")) return true;
    if (Boolean(process.env.KITTY_WINDOW_ID)) return true;
    if (termProgram.includes("ghostty") || termProgram.includes("wezterm") || termProgram.includes("warp")) return true;

    return false;
  }

  public async show(request: InlineImageRequest): Promise<void> {
    await this.renderImage(request);
  }

  public async update(request: InlineImageRequest): Promise<void> {
    await this.renderImage(request);
  }

  public async hide(imageId: string): Promise<void> {
    const existing = this.displayedByImageId.get(imageId);
    if (!existing) return;
    this.deleteImage(existing.kittyImageId, true);
    this.displayedByImageId.delete(imageId);
  }

  public async clearAll(): Promise<void> {
    this.deleteVisiblePlacements();
    this.displayedByImageId.clear();
  }

  private async renderImage(request: InlineImageRequest): Promise<void> {
    const kittyImageId = this.allocateKittyImageId();
    const existing = this.displayedByImageId.get(request.imageId);
    if (existing) {
      this.deleteImage(existing.kittyImageId, true);
    }
    this.placeImageByTransmit(request, kittyImageId);
    this.displayedByImageId.set(request.imageId, { kittyImageId });
  }

  private placeImageByTransmit(request: InlineImageRequest, kittyImageId: number): void {
    const payload = request.asset.pngData.toString("base64");
    let offset = 0;
    const row = request.placement.y + 1;
    const col = request.placement.x + 1;
    const save = `${ESC}7`;
    const restore = `${ESC}8`;
    const move = `${ESC}[${row};${col}H`;
    let output = `${save}${move}`;

    while (offset < payload.length) {
      const chunk = payload.slice(offset, offset + KITTY_DATA_CHUNK_SIZE);
      const hasMore = offset + KITTY_DATA_CHUNK_SIZE < payload.length;
      if (offset === 0) {
        output += this.buildGraphicsCommand(
          {
            a: "T",
            t: "d",
            f: 100,
            i: kittyImageId,
            q: 2,
            C: 1,
            c: Math.max(1, request.placement.width),
            r: Math.max(1, request.placement.height),
            z: 10,
            m: hasMore ? 1 : 0,
          },
          chunk,
        );
      } else {
        output += this.buildGraphicsCommand({ q: 2, m: hasMore ? 1 : 0 }, chunk);
      }
      offset += KITTY_DATA_CHUNK_SIZE;
    }
    output += restore;
    this.writeChunk(output);
  }

  private deleteImage(kittyImageId: number, deleteData: boolean): void {
    this.writeChunk(this.buildGraphicsCommand({ a: "d", d: deleteData ? "I" : "i", i: kittyImageId, q: 2 }));
  }

  private deleteVisiblePlacements(): void {
    this.writeChunk(this.buildGraphicsCommand({ a: "d", d: "A", q: 2 }));
  }

  private buildGraphicsCommand(params: Record<string, string | number>, payload?: string): string {
    const serialized = Object.entries(params).map(([key, value]) => `${key}=${value}`).join(",");
    if (payload === undefined) {
      return `${ESC}_G${serialized}${ST}`;
    }
    return `${ESC}_G${serialized};${payload}${ST}`;
  }

  private allocateKittyImageId(): number {
    return this.nextKittyImageId++;
  }
}
