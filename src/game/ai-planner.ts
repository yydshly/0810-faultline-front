import type { BuildingKind, UnitKind, Vec2 } from './types';

export type AIPlannerState = 'economy' | 'rally' | 'attack' | 'defend' | 'recover';
export type AIResearchKind = 'efficientRefining' | 'compositeArmor' | 'signalAmplifier';

export interface AIPlannerUnitSummary {
  id: string;
  kind: UnitKind;
  position: Vec2;
  hpRatio: number;
  /** Relative high-level strength supplied by the simulation adapter. */
  combatPower: number;
}

export interface AIPlannerBuildingSummary {
  id: string;
  kind: BuildingKind;
  position: Vec2;
  hpRatio: number;
  operational?: boolean;
}

export interface AIExpansionSiteSummary {
  id: string;
  position: Vec2;
  resourceValue: number;
  safe: boolean;
  occupiedBy: 'self' | 'enemy' | null;
  hasRelay: boolean;
  hasRefinery: boolean;
}

export interface AIThreatSummary {
  /** Normalized strategic danger, normally in the 0..1 range. */
  score: number;
  position: Vec2 | null;
  sourceIds: string[];
}

export interface AIPlannerMemory {
  state: AIPlannerState;
  stateEnteredTick: number;
  lastAttackTick: number;
  lastBuildTick: number;
  lastTrainTick: number;
  lastOrderTick: number;
  targetId: string | null;
}

export interface AIPlannerTiming {
  minStateDwellTicks: number;
  attackCooldownTicks: number;
  buildCooldownTicks: number;
  trainCooldownTicks: number;
  orderCooldownTicks: number;
}

export interface AIPlannerTuning {
  defendThreatThreshold: number;
  defendExitThreat: number;
  defenseRadius: number;
  recoverBaseHealthThreshold: number;
  recoverArmyHealthThreshold: number;
  recoverExitBaseHealth: number;
  recoverExitArmyHealth: number;
  minAttackPower: number;
  minAttackUnits: number;
  desiredHarvesters: number;
  bandwidthReserve: number;
}

export interface AIPlannerInput {
  tick: number;
  credits: number;
  incomePerMinute: number;
  powerRatio: number;
  bandwidthUsed: number;
  bandwidthCap: number;
  baseHealthRatio: number;
  basePosition: Vec2;
  rallyPoint: Vec2;
  ownUnits: AIPlannerUnitSummary[];
  enemyUnits: AIPlannerUnitSummary[];
  ownBuildings: AIPlannerBuildingSummary[];
  enemyBuildings: AIPlannerBuildingSummary[];
  expansionSites: AIExpansionSiteSummary[];
  threat: AIThreatSummary;
  memory: AIPlannerMemory;
  completedResearch?: readonly AIResearchKind[];
  activeResearch?: AIResearchKind | null;
  timing?: Partial<AIPlannerTiming>;
  tuning?: Partial<AIPlannerTuning>;
}

export type AIPlannerIntent =
  | { type: 'build'; kind: BuildingKind; position: Vec2; siteId?: string; priority: number }
  | { type: 'train'; kind: UnitKind; producerId: string; priority: number }
  | { type: 'move'; unitIds: string[]; position: Vec2; priority: number }
  | { type: 'attack'; unitIds: string[]; targetId: string; position: Vec2; priority: number }
  | { type: 'repair'; unitIds: string[]; targetId: string; priority: number }
  | { type: 'rally'; unitIds: string[]; position: Vec2; priority: number }
  | { type: 'research'; kind: AIResearchKind; priority: number };

export interface AIPlannerResult {
  state: AIPlannerState;
  reason: string;
  intents: AIPlannerIntent[];
  memory: AIPlannerMemory;
}

export const DEFAULT_AI_PLANNER_TIMING: Readonly<AIPlannerTiming> = {
  minStateDwellTicks: 80,
  attackCooldownTicks: 600,
  buildCooldownTicks: 80,
  trainCooldownTicks: 20,
  orderCooldownTicks: 20,
};

