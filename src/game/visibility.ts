import type { Vec2 } from './types';

export interface VisibilityBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface VisibilityGridOptions {
  bounds: VisibilityBounds;
  cellSize: number;
}

export interface VisibilityObserver {
  id: string;
  position: Vec2;
  radius: number;
}

export interface VisibilityCell {
  x: number;
  z: number;
  index: number;
}

export type VisibilityState = 'unknown' | 'explored' | 'visible';

/** Plain serializable visibility data. Both index arrays are unique and ascending. */
export interface VisibilitySnapshot {
  bounds: VisibilityBounds;
  cellSize: number;
  width: number;
  height: number;
  visible: number[];
  explored: number[];
}

const EPSILON = 1e-9;
const MAX_GRID_CELLS = 4_000_000;

const finitePoint = (point: Vec2): boolean => Number.isFinite(point.x) && Number.isFinite(point.z);

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const compareStableText = (left: string, right: string): number => (left === right ? 0 : left < right ? -1 : 1);

const containsSorted = (values: readonly number[], target: number): boolean => {
  let low = 0;
  let high = values.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const value = values[middle];
    if (value === undefined) return false;
    if (value === target) return true;
    if (value < target) low = middle + 1;
    else high = middle - 1;
  }
  return false;
};

/**
 * Deterministic visibility grid on one flat XZ gameplay plane.
 *
 * Call `update` independently for each team and pass that team's prior
 * `snapshot.explored`. Use `combine` only when a shared/spectator view is wanted.
 */
export class VisibilityGrid {
  private readonly bounds: VisibilityBounds;
  private readonly cellSize: number;
  private readonly width: number;
  private readonly height: number;
  private readonly cellCount: number;

  public constructor(options: VisibilityGridOptions) {
    this.assertOptions(options);
    this.bounds = { ...options.bounds };
    this.cellSize = options.cellSize;
    this.width = Math.ceil((this.bounds.maxX - this.bounds.minX) / this.cellSize);
    this.height = Math.ceil((this.bounds.maxZ - this.bounds.minZ) / this.cellSize);
    this.cellCount = this.width * this.height;
    if (!Number.isSafeInteger(this.cellCount) || this.cellCount > MAX_GRID_CELLS) {
      throw new RangeError(`visibility grid is too large: ${this.cellCount} cells`);
    }
  }

  public worldToCell(position: Vec2): VisibilityCell | null {
    if (!finitePoint(position) || !this.insideBounds(position)) return null;
    const x = Math.min(
      this.width - 1,
      Math.max(0, Math.floor((position.x - this.bounds.minX) / this.cellSize)),
    );
    const z = Math.min(
      this.height - 1,
      Math.max(0, Math.floor((position.z - this.bounds.minZ) / this.cellSize)),
    );
    return { x, z, index: this.cellIndex(x, z) };
  }

  public update(
    observers: readonly VisibilityObserver[],
    previousExplored: readonly number[] = [],
  ): VisibilitySnapshot {
    const sortedObservers = observers
      .map((observer) => ({
        id: observer.id,
        position: { x: observer.position.x, z: observer.position.z },
        radius: observer.radius,
      }))
      .sort((left, right) => compareStableText(left.id, right.id));
    this.assertObservers(sortedObservers);

    const visibleMask = new Uint8Array(this.cellCount);
    for (const observer of sortedObservers) this.revealCircle(visibleMask, observer.position, observer.radius);

    const exploredMask = new Uint8Array(this.cellCount);
    for (const index of previousExplored) {
      if (!Number.isInteger(index) || index < 0 || index >= this.cellCount) {
        throw new RangeError(`previous explored cell index is out of range: ${index}`);
      }
      exploredMask[index] = 1;
    }
    for (let index = 0; index < this.cellCount; index += 1) {
      if (visibleMask[index] === 1) exploredMask[index] = 1;
    }
    return this.snapshotFromMasks(visibleMask, exploredMask);
  }

