import type { CliRenderer, KeyEvent } from "@opentui/core";
import type { SpotifyClient } from "../../api/client.js";
import type { SpotifyUser } from "../../types.js";
import type { InlineImageManager } from "../media/inline-image-manager.js";

export type SearchQueryType = "track" | "artist" | "album" | "playlist";

export interface ViewContext {
  renderer: CliRenderer;
  inlineImageManager: InlineImageManager;
  client: SpotifyClient;
  me: SpotifyUser;
  setStatus: (message: string) => void;
  requestRender: () => void;
  popView: () => void;
  pushPlaylist: (playlistId: string, name: string) => void;
  pushAlbum: (albumId: string, name: string) => void;
  pushArtist: (artistId: string, name: string) => void;
  pushSearch: (initialQuery?: string, types?: SearchQueryType[]) => void;
  pushLikedSongs: () => void;
  pushQueue: () => void;
  pushRecommendations: (trackId: string, trackName: string) => void;
  pushDevices: () => void;
  playContext: (contextUri: string, offset?: number) => void;
  playTrackUris: (uris: string[]) => void;
  likeTrack: (trackId: string) => Promise<boolean>;
  unlikeTrack: (trackId: string) => Promise<void>;
  isLiked: (trackId: string) => boolean;
  syncLikedTrackIds: (trackIds: string[]) => Promise<void>;
  markLikedTrackIds: (trackIds: string[]) => void;
  addToQueue: (uri: string) => Promise<void>;
}

export interface ViewDescriptor {
  title: string;
  hints: string;
  content: unknown;
  immersive?: boolean;
}

export interface SpotifyView {
  onEnter: () => Promise<void> | void;
  onExit?: () => Promise<void> | void;
  onDidRender?: () => Promise<void> | void;
  render: () => ViewDescriptor;
  handleKey: (key: KeyEvent) => Promise<boolean> | boolean;
}

const SUBMIT_KEY_NAMES = new Set(["enter", "return", "kpenter"]);
const SUBMIT_KEY_SEQUENCES = new Set(["\r", "\n"]);

export function isKey(key: KeyEvent, ...names: string[]): boolean {
  if (names.includes(key.name) || names.includes(key.sequence) || (key.code != null && names.includes(key.code))) {
    return true;
  }

  if (names.some((name) => SUBMIT_KEY_NAMES.has(name))) {
    if (SUBMIT_KEY_NAMES.has(key.name) || SUBMIT_KEY_SEQUENCES.has(key.sequence)) {
      return true;
    }
  }

  return false;
}