export const DEFAULT_AI_PLANNER_TUNING: Readonly<AIPlannerTuning> = {
  defendThreatThreshold: 0.55,
  defendExitThreat: 0.25,
  defenseRadius: 20,
  recoverBaseHealthThreshold: 0.42,
  recoverArmyHealthThreshold: 0.46,
  recoverExitBaseHealth: 0.72,
  recoverExitArmyHealth: 0.66,
  minAttackPower: 10,
  minAttackUnits: 6,
  desiredHarvesters: 2,
  bandwidthReserve: 8,
};

const UNIT_COST: Record<UnitKind, number> = {
  scout: 260,
  rifle: 180,
  antitank: 260,
  engineer: 220,
  suppressor: 450,
  tank: 700,
  artillery: 850,
  harvester: 800,
};

const BUILDING_COST: Record<BuildingKind, number> = {
  hq: Number.POSITIVE_INFINITY,
  reactor: 600,
  refinery: 1800,
  barracks: 800,
  factory: 2000,
  relay: 600,
  sentry: 650,
  cannon: 1250,
};

interface ResearchRule {
  kind: AIResearchKind;
  cost: number;
  requiredBuilding: BuildingKind;
  priority: number;
}

const RESEARCH_CREDIT_RESERVE = 600;
// The runtime caps command bandwidth at 80. A headquarters supplies 60 and two
// connected relays already cover the remaining useful capacity, so further
// relay plans can never solve a bandwidth shortage.
const HARD_BANDWIDTH_CAP = 80;
const MAX_USEFUL_RELAY_COUNT = 2;
const RESEARCH_RULES: readonly ResearchRule[] = [
  { kind: 'efficientRefining', cost: 800, requiredBuilding: 'refinery', priority: 78 },
  { kind: 'compositeArmor', cost: 1200, requiredBuilding: 'factory', priority: 72 },
  { kind: 'signalAmplifier', cost: 1000, requiredBuilding: 'relay', priority: 66 },
];

const PRODUCER_KIND: Record<UnitKind, BuildingKind> = {
  scout: 'factory',
  rifle: 'barracks',
  antitank: 'barracks',
  engineer: 'barracks',
  suppressor: 'factory',
  tank: 'factory',
  artillery: 'factory',
  harvester: 'refinery',
};

const UNIT_TARGET_PRIORITY: Record<UnitKind, number> = {
  scout: 55,
  rifle: 62,
  antitank: 92,
  engineer: 42,
  suppressor: 84,
  tank: 108,
  artillery: 132,
  harvester: 96,
};

const BUILDING_TARGET_PRIORITY: Record<BuildingKind, number> = {
  hq: 155,
  reactor: 102,
  refinery: 116,
  barracks: 94,
  factory: 124,
  relay: 76,
  sentry: 136,
  cannon: 148,
};

const BUILD_OFFSETS: Record<BuildingKind, Vec2> = {
  hq: { x: 0, z: 0 },
  reactor: { x: -10, z: 1 },
  refinery: { x: -3, z: -12 },
  barracks: { x: 9, z: 4 },
  factory: { x: 11, z: -7 },
  relay: { x: 0, z: 14 },
  sentry: { x: 15, z: 10 },
  cannon: { x: -14, z: -11 },
};

const DEFENSE_SENTRY_PRIORITY = 112;
const STABLE_CANNON_PRIORITY = 74;
const STABLE_ECONOMY_POWER_RATIO = 0.95;

interface ForceAnalysis {
  combatUnits: AIPlannerUnitSummary[];
  engineerIds: string[];
  harvesters: number;
  combatPower: number;
  armyHealth: number;
  counts: Record<UnitKind, number>;
}

interface StateChoice {
  state: AIPlannerState;
  reason: string;
  emergency: boolean;
}

interface TargetCandidate {
  id: string;
  position: Vec2;
  hpRatio: number;
  priority: number;
  isThreatSource: boolean;
}

const compareId = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

const squaredDistance = (left: Vec2, right: Vec2): number => {
  const dx = left.x - right.x;
  const dz = left.z - right.z;
  return dx * dx + dz * dz;
};

