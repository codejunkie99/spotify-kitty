import type { SpotifyClient } from "./client.js";
import type { SpotifySearchResults, SpotifyPlaylist } from "../types.js";
import { collectOffsetPages } from "../lib/pagination.js";

const LIBRARY_PAGE_SIZE = 50;
const PLAYLIST_TRACK_PAGE_SIZE = 100;

type LikedTrackItem = {
  added_at: string;
  track: {
    id: string;
    name: string;
    duration_ms: number;
    explicit: boolean;
    uri: string;
    artists: { id: string; name: string; external_urls: { spotify: string } }[];
    album: {
      id: string;
      name: string;
      images: { url: string; width: number | null; height: number | null }[];
      external_urls: { spotify: string };
    };
    external_urls: { spotify: string };
  };
};

type PlaylistTrackItem = {
  track: {
    id: string;
    name: string;
    duration_ms: number;
    explicit: boolean;
    artists: { id: string; name: string; external_urls: { spotify: string } }[];
    album: {
      id: string;
      name: string;
      images: { url: string; width: number | null; height: number | null }[];
      external_urls: { spotify: string };
    };
    external_urls: { spotify: string };
    preview_url: string | null;
  } | null;
};

// ---- Search ----

export async function searchSpotify(
  client: SpotifyClient,
  query: string,
  types: ("track" | "artist" | "album" | "playlist")[] = ["track", "artist", "album", "playlist"],
): Promise<SpotifySearchResults> {
  return client.get<SpotifySearchResults>("/search", {
    q: query,
    type: types.join(","),
    limit: "20",
  });
}

// ---- Browse ----

export async function getFeaturedPlaylists(client: SpotifyClient) {
  return client.get<{ message: string; playlists: { items: SpotifyPlaylist[] } }>(
    "/browse/featured-playlists",
    { limit: "10" },
  );
}

export async function getBrowseCategories(client: SpotifyClient) {
  return client.get<{
    categories: {
      items: {
        id: string;
        name: string;
        icons: { url: string; width: number | null; height: number | null }[];
      }[];
    };
  }>("/browse/categories", { limit: "8" });
}

export async function getNewReleases(client: SpotifyClient) {
  return client.get<{
    albums: {
      items: {
        id: string;
        name: string;
        images: { url: string; width: number | null; height: number | null }[];
        artists: { name: string }[];
        release_date: string;
        total_tracks: number;
        external_urls: { spotify: string };
      }[];
    };
  }>("/browse/new-releases", { limit: "10" });
}

export async function getRecentlyPlayed(client: SpotifyClient) {
  return client.get<{
    items: {
      track: {
        id: string;
        name: string;
        duration_ms: number;
        artists: { id: string; name: string; external_urls: { spotify: string } }[];
        album: {
          id: string;
          name: string;
          images: { url: string; width: number | null; height: number | null }[];
          external_urls: { spotify: string };
        };
        external_urls: { spotify: string };
        preview_url: string | null;
      };
    }[];
  }>("/me/player/recently-played", { limit: "20" });
}

// ---- Library ----

export async function getUserPlaylists(client: SpotifyClient) {
  const items = await collectOffsetPages(
    async (offset, limit) => {
      const page = await client.get<{ items: SpotifyPlaylist[]; total: number }>("/me/playlists", {
        limit: String(limit),
        offset: String(offset),
      });
      return {
        items: page.items,
        total: page.total,
      };
    },
    LIBRARY_PAGE_SIZE,
  );

  return { items };
}

export async function getLikedTracks(client: SpotifyClient, offset = 0) {
  let total = 0;
  const items = await collectOffsetPages(
    async (pageOffset, limit) => {
      const page = await client.get<{ total: number; items: LikedTrackItem[] }>("/me/tracks", {
        limit: String(limit),
        offset: String(offset + pageOffset),
      });
      total = page.total;
      return {
        items: page.items,
        total: Math.max(0, page.total - offset),
      };
    },
    LIBRARY_PAGE_SIZE,
  );

  return { total, items };
}

// ---- Playlist ----

export async function getPlaylist(client: SpotifyClient, playlistId: string) {
  const playlist = await client.get<{
    id: string;
    name: string;
    description: string;
    images: { url: string; width: number | null; height: number | null }[];
    owner: { display_name: string };
    external_urls: { spotify: string };
    tracks: {
      total: number;
      items: PlaylistTrackItem[];
    };
  }>(`/playlists/${playlistId}`);

  const trackItems = await collectOffsetPages(
    async (offset, limit) => {
      const page = await client.get<{ items: PlaylistTrackItem[]; total: number }>(`/playlists/${playlistId}/tracks`, {
        limit: String(limit),
        offset: String(offset),
      });
      return {
        items: page.items,
        total: page.total,
      };
    },
    PLAYLIST_TRACK_PAGE_SIZE,
  );

  return {
    ...playlist,
    tracks: {
      total: playlist.tracks.total,
      items: trackItems,
    },
  };
}

// ---- Album ----

export async function getAlbum(client: SpotifyClient, albumId: string) {
  return client.get<{
    id: string;
    name: string;
    images: { url: string; width: number | null; height: number | null }[];
    artists: { id: string; name: string; external_urls: { spotify: string } }[];
    release_date: string;
    total_tracks: number;
    external_urls: { spotify: string };
    tracks: {
      items: {
        id: string;
        name: string;
        duration_ms: number;
        explicit: boolean;
        track_number: number;
        artists: { id: string; name: string; external_urls: { spotify: string } }[];
        external_urls: { spotify: string };
        preview_url: string | null;
      }[];
    };
  }>(`/albums/${albumId}`);
}

// ---- Artist ----

export async function getArtist(client: SpotifyClient, artistId: string) {
  return client.get<{
    id: string;
    name: string;
    images?: { url: string; width: number | null; height: number | null }[];
    genres: string[];
    popularity: number;
    external_urls: { spotify: string };
  }>(`/artists/${artistId}`);
}

export async function getArtistTopTracks(client: SpotifyClient, artistId: string) {
  return client.get<{
    tracks: {
      id: string;
      name: string;
      duration_ms: number;
      explicit: boolean;
      artists: { id: string; name: string; external_urls: { spotify: string } }[];
      album: {
        id: string;
        name: string;
        images: { url: string; width: number | null; height: number | null }[];
        external_urls: { spotify: string };
      };
      external_urls: { spotify: string };
      preview_url: string | null;
    }[];
  }>(`/artists/${artistId}/top-tracks`, { market: "US" });
}

export async function getArtistAlbums(client: SpotifyClient, artistId: string) {
  return client.get<{
    items: {
      id: string;
      name: string;
      images: { url: string; width: number | null; height: number | null }[];
      release_date: string;
      total_tracks: number;
      external_urls: { spotify: string };
    }[];
  }>(`/artists/${artistId}/albums`, { limit: "20" });
}
