import { describe, expect, it } from 'vitest';

import {
  createInitialAIPlannerMemory,
  planAI,
  type AIPlannerBuildingSummary,
  type AIPlannerInput,
  type AIPlannerUnitSummary,
} from './ai-planner';
import type { BuildingKind, UnitKind } from './types';

const unit = (
  id: string,
  kind: UnitKind,
  combatPower: number,
  x = 0,
  z = 0,
  hpRatio = 1,
): AIPlannerUnitSummary => ({ id, kind, combatPower, hpRatio, position: { x, z } });

const building = (
  id: string,
  kind: BuildingKind,
  x: number,
  z: number,
  hpRatio = 1,
): AIPlannerBuildingSummary => ({ id, kind, position: { x, z }, hpRatio, operational: true });

const completeBase = (): AIPlannerBuildingSummary[] => [
  building('own-hq', 'hq', -45, 38),
  building('own-reactor', 'reactor', -56, 39),
  building('own-refinery', 'refinery', -47, 26),
  building('own-barracks', 'barracks', -36, 42),
  building('own-factory', 'factory', -34, 31),
];

const defaultUnits = (): AIPlannerUnitSummary[] => [
  unit('harvester-b', 'harvester', 0, -47, 25),
  unit('harvester-a', 'harvester', 0, -48, 24),
  unit('unit-rifle', 'rifle', 2, -12, 8),
  unit('unit-antitank', 'antitank', 2, -11, 7),
  unit('unit-tank', 'tank', 2, -10, 6),
];

const attackForce = (): AIPlannerUnitSummary[] => [
  unit('unit-z-tank', 'tank', 2, -5, 4),
  unit('unit-a-rifle', 'rifle', 2, -7, 4),
  unit('unit-c-antitank', 'antitank', 2, -6, 5),
  unit('unit-b-scout', 'scout', 2, -5, 5),
  unit('unit-f-artillery', 'artillery', 2, -8, 6),
  unit('unit-d-suppressor', 'suppressor', 2, -7, 6),
  unit('harvester-a', 'harvester', 0, -44, 25),
  unit('harvester-b', 'harvester', 0, -45, 25),
];

const makeInput = (overrides: Partial<AIPlannerInput> = {}): AIPlannerInput => ({
  tick: 200,
  credits: 3000,
  incomePerMinute: 1200,
  powerRatio: 1,
  bandwidthUsed: 32,
  bandwidthCap: 80,
  baseHealthRatio: 1,
  basePosition: { x: -45, z: 38 },
  rallyPoint: { x: -8, z: 6 },
  ownUnits: defaultUnits(),
  enemyUnits: [],
  ownBuildings: completeBase(),
  enemyBuildings: [building('enemy-hq', 'hq', 45, -38)],
  expansionSites: [],
  threat: { score: 0, position: null, sourceIds: [] },
  memory: createInitialAIPlannerMemory(0, 'rally'),
  timing: {
    minStateDwellTicks: 20,
    attackCooldownTicks: 20,
    buildCooldownTicks: 10,
    trainCooldownTicks: 5,
    orderCooldownTicks: 5,
  },
  tuning: {
    minAttackPower: 10,
    minAttackUnits: 6,
  },
  ...overrides,
});

