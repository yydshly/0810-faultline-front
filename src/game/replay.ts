import { BUILDING_DEFS, GAME_TICK_SECONDS, UNIT_DEFS } from './config';
import { GameSimulation } from './simulation';
import { TECHNOLOGY_DEFS } from './technology';
import type { TechnologyKind } from './technology';
import type { BuildingKind, GameCommand, UnitKind, Vec2 } from './types';

export const REPLAY_FORMAT = 'faultline-front.command-log';
export const REPLAY_VERSION = 3 as const;

const MAX_REPLAY_BYTES = 5_000_000;
const MAX_REPLAY_TICK = 1_000_000;
const MAX_REPLAY_COMMANDS = 100_000;
const MAX_COMMAND_UNIT_IDS = 512;
const MAX_TEXT_LENGTH = 160;

export interface ReplayCommandEntry {
  tick: number;
  sequence: number;
  command: GameCommand;
}

export interface ReplayLog {
  format: typeof REPLAY_FORMAT;
  version: typeof REPLAY_VERSION;
  seed: number;
  fixture: string;
  currentTick: number;
  commands: ReplayCommandEntry[];
}

export interface ReplayResult {
  simulation: GameSimulation;
  currentTick: number;
  hash: string;
}

export class ReplayFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReplayFormatError';
  }
}

export class ReplayVersionError extends ReplayFormatError {
  readonly foundVersion: unknown;

  constructor(foundVersion: unknown) {
    super(`不兼容的回放版本：${String(foundVersion)}；当前仅支持 ${REPLAY_VERSION}`);
    this.name = 'ReplayVersionError';
    this.foundVersion = foundVersion;
  }
}

export class ReplayExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReplayExecutionError';
  }
}

type UnknownRecord = Record<string, unknown>;

function fail(path: string, message: string): never {
  throw new ReplayFormatError(`${path} ${message}`);
}

function asRecord(value: unknown, path: string): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return fail(path, '必须是对象');
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return fail(path, '必须是普通对象');
  return value as UnknownRecord;
}

function assertExactKeys(
  record: UnknownRecord,
  required: readonly string[],
  optional: readonly string[],
  path: string,
): void {
  const allowed = new Set([...required, ...optional]);
  for (const key of Reflect.ownKeys(record)) {
    if (typeof key !== 'string' || !allowed.has(key)) fail(path, `包含未知字段 ${String(key)}`);
  }
  for (const key of required) {
    if (!Object.hasOwn(record, key)) fail(path, `缺少字段 ${key}`);
  }
}

function readSafeInteger(value: unknown, path: string, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    return fail(path, `必须是 ${minimum}–${maximum} 范围内的安全整数`);
  }
  return value as number;
}

function readFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fail(path, '必须是有限数字');
  return value;
}

function readText(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_TEXT_LENGTH) {
    return fail(path, `必须是 1–${MAX_TEXT_LENGTH} 个字符的字符串`);
  }
  if (/[\u0000-\u001f\u007f]/u.test(value)) return fail(path, '不能包含控制字符');
  return value;
}

function readBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') return fail(path, '必须是布尔值');
  return value;
}

function readVec2(value: unknown, path: string): Vec2 {
  const record = asRecord(value, path);
  assertExactKeys(record, ['x', 'z'], [], path);
  return {
    x: readFiniteNumber(record.x, `${path}.x`),
    z: readFiniteNumber(record.z, `${path}.z`),
  };
}

function compareStableText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function readUnitIds(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_COMMAND_UNIT_IDS) {
    return fail(path, `必须包含 1–${MAX_COMMAND_UNIT_IDS} 个单位 ID`);
  }
  const ids = value.map((item, index) => readText(item, `${path}[${index}]`));
  if (new Set(ids).size !== ids.length) fail(path, '不能包含重复单位 ID');
  return ids.sort(compareStableText);
}

function readBuildingKind(value: unknown, path: string): BuildingKind {
  const kind = readText(value, path);
  if (!Object.hasOwn(BUILDING_DEFS, kind)) return fail(path, `包含未知建筑类型 ${kind}`);
  return kind as BuildingKind;
}

function readUnitKind(value: unknown, path: string): UnitKind {
  const kind = readText(value, path);
  if (!Object.hasOwn(UNIT_DEFS, kind)) return fail(path, `包含未知单位类型 ${kind}`);
  return kind as UnitKind;
}

function readTechnologyKind(value: unknown, path: string): TechnologyKind {
  const kind = readText(value, path);
  if (!Object.hasOwn(TECHNOLOGY_DEFS, kind)) return fail(path, `包含未知科技类型 ${kind}`);
  return kind as TechnologyKind;
}

function readQueued(record: UnknownRecord, path: string): true | undefined {
  if (!Object.hasOwn(record, 'queued') || record.queued === undefined) return undefined;
  return readBoolean(record.queued, `${path}.queued`) ? true : undefined;
}

