import type { SpotifyClient } from "./client.js";
import type { SpotifyPlayState, SpotifyTrack } from "../types.js";

const NO_PLAYBACK: SpotifyPlayState = {
  is_playing: false,
  item: null,
  progress_ms: null,
  device: { id: "", name: "No active device", is_active: false, volume_percent: 0 },
};

export async function getPlayState(client: SpotifyClient): Promise<SpotifyPlayState> {
  try {
    const result = await client.get<SpotifyPlayState>("/me/player");
    if (!result || !result.device) return NO_PLAYBACK;
    return result;
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 204 || status === 404) return NO_PLAYBACK;
    throw error;
  }
}

export async function startPlayback(
  client: SpotifyClient,
  contextUri?: string,
  offsetPosition?: number,
): Promise<void> {
  const body: { context_uri?: string; offset?: { position: number } } = {};
  if (contextUri) body.context_uri = contextUri;
  if (offsetPosition !== undefined) body.offset = { position: offsetPosition };
  await client.put("/me/player/play", body);
}

export async function playTrackUris(client: SpotifyClient, uris: string[]): Promise<void> {
  await client.put("/me/player/play", { uris });
}

export async function getQueue(client: SpotifyClient) {
  return client.get<{
    currently_playing: SpotifyTrack | null;
    queue: (SpotifyTrack | null)[];
  }>("/me/player/queue");
}

export async function pausePlayback(client: SpotifyClient): Promise<void> {
  await client.put("/me/player/pause");
}

export async function skipNext(client: SpotifyClient): Promise<void> {
  await client.post("/me/player/next");
}

export async function skipPrevious(client: SpotifyClient): Promise<void> {
  await client.post("/me/player/previous");
}

export async function seekTo(client: SpotifyClient, positionMs: number): Promise<void> {
  await client.put("/me/player/seek", undefined, { position_ms: String(positionMs) });
}

export async function setVolume(client: SpotifyClient, volumePercent: number): Promise<void> {
  await client.put("/me/player/volume", undefined, { volume_percent: String(volumePercent) });
}

export async function setShuffle(client: SpotifyClient, state: boolean): Promise<void> {
  await client.put("/me/player/shuffle", undefined, { state: String(state) });
}

export async function setRepeat(client: SpotifyClient, state: "off" | "track" | "context"): Promise<void> {
  await client.put("/me/player/repeat", undefined, { state });
}
