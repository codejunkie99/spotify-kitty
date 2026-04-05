import { Box, Text } from "@opentui/core";
import type { SpotifyPlayState } from "../../types.js";
import { formatDuration } from "../../lib/format.js";
import { theme } from "../theme.js";
import { truncateTerminalText } from "../lib/terminal-text.js";

interface NowPlayingBarOptions {
  playState: SpotifyPlayState | null;
  shuffleOn: boolean;
  repeatMode: "off" | "track" | "context";
  visualizerThemeId?: VisualizerThemeId;
  interpolatedProgressMs?: number;
  totalWidth?: number;
  onToggleShuffle?: () => void;
  onSkipPrevious?: () => void;
  onTogglePlayPause?: () => void;
  onSkipNext?: () => void;
  onCycleRepeat?: () => void;
  onSetVolume?: (value: number) => void;
  onExpandPlayer?: () => void;
  onSetVisualizerTheme?: (themeId: VisualizerThemeId) => void;
}

const FOOTER_CONTROL_SCALE = 2;
const FOOTER_CONTROL_ROW_HEIGHT = 2;

export function getNowPlayingBarHeight(playState: SpotifyPlayState | null): number {
  const hasTrack = Boolean(playState?.item);
  const bodyRowHeight = hasTrack ? 6 : 2;
  return 1 + bodyRowHeight + FOOTER_CONTROL_ROW_HEIGHT + (hasTrack ? 1 : 0);
}

const VISUALIZER_GLYPHS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"] as const;
export const PLAYER_COLORS = {
  cool: "#8ec5ff",
  warm: "#f6c177",
  energy: "#6ef3a5",
  energyGlow: "#96f7bf",
  mutedRail: "#3a3a3a",
} as const;

export const VISUALIZER_THEME_IDS = ["emerald", "cyan", "violet", "amber"] as const;
export type VisualizerThemeId = typeof VISUALIZER_THEME_IDS[number];

interface VisualizerTheme {
  id: VisualizerThemeId;
  label: string;
  color: string;
}

const VISUALIZER_THEMES: Record<VisualizerThemeId, VisualizerTheme> = {
  emerald: { id: "emerald", label: "●", color: "#6ef3a5" },
  cyan: { id: "cyan", label: "●", color: "#8ec5ff" },
  violet: { id: "violet", label: "●", color: "#caa7ff" },
  amber: { id: "amber", label: "●", color: "#f6c177" },
};

export function getVisualizerTheme(themeId: VisualizerThemeId = "emerald"): VisualizerTheme {
  return VISUALIZER_THEMES[themeId] ?? VISUALIZER_THEMES.cyan;
}

function renderProgressBar(progress: number, duration: number, width: number): string {
  if (width <= 1) return "─";
  if (duration <= 0) return "─".repeat(width);
  const ratio = Math.max(0, Math.min(1, progress / duration));
  const marker = Math.min(width - 1, Math.max(0, Math.round(ratio * (width - 1))));
  return "━".repeat(marker) + "○" + "─".repeat(Math.max(0, width - marker - 1));
}

export function renderMeterSegments(
  current: number,
  max: number,
  width: number,
  markerGlyph: string,
): { filled: string; marker: string; empty: string } {
  if (width <= 1) {
    return { filled: "", marker: markerGlyph, empty: "" };
  }
  if (max <= 0) {
    return { filled: "", marker: "", empty: "─".repeat(width) };
  }
  const ratio = Math.max(0, Math.min(1, current / max));
  const marker = Math.min(width - 1, Math.max(0, Math.round(ratio * (width - 1))));
  return {
    filled: "━".repeat(marker),
    marker: markerGlyph,
    empty: "─".repeat(Math.max(0, width - marker - 1)),
  };
}

