import {
  BUILDING_CANCEL_REFUND_RATIO,
  BUILDING_DEFS,
  DEFENSE_MIN_POWER_RATIO,
  GAME_TICK_SECONDS,
  HARVESTER_CARGO_CAPACITY,
  MAP_HALF_SIZE,
  PRODUCTION_CANCEL_REFUND_RATIO,
  RADAR_MIN_POWER_RATIO,
  SIGNAL_TARGET_SECONDS,
  SIGNAL_UNLOCK_SECONDS,
  UNIT_DEFS,
  VISIBILITY_CELL_SIZE,
} from './config';
import { getBreakthroughDifficulty, isPlayableBreakthroughFixture } from './difficulty';
import {
  createInitialAIPlannerMemory,
  planAI,
  type AIPlannerInput,
  type AIPlannerMemory,
  type AIPlannerUnitSummary,
} from './ai-planner';
import { createInitialGameState } from './level';
import { GridPathfinder, type PathObstacle } from './pathfinding';
import {
  advanceTechnology,
  cancelTechnology,
  getTechnologyEffects,
  startTechnology,
  type TechnologyKind,
} from './technology';
import type {
  ArmorClass,
  BuildValidation,
  BuildingKind,
  BuildingState,
  GameCommand,
  GameState,
  SimulationEvent,
  Team,
  UnitKind,
  UnitOrder,
  UnitState,
  Vec2,
} from './types';
import { VisibilityGrid, type VisibilityObserver } from './visibility';

type ActiveTeam = Exclude<Team, 'neutral'>;
type DamageTarget = UnitState | BuildingState;

interface PendingImpact {
  id: number;
  impactTick: number;
  sourceId: string;
  targetId: string;
  team: ActiveTeam;
  damage: number;
  baseDamage: number;
  damageMultipliers: Record<ArmorClass, number>;
  splashRadius: number;
  sourceAt: Vec2;
  fallbackAt: Vec2;
}

type PlayerAttackAlertCategory = 'unit' | 'harvester' | 'building' | 'hq';

interface EnemyCombatResponse {
  home: Vec2;
  contact: Vec2;
  expiresTick: number;
  returning: boolean;
}

interface IncomeRecord {
  at: number;
  amount: number;
}

interface UnitSnapshot {
  id: string;
  position: Vec2;
  radius: number;
}

const ACTIVE_TEAMS: readonly ActiveTeam[] = ['player', 'enemy'];
const EPSILON = 1e-7;
const MAX_BUILD_QUEUE = 3;
const MAX_PRODUCTION_QUEUE = 5;
const MAX_BANDWIDTH = 80;
const DISCONNECT_RESERVE_SECONDS = 20;
const HARVEST_RATE_PER_SECOND = 25;
const DEPOSIT_INTERACTION_RANGE = 0.9;
const RESOURCE_INTERACTION_RANGE = 0.6;
const REPAIR_INTERACTION_RANGE = 1.15;
const REPAIR_RATE_PER_SECOND = 48;
const REPAIR_CREDITS_PER_HP = 0.18;
const REPAIR_EVENT_TICKS = Math.max(1, Math.round(0.5 / GAME_TICK_SECONDS));
const ARTILLERY_SPLASH_RADIUS = 4.5;
const ARTILLERY_MIN_SPLASH_FACTOR = 0.22;
const NAVIGATION_CELL_SIZE = 1.5;
const NAVIGATION_PADDING = 0.2;
const FORMATION_MIN_SPACING = 2.8;
const AI_UPDATE_TICKS = Math.max(1, Math.round(1 / GAME_TICK_SECONDS));
const PLAYER_ATTACK_ALERT_COOLDOWN_TICKS = Math.max(1, Math.round(4 / GAME_TICK_SECONDS));
const ENEMY_COMBAT_RESPONSE_TICKS = Math.max(1, Math.round(10 / GAME_TICK_SECONDS));
const ENEMY_COMBAT_RESPONSE_RADIUS = 34;
const ENEMY_COMBAT_RESPONSE_HQ_RADIUS = 42;
const ENEMY_COMBAT_RESPONSE_MAX_UNITS = 4;
const ENEMY_COMBAT_RESPONSE_HQ_MAX_UNITS = 6;
const ENEMY_COMBAT_RETURN_DISTANCE = 0.75;
const BASE_BUILDING_SIGHT = 7;
const HQ_RADAR_RANGE = 18;
const RELAY_RADAR_RANGE = 15;
const BREAKTHROUGH_PRODUCED_VEHICLE_ID = /^u-player-(?:scout|suppressor|tank|artillery)-\d{6}$/u;

const BUILDING_KINDS: readonly BuildingKind[] = [
  'hq',
  'reactor',
  'refinery',
  'barracks',
  'factory',
  'relay',
  'sentry',
  'cannon',
];

const DAMAGE_MULTIPLIERS: Record<Exclude<UnitKind, 'engineer' | 'harvester'>, Record<ArmorClass, number>> = {
  scout: { infantry: 1.1, light: 1, heavy: 0.35, building: 0.3 },
  rifle: { infantry: 1.25, light: 0.7, heavy: 0.25, building: 0.2 },
  antitank: { infantry: 0.45, light: 1.15, heavy: 1.75, building: 1 },
  suppressor: { infantry: 1.6, light: 1.25, heavy: 0.45, building: 0.4 },
  tank: { infantry: 0.7, light: 1.25, heavy: 1.15, building: 1 },
  artillery: { infantry: 1.3, light: 1, heavy: 0.7, building: 1.5 },
};

const AI_COMBAT_POWER: Record<UnitKind, number> = {
  scout: 1.1,
  rifle: 1,
  antitank: 1.7,
  engineer: 0,
  suppressor: 1.8,
  tank: 3,
  artillery: 2.5,
  harvester: 0,
};

const cloneVec = (value: Vec2): Vec2 => ({ x: value.x, z: value.z });

const cloneOrder = (order: UnitOrder): UnitOrder => ({
  type: order.type,
  target: order.target ? cloneVec(order.target) : undefined,
  targetId: order.targetId,
  queued: order.queued,
  waypoints: order.waypoints?.map(cloneVec),
  waypointIndex: order.waypointIndex,
});

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const finiteVec = (value: Vec2): boolean => Number.isFinite(value.x) && Number.isFinite(value.z);

const distanceSquared = (a: Vec2, b: Vec2): number => {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
};

const distance = (a: Vec2, b: Vec2): number => Math.sqrt(distanceSquared(a, b));

const normalized = (x: number, z: number): Vec2 => {
  const magnitude = Math.hypot(x, z);
  if (magnitude <= EPSILON) return { x: 0, z: 0 };
  return { x: x / magnitude, z: z / magnitude };
};

const rotateVector = (vector: Vec2, angle: number): Vec2 => {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    x: vector.x * cosine - vector.z * sine,
    z: vector.x * sine + vector.z * cosine,
  };
};

const compareStableText = (left: string, right: string): number => (left === right ? 0 : left < right ? -1 : 1);

const stableById = <T extends { id: string }>(values: readonly T[]): T[] =>
  [...values].sort((left, right) => compareStableText(left.id, right.id));

const buildingAxes = (rotation: number): { right: Vec2; forward: Vec2 } => ({
  right: { x: Math.cos(rotation), z: -Math.sin(rotation) },
  forward: { x: Math.sin(rotation), z: Math.cos(rotation) },
});

const buildingHalfExtents = (building: Pick<BuildingState, 'footprint'>): Vec2 => ({
  x: building.footprint.x / 2,
  z: building.footprint.z / 2,
});

const pointToOrientedBuildingDistance = (point: Vec2, building: BuildingState): number => {
  const axes = buildingAxes(building.rotation);
  const deltaX = point.x - building.position.x;
  const deltaZ = point.z - building.position.z;
  const localX = deltaX * axes.right.x + deltaZ * axes.right.z;
  const localZ = deltaX * axes.forward.x + deltaZ * axes.forward.z;
  const half = buildingHalfExtents(building);
  const outsideX = Math.max(0, Math.abs(localX) - half.x);
  const outsideZ = Math.max(0, Math.abs(localZ) - half.z);
  return Math.hypot(outsideX, outsideZ);
};

const orientedBuildingsOverlap = (
  left: Pick<BuildingState, 'position' | 'rotation' | 'footprint'>,
  right: Pick<BuildingState, 'position' | 'rotation' | 'footprint'>,
  padding = 0,
): boolean => {
  const leftAxes = buildingAxes(left.rotation);
  const rightAxes = buildingAxes(right.rotation);
  const axes = [leftAxes.right, leftAxes.forward, rightAxes.right, rightAxes.forward];
  const delta = { x: right.position.x - left.position.x, z: right.position.z - left.position.z };
  const leftHalf = { x: left.footprint.x / 2 + padding, z: left.footprint.z / 2 + padding };
  const rightHalf = { x: right.footprint.x / 2 + padding, z: right.footprint.z / 2 + padding };

  for (const axis of axes) {
    const projectedCenter = Math.abs(delta.x * axis.x + delta.z * axis.z);
    const leftRadius =
      leftHalf.x * Math.abs(leftAxes.right.x * axis.x + leftAxes.right.z * axis.z) +
      leftHalf.z * Math.abs(leftAxes.forward.x * axis.x + leftAxes.forward.z * axis.z);
    const rightRadius =
      rightHalf.x * Math.abs(rightAxes.right.x * axis.x + rightAxes.right.z * axis.z) +
      rightHalf.z * Math.abs(rightAxes.forward.x * axis.x + rightAxes.forward.z * axis.z);
    if (projectedCenter >= leftRadius + rightRadius - EPSILON) return false;
  }
  return true;
};

const circleOverlapsBuilding = (
  center: Vec2,
  radius: number,
  building: Pick<BuildingState, 'position' | 'rotation' | 'footprint'>,
): boolean => {
  const axes = buildingAxes(building.rotation);
  const deltaX = center.x - building.position.x;
  const deltaZ = center.z - building.position.z;
  const localX = deltaX * axes.right.x + deltaZ * axes.right.z;
  const localZ = deltaX * axes.forward.x + deltaZ * axes.forward.z;
  const halfX = building.footprint.x / 2;
  const halfZ = building.footprint.z / 2;
  const closestX = clamp(localX, -halfX, halfX);
  const closestZ = clamp(localZ, -halfZ, halfZ);
  const offsetX = localX - closestX;
  const offsetZ = localZ - closestZ;
  return offsetX * offsetX + offsetZ * offsetZ < radius * radius - EPSILON;
};

const segmentIntersectsCircle = (start: Vec2, end: Vec2, center: Vec2, radius: number): boolean => {
  const segmentX = end.x - start.x;
  const segmentZ = end.z - start.z;
  const lengthSquared = segmentX * segmentX + segmentZ * segmentZ;
  if (lengthSquared <= EPSILON) return distanceSquared(start, center) <= radius * radius;
  const projection = clamp(
    ((center.x - start.x) * segmentX + (center.z - start.z) * segmentZ) / lengthSquared,
    0,
    1,
  );
  const closest = { x: start.x + segmentX * projection, z: start.z + segmentZ * projection };
  return distanceSquared(closest, center) <= radius * radius;
};

const armorClassFor = (target: DamageTarget): ArmorClass => {
  if (target.entityType === 'building') return 'building';
  if (target.kind === 'rifle' || target.kind === 'antitank' || target.kind === 'engineer') return 'infantry';
  if (target.kind === 'tank' || target.kind === 'artillery') return 'heavy';
  return 'light';
};

const stableSerialize = (value: unknown): string => {
  if (value === null) return 'null';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return JSON.stringify(String(value));
    return String(Math.round(value * 1_000_000) / 1_000_000);
  }
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort(compareStableText);
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(String(value));
};

/**
 * Deterministic, presentation-agnostic game simulation.
 *
 * The public state intentionally uses plain data from types.ts. Rendering, input
 * devices, wall-clock time, and browser APIs never enter this module.
 */
export class GameSimulation {
  public state: GameState;

  private readonly initialSeed: number;
  private fixture: string;
  private accumulator = 0;
  private events: SimulationEvent[] = [];
  private pendingImpacts: PendingImpact[] = [];
  private readonly orderQueues = new Map<string, UnitOrder[]>();
  private readonly disconnectReserve = new Map<string, number>();
  private readonly incomeRecords: Record<ActiveTeam, IncomeRecord[]> = { player: [], enemy: [] };
  private readonly playerAttackAlertReadyTicks = new Map<PlayerAttackAlertCategory, number>();
  private readonly enemyCombatResponses = new Map<string, EnemyCombatResponse>();
  private enemyAiMemory: AIPlannerMemory = createInitialAIPlannerMemory();
  private readonly visibilityGrid = new VisibilityGrid({
    bounds: { minX: -MAP_HALF_SIZE, maxX: MAP_HALF_SIZE, minZ: -MAP_HALF_SIZE, maxZ: MAP_HALF_SIZE },
    cellSize: VISIBILITY_CELL_SIZE,
  });
  private rngState: number;
  private entitySequence = 1;
  private impactSequence = 1;
  private notificationSequence = 1;

  public constructor(seed = 1949, fixture = 'default') {
    this.initialSeed = Number.isFinite(seed) ? Math.trunc(seed) : 1949;
    this.fixture = fixture;
    this.rngState = this.seedToRngState(this.initialSeed);
    this.state = createInitialGameState(this.initialSeed, fixture);
    this.initializeRuntimeState();
  }

  public step(dt = GAME_TICK_SECONDS): void {
    if (!Number.isFinite(dt) || dt <= 0 || this.state.status !== 'active') return;
    this.accumulator += dt;
    const ticks = Math.floor((this.accumulator + EPSILON) / GAME_TICK_SECONDS);
    if (ticks <= 0) return;
    this.accumulator -= ticks * GAME_TICK_SECONDS;
    if (this.accumulator < EPSILON) this.accumulator = 0;
    for (let index = 0; index < ticks && this.state.status === 'active'; index += 1) this.simulateTick();
  }

