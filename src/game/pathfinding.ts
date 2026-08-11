import type { Vec2 } from './types';

export interface PathBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface CirclePathObstacle {
  kind: 'circle';
  center: Vec2;
  radius: number;
}

export interface RectPathObstacle {
  kind: 'rect';
  min: Vec2;
  max: Vec2;
}

export type PathObstacle = CirclePathObstacle | RectPathObstacle;

export interface GridPathfinderOptions {
  bounds: PathBounds;
  cellSize: number;
  clearance?: number;
  obstacles?: readonly PathObstacle[];
  simplify?: boolean;
}

interface OpenNode {
  index: number;
  x: number;
  z: number;
  g: number;
  h: number;
  f: number;
  sequence: number;
}

interface GridCell {
  x: number;
  z: number;
}

const EPSILON = 1e-9;
const SQRT_TWO = Math.SQRT2;
const MAX_GRID_CELLS = 4_000_000;

// Cardinal directions come first. Coordinates then provide a platform-independent
// tie-break when several candidates have exactly the same A* score.
const NEIGHBORS: readonly Readonly<{ dx: number; dz: number; cost: number }>[] = [
  { dx: 0, dz: -1, cost: 1 },
  { dx: 1, dz: 0, cost: 1 },
  { dx: 0, dz: 1, cost: 1 },
  { dx: -1, dz: 0, cost: 1 },
  { dx: 1, dz: -1, cost: SQRT_TWO },
  { dx: 1, dz: 1, cost: SQRT_TWO },
  { dx: -1, dz: 1, cost: SQRT_TWO },
  { dx: -1, dz: -1, cost: SQRT_TWO },
];

const finitePoint = (point: Vec2): boolean => Number.isFinite(point.x) && Number.isFinite(point.z);

const clonePoint = (point: Vec2): Vec2 => ({ x: point.x, z: point.z });

const compareOpenNodes = (left: OpenNode, right: OpenNode): number => {
  if (Math.abs(left.f - right.f) > EPSILON) return left.f < right.f ? -1 : 1;
  if (Math.abs(left.h - right.h) > EPSILON) return left.h < right.h ? -1 : 1;
  if (Math.abs(left.g - right.g) > EPSILON) return left.g < right.g ? -1 : 1;
  if (left.z !== right.z) return left.z - right.z;
  if (left.x !== right.x) return left.x - right.x;
  return left.sequence - right.sequence;
};

class OpenHeap {
  private readonly values: OpenNode[] = [];

  public get size(): number {
    return this.values.length;
  }

  public push(value: OpenNode): void {
    this.values.push(value);
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      const parentValue = this.values[parent];
      const childValue = this.values[index];
      if (!parentValue || !childValue || compareOpenNodes(parentValue, childValue) <= 0) break;
      this.values[parent] = childValue;
      this.values[index] = parentValue;
      index = parent;
    }
  }

  public pop(): OpenNode | undefined {
    const first = this.values[0];
    const last = this.values.pop();
    if (!first || !last) return first;
    if (this.values.length === 0) return first;
    this.values[0] = last;
    let index = 0;
    while (true) {
      const leftIndex = index * 2 + 1;
      const rightIndex = leftIndex + 1;
      let smallest = index;
      const smallestValue = this.values[smallest];
      const leftValue = this.values[leftIndex];
      const rightValue = this.values[rightIndex];
      if (leftValue && smallestValue && compareOpenNodes(leftValue, smallestValue) < 0) smallest = leftIndex;
      const currentSmallest = this.values[smallest];
      if (rightValue && currentSmallest && compareOpenNodes(rightValue, currentSmallest) < 0) smallest = rightIndex;
      if (smallest === index) break;
      const current = this.values[index];
      const replacement = this.values[smallest];
      if (!current || !replacement) break;
      this.values[index] = replacement;
      this.values[smallest] = current;
      index = smallest;
    }
    return first;
  }
}

/**
 * Reusable deterministic grid A* for a single flat XZ gameplay plane.
 *
 * Obstacles are rasterized once in the constructor. `clearance` expands every
 * obstacle and contracts the world bounds for the moving entity's center.
 * Invalid configuration throws; an invalid, blocked, or unreachable query
 * returns `null`.
 */