function hashTrackId(trackId: string): number {
  let hash = 2166136261;
  for (const char of trackId) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function renderNowPlayingVisualizer(
  trackId: string,
  progress: number,
  width: number,
  isPlaying: boolean,
): string {
  if (width <= 0) return "";
  if (!isPlaying) {
    return Array.from({ length: width }, (_, index) => (index % 3 === 1 ? "·" : " ")).join("");
  }

  const seed = hashTrackId(trackId);
  const phase = progress / 180;
  return Array.from({ length: width }, (_, index) => {
    const harmonicA = Math.sin(index * 0.55 + phase + (seed % 11));
    const harmonicB = Math.sin(index * 0.18 - phase * 0.6 + ((seed >> 3) % 17));
    const harmonicC = Math.sin(index * 0.92 + phase * 0.35 + ((seed >> 5) % 23));
    const composite = (harmonicA * 0.5) + (harmonicB * 0.3) + (harmonicC * 0.2);
    const normalized = Math.max(0, Math.min(1, (composite + 1) / 2));
    const glyphIndex = Math.min(
      VISUALIZER_GLYPHS.length - 1,
      Math.max(0, Math.round(normalized * (VISUALIZER_GLYPHS.length - 1))),
    );
    return VISUALIZER_GLYPHS[glyphIndex];
  }).join("");
}

function renderControlButton(
  id: string,
  label: string,
  options: {
    active?: boolean;
    primary?: boolean;
    onPress?: () => void;
    width?: number;
    height?: number;
    fg?: string;
    backgroundColor?: string;
    marginRight?: number;
  } = {},
): ReturnType<typeof Box> {
  let lastPressAt = 0;
  const resolvedBackgroundColor = options.backgroundColor ?? (
    options.primary ? theme.accent : undefined
  );
  const fg = options.fg ?? (options.primary ? theme.background : options.active ? theme.accent : theme.textSecondary);
  const handleMouseDown = (event: any) => {
    if (event.button !== 0) return;
    const now = Date.now();
    if (now - lastPressAt < 150) return;
    lastPressAt = now;
    options.onPress?.();
  };

  const button = Box({
    id,
    width: options.width ?? (label.length + 2),
    height: options.height ?? 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    marginRight: options.marginRight ?? 1,
    onMouseDown: handleMouseDown,
    onClick: handleMouseDown,
  });
  button.add(Text({
    content: label,
    fg,
    fontWeight: options.primary || options.active ? "bold" : "medium",
    ...(resolvedBackgroundColor ? { bg: resolvedBackgroundColor } : {}),
  }) as any);
  return button;
}

function renderVisualizerThemeSelector(
  selectedThemeId: VisualizerThemeId,
  onSetVisualizerTheme?: (themeId: VisualizerThemeId) => void,
): ReturnType<typeof Box> {
  const selector = Box({
    id: "np-visualizer-theme-selector",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  });

  selector.add(Text({
    content: "Theme",
    fg: theme.textDim,
    width: 6,
  }) as any);

  for (const themeId of VISUALIZER_THEME_IDS) {
    const palette = getVisualizerTheme(themeId);
    let lastPressAt = 0;
    const handlePress = (event: any) => {
      if (event.button !== 0 || !onSetVisualizerTheme) return;
      const now = Date.now();
      if (now - lastPressAt < 150) return;
      lastPressAt = now;
      onSetVisualizerTheme(themeId);
    };

    const swatch = Box({
      id: `np-palette-${themeId}`,
      width: themeId === selectedThemeId ? 4 : 3,
      height: 1,
      marginRight: themeId === VISUALIZER_THEME_IDS[VISUALIZER_THEME_IDS.length - 1] ? 0 : 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.color,
      onMouseDown: handlePress,
      onClick: handlePress,
    });
    swatch.add(Text({
      id: `np-palette-${themeId}-fill`,
      content: themeId === selectedThemeId ? " ✓ " : "   ",
      fg: theme.background,
      bg: palette.color,
      fontWeight: "bold",
      width: themeId === selectedThemeId ? 4 : 3,
    }) as any);
    selector.add(swatch as any);
  }

  return selector;
}

interface TransportControlsOptions {
  idPrefix?: string;
  shuffleOn: boolean;
  repeatMode: "off" | "track" | "context";
  isPlaying: boolean;
  onToggleShuffle?: () => void;
  onSkipPrevious?: () => void;
  onTogglePlayPause?: () => void;
  onSkipNext?: () => void;
  onCycleRepeat?: () => void;
  onExpandPlayer?: () => void;
  scale?: number;
  includeExpand?: boolean;
}

function scaleWidth(baseWidth: number, scale: number): number {
  return Math.max(baseWidth, Math.round(baseWidth * scale));
}

export function renderTransportControls(options: TransportControlsOptions): ReturnType<typeof Box> {
  const {
    idPrefix = "np",
    shuffleOn,
    repeatMode,
    isPlaying,
    onToggleShuffle,
    onSkipPrevious,
    onTogglePlayPause,
    onSkipNext,
    onCycleRepeat,
    onExpandPlayer,
    scale = 1,
    includeExpand = false,
  } = options;
  const controlLabels = {
    shuffle: "⇄",
    prev: "⏮",
    play: isPlaying ? "⏸ Pause" : "▶ Play",
    next: "⏭",
    repeat: repeatMode === "track" ? "↻ 1" : "↻",
    expand: "⤢ Expand",
  };
  const buttonHeight = Math.max(1, Math.round(scale));
  const buttonGap = Math.max(1, Math.round(scale));

  const controls = Box({
    id: `${idPrefix}-transport-controls`,
    flexDirection: "row",
    alignItems: "center",
  });
  controls.add(renderControlButton(`${idPrefix}-shuffle-button`, controlLabels.shuffle, {
    active: shuffleOn,
    onPress: onToggleShuffle,
    width: scaleWidth(4, scale),
    height: buttonHeight,
    marginRight: buttonGap,
    fg: shuffleOn ? PLAYER_COLORS.warm : theme.textSecondary,
  }) as any);
  controls.add(renderControlButton(`${idPrefix}-prev-button`, controlLabels.prev, {
    onPress: onSkipPrevious,
    width: scaleWidth(4, scale),
    height: buttonHeight,
    marginRight: buttonGap,
    fg: PLAYER_COLORS.cool,
  }) as any);
  controls.add(renderControlButton(`${idPrefix}-play-button`, controlLabels.play, {
    primary: false,
    onPress: onTogglePlayPause,
    width: scaleWidth(10, scale),
    height: buttonHeight,
    marginRight: buttonGap,
    fg: theme.accentHover,
  }) as any);
  controls.add(renderControlButton(`${idPrefix}-next-button`, controlLabels.next, {
    onPress: onSkipNext,
    width: scaleWidth(4, scale),
    height: buttonHeight,
    marginRight: buttonGap,
    fg: PLAYER_COLORS.cool,
  }) as any);
  controls.add(renderControlButton(`${idPrefix}-repeat-button`, controlLabels.repeat, {
    active: repeatMode !== "off",
    onPress: onCycleRepeat,
    width: scaleWidth(5, scale),
    height: buttonHeight,
    marginRight: includeExpand ? buttonGap + 1 : buttonGap,
    fg: repeatMode !== "off" ? PLAYER_COLORS.warm : theme.textSecondary,
  }) as any);
  if (includeExpand) {
    controls.add(renderControlButton(`${idPrefix}-expand-button`, controlLabels.expand, {
      onPress: onExpandPlayer,
      width: Math.max(controlLabels.expand.length + 2, scaleWidth(8, scale)),
      height: buttonHeight,
      marginRight: 0,
      fg: theme.text,
    }) as any);
  }
  return controls;
}

export function renderNowPlayingBar(options: NowPlayingBarOptions): ReturnType<typeof Box> {
  const {
    playState,
    shuffleOn,
    repeatMode,
    visualizerThemeId = "emerald",
    interpolatedProgressMs,
    totalWidth,
    onToggleShuffle,
    onSkipPrevious,
    onTogglePlayPause,
    onSkipNext,
    onCycleRepeat,
    onSetVolume,
    onExpandPlayer,
    onSetVisualizerTheme,
  } = options;

  const track = playState?.item;
  const isPlaying = playState?.is_playing ?? false;
  const hasActiveDevice = Boolean(playState?.device?.is_active);
  const progress = interpolatedProgressMs ?? playState?.progress_ms ?? 0;
  const duration = track?.duration_ms ?? 0;
  const volume = playState?.device?.volume_percent ?? 50;
  const width = totalWidth ?? process.stdout.columns ?? 80;
  const visualizerTheme = getVisualizerTheme(visualizerThemeId);
  const artShellWidth = track ? 11 : 0;
  const artShellHeight = track ? 6 : 0;
  const artWidth = 9;
  const artHeight = 5;
  const volumeSliderWidth = Math.max(8, Math.min(16, Math.floor(width * 0.12)));
  const volumeSectionWidth = volumeSliderWidth + 9;
  const rightColumnWidth = track && hasActiveDevice ? volumeSectionWidth : 0;
  const infoWidth = Math.max(24, width - rightColumnWidth - 6);
  const titleWidth = Math.max(14, infoWidth - (track ? artShellWidth + 5 : 2));
  const bodyRowHeight = track ? artShellHeight : 2;
  const barHeight = getNowPlayingBarHeight(playState);

  const bar = Box({
    id: "now-playing-bar",
    width: "100%",
    height: barHeight,
    backgroundColor: theme.background,
    flexDirection: "column",
    borderTop: 1,
    borderColor: theme.border,
  });

  const bodyRow = Box({
    id: "np-body-row",
    width: "100%",
    height: bodyRowHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 2,
    paddingRight: 2,
  });

  const info = Box({
    width: infoWidth,
    flexDirection: "row",
    alignItems: "center",
  });
  if (track) {
    const artShell = Box({
      id: "np-art-shell",
      width: artShellWidth,
      height: artShellHeight,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surfaceMuted,
      borderRadius: 4,
    });
    const artBox = Box({
      id: "np-art",
      width: artWidth,
      height: artHeight,
      backgroundColor: theme.surfaceRaised,
      borderRadius: 3,
    });
    artShell.add(artBox as any);
    info.add(artShell as any);
  }

  const infoText = Box({
    flexGrow: 1,
    flexDirection: "column",
    justifyContent: "center",
    height: bodyRowHeight,
    paddingLeft: track ? 2 : 0,
  });
  if (track) {
    infoText.add(Text({
      id: "np-title",
      content: truncateTerminalText(track.name, titleWidth),
      fg: theme.text,
      fontWeight: "bold",
      fontSize: 2,
    }) as any);
    infoText.add(Text({
      id: "np-artist",
      content: truncateTerminalText(track.artists.map((artist) => artist.name).join(", "), titleWidth),
      fg: theme.cool,
      fontSize: 1,
    }) as any);
  } else {
    infoText.add(Text({ content: "Not playing", fg: theme.textSecondary, fontWeight: "bold" }) as any);
    infoText.add(Text({ content: "Pick a song to start playback", fg: theme.textDim }) as any);
  }
  info.add(infoText as any);
  bodyRow.add(info as any);

  if (track && hasActiveDevice) {
    const side = Box({
      width: rightColumnWidth,
      height: bodyRowHeight,
      flexDirection: "column",
      alignItems: "flex-end",
      justifyContent: "center",
    });
    const volumeRow = Box({
      width: rightColumnWidth,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
    });
    volumeRow.add(Text({
      content: `Vol ${volume}%`,
      fg: theme.cool,
      width: 9,
    }) as any);
    const volumeSliderId = "np-volume-slider";
    const handleVolumeMouseDown = (event: any) => {
      if (event.button !== 0 || !onSetVolume) return;
      const target = event.target as { x?: number; width?: number; parent?: { x?: number; width?: number } } | undefined;
      const sliderX = target?.parent?.x ?? target?.x ?? 0;
      const sliderWidth = target?.parent?.width ?? target?.width ?? volumeSliderWidth;
      const ratio = sliderWidth <= 1 ? 0 : (event.x - sliderX) / Math.max(1, sliderWidth - 1);
      const nextVolume = Math.max(0, Math.min(100, Math.round(ratio * 100)));
      onSetVolume(nextVolume);
    };
    const volumeSlider = Box({
      id: volumeSliderId,
      width: volumeSliderWidth,
      height: 1,
      flexDirection: "row",
      onMouseDown: handleVolumeMouseDown,
      onClick: handleVolumeMouseDown,
    });
    const volumeSegments = renderMeterSegments(volume, 100, volumeSliderWidth, "●");
    if (volumeSegments.filled) {
      volumeSlider.add(Text({ content: volumeSegments.filled, fg: PLAYER_COLORS.cool }) as any);
    }
    if (volumeSegments.marker) {
      volumeSlider.add(Text({ content: volumeSegments.marker, fg: PLAYER_COLORS.energyGlow }) as any);
    }
    if (volumeSegments.empty) {
      volumeSlider.add(Text({ content: volumeSegments.empty, fg: PLAYER_COLORS.mutedRail }) as any);
    }
    volumeRow.add(volumeSlider as any);
    side.add(volumeRow as any);
    side.add(Box({ height: 1 }) as any);
    side.add(renderVisualizerThemeSelector(visualizerThemeId, onSetVisualizerTheme) as any);
    bodyRow.add(side as any);
  }

  const controlsRow = Box({
    id: "np-controls-row",
    width: "100%",
    height: FOOTER_CONTROL_ROW_HEIGHT,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: 2,
    paddingRight: 2,
  });

  const controls = renderTransportControls({
    idPrefix: "np",
    shuffleOn,
    repeatMode,
    isPlaying,
    onToggleShuffle,
    onSkipPrevious,
    onTogglePlayPause,
    onSkipNext,
    onCycleRepeat,
    onExpandPlayer: track ? onExpandPlayer : undefined,
    scale: FOOTER_CONTROL_SCALE,
    includeExpand: Boolean(track && onExpandPlayer),
  });
  controlsRow.add(controls as any);

  bar.add(bodyRow as any);
  bar.add(controlsRow as any);

  if (track) {
    const progressRow = Box({
      id: "np-progress-row",
      width: "100%",
      height: 1,
      flexDirection: "row",
      alignItems: "center",
      paddingLeft: 2,
      paddingRight: 2,
    });
    const visualizerWidth = Math.max(24, width - 16);
    progressRow.add(Text({
      id: "np-elapsed",
      content: formatDuration(progress),
      fg: theme.textDim,
      width: 6,
    }) as any);
    progressRow.add(Text({
      id: "np-visualizer",
      content: renderNowPlayingVisualizer(track.id, progress, visualizerWidth, isPlaying),
      fg: isPlaying ? visualizerTheme.color : theme.textDim,
      width: visualizerWidth,
    }) as any);
    progressRow.add(Text({
      id: "np-remaining",
      content: `-${formatDuration(Math.max(0, duration - progress))}`,
      fg: theme.textDim,
      width: 6,
    }) as any);
    bar.add(progressRow as any);
  }

  return bar;
}
