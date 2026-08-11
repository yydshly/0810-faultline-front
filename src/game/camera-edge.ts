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

export interface CameraPanBounds {
  minimum: number;
  maximum: number;
  softZone: number;
}

export const DEFAULT_EDGE_PAN_MARGIN = 36;
export const DEFAULT_VIEWPORT_EDGE_PAN_MARGIN = DEFAULT_EDGE_PAN_MARGIN;
export const DEFAULT_POINTER_EXIT_EDGE_TOLERANCE = 12;
export const DEFAULT_CAMERA_ELEVATION_RADIANS = (55 * Math.PI) / 180;
export const DEFAULT_CAMERA_PAN_ACCELERATION = 4;
export const DEFAULT_CAMERA_PAN_DECELERATION = 14;
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

/** Keep the last physical-edge intent when the pointer crosses into browser chrome. */
export function retainedViewportEdgePointer(
  pointer: PointerPosition,
  viewport: ViewportSize,
  tolerance = DEFAULT_POINTER_EXIT_EDGE_TOLERANCE,
): PointerPosition | null {
  const values = [pointer.x, pointer.y, viewport.width, viewport.height, tolerance];
  if (!values.every(Number.isFinite) || viewport.width <= 0 || viewport.height <= 0 || tolerance < 0) {
    return null;
  }
  const withinHorizontalExit = pointer.x >= -tolerance && pointer.x <= viewport.width + tolerance;
  const withinVerticalExit = pointer.y >= -tolerance && pointer.y <= viewport.height + tolerance;
  const atLeft = withinVerticalExit && pointer.x <= tolerance && pointer.x >= -tolerance;
  const atRight = withinVerticalExit
    && pointer.x >= viewport.width - tolerance
    && pointer.x <= viewport.width + tolerance;
  const atTop = withinHorizontalExit && pointer.y <= tolerance && pointer.y >= -tolerance;
  const atBottom = withinHorizontalExit
    && pointer.y >= viewport.height - tolerance
    && pointer.y <= viewport.height + tolerance;
  if (!atLeft && !atRight && !atTop && !atBottom) return null;
  return {
    x: atLeft ? 0 : atRight ? viewport.width : Math.min(viewport.width, Math.max(0, pointer.x)),
    y: atTop ? 0 : atBottom ? viewport.height : Math.min(viewport.height, Math.max(0, pointer.y)),
  };
}

export function screenPanToWorldPan(
  screenX: number,
  screenY: number,
  cameraYawRadians = Math.PI / 4,
  cameraElevationRadians = DEFAULT_CAMERA_ELEVATION_RADIANS,
): CameraPanDirection {
  if (![screenX, screenY, cameraYawRadians, cameraElevationRadians].every(Number.isFinite)) {
    return { x: 0, z: 0 };
  }
  const elevationProjection = Math.sin(cameraElevationRadians);
  if (Math.abs(elevationProjection) < 1e-6) return { x: 0, z: 0 };
  const cosine = Math.cos(cameraYawRadians);
  const sine = Math.sin(cameraYawRadians);
  const projectedScreenY = screenY / elevationProjection;
  return {
    x: screenX * cosine + projectedScreenY * sine,
    z: -screenX * sine + projectedScreenY * cosine,
  };
}

export function limitCameraPanMagnitude(
  direction: CameraPanDirection,
  maximum: number,
): CameraPanDirection {
  if (![direction.x, direction.z, maximum].every(Number.isFinite) || maximum <= 0) {
    return { x: 0, z: 0 };
  }
  const magnitude = Math.hypot(direction.x, direction.z);
  if (magnitude <= maximum || magnitude <= 1e-6) return { ...direction };
  const scale = maximum / magnitude;
  return { x: direction.x * scale, z: direction.z * scale };
}

export function smoothCameraPanVelocity(
  current: CameraPanDirection,
  target: CameraPanDirection,
  deltaSeconds: number,
  acceleration = DEFAULT_CAMERA_PAN_ACCELERATION,
  deceleration = DEFAULT_CAMERA_PAN_DECELERATION,
): CameraPanDirection {
  const values = [
    current.x, current.z, target.x, target.z,
    deltaSeconds, acceleration, deceleration,
  ];
  if (!values.every(Number.isFinite) || deltaSeconds <= 0 || acceleration <= 0 || deceleration <= 0) {
    return { x: 0, z: 0 };
  }
  const currentMagnitude = Math.hypot(current.x, current.z);
  const targetMagnitude = Math.hypot(target.x, target.z);
  const aligned = current.x * target.x + current.z * target.z >= 0;
  const rate = aligned && targetMagnitude > currentMagnitude ? acceleration : deceleration;
  const alpha = 1 - Math.exp(-rate * Math.min(deltaSeconds, 0.2));
  const next = {
    x: current.x + (target.x - current.x) * alpha,
    z: current.z + (target.z - current.z) * alpha,
  };
  if (targetMagnitude <= 1e-6 && Math.hypot(next.x, next.z) < 0.01) return { x: 0, z: 0 };
  return next;
}

function smoothBoundaryScale(distance: number, softZone: number): number {
  if (softZone <= 0 || distance >= softZone) return 1;
  const normalized = Math.min(1, Math.max(0, distance / softZone));
  return normalized * normalized * (3 - 2 * normalized);
}

/** Slow and clamp a pan as one vector so an isometric direction never shears at a world edge. */
export function boundedCameraPanDelta(
  current: CameraPanDirection,
  requested: CameraPanDirection,
  bounds: CameraPanBounds,
): CameraPanDirection {
  const values = [
    current.x, current.z, requested.x, requested.z,
    bounds.minimum, bounds.maximum, bounds.softZone,
  ];
  if (!values.every(Number.isFinite) || bounds.maximum <= bounds.minimum || bounds.softZone < 0) {
    return { x: 0, z: 0 };
  }

  let scale = 1;
  if (requested.x < 0) {
    scale = Math.min(scale, smoothBoundaryScale(current.x - bounds.minimum, bounds.softZone));
  } else if (requested.x > 0) {
    scale = Math.min(scale, smoothBoundaryScale(bounds.maximum - current.x, bounds.softZone));
  }
  if (requested.z < 0) {
    scale = Math.min(scale, smoothBoundaryScale(current.z - bounds.minimum, bounds.softZone));
  } else if (requested.z > 0) {
    scale = Math.min(scale, smoothBoundaryScale(bounds.maximum - current.z, bounds.softZone));
  }

  const scaled = { x: requested.x * scale, z: requested.z * scale };
  let crossingScale = 1;
  if (scaled.x < 0 && current.x + scaled.x < bounds.minimum) {
    crossingScale = Math.min(crossingScale, (bounds.minimum - current.x) / scaled.x);
  } else if (scaled.x > 0 && current.x + scaled.x > bounds.maximum) {
    crossingScale = Math.min(crossingScale, (bounds.maximum - current.x) / scaled.x);
  }
  if (scaled.z < 0 && current.z + scaled.z < bounds.minimum) {
    crossingScale = Math.min(crossingScale, (bounds.minimum - current.z) / scaled.z);
  } else if (scaled.z > 0 && current.z + scaled.z > bounds.maximum) {
    crossingScale = Math.min(crossingScale, (bounds.maximum - current.z) / scaled.z);
  }
  crossingScale = Math.min(1, Math.max(0, crossingScale));
  return { x: scaled.x * crossingScale, z: scaled.z * crossingScale };
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
