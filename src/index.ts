import { createCliRenderer } from "@opentui/core";
import { SpotifyClient } from "./api/client.js";
import { SpotifyOAuthSession } from "./auth/oauth-session.js";
import { loadConfig } from "./config.js";
import { getCurrentUser } from "./api/me.js";
import { SpotifyApp } from "./ui/app.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const oauthSession = new SpotifyOAuthSession(config.oauth);
  await oauthSession.getAccessToken();

  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    useMouse: true,
    autoFocus: true,
    targetFps: 30,
  });

  const client = new SpotifyClient(config, () => oauthSession.getAccessToken(), {
    onUnauthorized: () => oauthSession.forceRefresh(),
  });

  let app: SpotifyApp | undefined;
  let shuttingDown = false;
  const shutdown = async (exitCode: number, error?: unknown): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;

    if (error) {
      const prefix = exitCode === 0 ? "Shutdown error:" : "Unhandled runtime error:";
      console.error(prefix, error);
    }

    try {
      await app?.stop();
    } catch (stopError) {
      console.error("Failed to stop spotify-kitty cleanly:", stopError);
    }

    renderer.destroy();
    process.exit(exitCode);
  };

  try {
    const me = await getCurrentUser(client);
    app = new SpotifyApp(renderer, client, me, config.imageMode);
    await app.start();
  } catch (error) {
    renderer.destroy();
    throw error;
  }

  process.on("SIGINT", () => { void shutdown(0); });
  process.on("SIGTERM", () => { void shutdown(0); });
  process.on("uncaughtException", (error) => { void shutdown(1, error); });
  process.on("unhandledRejection", (reason) => { void shutdown(1, reason); });
}

void main().catch((error) => {
  console.error("Fatal startup error:", error);
  process.exit(1);
});
