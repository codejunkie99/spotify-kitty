import { Box, ScrollBox, Text } from "@opentui/core";
import type { KeyEvent } from "@opentui/core";
import type { SearchQueryType, ViewContext, SpotifyView, ViewDescriptor } from "./contracts.js";
import { isKey } from "./contracts.js";
import { searchSpotify } from "../../api/browse.js";
import { truncateTerminalText } from "../lib/terminal-text.js";
import { theme } from "../theme.js";
import {
  filterItemsFromQuery,
  moveSelection,
  shouldShowSearchEmptyState,
} from "./view-helpers.js";

type ResultKind = "track" | "artist" | "album" | "playlist";

interface SearchResult {
  id: string;
  name: string;
  subtitle: string;
  imageUrl: string;
  kind: ResultKind;
  previewOnly?: boolean;
}

function isPrintableQueryInput(sequence: string | undefined): sequence is string {
  return Boolean(sequence) && sequence.length === 1 && sequence >= " " && sequence !== "\u007f";
}

const QUICK_MATCH_RESULTS: SearchResult[] = [
  { id: "quick-track-stayin-alive", name: "Stayin' Alive", subtitle: "Bee Gees", imageUrl: "", kind: "track", previewOnly: true },
  { id: "quick-album-saturday-night-fever", name: "Saturday Night Fever", subtitle: "Bee Gees", imageUrl: "", kind: "album", previewOnly: true },
  { id: "quick-artist-bee-gees", name: "Bee Gees", subtitle: "Artist", imageUrl: "", kind: "artist", previewOnly: true },
  { id: "quick-playlist-disco-essentials", name: "Disco Essentials", subtitle: "Quick match", imageUrl: "", kind: "playlist", previewOnly: true },
  { id: "quick-artist-tame-impala", name: "Tame Impala", subtitle: "Artist", imageUrl: "", kind: "artist", previewOnly: true },
  { id: "quick-track-dracula", name: "Dracula", subtitle: "Tame Impala", imageUrl: "", kind: "track", previewOnly: true },
  { id: "quick-track-the-less-i-know-the-better", name: "The Less I Know The Better", subtitle: "Tame Impala", imageUrl: "", kind: "track", previewOnly: true },
  { id: "quick-album-currents", name: "Currents", subtitle: "Tame Impala", imageUrl: "", kind: "album", previewOnly: true },
  { id: "quick-playlist-this-is-tame-impala", name: "This Is Tame Impala", subtitle: "Quick match", imageUrl: "", kind: "playlist", previewOnly: true },
  { id: "quick-track-turn-the-lights-off", name: "Turn The Lights Off", subtitle: "Kato x Jon", imageUrl: "", kind: "track", previewOnly: true },
  { id: "quick-track-first-person-shooter", name: "First Person Shooter", subtitle: "Drake, J. Cole", imageUrl: "", kind: "track", previewOnly: true },
  { id: "quick-track-2024", name: "2024", subtitle: "Playboi Carti", imageUrl: "", kind: "track", previewOnly: true },
  { id: "quick-playlist-made-for-you", name: "Made For You", subtitle: "Quick match", imageUrl: "", kind: "playlist", previewOnly: true },
];

export class SearchView implements SpotifyView {
  private query = "";
  private results: SearchResult[] = [];
  private selected = 0;
  private loading = false;
  private inputMode = true;
  private hasSearched = false;

  public constructor(
    private readonly ctx: ViewContext,
    initialQuery = "",
    private readonly types: SearchQueryType[] = ["track", "artist", "album", "playlist"],
  ) {
    this.query = initialQuery;
    this.inputMode = initialQuery.length === 0;
  }

  public async onEnter(): Promise<void> {
    if (this.query.trim()) {
      await this.doSearch();
      return;
    }
    this.ctx.setStatus("Type to search Spotify...");
  }

