// Spotify API types

export interface SpotifyImage {
  url: string;
  width: number | null;
  height: number | null;
}

export interface SpotifyUser {
  id: string;
  display_name: string;
  email: string;
  images: SpotifyImage[];
  country: string;
  product: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  duration_ms: number;
  explicit: boolean;
  preview_url: string | null;
  track_number: number;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  external_urls: { spotify: string };
}

export interface SpotifyArtist {
  id: string;
  name: string;
  images?: SpotifyImage[];
  genres?: string[];
  popularity?: number;
  external_urls: { spotify: string };
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  images: SpotifyImage[];
  artists: SpotifyArtist[];
  release_date: string;
  total_tracks: number;
  external_urls: { spotify: string };
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  images: SpotifyImage[];
  owner: { display_name: string };
  tracks: { total: number };
  external_urls: { spotify: string };
}

export interface SpotifyPlayState {
  is_playing: boolean;
  item: SpotifyTrack | null;
  progress_ms: number | null;
  shuffle_state?: boolean;
  repeat_state?: "off" | "track" | "context";
  device: {
    id: string;
    name: string;
    is_active: boolean;
    volume_percent: number;
  };
}

export interface SpotifySearchResults {
  tracks?: { items: SpotifyTrack[]; total: number };
  artists?: { items: SpotifyArtist[]; total: number };
  albums?: { items: SpotifyAlbum[]; total: number };
  playlists?: { items: SpotifyPlaylist[]; total: number };
}

export interface SpotifyHomeSection {
  id: string;
  title: string;
  items: SpotifyHomeItem[];
}

export interface SpotifyHomeItem {
  id: string;
  name: string;
  description: string;
  images: SpotifyImage[];
  uri: string;
  kind: "playlist" | "album" | "artist" | "track" | "show" | "episode";
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
  after?: string;
  before?: string;
}