const sortedIds = (units: AIPlannerUnitSummary[]): string[] =>
  units.map((unit) => unit.id).sort(compareId);

const operational = (building: AIPlannerBuildingSummary): boolean => building.operational !== false && building.hpRatio > 0;

const canPlanRelay = (input: AIPlannerInput): boolean => {
  const relays = input.ownBuildings.filter((building) => building.kind === 'relay' && building.hpRatio > 0);
  if (input.bandwidthCap >= HARD_BANDWIDTH_CAP) return false;
  if (relays.length >= MAX_USEFUL_RELAY_COUNT) return false;
  return !relays.some((relay) => !operational(relay));
};

export function createInitialAIPlannerMemory(tick = 0, state: AIPlannerState = 'economy'): AIPlannerMemory {
  return {
    state,
    stateEnteredTick: tick,
    lastAttackTick: Number.MIN_SAFE_INTEGER,
    lastBuildTick: Number.MIN_SAFE_INTEGER,
    lastTrainTick: Number.MIN_SAFE_INTEGER,
    lastOrderTick: Number.MIN_SAFE_INTEGER,
    targetId: null,
  };
}

/** Pure, deterministic strategic planner. It does not mutate the input or memory. */
export function planAI(input: AIPlannerInput): AIPlannerResult {
  const timing: AIPlannerTiming = { ...DEFAULT_AI_PLANNER_TIMING, ...input.timing };
  const tuning: AIPlannerTuning = { ...DEFAULT_AI_PLANNER_TUNING, ...input.tuning };
  const force = analyzeForce(input.ownUnits);
  const desired = chooseState(input, force, timing, tuning);
  const dwellElapsed = input.tick - input.memory.stateEnteredTick;
  const heldByDwell = desired.state !== input.memory.state
    && dwellElapsed < timing.minStateDwellTicks
    && !desired.emergency;
  const state = heldByDwell ? input.memory.state : desired.state;
  const reason = heldByDwell
    ? `minimum_dwell:${input.memory.state}:${timing.minStateDwellTicks - dwellElapsed}`
    : desired.reason;
  const transitioned = state !== input.memory.state;

  const target = state === 'attack' || state === 'defend'
    ? selectTarget(input, state, input.memory.targetId)
    : null;
  const intents = createIntents(input, force, state, target, transitioned, timing, tuning);
  const memory: AIPlannerMemory = {
    ...input.memory,
    state,
    stateEnteredTick: transitioned ? input.tick : input.memory.stateEnteredTick,
    targetId: target?.id ?? (targetStillExists(input, input.memory.targetId) ? input.memory.targetId : null),
  };

  if (transitioned && state === 'attack') memory.lastAttackTick = input.tick;
  if (intents.some((intent) => intent.type === 'build')) memory.lastBuildTick = input.tick;
  if (intents.some((intent) => intent.type === 'train')) memory.lastTrainTick = input.tick;
  if (intents.some((intent) => intent.type === 'move' || intent.type === 'attack' || intent.type === 'rally')) {
    memory.lastOrderTick = input.tick;
  }

  return { state, reason, intents, memory };
}

const analyzeForce = (units: AIPlannerUnitSummary[]): ForceAnalysis => {
  const counts: Record<UnitKind, number> = {
    scout: 0,
    rifle: 0,
    antitank: 0,
    engineer: 0,
    suppressor: 0,
    tank: 0,
    artillery: 0,
    harvester: 0,
  };
  const combatUnits: AIPlannerUnitSummary[] = [];
  const engineerIds: string[] = [];
  let harvesters = 0;
  let combatPower = 0;
  let weightedHealth = 0;
  let healthWeight = 0;

  for (const unit of units) {
    if (unit.hpRatio <= 0) continue;
    counts[unit.kind] += 1;
    if (unit.kind === 'harvester') {
      harvesters += 1;
      continue;
    }
    if (unit.kind === 'engineer') engineerIds.push(unit.id);
    if (unit.combatPower <= 0) continue;
    combatUnits.push(unit);
    const effectivePower = unit.combatPower * Math.max(0, unit.hpRatio);
    combatPower += effectivePower;
    weightedHealth += Math.max(0, unit.hpRatio) * unit.combatPower;
    healthWeight += unit.combatPower;
  }

  combatUnits.sort((left, right) => compareId(left.id, right.id));
  engineerIds.sort(compareId);
  return {
    combatUnits,
    engineerIds,
    harvesters,
    combatPower,
    armyHealth: healthWeight > 0 ? weightedHealth / healthWeight : 1,
    counts,
  };
};