function normalizeCommand(value: unknown, path: string): GameCommand {
  const record = asRecord(value, path);
  const type = readText(record.type, `${path}.type`);

  switch (type) {
    case 'move':
    case 'attackMove': {
      assertExactKeys(record, ['type', 'unitIds', 'target'], ['queued'], path);
      const queued = readQueued(record, path);
      return {
        type,
        unitIds: readUnitIds(record.unitIds, `${path}.unitIds`),
        target: readVec2(record.target, `${path}.target`),
        ...(queued ? { queued } : {}),
      };
    }
    case 'attack':
    case 'repair': {
      assertExactKeys(record, ['type', 'unitIds', 'targetId'], ['queued'], path);
      const queued = readQueued(record, path);
      return {
        type,
        unitIds: readUnitIds(record.unitIds, `${path}.unitIds`),
        targetId: readText(record.targetId, `${path}.targetId`),
        ...(queued ? { queued } : {}),
      };
    }
    case 'gather': {
      assertExactKeys(record, ['type', 'unitIds', 'resourceId'], ['queued'], path);
      const queued = readQueued(record, path);
      return {
        type,
        unitIds: readUnitIds(record.unitIds, `${path}.unitIds`),
        resourceId: readText(record.resourceId, `${path}.resourceId`),
        ...(queued ? { queued } : {}),
      };
    }
    case 'stop':
      assertExactKeys(record, ['type', 'unitIds'], [], path);
      return { type, unitIds: readUnitIds(record.unitIds, `${path}.unitIds`) };
    case 'build':
      assertExactKeys(record, ['type', 'kind', 'position', 'rotation'], [], path);
      return {
        type,
        kind: readBuildingKind(record.kind, `${path}.kind`),
        position: readVec2(record.position, `${path}.position`),
        rotation: readFiniteNumber(record.rotation, `${path}.rotation`),
      };
    case 'produce':
      assertExactKeys(record, ['type', 'buildingId', 'unitKind'], [], path);
      return {
        type,
        buildingId: readText(record.buildingId, `${path}.buildingId`),
        unitKind: readUnitKind(record.unitKind, `${path}.unitKind`),
      };
    case 'setRally':
      assertExactKeys(record, ['type', 'buildingId', 'target'], [], path);
      return {
        type,
        buildingId: readText(record.buildingId, `${path}.buildingId`),
        target: readVec2(record.target, `${path}.target`),
      };
    case 'research':
      assertExactKeys(record, ['type', 'kind'], [], path);
      return {
        type,
        kind: readTechnologyKind(record.kind, `${path}.kind`),
      };
    case 'cancelConstruction':
    case 'cancelProduction':
      assertExactKeys(record, ['type', 'buildingId'], [], path);
      return {
        type,
        buildingId: readText(record.buildingId, `${path}.buildingId`),
      };
    case 'cancelResearch':
      assertExactKeys(record, ['type'], [], path);
      return { type };
    default:
      return fail(`${path}.type`, `包含未知命令类型 ${type}`);
  }
}