describe('planAI states', () => {
  it('enters economy and requests missing power infrastructure', () => {
    const input = makeInput({
      ownBuildings: [building('own-hq', 'hq', -45, 38)],
      ownUnits: [unit('harvester', 'harvester', 0, -44, 30)],
      memory: createInitialAIPlannerMemory(0, 'economy'),
    });

    const result = planAI(input);

    expect(result.state).toBe('economy');
    expect(result.reason).toBe('power_infrastructure_needed');
    expect(result.intents).toContainEqual(expect.objectContaining({ type: 'build', kind: 'reactor' }));
  });

  it('rallies an incomplete mixed force without harvesters', () => {
    const result = planAI(makeInput());
    const rally = result.intents.find((intent) => intent.type === 'rally');

    expect(result.state).toBe('rally');
    expect(rally).toEqual(expect.objectContaining({
      type: 'rally',
      unitIds: ['unit-antitank', 'unit-rifle', 'unit-tank'],
      position: { x: -8, z: 6 },
    }));
  });

  it('attacks with a mixed force and resolves equal targets by stable id', () => {
    const input = makeInput({
      ownUnits: attackForce(),
      enemyBuildings: [
        building('target-z', 'factory', 30, -20, 1),
        building('target-a', 'factory', 30, -20, 1),
      ],
    });
    const result = planAI(input);
    const attack = result.intents.find((intent) => intent.type === 'attack');

    expect(result.state).toBe('attack');
    expect(attack).toEqual(expect.objectContaining({
      targetId: 'target-a',
      unitIds: [
        'unit-a-rifle',
        'unit-b-scout',
        'unit-c-antitank',
        'unit-d-suppressor',
        'unit-f-artillery',
        'unit-z-tank',
      ],
    }));
  });

  it('enters defend immediately for a base incursion even during dwell', () => {
    const input = makeInput({
      enemyUnits: [unit('enemy-tank', 'tank', 4, -42, 36)],
      threat: { score: 0.9, position: { x: -42, z: 36 }, sourceIds: ['enemy-tank'] },
      memory: { ...createInitialAIPlannerMemory(195, 'economy'), stateEnteredTick: 195 },
    });
    const result = planAI(input);

    expect(result.state).toBe('defend');
    expect(result.intents).toContainEqual(expect.objectContaining({ type: 'attack', targetId: 'enemy-tank' }));
  });

  it('enters recover and prioritizes repairing a damaged headquarters', () => {
    const damagedBase = completeBase().map((item) => item.kind === 'hq' ? { ...item, hpRatio: 0.3 } : item);
    const input = makeInput({
      baseHealthRatio: 0.3,
      ownBuildings: damagedBase,
      ownUnits: [...defaultUnits(), unit('engineer-a', 'engineer', 0, -43, 37)],
    });
    const result = planAI(input);

    expect(result.state).toBe('recover');
    expect(result.intents).toContainEqual({
      type: 'repair',
      unitIds: ['engineer-a'],
      targetId: 'own-hq',
      priority: 96,
    });
  });
});

describe('planAI deterministic guards', () => {
  it('returns byte-for-byte equivalent plans for the same summary and memory', () => {
    const input = makeInput({
      ownUnits: attackForce(),
      enemyBuildings: [
        building('target-z', 'factory', 30, -20),
        building('target-a', 'factory', 30, -20),
      ],
    });

    expect(planAI(input)).toEqual(planAI(input));
  });

  it('keeps a live committed target instead of oscillating to a new higher score', () => {
    const memory = {
      ...createInitialAIPlannerMemory(0, 'attack'),
      targetId: 'committed-factory',
    };
    const result = planAI(makeInput({
      ownUnits: attackForce(),
      memory,
      enemyBuildings: [
        building('committed-factory', 'factory', 28, -18),
        building('new-hq', 'hq', 24, -14),
      ],
    }));

    expect(result.state).toBe('attack');
    expect(result.memory.targetId).toBe('committed-factory');
    expect(result.intents).toContainEqual(expect.objectContaining({
      type: 'attack',
      targetId: 'committed-factory',
    }));
  });

  it('clears a remembered target and emits no attack without visible enemies', () => {
    const memory = {
      ...createInitialAIPlannerMemory(195, 'attack'),
      targetId: 'last-seen-target',
    };
    const result = planAI(makeInput({
      tick: 200,
      ownUnits: attackForce(),
      enemyUnits: [],
      enemyBuildings: [],
      memory,
      completedResearch: ['efficientRefining', 'compositeArmor', 'signalAmplifier'],
    }));

    expect(result.memory.targetId).toBeNull();
    expect(result.intents.some((intent) => intent.type === 'attack')).toBe(false);
  });

  it('honors minimum state dwell before a non-emergency attack transition', () => {
    const memory = { ...createInitialAIPlannerMemory(195, 'rally'), stateEnteredTick: 195 };
    const held = planAI(makeInput({ tick: 214, ownUnits: attackForce(), memory }));
    const released = planAI(makeInput({ tick: 215, ownUnits: attackForce(), memory }));

    expect(held.state).toBe('rally');
    expect(held.reason).toMatch(/^minimum_dwell:rally:/);
    expect(released.state).toBe('attack');
  });

  it('keeps a rebuilt force in rally until the attack cooldown expires', () => {
    const memory = {
      ...createInitialAIPlannerMemory(0, 'rally'),
      lastAttackTick: 195,
    };
    const cooling = planAI(makeInput({ tick: 214, ownUnits: attackForce(), memory }));
    const ready = planAI(makeInput({ tick: 215, ownUnits: attackForce(), memory }));

    expect(cooling.state).toBe('rally');
    expect(cooling.reason).toBe('attack_cooldown');
    expect(ready.state).toBe('attack');
  });

  it('selects the highest-value safe expansion deterministically', () => {
    const input = makeInput({
      bandwidthCap: 65,
      expansionSites: [
        { id: 'site-a', position: { x: -50, z: -25 }, resourceValue: 20000, safe: true, occupiedBy: null, hasRelay: false, hasRefinery: false },
        { id: 'site-b', position: { x: 48, z: 24 }, resourceValue: 30000, safe: true, occupiedBy: null, hasRelay: false, hasRefinery: false },
        { id: 'site-danger', position: { x: 0, z: 40 }, resourceValue: 50000, safe: false, occupiedBy: null, hasRelay: false, hasRefinery: false },
      ],
    });
    const result = planAI(input);

    expect(result.state).toBe('economy');
    expect(result.reason).toBe('safe_resource_expansion');
    expect(result.intents).toContainEqual({
      type: 'build',
      kind: 'relay',
      position: { x: 48, z: 24 },
      siteId: 'site-b',
      priority: 80,
    });
  });
});

