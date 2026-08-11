import { describe, expect, it } from 'vitest';

import {
  REPLAY_FORMAT,
  REPLAY_VERSION,
  ReplayFormatError,
  ReplayVersionError,
  createReplayRecorder,
  parseReplay,
  replay,
  replayFromJSON,
  serializeReplay,
} from './replay';

describe('版本化确定性命令日志', () => {
  it('JSON roundtrip 保留规范结构且序列化稳定', () => {
    const recorder = createReplayRecorder(731, 'combat');
    expect(recorder.issue({
      type: 'move',
      unitIds: ['u-player-rifle-2', 'u-player-rifle-1'],
      target: { x: -16, z: 18 },
    }).ok).toBe(true);
    recorder.stepTicks(25);
    expect(recorder.issue({ type: 'stop', unitIds: ['u-player-rifle-1'] }).ok).toBe(true);

    const log = recorder.toLog();
    const serialized = serializeReplay(log);
    const parsed = parseReplay(serialized);

    expect(parsed).toEqual(log);
    expect(parsed.version).toBe(REPLAY_VERSION);
    expect(parsed.currentTick).toBe(25);
    expect(parsed.commands.map((entry) => entry.tick)).toEqual([0, 25]);
    expect(parsed.commands[0]?.command).toMatchObject({
      unitIds: ['u-player-rifle-1', 'u-player-rifle-2'],
    });
    expect(serializeReplay(parsed)).toBe(serialized);
  });

  it('相同日志回放到同一 tick 得到相同完整状态哈希', () => {
    const recorder = createReplayRecorder(1949, 'default');
    expect(recorder.issue({
      type: 'gather', unitIds: ['u-player-harvester'], resourceId: 'r-player-main',
    }).ok).toBe(true);
    expect(recorder.issue({
      type: 'move', unitIds: ['u-player-scout'], target: { x: -18, z: 20 },
    }).ok).toBe(true);
    recorder.stepTicks(180);
    expect(recorder.issue({
      type: 'attackMove', unitIds: ['u-player-scout'], target: { x: 0, z: 0 },
    }).ok).toBe(true);
    recorder.stepTicks(220);

    const log = recorder.toLog();
    const expectedHash = recorder.simulation.hashState();
    const first = replay(log);
    const second = replayFromJSON(recorder.serialize());

    expect(first.currentTick).toBe(log.currentTick);
    expect(first.hash).toBe(expectedHash);
    expect(second.hash).toBe(expectedHash);
    expect(first.simulation.hashState()).toBe(second.simulation.hashState());
  });

  it('repair 命令通过严格解析、roundtrip 与确定性回放', () => {
    const recorder = createReplayRecorder(303, 'combat');
    expect(recorder.issue({
      type: 'attack',
      unitIds: ['u-fixture-player'],
      targetId: 'u-fixture-enemy',
    }).ok).toBe(true);
    recorder.stepTicks(200);
    const damaged = recorder.simulation.state.units.find((unit) => unit.id === 'u-fixture-player');
    expect(damaged?.hp).toBeLessThan(damaged?.maxHp ?? 0);
    expect(recorder.issue({
      type: 'repair',
      unitIds: ['u-player-engineer'],
      targetId: 'u-fixture-player',
    }).ok).toBe(true);

    const serialized = recorder.serialize();
    const parsed = parseReplay(serialized);
    expect(parsed.commands).toHaveLength(2);
    expect(parsed.commands[1]?.command).toEqual({
      type: 'repair',
      unitIds: ['u-player-engineer'],
      targetId: 'u-fixture-player',
    });
    expect(serializeReplay(parsed)).toBe(serialized);
    expect(replay(parsed).hash).toBe(recorder.simulation.hashState());

    const missingTarget = JSON.parse(serialized) as Record<string, unknown>;
    const entries = missingTarget.commands as Array<Record<string, unknown>>;
    const command = entries[0]?.command as Record<string, unknown>;
    delete command.targetId;
    expect(() => parseReplay(JSON.stringify(missingTarget))).toThrow(/缺少字段 targetId/u);
  });

  it('v3 新命令严格 roundtrip，并拒绝缺字段与多余字段', () => {
    const serialized = serializeReplay({
      format: REPLAY_FORMAT,
      version: REPLAY_VERSION,
      seed: 808,
      fixture: 'default',
      currentTick: 7,
      commands: [
        { tick: 7, sequence: 0, command: { type: 'research', kind: 'efficientRefining' } },
        { tick: 7, sequence: 1, command: { type: 'cancelConstruction', buildingId: 'building-1' } },
        { tick: 7, sequence: 2, command: { type: 'cancelProduction', buildingId: 'factory-1' } },
        { tick: 7, sequence: 3, command: { type: 'cancelResearch' } },
      ],
    });
    const parsed = parseReplay(serialized);

    expect(parsed.commands.map((entry) => entry.command)).toEqual([
      { type: 'research', kind: 'efficientRefining' },
      { type: 'cancelConstruction', buildingId: 'building-1' },
      { type: 'cancelProduction', buildingId: 'factory-1' },
      { type: 'cancelResearch' },
    ]);
    expect(serializeReplay(parsed)).toBe(serialized);

    for (const [index, field] of [[0, 'kind'], [1, 'buildingId'], [2, 'buildingId']] as const) {
      const damaged = JSON.parse(serialized) as Record<string, unknown>;
      const entries = damaged.commands as Array<Record<string, unknown>>;
      const command = entries[index]?.command as Record<string, unknown>;
      delete command[field];
      expect(() => parseReplay(JSON.stringify(damaged))).toThrow(new RegExp(`缺少字段 ${field}`, 'u'));
    }

    const extraField = JSON.parse(serialized) as Record<string, unknown>;
    const entries = extraField.commands as Array<Record<string, unknown>>;
    const cancelResearch = entries[3]?.command as Record<string, unknown>;
    cancelResearch.buildingId = 'not-allowed';
    expect(() => parseReplay(JSON.stringify(extraField))).toThrow(/包含未知字段 buildingId/u);

    const unknownTechnology = JSON.parse(serialized) as Record<string, unknown>;
    const unknownEntries = unknownTechnology.commands as Array<Record<string, unknown>>;
    const research = unknownEntries[0]?.command as Record<string, unknown>;
    research.kind = 'futureTechnology';
    expect(() => parseReplay(JSON.stringify(unknownTechnology))).toThrow(/包含未知科技类型 futureTechnology/u);
  });

  it('v3 新命令在同 tick 保持录入顺序并回放到相同 hash', () => {
    const recorder = createReplayRecorder(909);
    expect(recorder.issue({ type: 'research', kind: 'efficientRefining' }).ok).toBe(true);
    expect(recorder.issue({ type: 'cancelResearch' }).ok).toBe(true);
    expect(recorder.issue({
      type: 'produce', buildingId: 'b-player-barracks', unitKind: 'rifle',
    }).ok).toBe(true);
    expect(recorder.issue({ type: 'cancelProduction', buildingId: 'b-player-barracks' }).ok).toBe(true);

    const existingBuildingIds = new Set(recorder.simulation.state.buildings.map((building) => building.id));
    expect(recorder.issue({
      type: 'build', kind: 'reactor', position: { x: -67, z: 58 }, rotation: 0,
    }).ok).toBe(true);
    const construction = recorder.simulation.state.buildings.find(
      (building) => !existingBuildingIds.has(building.id),
    );
    expect(construction).toBeDefined();
    if (!construction) throw new Error('测试未创建施工建筑');
    expect(recorder.issue({ type: 'cancelConstruction', buildingId: construction.id }).ok).toBe(true);

    const log = recorder.toLog();
    expect(log.commands.map((entry) => [entry.tick, entry.sequence, entry.command.type])).toEqual([
      [0, 0, 'research'],
      [0, 1, 'cancelResearch'],
      [0, 2, 'produce'],
      [0, 3, 'cancelProduction'],
      [0, 4, 'build'],
      [0, 5, 'cancelConstruction'],
    ]);
    expect(replayFromJSON(recorder.serialize()).hash).toBe(recorder.simulation.hashState());
  });

  it('拒绝损坏 JSON、未知字段、损坏命令和不兼容版本', () => {
    const recorder = createReplayRecorder(5);
    expect(recorder.issue({
      type: 'move', unitIds: ['u-player-scout'], target: { x: -10, z: 10 },
    }).ok).toBe(true);
    const valid = JSON.parse(recorder.serialize()) as Record<string, unknown>;

    expect(() => parseReplay('{broken')).toThrow(ReplayFormatError);

    const incompatible = { ...valid, version: REPLAY_VERSION + 1 };
    expect(() => parseReplay(JSON.stringify(incompatible))).toThrow(ReplayVersionError);
    expect(() => parseReplay(JSON.stringify({ ...valid, version: 1 }))).toThrow(ReplayVersionError);
    expect(() => parseReplay(JSON.stringify({ ...valid, version: 2 }))).toThrow(ReplayVersionError);

    const unknownRoot = { ...valid, injected: true };
    expect(() => parseReplay(JSON.stringify(unknownRoot))).toThrow(/未知字段 injected/u);

    const damagedCommand = structuredClone(valid);
    const commands = damagedCommand.commands as Array<Record<string, unknown>>;
    const firstEntry = commands[0];
    if (!firstEntry) throw new Error('测试日志缺少命令');
    const command = firstEntry.command as Record<string, unknown>;
    command.target = { x: 'invalid', z: 10 };
    expect(() => parseReplay(JSON.stringify(damagedCommand))).toThrow(/必须是有限数字/u);
  });

  it('同 tick 命令按 sequence 稳定恢复录入顺序', () => {
    const recorder = createReplayRecorder(11);
    expect(recorder.issue({
      type: 'move', unitIds: ['u-player-scout'], target: { x: -10, z: 10 },
    }).ok).toBe(true);
    expect(recorder.issue({ type: 'stop', unitIds: ['u-player-scout'] }).ok).toBe(true);

    const log = recorder.toLog();
    expect(log.commands.map((entry) => [entry.tick, entry.sequence, entry.command.type])).toEqual([
      [0, 0, 'move'],
      [0, 1, 'stop'],
    ]);

    const reversedJSON = JSON.stringify({ ...log, commands: [...log.commands].reverse() });
    const normalized = parseReplay(reversedJSON);
    expect(normalized.commands.map((entry) => entry.command.type)).toEqual(['move', 'stop']);
    const result = replay(normalized);
    expect(result.simulation.state.units.find((unit) => unit.id === 'u-player-scout')?.order.type).toBe('idle');

    const opposite = createReplayRecorder(11);
    expect(opposite.issue({ type: 'stop', unitIds: ['u-player-scout'] }).ok).toBe(true);
    expect(opposite.issue({
      type: 'move', unitIds: ['u-player-scout'], target: { x: -10, z: 10 },
    }).ok).toBe(true);
    expect(replay(opposite.toLog()).simulation.state.units.find(
      (unit) => unit.id === 'u-player-scout',
    )?.order.type).toBe('move');
  });

  it('v3 防御塔建造命令严格回放并保留权威状态哈希', () => {
    const recorder = createReplayRecorder(812);
    expect(recorder.issue({
      type: 'build', kind: 'sentry', position: { x: -67, z: 58 }, rotation: 0,
    }).ok).toBe(true);
    expect(recorder.issue({
      type: 'build', kind: 'cannon', position: { x: -61, z: 68 }, rotation: Math.PI / 2,
    }).ok).toBe(true);
    recorder.stepTicks(80);

    const parsed = parseReplay(recorder.serialize());
    expect(parsed.version).toBe(3);
    expect(parsed.commands.map((entry) => entry.command)).toEqual([
      { type: 'build', kind: 'sentry', position: { x: -67, z: 58 }, rotation: 0 },
      { type: 'build', kind: 'cannon', position: { x: -61, z: 68 }, rotation: Math.PI / 2 },
    ]);
    expect(replay(parsed).hash).toBe(recorder.simulation.hashState());
  });
});
