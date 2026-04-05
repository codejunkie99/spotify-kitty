import { afterEach, expect, test } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { renderLibrarySidebar } from "./library-sidebar.js";

const renderers: { destroy: () => void }[] = [];

afterEach(() => {
  while (renderers.length > 0) {
    renderers.pop()?.destroy();
  }
});

test("clicking a sidebar item invokes its click handler", async () => {
  const { renderer, mockMouse, renderOnce } = await createTestRenderer({
    width: 80,
    height: 30,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  let clickedId = "";
  renderer.root.add(renderLibrarySidebar([
    { id: "__home", name: "Home", kind: "home" },
    { id: "__liked", name: "Liked Songs", kind: "liked" },
  ], 0, 28, false, (_index, item) => {
    clickedId = item.id;
  }) as any);

  await renderOnce();

  const target = renderer.root.findDescendantById("sidebar-__liked") as any;
  await mockMouse.click(target.x + 2, target.y);

  expect(clickedId).toBe("__liked");
});