  public issue(command: GameCommand): { ok: boolean; reason: string } {
    if (this.state.status !== 'active') return { ok: false, reason: '对局已经结束' };

    switch (command.type) {
      case 'move':
      case 'attackMove': {
        if (!finiteVec(command.target)) return { ok: false, reason: '目标位置无效' };
        if (!this.isInsideMap(command.target, 0)) return { ok: false, reason: '目标位置超出地图' };
        const unitsResult = this.playerUnitsForCommand(command.unitIds);
        if (!unitsResult.ok) return unitsResult.result;
        const orderType: UnitOrder['type'] = command.type === 'move' ? 'move' : 'attackMove';
        const planned = this.planFormationOrders(
          unitsResult.units,
          command.target,
          orderType,
          command.queued === true,
        );
        if (!planned) return { ok: false, reason: '目标位置不可达' };
        for (const { unit, order } of planned) this.assignOrder(unit, order, command.queued === true);
        this.emitCommand(command.target);
        return { ok: true, reason: 'ok' };
      }
      case 'attack': {
        const unitsResult = this.playerUnitsForCommand(command.unitIds);
        if (!unitsResult.ok) return unitsResult.result;
        const target = this.targetById(command.targetId);
        if (!target || target.hp <= 0 || target.team !== 'enemy') return { ok: false, reason: '攻击目标无效' };
        if (!this.isEnemyVisibleTo('player', target.id)) return { ok: false, reason: '目标不在当前视野内' };
        const combatUnits = unitsResult.units.filter((unit) => UNIT_DEFS[unit.kind].damage > 0);
        if (combatUnits.length === 0) return { ok: false, reason: '所选单位没有攻击能力' };
        for (const unit of combatUnits) {
          this.assignOrder(unit, { type: 'attack', targetId: target.id }, command.queued === true);
        }
        this.emitCommand(target.position);
        return { ok: true, reason: 'ok' };
      }
      case 'gather': {
        const unitsResult = this.playerUnitsForCommand(command.unitIds);
        if (!unitsResult.ok) return unitsResult.result;
        if (unitsResult.units.some((unit) => unit.kind !== 'harvester')) {
          return { ok: false, reason: '只有采集车可以采集辉晶' };
        }
        const resource = this.state.resources.find((candidate) => candidate.id === command.resourceId && candidate.amount > 0);
        if (!resource) return { ok: false, reason: '资源点无效或已经耗尽' };
        if (this.visibilityGrid.getRadiusState(this.state.intel.player.visibility, resource.position, resource.radius) === 'unknown') {
          return { ok: false, reason: '资源点尚未侦察' };
        }
        for (const unit of unitsResult.units) {
          this.assignOrder(unit, { type: 'gather', targetId: resource.id }, command.queued === true);
        }
        this.emitCommand(resource.position);
        return { ok: true, reason: 'ok' };
      }
      case 'repair': {
        const unitsResult = this.playerUnitsForCommand(command.unitIds);
        if (!unitsResult.ok) return unitsResult.result;
        const engineers = unitsResult.units.filter((unit) => unit.kind === 'engineer');
        if (engineers.length === 0) return { ok: false, reason: '只有工兵组可以维修' };
        const target = this.targetById(command.targetId);
        if (!target || target.team !== 'player' || target.hp <= 0) {
          return { ok: false, reason: '维修目标无效' };
        }
        if (target.entityType === 'building' && target.buildProgress < 1) {
          return { ok: false, reason: '施工中的建筑不能维修' };
        }
        if (target.hp >= target.maxHp - EPSILON) return { ok: false, reason: '目标无需维修' };
        for (const engineer of engineers) {
          this.assignOrder(engineer, { type: 'repair', targetId: target.id }, command.queued === true);
        }
        this.emitCommand(target.position);
        return { ok: true, reason: 'ok' };
      }
      case 'stop': {
        const unitsResult = this.playerUnitsForCommand(command.unitIds);
        if (!unitsResult.ok) return unitsResult.result;
        for (const unit of unitsResult.units) {
          this.orderQueues.delete(unit.id);
          unit.order = { type: 'idle' };
        }
        this.emitCommand(unitsResult.units[0]?.position ?? { x: 0, z: 0 });
        return { ok: true, reason: 'ok' };
      }
      case 'build': {
        const validation = this.validateBuild(command.kind, command.position, command.rotation);
        if (!validation.valid) return { ok: false, reason: validation.reason };
        this.createConstruction('player', command.kind, command.position, command.rotation);
        this.emitCommand(command.position);
        return { ok: true, reason: 'ok' };
      }
      case 'produce': {
        const building = this.state.buildings.find((candidate) => candidate.id === command.buildingId);
        if (!building || building.team !== 'player') return { ok: false, reason: '生产建筑无效' };
        const result = this.enqueueProduction('player', building, command.unitKind);
        if (result.ok) this.emitCommand(building.position);
        return result;
      }
      case 'setRally': {
        if (!finiteVec(command.target) || !this.isInsideMap(command.target, 0)) {
          return { ok: false, reason: '集结点超出地图' };
        }
        const building = this.state.buildings.find((candidate) => candidate.id === command.buildingId);
        if (!building || building.team !== 'player' || building.buildProgress < 1) {
          return { ok: false, reason: '建筑无效或尚未完工' };
        }
        building.rallyPoint = cloneVec(command.target);
        this.emitCommand(command.target);
        return { ok: true, reason: 'ok' };
      }
      case 'research': {
        const result = this.startResearch('player', command.kind);
        if (result.ok) this.emitCommand(result.at);
        return { ok: result.ok, reason: result.reason };
      }
      case 'cancelConstruction': {
        const building = this.state.buildings.find((candidate) => candidate.id === command.buildingId);
        if (!building || building.team !== 'player' || building.buildProgress >= 1 || building.hp <= 0) {
          return { ok: false, reason: '没有可取消的施工项目' };
        }
        const refund = BUILDING_DEFS[building.kind].cost * BUILDING_CANCEL_REFUND_RATIO;
        this.state.economy.player.credits += refund;
        this.state.buildings = this.state.buildings.filter((candidate) => candidate.id !== building.id);
        this.disconnectReserve.delete(building.id);
        this.events.push({ type: 'cancelled', at: cloneVec(building.position), team: 'player', sourceId: building.id, amount: refund });
        this.emitCommand(building.position);
        this.recomputeNetworkAndEconomy();
        this.updateIntel();
        return { ok: true, reason: 'ok' };
      }
      case 'cancelProduction': {
        const building = this.state.buildings.find((candidate) => candidate.id === command.buildingId);
        const item = building?.team === 'player' ? building.queue[0] : undefined;
        if (!building || !item) return { ok: false, reason: '没有可取消的生产项目' };
        building.queue.shift();
        const refund = UNIT_DEFS[item.unitKind].cost * PRODUCTION_CANCEL_REFUND_RATIO;
        this.state.economy.player.credits += refund;
        this.events.push({ type: 'cancelled', at: cloneVec(building.position), team: 'player', sourceId: building.id, amount: refund });
        this.emitCommand(building.position);
        return { ok: true, reason: 'ok' };
      }
      case 'cancelResearch': {
        const result = cancelTechnology(this.state.technology.player, this.state.economy.player.credits);
        if (!result.ok) return { ok: false, reason: '没有可取消的科技研究' };
        const hq = this.operationalHq('player');
        this.state.technology.player = result.state;
        this.state.economy.player.credits = result.credits;
        const at = cloneVec(hq?.position ?? { x: -52, z: 46 });
        this.events.push({ type: 'cancelled', at, team: 'player', amount: result.creditDelta });
        this.emitCommand(at);
        return { ok: true, reason: 'ok' };
      }
      default: {
        const exhaustive: never = command;
        return { ok: false, reason: `未知命令：${String(exhaustive)}` };
      }
    }
  }

  public validateBuild(kind: BuildingKind, position: Vec2, rotation: number): BuildValidation {
    return this.validateBuildForTeam('player', kind, position, rotation);
  }

  public drainEvents(): SimulationEvent[] {
    const drained = this.events.map((event) => ({ ...event, at: cloneVec(event.at) }));
    this.events = [];
    return drained;
  }

  public restart(fixture?: string): void {
    if (fixture !== undefined) this.fixture = fixture;
    this.state = createInitialGameState(this.initialSeed, this.fixture);
    this.accumulator = 0;
    this.events = [];
    this.pendingImpacts = [];
    this.orderQueues.clear();
    this.disconnectReserve.clear();
    this.incomeRecords.player = [];
    this.incomeRecords.enemy = [];
    this.playerAttackAlertReadyTicks.clear();
    this.enemyCombatResponses.clear();
    this.rngState = this.seedToRngState(this.initialSeed);
    this.entitySequence = 1;
    this.impactSequence = 1;
    this.notificationSequence = 1;
    this.enemyAiMemory = createInitialAIPlannerMemory();
    this.initializeRuntimeState();
  }

