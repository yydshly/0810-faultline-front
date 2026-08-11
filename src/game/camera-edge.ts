export interface StageViewportRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface PointerPosition {
  x: number;
  y: number;
}

export interface CameraPanDirection {
  x: -1 | 0 | 1;
  z: -1 | 0 | 1;
}

/** Resolve edge scrolling against the visible part of a possibly clipped stage. */
export function visibleStageEdgePanDirection(
  pointer: PointerPosition,
  stage: StageViewportRect,
  viewport: ViewportSize,
  requestedMargin = 14,
): CameraPanDirection {
  const values = [
    pointer.x, pointer.y,
    stage.left, stage.top, stage.right, stage.bottom,
    viewport.width, viewport.height,
    requestedMargin,
  ];
  if (!values.every(Number.isFinite) || viewport.width <= 0 || viewport.height <= 0) {
    return { x: 0, z: 0 };
  }

  const left = Math.max(0, stage.left);
  const right = Math.min(viewport.width, stage.right);
  const top = Math.max(0, stage.top);
  const bottom = Math.min(viewport.height, stage.bottom);
  if (right <= left || bottom <= top) return { x: 0, z: 0 };
  if (pointer.x < left || pointer.x > right || pointer.y < top || pointer.y > bottom) {
    return { x: 0, z: 0 };
  }

  const horizontalMargin = Math.min(Math.max(0, requestedMargin), (right - left) / 2);
  const verticalMargin = Math.min(Math.max(0, requestedMargin), (bottom - top) / 2);
  const x = pointer.x <= left + horizontalMargin
    ? -1
    : pointer.x >= right - horizontalMargin
      ? 1
      : 0;
  const z = pointer.y <= top + verticalMargin
    ? -1
    : pointer.y >= bottom - verticalMargin
      ? 1
      : 0;
  return { x, z };
}