describe('planAI relay saturation', () => {
  it('stops relay planning at the hard bandwidth cap while preserving an attack', () => {
    const result = planAI(makeInput({
      bandwidthCap: 80,
      bandwidthUsed: 78,
      ownUnits: attackForce(),
      expansionSites: [
        { id: 'site-open', position: { x: 32, z: 18 }, resourceValue: 40_000, safe: true, occupiedBy: null, hasRelay: false, hasRefinery: false },
      ],
    }));

    expect(result.state).toBe('attack');
    expect(result.intents).toContainEqual(expect.objectContaining({
      type: 'attack',
      targetId: 'enemy-hq',
    }));
    expect(result.intents.some((intent) => intent.type === 'build' && intent.kind === 'relay')).toBe(false);
  });

  it('does not duplicate a relay while one is non-operational', () => {
    const pendingRelay = {
      ...building('relay-under-construction', 'relay', -45, 52),
      operational: false,
    };
    const input = makeInput({
      bandwidthCap: 65,
      bandwidthUsed: 62,
      ownBuildings: [...completeBase(), pendingRelay],
    });

    const first = planAI(input);
    const second = planAI(input);

    expect(first).toEqual(second);
    expect(first.state).toBe('rally');
    expect(first.intents).toContainEqual(expect.objectContaining({ type: 'rally' }));
    expect(first.intents.some((intent) => intent.type === 'build' && intent.kind === 'relay')).toBe(false);
  });

  it('does not plan a third relay when two live relays already cover useful capacity', () => {
    const result = planAI(makeInput({
      bandwidthCap: 75,
      bandwidthUsed: 72,
      ownBuildings: [
        ...completeBase(),
        building('relay-a', 'relay', -45, 52),
        building('relay-b', 'relay', -31, 52),
      ],
    }));

    expect(result.state).toBe('rally');
    expect(result.intents.some((intent) => intent.type === 'build' && intent.kind === 'relay')).toBe(false);
  });

  it('still plans one relay below the cap when no relay is pending or sufficient', () => {
    const result = planAI(makeInput({
      bandwidthCap: 65,
      bandwidthUsed: 62,
      memory: createInitialAIPlannerMemory(0, 'economy'),
    }));

    expect(result.state).toBe('economy');
    expect(result.reason).toBe('bandwidth_expansion_needed');
    expect(result.intents).toContainEqual(expect.objectContaining({
      type: 'build',
      kind: 'relay',
      priority: 84,
    }));
  });
});