  public hashState(): string {
    const queueSnapshot = [...this.orderQueues.entries()]
      .sort(([left], [right]) => compareStableText(left, right))
      .map(([id, orders]) => [id, orders.map((order) => cloneOrder(order))]);
    const reserveSnapshot = [...this.disconnectReserve.entries()].sort(([left], [right]) => compareStableText(left, right));
    const alertSnapshot = [...this.playerAttackAlertReadyTicks.entries()].sort(([left], [right]) => compareStableText(left, right));
    const combatResponseSnapshot = [...this.enemyCombatResponses.entries()]
      .sort(([left], [right]) => compareStableText(left, right))
      .map(([id, response]) => [id, {
        home: cloneVec(response.home),
        contact: cloneVec(response.contact),
        expiresTick: response.expiresTick,
        returning: response.returning,
      }]);
    const authoritative = {
      seed: this.state.seed,
      tick: this.state.tick,
      elapsed: this.state.elapsed,
      status: this.state.status,
      statusReason: this.state.statusReason,
      rngState: this.rngState,
      entitySequence: this.entitySequence,
      impactSequence: this.impactSequence,
      enemyAiMemory: this.enemyAiMemory,
      playerAttackAlertReadyTicks: alertSnapshot,
      enemyCombatResponses: combatResponseSnapshot,
      units: stableById(this.state.units).map((unit) => ({
        id: unit.id,
        team: unit.team,
        kind: unit.kind,
        position: unit.position,
        rotation: unit.rotation,
        hp: unit.hp,
        maxHp: unit.maxHp,
        cooldownRemaining: unit.cooldownRemaining,
        order: unit.order,
        cargo: unit.cargo,
        cargoCapacity: unit.cargoCapacity,
      })),
      buildings: stableById(this.state.buildings).map((building) => ({
        id: building.id,
        team: building.team,
        kind: building.kind,
        position: building.position,
        rotation: building.rotation,
        aimRotation: building.aimRotation,
        hp: building.hp,
        maxHp: building.maxHp,
        connected: building.connected,
        powered: building.powered,
        buildProgress: building.buildProgress,
        cooldownRemaining: building.cooldownRemaining,
        queue: building.queue,
        rallyPoint: building.rallyPoint,
      })),
      resources: stableById(this.state.resources).map((resource) => ({
        id: resource.id,
        amount: resource.amount,
      })),
      blockers: stableById(this.state.blockers),
      beacon: this.state.beacon,
      ai: this.state.ai,
      economy: this.state.economy,
      intel: this.state.intel,
      mission: this.state.mission,
      technology: this.state.technology,
      pendingImpacts: [...this.pendingImpacts].sort((left, right) => left.id - right.id),
      orderQueues: queueSnapshot,
      disconnectReserve: reserveSnapshot,
      incomeRecords: {
        player: this.incomeRecords.player,
        enemy: this.incomeRecords.enemy,
      },
    };
    const serialized = stableSerialize(authoritative);
    let hash = 0x811c9dc5;
    for (let index = 0; index < serialized.length; index += 1) {
      hash ^= serialized.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  private initializeRuntimeState(): void {
    this.state.beacon.targetProgress = SIGNAL_TARGET_SECONDS;
    this.recomputeNetworkAndEconomy();
    this.updateIntel();
    if (this.fixture === 'visual-gold-review') return;
    for (const unit of stableById(this.state.units)) {
      if (unit.kind !== 'harvester' || unit.order.type !== 'idle') continue;
      const resource = this.nearestResource(unit.position);
      if (resource) unit.order = { type: 'gather', targetId: resource.id };
    }
  }

  private simulateTick(): void {
    this.state.tick += 1;
    this.state.elapsed = Math.round((this.state.elapsed + GAME_TICK_SECONDS) * 1_000_000) / 1_000_000;

    for (const unit of stableById(this.state.units)) {
      unit.cooldownRemaining = Math.max(0, unit.cooldownRemaining - GAME_TICK_SECONDS);
    }
    for (const building of stableById(this.state.buildings)) {
      building.cooldownRemaining = Math.max(0, building.cooldownRemaining - GAME_TICK_SECONDS);
    }

    this.recomputeNetworkAndEconomy();
    this.updateConstructions();
    this.updateProduction();
    this.updateResearch();
    this.updateIntel();
    this.updateMissionDirector();
    this.runEnemyAi();
    this.updateEnemyCombatResponses();

    const snapshots = stableById(this.state.units).map<UnitSnapshot>((unit) => ({
      id: unit.id,
      position: cloneVec(unit.position),
      radius: unit.radius,
    }));
    this.updateUnits(snapshots);
    this.updateIntel();
    this.updateDefenses();
    this.resolvePendingImpacts();
    this.removeDestroyedEntities();
    this.recomputeNetworkAndEconomy();
    this.updateIntel();
    this.updateBeacon();
    this.resolveVictory();
    this.updateIncomeRates();
    this.ageDisconnectReserve();
    this.state.notifications = this.state.notifications.filter((notification) => notification.expiresAt > this.state.elapsed);
  }

  private updateUnits(snapshots: readonly UnitSnapshot[]): void {
    for (const unit of stableById(this.state.units)) {
      if (unit.hp <= 0) continue;
      switch (unit.order.type) {
        case 'move':
          this.followMoveOrder(unit, snapshots, false);
          break;
        case 'attackMove':
          this.followAttackMoveOrder(unit, snapshots);
          break;
        case 'attack':
          this.followAttackOrder(unit, snapshots);
          break;
        case 'gather':
          this.followGatherOrder(unit, snapshots);
          break;
        case 'return':
          this.followReturnOrder(unit, snapshots);
          break;
        case 'repair':
          this.followRepairOrder(unit, snapshots);
          break;
        case 'idle':
          // The visual-gold fixture is a stable showroom: explicit player
          // commands still run, but idle acquisition must not rearrange the
          // comparison lineup between screenshots.
          if (this.fixture !== 'visual-gold-review') this.handleIdleCombat(unit, snapshots);
          break;
        default: {
          const exhaustive: never = unit.order.type;
          void exhaustive;
        }
      }
    }
  }

  private followMoveOrder(unit: UnitState, snapshots: readonly UnitSnapshot[], attackMove: boolean): void {
    const finalTarget = unit.order.target;
    if (!finalTarget) {
      this.completeOrder(unit);
      return;
    }
    if (attackMove) {
      const enemy = this.acquireTarget(unit, UNIT_DEFS[unit.kind].sight);
      if (enemy) {
        this.engageTarget(unit, enemy, snapshots);
        return;
      }
    }
    const waypoints = unit.order.waypoints ?? [];
    const waypointIndex = Math.max(0, Math.min(unit.order.waypointIndex ?? 0, Math.max(0, waypoints.length - 1)));
    const target = waypoints[waypointIndex] ?? finalTarget;
    const intermediateWaypoint = waypoints.length > 0 && waypointIndex < waypoints.length - 1;
    if (intermediateWaypoint) {
      // Formation paths can converge on the same A* grid corner. Requiring
      // every large unit to put its centre inside the final 0.3-unit arrival
      // radius deadlocks the group against its own separation steering.
      // Intermediate nodes are route hints, so accept them within the mover's
      // clearance envelope plus half a grid cell. The final waypoint still
      // uses moveUnitToward's strict 0.3-unit arrival rule below.
      const arrivalRadius = unit.radius + NAVIGATION_PADDING + NAVIGATION_CELL_SIZE / 2;
      if (distanceSquared(unit.position, target) <= arrivalRadius * arrivalRadius + EPSILON) {
        unit.order.waypointIndex = waypointIndex + 1;
        return;
      }
    }
    const arrived = this.moveUnitToward(unit, target, snapshots);
    if (!arrived) return;
    if (waypoints.length > 0 && waypointIndex < waypoints.length - 1) {
      unit.order.waypointIndex = waypointIndex + 1;
      return;
    }
    this.completeOrder(unit);
  }

  private followAttackMoveOrder(unit: UnitState, snapshots: readonly UnitSnapshot[]): void {
    if (UNIT_DEFS[unit.kind].damage <= 0) {
      this.followMoveOrder(unit, snapshots, false);
      return;
    }
    this.followMoveOrder(unit, snapshots, true);
  }

  private followAttackOrder(unit: UnitState, snapshots: readonly UnitSnapshot[]): void {
    const targetId = unit.order.targetId;
    const target = targetId ? this.targetById(targetId) : undefined;
    if (!target || target.hp <= 0 || target.team === unit.team || !this.isEnemyVisibleTo(unit.team, target.id)) {
      this.completeOrder(unit);
      return;
    }
    this.engageTarget(unit, target, snapshots);
  }

  private handleIdleCombat(unit: UnitState, snapshots: readonly UnitSnapshot[]): void {
    const definition = UNIT_DEFS[unit.kind];
    if (definition.damage <= 0) return;
    const target = this.acquireTarget(unit, Math.min(definition.sight, definition.range + 3));
    if (target) this.engageTarget(unit, target, snapshots);
  }

  private engageTarget(unit: UnitState, target: DamageTarget, snapshots: readonly UnitSnapshot[]): void {
    const definition = UNIT_DEFS[unit.kind];
    if (definition.damage <= 0) return;
    const surfaceDistance = this.surfaceDistance(unit, target);
    if (surfaceDistance > definition.range + EPSILON) {
      this.moveUnitToward(unit, target.position, snapshots);
      return;
    }
    if (definition.minRange > 0 && surfaceDistance < definition.minRange - EPSILON) {
      const retreat = normalized(unit.position.x - target.position.x, unit.position.z - target.position.z);
      this.moveUnitToward(
        unit,
        {
          x: clamp(unit.position.x + retreat.x * 4, -MAP_HALF_SIZE, MAP_HALF_SIZE),
          z: clamp(unit.position.z + retreat.z * 4, -MAP_HALF_SIZE, MAP_HALF_SIZE),
        },
        snapshots,
      );
      return;
    }
    if (unit.cooldownRemaining > EPSILON || !this.hasLineOfSight(unit.position, target.position)) return;

    const multiplierTable = DAMAGE_MULTIPLIERS[unit.kind as keyof typeof DAMAGE_MULTIPLIERS];
    if (!multiplierTable) return;
    const damage = definition.damage * multiplierTable[armorClassFor(target)];
    const travelSeconds = definition.projectileSpeed > 0
      ? distance(unit.position, target.position) / definition.projectileSpeed
      : 0;
    const travelTicks = Math.max(1, Math.ceil(travelSeconds / GAME_TICK_SECONDS));
    this.pendingImpacts.push({
      id: this.impactSequence,
      impactTick: this.state.tick + travelTicks,
      sourceId: unit.id,
      targetId: target.id,
      team: unit.team,
      damage,
      baseDamage: definition.damage,
      damageMultipliers: { ...multiplierTable },
      splashRadius: unit.kind === 'artillery' ? ARTILLERY_SPLASH_RADIUS : 0,
      sourceAt: cloneVec(unit.position),
      fallbackAt: cloneVec(target.position),
    });
    this.impactSequence += 1;
    unit.cooldownRemaining = definition.cooldown;
    unit.rotation = Math.atan2(target.position.x - unit.position.x, target.position.z - unit.position.z);
    this.events.push({
      type: 'shot',
      at: cloneVec(unit.position),
      team: unit.team,
      sourceId: unit.id,
      targetId: target.id,
      amount: damage,
    });
  }

  private updateDefenses(): void {
    for (const building of stableById(this.state.buildings)) {
      const weapon = BUILDING_DEFS[building.kind].weapon;
      if (!weapon || building.hp <= 0 || building.buildProgress < 1) continue;
      if (
        !building.connected ||
        !building.powered ||
        this.state.economy[building.team].powerRatio + EPSILON < DEFENSE_MIN_POWER_RATIO
      ) {
        continue;
      }

      const candidates = stableById<DamageTarget>([
        ...this.state.units.filter((candidate) => candidate.team !== building.team && candidate.hp > 0),
        ...this.state.buildings.filter(
          (candidate) => candidate.team !== building.team && candidate.hp > 0 && candidate.buildProgress > 0,
        ),
      ])
        .filter((candidate) => this.isEnemyVisibleTo(building.team, candidate.id))
        .filter((candidate) => {
          const targetDistance = this.defenseTargetDistance(building, candidate);
          return (
            targetDistance <= weapon.range + EPSILON &&
            targetDistance >= weapon.minRange - EPSILON &&
            this.hasLineOfSight(building.position, candidate.position)
          );
        })
        .sort((left, right) => {
          const priorityDifference =
            weapon.damageMultipliers[armorClassFor(right)] - weapon.damageMultipliers[armorClassFor(left)];
          if (Math.abs(priorityDifference) > EPSILON) return priorityDifference;
          const distanceDifference =
            this.defenseTargetDistance(building, left) - this.defenseTargetDistance(building, right);
          return Math.abs(distanceDifference) > EPSILON
            ? distanceDifference
            : compareStableText(left.id, right.id);
        });
      const target = candidates[0];
      if (!target) continue;

      building.aimRotation = Math.atan2(
        target.position.x - building.position.x,
        target.position.z - building.position.z,
      );
      if (building.cooldownRemaining > EPSILON) continue;

      const multipliers = weapon.damageMultipliers;
      const damage = weapon.damage * multipliers[armorClassFor(target)];
      const travelSeconds = weapon.projectileSpeed > 0
        ? distance(building.position, target.position) / weapon.projectileSpeed
        : 0;
      const travelTicks = Math.max(1, Math.ceil(travelSeconds / GAME_TICK_SECONDS));
      this.pendingImpacts.push({
        id: this.impactSequence,
        impactTick: this.state.tick + travelTicks,
        sourceId: building.id,
        targetId: target.id,
        team: building.team,
        damage,
        baseDamage: weapon.damage,
        damageMultipliers: { ...multipliers },
        splashRadius: weapon.splashRadius,
        sourceAt: cloneVec(building.position),
        fallbackAt: cloneVec(target.position),
      });
      this.impactSequence += 1;
      building.cooldownRemaining = weapon.cooldown;
      this.events.push({
        type: 'shot',
        at: cloneVec(building.position),
        team: building.team,
        sourceId: building.id,
        targetId: target.id,
        amount: damage,
        radius: weapon.splashRadius || undefined,
      });
    }
  }

  private defenseTargetDistance(source: BuildingState, target: DamageTarget): number {
    if (target.entityType === 'unit') {
      return Math.max(0, distance(source.position, target.position) - target.radius);
    }
    return pointToOrientedBuildingDistance(source.position, target);
  }

  private resolvePendingImpacts(): void {
    const due: PendingImpact[] = [];
    const future: PendingImpact[] = [];
    for (const impact of this.pendingImpacts) {
      if (impact.impactTick <= this.state.tick) due.push(impact);
      else future.push(impact);
    }
    this.pendingImpacts = future;
    due.sort((left, right) => left.impactTick - right.impactTick || left.id - right.id);

    for (const impact of due) {
      const target = this.targetById(impact.targetId);
      const at = target ? cloneVec(target.position) : cloneVec(impact.fallbackAt);
      this.events.push({
        type: 'impact',
        at,
        team: impact.team,
        sourceId: impact.sourceId,
        targetId: impact.targetId,
        amount: impact.damage,
        radius: impact.splashRadius || undefined,
      });
      const candidates = impact.splashRadius > 0
        ? stableById<DamageTarget>([
          ...this.state.units.filter((candidate) => candidate.team !== impact.team && candidate.hp > 0),
          ...this.state.buildings.filter((candidate) => candidate.team !== impact.team && candidate.hp > 0),
        ]).filter((candidate) => distance(candidate.position, at) <= impact.splashRadius + EPSILON)
        : target && target.hp > 0 && target.team !== impact.team
          ? [target]
          : [];

      for (const candidate of candidates) {
        const multiplierTable = impact.damageMultipliers;
        const radialDistance = distance(candidate.position, at);
        const factor = impact.splashRadius > 0
          ? candidate.id === impact.targetId
            ? 1
            : Math.max(ARTILLERY_MIN_SPLASH_FACTOR, 1 - radialDistance / impact.splashRadius)
          : 1;
        const damage = impact.splashRadius > 0
          ? impact.baseDamage * multiplierTable[armorClassFor(candidate)] * factor
          : impact.damage;
        candidate.hp = Math.max(0, candidate.hp - damage);
        if (damage > EPSILON) this.handleCombatDamage(candidate, impact, damage);
        if (candidate.hp <= 0) {
          this.events.push({
            type: 'destroyed',
            at: cloneVec(candidate.position),
            team: candidate.team,
            sourceId: impact.sourceId,
            targetId: candidate.id,
          });
        }
      }
    }
  }

  private handleCombatDamage(candidate: DamageTarget, impact: PendingImpact, damage: number): void {
    if (candidate.team === 'player' && impact.team === 'enemy') {
      this.emitPlayerAttackAlert(candidate, damage);
      return;
    }
    if (candidate.team === 'enemy' && impact.team === 'player') {
      if (this.isEnemyVisibleTo('enemy', impact.sourceId)) return;
      if (this.state.mission.kind === 'breakthrough' && this.state.mission.phase !== 'command') return;
      this.registerEnemyCombatResponse(candidate, impact.sourceAt);
    }
  }

  private emitPlayerAttackAlert(candidate: DamageTarget, damage: number): void {
    const category: PlayerAttackAlertCategory = candidate.entityType === 'building'
      ? candidate.kind === 'hq' ? 'hq' : 'building'
      : candidate.kind === 'harvester' ? 'harvester' : 'unit';
    const readyTick = this.playerAttackAlertReadyTicks.get(category) ?? 0;
    if (this.state.tick < readyTick) return;
    this.playerAttackAlertReadyTicks.set(category, this.state.tick + PLAYER_ATTACK_ALERT_COOLDOWN_TICKS);

    const tone: GameState['notifications'][number]['tone'] = category === 'unit' ? 'warning' : 'danger';
    const text = category === 'hq'
      ? '指挥核心遭到攻击'
      : category === 'building'
        ? `${candidate.entityType === 'building' ? BUILDING_DEFS[candidate.kind].label : '基地设施'}遭到攻击`
        : category === 'harvester'
          ? '采矿车遭到袭击'
          : '我方部队遭到攻击';
    this.addNotification(tone, text, category === 'hq' ? 7 : 5, candidate.position);
    this.events.push({
      type: 'alert',
      at: cloneVec(candidate.position),
      team: 'player',
      targetId: candidate.id,
      amount: Math.max(1, damage),
    });
  }

  private registerEnemyCombatResponse(candidate: DamageTarget, contact: Vec2): void {
    if (!finiteVec(contact)) return;
    const hqUnderAttack = candidate.entityType === 'building' && candidate.kind === 'hq';
    const responseRadius = hqUnderAttack ? ENEMY_COMBAT_RESPONSE_HQ_RADIUS : ENEMY_COMBAT_RESPONSE_RADIUS;
    const maximumResponders = hqUnderAttack
      ? ENEMY_COMBAT_RESPONSE_HQ_MAX_UNITS
      : ENEMY_COMBAT_RESPONSE_MAX_UNITS;
    const responders = stableById(this.state.units.filter((unit) => (
      unit.team === 'enemy'
      && unit.hp > 0
      && UNIT_DEFS[unit.kind].damage > 0
      && distance(unit.position, candidate.position) <= responseRadius
      && (unit.order.type === 'idle' || this.enemyCombatResponses.has(unit.id))
    ))).sort((left, right) => {
      const distanceDifference = distanceSquared(left.position, candidate.position)
        - distanceSquared(right.position, candidate.position);
      return Math.abs(distanceDifference) > EPSILON
        ? distanceDifference
        : compareStableText(left.id, right.id);
    }).slice(0, maximumResponders);

    for (const unit of responders) {
      const previous = this.enemyCombatResponses.get(unit.id);
      this.enemyCombatResponses.set(unit.id, {
        home: previous ? cloneVec(previous.home) : cloneVec(unit.position),
        contact: cloneVec(contact),
        expiresTick: this.state.tick + ENEMY_COMBAT_RESPONSE_TICKS,
        returning: false,
      });
      this.assignOrder(unit, { type: 'attackMove', target: cloneVec(contact) }, false);
    }
  }

  private updateEnemyCombatResponses(): void {
    for (const [unitId, response] of [...this.enemyCombatResponses.entries()]
      .sort(([left], [right]) => compareStableText(left, right))) {
      const unit = this.state.units.find((candidate) => candidate.id === unitId && candidate.team === 'enemy' && candidate.hp > 0);
      if (!unit) {
        this.enemyCombatResponses.delete(unitId);
        continue;
      }
      if (this.state.tick < response.expiresTick) continue;
      if (!response.returning) {
        response.returning = true;
        this.assignOrder(unit, { type: 'move', target: cloneVec(response.home) }, false);
        continue;
      }
      if (distance(unit.position, response.home) <= unit.radius + ENEMY_COMBAT_RETURN_DISTANCE) {
        this.enemyCombatResponses.delete(unitId);
        if (unit.order.type === 'move') this.completeOrder(unit);
      }
    }
  }

  private followGatherOrder(unit: UnitState, snapshots: readonly UnitSnapshot[]): void {
    if (unit.kind !== 'harvester') {
      this.completeOrder(unit);
      return;
    }
    if (unit.cargo >= unit.cargoCapacity - EPSILON) {
      this.sendHarvesterToRefinery(unit);
      return;
    }
    const resourceId = unit.order.targetId;
    let resource = resourceId ? this.state.resources.find((candidate) => candidate.id === resourceId) : undefined;
    if (!resource || resource.amount <= EPSILON) {
      resource = this.nearestResource(unit.position);
      if (!resource) {
        unit.order = { type: 'idle' };
        return;
      }
      unit.order.targetId = resource.id;
    }
    const interactionDistance = resource.radius + unit.radius + RESOURCE_INTERACTION_RANGE;
    if (distanceSquared(unit.position, resource.position) > interactionDistance * interactionDistance) {
      this.moveUnitToward(unit, resource.position, snapshots);
      return;
    }
    const availableCargo = unit.cargoCapacity - unit.cargo;
    const gathered = Math.min(
      resource.amount,
      availableCargo,
      HARVEST_RATE_PER_SECOND * GAME_TICK_SECONDS,
    );
    resource.amount = Math.max(0, resource.amount - gathered);
    unit.cargo += gathered;
    if (unit.cargo >= unit.cargoCapacity - EPSILON || resource.amount <= EPSILON) {
      this.sendHarvesterToRefinery(unit);
    }
  }

  private followReturnOrder(unit: UnitState, snapshots: readonly UnitSnapshot[]): void {
    if (unit.kind !== 'harvester') {
      this.completeOrder(unit);
      return;
    }
    let refinery = unit.order.targetId
      ? this.state.buildings.find((candidate) => candidate.id === unit.order.targetId)
      : undefined;
    if (
      !refinery ||
      refinery.team !== unit.team ||
      refinery.kind !== 'refinery' ||
      refinery.hp <= 0 ||
      refinery.buildProgress < 1 ||
      !refinery.connected
    ) {
      refinery = this.nearestOperationalRefinery(unit.team, unit.position);
      if (!refinery) return;
      unit.order.targetId = refinery.id;
    }

    const edgeDistance = pointToOrientedBuildingDistance(unit.position, refinery) - unit.radius;
    if (edgeDistance > DEPOSIT_INTERACTION_RANGE) {
      this.moveUnitToward(unit, refinery.position, snapshots);
      return;
    }
    if (unit.cargo > EPSILON) {
      const amount = unit.cargo * getTechnologyEffects(this.state.technology[unit.team]).resourceIncomeMultiplier;
      unit.cargo = 0;
      this.state.economy[unit.team].credits += amount;
      this.incomeRecords[unit.team].push({ at: this.state.elapsed, amount });
      this.events.push({
        type: 'deposit',
        at: cloneVec(unit.position),
        team: unit.team,
        sourceId: unit.id,
        targetId: refinery.id,
        amount,
      });
    }
    const resource = this.nearestResource(unit.position);
    unit.order = resource ? { type: 'gather', targetId: resource.id } : { type: 'idle' };
  }

  private followRepairOrder(unit: UnitState, snapshots: readonly UnitSnapshot[]): void {
    if (unit.kind !== 'engineer') {
      this.completeOrder(unit);
      return;
    }
    const target = unit.order.targetId ? this.targetById(unit.order.targetId) : undefined;
    if (
      !target ||
      target.id === unit.id ||
      target.team !== unit.team ||
      target.hp <= 0 ||
      target.hp >= target.maxHp - EPSILON ||
      (target.entityType === 'building' && target.buildProgress < 1)
    ) {
      this.completeOrder(unit);
      return;
    }
    if (this.surfaceDistance(unit, target) > REPAIR_INTERACTION_RANGE) {
      this.moveUnitToward(unit, target.position, snapshots);
      return;
    }

    const economy = this.state.economy[unit.team];
    const affordableHp = economy.credits / REPAIR_CREDITS_PER_HP;
    const repairAmount = Math.min(
      REPAIR_RATE_PER_SECOND * GAME_TICK_SECONDS,
      target.maxHp - target.hp,
      affordableHp,
    );
    if (repairAmount <= EPSILON) {
      this.completeOrder(unit);
      if (unit.team === 'player') this.addNotification('warning', '辉晶不足，维修已停止', 4);
      return;
    }
    economy.credits = Math.max(0, economy.credits - repairAmount * REPAIR_CREDITS_PER_HP);
    target.hp = Math.min(target.maxHp, target.hp + repairAmount);
    if (target.maxHp - target.hp <= EPSILON) target.hp = target.maxHp;
    unit.rotation = Math.atan2(target.position.x - unit.position.x, target.position.z - unit.position.z);
    if (this.state.tick % REPAIR_EVENT_TICKS === 0 || target.hp >= target.maxHp - EPSILON) {
      this.events.push({
        type: 'repair',
        at: cloneVec(target.position),
        team: unit.team,
        sourceId: unit.id,
        targetId: target.id,
        amount: repairAmount,
      });
    }
    if (target.hp >= target.maxHp - EPSILON) this.completeOrder(unit);
  }

  private sendHarvesterToRefinery(unit: UnitState): void {
    const refinery = this.nearestOperationalRefinery(unit.team, unit.position);
    if (!refinery) return;
    unit.order = { type: 'return', targetId: refinery.id };
  }

  private moveUnitToward(unit: UnitState, destination: Vec2, snapshots: readonly UnitSnapshot[]): boolean {
    const toDestination = {
      x: destination.x - unit.position.x,
      z: destination.z - unit.position.z,
    };
    const remaining = Math.hypot(toDestination.x, toDestination.z);
    if (remaining <= 0.3) return true;

    const desired = normalized(toDestination.x, toDestination.z);
    let avoidanceX = 0;
    let avoidanceZ = 0;

    for (const blocker of stableById(this.state.blockers)) {
      if (!blocker.blocksMovement) continue;
      const dx = unit.position.x - blocker.position.x;
      const dz = unit.position.z - blocker.position.z;
      const centerDistance = Math.hypot(dx, dz);
      const influence = blocker.radius + unit.radius + 3;
      if (centerDistance >= influence) continue;
      const away = centerDistance > EPSILON
        ? { x: dx / centerDistance, z: dz / centerDistance }
        : this.stableSeparationDirection(unit.id, blocker.id);
      const strength = (influence - centerDistance) / influence;
      avoidanceX += away.x * strength * 2.2;
      avoidanceZ += away.z * strength * 2.2;
    }

    for (const building of stableById(this.state.buildings)) {
      if (building.hp <= 0) continue;
      const edgeDistance = pointToOrientedBuildingDistance(unit.position, building);
      const influence = unit.radius + 2.5;
      if (edgeDistance >= influence) continue;
      const away = normalized(unit.position.x - building.position.x, unit.position.z - building.position.z);
      const fallback = away.x === 0 && away.z === 0
        ? this.stableSeparationDirection(unit.id, building.id)
        : away;
      const strength = (influence - edgeDistance) / influence;
      avoidanceX += fallback.x * strength * 1.8;
      avoidanceZ += fallback.z * strength * 1.8;
    }

    for (const other of snapshots) {
      if (other.id === unit.id) continue;
      const dx = unit.position.x - other.position.x;
      const dz = unit.position.z - other.position.z;
      const centerDistance = Math.hypot(dx, dz);
      const influence = unit.radius + other.radius + 1.2;
      if (centerDistance >= influence) continue;
      const away = centerDistance > EPSILON
        ? { x: dx / centerDistance, z: dz / centerDistance }
        : this.stableSeparationDirection(unit.id, other.id);
      const strength = (influence - centerDistance) / influence;
      avoidanceX += away.x * strength * 1.25;
      avoidanceZ += away.z * strength * 1.25;
    }

    const adjusted = normalized(desired.x + avoidanceX, desired.z + avoidanceZ);
    const stepDistance = Math.min(UNIT_DEFS[unit.kind].speed * GAME_TICK_SECONDS, remaining);
    const candidateAngles = [0, Math.PI / 6, -Math.PI / 6, Math.PI / 3, -Math.PI / 3, Math.PI / 2, -Math.PI / 2];
    for (const angle of candidateAngles) {
      const direction = rotateVector(adjusted.x === 0 && adjusted.z === 0 ? desired : adjusted, angle);
      const candidate = {
        x: clamp(unit.position.x + direction.x * stepDistance, -MAP_HALF_SIZE + unit.radius, MAP_HALF_SIZE - unit.radius),
        z: clamp(unit.position.z + direction.z * stepDistance, -MAP_HALF_SIZE + unit.radius, MAP_HALF_SIZE - unit.radius),
      };
      if (!this.isUnitPositionPassable(candidate, unit, snapshots)) continue;
      const movedX = candidate.x - unit.position.x;
      const movedZ = candidate.z - unit.position.z;
      unit.position = candidate;
      if (Math.hypot(movedX, movedZ) > EPSILON) unit.rotation = Math.atan2(movedX, movedZ);
      return distanceSquared(unit.position, destination) <= 0.3 * 0.3;
    }
    return false;
  }

  private isUnitPositionPassable(
    position: Vec2,
    unit: UnitState,
    snapshots: readonly UnitSnapshot[],
  ): boolean {
    if (!this.isInsideMap(position, unit.radius)) return false;
    for (const blocker of this.state.blockers) {
      if (!blocker.blocksMovement) continue;
      const minimum = blocker.radius + unit.radius;
      const candidateDistance = distanceSquared(position, blocker.position);
      if (candidateDistance < minimum * minimum - EPSILON) {
        const currentDistance = distanceSquared(unit.position, blocker.position);
        if (candidateDistance <= currentDistance + EPSILON) return false;
      }
    }
    for (const building of this.state.buildings) {
      if (building.hp <= 0) continue;
      if (circleOverlapsBuilding(position, unit.radius, building)) {
        const candidateDistance = pointToOrientedBuildingDistance(position, building);
        const currentDistance = pointToOrientedBuildingDistance(unit.position, building);
        if (candidateDistance <= currentDistance + EPSILON) return false;
      }
    }
    for (const other of snapshots) {
      if (other.id === unit.id) continue;
      const minimum = (other.radius + unit.radius) * 0.72;
      const candidateDistance = distanceSquared(position, other.position);
      if (candidateDistance < minimum * minimum - EPSILON) {
        const currentDistance = distanceSquared(unit.position, other.position);
        if (candidateDistance <= currentDistance + EPSILON) return false;
      }
    }
    return true;
  }

  private acquireTarget(unit: UnitState, maximumDistance: number): DamageTarget | undefined {
    const candidates: DamageTarget[] = [];
    for (const other of this.state.units) {
      if (other.team !== unit.team && other.hp > 0) candidates.push(other);
    }
    for (const building of this.state.buildings) {
      if (building.team !== unit.team && building.hp > 0 && building.buildProgress > 0) candidates.push(building);
    }
    return candidates
      .filter((candidate) => this.isEnemyVisibleTo(unit.team, candidate.id))
      .filter((candidate) => {
        const sightDistance = this.surfaceDistance(unit, candidate);
        return sightDistance <= maximumDistance && this.hasLineOfSight(unit.position, candidate.position);
      })
      .sort((left, right) => {
        const distanceDifference = this.surfaceDistance(unit, left) - this.surfaceDistance(unit, right);
        return Math.abs(distanceDifference) > EPSILON ? distanceDifference : compareStableText(left.id, right.id);
      })[0];
  }

  private hasLineOfSight(start: Vec2, end: Vec2): boolean {
    for (const blocker of stableById(this.state.blockers)) {
      if (blocker.blocksVision && segmentIntersectsCircle(start, end, blocker.position, blocker.radius)) return false;
    }
    return true;
  }

  private surfaceDistance(source: UnitState, target: DamageTarget): number {
    if (target.entityType === 'unit') {
      return Math.max(0, distance(source.position, target.position) - source.radius - target.radius);
    }
    return Math.max(0, pointToOrientedBuildingDistance(source.position, target) - source.radius);
  }

  private updateConstructions(): void {
    for (const team of ACTIVE_TEAMS) {
      const active = stableById(
        this.state.buildings.filter((building) => building.team === team && building.buildProgress < 1 && building.hp > 0),
      )[0];
      if (!active) continue;
      const definition = BUILDING_DEFS[active.kind];
      const factor = active.connected
        ? 1
        : (this.disconnectReserve.get(active.id) ?? 0) > 0
          ? 0.75
          : 0;
      if (factor <= 0 || definition.buildTime <= 0) continue;
      const previous = active.buildProgress;
      const nextProgress = active.buildProgress + (GAME_TICK_SECONDS * factor) / definition.buildTime;
      active.buildProgress = nextProgress >= 1 - EPSILON ? 1 : nextProgress;
      if (previous < 1 && active.buildProgress >= 1) {
        active.hp = active.maxHp;
        this.events.push({ type: 'built', at: cloneVec(active.position), team, sourceId: active.id });
        if (active.kind === 'refinery') this.spawnUnit(team, 'harvester', active, true);
      }
    }
  }

  private updateProduction(): void {
    for (const building of stableById(this.state.buildings)) {
      if (building.buildProgress < 1 || building.hp <= 0 || building.queue.length === 0) continue;
      const economy = this.state.economy[building.team];
      const factor = building.connected
        ? economy.powerRatio >= 1
          ? 1
          : Math.max(0.35, economy.powerRatio)
        : (this.disconnectReserve.get(building.id) ?? 0) > 0
          ? 0.75
          : 0;
      if (factor <= 0) continue;
      const item = building.queue[0];
      if (!item) continue;
      item.remaining = Math.max(0, item.remaining - GAME_TICK_SECONDS * factor);
      if (item.remaining > EPSILON) continue;
      building.queue.shift();
      this.spawnUnit(building.team, item.unitKind, building, false);
    }
  }

  private spawnUnit(team: ActiveTeam, kind: UnitKind, producer: BuildingState, includedWithRefinery: boolean): UnitState {
    const definition = UNIT_DEFS[kind];
    const maxHp = definition.maxHp * getTechnologyEffects(this.state.technology[team]).maxHealthMultiplier;
    const spawn = this.findSpawnPoint(producer, definition.radius);
    const id = `u-${team}-${kind}-${String(this.entitySequence).padStart(6, '0')}`;
    this.entitySequence += 1;
    const unit: UnitState = {
      id,
      entityType: 'unit',
      team,
      kind,
      position: spawn,
      rotation: producer.rotation,
      hp: maxHp,
      maxHp,
      radius: definition.radius,
      cooldownRemaining: 0,
      order: { type: 'idle' },
      cargo: 0,
      cargoCapacity: kind === 'harvester' ? HARVESTER_CARGO_CAPACITY : 0,
    };
    if (kind === 'harvester') {
      const resource = this.nearestResource(spawn);
      if (resource) unit.order = { type: 'gather', targetId: resource.id };
    } else if (producer.rallyPoint) {
      unit.order = { type: 'move', target: cloneVec(producer.rallyPoint) };
    }
    this.state.units.push(unit);
    this.events.push({
      type: 'produced',
      at: cloneVec(spawn),
      team,
      sourceId: producer.id,
      targetId: unit.id,
      amount: includedWithRefinery ? 0 : definition.cost,
    });
    return unit;
  }

  private findSpawnPoint(building: BuildingState, unitRadius: number): Vec2 {
    const axes = buildingAxes(building.rotation);
    const baseDistance = Math.hypot(building.footprint.x / 2, building.footprint.z / 2) + unitRadius + 1;
    const directions = [
      axes.forward,
      rotateVector(axes.forward, Math.PI / 4),
      rotateVector(axes.forward, -Math.PI / 4),
      axes.right,
      { x: -axes.right.x, z: -axes.right.z },
      { x: -axes.forward.x, z: -axes.forward.z },
    ];
    const dummy: UnitState = {
      id: '__spawn__', entityType: 'unit', team: building.team, kind: 'rifle',
      position: building.position, rotation: 0, hp: 1, maxHp: 1, radius: unitRadius,
      cooldownRemaining: 0, order: { type: 'idle' }, cargo: 0, cargoCapacity: 0,
    };
    const snapshots = stableById(this.state.units).map<UnitSnapshot>((unit) => ({
      id: unit.id, position: cloneVec(unit.position), radius: unit.radius,
    }));
    for (const direction of directions) {
      const candidate = {
        x: clamp(building.position.x + direction.x * baseDistance, -MAP_HALF_SIZE + unitRadius, MAP_HALF_SIZE - unitRadius),
        z: clamp(building.position.z + direction.z * baseDistance, -MAP_HALF_SIZE + unitRadius, MAP_HALF_SIZE - unitRadius),
      };
      if (this.isUnitPositionPassable(candidate, dummy, snapshots)) return candidate;
    }
    return {
      x: clamp(building.position.x + axes.forward.x * baseDistance, -MAP_HALF_SIZE + unitRadius, MAP_HALF_SIZE - unitRadius),
      z: clamp(building.position.z + axes.forward.z * baseDistance, -MAP_HALF_SIZE + unitRadius, MAP_HALF_SIZE - unitRadius),
    };
  }

  private enqueueProduction(
    team: ActiveTeam,
    building: BuildingState,
    unitKind: UnitKind,
  ): { ok: boolean; reason: string } {
    const definition = UNIT_DEFS[unitKind];
    if (!definition) return { ok: false, reason: '未知单位类型' };
    if (building.team !== team || building.buildProgress < 1 || building.hp <= 0) {
      return { ok: false, reason: '生产建筑无效或尚未完工' };
    }
    if (definition.producer !== building.kind) return { ok: false, reason: '该建筑不能生产此单位' };
    if (!building.connected) return { ok: false, reason: '建筑未连接指挥网络' };
    if (building.queue.length >= MAX_PRODUCTION_QUEUE) return { ok: false, reason: '生产队列已满' };
    const economy = this.state.economy[team];
    if (economy.credits + EPSILON < definition.cost) return { ok: false, reason: '辉晶不足' };
    const reservedBandwidth = this.reservedBandwidth(team);
    if (economy.bandwidthUsed + reservedBandwidth + definition.bandwidth > economy.bandwidthCap) {
      return { ok: false, reason: '指挥带宽不足' };
    }
    economy.credits -= definition.cost;
    building.queue.push({ unitKind, remaining: definition.buildTime, total: definition.buildTime });
    return { ok: true, reason: 'ok' };
  }

  private reservedBandwidth(team: ActiveTeam): number {
    let reserved = 0;
    for (const building of this.state.buildings) {
      if (building.team !== team) continue;
      for (const item of building.queue) reserved += UNIT_DEFS[item.unitKind].bandwidth;
    }
    return reserved;
  }

  private validateBuildForTeam(
    team: ActiveTeam,
    kind: BuildingKind,
    position: Vec2,
    rotation: number,
  ): BuildValidation {
    if (this.state.status !== 'active') return { valid: false, reason: '对局已经结束' };
    if (!BUILDING_KINDS.includes(kind) || kind === 'hq') return { valid: false, reason: '该建筑不能在对局中建造' };
    if (!finiteVec(position) || !Number.isFinite(rotation)) return { valid: false, reason: '建筑位置或朝向无效' };
    const definition = BUILDING_DEFS[kind];
    if (this.state.economy[team].credits + EPSILON < definition.cost) return { valid: false, reason: '辉晶不足' };
    const queuedBuildings = this.state.buildings.filter(
      (building) => building.team === team && building.buildProgress < 1 && building.hp > 0,
    ).length;
    if (queuedBuildings >= MAX_BUILD_QUEUE) return { valid: false, reason: '建筑施工队列已满' };

    const axes = buildingAxes(rotation);
    const halfX = definition.footprint.x / 2;
    const halfZ = definition.footprint.z / 2;
    const worldHalfX = Math.abs(axes.right.x) * halfX + Math.abs(axes.forward.x) * halfZ;
    const worldHalfZ = Math.abs(axes.right.z) * halfX + Math.abs(axes.forward.z) * halfZ;
    if (
      position.x - worldHalfX < -MAP_HALF_SIZE ||
      position.x + worldHalfX > MAP_HALF_SIZE ||
      position.z - worldHalfZ < -MAP_HALF_SIZE ||
      position.z + worldHalfZ > MAP_HALF_SIZE
    ) {
      return { valid: false, reason: '建筑超出地图边界' };
    }
    if (!this.isWithinBuildCoverage(team, position)) return { valid: false, reason: '位置不在指挥网络覆盖区内' };

    const candidate: BuildingState = {
      id: '__candidate__', entityType: 'building', team, kind,
      position: cloneVec(position), rotation, aimRotation: rotation,
      hp: definition.maxHp, maxHp: definition.maxHp,
      footprint: cloneVec(definition.footprint), connected: true, powered: false,
      buildProgress: 0, cooldownRemaining: 0, queue: [],
    };
    for (const building of this.state.buildings) {
      if (building.hp > 0 && orientedBuildingsOverlap(candidate, building, 0.25)) {
        return { valid: false, reason: '建筑足迹与现有建筑重叠' };
      }
    }
    for (const blocker of this.state.blockers) {
      if (blocker.blocksMovement && circleOverlapsBuilding(blocker.position, blocker.radius + 0.25, candidate)) {
        return { valid: false, reason: '建筑足迹被地形阻挡' };
      }
    }
    for (const resource of this.state.resources) {
      if (circleOverlapsBuilding(resource.position, resource.radius + 1, candidate)) {
        return { valid: false, reason: '建筑会阻挡资源点' };
      }
    }
    if (circleOverlapsBuilding(this.state.beacon.position, this.state.beacon.radius + 1, candidate)) {
      return { valid: false, reason: '不能在信标控制区建造' };
    }
    for (const unit of this.state.units) {
      if (unit.hp > 0 && circleOverlapsBuilding(unit.position, unit.radius + 0.2, candidate)) {
        return { valid: false, reason: '建筑足迹内存在单位' };
      }
    }
    return { valid: true, reason: 'ok' };
  }

  private createConstruction(team: ActiveTeam, kind: BuildingKind, position: Vec2, rotation: number): BuildingState {
    const definition = BUILDING_DEFS[kind];
    const maxHp = definition.maxHp * getTechnologyEffects(this.state.technology[team]).maxHealthMultiplier;
    this.state.economy[team].credits -= definition.cost;
    const id = `b-${team}-${kind}-${String(this.entitySequence).padStart(6, '0')}`;
    this.entitySequence += 1;
    const building: BuildingState = {
      id,
      entityType: 'building',
      team,
      kind,
      position: cloneVec(position),
      rotation,
      aimRotation: rotation,
      hp: maxHp,
      maxHp,
      footprint: cloneVec(definition.footprint),
      connected: true,
      powered: false,
      buildProgress: definition.buildTime <= 0 ? 1 : 0,
      cooldownRemaining: 0,
      queue: [],
    };
    this.state.buildings.push(building);
    return building;
  }

  private isWithinBuildCoverage(team: ActiveTeam, position: Vec2): boolean {
    return this.state.buildings.some((building) => {
      if (
        building.team !== team ||
        building.hp <= 0 ||
        building.buildProgress < 1 ||
        !building.connected ||
        (building.kind !== 'hq' && building.kind !== 'relay')
      ) {
        return false;
      }
      const radius = BUILDING_DEFS[building.kind].buildRadius;
      return distanceSquared(building.position, position) <= radius * radius + EPSILON;
    });
  }

  private recomputeNetworkAndEconomy(): void {
    for (const team of ACTIVE_TEAMS) {
      const teamBuildings = stableById(this.state.buildings.filter((building) => building.team === team && building.hp > 0));
      const previousConnection = new Map(teamBuildings.map((building) => [building.id, building.connected]));
      const connectedNodes: BuildingState[] = teamBuildings.filter(
        (building) => building.kind === 'hq' && building.buildProgress >= 1,
      );
      const connectedIds = new Set(connectedNodes.map((building) => building.id));

      let changed = true;
      while (changed) {
        changed = false;
        for (const relay of teamBuildings) {
          if (relay.kind !== 'relay' || relay.buildProgress < 1 || connectedIds.has(relay.id)) continue;
          const linked = connectedNodes.some((node) => {
            const range = BUILDING_DEFS[node.kind].buildRadius;
            return distanceSquared(node.position, relay.position) <= range * range + EPSILON;
          });
          if (!linked) continue;
          connectedIds.add(relay.id);
          connectedNodes.push(relay);
          changed = true;
        }
      }

      for (const building of teamBuildings) {
        let connected = connectedIds.has(building.id);
        if (!connected) {
          connected = connectedNodes.some((node) => {
            const range = BUILDING_DEFS[node.kind].buildRadius;
            return distanceSquared(node.position, building.position) <= range * range + EPSILON;
          });
        }
        const wasConnected = previousConnection.get(building.id) === true;
        building.connected = connected;
        if (connected) this.disconnectReserve.delete(building.id);
        else if (wasConnected && building.buildProgress >= 1 && !this.disconnectReserve.has(building.id)) {
          this.disconnectReserve.set(building.id, DISCONNECT_RESERVE_SECONDS);
        }
      }

      let powerSupply = 0;
      let powerDemand = 0;
      let bandwidthCap = 0;
      for (const building of teamBuildings) {
        if (!building.connected || building.buildProgress < 1) continue;
        const definition = BUILDING_DEFS[building.kind];
        powerSupply += definition.powerSupply;
        powerDemand += definition.powerDemand;
        bandwidthCap += definition.bandwidth;
      }
      const powerRatio = powerDemand <= EPSILON ? 1 : Math.min(1, powerSupply / powerDemand);
      const bandwidthUsed = this.state.units
        .filter((unit) => unit.team === team && unit.hp > 0)
        .reduce((sum, unit) => sum + UNIT_DEFS[unit.kind].bandwidth, 0);
      const economy = this.state.economy[team];
      economy.powerSupply = powerSupply;
      economy.powerDemand = powerDemand;
      economy.powerRatio = powerRatio;
      economy.bandwidthCap = Math.min(MAX_BANDWIDTH, bandwidthCap);
      economy.bandwidthUsed = bandwidthUsed;
      for (const building of teamBuildings) {
        building.powered = building.connected && (BUILDING_DEFS[building.kind].powerDemand <= 0 || powerSupply > 0);
      }
    }
  }

  private operationalHq(team: ActiveTeam): BuildingState | undefined {
    return stableById(this.state.buildings).find(
      (building) =>
        building.team === team &&
        building.kind === 'hq' &&
        building.hp > 0 &&
        building.buildProgress >= 1 &&
        building.connected &&
        building.powered,
    );
  }

  private startResearch(team: ActiveTeam, kind: TechnologyKind): { ok: boolean; reason: string; at: Vec2 } {
    const hq = this.operationalHq(team);
    const fallback = team === 'player' ? { x: -52, z: 46 } : { x: 52, z: -46 };
    const at = cloneVec(hq?.position ?? fallback);
    if (!hq) return { ok: false, reason: '需要一座联网且供电的指挥核心', at };
    const result = startTechnology(this.state.technology[team], kind, this.state.economy[team].credits);
    if (!result.ok) {
      const reason = result.reason === 'insufficientCredits'
        ? '辉晶不足'
        : result.reason === 'alreadyCompleted'
          ? '该科技已经完成'
          : result.reason === 'researchInProgress'
            ? '已有科技正在研究'
            : '无法开始该科技研究';
      return { ok: false, reason, at };
    }
    this.state.technology[team] = result.state;
    this.state.economy[team].credits = result.credits;
    this.events.push({
      type: 'research',
      at,
      team,
      sourceId: hq.id,
      amount: -result.creditDelta,
      technologyKind: kind,
    });
    if (team === 'player') this.addNotification('info', '科技研究已启动', 4);
    return { ok: true, reason: 'ok', at };
  }

  private updateResearch(): void {
    for (const team of ACTIVE_TEAMS) {
      const current = this.state.technology[team].current;
      if (!current) continue;
      const hq = this.operationalHq(team);
      if (!hq) continue;
      const powerRatio = this.state.economy[team].powerRatio;
      const factor = powerRatio >= 1 ? 1 : powerRatio > EPSILON ? Math.max(0.35, powerRatio) : 0;
      if (factor <= 0) continue;
      const result = advanceTechnology(this.state.technology[team], GAME_TICK_SECONDS * factor);
      if (!result.ok) continue;
      this.state.technology[team] = result.state;
      if (!result.completed) continue;
      if (result.completed === 'compositeArmor') this.applyMaxHealthTechnology(team);
      this.events.push({
        type: 'research',
        at: cloneVec(hq.position),
        team,
        sourceId: hq.id,
        technologyKind: result.completed,
      });
      if (team === 'player') this.addNotification('success', '科技研究完成', 5);
    }
  }

  private applyMaxHealthTechnology(team: ActiveTeam): void {
    const multiplier = getTechnologyEffects(this.state.technology[team]).maxHealthMultiplier;
    for (const unit of stableById(this.state.units.filter((candidate) => candidate.team === team && candidate.hp > 0))) {
      const newMax = UNIT_DEFS[unit.kind].maxHp * multiplier;
      if (newMax <= unit.maxHp + EPSILON) continue;
      unit.hp = Math.min(newMax, unit.hp + newMax - unit.maxHp);
      unit.maxHp = newMax;
    }
    for (const building of stableById(this.state.buildings.filter((candidate) => candidate.team === team && candidate.hp > 0))) {
      const newMax = BUILDING_DEFS[building.kind].maxHp * multiplier;
      if (newMax <= building.maxHp + EPSILON) continue;
      building.hp = Math.min(newMax, building.hp + newMax - building.maxHp);
      building.maxHp = newMax;
    }
  }

  private updateIntel(): void {
    for (const team of ACTIVE_TEAMS) {
      const revealReviewTargets = ((
        this.fixture === 'visual-gold-review'
        || this.fixture === 'building-damage-review'
        || this.fixture === 'building-damage-review-reduced'
        || this.fixture === 'enemy-infrastructure-review'
      ) && team === 'player') || ((
        this.fixture === 'destruction-residue-review'
        || this.fixture === 'destruction-residue-review-reduced'
      ) && team === 'enemy');
      const hideResidueReviewAttackers = (
        this.fixture === 'destruction-residue-review'
        || this.fixture === 'destruction-residue-review-reduced'
      ) && team === 'player';
      const observers: VisibilityObserver[] = [];
      for (const unit of stableById(this.state.units.filter((candidate) => candidate.team === team && candidate.hp > 0))) {
        observers.push({ id: unit.id, position: cloneVec(unit.position), radius: UNIT_DEFS[unit.kind].sight });
      }

      const radarMultiplier = getTechnologyEffects(this.state.technology[team]).radarRangeMultiplier;
      const radarPowered = this.state.economy[team].powerRatio >= RADAR_MIN_POWER_RATIO;
      let radarOnline = false;
      for (const building of stableById(this.state.buildings.filter((candidate) => candidate.team === team && candidate.hp > 0))) {
        if (building.buildProgress < 1) continue;
        let radius = Math.max(BASE_BUILDING_SIGHT, Math.hypot(building.footprint.x, building.footprint.z) / 2);
        radius = Math.max(radius, BUILDING_DEFS[building.kind].weapon?.sight ?? 0);
        const isRadarNode = building.kind === 'hq' || building.kind === 'relay';
        if (isRadarNode && building.connected && building.powered && radarPowered) {
          radarOnline = true;
          const radarRadius = building.kind === 'hq' ? HQ_RADAR_RANGE : RELAY_RADAR_RANGE;
          radius = Math.max(radius, radarRadius * radarMultiplier);
        }
        observers.push({ id: building.id, position: cloneVec(building.position), radius });
      }

      const previousExplored = this.state.intel[team].visibility.explored;
      const visibility = this.visibilityGrid.update(observers, previousExplored);
      const enemyIds: string[] = [];
      for (const unit of stableById(this.state.units.filter((candidate) => candidate.team !== team && candidate.hp > 0))) {
        if (hideResidueReviewAttackers && unit.id.startsWith('u-residue-attacker-')) continue;
        if (revealReviewTargets || this.visibilityGrid.isRadiusVisible(visibility, unit.position, unit.radius)) {
          enemyIds.push(unit.id);
        }
      }
      for (const building of stableById(this.state.buildings.filter((candidate) => candidate.team !== team && candidate.hp > 0))) {
        const radius = Math.hypot(building.footprint.x, building.footprint.z) / 2;
        if ((revealReviewTargets && !building.id.endsWith('-anchor'))
          || this.visibilityGrid.isRadiusVisible(visibility, building.position, radius)) {
          enemyIds.push(building.id);
        }
      }
      this.state.intel[team] = { visibility, radarOnline, visibleEnemyIds: enemyIds.sort(compareStableText) };
    }
  }

  private isEnemyVisibleTo(team: ActiveTeam, targetId: string): boolean {
    return this.state.intel[team].visibleEnemyIds.includes(targetId);
  }

  private ageDisconnectReserve(): void {
    for (const [id, remaining] of [...this.disconnectReserve.entries()].sort(([left], [right]) => compareStableText(left, right))) {
      const building = this.state.buildings.find((candidate) => candidate.id === id);
      if (!building || building.connected || building.hp <= 0) {
        this.disconnectReserve.delete(id);
        continue;
      }
      this.disconnectReserve.set(id, Math.max(0, remaining - GAME_TICK_SECONDS));
    }
  }

  private updateBeacon(): void {
    const beacon = this.state.beacon;
    if (!beacon.unlocked && this.state.elapsed >= SIGNAL_UNLOCK_SECONDS) {
      beacon.unlocked = true;
      this.addNotification('warning', '中央信标已启用', 6);
    }
    if (!beacon.unlocked || this.state.status !== 'active') return;

    const present: Record<ActiveTeam, boolean> = { player: false, enemy: false };
    const capturer: Record<ActiveTeam, boolean> = { player: false, enemy: false };
    const captureRadiusSquared = beacon.radius * beacon.radius;
    for (const unit of stableById(this.state.units)) {
      if (unit.hp <= 0 || distanceSquared(unit.position, beacon.position) > captureRadiusSquared) continue;
      present[unit.team] = true;
      if (unit.kind === 'rifle' || unit.kind === 'antitank' || unit.kind === 'engineer') {
        capturer[unit.team] = true;
      }
    }
    beacon.contested = present.player && present.enemy;
    beacon.controllingTeam = null;
    if (!beacon.contested) {
      if (capturer.player && !present.enemy) beacon.controllingTeam = 'player';
      else if (capturer.enemy && !present.player) beacon.controllingTeam = 'enemy';
    }

    if (beacon.contested) return;
    const progressRate = this.state.elapsed >= 25 * 60 ? 2 : 1;
    if (beacon.controllingTeam === 'player') {
      beacon.playerProgress = Math.min(beacon.targetProgress, beacon.playerProgress + GAME_TICK_SECONDS * progressRate);
      beacon.enemyProgress = Math.max(0, beacon.enemyProgress - GAME_TICK_SECONDS * 0.5);
    } else if (beacon.controllingTeam === 'enemy') {
      beacon.enemyProgress = Math.min(beacon.targetProgress, beacon.enemyProgress + GAME_TICK_SECONDS * progressRate);
      beacon.playerProgress = Math.max(0, beacon.playerProgress - GAME_TICK_SECONDS * 0.5);
    } else {
      beacon.playerProgress = Math.max(0, beacon.playerProgress - GAME_TICK_SECONDS * 0.5);
      beacon.enemyProgress = Math.max(0, beacon.enemyProgress - GAME_TICK_SECONDS * 0.5);
    }
  }

  private updateMissionDirector(): void {
    const mission = this.state.mission;
    if (mission.kind !== 'breakthrough' || this.state.status !== 'active') return;
    const difficulty = getBreakthroughDifficulty(this.fixture);
    const phaseElapsed = (this.state.tick - mission.phaseStartedTick) * GAME_TICK_SECONDS;
    const frontlineDefenses = this.state.buildings.filter(
      (building) => building.team === 'enemy'
        && (building.id === 'b-break-enemy-sentry' || building.id === 'b-break-enemy-cannon'),
    );
    const defenseMaxHp = frontlineDefenses.reduce((total, building) => total + building.maxHp, 0);
    const defenseHp = frontlineDefenses.reduce((total, building) => total + Math.max(0, building.hp), 0);
    const defenseRatio = defenseMaxHp > 0 ? defenseHp / defenseMaxHp : 0;

    switch (mission.phase) {
      case 'deployment': {
        if (this.state.tick === 1 && mission.phaseStartedTick === 0) {
          this.addNotification(
            'info',
            '整备命令：完成一次辉晶卸矿、建成一座哨戒塔，并由载具工厂生产一辆战斗车辆',
            16,
          );
        }
        const hasPlayerDeposit = this.incomeRecords.player.length > 0;
        const hasCompletedPlayerSentry = this.state.buildings.some((building) => (
          building.team === 'player'
          && building.kind === 'sentry'
          && building.hp > 0
          && building.buildProgress >= 1
        ));
        const hasProducedPlayerVehicle = this.state.units.some((unit) => (
          unit.team === 'player'
          && unit.hp > 0
          && BREAKTHROUGH_PRODUCED_VEHICLE_ID.test(unit.id)
        ));
        if (hasPlayerDeposit && hasCompletedPlayerSentry && hasProducedPlayerVehicle) {
          this.enterMissionPhase('frontline', 'info', '整备完成：选中编队，按 A 后右键东南前沿');
        }
        break;
      }
      case 'frontline':
        if (
          phaseElapsed >= difficulty.frontlineMaxSeconds
          || (
            phaseElapsed >= difficulty.frontlineMinSeconds
            && defenseRatio <= difficulty.frontlineDefenseTriggerRatio
          )
        ) {
          mission.counterattackUnitIds = this.spawnMissionWave(
            'enemy',
            [...difficulty.counterattackWave],
            'b-break-enemy-factory',
            { x: -4, z: -10 },
            difficulty.missionEnemyWaveHpMultiplier,
          );
          this.enterMissionPhase('counterattack', 'danger', '敌军装甲反扑正在接近前沿');
        }
        break;
      case 'counterattack': {
        const counterattackAlive = mission.counterattackUnitIds.some((id) => (
          this.state.units.some((unit) => unit.id === id && unit.hp > 0)
        ));
        const defensesAlive = frontlineDefenses.some((building) => building.hp > 0);
        if (
          phaseElapsed >= difficulty.counterattackMinSeconds
          && (!counterattackAlive || !defensesAlive || phaseElapsed >= difficulty.counterattackMaxSeconds)
        ) {
          mission.reinforcementUnitIds = this.spawnMissionWave(
            'player',
            [...difficulty.reinforcementWave],
            'b-break-player-factory',
            { x: 14, z: -23 },
            difficulty.missionPlayerWaveHpMultiplier,
          );
          if (!this.state.beacon.unlocked) {
            this.state.beacon.unlocked = true;
            this.addNotification('warning', '中央信标提前开放：占领信标或摧毁敌方指挥核心均可获胜', 10);
          }
          this.enterMissionPhase('reinforcement', 'success', '友军增援已从西北工厂进入战区');
        }
        break;
      }
      case 'reinforcement':
        if (phaseElapsed >= difficulty.reinforcementSeconds) {
          this.enterMissionPhase('command', 'warning', '最终目标：占领中央信标或摧毁敌方指挥核心');
        }
        break;
      case 'command':
        if (
          phaseElapsed >= difficulty.commandPressureSeconds
          && mission.counterattackUnitIds.length <= difficulty.counterattackWave.length
        ) {
          const playerHq = this.state.buildings.find(
            (building) => building.team === 'player' && building.kind === 'hq' && building.hp > 0,
          );
          const finalAssaultIds = playerHq
            ? this.spawnMissionWave(
                'enemy',
                [...difficulty.finalAssaultWave],
                'b-break-enemy-factory',
                playerHq.position,
                difficulty.missionEnemyWaveHpMultiplier,
              )
            : [];
          mission.counterattackUnitIds = [...new Set([
            ...mission.counterattackUnitIds,
            ...finalAssaultIds,
          ])];
          if (finalAssaultIds.length > 0) {
            this.addNotification(
              'danger',
              '敌军最终攻势正向我方指挥核心推进：立即夺取信标或摧毁敌方核心',
              12,
            );
          }
        }
        break;
      case 'complete':
        break;
    }
  }

  private enterMissionPhase(
    phase: GameState['mission']['phase'],
    tone: GameState['notifications'][number]['tone'],
    notification: string,
  ): void {
    this.state.mission.phase = phase;
    this.state.mission.phaseStartedTick = this.state.tick;
    this.addNotification(tone, notification, tone === 'danger' ? 8 : 6);
  }

  private spawnMissionWave(
    team: ActiveTeam,
    kinds: UnitKind[],
    preferredProducerId: string,
    target: Vec2,
    hpMultiplier = 1,
  ): string[] {
    const producer = this.state.buildings.find(
      (building) => building.id === preferredProducerId && building.team === team && building.hp > 0,
    ) ?? this.state.buildings.find(
      (building) => building.team === team && building.kind === 'hq' && building.hp > 0,
    );
    if (!producer) return [];
    const ids: string[] = [];
    for (const kind of kinds) {
      const unit = this.spawnUnit(team, kind, producer, true);
      unit.maxHp = Math.round(unit.maxHp * hpMultiplier);
      unit.hp = unit.maxHp;
      this.assignOrder(unit, { type: 'attackMove', target: cloneVec(target) }, false);
      ids.push(unit.id);
    }
    return ids;
  }

  private isMissionDirectorLocked(unitId: string): boolean {
    if (this.state.mission.kind !== 'breakthrough') return false;
    if (
      (this.state.mission.phase === 'deployment' || this.state.mission.phase === 'frontline')
      && unitId.startsWith('u-break-enemy-')
    ) return true;
    if (
      this.state.mission.phase === 'command'
      && this.state.mission.counterattackUnitIds.includes(unitId)
    ) return true;
    return this.state.mission.phase === 'counterattack'
      && this.state.mission.counterattackUnitIds.includes(unitId);
  }

  private completeMissionState(): void {
    if (this.state.mission.kind !== 'breakthrough') return;
    this.state.mission.phase = 'complete';
    this.state.mission.phaseStartedTick = this.state.tick;
  }

  private resolveVictory(): void {
    if (this.state.status !== 'active') return;
    const playerHq = this.state.buildings.some(
      (building) => building.team === 'player' && building.kind === 'hq' && building.hp > 0,
    );
    const enemyHq = this.state.buildings.some(
      (building) => building.team === 'enemy' && building.kind === 'hq' && building.hp > 0,
    );
    if (!playerHq && !enemyHq) {
      this.state.status = 'defeat';
      this.state.statusReason = '双方指挥核心同时被摧毁';
      this.addNotification('danger', '双方指挥核心同时被摧毁', 20);
      this.completeMissionState();
      return;
    }
    if (!playerHq) {
      this.state.status = 'defeat';
      this.state.statusReason = '指挥核心被摧毁';
      this.addNotification('danger', '指挥核心被摧毁', 20);
      this.completeMissionState();
      return;
    }
    if (!enemyHq) {
      this.state.status = 'victory';
      this.state.statusReason = '敌方指挥核心被摧毁';
      this.addNotification('success', '敌方指挥核心被摧毁', 20);
      this.completeMissionState();
      return;
    }
    if (this.state.beacon.playerProgress >= this.state.beacon.targetProgress - EPSILON) {
      this.state.status = 'victory';
      this.state.statusReason = '信标支配完成';
      this.addNotification('success', '信标支配完成', 20);
      this.completeMissionState();
    } else if (this.state.beacon.enemyProgress >= this.state.beacon.targetProgress - EPSILON) {
      this.state.status = 'defeat';
      this.state.statusReason = '敌方完成信标支配';
      this.addNotification('danger', '敌方完成信标支配', 20);
      this.completeMissionState();
    }
  }

  private runEnemyAi(): void {
    if (
      this.fixture === 'enemy-review'
      || this.fixture === 'visual-gold-review'
      || this.fixture === 'wreck-review'
      || this.fixture === 'wreck-review-reduced'
      || this.fixture === 'building-ruin-review'
      || this.fixture === 'building-ruin-review-reduced'
      || this.fixture === 'destruction-residue-review'
      || this.fixture === 'destruction-residue-review-reduced'
      || this.fixture === 'building-damage-review'
      || this.fixture === 'building-damage-review-reduced'
      || this.fixture === 'enemy-infrastructure-review'
      || this.fixture === 'player-infrastructure-review'
      || this.fixture === 'enemy-vehicle-socket-review'
      || this.fixture === 'combat-vehicle-family-review'
      || this.fixture === 'breakthrough-demo-victory-review'
      || this.fixture === 'breakthrough-demo-defeat-review'
    ) return;
    if (this.state.status !== 'active' || this.state.tick % AI_UPDATE_TICKS !== 0) return;
    const team: ActiveTeam = 'enemy';

    for (const harvester of stableById(this.state.units.filter((unit) => unit.team === team && unit.kind === 'harvester'))) {
      if (harvester.order.type !== 'idle') continue;
      const resource = this.nearestResource(harvester.position);
      if (resource) harvester.order = { type: 'gather', targetId: resource.id };
    }

    // The golden breakthrough is paced by explicit, deterministic mission waves.
    // Generic economy expansion would otherwise bury that authored curve under
    // unrelated relay spam and opportunistic attack orders.
    if (isPlayableBreakthroughFixture(this.fixture)) return;

    const input = this.enemyAiInput();
    const result = planAI(input);
    this.enemyAiMemory = result.memory;
    this.state.ai.enemy = {
      phase: result.state,
      reason: result.reason,
      stateEnteredTick: result.memory.stateEnteredTick,
    };

    for (const intent of [...result.intents].sort((left, right) => right.priority - left.priority)) {
      switch (intent.type) {
        case 'build': {
          if (this.hasQueuedConstruction(team, intent.kind)) break;
          const preferred = this.validateBuildForTeam(team, intent.kind, intent.position, 0).valid
            ? intent.position
            : this.findAiBuildPlacement(intent.kind, intent.position);
          if (preferred && this.validateBuildForTeam(team, intent.kind, preferred, 0).valid) {
            this.createConstruction(team, intent.kind, preferred, 0);
          }
          break;
        }
        case 'train': {
          const producer = this.state.buildings.find(
            (building) => building.id === intent.producerId && building.team === team,
          );
          if (producer) this.enqueueProduction(team, producer, intent.kind);
          break;
        }
        case 'move':
        case 'rally': {
          const units = intent.unitIds
            .map((id) => this.state.units.find((unit) => unit.id === id && unit.team === team && unit.hp > 0))
            .filter((unit): unit is UnitState => unit !== undefined
              && !this.isMissionDirectorLocked(unit.id)
              && !this.enemyCombatResponses.has(unit.id));
          const orders = this.planFormationOrders(units, intent.position, 'move', false);
          if (orders) for (const { unit, order } of orders) this.assignOrder(unit, order, false);
          break;
        }
        case 'attack': {
          const target = this.targetById(intent.targetId);
          if (!target || target.team === team || target.hp <= 0 || !this.isEnemyVisibleTo(team, target.id)) break;
          const units = intent.unitIds
            .map((id) => this.state.units.find((unit) => unit.id === id && unit.team === team && unit.hp > 0))
            .filter((unit): unit is UnitState => unit !== undefined
              && UNIT_DEFS[unit.kind].damage > 0
              && !this.isMissionDirectorLocked(unit.id)
              && !this.enemyCombatResponses.has(unit.id));
          for (const unit of units) this.assignOrder(unit, { type: 'attack', targetId: target.id }, false);
          break;
        }
        case 'repair': {
          const target = this.targetById(intent.targetId);
          if (!target || target.team !== team || target.hp <= 0 || target.hp >= target.maxHp - EPSILON) break;
          const engineers = intent.unitIds
            .map((id) => this.state.units.find((unit) => unit.id === id && unit.team === team && unit.kind === 'engineer'))
            .filter((unit): unit is UnitState => unit !== undefined
              && !this.isMissionDirectorLocked(unit.id)
              && !this.enemyCombatResponses.has(unit.id));
          for (const engineer of engineers) {
            this.assignOrder(engineer, { type: 'repair', targetId: target.id }, false);
          }
          break;
        }
        case 'research': {
          this.startResearch(team, intent.kind);
          break;
        }
      }
    }
  }

  private enemyAiInput(): AIPlannerInput {
    const enemyHq = this.state.buildings.find(
      (building) => building.team === 'enemy' && building.kind === 'hq' && building.hp > 0,
    );
    const visiblePlayerIds = new Set(this.state.intel.enemy.visibleEnemyIds);
    const basePosition = cloneVec(enemyHq?.position ?? { x: 52, z: -46 });
    const summarize = (unit: UnitState): AIPlannerUnitSummary => ({
      id: unit.id,
      kind: unit.kind,
      position: cloneVec(unit.position),
      hpRatio: clamp(unit.hp / unit.maxHp, 0, 1),
      combatPower: AI_COMBAT_POWER[unit.kind],
    });
    const ownUnits = stableById(this.state.units.filter(
      (unit) => unit.team === 'enemy' && unit.hp > 0 && !this.isMissionDirectorLocked(unit.id),
    )).map(summarize);
    const enemyUnits = stableById(
      this.state.units.filter((unit) => unit.team === 'player' && unit.hp > 0 && visiblePlayerIds.has(unit.id)),
    ).map(summarize);
    const ownBuildings = stableById(this.state.buildings.filter((building) => building.team === 'enemy' && building.hp > 0)).map(
      (building) => ({
        id: building.id,
        kind: building.kind,
        position: cloneVec(building.position),
        hpRatio: clamp(building.hp / building.maxHp, 0, 1),
        operational: building.buildProgress >= 1 && building.connected && building.powered,
      }),
    );
    const enemyBuildings = stableById(
      this.state.buildings.filter(
        (building) => building.team === 'player' && building.hp > 0 && visiblePlayerIds.has(building.id),
      ),
    ).map(
      (building) => ({
        id: building.id,
        kind: building.kind,
        position: cloneVec(building.position),
        hpRatio: clamp(building.hp / building.maxHp, 0, 1),
        operational: building.buildProgress >= 1 && building.connected && building.powered,
      }),
    );
    const threatUnits = enemyUnits.filter((unit) => distance(unit.position, basePosition) <= 30 && unit.combatPower > 0);
    const threatPower = threatUnits.reduce((sum, unit) => sum + unit.combatPower * unit.hpRatio, 0);
    const ownPower = ownUnits.reduce((sum, unit) => sum + unit.combatPower * unit.hpRatio, 0);
    const threatPosition = threatUnits.length > 0
      ? threatUnits.reduce(
        (sum, unit) => ({
          x: sum.x + unit.position.x / threatUnits.length,
          z: sum.z + unit.position.z / threatUnits.length,
        }),
        { x: 0, z: 0 },
      )
      : null;
    const towardCenter = normalized(-basePosition.x, -basePosition.z);
    const rallyPoint = {
      x: basePosition.x + towardCenter.x * 22,
      z: basePosition.z + towardCenter.z * 22,
    };
    const expansionSites = stableById(this.state.resources).map((resource) => {
      const enemyNearby = this.state.buildings.filter(
        (building) => building.team === 'enemy' && building.hp > 0 && distance(building.position, resource.position) <= 18,
      );
      const playerNearby = this.state.buildings.some(
        (building) =>
          building.team === 'player' &&
          building.hp > 0 &&
          visiblePlayerIds.has(building.id) &&
          distance(building.position, resource.position) <= 18,
      );
      return {
        id: resource.id,
        position: cloneVec(resource.position),
        resourceValue: resource.amount,
        safe: !enemyUnits.some((unit) => unit.combatPower > 0 && distance(unit.position, resource.position) <= 22),
        occupiedBy: playerNearby ? 'enemy' as const : enemyNearby.length > 0 ? 'self' as const : null,
        hasRelay: enemyNearby.some((building) => building.kind === 'relay'),
        hasRefinery: enemyNearby.some((building) => building.kind === 'refinery'),
      };
    });

    return {
      tick: this.state.tick,
      credits: this.state.economy.enemy.credits,
      incomePerMinute: this.state.economy.enemy.incomePerMinute,
      powerRatio: this.state.economy.enemy.powerRatio,
      bandwidthUsed: this.state.economy.enemy.bandwidthUsed,
      bandwidthCap: this.state.economy.enemy.bandwidthCap,
      baseHealthRatio: enemyHq ? clamp(enemyHq.hp / enemyHq.maxHp, 0, 1) : 0,
      basePosition,
      rallyPoint,
      ownUnits,
      enemyUnits,
      ownBuildings,
      enemyBuildings,
      expansionSites,
      threat: {
        score: clamp(threatPower / Math.max(1, ownPower * 0.75), 0, 1),
        position: threatPosition,
        sourceIds: threatUnits.map((unit) => unit.id),
      },
      memory: this.enemyAiMemory,
      completedResearch: this.state.technology.enemy.completed,
      activeResearch: this.state.technology.enemy.current?.kind ?? null,
    };
  }

  private findAiBuildPlacement(kind: BuildingKind, preferred?: Vec2): Vec2 | undefined {
    const hq = this.state.buildings.find(
      (building) => building.team === 'enemy' && building.kind === 'hq' && building.hp > 0,
    );
    if (!hq) return undefined;
    const centers: Vec2[] = [];
    if (preferred) {
      const anchors = stableById(this.state.buildings.filter(
        (building) =>
          building.team === 'enemy' &&
          building.hp > 0 &&
          building.buildProgress >= 1 &&
          building.connected &&
          (building.kind === 'hq' || building.kind === 'relay'),
      )).sort((left, right) => {
        const difference = distanceSquared(left.position, preferred) - distanceSquared(right.position, preferred);
        return Math.abs(difference) > EPSILON ? difference : compareStableText(left.id, right.id);
      });
      for (const anchor of anchors) {
        const direction = normalized(preferred.x - anchor.position.x, preferred.z - anchor.position.z);
        const reach = BUILDING_DEFS[anchor.kind].buildRadius * 0.72;
        centers.push({
          x: anchor.position.x + direction.x * Math.min(reach, distance(anchor.position, preferred)),
          z: anchor.position.z + direction.z * Math.min(reach, distance(anchor.position, preferred)),
        });
      }
    }
    centers.push(cloneVec(hq.position));

    for (const center of centers) {
      const radii = center === centers[centers.length - 1] ? [18, 22, 26] : [0, 4, 8, 12];
      for (const radius of radii) {
        const samples = radius === 0 ? 1 : 16;
        for (let index = 0; index < samples; index += 1) {
          const angle = (index / samples) * Math.PI * 2;
          const candidate = {
            x: center.x + Math.cos(angle) * radius,
            z: center.z + Math.sin(angle) * radius,
          };
          const validation = this.validateBuildForTeam('enemy', kind, candidate, 0);
          if (validation.valid) return candidate;
        }
      }
    }
    return undefined;
  }

  private hasQueuedConstruction(team: ActiveTeam, kind: BuildingKind): boolean {
    return this.state.buildings.some(
      (building) => building.team === team && building.kind === kind && building.buildProgress < 1 && building.hp > 0,
    );
  }

  private updateIncomeRates(): void {
    for (const team of ACTIVE_TEAMS) {
      const cutoff = this.state.elapsed - 60;
      this.incomeRecords[team] = this.incomeRecords[team].filter((record) => record.at > cutoff);
      this.state.economy[team].incomePerMinute = this.incomeRecords[team].reduce(
        (sum, record) => sum + record.amount,
        0,
      );
    }
  }

  private removeDestroyedEntities(): void {
    const survivingUnitIds = new Set(this.state.units.filter((unit) => unit.hp > 0).map((unit) => unit.id));
    const survivingBuildingIds = new Set(
      this.state.buildings.filter((building) => building.hp > 0).map((building) => building.id),
    );
    this.state.units = this.state.units.filter((unit) => unit.hp > 0);
    this.state.buildings = this.state.buildings.filter((building) => building.hp > 0);
    for (const id of [...this.orderQueues.keys()]) {
      if (!survivingUnitIds.has(id)) this.orderQueues.delete(id);
    }
    for (const id of [...this.enemyCombatResponses.keys()]) {
      if (!survivingUnitIds.has(id)) this.enemyCombatResponses.delete(id);
    }
    for (const id of [...this.disconnectReserve.keys()]) {
      if (!survivingBuildingIds.has(id)) this.disconnectReserve.delete(id);
    }
  }

  private planFormationOrders(
    units: readonly UnitState[],
    destination: Vec2,
    type: 'move' | 'attackMove',
    queued: boolean,
  ): Array<{ unit: UnitState; order: UnitOrder }> | null {
    const stableUnits = stableById(units);
    const slots = this.formationSlots(stableUnits, destination);
    const pathfinders = new Map<string, GridPathfinder>();
    const planned: Array<{ unit: UnitState; order: UnitOrder }> = [];

    for (let index = 0; index < stableUnits.length; index += 1) {
      const unit = stableUnits[index];
      const slot = slots[index];
      if (!unit || !slot) return null;
      const order: UnitOrder = { type, target: cloneVec(slot) };
      if (!queued) {
        const clearance = unit.radius + NAVIGATION_PADDING;
        const key = clearance.toFixed(3);
        let pathfinder = pathfinders.get(key);
        if (!pathfinder) {
          pathfinder = this.createPathfinder(clearance);
          pathfinders.set(key, pathfinder);
        }
        const path = this.findReachablePath(pathfinder, unit.position, slot);
        if (!path) return null;
        order.target = cloneVec(path[path.length - 1] ?? slot);
        order.waypoints = path.slice(1).map(cloneVec);
        order.waypointIndex = 0;
      }
      planned.push({ unit, order });
    }
    return planned;
  }

  private formationSlots(units: readonly UnitState[], destination: Vec2): Vec2[] {
    if (units.length <= 1) return [cloneVec(destination)];
    const centroid = units.reduce(
      (sum, unit) => ({ x: sum.x + unit.position.x / units.length, z: sum.z + unit.position.z / units.length }),
      { x: 0, z: 0 },
    );
    const toward = normalized(destination.x - centroid.x, destination.z - centroid.z);
    const forward = toward.x === 0 && toward.z === 0 ? { x: 0, z: -1 } : toward;
    const right = { x: forward.z, z: -forward.x };
    const columns = Math.ceil(Math.sqrt(units.length));
    const rows = Math.ceil(units.length / columns);
    const largestRadius = units.reduce((maximum, unit) => Math.max(maximum, unit.radius), 0);
    const spacing = Math.max(FORMATION_MIN_SPACING, largestRadius * 2.25);

    return units.map((unit, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const itemsInRow = Math.min(columns, units.length - row * columns);
      const lateral = (column - (itemsInRow - 1) / 2) * spacing;
      const depth = (row - (rows - 1) / 2) * spacing;
      return {
        x: clamp(
          destination.x + right.x * lateral - forward.x * depth,
          -MAP_HALF_SIZE + unit.radius,
          MAP_HALF_SIZE - unit.radius,
        ),
        z: clamp(
          destination.z + right.z * lateral - forward.z * depth,
          -MAP_HALF_SIZE + unit.radius,
          MAP_HALF_SIZE - unit.radius,
        ),
      };
    });
  }

  private createPathfinder(clearance: number): GridPathfinder {
    const obstacles: PathObstacle[] = [];
    for (const blocker of stableById(this.state.blockers)) {
      if (!blocker.blocksMovement) continue;
      obstacles.push({ kind: 'circle', center: cloneVec(blocker.position), radius: blocker.radius });
    }
    for (const building of stableById(this.state.buildings)) {
      if (building.hp <= 0) continue;
      const cosine = Math.abs(Math.cos(building.rotation));
      const sine = Math.abs(Math.sin(building.rotation));
      const halfX = (building.footprint.x * cosine + building.footprint.z * sine) / 2;
      const halfZ = (building.footprint.x * sine + building.footprint.z * cosine) / 2;
      obstacles.push({
        kind: 'rect',
        min: { x: building.position.x - halfX, z: building.position.z - halfZ },
        max: { x: building.position.x + halfX, z: building.position.z + halfZ },
      });
    }
    return new GridPathfinder({
      bounds: { minX: -MAP_HALF_SIZE, maxX: MAP_HALF_SIZE, minZ: -MAP_HALF_SIZE, maxZ: MAP_HALF_SIZE },
      cellSize: NAVIGATION_CELL_SIZE,
      clearance,
      obstacles,
      simplify: true,
    });
  }

  private findReachablePath(pathfinder: GridPathfinder, start: Vec2, desiredGoal: Vec2): Vec2[] | null {
    const starts = this.navigationCandidates(pathfinder, start, 4);
    const goals = this.navigationCandidates(pathfinder, desiredGoal, 6);
    for (const goal of goals) {
      for (const navigableStart of starts) {
        const path = pathfinder.findPath(navigableStart, goal);
        if (!path) continue;
        if (distanceSquared(start, navigableStart) <= EPSILON) return path;
        return [cloneVec(start), ...path];
      }
    }
    return null;
  }

  private navigationCandidates(
    pathfinder: GridPathfinder,
    center: Vec2,
    rings: number,
  ): Vec2[] {
    const candidates: Vec2[] = [];
    if (pathfinder.isWalkable(center)) candidates.push(cloneVec(center));
    for (let ring = 1; ring <= rings; ring += 1) {
      const radius = ring * NAVIGATION_CELL_SIZE;
      for (let index = 0; index < 8; index += 1) {
        const angle = (index / 8) * Math.PI * 2;
        const candidate = {
          x: center.x + Math.cos(angle) * radius,
          z: center.z + Math.sin(angle) * radius,
        };
        if (pathfinder.isWalkable(candidate)) candidates.push(candidate);
      }
    }
    return candidates;
  }

  private prepareNavigationOrder(unit: UnitState, order: UnitOrder): UnitOrder {
    const cleanOrder = cloneOrder(order);
    if (
      (cleanOrder.type !== 'move' && cleanOrder.type !== 'attackMove') ||
      !cleanOrder.target ||
      (cleanOrder.waypoints && cleanOrder.waypoints.length > 0)
    ) {
      return cleanOrder;
    }
    const pathfinder = this.createPathfinder(unit.radius + NAVIGATION_PADDING);
    const path = this.findReachablePath(pathfinder, unit.position, cleanOrder.target);
    if (!path) return cleanOrder;
    cleanOrder.target = cloneVec(path[path.length - 1] ?? cleanOrder.target);
    cleanOrder.waypoints = path.slice(1).map(cloneVec);
    cleanOrder.waypointIndex = 0;
    return cleanOrder;
  }

  private assignOrder(unit: UnitState, order: UnitOrder, queued: boolean): void {
    const cleanOrder = queued ? cloneOrder(order) : this.prepareNavigationOrder(unit, order);
    cleanOrder.queued = undefined;
    if (queued && unit.order.type !== 'idle') {
      const queue = this.orderQueues.get(unit.id) ?? [];
      queue.push(cleanOrder);
      this.orderQueues.set(unit.id, queue);
      return;
    }
    if (!queued) this.orderQueues.delete(unit.id);
    unit.order = cleanOrder;
  }

  private completeOrder(unit: UnitState): void {
    const queue = this.orderQueues.get(unit.id);
    const next = queue?.shift();
    if (queue && queue.length === 0) this.orderQueues.delete(unit.id);
    unit.order = next ? this.prepareNavigationOrder(unit, next) : { type: 'idle' };
  }

  private playerUnitsForCommand(unitIds: readonly string[]):
    | { ok: true; units: UnitState[] }
    | { ok: false; result: { ok: false; reason: string } } {
    const ids = [...new Set(unitIds)].sort(compareStableText);
    if (ids.length === 0) return { ok: false, result: { ok: false, reason: '没有选择单位' } };
    const units: UnitState[] = [];
    for (const id of ids) {
      const unit = this.state.units.find((candidate) => candidate.id === id);
      if (!unit || unit.team !== 'player' || unit.hp <= 0) {
        return { ok: false, result: { ok: false, reason: `单位不可用：${id}` } };
      }
      units.push(unit);
    }
    return { ok: true, units };
  }

  private targetById(id: string): DamageTarget | undefined {
    return this.state.units.find((unit) => unit.id === id) ?? this.state.buildings.find((building) => building.id === id);
  }

  private nearestResource(position: Vec2): GameState['resources'][number] | undefined {
    return stableById(this.state.resources)
      .filter((resource) => resource.amount > EPSILON)
      .sort((left, right) => {
        const difference = distanceSquared(position, left.position) - distanceSquared(position, right.position);
        return Math.abs(difference) > EPSILON ? difference : compareStableText(left.id, right.id);
      })[0];
  }

  private nearestOperationalRefinery(team: ActiveTeam, position: Vec2): BuildingState | undefined {
    return stableById(this.state.buildings)
      .filter(
        (building) =>
          building.team === team &&
          building.kind === 'refinery' &&
          building.hp > 0 &&
          building.buildProgress >= 1 &&
          building.connected,
      )
      .sort((left, right) => {
        const difference = distanceSquared(position, left.position) - distanceSquared(position, right.position);
        return Math.abs(difference) > EPSILON ? difference : compareStableText(left.id, right.id);
      })[0];
  }

  private isInsideMap(position: Vec2, radius: number): boolean {
    return (
      position.x >= -MAP_HALF_SIZE + radius &&
      position.x <= MAP_HALF_SIZE - radius &&
      position.z >= -MAP_HALF_SIZE + radius &&
      position.z <= MAP_HALF_SIZE - radius
    );
  }

  private stableSeparationDirection(leftId: string, rightId: string): Vec2 {
    let hash = 2166136261;
    const text = leftId < rightId ? `${leftId}|${rightId}` : `${rightId}|${leftId}`;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    const angle = ((hash >>> 0) / 0xffffffff) * Math.PI * 2;
    const direction = { x: Math.cos(angle), z: Math.sin(angle) };
    return leftId < rightId ? direction : { x: -direction.x, z: -direction.z };
  }

  private seedToRngState(seed: number): number {
    const state = seed >>> 0;
    return state === 0 ? 0x6d2b79f5 : state;
  }

  private emitCommand(at: Vec2): void {
    this.events.push({ type: 'command', at: cloneVec(at), team: 'player' });
  }

  private addNotification(
    tone: GameState['notifications'][number]['tone'],
    text: string,
    lifetime: number,
    at?: Vec2,
  ): void {
    this.state.notifications.push({
      id: this.notificationSequence,
      tone,
      text,
      expiresAt: this.state.elapsed + lifetime,
      at: at ? cloneVec(at) : undefined,
    });
    this.notificationSequence += 1;
  }
}