  public combine(snapshots: readonly VisibilitySnapshot[]): VisibilitySnapshot {
    const visibleMask = new Uint8Array(this.cellCount);
    const exploredMask = new Uint8Array(this.cellCount);
    for (const snapshot of snapshots) {
      this.assertCompatibleSnapshot(snapshot);
      for (const index of snapshot.visible) {
        this.assertSnapshotIndex(index, 'visible');
        visibleMask[index] = 1;
        exploredMask[index] = 1;
      }
      for (const index of snapshot.explored) {
        this.assertSnapshotIndex(index, 'explored');
        exploredMask[index] = 1;
      }
    }
    return this.snapshotFromMasks(visibleMask, exploredMask);
  }

  public getState(snapshot: VisibilitySnapshot, position: Vec2): VisibilityState {
    this.assertCompatibleSnapshot(snapshot);
    const cell = this.worldToCell(position);
    if (!cell) return 'unknown';
    if (containsSorted(snapshot.visible, cell.index)) return 'visible';
    if (containsSorted(snapshot.explored, cell.index)) return 'explored';
    return 'unknown';
  }

  public getRadiusState(snapshot: VisibilitySnapshot, position: Vec2, radius: number): VisibilityState {
    this.assertCompatibleSnapshot(snapshot);
    this.assertQueryCircle(position, radius);
    if (radius <= EPSILON) return this.getState(snapshot, position);
    const range = this.circleCellRange(position, radius);
    if (!range) return 'unknown';
    let touchesExplored = false;
    for (let z = range.minZ; z <= range.maxZ; z += 1) {
      for (let x = range.minX; x <= range.maxX; x += 1) {
        if (!this.circleIntersectsCell(position, radius, x, z)) continue;
        const index = this.cellIndex(x, z);
        if (containsSorted(snapshot.visible, index)) return 'visible';
        if (containsSorted(snapshot.explored, index)) touchesExplored = true;
      }
    }
    return touchesExplored ? 'explored' : 'unknown';
  }

  public isPositionVisible(snapshot: VisibilitySnapshot, position: Vec2): boolean {
    return this.getState(snapshot, position) === 'visible';
  }

  public isRadiusVisible(snapshot: VisibilitySnapshot, position: Vec2, radius: number): boolean {
    return this.getRadiusState(snapshot, position, radius) === 'visible';
  }

  private assertOptions(options: VisibilityGridOptions): void {
    const { bounds, cellSize } = options;
    if (
      !Number.isFinite(bounds.minX) ||
      !Number.isFinite(bounds.maxX) ||
      !Number.isFinite(bounds.minZ) ||
      !Number.isFinite(bounds.maxZ) ||
      bounds.minX >= bounds.maxX ||
      bounds.minZ >= bounds.maxZ
    ) {
      throw new RangeError('visibility bounds must be finite and have positive area');
    }
    if (!Number.isFinite(cellSize) || cellSize <= 0) {
      throw new RangeError('cellSize must be a finite positive number');
    }
  }

  private assertObservers(observers: readonly VisibilityObserver[]): void {
    let previousId: string | undefined;
    for (const observer of observers) {
      if (
        observer.id.length === 0 ||
        !finitePoint(observer.position) ||
        !Number.isFinite(observer.radius) ||
        observer.radius < 0
      ) {
        throw new RangeError(`invalid visibility observer: ${observer.id || '<empty>'}`);
      }
      if (observer.id === previousId) throw new RangeError(`duplicate visibility observer id: ${observer.id}`);
      previousId = observer.id;
    }
  }

  private assertQueryCircle(position: Vec2, radius: number): void {
    if (!finitePoint(position) || !Number.isFinite(radius) || radius < 0) {
      throw new RangeError('visibility query requires a finite position and non-negative radius');
    }
  }

  private assertCompatibleSnapshot(snapshot: VisibilitySnapshot): void {
    if (
      snapshot.width !== this.width ||
      snapshot.height !== this.height ||
      snapshot.cellSize !== this.cellSize ||
      snapshot.bounds.minX !== this.bounds.minX ||
      snapshot.bounds.maxX !== this.bounds.maxX ||
      snapshot.bounds.minZ !== this.bounds.minZ ||
      snapshot.bounds.maxZ !== this.bounds.maxZ
    ) {
      throw new RangeError('visibility snapshot is not compatible with this grid');
    }
  }

