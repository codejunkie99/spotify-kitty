import { Box, Text } from "@opentui/core";
import type { KeyEvent } from "@opentui/core";
import type { SpotifyPlayState } from "../../types.js";
import { formatDuration } from "../../lib/format.js";
import { theme } from "../theme.js";
import { getSquareCoverHeight } from "../media/cover-sizing.js";
import {
  PLAYER_COLORS,
  getVisualizerTheme,
  renderMeterSegments,
  renderNowPlayingVisualizer,
  renderTransportControls,
  type VisualizerThemeId,
} from "../components/now-playing-bar.js";
import { truncateTerminalText } from "../lib/terminal-text.js";
import type { SpotifyView, ViewContext, ViewDescriptor } from "./contracts.js";

interface PlayerViewController {
  getPlayState: () => SpotifyPlayState | null;
  getShuffleOn: () => boolean;
  getRepeatMode: () => "off" | "track" | "context";
  getVisualizerThemeId: () => VisualizerThemeId;
  toggleShuffle: () => void;
  skipPrevious: () => void;
  togglePlayPause: () => void;
  skipNext: () => void;
  cycleRepeat: () => void;
  setVolume: (value: number) => void;
}

export class PlayerView implements SpotifyView {
  public constructor(
    private readonly ctx: ViewContext,
    private readonly controller: PlayerViewController,
  ) {}

  public onEnter(): void {
    this.ctx.setStatus("Fullscreen player");
  }

  public onExit(): void {
    this.ctx.setStatus("Ready");
  }

