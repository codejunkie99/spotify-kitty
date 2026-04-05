import type { SpotifyClient } from "./client.js";

export async function likeTrack(client: SpotifyClient, trackId: string): Promise<void> {
  await client.put("/me/tracks", undefined, { ids: trackId });
}

export async function unlikeTrack(client: SpotifyClient, trackId: string): Promise<void> {
  await client.delete("/me/tracks", undefined, { ids: trackId });
}

export async function checkLiked(client: SpotifyClient, ids: string[]): Promise<boolean[]> {
  return client.get<boolean[]>("/me/tracks/contains", { ids: ids.join(",") });
}

export async function addToQueue(client: SpotifyClient, uri: string): Promise<void> {
  await client.post("/me/player/queue", undefined, { uri });
}

export async function getTopTracks(client: SpotifyClient, limit = 20) {
  return client.get<{
    items: {
      id: string;
      name: string;
      duration_ms: number;
      uri: string;
      artists: { id: string; name: string }[];
      album: {
        id: string;
        name: string;
        images: { url: string }[];
      };
    }[];
  }>("/me/top/tracks", { limit: String(limit), time_range: "short_term" });
}

export async function getRecommendations(
  client: SpotifyClient,
  seedTrackIds: string[],
  seedArtistIds: string[] = [],
  limit = 20,
) {
  const params: Record<string, string> = { limit: String(limit) };
  if (seedTrackIds.length) params.seed_tracks = seedTrackIds.join(",");
  if (seedArtistIds.length) params.seed_artists = seedArtistIds.join(",");
  return client.get<{
    tracks: {
      id: string;
      name: string;
      duration_ms: number;
      uri: string;
      artists: { id: string; name: string }[];
      album: {
        id: string;
        name: string;
        images: { url: string }[];
      };
    }[];
  }>("/recommendations", params);
}
