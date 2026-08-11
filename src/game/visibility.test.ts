import { describe, expect, it } from 'vitest';
import { VisibilityGrid } from './visibility';
import type { VisibilityObserver } from './visibility';

const BOUNDS = { minX: 0, maxX: 10, minZ: 0, maxZ: 10 } as const;

const expectStrictlyAscending = (values: readonly number[]): void => {
  for (let index = 1; index < values.length; index += 1) {
    expect(values[index]).toBeGreaterThan(values[index - 1] ?? -1);
  }
};

describe('VisibilityGrid', () => {
  it('以观察者为圆心揭示圆形区域，并输出升序普通数组', () => {
    const grid = new VisibilityGrid({ bounds: BOUNDS, cellSize: 1 });
    const snapshot = grid.update([{ id: 'observer', position: { x: 5, z: 5 }, radius: 2 }]);

    expect(Array.isArray(snapshot.visible)).toBe(true);
    expect(Array.isArray(snapshot.explored)).toBe(true);
    expectStrictlyAscending(snapshot.visible);
    expectStrictlyAscending(snapshot.explored);
    expect(grid.getState(snapshot, { x: 5, z: 5 })).toBe('visible');
    expect(grid.getState(snapshot, { x: 3.5, z: 5.5 })).toBe('visible');
    expect(grid.getState(snapshot, { x: 9, z: 9 })).toBe('unknown');
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it('当前可见消失后仍保留已探索状态', () => {
    const grid = new VisibilityGrid({ bounds: BOUNDS, cellSize: 1 });
    const first = grid.update([{ id: 'first', position: { x: 2.5, z: 2.5 }, radius: 0.1 }]);
    const second = grid.update(
      [{ id: 'second', position: { x: 7.5, z: 7.5 }, radius: 0.1 }],
      first.explored,
    );

    expect(grid.getState(second, { x: 2.5, z: 2.5 })).toBe('explored');
    expect(grid.getState(second, { x: 7.5, z: 7.5 })).toBe('visible');

    const noObservers = grid.update([], second.explored);
    expect(noObservers.visible).toEqual([]);
    expect(grid.getState(noObservers, { x: 2.5, z: 2.5 })).toBe('explored');
    expect(grid.getState(noObservers, { x: 7.5, z: 7.5 })).toBe('explored');
  });

  it('双方快照彼此独立，并能显式组合为共享视野', () => {
    const grid = new VisibilityGrid({ bounds: BOUNDS, cellSize: 1 });
    const player = grid.update([{ id: 'player-scout', position: { x: 1.5, z: 1.5 }, radius: 0.2 }]);
    const enemy = grid.update([{ id: 'enemy-scout', position: { x: 8.5, z: 8.5 }, radius: 0.2 }]);

    expect(grid.getState(player, { x: 8.5, z: 8.5 })).toBe('unknown');
    expect(grid.getState(enemy, { x: 1.5, z: 1.5 })).toBe('unknown');

    const combined = grid.combine([player, enemy]);
    expect(grid.getState(combined, { x: 1.5, z: 1.5 })).toBe('visible');
    expect(grid.getState(combined, { x: 8.5, z: 8.5 })).toBe('visible');
    expect(grid.combine([enemy, player])).toEqual(combined);
    expect(grid.getState(player, { x: 8.5, z: 8.5 })).toBe('unknown');
  });

  it('观察者和既有探索索引的输入顺序不影响结果', () => {
    const grid = new VisibilityGrid({ bounds: BOUNDS, cellSize: 0.5 });
    const observers: VisibilityObserver[] = [
      { id: 'charlie', position: { x: 8, z: 2 }, radius: 1.4 },
      { id: 'alpha', position: { x: 2, z: 2 }, radius: 1.4 },
      { id: 'bravo', position: { x: 5, z: 7 }, radius: 2 },
    ];
    const previous = [37, 4, 12, 37, 2];
    const forward = grid.update(observers, previous);
    const reversed = grid.update([...observers].reverse(), [...previous].reverse());

    expect(reversed).toEqual(forward);
    expectStrictlyAscending(forward.visible);
    expectStrictlyAscending(forward.explored);
  });

  it('世界边界映射为包含端点的稳定单元格，揭示圆在边缘被裁剪', () => {
    const grid = new VisibilityGrid({
      bounds: { minX: -2, maxX: 2, minZ: -2, maxZ: 2 },
      cellSize: 1,
    });
    expect(grid.worldToCell({ x: -2, z: -2 })).toEqual({ x: 0, z: 0, index: 0 });
    expect(grid.worldToCell({ x: 2, z: 2 })).toEqual({ x: 3, z: 3, index: 15 });
    expect(grid.worldToCell({ x: 2.001, z: 0 })).toBeNull();

    const snapshot = grid.update([
      { id: 'outside-west', position: { x: -2.5, z: 0 }, radius: 1 },
      { id: 'corner', position: { x: 2, z: 2 }, radius: 0.1 },
    ]);
    expect(snapshot.visible.every((index) => index >= 0 && index < 16)).toBe(true);
    expect(grid.isPositionVisible(snapshot, { x: -2, z: 0 })).toBe(true);
    expect(grid.isPositionVisible(snapshot, { x: 2, z: 2 })).toBe(true);
  });

  it('实体中心尚未可见时，半径与可见单元格擦边仍判定可见', () => {
    const grid = new VisibilityGrid({ bounds: { minX: 0, maxX: 6, minZ: 0, maxZ: 6 }, cellSize: 1 });
    const visible = grid.update([{ id: 'observer', position: { x: 1.5, z: 1.5 }, radius: 0.1 }]);
    const entity = { x: 2.6, z: 1.5 };

    expect(grid.isPositionVisible(visible, entity)).toBe(false);
    expect(grid.isRadiusVisible(visible, entity, 0.59)).toBe(false);
    expect(grid.isRadiusVisible(visible, entity, 0.6)).toBe(true);
    expect(grid.getRadiusState(visible, entity, 0.6)).toBe('visible');

    const explored = grid.update([], visible.explored);
    expect(grid.getRadiusState(explored, entity, 0.6)).toBe('explored');
  });
});
