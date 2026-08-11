export type PresentationLodTier = 'lod0' | 'lod1' | 'lod2' | 'culled';
export type RenderablePresentationLodTier = Exclude<PresentationLodTier, 'culled'>;

export interface PresentationLodThresholds {
  /** Minimum projected height needed for LOD0. */
  lod0MinPixels: number;
  /** Minimum projected height needed for LOD1. Smaller entities use LOD2. */
  lod1MinPixels: number;
  /** Maximum camera-target planar distance for LOD0. */
  lod0MaxDistance: number;
  /** Maximum camera-target planar distance for LOD1. More distant entities use LOD2. */
  lod1MaxDistance: number;
  /** Boundary expansion/contraction used to prevent flicker. Defaults to 15%. */
  hysteresisRatio?: number;
}

export interface PresentationLodSelectionInput {
  projectedHeightPx: number;
  planarDistance: number;
  insideExpandedView: boolean;
  previousTier?: PresentationLodTier;
  /** Selected, hit, firing, or otherwise critical entities can force full detail. */
  forceLod0?: boolean;
}

export interface PresentationUpdateCadence {
  lod0: number;
  lod1: number;
  lod2: number;
}

export interface FlatWorldPoint {
  x: number;
  z: number;
}

export interface FlatWorldBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const DEFAULT_PRESENTATION_LOD_THRESHOLDS: Readonly<PresentationLodThresholds> = {
  lod0MinPixels: 34,
  lod1MinPixels: 16,
  lod0MaxDistance: 30,
  lod1MaxDistance: 60,
  hysteresisRatio: 0.15,
};

export const DEFAULT_PRESENTATION_UPDATE_CADENCE: Readonly<PresentationUpdateCadence> = {
  lod0: 1,
  lod1: 2,
  lod2: 4,
};

const finiteNonNegative = (value: number, fallback: number): number => (
  Number.isFinite(value) ? Math.max(0, value) : fallback
);

const validateThresholds = (thresholds: PresentationLodThresholds): Required<PresentationLodThresholds> => {
  const {
    lod0MinPixels,
    lod1MinPixels,
    lod0MaxDistance,
    lod1MaxDistance,
    hysteresisRatio = 0.15,
  } = thresholds;
  if (![lod0MinPixels, lod1MinPixels, lod0MaxDistance, lod1MaxDistance, hysteresisRatio].every(Number.isFinite)) {
    throw new TypeError('LOD thresholds must be finite numbers.');
  }
  if (lod0MinPixels < 0 || lod1MinPixels < 0 || lod0MaxDistance < 0 || lod1MaxDistance < 0) {
    throw new RangeError('LOD pixel and distance thresholds must be non-negative.');
  }
  if (lod0MinPixels < lod1MinPixels) {
    throw new RangeError('lod0MinPixels must be greater than or equal to lod1MinPixels.');
  }
  if (lod0MaxDistance > lod1MaxDistance) {
    throw new RangeError('lod0MaxDistance must be less than or equal to lod1MaxDistance.');
  }
  if (hysteresisRatio < 0 || hysteresisRatio >= 0.5) {
    throw new RangeError('hysteresisRatio must be in the range [0, 0.5).');
  }
  return { lod0MinPixels, lod1MinPixels, lod0MaxDistance, lod1MaxDistance, hysteresisRatio };
};

/** Project a world-space height into pixels for an orthographic camera. */
export function orthographicProjectedHeightPx(
  worldHeight: number,
  orthographicViewHeight: number,
  viewportHeightPx: number,
): number {
  if (!Number.isFinite(worldHeight)
    || !Number.isFinite(orthographicViewHeight)
    || !Number.isFinite(viewportHeightPx)
    || worldHeight <= 0
    || orthographicViewHeight <= 0
    || viewportHeightPx <= 0) return 0;
  return (worldHeight / orthographicViewHeight) * viewportHeightPx;
}

const passesDetailBoundary = (
  projectedHeightPx: number,
  planarDistance: number,
  minPixels: number,
  maxDistance: number,
  previouslyOnDetailedSide: boolean,
  hysteresisRatio: number,
): boolean => {
  const pixelMultiplier = previouslyOnDetailedSide ? 1 - hysteresisRatio : 1 + hysteresisRatio;
  const distanceMultiplier = previouslyOnDetailedSide ? 1 + hysteresisRatio : 1 - hysteresisRatio;
  return projectedHeightPx >= minPixels * pixelMultiplier
    && planarDistance <= maxDistance * distanceMultiplier;
};

/**
 * Select a detail tier with symmetric hysteresis around both pixel and planar
 * distance boundaries. An entity must be comfortably across a boundary to
 * upgrade, while a current tier is retained until it crosses the relaxed edge.
 */