  public render(): ViewDescriptor {
    const hints = this.inputMode
      ? "type to search  Esc back"
      : "↑↓ navigate  Enter select  Esc clear/back";

    const content = Box({ width: "100%", height: "100%", flexDirection: "column", padding: 2 });

    // Search input display
    const inputBg = this.inputMode ? theme.surfaceHover : theme.surface;
    const inputRow = Box({
      width: "100%",
      backgroundColor: inputBg,
      borderRadius: 6,
      padding: 1,
      marginBottom: 2,
    });
    const searchDisplay = this.query || (this.inputMode ? "_" : "(type to search)");
    inputRow.add(Text({
      content: `Search: ${searchDisplay}`,
      color: this.query ? theme.text : theme.textDim,
    }) as any);
    content.add(inputRow as any);

    const quickResults = this.getQuickResults();
    const loadingFallbackResults = this.loading && this.results.length === 0 ? quickResults : [];
    const previewResults = this.inputMode
      ? quickResults
      : loadingFallbackResults.map((result) => ({ ...result, previewOnly: true }));
    const shouldShowPreviewResults = previewResults.length > 0
      && ((this.inputMode && this.query.trim().length > 0) || (this.loading && this.query.trim().length > 0));

    if (this.loading) {
      const loadingLabel = Box({
        id: "search-loading-label",
        width: "100%",
        marginBottom: shouldShowPreviewResults || this.results.length > 0 ? 1 : 0,
      });
      loadingLabel.add(Text({ content: "Searching Spotify...", color: theme.accent }) as any);
      content.add(loadingLabel as any);
    }

    if (shouldShowPreviewResults) {
      content.add(Text({ content: "Quick matches", color: theme.textSecondary }) as any);
      content.add(Box({ height: 1 }) as any);
      const previewRows = previewResults.map((result, index) => this.renderPreviewRow(result, index));
      content.add(ScrollBox(
        {
          id: "search-preview-scroll",
          width: "100%",
          flexGrow: 1,
          viewportCulling: true,
          rootOptions: { backgroundColor: theme.background },
          contentOptions: { paddingBottom: 1 },
        },
        ...previewRows,
      ) as any);
      content.add(Box({ paddingTop: 1 },
        Text({
          content: this.loading
            ? "Searching Spotify..."
            : "Press Enter for live Spotify results",
          color: this.loading ? theme.accent : theme.textSecondary,
        }) as any,
      ) as any);
      return { title: "Search", hints, content };
    }

    if (this.inputMode && this.query.trim() && quickResults.length === 0) {
      content.add(Box({ flexGrow: 1, justifyContent: "center" },
        Text({ content: "Press Enter to search Spotify", color: theme.textSecondary }) as any,
      ) as any);
      return { title: "Search", hints, content };
    }

    if (this.loading && this.results.length === 0) {
      content.add(Box({ flexGrow: 1, justifyContent: "center" },
        Text({ content: "Searching Spotify...", color: theme.accent }) as any,
      ) as any);
      return { title: "Search", hints, content };
    }

    if (shouldShowSearchEmptyState({
      inputMode: this.inputMode,
      loading: this.loading,
      query: this.query,
      resultsCount: this.results.length,
      hasSearched: this.hasSearched,
    })) {
      content.add(Box({ flexGrow: 1, justifyContent: "center" },
        Text({ content: `No results for "${this.query}"`, color: theme.textSecondary }) as any,
      ) as any);
      return { title: "Search", hints, content };
    }

    if (this.results.some((result) => result.previewOnly)) {
      content.add(Text({ content: "Quick matches", color: theme.textSecondary }) as any);
      content.add(Box({ height: 1 }) as any);
    }

    const rows = this.results.map((result, index) => this.renderResultRow(result, index));
    content.add(ScrollBox(
      {
        id: "search-scroll",
        width: "100%",
        flexGrow: 1,
        viewportCulling: true,
        rootOptions: { backgroundColor: theme.background },
        contentOptions: { paddingBottom: 1 },
      },
      ...rows,
    ) as any);

    return { title: "Search", hints, content };
  }