  public render(): ViewDescriptor {
    const playState = this.controller.getPlayState();
    const track = playState?.item ?? null;
    const isPlaying = playState?.is_playing ?? false;
    const progress = playState?.progress_ms ?? 0;
    const duration = track?.duration_ms ?? 0;
    const volume = playState?.device?.volume_percent ?? 50;
    const visualizerTheme = getVisualizerTheme(this.controller.getVisualizerThemeId());
    const width = this.ctx.renderer.width;
    const content = Box({
      id: "immersive-player-view",
      width: "100%",
      height: "100%",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 2,
      paddingBottom: 2,
      paddingLeft: 4,
      paddingRight: 4,
      backgroundColor: theme.background,
    });

    if (!track) {
      const empty = Box({
        width: "100%",
        flexGrow: 1,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      });
      empty.add(Text({
        content: "Nothing is playing",
        color: theme.text,
        fontWeight: "bold",
        fontSize: 2,
      }) as any);
      empty.add(Text({
        content: "Start a song from Home, Search, or a playlist.",
        color: theme.textSecondary,
      }) as any);
      content.add(empty as any);
      return {
        title: "Now Playing",
        hints: "Esc back",
        immersive: true,
        content,
      };
    }

    const coverWidth = Math.max(24, Math.min(40, Math.floor((width - 20) * 0.34)));
    const coverHeight = getSquareCoverHeight(this.ctx.renderer, coverWidth);
    const coverShellWidth = coverWidth + 4;
    const coverShellHeight = coverHeight + 2;
    const textWidth = Math.max(30, Math.min(width - 16, 80));
    const visualizerWidth = Math.max(28, Math.min(textWidth, 64));
    const progressWidth = Math.max(24, Math.min(width - 34, 72));
    const hero = Box({
      width: "100%",
      flexGrow: 1,
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
    });

    const coverShell = Box({
      id: "player-art-shell",
      width: coverShellWidth,
      height: coverShellHeight,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surface,
      borderRadius: 6,
      marginBottom: 2,
    });
    coverShell.add(Box({
      id: "np-art",
      width: coverWidth,
      height: coverHeight,
      backgroundColor: theme.surfaceHover,
      borderRadius: 4,
    }) as any);
    hero.add(coverShell as any);

    hero.add(Text({
      id: "player-title",
      content: truncateTerminalText(track.name, textWidth),
      fg: theme.text,
      fontWeight: "bold",
      fontSize: 2,
    }) as any);
    hero.add(Text({
      id: "player-artist",
      content: truncateTerminalText(track.artists.map((artist) => artist.name).join(", "), textWidth),
      fg: theme.textSecondary,
      fontSize: 1,
    }) as any);
    hero.add(Text({
      id: "player-visualizer",
      content: renderNowPlayingVisualizer(track.id, progress, visualizerWidth, isPlaying),
      fg: visualizerTheme.color,
      fontSize: 1,
    }) as any);
    hero.add(Box({ height: 1 }) as any);

    const controlsRow = Box({
      id: "player-controls-row",
      width: "100%",
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 1,
    });
    controlsRow.add(renderTransportControls({
      idPrefix: "player",
      shuffleOn: this.controller.getShuffleOn(),
      repeatMode: this.controller.getRepeatMode(),
      isPlaying,
      onToggleShuffle: () => { this.controller.toggleShuffle(); },
      onSkipPrevious: () => { this.controller.skipPrevious(); },
      onTogglePlayPause: () => { this.controller.togglePlayPause(); },
      onSkipNext: () => { this.controller.skipNext(); },
      onCycleRepeat: () => { this.controller.cycleRepeat(); },
      scale: 2,
    }) as any);
    hero.add(controlsRow as any);

    const progressRow = Box({
      id: "player-progress-row",
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 1,
    });
    progressRow.add(Text({
      content: formatDuration(progress),
      fg: theme.textDim,
      width: 5,
    }) as any);
    const progressBar = Box({
      id: "player-progress-bar",
      width: progressWidth,
      flexDirection: "row",
      marginLeft: 2,
      marginRight: 2,
    });
    const progressSegments = renderMeterSegments(progress, Math.max(duration, 1), progressWidth, "◉");
    if (progressSegments.filled) {
      progressBar.add(Text({ content: progressSegments.filled, fg: PLAYER_COLORS.energy }) as any);
    }
    if (progressSegments.marker) {
      progressBar.add(Text({ content: progressSegments.marker, fg: PLAYER_COLORS.warm }) as any);
    }
    if (progressSegments.empty) {
      progressBar.add(Text({ content: progressSegments.empty, fg: PLAYER_COLORS.mutedRail }) as any);
    }
    progressRow.add(progressBar as any);
    progressRow.add(Text({
      content: `-${formatDuration(Math.max(0, duration - progress))}`,
      fg: theme.textDim,
      width: 7,
    }) as any);
    hero.add(progressRow as any);

    const volumeRow = Box({
      id: "player-volume-row",
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    });
    volumeRow.add(Text({
      content: `Vol ${volume}%`,
      fg: PLAYER_COLORS.cool,
      width: 9,
    }) as any);
    const volumeSliderWidth = Math.max(12, Math.min(24, Math.floor(width * 0.16)));
    const handleVolumeMouseDown = (event: any) => {
      if (event.button !== 0) return;
      const target = event.target as { x?: number; width?: number; parent?: { x?: number; width?: number } } | undefined;
      const sliderX = target?.parent?.x ?? target?.x ?? 0;
      const sliderWidth = target?.parent?.width ?? target?.width ?? volumeSliderWidth;
      const ratio = sliderWidth <= 1 ? 0 : (event.x - sliderX) / Math.max(1, sliderWidth - 1);
      const nextVolume = Math.max(0, Math.min(100, Math.round(ratio * 100)));
      this.controller.setVolume(nextVolume);
    };
    const volumeSlider = Box({
      id: "player-volume-slider",
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
    hero.add(volumeRow as any);

    content.add(hero as any);

    return {
      title: "Now Playing",
      hints: "Esc back  Space play/pause  n next  p previous",
      immersive: true,
      content,
    };
  }

  public handleKey(_key: KeyEvent): boolean {
    return false;
  }
}
