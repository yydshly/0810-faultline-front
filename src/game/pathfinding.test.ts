import { describe, expect, it } from 'vitest';
import { GridPathfinder, findGridPath } from './pathfinding';
import type { GridPathfinderOptions, PathObstacle } from './pathfinding';
import type { Vec2 } from './types';

const BOUNDS = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 } as const;

const expectEndpoints = (path: Vec2[] | null, start: Vec2, goal: Vec2): Vec2[] => {
  expect(path).not.toBeNull();
  const resolved = path ?? [];
  expect(resolved[0]).toEqual(start);
  expect(resolved[resolved.length - 1]).toEqual(goal);
  return resolved;
};

describe('GridPathfinder', () => {
  it('在空旷平面返回从精确起点到精确终点的直达路点', () => {
    const start = { x: -8.25, z: -7.25 };
    const goal = { x: 8.25, z: 7.25 };
    const pathfinder = new GridPathfinder({ bounds: BOUNDS, cellSize: 1 });
    const path = expectEndpoints(pathfinder.findPath(start, goal), start, goal);

    expect(path.length).toBeLessThanOrEqual(3);
    expect(path.every((point) => pathfinder.isWalkable(point))).toBe(true);
  });

  it('确定地绕开圆形障碍', () => {
    const start = { x: -6, z: 0 };
    const goal = { x: 6, z: 0 };
    const path = expectEndpoints(findGridPath(start, goal, {
      bounds: { minX: -8, maxX: 8, minZ: -8, maxZ: 8 },
      cellSize: 0.5,
      clearance: 0.2,
      obstacles: [{ kind: 'circle', center: { x: 0, z: 0 }, radius: 2 }],
    }), start, goal);

    expect(path.some((point) => Math.abs(point.z) > 2)).toBe(true);
  });

  it('从 U 形障碍内部经开口绕行到外部', () => {
    const obstacles: PathObstacle[] = [
      { kind: 'rect', min: { x: -4, z: -4 }, max: { x: -3, z: 4 } },
      { kind: 'rect', min: { x: 3, z: -4 }, max: { x: 4, z: 4 } },
      { kind: 'rect', min: { x: -4, z: -4 }, max: { x: 4, z: -3 } },
    ];
    const pathfinder = new GridPathfinder({
      bounds: BOUNDS,
      cellSize: 0.5,
      clearance: 0.25,
      obstacles,
    });
    const start = { x: 0, z: 0 };
    const goal = { x: 0, z: -7 };
    const path = expectEndpoints(pathfinder.findPath(start, goal), start, goal);

    expect(Math.max(...path.map((point) => point.z))).toBeGreaterThan(4.25);
    expect(Math.max(...path.map((point) => Math.abs(point.x)))).toBeGreaterThan(4.25);
  });

  it('同一狭窄通道允许小净空通过，但拒绝大净空', () => {
    const obstacles: PathObstacle[] = [
      { kind: 'rect', min: { x: -0.5, z: -5 }, max: { x: 0.5, z: -1 } },
      { kind: 'rect', min: { x: -0.5, z: 1 }, max: { x: 0.5, z: 5 } },
    ];
    const base: Omit<GridPathfinderOptions, 'clearance'> = {
      bounds: { minX: -6, maxX: 6, minZ: -5, maxZ: 5 },
      cellSize: 0.5,
      obstacles,
    };
    const start = { x: -4, z: 0 };
    const goal = { x: 4, z: 0 };

    expect(new GridPathfinder({ ...base, clearance: 0.25 }).findPath(start, goal)).not.toBeNull();
    expect(new GridPathfinder({ ...base, clearance: 1 }).findPath(start, goal)).toBeNull();
  });

  it('禁止在两个相接阻挡角之间斜向穿越，并返回不可达', () => {
    const pathfinder = new GridPathfinder({
      bounds: { minX: 0, maxX: 2, minZ: 0, maxZ: 2 },
      cellSize: 1,
      obstacles: [
        { kind: 'rect', min: { x: 1, z: 0 }, max: { x: 2, z: 1 } },
        { kind: 'rect', min: { x: 0, z: 1 }, max: { x: 1, z: 2 } },
      ],
    });

    expect(pathfinder.isWalkable({ x: 0.5, z: 0.5 })).toBe(true);
    expect(pathfinder.isWalkable({ x: 1.5, z: 1.5 })).toBe(true);
    expect(pathfinder.findPath({ x: 0.5, z: 0.5 }, { x: 1.5, z: 1.5 })).toBeNull();
  });

  it('同一栅格重复调用产生逐点完全一致的结果', () => {
    const pathfinder = new GridPathfinder({
      bounds: BOUNDS,
      cellSize: 0.5,
      clearance: 0.35,
      obstacles: [
        { kind: 'circle', center: { x: -1, z: 1 }, radius: 2.2 },
        { kind: 'rect', min: { x: 1, z: -6 }, max: { x: 2, z: 4 } },
      ],
      simplify: false,
    });
    const start = { x: -8, z: -7 };
    const goal = { x: 8, z: 7 };
    const first = pathfinder.findPath(start, goal);
    expect(first).not.toBeNull();

    for (let index = 0; index < 25; index += 1) {
      expect(pathfinder.findPath(start, goal)).toEqual(first);
    }
  });
});