  private renderPreviewRow(result: SearchResult, index: number): ReturnType<typeof Box> {
    const row = Box({
      id: `search-preview-row-${index}`,
      width: "100%",
      backgroundColor: theme.surface,
      borderRadius: 4,
      paddingLeft: 1,
      paddingRight: 1,
      marginBottom: 1,
    });

    row.add(Text({
      content: this.formatResultLine(result),
      color: theme.text,
      fontSize: 1,
    }) as any);

    return row;
  }

  private renderResultRow(result: SearchResult, index: number): ReturnType<typeof Box> {
    const selected = index === this.selected;
    const bg = selected ? theme.surfaceHover : theme.surface;
    const row = Box({
      id: `search-row-${index}`,
      width: "100%",
      backgroundColor: bg,
      borderRadius: 4,
      paddingLeft: 1,
      paddingRight: 1,
      marginBottom: 1,
      onMouseDown: (event: any) => {
        if (event.button !== 0) return;
        this.selected = index;
        this.scrollSelectedIntoView();
        if (result.previewOnly) {
          this.ctx.setStatus("Quick match only — refine the query for a live Spotify result");
          this.ctx.requestRender();
          return;
        }
        this.activateResult(result);
      },
    });

    const lineText = this.formatResultLine(result);
    row.add(Text({
      content: lineText,
      color: selected ? theme.accent : theme.text,
      fontSize: 1,
      fontWeight: selected ? "medium" : "normal",
    }) as any);

    return row;
  }

  public async handleKey(key: KeyEvent): Promise<boolean> {
    if (this.inputMode) {
      if (key.name === "escape") {
        this.ctx.popView();
        return true;
      }
      if (isKey(key, "enter", "return")) {
        if (this.query.trim()) {
          this.inputMode = false;
          await this.doSearch();
        }
        return true;
      }
      if (key.name === "backspace") {
        this.query = this.query.slice(0, -1);
        if (!this.query) {
          this.hasSearched = false;
          this.results = [];
          this.selected = 0;
          this.ctx.setStatus("Type to search Spotify...");
        } else {
          this.ctx.setStatus("Press Enter to search Spotify");
        }
        return true;
      }
      if (isPrintableQueryInput(key.sequence)) {
        this.query += key.sequence;
        this.ctx.setStatus("Press Enter to search Spotify");
        return true;
      }
      return false;
    }

    // result navigation mode
    if (isKey(key, "escape")) {
      this.inputMode = true;
      this.results = [];
      this.query = "";
      this.hasSearched = false;
      return true;
    }
    if (key.name === "backspace") {
      this.inputMode = true;
      this.query = "";
      this.results = [];
      this.hasSearched = false;
      this.selected = 0;
      this.ctx.setStatus("Type to search Spotify...");
      return true;
    }
    if (isKey(key, "down", "j")) {
      this.selected = moveSelection(this.selected, 1, this.results.length);
      this.scrollSelectedIntoView();
      return true;
    }
    if (isKey(key, "up", "k")) {
      this.selected = moveSelection(this.selected, -1, this.results.length);
      this.scrollSelectedIntoView();
      return true;
    }
    if (isKey(key, "enter")) {
      const r = this.results[this.selected];
      if (!r) return false;
      if (r.previewOnly) {
        this.ctx.setStatus("Quick match only — refine the query for a live Spotify result");
        return true;
      }
      this.activateResult(r);
      return true;
    }
    if (isPrintableQueryInput(key.sequence) && !["j", "k"].includes(key.sequence)) {
      this.inputMode = true;
      this.query = key.sequence;
      this.results = [];
      this.hasSearched = false;
      this.selected = 0;
      this.ctx.setStatus("Type to search Spotify...");
      return true;
    }

    return false;
  }