const chooseState = (
  input: AIPlannerInput,
  force: ForceAnalysis,
  timing: AIPlannerTiming,
  tuning: AIPlannerTuning,
): StateChoice => {
  const nearestEnemyDistanceSquared = input.enemyUnits.reduce(
    (nearest, enemy) => Math.min(nearest, squaredDistance(enemy.position, input.basePosition)),
    Number.POSITIVE_INFINITY,
  );
  const baseIncursion = nearestEnemyDistanceSquared <= tuning.defenseRadius * tuning.defenseRadius;
  const defendThreshold = input.memory.state === 'defend'
    ? tuning.defendExitThreat
    : tuning.defendThreatThreshold;
  if (input.threat.score >= defendThreshold || baseIncursion) {
    return { state: 'defend', reason: baseIncursion ? 'enemy_inside_defense_radius' : 'base_under_threat', emergency: true };
  }

  const isRecovering = input.memory.state === 'recover';
  const baseRecoveryThreshold = isRecovering ? tuning.recoverExitBaseHealth : tuning.recoverBaseHealthThreshold;
  const armyRecoveryThreshold = isRecovering ? tuning.recoverExitArmyHealth : tuning.recoverArmyHealthThreshold;
  const damagedForce = force.combatUnits.length >= 2 && force.armyHealth < armyRecoveryThreshold;
  if (input.baseHealthRatio < baseRecoveryThreshold || damagedForce) {
    return {
      state: 'recover',
      reason: input.baseHealthRatio < baseRecoveryThreshold ? 'base_requires_recovery' : 'army_requires_recovery',
      emergency: input.baseHealthRatio <= 0.2,
    };
  }

  const economyReason = economyNeed(input, force, tuning);
  if (economyReason) return { state: 'economy', reason: economyReason, emergency: false };

  const attackReady = input.memory.state === 'attack'
    || input.tick - input.memory.lastAttackTick >= timing.attackCooldownTicks;
  if (
    force.combatUnits.length >= tuning.minAttackUnits
    && force.combatPower >= tuning.minAttackPower
    && force.armyHealth >= 0.64
    && attackReady
    && (input.enemyUnits.length > 0 || input.enemyBuildings.length > 0)
  ) {
    return { state: 'attack', reason: 'mixed_force_ready', emergency: false };
  }

  return {
    state: 'rally',
    reason: attackReady ? 'assembling_mixed_force' : 'attack_cooldown',
    emergency: false,
  };
};

const economyNeed = (input: AIPlannerInput, force: ForceAnalysis, tuning: AIPlannerTuning): string | null => {
  const has = (kind: BuildingKind): boolean => input.ownBuildings.some((building) => building.kind === kind && operational(building));
  if (!has('reactor') || input.powerRatio < 0.85) return 'power_infrastructure_needed';
  if (!has('refinery')) return 'refinery_needed';
  if (force.harvesters < tuning.desiredHarvesters) return 'harvester_economy_needed';
  if (!has('barracks')) return 'barracks_needed';
  if (!has('factory')) return 'factory_needed';
  if (
    input.bandwidthCap - input.bandwidthUsed < tuning.bandwidthReserve
    && canPlanRelay(input)
  ) return 'bandwidth_expansion_needed';
  const knowsTarget = input.enemyUnits.length > 0 || input.enemyBuildings.length > 0;
  const attackCapable = knowsTarget
    && force.combatPower >= tuning.minAttackPower
    && force.combatUnits.length >= tuning.minAttackUnits;
  if (!attackCapable && selectExpansionSite(input, tuning)) return 'safe_resource_expansion';
  return null;
};

