import { Box, Text } from "@opentui/core";
import type { KeyEvent } from "@opentui/core";
import type { ViewContext, SpotifyView, ViewDescriptor } from "./contracts.js";
import { isKey } from "./contracts.js";
import { getDevices, transferPlayback, type SpotifyDevice } from "../../api/devices.js";
import { theme } from "../theme.js";

export class DevicesView implements SpotifyView {
  private devices: SpotifyDevice[] = [];
  private selected = 0;
  private loading = true;

  public constructor(private readonly ctx: ViewContext) {}

  public async onEnter(): Promise<void> {
    this.ctx.setStatus("Loading devices...");
    try {
      this.devices = await getDevices(this.ctx.client);
      this.ctx.setStatus(`${this.devices.length} devices found`);
    } catch (e) {
      this.ctx.setStatus((e as Error).message);
    }
    this.loading = false;
  }

  public render(): ViewDescriptor {
    const hints = "↑↓ select  Enter connect  Esc back";
    const content = Box({ width: "100%", height: "100%", flexDirection: "column", padding: 2 });

    content.add(Text({ content: "Select a playback device", color: theme.accent, fontWeight: "bold" }) as any);
    content.add(Text({ content: "Use j/k to navigate, Enter to connect", color: theme.textDim }) as any);
    content.add(Box({ height: 1 }) as any);

    if (this.loading) {
      content.add(Text({ content: "Loading...", color: theme.accent }) as any);
      return { title: "Devices", hints, content };
    }

    if (this.devices.length === 0) {
      content.add(Text({ content: "No devices found. Open Spotify on a device first.", color: theme.textDim }) as any);
      return { title: "Devices", hints, content };
    }

    for (let i = 0; i < this.devices.length; i++) {
      const d = this.devices[i];
      const sel = i === this.selected;
      const bg = sel ? theme.surfaceHover : "transparent";
      const activeIcon = d.is_active ? " ●" : "";
      const row = Box({
        width: "100%",
        backgroundColor: bg,
        padding: 1,
        borderRadius: 4,
        onMouseDown: (event: any) => {
          if (event.button !== 0) return;
          this.selected = i;
          void this.connectSelectedDevice();
        },
      });
      row.add(Text({
        content: `${d.name}${activeIcon}`,
        color: sel ? theme.accent : (d.is_active ? theme.accentHover : theme.text),
        fontWeight: d.is_active ? "bold" : "normal",
      }) as any);
      row.add(Text({ content: `  ${d.type} · Vol ${d.volume_percent}%`, color: theme.textDim }) as any);
      content.add(row as any);
    }

    return { title: "Devices", hints, content };
  }

  public async handleKey(key: KeyEvent): Promise<boolean> {
    if (isKey(key, "down", "j")) {
      this.selected = Math.min(this.selected + 1, this.devices.length - 1);
      return true;
    }
    if (isKey(key, "up", "k")) {
      this.selected = Math.max(this.selected - 1, 0);
      return true;
    }
    if (isKey(key, "enter")) {
      await this.connectSelectedDevice();
      return true;
    }
    return false;
  }

  private async connectSelectedDevice(): Promise<void> {
    const d = this.devices[this.selected];
    if (!d) return;
    this.ctx.setStatus(`Connecting to ${d.name}...`);
    try {
      await transferPlayback(this.ctx.client, d.id);
      this.ctx.setStatus(`Connected to ${d.name}`);
      this.ctx.popView();
    } catch (e) {
      this.ctx.setStatus((e as Error).message);
    }
  }
}
