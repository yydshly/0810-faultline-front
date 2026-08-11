import { describe, expect, it } from 'vitest';

import { visibleStageEdgePanDirection } from './camera-edge';

describe('desktop visible-stage edge scrolling', () => {
  it('uses the viewport edge when the battlefield starts offscreen', () => {
    const stage = { left: -66, top: 0, right: 1058, bottom: 900 };
    const viewport = { width: 1440, height: 900 };
    expect(visibleStageEdgePanDirection({ x: 4, y: 450 }, stage, viewport)).toEqual({ x: -1, z: 0 });
    expect(visibleStageEdgePanDirection({ x: 1052, y: 450 }, stage, viewport)).toEqual({ x: 1, z: 0 });
  });

  it('preserves all four edges for an ordinary in-viewport stage', () => {
    const stage = { left: 0, top: 50, right: 1124, bottom: 900 };
    const viewport = { width: 1440, height: 900 };
    expect(visibleStageEdgePanDirection({ x: 5, y: 400 }, stage, viewport)).toEqual({ x: -1, z: 0 });
    expect(visibleStageEdgePanDirection({ x: 600, y: 55 }, stage, viewport)).toEqual({ x: 0, z: -1 });
    expect(visibleStageEdgePanDirection({ x: 600, y: 895 }, stage, viewport)).toEqual({ x: 0, z: 1 });
    expect(visibleStageEdgePanDirection({ x: 600, y: 400 }, stage, viewport)).toEqual({ x: 0, z: 0 });
  });

  it('does not pan for an invalid or invisible stage region', () => {
    expect(visibleStageEdgePanDirection(
      { x: 10, y: 10 },
      { left: -200, top: 0, right: -10, bottom: 200 },
      { width: 1440, height: 900 },
    )).toEqual({ x: 0, z: 0 });
    expect(visibleStageEdgePanDirection(
      { x: Number.NaN, y: 10 },
      { left: 0, top: 0, right: 100, bottom: 100 },
      { width: 1440, height: 900 },
    )).toEqual({ x: 0, z: 0 });
  });
});