const selectExpansionSite = (input: AIPlannerInput, tuning: AIPlannerTuning): AIExpansionSiteSummary | null => {
  if (input.credits < BUILDING_COST.relay || input.threat.score >= tuning.defendExitThreat) return null;
  const relayPlanAvailable = canPlanRelay(input);
  const candidates = input.expansionSites.filter((site) =>
    site.safe
    && site.occupiedBy !== 'enemy'
    && (!site.hasRelay || !site.hasRefinery)
    && (site.occupiedBy !== 'self' || !site.hasRefinery)
    && (site.hasRelay || relayPlanAvailable),
  );
  candidates.sort((left, right) => {
    if (left.resourceValue !== right.resourceValue) return right.resourceValue - left.resourceValue;
    const leftDistance = squaredDistance(left.position, input.basePosition);
    const rightDistance = squaredDistance(right.position, input.basePosition);
    if (leftDistance !== rightDistance) return leftDistance - rightDistance;
    return compareId(left.id, right.id);
  });
  return candidates[0] ?? null;
};

const createIntents = (
  input: AIPlannerInput,
  force: ForceAnalysis,
  state: AIPlannerState,
  target: TargetCandidate | null,
  transitioned: boolean,
  timing: AIPlannerTiming,
  tuning: AIPlannerTuning,
): AIPlannerIntent[] => {
  const intents: AIPlannerIntent[] = [];
  const buildReady = input.tick - input.memory.lastBuildTick >= timing.buildCooldownTicks;
  const trainReady = input.tick - input.memory.lastTrainTick >= timing.trainCooldownTicks;
  const orderReady = transitioned || input.tick - input.memory.lastOrderTick >= timing.orderCooldownTicks;

  if (state === 'economy') {
    if (buildReady) {
      const build = chooseEconomyBuild(input, force, tuning);
      if (build) intents.push(build);
    }
    if (trainReady && force.harvesters < tuning.desiredHarvesters) {
      const train = createTrainIntent(input, 'harvester', 88);
      if (train) intents.push(train);
    }
    const research = createResearchIntent(input, force, state, tuning, intents);
    if (research) intents.push(research);
    else if (buildReady && !intents.some((intent) => intent.type === 'build')) {
      const cannon = createStableCannonIntent(input, force, tuning);
      if (cannon) intents.push(cannon);
    }
    return intents;
  }

  if (state === 'recover') {
    const repair = createRepairIntent(input, force.engineerIds);
    if (repair) intents.push(repair);
    if (trainReady) {
      const train = force.engineerIds.length === 0
        ? createTrainIntent(input, 'engineer', 94)
        : chooseCompositionTrain(input, force, 76);
      if (train) intents.push(train);
    }
    if (orderReady && force.combatUnits.length > 0) {
      intents.push({ type: 'move', unitIds: sortedIds(force.combatUnits), position: { ...input.rallyPoint }, priority: 82 });
    }
    return intents;
  }

  if (state === 'defend') {
    if (buildReady) {
      const sentry = createDefenseSentryIntent(input, tuning);
      if (sentry) intents.push(sentry);
    }
    const repair = createRepairIntent(input, force.engineerIds);
    if (repair && input.baseHealthRatio < 0.75) intents.push(repair);
    if (trainReady) {
      const train = chooseCompositionTrain(input, force, 84);
      if (train) intents.push(train);
    }
    if (orderReady && force.combatUnits.length > 0) {
      if (target) {
        intents.push({
          type: 'attack',
          unitIds: sortedIds(force.combatUnits),
          targetId: target.id,
          position: { ...target.position },
          priority: 100,
        });
      } else if (input.threat.position) {
        intents.push({ type: 'move', unitIds: sortedIds(force.combatUnits), position: { ...input.threat.position }, priority: 98 });
      }
    }
    return intents;
  }

  if (state === 'rally') {
    if (trainReady) {
      const train = chooseCompositionTrain(input, force, 72);
      if (train) intents.push(train);
    }
    if (orderReady && force.combatUnits.length > 0) {
      intents.push({ type: 'rally', unitIds: sortedIds(force.combatUnits), position: { ...input.rallyPoint }, priority: 68 });
    }
    const research = createResearchIntent(input, force, state, tuning, intents);
    if (research) intents.push(research);
    else if (buildReady) {
      const cannon = createStableCannonIntent(input, force, tuning);
      if (cannon) intents.push(cannon);
    }
    return intents;
  }

  if (orderReady && target && force.combatUnits.length > 0) {
    intents.push({
      type: 'attack',
      unitIds: sortedIds(force.combatUnits),
      targetId: target.id,
      position: { ...target.position },
      priority: 92,
    });
  }
  if (trainReady) {
    const train = chooseCompositionTrain(input, force, 58);
    if (train) intents.push(train);
  }
  const research = createResearchIntent(input, force, state, tuning, intents);
  if (research) intents.push(research);
  else if (buildReady) {
    const cannon = createStableCannonIntent(input, force, tuning);
    if (cannon) intents.push(cannon);
  }
  return intents;
};

