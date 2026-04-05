import { Box, ScrollBox, Text } from "@opentui/core";
import { theme } from "../theme.js";
import { truncateTerminalText } from "../lib/terminal-text.js";

export interface SidebarItem {
  id: string;
  name: string;
  kind: "playlist" | "album" | "artist" | "liked" | "queue" | "home";
  section?: boolean;
}

export function renderLibrarySidebar(
  items: SidebarItem[],
  selectedIndex: number,
  sidebarWidth: number,
  focused: boolean,
  onItemClick?: (index: number, item: SidebarItem) => void,
): ReturnType<typeof Box> {
  const sidebar = Box({
    id: "library-sidebar",
    width: sidebarWidth,
    height: "100%",
    flexDirection: "column",
    backgroundColor: theme.surface,
    borderRight: 1,
    borderColor: focused ? theme.accent : theme.border,
  });

  const header = Box({ width: "100%", paddingLeft: 1, paddingTop: 1, marginBottom: 1 });
  header.add(Text({ content: "Your Library", color: theme.text, fontWeight: "bold" }) as any);
  sidebar.add(header as any);

  const maxW = sidebarWidth - 4;
  const scroll = ScrollBox({
    id: "library-sidebar-scroll",
    width: "100%",
    flexGrow: 1,
    viewportCulling: true,
    rootOptions: { backgroundColor: theme.surface },
    contentOptions: { paddingBottom: 1 },
  });

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (item.section) {
      const sectionRow = Box({
        id: `sidebar-${item.id}`,
        width: "100%",
        paddingLeft: 1,
        marginTop: 1,
      });
      sectionRow.add(
        Text({
          content: truncateTerminalText(item.name, maxW),
          color: theme.textDim,
          fontWeight: "bold",
          fontSize: 1,
        }) as any,
      );
      scroll.add(sectionRow as any);
      continue;
    }

    const sel = i === selectedIndex && focused;
    const bg = sel ? theme.surfaceHover : "transparent";
    const icon =
      item.kind === "liked" ? "♥" :
      item.kind === "queue" ? "≡" :
      item.kind === "home" ? "⌂" :
      item.kind === "album" ? "◉" :
      item.kind === "playlist" ? "♪" : "♫";

    const row = Box({
      id: `sidebar-${item.id}`,
      width: "100%",
      backgroundColor: bg,
      paddingLeft: 1,
      onMouseDown: (event: any) => {
        if (event.button !== 0) return;
        onItemClick?.(i, item);
      },
    });
    row.add(
      Text({
        content: `${icon} ${truncateTerminalText(item.name, maxW - 2)}`,
        color: sel ? theme.accent : theme.text,
        fontSize: 1,
      }) as any,
    );
    scroll.add(row as any);
  }

  sidebar.add(scroll as any);
  return sidebar;
}
