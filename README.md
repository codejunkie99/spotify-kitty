# spotify-kitty

A Spotify TUI client with inline album art for kitty-protocol terminals.

![Terminal](https://img.shields.io/badge/terminal-kitty%20%7C%20ghostty%20%7C%20wezterm%20%7C%20warp-green)

## Features

- Inline album art via the kitty graphics protocol
- Full playback controls — play/pause, skip, shuffle, repeat, volume, seek
- Library sidebar with your playlists
- Search tracks, albums, artists, and playlists
- Liked songs, queue, and device switching
- Track recommendations
- Full-screen player view with visualizer
- Mouse and keyboard driven

## Requirements

- [Bun](https://bun.sh) runtime
- A terminal that supports the kitty graphics protocol (kitty, Ghostty, WezTerm, Warp)
- Spotify Premium account
- Spotify Developer app credentials

## Setup

1. Clone the repo and install dependencies:

```bash
git clone https://github.com/codejunkie99/spotify-kitty.git
cd spotify-kitty
bun install
```

2. Create a Spotify app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) and add `http://127.0.0.1:8888/callback` as a redirect URI.

3. Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

```
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8888/callback
SPOTIFY_IMAGE_MODE=auto
```

`SPOTIFY_IMAGE_MODE` options: `auto` (detect terminal support), `kitty` (force on), `off` (disable art).

4. Run it:

```bash
bun start
```

On first launch, a browser window opens for Spotify OAuth. The token is stored at `~/.spotify-kitty/oauth-token.json`.

## Keybindings

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `n` | Next track |
| `p` | Previous track |
| `f` | Toggle shuffle |
| `r` | Cycle repeat (off → context → track) |
| `+` / `-` | Volume up / down |
| `<` / `>` | Seek -5s / +5s |
| `s` / `/` | Search |
| `z` | Queue |
| `d` | Devices |
| `x` | Full-screen player |
| `h` | Home |
| `Tab` | Toggle sidebar focus |
| `q` / `Esc` | Back / Quit |
