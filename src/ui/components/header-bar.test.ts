import { afterEach, expect, test } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { renderHeaderBar } from "./header-bar.js";

const renderers: { destroy: () => void }[] = [];

afterEach(() => {
  while (renderers.length > 0) {
    renderers.pop()?.destroy();
  }
});

test("header bar shows a clickable back button when requested", async () => {
  const { renderer, mockMouse, renderOnce } = await createTestRenderer({
    width: 80,
    height: 8,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  let clicked = 0;
  renderer.root.add(renderHeaderBar("Playlist", {
    canGoBack: true,
    onBackClick: () => {
      clicked += 1;
    },
  }) as any);

  await renderOnce();

  const backButton = renderer.root.findDescendantById("header-back-button") as any;
  expect(backButton).toBeTruthy();
  await mockMouse.click(backButton.x + 1, backButton.y + 1);
  expect(clicked).toBe(1);
});

test("header bar suppresses duplicate back presses from nested mouse targets", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 80,
    height: 8,
    useMouse: true,
    testing: true,
  });
  renderers.push(renderer);

  let clicked = 0;
  renderer.root.add(renderHeaderBar("Now Playing", {
    canGoBack: true,
    onBackClick: () => {
      clicked += 1;
    },
  }) as any);

  await renderOnce();

  const backButton = renderer.root.findDescendantById("header-back-button") as any;
  const backLabel = backButton.getChildren()[0] as any;
  const event = { button: 0 };

  backButton._mouseListeners.down(event);
  backLabel._mouseListeners.down(event);

  expect(clicked).toBe(1);
});