function normalizeReplayLog(value: unknown): ReplayLog {
  const root = asRecord(value, 'replay');
  assertExactKeys(root, ['format', 'version', 'seed', 'fixture', 'currentTick', 'commands'], [], 'replay');

  if (root.format !== REPLAY_FORMAT) fail('replay.format', `必须是 ${REPLAY_FORMAT}`);
  if (root.version !== REPLAY_VERSION) throw new ReplayVersionError(root.version);

  const seed = readSafeInteger(root.seed, 'replay.seed', Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
  const fixture = readText(root.fixture, 'replay.fixture');
  const currentTick = readSafeInteger(root.currentTick, 'replay.currentTick', 0, MAX_REPLAY_TICK);
  if (!Array.isArray(root.commands) || root.commands.length > MAX_REPLAY_COMMANDS) {
    fail('replay.commands', `必须是最多包含 ${MAX_REPLAY_COMMANDS} 项的数组`);
  }

  const commands: ReplayCommandEntry[] = [];
  for (let index = 0; index < root.commands.length; index += 1) {
    if (!Object.hasOwn(root.commands, index)) fail(`replay.commands[${index}]`, '不能是空项');
    const path = `replay.commands[${index}]`;
    const entry = asRecord(root.commands[index], path);
    assertExactKeys(entry, ['tick', 'sequence', 'command'], [], path);
    const tick = readSafeInteger(entry.tick, `${path}.tick`, 0, MAX_REPLAY_TICK);
    if (tick > currentTick) fail(`${path}.tick`, '不能晚于 currentTick');
    commands.push({
      tick,
      sequence: readSafeInteger(entry.sequence, `${path}.sequence`, 0, MAX_REPLAY_COMMANDS - 1),
      command: normalizeCommand(entry.command, `${path}.command`),
    });
  }

  commands.sort((left, right) => left.tick - right.tick || left.sequence - right.sequence);
  for (let index = 0; index < commands.length; index += 1) {
    const entry = commands[index];
    if (!entry || entry.sequence !== index) {
      fail('replay.commands', 'sequence 必须从 0 开始连续递增，且与 tick 顺序一致');
    }
  }

  return {
    format: REPLAY_FORMAT,
    version: REPLAY_VERSION,
    seed,
    fixture,
    currentTick,
    commands,
  };
}

/** Serialize a validated replay into a canonical JSON representation. */
export function serializeReplay(log: ReplayLog): string {
  return JSON.stringify(normalizeReplayLog(log));
}

/** Parse untrusted JSON and reject malformed or incompatible replay data. */
export function parseReplay(serialized: string): ReplayLog {
  if (typeof serialized !== 'string' || serialized.length === 0 || serialized.length > MAX_REPLAY_BYTES) {
    throw new ReplayFormatError(`回放 JSON 必须是 1–${MAX_REPLAY_BYTES} 字节的字符串`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch {
    throw new ReplayFormatError('回放不是有效 JSON');
  }
  return normalizeReplayLog(parsed);
}

/**
 * Owns a simulation and records only accepted external player commands.
 * Commands issued in the same tick retain their insertion order through the
 * monotonically increasing sequence field.
 */
export class ReplayRecorder {
  readonly simulation: GameSimulation;
  readonly seed: number;
  readonly fixture: string;

  private readonly commands: ReplayCommandEntry[] = [];

  constructor(seed = 1949, fixture = 'default') {
    const initial = normalizeReplayLog({
      format: REPLAY_FORMAT,
      version: REPLAY_VERSION,
      seed,
      fixture,
      currentTick: 0,
      commands: [],
    });
    this.seed = initial.seed;
    this.fixture = initial.fixture;
    this.simulation = new GameSimulation(this.seed, this.fixture);
  }

  get currentTick(): number {
    return this.simulation.state.tick;
  }

  issue(command: GameCommand): { ok: boolean; reason: string } {
    const normalized = normalizeCommand(command, 'command');
    const result = this.simulation.issue(normalized);
    if (result.ok) {
      this.commands.push({
        tick: this.currentTick,
        sequence: this.commands.length,
        command: normalized,
      });
    }
    return result;
  }

  stepTicks(count = 1): number {
    const ticks = readSafeInteger(count, 'count', 0, MAX_REPLAY_TICK);
    for (let index = 0; index < ticks && this.simulation.state.status === 'active'; index += 1) {
      this.simulation.step(GAME_TICK_SECONDS);
    }
    return this.currentTick;
  }

  toLog(): ReplayLog {
    return normalizeReplayLog({
      format: REPLAY_FORMAT,
      version: REPLAY_VERSION,
      seed: this.seed,
      fixture: this.fixture,
      currentTick: this.currentTick,
      commands: this.commands,
    });
  }

  serialize(): string {
    return serializeReplay(this.toLog());
  }
}

export function createReplayRecorder(seed = 1949, fixture = 'default'): ReplayRecorder {
  return new ReplayRecorder(seed, fixture);
}

/** Rebuild a simulation at the requested tick using only the command log. */
export function replay(log: ReplayLog, targetTick = log.currentTick): ReplayResult {
  const normalized = normalizeReplayLog(log);
  const target = readSafeInteger(targetTick, 'targetTick', 0, normalized.currentTick);
  const simulation = new GameSimulation(normalized.seed, normalized.fixture);
  const commands = normalized.commands.filter((entry) => entry.tick <= target);
  let commandIndex = 0;

  while (true) {
    while (commandIndex < commands.length && commands[commandIndex]?.tick === simulation.state.tick) {
      const entry = commands[commandIndex];
      if (!entry) break;
      const result = simulation.issue(entry.command);
      if (!result.ok) {
        throw new ReplayExecutionError(
          `tick ${entry.tick} sequence ${entry.sequence} 的命令被拒绝：${result.reason}`,
        );
      }
      commandIndex += 1;
    }
    simulation.drainEvents();

    if (simulation.state.tick === target) break;
    if (simulation.state.status !== 'active') {
      throw new ReplayExecutionError(
        `对局在 tick ${simulation.state.tick} 已结束，无法回放到 tick ${target}`,
      );
    }
    const before = simulation.state.tick;
    simulation.step(GAME_TICK_SECONDS);
    simulation.drainEvents();
    if (simulation.state.tick !== before + 1) {
      throw new ReplayExecutionError(`模拟器未能从 tick ${before} 推进到下一 tick`);
    }
  }

  if (commandIndex !== commands.length) {
    throw new ReplayExecutionError('存在未能在目标 tick 前执行的命令');
  }
  return {
    simulation,
    currentTick: simulation.state.tick,
    hash: simulation.hashState(),
  };
}

export function replayFromJSON(serialized: string, targetTick?: number): ReplayResult {
  const log = parseReplay(serialized);
  return replay(log, targetTick ?? log.currentTick);
}
