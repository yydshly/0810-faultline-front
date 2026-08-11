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
  x: number;
  z: number;
}

export const DEFAULT_EDGE_PAN_MARGIN = 36;

function edgePanAxis(position: number, minimum: number, maximum: number, margin: number): number {
  if (margin <= 0) return 0;
  if (position <= minimum + margin) {
    const depth = Math.min(1, Math.max(0, (minimum + margin - position) / margin));
    return -Math.sqrt(depth);
  }
  if (position >= maximum - margin) {
    const depth = Math.min(1, Math.max(0, (position - (maximum - margin)) / margin));
    return Math.sqrt(depth);
  }
  return 0;
}

/** Resolve edge scrolling against the visible part of a possibly clipped stage. */
export function visibleStageEdgePanDirection(
  pointer: PointerPosition,
  stage: StageViewportRect,
  viewport: ViewportSize,
  requestedMargin = DEFAULT_EDGE_PAN_MARGIN,
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
  const x = edgePanAxis(pointer.x, left, right, horizontalMargin);
  const z = edgePanAxis(pointer.y, top, bottom, verticalMargin);
  return { x, z };
}
