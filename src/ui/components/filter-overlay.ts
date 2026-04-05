import { Box, Text } from "@opentui/core";
import { theme } from "../theme.js";

export function renderFilterOverlay(
  query: string,
  resultsLabel: string,
  placeholder = "Filter current list",
): ReturnType<typeof Box> {
  const overlay = Box({
    id: "inline-filter-overlay",
    position: "absolute",
    top: 1,
    right: 2,
    width: "42%",
    minWidth: 24,
    zIndex: 10,
    flexDirection: "column",
    backgroundColor: theme.surface,
    borderRadius: 6,
    borderColor: theme.accent,
    border: 1,
    padding: 1,
  });

  const inputRow = Box({ width: "100%", flexDirection: "row" });
  inputRow.add(Text({ content: "/ ", color: theme.accent, fontWeight: "bold" }) as any);
  inputRow.add(Text({
    content: query || placeholder,
    color: query ? theme.text : theme.textDim,
  }) as any);
  overlay.add(inputRow as any);

  overlay.add(Text({
    content: resultsLabel,
    color: theme.textDim,
    fontSize: 1,
  }) as any);

  return overlay;
}
