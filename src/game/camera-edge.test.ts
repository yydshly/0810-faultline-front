import { describe, expect, it } from 'vitest';

import {
  EDGE_PAN_BLOCKING_SELECTOR,
  screenPanToWorldPan,
  visibleStageEdgePanDirection,
} from './camera-edge';

describe('desktop visible-stage edge scrolling', () => {
  it('uses the viewport edge when the battlefield starts offscreen', () => {
    const stage = { left: -66, top: 0, right: 1058, bottom: 900 };
    const viewport = { width: 1440, height: 900 };
    expect(visibleStageEdgePanDirection({ x: 4, y: 450 }, stage, viewport).x).toBeLessThan(-0.9);
    expect(visibleStageEdgePanDirection({ x: 1052, y: 450 }, stage, viewport).x).toBeGreaterThan(0.9);
  });

  it('preserves all four edges for an ordinary in-viewport stage', () => {
    const stage = { left: 0, top: 50, right: 1124, bottom: 900 };
    const viewport = { width: 1440, height: 900 };
    expect(visibleStageEdgePanDirection({ x: 5, y: 400 }, stage, viewport).x).toBeLessThan(-0.9);
    expect(visibleStageEdgePanDirection({ x: 600, y: 55 }, stage, viewport).z).toBeLessThan(-0.9);
    expect(visibleStageEdgePanDirection({ x: 600, y: 895 }, stage, viewport).z).toBeGreaterThan(0.9);
    expect(visibleStageEdgePanDirection({ x: 600, y: 400 }, stage, viewport)).toEqual({ x: 0, z: 0 });
  });

  it('uses a wider progressive band and accelerates toward the battlefield edge', () => {
    const stage = { left: 0, top: 0, right: 964, bottom: 720 };
    const viewport = { width: 1280, height: 720 };
    const innerBand = visibleStageEdgePanDirection({ x: 934, y: 360 }, stage, viewport);
    const nearEdge = visibleStageEdgePanDirection({ x: 962, y: 360 }, stage, viewport);

    expect(innerBand.x).toBeGreaterThan(0);
    expect(innerBand.x).toBeLessThan(nearEdge.x);
    expect(nearEdge.x).toBeGreaterThan(0.9);
  });

  it('keeps the command rail interior quiet but accepts the outer viewport edge', () => {
    const stage = { left: 0, top: 0, right: 964, bottom: 720 };
    const viewport = { width: 1280, height: 720 };
    expect(visibleStageEdgePanDirection(
      { x: 1100, y: 360 },
      stage,
      viewport,
    )).toEqual({ x: 0, z: 0 });
    expect(visibleStageEdgePanDirection(
      { x: 1279, y: 360 },
      stage,
      viewport,
    ).x).toBeGreaterThan(0.9);
  });

  it('accepts the outer top and bottom edges even outside the stage column', () => {
    const stage = { left: 0, top: 50, right: 964, bottom: 680 };
    const viewport = { width: 1280, height: 720 };
    expect(visibleStageEdgePanDirection(
      { x: 1100, y: 1 },
      stage,
      viewport,
    ).z).toBeLessThan(-0.9);
    expect(visibleStageEdgePanDirection(
      { x: 1100, y: 719 },
      stage,
      viewport,
    ).z).toBeGreaterThan(0.9);
  });

  it('blocks real controls without blocking the topbar, dock, or rail surfaces', () => {
    expect(EDGE_PAN_BLOCKING_SELECTOR).toContain('button');
    expect(EDGE_PAN_BLOCKING_SELECTOR).toContain('.ff-minimap-panel');
    expect(EDGE_PAN_BLOCKING_SELECTOR).not.toContain('.ff-topbar');
    expect(EDGE_PAN_BLOCKING_SELECTOR).not.toContain('.ff-command-dock');
    expect(EDGE_PAN_BLOCKING_SELECTOR).not.toContain('.ff-right-rail');
  });

  it('maps all four screen directions into the 45-degree isometric world axes', () => {
    const right = screenPanToWorldPan(1, 0);
    const down = screenPanToWorldPan(0, 1);
    const left = screenPanToWorldPan(-1, 0);
    const up = screenPanToWorldPan(0, -1);

    expect(right.x).toBeCloseTo(Math.SQRT1_2);
    expect(right.z).toBeCloseTo(-Math.SQRT1_2);
    expect(down.x).toBeCloseTo(Math.SQRT1_2);
    expect(down.z).toBeCloseTo(Math.SQRT1_2);
    expect(left.x).toBeCloseTo(-right.x);
    expect(left.z).toBeCloseTo(-right.z);
    expect(up.x).toBeCloseTo(-down.x);
    expect(up.z).toBeCloseTo(-down.z);
    expect(Math.hypot(right.x, right.z)).toBeCloseTo(1);
    expect(Math.hypot(down.x, down.z)).toBeCloseTo(1);
  });

  it('does not pan for a pointer outside the viewport', () => {
    expect(visibleStageEdgePanDirection(
      { x: 1281, y: 360 },
      { left: 0, top: 0, right: 964, bottom: 720 },
      { width: 1280, height: 720 },
    )).toEqual({ x: 0, z: 0 });
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