  private async doSearch(): Promise<void> {
    if (!this.query.trim()) return;
    this.loading = true;
    this.hasSearched = true;
    this.ctx.setStatus(`Searching "${this.query}"...`);
    this.selected = 0;

    try {
      const data = await searchSpotify(this.ctx.client, this.query, this.types);
      this.results = [];

      if (data.tracks?.items) {
        for (const t of data.tracks.items.filter(Boolean).slice(0, 8)) {
          this.results.push({
            id: t.id,
            name: t.name,
            subtitle: t.artists.map((a) => a.name).join(", "),
            imageUrl: t.album.images[0]?.url ?? "",
            kind: "track",
          });
        }
      }
      if (data.artists?.items) {
        for (const a of data.artists.items.filter(Boolean).slice(0, 6)) {
          this.results.push({
            id: a.id,
            name: a.name,
            subtitle: a.genres?.slice(0, 2).join(", ") || "Artist",
            imageUrl: a.images?.[0]?.url ?? "",
            kind: "artist",
          });
        }
      }
      if (data.albums?.items) {
        for (const a of data.albums.items.filter(Boolean).slice(0, 6)) {
          this.results.push({
            id: a.id,
            name: a.name,
            subtitle: a.artists.map((ar) => ar.name).join(", "),
            imageUrl: a.images[0]?.url ?? "",
            kind: "album",
          });
        }
      }
      if (data.playlists?.items) {
        for (const p of data.playlists.items.filter(Boolean).slice(0, 8)) {
          this.results.push({
            id: p.id,
            name: p.name,
            subtitle: p.owner?.display_name || "Playlist",
            imageUrl: p.images[0]?.url ?? "",
            kind: "playlist",
          });
        }
      }
      if (this.results.length === 0) {
        this.results = this.getQuickResults().map((result) => ({
          ...result,
          previewOnly: true,
        }));
        this.ctx.setStatus("No live Spotify results — showing quick matches");
        return;
      }
    } catch (error) {
      this.results = this.getQuickResults().map((result) => ({
        ...result,
        previewOnly: true,
      }));
      this.ctx.setStatus(
        this.results.length > 0
          ? "Spotify search failed — showing quick matches"
          : `Search error: ${(error as Error).message}`,
      );
      return;
    } finally {
      this.loading = false;
    }
    this.ctx.setStatus(`Found ${this.results.length} results`);
  }

  private scrollSelectedIntoView(): void {
    setTimeout(() => {
      const scroll = this.ctx.renderer.root.findDescendantById("search-scroll") as any;
      scroll?.scrollChildIntoView?.(`search-row-${this.selected}`);
    }, 0);
  }

  private kindLabel(kind: ResultKind): string {
    if (kind === "track") return "Track";
    if (kind === "artist") return "Artist";
    if (kind === "album") return "Album";
    return "Playlist";
  }

  private formatResultLine(result: SearchResult): string {
    const prefix = result.kind === "track"
      ? "T"
      : result.kind === "artist"
        ? "A"
        : result.kind === "album"
          ? "L"
          : "P";
    const raw = `${prefix} ${result.name}  ·  ${result.subtitle}`;
    const maxWidth = Math.max(24, this.ctx.renderer.width - 42);
    return truncateTerminalText(raw, maxWidth);
  }

  private getQuickResults(): SearchResult[] {
    return filterItemsFromQuery(
      QUICK_MATCH_RESULTS.filter((result) => this.types.includes(result.kind)),
      this.query,
      (result) => `${result.name} ${result.subtitle} ${this.kindLabel(result.kind)}`,
    ).slice(0, 8);
  }

  private activateResult(result: SearchResult): void {
    if (result.kind === "playlist") {
      this.ctx.pushPlaylist(result.id, result.name);
    } else if (result.kind === "album") {
      this.ctx.pushAlbum(result.id, result.name);
    } else if (result.kind === "artist") {
      this.ctx.pushArtist(result.id, result.name);
    } else if (result.kind === "track") {
      this.ctx.playTrackUris([`spotify:track:${result.id}`]);
    }
  }
}
