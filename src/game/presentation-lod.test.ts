import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PRESENTATION_LOD_THRESHOLDS,
  isInsideExpandedFlatView,
  orthographicProjectedHeightPx,
  resolveAvailablePresentationLod,
  selectPresentationLodTier,
  shouldUpdatePresentationOnFrame,
} from './presentation-lod';

describe('orthographic presentation sizing', () => {
  it('converts world height to pixels independently of camera distance', () => {
    expect(orthographicProjectedHeightPx(2.7, 48, 720)).toBeCloseTo(40.5);
    expect(orthographicProjectedHeightPx(2.7, 80, 720)).toBeCloseTo(24.3);
  });

  it('returns zero for invalid or non-positive dimensions', () => {
    expect(orthographicProjectedHeightPx(2, 0, 720)).toBe(0);
    expect(orthographicProjectedHeightPx(Number.NaN, 48, 720)).toBe(0);
    expect(orthographicProjectedHeightPx(2, 48, -1)).toBe(0);
  });
});

describe('presentation LOD selection', () => {
  it('uses both projected size and planar distance', () => {
    expect(selectPresentationLodTier({
      projectedHeightPx: 48,
      planarDistance: 20,
      insideExpandedView: true,
    })).toBe('lod0');
    expect(selectPresentationLodTier({
      projectedHeightPx: 28,
      planarDistance: 40,
      insideExpandedView: true,
    })).toBe('lod1');
    expect(selectPresentationLodTier({
      projectedHeightPx: 48,
      planarDistance: 70,
      insideExpandedView: true,
    })).toBe('lod2');
    expect(selectPresentationLodTier({
      projectedHeightPx: 12,
      planarDistance: 10,
      insideExpandedView: true,
    })).toBe('lod2');
  });

  it('applies 15 percent hysteresis when leaving and entering LOD0', () => {
    // LOD0 retains detail down to 34 * 0.85 = 28.9 px and out to 30 * 1.15 = 34.5 units.
    expect(selectPresentationLodTier({
      projectedHeightPx: 30,
      planarDistance: 33,
      insideExpandedView: true,
      previousTier: 'lod0',
    })).toBe('lod0');
    // LOD1 needs 34 * 1.15 = 39.1 px and distance <= 30 * 0.85 = 25.5 to upgrade.
    expect(selectPresentationLodTier({
      projectedHeightPx: 38,
      planarDistance: 24,
      insideExpandedView: true,
      previousTier: 'lod1',
    })).toBe('lod1');
    expect(selectPresentationLodTier({
      projectedHeightPx: 40,
      planarDistance: 25,
      insideExpandedView: true,
      previousTier: 'lod1',
    })).toBe('lod0');
  });

  it('applies hysteresis at the LOD1 to LOD2 boundary', () => {
    expect(selectPresentationLodTier({
      projectedHeightPx: 14,
      planarDistance: 67,
      insideExpandedView: true,
      previousTier: 'lod1',
    })).toBe('lod1');
    expect(selectPresentationLodTier({
      projectedHeightPx: 18,
      planarDistance: 50,
      insideExpandedView: true,
      previousTier: 'lod2',
    })).toBe('lod2');
    expect(selectPresentationLodTier({
      projectedHeightPx: 19,
      planarDistance: 50,
      insideExpandedView: true,
      previousTier: 'lod2',
    })).toBe('lod1');
  });

  it('culls outside the expanded view and allows important visible entities to force LOD0', () => {
    expect(selectPresentationLodTier({
      projectedHeightPx: 100,
      planarDistance: 0,
      insideExpandedView: false,
      forceLod0: true,
    })).toBe('culled');
    expect(selectPresentationLodTier({
      projectedHeightPx: 2,
      planarDistance: 100,
      insideExpandedView: true,
      forceLod0: true,
    })).toBe('lod0');
  });

  it('validates threshold ordering and preserves the documented 15 percent default', () => {
    expect(DEFAULT_PRESENTATION_LOD_THRESHOLDS.hysteresisRatio).toBe(0.15);
    expect(() => selectPresentationLodTier(
      { projectedHeightPx: 20, planarDistance: 20, insideExpandedView: true },
      { lod0MinPixels: 10, lod1MinPixels: 20, lod0MaxDistance: 30, lod1MaxDistance: 60 },
    )).toThrow(RangeError);
  });
});

describe('available LOD fallback', () => {
  it('uses the requested tier when available', () => {
    expect(resolveAvailablePresentationLod('lod1', ['lod0', 'lod1'])).toBe('lod1');
  });

  it('falls back toward higher quality and never silently substitutes lower quality', () => {
    expect(resolveAvailablePresentationLod('lod2', new Set(['lod0', 'lod1']))).toBe('lod1');
    expect(resolveAvailablePresentationLod('lod1', ['lod0', 'lod2'])).toBe('lod0');
    expect(resolveAvailablePresentationLod('lod0', ['lod1', 'lod2'])).toBeNull();
    expect(resolveAvailablePresentationLod('culled', ['lod0'])).toBeNull();
  });
});

describe('presentation update cadence', () => {
  it('updates LOD0 every frame, LOD1 every second frame, and LOD2 every fourth frame', () => {
    expect([0, 1, 2, 3].map((frame) => shouldUpdatePresentationOnFrame('lod0', frame)))
      .toEqual([true, true, true, true]);
    expect([0, 1, 2, 3].map((frame) => shouldUpdatePresentationOnFrame('lod1', frame)))
      .toEqual([true, false, true, false]);
    expect([0, 1, 2, 3, 4].map((frame) => shouldUpdatePresentationOnFrame('lod2', frame)))
      .toEqual([true, false, false, false, true]);
    expect(shouldUpdatePresentationOnFrame('culled', 0)).toBe(false);
  });

  it('uses a stable phase to spread work between entities', () => {
    expect([0, 1, 2, 3].map((frame) => shouldUpdatePresentationOnFrame('lod2', frame, 1)))
      .toEqual([false, false, false, true]);
    expect(shouldUpdatePresentationOnFrame('lod1', Number.NaN)).toBe(false);
  });
});

describe('expanded flat view tests', () => {
  const bounds = { minX: -20, maxX: 20, minZ: -10, maxZ: 10 };

  it('includes points inside the view and its configured margin', () => {
    expect(isInsideExpandedFlatView({ x: 0, z: 0 }, bounds, 12)).toBe(true);
    expect(isInsideExpandedFlatView({ x: 31, z: 0 }, bounds, 12)).toBe(true);
    expect(isInsideExpandedFlatView({ x: 33, z: 0 }, bounds, 12)).toBe(false);
  });

  it('uses entity radius conservatively and accepts reversed bounds', () => {
    expect(isInsideExpandedFlatView({ x: 33, z: 0 }, bounds, 10, 3)).toBe(true);
    expect(isInsideExpandedFlatView(
      { x: 0, z: 0 },
      { minX: 20, maxX: -20, minZ: 10, maxZ: -10 },
    )).toBe(true);
  });

  it('treats malformed coordinates as outside', () => {
    expect(isInsideExpandedFlatView({ x: Number.NaN, z: 0 }, bounds, 12)).toBe(false);
  });
});
