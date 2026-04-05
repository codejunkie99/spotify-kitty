import { Box, Text } from "@opentui/core";
import { theme } from "../theme.js";

interface HeaderBarOptions {
  canGoBack?: boolean;
  onBackClick?: () => void;
}

export function renderHeaderBar(
  title: string,
  options: HeaderBarOptions = {},
): ReturnType<typeof Box> {
  const bar = Box({
    width: "100%",
    height: 3,
    backgroundColor: theme.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 1,
    paddingRight: 2,
  });

  if (options.canGoBack) {
    const label = "‹ Back";
    let lastPressAt = 0;
    const handleBackPress = (event: any) => {
      if (event.button !== 0) return;
      const now = Date.now();
      if (now - lastPressAt < 150) return;
      lastPressAt = now;
      options.onBackClick?.();
    };
    const backButton = Box({
      id: "header-back-button",
      width: label.length + 2,
      height: 2,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surfaceHover,
      borderRadius: 4,
      marginRight: 2,
      onMouseDown: handleBackPress,
      onClick: handleBackPress,
    });
    backButton.add(Text({
      content: label,
      color: theme.accent,
      fontWeight: "bold",
      onMouseDown: handleBackPress,
      onClick: handleBackPress,
    }) as any);
    bar.add(backButton as any);
  }

  bar.add(Text({ content: "spotify-kitty", color: theme.accent, fontWeight: "bold" }) as any);
  bar.add(Text({ content: "  |  ", color: theme.textDim }) as any);
  bar.add(Text({ content: title, color: theme.text }) as any);

  return bar;
}