const hasLiveBuilding = (input: AIPlannerInput, kind: BuildingKind): boolean =>
  input.ownBuildings.some((building) => building.kind === kind && building.hpRatio > 0);

const createDefenseSentryIntent = (
  input: AIPlannerInput,
  tuning: AIPlannerTuning,
): Extract<AIPlannerIntent, { type: 'build' }> | null => {
  if (input.threat.score < tuning.defendThreatThreshold) return null;
  if (hasLiveBuilding(input, 'sentry') || input.credits < BUILDING_COST.sentry) return null;

  const fallback = {
    x: input.basePosition.x + BUILD_OFFSETS.sentry.x,
    z: input.basePosition.z + BUILD_OFFSETS.sentry.z,
  };
  const threatPosition = input.threat.position;
  if (!threatPosition) {
    return { type: 'build', kind: 'sentry', position: fallback, priority: DEFENSE_SENTRY_PRIORITY };
  }
  const dx = threatPosition.x - input.basePosition.x;
  const dz = threatPosition.z - input.basePosition.z;
  const length = Math.hypot(dx, dz);
  const position = length > 0
    ? { x: input.basePosition.x + dx / length * 16, z: input.basePosition.z + dz / length * 16 }
    : fallback;
  return { type: 'build', kind: 'sentry', position, priority: DEFENSE_SENTRY_PRIORITY };
};

const nextResearchReserve = (input: AIPlannerInput): number => {
  const completed = new Set(input.completedResearch ?? []);
  const next = RESEARCH_RULES.find((rule) =>
    rule.kind !== input.activeResearch
    && !completed.has(rule.kind)
    && input.ownBuildings.some((building) =>
      building.kind === rule.requiredBuilding && operational(building),
    ),
  );
  return RESEARCH_CREDIT_RESERVE + (next?.cost ?? 0);
};

const createStableCannonIntent = (
  input: AIPlannerInput,
  force: ForceAnalysis,
  tuning: AIPlannerTuning,
): Extract<AIPlannerIntent, { type: 'build' }> | null => {
  if (hasLiveBuilding(input, 'cannon')) return null;
  if (input.threat.score > tuning.defendExitThreat || input.baseHealthRatio < 0.7) return null;
  if (input.incomePerMinute <= 0 || input.powerRatio < STABLE_ECONOMY_POWER_RATIO) return null;
  if (force.harvesters < tuning.desiredHarvesters) return null;
  if (input.bandwidthCap - input.bandwidthUsed < tuning.bandwidthReserve) return null;
  if (!input.ownBuildings.some((building) => building.kind === 'factory' && operational(building))) return null;
  if (input.credits < BUILDING_COST.cannon + nextResearchReserve(input)) return null;
  return {
    type: 'build',
    kind: 'cannon',
    position: {
      x: input.basePosition.x + BUILD_OFFSETS.cannon.x,
      z: input.basePosition.z + BUILD_OFFSETS.cannon.z,
    },
    priority: STABLE_CANNON_PRIORITY,
  };
};

