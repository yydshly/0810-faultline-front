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
export const DEFAULT_VIEWPORT_EDGE_PAN_MARGIN = 12;
export const EDGE_PAN_BLOCKING_SELECTOR = [
  'button',
  'a',
  'input',
  'select',
  'textarea',
  '[role="button"]',
  '[role="dialog"]',
  '.ff-minimap-panel',
].join(',');

export function screenPanToWorldPan(
  screenX: number,
  screenY: number,
  cameraYawRadians = Math.PI / 4,
): CameraPanDirection {
  if (![screenX, screenY, cameraYawRadians].every(Number.isFinite)) return { x: 0, z: 0 };
  const cosine = Math.cos(cameraYawRadians);
  const sine = Math.sin(cameraYawRadians);
  return {
    x: screenX * cosine + screenY * sine,
    z: -screenX * sine + screenY * cosine,
  };
}

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
  requestedViewportMargin = DEFAULT_VIEWPORT_EDGE_PAN_MARGIN,
): CameraPanDirection {
  const values = [
    pointer.x, pointer.y,
    stage.left, stage.top, stage.right, stage.bottom,
    viewport.width, viewport.height,
    requestedMargin, requestedViewportMargin,
  ];
  if (!values.every(Number.isFinite) || viewport.width <= 0 || viewport.height <= 0) {
    return { x: 0, z: 0 };
  }

  const left = Math.max(0, stage.left);
  const right = Math.min(viewport.width, stage.right);
  const top = Math.max(0, stage.top);
  const bottom = Math.min(viewport.height, stage.bottom);
  if (right <= left || bottom <= top) return { x: 0, z: 0 };
  if (pointer.x < 0 || pointer.x > viewport.width || pointer.y < 0 || pointer.y > viewport.height) {
    return { x: 0, z: 0 };
  }

  const horizontalMargin = Math.min(Math.max(0, requestedMargin), (right - left) / 2);
  const verticalMargin = Math.min(Math.max(0, requestedMargin), (bottom - top) / 2);
  const insideStage = pointer.x >= left && pointer.x <= right && pointer.y >= top && pointer.y <= bottom;
  let x = insideStage ? edgePanAxis(pointer.x, left, right, horizontalMargin) : 0;
  let z = insideStage ? edgePanAxis(pointer.y, top, bottom, verticalMargin) : 0;

  const viewportHorizontalMargin = Math.min(
    Math.max(0, requestedViewportMargin),
    viewport.width / 2,
  );
  const viewportVerticalMargin = Math.min(
    Math.max(0, requestedViewportMargin),
    viewport.height / 2,
  );
  const viewportX = edgePanAxis(pointer.x, 0, viewport.width, viewportHorizontalMargin);
  const viewportZ = edgePanAxis(pointer.y, 0, viewport.height, viewportVerticalMargin);
  if (Math.abs(viewportX) > Math.abs(x)) x = viewportX;
  if (Math.abs(viewportZ) > Math.abs(z)) z = viewportZ;
  return { x, z };
}
