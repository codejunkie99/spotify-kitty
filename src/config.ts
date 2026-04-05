import { config as loadDotEnv } from "dotenv";
import { homedir } from "node:os";
import { join } from "node:path";

export interface SpotifyOAuthConfig {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scopes: string[];
  tokenStorePath: string;
}

export interface AppConfig {
  spotifyApiBaseUrl: string;
  oauth: SpotifyOAuthConfig;
  imageMode: SpotifyImageMode;
}

export type SpotifyImageMode = "auto" | "kitty" | "off";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Copy .env.example to .env and set your Spotify API credentials.`,
    );
  }
  return value;
}

function parseImageMode(value: string | undefined): SpotifyImageMode {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === "auto") return "auto";
  if (normalized === "kitty" || normalized === "off") return normalized;
  throw new Error(`Invalid SPOTIFY_IMAGE_MODE value "${value}". Expected: auto | kitty | off.`);
}

const SPOTIFY_SCOPES = [
  "user-read-private",
  "user-read-email",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "playlist-read-collaborative",
  "playlist-read-private",
  "user-library-read",
  "user-library-modify",
  "user-read-recently-played",
];

export function loadConfig(): AppConfig {
  loadDotEnv();

  return {
    spotifyApiBaseUrl: "https://api.spotify.com/v1",
    imageMode: parseImageMode(process.env.SPOTIFY_IMAGE_MODE),
    oauth: {
      clientId: requiredEnv("SPOTIFY_CLIENT_ID"),
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET?.trim() || undefined,
      redirectUri: process.env.SPOTIFY_REDIRECT_URI?.trim() || "http://127.0.0.1:8888/callback",
      scopes: SPOTIFY_SCOPES,
      tokenStorePath: join(homedir(), ".spotify-kitty", "oauth-token.json"),
    },
  };
}