const createResearchIntent = (
  input: AIPlannerInput,
  force: ForceAnalysis,
  state: AIPlannerState,
  tuning: AIPlannerTuning,
  pendingIntents: AIPlannerIntent[],
): Extract<AIPlannerIntent, { type: 'research' }> | null => {
  if (state === 'defend' || state === 'recover') return null;
  if (input.activeResearch != null) return null;
  if (pendingIntents.some((intent) => intent.type === 'build')) return null;
  if (input.threat.score > tuning.defendExitThreat) return null;
  if (input.baseHealthRatio < 0.7 || input.powerRatio < 0.95 || input.incomePerMinute <= 0) return null;
  if (force.harvesters < tuning.desiredHarvesters) return null;
  if (input.bandwidthCap - input.bandwidthUsed < tuning.bandwidthReserve) return null;
  const stableInfrastructure: BuildingKind[] = ['reactor', 'refinery', 'barracks', 'factory'];
  if (stableInfrastructure.some((kind) =>
    !input.ownBuildings.some((building) => building.kind === kind && operational(building)),
  )) return null;

  const completed = new Set(input.completedResearch ?? []);
  for (const rule of RESEARCH_RULES) {
    if (completed.has(rule.kind)) continue;
    const hasInfrastructure = input.ownBuildings.some((building) =>
      building.kind === rule.requiredBuilding && operational(building),
    );
    if (!hasInfrastructure) continue;
    if (input.credits < rule.cost + RESEARCH_CREDIT_RESERVE) return null;
    return { type: 'research', kind: rule.kind, priority: rule.priority };
  }
  return null;
};

const chooseEconomyBuild = (
  input: AIPlannerInput,
  force: ForceAnalysis,
  tuning: AIPlannerTuning,
): Extract<AIPlannerIntent, { type: 'build' }> | null => {
  const has = (kind: BuildingKind): boolean => input.ownBuildings.some((building) => building.kind === kind && operational(building));
  const nearBase = (kind: BuildingKind): Vec2 => ({
    x: input.basePosition.x + BUILD_OFFSETS[kind].x,
    z: input.basePosition.z + BUILD_OFFSETS[kind].z,
  });
  const candidate = (kind: BuildingKind, priority: number): Extract<AIPlannerIntent, { type: 'build' }> | null =>
    input.credits >= BUILDING_COST[kind]
      ? { type: 'build', kind, position: nearBase(kind), priority }
      : null;

  if (!has('reactor') || input.powerRatio < 0.85) return candidate('reactor', 100);
  if (!has('refinery')) return candidate('refinery', 98);
  if (!has('barracks')) return candidate('barracks', 90);
  if (!has('factory')) return candidate('factory', 86);
  if (force.harvesters < tuning.desiredHarvesters) return null;
  if (
    input.bandwidthCap - input.bandwidthUsed < tuning.bandwidthReserve
    && canPlanRelay(input)
  ) return candidate('relay', 84);

  const site = selectExpansionSite(input, tuning);
  if (!site) return null;
  const kind: BuildingKind = site.hasRelay ? 'refinery' : 'relay';
  if (input.credits < BUILDING_COST[kind]) return null;
  return { type: 'build', kind, position: { ...site.position }, siteId: site.id, priority: 80 };
};

const chooseCompositionTrain = (
  input: AIPlannerInput,
  force: ForceAnalysis,
  priority: number,
): Extract<AIPlannerIntent, { type: 'train' }> | null => {
  const enemyHeavy = input.enemyUnits.filter((unit) => unit.kind === 'tank' || unit.kind === 'artillery' || unit.kind === 'suppressor').length;
  const desired: UnitKind[] = [];
  if (force.counts.rifle < 2) desired.push('rifle');
  if (force.counts.antitank < Math.max(1, Math.ceil(enemyHeavy / 2))) desired.push('antitank');
  if (force.counts.engineer < 1) desired.push('engineer');
  if (force.counts.scout < 1) desired.push('scout');
  if (force.counts.tank < 2) desired.push('tank');
  if (force.counts.suppressor < 1) desired.push('suppressor');
  if (force.counts.artillery < 1 && force.counts.tank >= 1) desired.push('artillery');
  desired.push('rifle');

  for (const kind of desired) {
    const intent = createTrainIntent(input, kind, priority);
    if (intent) return intent;
  }
  return null;
};

