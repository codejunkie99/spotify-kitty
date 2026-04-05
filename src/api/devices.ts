import type { SpotifyClient } from "./client.js";

export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  volume_percent: number;
}

export async function getDevices(client: SpotifyClient): Promise<SpotifyDevice[]> {
  const data = await client.get<{ devices: SpotifyDevice[] }>("/me/player/devices");
  return data.devices ?? [];
}

export async function transferPlayback(client: SpotifyClient, deviceId: string): Promise<void> {
  await client.put("/me/player", { device_ids: [deviceId], play: true });
}
