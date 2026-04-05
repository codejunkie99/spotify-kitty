import { Box, Text } from "@opentui/core";
import { theme } from "../theme.js";

export function renderStatusBar(status: string, hints: string): ReturnType<typeof Box> {
  return Box(
    {
      width: "100%",
      height: 3,
      backgroundColor: theme.surface,
      flexDirection: "row",
      alignItems: "center",
      paddingLeft: 2,
      paddingRight: 2,
    },
    Text({ content: hints, color: theme.textDim }),
    Box({ flexGrow: 1 }),
    Text({ content: status, color: theme.accent }),
  );
}
