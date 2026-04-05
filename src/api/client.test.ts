import { afterEach, expect, test } from "bun:test";
import type { AppConfig } from "../config.js";
import { SpotifyClient } from "./client.js";

const TEST_CONFIG: AppConfig = {
  spotifyApiBaseUrl: "https://api.spotify.com/v1",
  imageMode: "off",
  oauth: {
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    redirectUri: "http://127.0.0.1:8888/callback",
    scopes: [],
    tokenStorePath: "/tmp/spotify-kitty-test-token.json",
  },
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("wraps transport failures with spotify request context", async () => {
  const transportError = new TypeError("fetch failed");
  const failingFetch = (async () => {
    throw transportError;
  }) as typeof fetch;
  globalThis.fetch = failingFetch;

  const client = new SpotifyClient(TEST_CONFIG, async () => "test-token");

  await expect(client.get("/me")).rejects.toThrow(
    "Unable to reach Spotify API while requesting GET /me.",
  );
});

test("treats empty successful response bodies as void data", async () => {
  globalThis.fetch = (async () => new Response("", { status: 200 })) as typeof fetch;

  const client = new SpotifyClient(TEST_CONFIG, async () => "test-token");

  await expect(client.post("/me/player/next")).resolves.toEqual({});
});

test("treats successful plain-text responses as valid data", async () => {
  globalThis.fetch = (async () => new Response("5PUXMZnHmwXFUf44ebqUCbQ0Oxo", { status: 200 })) as typeof fetch;

  const client = new SpotifyClient(TEST_CONFIG, async () => "test-token");

  await expect(client.post("/me/player/next")).resolves.toBe("5PUXMZnHmwXFUf44ebqUCbQ0Oxo");
});