export function selectPresentationLodTier(
  input: PresentationLodSelectionInput,
  thresholds: PresentationLodThresholds = DEFAULT_PRESENTATION_LOD_THRESHOLDS,
): PresentationLodTier {
  if (!input.insideExpandedView) return 'culled';
  if (input.forceLod0) return 'lod0';

  const validated = validateThresholds(thresholds);
  const projectedHeightPx = finiteNonNegative(input.projectedHeightPx, 0);
  const planarDistance = finiteNonNegative(input.planarDistance, Number.POSITIVE_INFINITY);
  const previousTier = input.previousTier;
  const keepsLod0 = previousTier === 'lod0';
  const keepsAtLeastLod1 = previousTier === 'lod0' || previousTier === 'lod1';

  if (passesDetailBoundary(
    projectedHeightPx,
    planarDistance,
    validated.lod0MinPixels,
    validated.lod0MaxDistance,
    keepsLod0,
    validated.hysteresisRatio,
  )) return 'lod0';

  if (passesDetailBoundary(
    projectedHeightPx,
    planarDistance,
    validated.lod1MinPixels,
    validated.lod1MaxDistance,
    keepsAtLeastLod1,
    validated.hysteresisRatio,
  )) return 'lod1';

  return 'lod2';
}

const LOD_RANK: Readonly<Record<RenderablePresentationLodTier, number>> = {
  lod0: 0,
  lod1: 1,
  lod2: 2,
};

const RENDERABLE_LOD_TIERS: readonly RenderablePresentationLodTier[] = ['lod0', 'lod1', 'lod2'];

/**
 * Resolve a requested tier without silently substituting a lower-quality mesh.
 * Missing LOD1/LOD2 assets therefore fall back toward LOD0. `null` means the
 * entity is culled or no equal/higher-quality representation is available.
 */
export function resolveAvailablePresentationLod(
  requestedTier: PresentationLodTier,
  availableTiers: ReadonlySet<RenderablePresentationLodTier> | readonly RenderablePresentationLodTier[],
): RenderablePresentationLodTier | null {
  if (requestedTier === 'culled') return null;
  const available = availableTiers instanceof Set ? availableTiers : new Set(availableTiers);
  const requestedRank = LOD_RANK[requestedTier];
  for (let rank = requestedRank; rank >= 0; rank -= 1) {
    const candidate = RENDERABLE_LOD_TIERS[rank];
    if (candidate && available.has(candidate)) return candidate;
  }
  return null;
}

const validateCadence = (cadence: PresentationUpdateCadence): void => {
  for (const interval of [cadence.lod0, cadence.lod1, cadence.lod2]) {
    if (!Number.isInteger(interval) || interval < 1) {
      throw new RangeError('Presentation update cadence values must be positive integers.');
    }
  }
};

/** Spread lower-tier updates across frames with a stable per-entity phase. */
export function shouldUpdatePresentationOnFrame(
  tier: PresentationLodTier,
  frameNumber: number,
  phase = 0,
  cadence: PresentationUpdateCadence = DEFAULT_PRESENTATION_UPDATE_CADENCE,
): boolean {
  if (tier === 'culled' || !Number.isFinite(frameNumber) || !Number.isFinite(phase)) return false;
  validateCadence(cadence);
  const interval = cadence[tier];
  const frame = Math.floor(frameNumber);
  const normalizedPhase = ((Math.floor(phase) % interval) + interval) % interval;
  return ((frame + normalizedPhase) % interval + interval) % interval === 0;
}

/**
 * Conservative circle-versus-expanded-AABB test for flat-world visibility.
 * Reversed bounds are accepted; malformed numeric input is treated as outside.
 */
export function isInsideExpandedFlatView(
  point: FlatWorldPoint,
  bounds: FlatWorldBounds,
  margin = 0,
  radius = 0,
): boolean {
  const values = [point.x, point.z, bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ, margin, radius];
  if (!values.every(Number.isFinite)) return false;
  const safeMargin = Math.max(0, margin);
  const safeRadius = Math.max(0, radius);
  const minX = Math.min(bounds.minX, bounds.maxX) - safeMargin;
  const maxX = Math.max(bounds.minX, bounds.maxX) + safeMargin;
  const minZ = Math.min(bounds.minZ, bounds.maxZ) - safeMargin;
  const maxZ = Math.max(bounds.minZ, bounds.maxZ) + safeMargin;
  return point.x + safeRadius >= minX
    && point.x - safeRadius <= maxX
    && point.z + safeRadius >= minZ
    && point.z - safeRadius <= maxZ;
}