export class GridPathfinder {
  private readonly bounds: PathBounds;
  private readonly cellSize: number;
  private readonly clearance: number;
  private readonly obstacles: readonly PathObstacle[];
  private readonly simplify: boolean;
  private readonly width: number;
  private readonly height: number;
  private readonly blocked: Uint8Array;

  public constructor(options: GridPathfinderOptions) {
    this.assertOptions(options);
    this.bounds = { ...options.bounds };
    this.cellSize = options.cellSize;
    this.clearance = options.clearance ?? 0;
    this.obstacles = (options.obstacles ?? []).map((obstacle) =>
      obstacle.kind === 'circle'
        ? { kind: 'circle', center: clonePoint(obstacle.center), radius: obstacle.radius }
        : { kind: 'rect', min: clonePoint(obstacle.min), max: clonePoint(obstacle.max) },
    );
    this.simplify = options.simplify ?? true;
    this.width = Math.ceil((this.bounds.maxX - this.bounds.minX) / this.cellSize);
    this.height = Math.ceil((this.bounds.maxZ - this.bounds.minZ) / this.cellSize);
    const cellCount = this.width * this.height;
    if (!Number.isSafeInteger(cellCount) || cellCount > MAX_GRID_CELLS) {
      throw new RangeError(`navigation grid is too large: ${cellCount} cells`);
    }
    this.blocked = new Uint8Array(cellCount);
    this.rasterize();
  }

  public isWalkable(position: Vec2): boolean {
    if (!finitePoint(position) || !this.insideNavigableBounds(position) || this.pointTouchesObstacle(position)) {
      return false;
    }
    const cell = this.worldToCell(position);
    return cell !== null && !this.isCellBlocked(cell.x, cell.z);
  }

  public findPath(start: Vec2, goal: Vec2): Vec2[] | null {
    if (!this.isWalkable(start) || !this.isWalkable(goal)) return null;
    const startCell = this.worldToCell(start);
    const goalCell = this.worldToCell(goal);
    if (!startCell || !goalCell) return null;
    if (startCell.x === goalCell.x && startCell.z === goalCell.z) {
      if (Math.abs(start.x - goal.x) <= EPSILON && Math.abs(start.z - goal.z) <= EPSILON) {
        return [clonePoint(start)];
      }
      return [clonePoint(start), clonePoint(goal)];
    }

    const cellCount = this.width * this.height;
    const gScore = new Float64Array(cellCount);
    gScore.fill(Number.POSITIVE_INFINITY);
    const parent = new Int32Array(cellCount);
    parent.fill(-1);
    const closed = new Uint8Array(cellCount);
    const startIndex = this.cellIndex(startCell.x, startCell.z);
    const goalIndex = this.cellIndex(goalCell.x, goalCell.z);
    const open = new OpenHeap();
    let sequence = 0;
    const startHeuristic = this.heuristic(startCell.x, startCell.z, goalCell.x, goalCell.z);
    gScore[startIndex] = 0;
    open.push({
      index: startIndex,
      x: startCell.x,
      z: startCell.z,
      g: 0,
      h: startHeuristic,
      f: startHeuristic,
      sequence,
    });
    sequence += 1;

    let found = false;
    while (open.size > 0) {
      const current = open.pop();
      if (!current || closed[current.index] === 1) continue;
      if (Math.abs(current.g - (gScore[current.index] ?? Number.POSITIVE_INFINITY)) > EPSILON) continue;
      closed[current.index] = 1;
      if (current.index === goalIndex) {
        found = true;
        break;
      }

      for (const neighbor of NEIGHBORS) {
        const nextX = current.x + neighbor.dx;
        const nextZ = current.z + neighbor.dz;
        if (!this.isCellInside(nextX, nextZ) || this.isCellBlocked(nextX, nextZ)) continue;
        if (neighbor.dx !== 0 && neighbor.dz !== 0) {
          // A diagonal move is legal only when both adjoining cardinal cells are
          // clear, so an agent can never squeeze through two touching corners.
          if (
            this.isCellBlocked(current.x + neighbor.dx, current.z) ||
            this.isCellBlocked(current.x, current.z + neighbor.dz)
          ) {
            continue;
          }
        }
        const nextIndex = this.cellIndex(nextX, nextZ);
        if (closed[nextIndex] === 1) continue;
        const tentative = current.g + neighbor.cost * this.cellSize;
        if (tentative >= (gScore[nextIndex] ?? Number.POSITIVE_INFINITY) - EPSILON) continue;
        gScore[nextIndex] = tentative;
        parent[nextIndex] = current.index;
        const h = this.heuristic(nextX, nextZ, goalCell.x, goalCell.z);
        open.push({
          index: nextIndex,
          x: nextX,
          z: nextZ,
          g: tentative,
          h,
          f: tentative + h,
          sequence,
        });
        sequence += 1;
      }
    }

    if (!found) return null;
    const cells = this.reconstructCells(parent, startIndex, goalIndex);
    if (!cells) return null;
    const selectedCells = this.simplify ? this.simplifyCollinear(cells) : cells;
    const waypoints = selectedCells.map((cell) => this.cellCenter(cell.x, cell.z));
    if (waypoints.length === 0) return null;
    waypoints[0] = clonePoint(start);
    waypoints[waypoints.length - 1] = clonePoint(goal);
    return waypoints;
  }