  private assertSnapshotIndex(index: number, field: string): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.cellCount) {
      throw new RangeError(`${field} cell index is out of range: ${index}`);
    }
  }

  private revealCircle(mask: Uint8Array, center: Vec2, radius: number): void {
    const range = this.circleCellRange(center, radius);
    if (!range) return;
    for (let z = range.minZ; z <= range.maxZ; z += 1) {
      for (let x = range.minX; x <= range.maxX; x += 1) {
        if (this.circleIntersectsCell(center, radius, x, z)) mask[this.cellIndex(x, z)] = 1;
      }
    }
  }

  private circleCellRange(
    center: Vec2,
    radius: number,
  ): { minX: number; maxX: number; minZ: number; maxZ: number } | null {
    if (
      center.x + radius < this.bounds.minX - EPSILON ||
      center.x - radius > this.bounds.maxX + EPSILON ||
      center.z + radius < this.bounds.minZ - EPSILON ||
      center.z - radius > this.bounds.maxZ + EPSILON
    ) {
      return null;
    }
    // Expand the candidate range by epsilon so exact tangency with the far edge
    // of an adjacent cell is considered visible rather than lost to floor().
    const rawMinX = Math.floor((center.x - radius - this.bounds.minX - EPSILON) / this.cellSize);
    const rawMaxX = Math.floor((center.x + radius - this.bounds.minX + EPSILON) / this.cellSize);
    const rawMinZ = Math.floor((center.z - radius - this.bounds.minZ - EPSILON) / this.cellSize);
    const rawMaxZ = Math.floor((center.z + radius - this.bounds.minZ + EPSILON) / this.cellSize);
    return {
      minX: clamp(rawMinX, 0, this.width - 1),
      maxX: clamp(rawMaxX, 0, this.width - 1),
      minZ: clamp(rawMinZ, 0, this.height - 1),
      maxZ: clamp(rawMaxZ, 0, this.height - 1),
    };
  }

  private circleIntersectsCell(center: Vec2, radius: number, x: number, z: number): boolean {
    const bounds = this.cellBounds(x, z);
    const closestX = clamp(center.x, bounds.minX, bounds.maxX);
    const closestZ = clamp(center.z, bounds.minZ, bounds.maxZ);
    const dx = center.x - closestX;
    const dz = center.z - closestZ;
    return dx * dx + dz * dz <= radius * radius + EPSILON;
  }

  private cellBounds(x: number, z: number): VisibilityBounds {
    const minX = this.bounds.minX + x * this.cellSize;
    const minZ = this.bounds.minZ + z * this.cellSize;
    return {
      minX,
      maxX: Math.min(this.bounds.maxX, minX + this.cellSize),
      minZ,
      maxZ: Math.min(this.bounds.maxZ, minZ + this.cellSize),
    };
  }

  private insideBounds(position: Vec2): boolean {
    return (
      position.x >= this.bounds.minX - EPSILON &&
      position.x <= this.bounds.maxX + EPSILON &&
      position.z >= this.bounds.minZ - EPSILON &&
      position.z <= this.bounds.maxZ + EPSILON
    );
  }

  private cellIndex(x: number, z: number): number {
    return z * this.width + x;
  }

  private snapshotFromMasks(visibleMask: Uint8Array, exploredMask: Uint8Array): VisibilitySnapshot {
    const visible: number[] = [];
    const explored: number[] = [];
    for (let index = 0; index < this.cellCount; index += 1) {
      if (visibleMask[index] === 1) visible.push(index);
      if (exploredMask[index] === 1) explored.push(index);
    }
    return {
      bounds: { ...this.bounds },
      cellSize: this.cellSize,
      width: this.width,
      height: this.height,
      visible,
      explored,
    };
  }
}
