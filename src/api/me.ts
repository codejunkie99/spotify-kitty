import type { SpotifyClient } from "./client.js";
import type { SpotifyUser } from "../types.js";

export async function getCurrentUser(client: SpotifyClient): Promise<SpotifyUser> {
  return client.get<SpotifyUser>("/me");
}