  private assertOptions(options: GridPathfinderOptions): void {
    const { bounds } = options;
    if (
      !Number.isFinite(bounds.minX) ||
      !Number.isFinite(bounds.maxX) ||
      !Number.isFinite(bounds.minZ) ||
      !Number.isFinite(bounds.maxZ) ||
      bounds.minX >= bounds.maxX ||
      bounds.minZ >= bounds.maxZ
    ) {
      throw new RangeError('pathfinding bounds must be finite and have positive area');
    }
    if (!Number.isFinite(options.cellSize) || options.cellSize <= 0) {
      throw new RangeError('cellSize must be a finite positive number');
    }
    const clearance = options.clearance ?? 0;
    if (!Number.isFinite(clearance) || clearance < 0) {
      throw new RangeError('clearance must be a finite non-negative number');
    }
    if (bounds.minX + clearance >= bounds.maxX - clearance || bounds.minZ + clearance >= bounds.maxZ - clearance) {
      throw new RangeError('clearance leaves no navigable area inside bounds');
    }
    for (const obstacle of options.obstacles ?? []) {
      if (obstacle.kind === 'circle') {
        if (!finitePoint(obstacle.center) || !Number.isFinite(obstacle.radius) || obstacle.radius < 0) {
          throw new RangeError('circle obstacle must have a finite center and non-negative radius');
        }
      } else if (
        !finitePoint(obstacle.min) ||
        !finitePoint(obstacle.max) ||
        obstacle.min.x > obstacle.max.x ||
        obstacle.min.z > obstacle.max.z
      ) {
        throw new RangeError('rect obstacle must have finite ordered min/max points');
      }
    }
  }