describe('planAI research decisions', () => {
  it('uses the deterministic refining, armor, then signal priority', () => {
    const first = planAI(makeInput());
    const second = planAI(makeInput({ completedResearch: ['efficientRefining'] }));
    const third = planAI(makeInput({
      completedResearch: ['efficientRefining', 'compositeArmor'],
      ownBuildings: [...completeBase(), building('own-relay', 'relay', -30, 20)],
    }));

    expect(first.intents).toContainEqual({ type: 'research', kind: 'efficientRefining', priority: 78 });
    expect(second.intents).toContainEqual({ type: 'research', kind: 'compositeArmor', priority: 72 });
    expect(third.intents).toContainEqual({ type: 'research', kind: 'signalAmplifier', priority: 66 });
  });

  it('does not propose another research while the slot is active', () => {
    const result = planAI(makeInput({ activeResearch: 'efficientRefining' }));

    expect(result.intents.some((intent) => intent.type === 'research')).toBe(false);
  });

  it('preserves a credit reserve instead of forcing research', () => {
    const result = planAI(makeInput({ credits: 1399 }));

    expect(result.intents.some((intent) => intent.type === 'research')).toBe(false);
  });

  it('never proposes research during emergency defense', () => {
    const result = planAI(makeInput({
      credits: 5000,
      enemyUnits: [unit('enemy-raider', 'scout', 2, -43, 37)],
      threat: { score: 0.95, position: { x: -43, z: 37 }, sourceIds: ['enemy-raider'] },
    }));

    expect(result.state).toBe('defend');
    expect(result.intents.some((intent) => intent.type === 'research')).toBe(false);
  });
});

describe('planAI defensive structures', () => {
  const highThreat = {
    score: 0.9,
    position: { x: -35, z: 34 },
    sourceIds: ['enemy-raider'],
  };

  it('高威胁防守时确定性优先建造唯一哨戒塔', () => {
    const input = makeInput({
      credits: 650,
      enemyUnits: [unit('enemy-raider', 'scout', 2, -35, 34)],
      threat: highThreat,
    });
    const first = planAI(input);
    const second = planAI(input);
    const builds = first.intents.filter((intent) => intent.type === 'build');

    expect(first.state).toBe('defend');
    expect(builds).toHaveLength(1);
    expect(builds[0]).toEqual(expect.objectContaining({
      type: 'build',
      kind: 'sentry',
      priority: 112,
    }));
    expect(first.intents[0]).toEqual(builds[0]);
    expect(second).toEqual(first);
  });

  it('哨戒塔资金不足或已有存活实例时不重复规划', () => {
    const noMoney = planAI(makeInput({
      credits: 649,
      enemyUnits: [unit('enemy-raider', 'scout', 2, -35, 34)],
      threat: highThreat,
    }));
    const existing = planAI(makeInput({
      credits: 5_000,
      enemyUnits: [unit('enemy-raider', 'scout', 2, -35, 34)],
      threat: highThreat,
      ownBuildings: [
        ...completeBase(),
        { ...building('sentry-under-construction', 'sentry', -31, 40), operational: false },
      ],
    }));

    expect(noMoney.intents.some((intent) => intent.type === 'build' && intent.kind === 'sentry')).toBe(false);
    expect(existing.intents.some((intent) => intent.type === 'build' && intent.kind === 'sentry')).toBe(false);
  });

  it('经济稳定、工厂与电力充足并保留信用储备时至多规划一座重炮塔', () => {
    const input = makeInput({
      credits: 1_850,
      completedResearch: ['efficientRefining', 'compositeArmor', 'signalAmplifier'],
    });
    const result = planAI(input);
    const cannonBuilds = result.intents.filter(
      (intent) => intent.type === 'build' && intent.kind === 'cannon',
    );

    expect(result.state).toBe('rally');
    expect(cannonBuilds).toEqual([
      expect.objectContaining({ type: 'build', kind: 'cannon', priority: 74 }),
    ]);
  });

  it('重炮塔不挪用储备，且缺工厂、低电力或已有实例时不规划', () => {
    const completedResearch = ['efficientRefining', 'compositeArmor', 'signalAmplifier'] as const;
    const variants: AIPlannerInput[] = [
      makeInput({ credits: 1_849, completedResearch }),
      makeInput({ credits: 5_000, powerRatio: 0.94, completedResearch }),
      makeInput({
        credits: 5_000,
        completedResearch,
        ownBuildings: completeBase().filter((item) => item.kind !== 'factory'),
      }),
      makeInput({
        credits: 5_000,
        completedResearch,
        ownBuildings: [...completeBase(), building('own-cannon', 'cannon', -59, 27)],
      }),
    ];

    for (const input of variants) {
      expect(planAI(input).intents.some(
        (intent) => intent.type === 'build' && intent.kind === 'cannon',
      )).toBe(false);
    }
  });
});