const createTrainIntent = (
  input: AIPlannerInput,
  kind: UnitKind,
  priority: number,
): Extract<AIPlannerIntent, { type: 'train' }> | null => {
  if (input.credits < UNIT_COST[kind]) return null;
  const producerKind = PRODUCER_KIND[kind];
  const producers = input.ownBuildings
    .filter((building) => building.kind === producerKind && operational(building))
    .sort((left, right) => compareId(left.id, right.id));
  const producer = producers[0];
  return producer ? { type: 'train', kind, producerId: producer.id, priority } : null;
};

const createRepairIntent = (
  input: AIPlannerInput,
  engineerIds: string[],
): Extract<AIPlannerIntent, { type: 'repair' }> | null => {
  if (engineerIds.length === 0) return null;
  const candidates = input.ownBuildings
    .filter((building) => building.hpRatio > 0 && building.hpRatio < 0.92)
    .map((building) => ({
      id: building.id,
      score: (building.kind === 'hq' ? 120 : 70) + (1 - building.hpRatio) * 100,
    }));
  candidates.sort((left, right) => right.score - left.score || compareId(left.id, right.id));
  const target = candidates[0];
  return target ? { type: 'repair', unitIds: [...engineerIds], targetId: target.id, priority: 96 } : null;
};

const selectTarget = (
  input: AIPlannerInput,
  state: 'attack' | 'defend',
  preferredId: string | null,
): TargetCandidate | null => {
  const threatIds = new Set(input.threat.sourceIds);
  const candidates: TargetCandidate[] = [
    ...input.enemyUnits.filter((unit) => unit.hpRatio > 0).map((unit) => ({
      id: unit.id,
      position: unit.position,
      hpRatio: unit.hpRatio,
      priority: UNIT_TARGET_PRIORITY[unit.kind],
      isThreatSource: threatIds.has(unit.id),
    })),
    ...input.enemyBuildings.filter((building) => building.hpRatio > 0).map((building) => ({
      id: building.id,
      position: building.position,
      hpRatio: building.hpRatio,
      priority: BUILDING_TARGET_PRIORITY[building.kind],
      isThreatSource: threatIds.has(building.id),
    })),
  ];

  const preferred = preferredId ? candidates.find((candidate) => candidate.id === preferredId) : undefined;
  if (preferred && (state === 'attack' || preferred.isThreatSource || squaredDistance(preferred.position, input.basePosition) <= 900)) {
    return preferred;
  }

  const origin = state === 'defend' ? input.basePosition : forceCentroid(input.ownUnits, input.rallyPoint);
  candidates.sort((left, right) => {
    const leftDistance = Math.sqrt(squaredDistance(left.position, origin));
    const rightDistance = Math.sqrt(squaredDistance(right.position, origin));
    const leftScore = left.priority + (1 - left.hpRatio) * 22 + (left.isThreatSource ? 90 : 0) - leftDistance * (state === 'defend' ? 2.5 : 0.2);
    const rightScore = right.priority + (1 - right.hpRatio) * 22 + (right.isThreatSource ? 90 : 0) - rightDistance * (state === 'defend' ? 2.5 : 0.2);
    return rightScore - leftScore || compareId(left.id, right.id);
  });
  return candidates[0] ?? null;
};

const forceCentroid = (units: AIPlannerUnitSummary[], fallback: Vec2): Vec2 => {
  const combat = units.filter((unit) => unit.kind !== 'harvester' && unit.combatPower > 0 && unit.hpRatio > 0);
  if (combat.length === 0) return fallback;
  let x = 0;
  let z = 0;
  for (const unit of combat) {
    x += unit.position.x;
    z += unit.position.z;
  }
  return { x: x / combat.length, z: z / combat.length };
};

const targetStillExists = (input: AIPlannerInput, targetId: string | null): boolean => {
  if (!targetId) return false;
  return input.enemyUnits.some((unit) => unit.id === targetId && unit.hpRatio > 0)
    || input.enemyBuildings.some((building) => building.id === targetId && building.hpRatio > 0);
};