  private rasterize(): void {
    for (let z = 0; z < this.height; z += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const center = this.cellCenter(x, z);
        if (!this.insideNavigableBounds(center) || this.pointTouchesObstacle(center)) {
          this.blocked[this.cellIndex(x, z)] = 1;
        }
      }
    }
  }

  private pointTouchesObstacle(point: Vec2): boolean {
    for (const obstacle of this.obstacles) {
      if (obstacle.kind === 'circle') {
        const radius = obstacle.radius + this.clearance;
        const dx = point.x - obstacle.center.x;
        const dz = point.z - obstacle.center.z;
        if (dx * dx + dz * dz <= radius * radius + EPSILON) return true;
      } else if (
        point.x >= obstacle.min.x - this.clearance - EPSILON &&
        point.x <= obstacle.max.x + this.clearance + EPSILON &&
        point.z >= obstacle.min.z - this.clearance - EPSILON &&
        point.z <= obstacle.max.z + this.clearance + EPSILON
      ) {
        return true;
      }
    }
    return false;
  }

  private insideNavigableBounds(point: Vec2): boolean {
    return (
      point.x >= this.bounds.minX + this.clearance - EPSILON &&
      point.x <= this.bounds.maxX - this.clearance + EPSILON &&
      point.z >= this.bounds.minZ + this.clearance - EPSILON &&
      point.z <= this.bounds.maxZ - this.clearance + EPSILON
    );
  }

  private worldToCell(point: Vec2): GridCell | null {
    if (
      point.x < this.bounds.minX - EPSILON ||
      point.x > this.bounds.maxX + EPSILON ||
      point.z < this.bounds.minZ - EPSILON ||
      point.z > this.bounds.maxZ + EPSILON
    ) {
      return null;
    }
    const x = Math.min(this.width - 1, Math.max(0, Math.floor((point.x - this.bounds.minX) / this.cellSize)));
    const z = Math.min(this.height - 1, Math.max(0, Math.floor((point.z - this.bounds.minZ) / this.cellSize)));
    return { x, z };
  }

  private cellCenter(x: number, z: number): Vec2 {
    const minX = this.bounds.minX + x * this.cellSize;
    const maxX = Math.min(this.bounds.maxX, minX + this.cellSize);
    const minZ = this.bounds.minZ + z * this.cellSize;
    const maxZ = Math.min(this.bounds.maxZ, minZ + this.cellSize);
    return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
  }

  private isCellInside(x: number, z: number): boolean {
    return x >= 0 && x < this.width && z >= 0 && z < this.height;
  }

  private isCellBlocked(x: number, z: number): boolean {
    if (!this.isCellInside(x, z)) return true;
    return this.blocked[this.cellIndex(x, z)] === 1;
  }

  private cellIndex(x: number, z: number): number {
    return z * this.width + x;
  }

  private indexToCell(index: number): GridCell {
    return { x: index % this.width, z: Math.floor(index / this.width) };
  }

  private heuristic(x: number, z: number, goalX: number, goalZ: number): number {
    const dx = Math.abs(goalX - x);
    const dz = Math.abs(goalZ - z);
    const diagonal = Math.min(dx, dz);
    const cardinal = Math.max(dx, dz) - diagonal;
    return (diagonal * SQRT_TWO + cardinal) * this.cellSize;
  }

  private reconstructCells(parent: Int32Array, startIndex: number, goalIndex: number): GridCell[] | null {
    const reversed: GridCell[] = [];
    let current = goalIndex;
    let guard = 0;
    while (current !== -1 && guard <= parent.length) {
      reversed.push(this.indexToCell(current));
      if (current === startIndex) break;
      current = parent[current] ?? -1;
      guard += 1;
    }
    if (reversed.length === 0) return null;
    const last = reversed[reversed.length - 1];
    const start = this.indexToCell(startIndex);
    if (!last || last.x !== start.x || last.z !== start.z) return null;
    reversed.reverse();
    return reversed;
  }

  private simplifyCollinear(cells: readonly GridCell[]): GridCell[] {
    if (cells.length <= 2) return cells.map((cell) => ({ ...cell }));
    const result: GridCell[] = [{ ...(cells[0] as GridCell) }];
    for (let index = 1; index < cells.length - 1; index += 1) {
      const previous = cells[index - 1];
      const current = cells[index];
      const next = cells[index + 1];
      if (!previous || !current || !next) continue;
      const firstDirection = {
        x: Math.sign(current.x - previous.x),
        z: Math.sign(current.z - previous.z),
      };
      const secondDirection = {
        x: Math.sign(next.x - current.x),
        z: Math.sign(next.z - current.z),
      };
      if (firstDirection.x !== secondDirection.x || firstDirection.z !== secondDirection.z) {
        result.push({ ...current });
      }
    }
    const last = cells[cells.length - 1];
    if (last) result.push({ ...last });
    return result;
  }
}

/** Convenience helper for one-off queries. Reuse GridPathfinder for many paths. */
export function findGridPath(start: Vec2, goal: Vec2, options: GridPathfinderOptions): Vec2[] | null {
  return new GridPathfinder(options).findPath(start, goal);
}
