interface RectLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function doesRectIntersectWithin(rect: RectLike, viewport: RectLike): boolean {
  if (rect.width <= 0 || rect.height <= 0 || viewport.width <= 0 || viewport.height <= 0) {
    return false;
  }

  const rectRight = rect.x + rect.width;
  const rectBottom = rect.y + rect.height;
  const viewportRight = viewport.x + viewport.width;
  const viewportBottom = viewport.y + viewport.height;

  return (
    rectRight > viewport.x &&
    rectBottom > viewport.y &&
    rect.x < viewportRight &&
    rect.y < viewportBottom
  );
}

export function isRectFullyVisibleWithin(rect: RectLike, viewport: RectLike): boolean {
  if (rect.width <= 0 || rect.height <= 0 || viewport.width <= 0 || viewport.height <= 0) {
    return false;
  }

  const rectRight = rect.x + rect.width;
  const rectBottom = rect.y + rect.height;
  const viewportRight = viewport.x + viewport.width;
  const viewportBottom = viewport.y + viewport.height;

  return (
    rect.x >= viewport.x &&
    rect.y >= viewport.y &&
    rectRight <= viewportRight &&
    rectBottom <= viewportBottom
  );
}
