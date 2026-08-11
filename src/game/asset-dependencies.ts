import type { BuildingKind, GameState, Team, UnitKind } from './types';
import { getBreakthroughDifficulty, isPlayableBreakthroughFixture } from './difficulty';

type CombatTeam = Exclude<Team, 'neutral'>;

export type AuthoredAssetPhaseName = 'review' | 'critical' | 'level' | 'frontline' | 'rear' | 'dressing' | 'ensure';

export interface AuthoredAssetPhasePlan {
  name: AuthoredAssetPhaseName;
  labels: readonly string[];
  concurrency: number;
  deferred: boolean;
}

const PLAYER_UNIT_ASSETS: Readonly<Record<UnitKind, string>> = Object.freeze({
  tank: 'FF-MBT-01',
  harvester: 'FF-HRV-01',
  rifle: 'FF-RIF-01',
  engineer: 'FF-ENG-01',
  antitank: 'FF-AT-01',
  scout: 'FF-SCT-01',
  suppressor: 'FF-SUP-01',
  artillery: 'FF-ART-01',
});

const ENEMY_UNIT_ASSETS: Readonly<Record<UnitKind, string>> = Object.freeze({
  tank: 'FF-EN-MBT-01',
  harvester: 'FF-EN-HRV-01',
  rifle: 'FF-EN-RIF-01',
  engineer: 'FF-EN-ENG-01',
  antitank: 'FF-EN-AT-01',
  scout: 'FF-EN-SCT-01',
  suppressor: 'FF-EN-SUP-01',
  artillery: 'FF-EN-ART-01',
});

const PLAYER_BUILDING_ASSETS: Readonly<Record<BuildingKind, string>> = Object.freeze({
  hq: 'FF-HQ-01',
  refinery: 'FF-REF-01',
  factory: 'FF-FAC-01',
  reactor: 'FF-RCT-01',
  barracks: 'FF-BAR-01',
  relay: 'FF-REL-01',
  sentry: 'FF-SEN-01',
  cannon: 'FF-CAN-01',
});

const ENEMY_BUILDING_ASSETS: Readonly<Record<BuildingKind, string>> = Object.freeze({
  hq: 'FF-EN-HQ-01',
  refinery: 'FF-EN-REF-01',
  factory: 'FF-EN-FAC-01',
  reactor: 'FF-EN-RCT-01',
  barracks: 'FF-EN-BAR-01',
  relay: 'FF-EN-REL-01',
  sentry: 'FF-EN-SEN-01',
  cannon: 'FF-EN-CAN-01',
});

export const AUTHORED_LEVEL_ASSETS = Object.freeze(['FF-ROK-01', 'FF-ORE-01'] as const);

export const AUTHORED_DRESSING_ASSETS = Object.freeze([
  'FF-WRK-01',
  'FF-CRT-01',
  'FF-RDM-01',
  'FF-SBG-01',
  'FF-CCH-01',
  'FF-AUX-01',
  'FF-SCR-01',
  'FF-STM-01',
] as const);

// The opening frame used to begin with four of the largest textured GLBs.
// Keep a deterministic, gameplay-motivated order so a lightweight authored
// silhouette arrives first while the iconic tank and the economy pair still
// remain in the first bounded phase.
const BREAKTHROUGH_OPENING_PRIORITY = Object.freeze([
  PLAYER_UNIT_ASSETS.scout,
  PLAYER_BUILDING_ASSETS.sentry,
  PLAYER_BUILDING_ASSETS.cannon,
  PLAYER_BUILDING_ASSETS.relay,
  PLAYER_UNIT_ASSETS.tank,
  PLAYER_UNIT_ASSETS.harvester,
  PLAYER_BUILDING_ASSETS.refinery,
  PLAYER_BUILDING_ASSETS.hq,
  PLAYER_BUILDING_ASSETS.factory,
  PLAYER_UNIT_ASSETS.rifle,
  PLAYER_UNIT_ASSETS.engineer,
  PLAYER_UNIT_ASSETS.antitank,
  PLAYER_BUILDING_ASSETS.reactor,
  PLAYER_BUILDING_ASSETS.barracks,
] as const);

// These are the authored silhouettes a normal player can meet on the first
// approach to the scripted front. They stream only after the first simulation
// tick, so the 00:00 deployment briefing gives all bandwidth to the player's
// visible base and opening force.
const BREAKTHROUGH_FRONTLINE_ASSETS = Object.freeze([
  ENEMY_UNIT_ASSETS.scout,
  ENEMY_BUILDING_ASSETS.sentry,
  ENEMY_BUILDING_ASSETS.cannon,
  ENEMY_BUILDING_ASSETS.relay,
  ENEMY_BUILDING_ASSETS.factory,
  ENEMY_UNIT_ASSETS.artillery,
  ENEMY_UNIT_ASSETS.suppressor,
  ENEMY_UNIT_ASSETS.rifle,
  ENEMY_UNIT_ASSETS.antitank,
  ENEMY_UNIT_ASSETS.tank,
] as const);

const BREAKTHROUGH_ENEMY_BASE_ASSETS = Object.freeze([
  ENEMY_UNIT_ASSETS.harvester,
  ENEMY_BUILDING_ASSETS.hq,
  ENEMY_BUILDING_ASSETS.refinery,
  ENEMY_BUILDING_ASSETS.reactor,
  ENEMY_BUILDING_ASSETS.barracks,
] as const);

export const AUTHORED_ASSET_CATALOG_ORDER = Object.freeze([
  ...Object.values(PLAYER_UNIT_ASSETS),
  ...Object.values(ENEMY_UNIT_ASSETS),
  ...Object.values(ENEMY_BUILDING_ASSETS),
  ...Object.values(PLAYER_BUILDING_ASSETS),
  ...AUTHORED_LEVEL_ASSETS,
  ...AUTHORED_DRESSING_ASSETS,
] as const);

const CATALOG_INDEX = new Map(AUTHORED_ASSET_CATALOG_ORDER.map((label, index) => [label, index]));

const orderedUnique = (labels: Iterable<string>): string[] => [...new Set(labels)].sort((left, right) => {
  const leftIndex = CATALOG_INDEX.get(left) ?? Number.MAX_SAFE_INTEGER;
  const rightIndex = CATALOG_INDEX.get(right) ?? Number.MAX_SAFE_INTEGER;
  return leftIndex - rightIndex || left.localeCompare(right);
});

const stableUnique = (labels: Iterable<string>): string[] => [...new Set(labels)];

const prioritize = (labels: Iterable<string>, priority: readonly string[]): string[] => {
  const remaining = new Set(labels);
  const result: string[] = [];
  for (const label of priority) {
    if (!remaining.delete(label)) continue;
    result.push(label);
  }
  return [...result, ...orderedUnique(remaining)];
};

export function authoredUnitAssetLabel(team: CombatTeam, kind: UnitKind): string {
  return team === 'player' ? PLAYER_UNIT_ASSETS[kind] : ENEMY_UNIT_ASSETS[kind];
}

export function authoredBuildingAssetLabel(team: CombatTeam, kind: BuildingKind): string {
  return team === 'player' ? PLAYER_BUILDING_ASSETS[kind] : ENEMY_BUILDING_ASSETS[kind];
}

export function authoredAssetAllowlist(fixture: string): ReadonlySet<string> | null {
  if (fixture === 'destruction-residue-review' || fixture === 'destruction-residue-review-reduced') {
    return new Set(['FF-SCT-01', 'FF-SUP-01', 'FF-ART-01', 'FF-RIF-01', 'FF-ENG-01', 'FF-AT-01']);
  }
  if (fixture === 'building-ruin-review' || fixture === 'building-ruin-review-reduced') {
    return new Set(['FF-HQ-01', 'FF-FAC-01', 'FF-EN-HQ-01', 'FF-EN-FAC-01']);
  }
  if (fixture === 'building-damage-review' || fixture === 'building-damage-review-reduced') {
    return new Set(['FF-HQ-01', 'FF-FAC-01', 'FF-EN-HQ-01', 'FF-EN-FAC-01']);
  }
  if (fixture === 'enemy-infrastructure-review') {
    return new Set(['FF-EN-BAR-01', 'FF-EN-RCT-01']);
  }
  if (fixture === 'player-infrastructure-review') {
    // The two off-frame artillery pieces are fixture-only event drivers. The
    // review surface intentionally audits only the two player building masters.
    return new Set(['FF-BAR-01', 'FF-RCT-01']);
  }
  if (fixture === 'enemy-vehicle-socket-review') {
    // Player HQ targets and the enemy HQ anchor are hidden logical combat
    // participants; this fixture audits only the two enemy vehicle masters.
    return new Set(['FF-EN-SUP-01', 'FF-EN-ART-01']);
  }
  if (fixture === 'combat-vehicle-family-review') {
    return new Set([
      'FF-SCT-01', 'FF-SUP-01', 'FF-ART-01',
      'FF-EN-SCT-01', 'FF-EN-SUP-01', 'FF-EN-ART-01',
    ]);
  }
  if (fixture === 'wreck-review' || fixture === 'wreck-review-reduced') {
    return new Set(['FF-MBT-01', 'FF-HRV-01', 'FF-EN-MBT-01', 'FF-EN-HRV-01']);
  }
  if (fixture === 'construction-review' || fixture === 'construction-review-reduced') {
    return new Set([
      ...Object.values(PLAYER_BUILDING_ASSETS),
      ...Object.values(ENEMY_BUILDING_ASSETS),
      'FF-ENG-01',
    ]);
  }
  if (fixture === 'visual-gold-review') {
    return new Set([
      'FF-MBT-01', 'FF-HRV-01', 'FF-RIF-01', 'FF-ENG-01', 'FF-AT-01',
      'FF-EN-MBT-01', 'FF-EN-RIF-01',
      'FF-EN-SEN-01', 'FF-HQ-01', 'FF-FAC-01',
      'FF-ROK-01', 'FF-ORE-01',
    ]);
  }
  if (fixture === 'hero-tank-review' || fixture === 'hero-tank-review-reduced') {
    return new Set(['FF-MBT-01', 'FF-EN-MBT-01']);
  }
  if (fixture === 'infantry-rig-review' || fixture === 'infantry-rig-review-reduced') {
    return new Set(['FF-RIF-01', 'FF-EN-RIF-01', 'FF-EN-MBT-01']);
  }
  if (fixture === 'infantry-family-review' || fixture === 'infantry-family-review-reduced') {
    return new Set([
      'FF-MBT-01', 'FF-RIF-01', 'FF-ENG-01', 'FF-AT-01',
      'FF-EN-MBT-01', 'FF-EN-RIF-01', 'FF-EN-ENG-01', 'FF-EN-AT-01',
    ]);
  }
  if (fixture === 'enemy-review') {
    return new Set([
      'FF-SCT-01', 'FF-EN-MBT-01', 'FF-EN-RIF-01', 'FF-EN-AT-01',
      'FF-EN-SCT-01', 'FF-EN-SUP-01', 'FF-EN-ART-01', 'FF-EN-HRV-01', 'FF-EN-ENG-01',
    ]);
  }
  if (fixture === 'enemy-base-review') {
    return new Set([
      'FF-EN-MBT-01',
      'FF-EN-HQ-01', 'FF-EN-REF-01', 'FF-EN-FAC-01', 'FF-EN-RCT-01',
      'FF-EN-BAR-01', 'FF-EN-REL-01', 'FF-EN-SEN-01', 'FF-EN-CAN-01',
    ]);
  }
  if (fixture === 'combat' || fixture === 'combat-reduced') {
    return new Set(['FF-SUP-01', 'FF-EN-RIF-01']);
  }
  return null;
}

export function collectEntityAuthoredAssetLabels(state: Pick<GameState, 'units' | 'buildings'>): string[] {
  const labels: string[] = [];
  for (const unit of state.units) labels.push(authoredUnitAssetLabel(unit.team, unit.kind));
  for (const building of state.buildings) {
    labels.push(authoredBuildingAssetLabel(building.team, building.kind));
    for (const item of building.queue) labels.push(authoredUnitAssetLabel(building.team, item.unitKind));
  }
  return orderedUnique(labels);
}

/**
 * Assets that may be presented without violating fog-of-war disclosure.
 * Player entities are always known; enemy entities enter only after the
 * authoritative player-intel list discloses their stable id.
 */
export function collectPresentationAuthoredAssetLabels(
  state: Pick<GameState, 'units' | 'buildings' | 'intel'>,
): string[] {
  const visibleEnemyIds = new Set(state.intel.player.visibleEnemyIds);
  const labels: string[] = [];
  for (const unit of state.units) {
    if (unit.team === 'enemy' && !visibleEnemyIds.has(unit.id)) continue;
    labels.push(authoredUnitAssetLabel(unit.team, unit.kind));
  }
  for (const building of state.buildings) {
    if (building.team === 'enemy' && !visibleEnemyIds.has(building.id)) continue;
    labels.push(authoredBuildingAssetLabel(building.team, building.kind));
    for (const item of building.queue) labels.push(authoredUnitAssetLabel(building.team, item.unitKind));
  }
  return prioritize(labels, BREAKTHROUGH_OPENING_PRIORITY);
}

/** Asset families needed before the next scripted breakthrough transition. */
export function collectBreakthroughMissionPrefetchLabels(
  fixture: string,
  state: Pick<GameState, 'mission'>,
): string[] {
  if (!isPlayableBreakthroughFixture(fixture)) return [];
  const difficulty = getBreakthroughDifficulty(fixture);
  const labels: string[] = [];
  if (state.mission.phase === 'frontline' || state.mission.phase === 'counterattack') {
    for (const kind of difficulty.counterattackWave) {
      labels.push(authoredUnitAssetLabel('enemy', kind));
    }
    for (const kind of difficulty.reinforcementWave) {
      labels.push(authoredUnitAssetLabel('player', kind));
    }
  }
  if (
    state.mission.phase === 'counterattack'
    || state.mission.phase === 'reinforcement'
    || state.mission.phase === 'command'
  ) {
    labels.push(...BREAKTHROUGH_ENEMY_BASE_ASSETS);
    for (const kind of difficulty.finalAssaultWave) {
      labels.push(authoredUnitAssetLabel('enemy', kind));
    }
  }
  return orderedUnique(labels);
}

export function authoredBreakthroughStreamingPhasePlan(fixture: string): AuthoredAssetPhasePlan[] {
  if (!isPlayableBreakthroughFixture(fixture)) return [];
  return [
    {
      name: 'frontline',
      labels: BREAKTHROUGH_FRONTLINE_ASSETS,
      concurrency: 2,
      deferred: true,
    },
    {
      name: 'rear',
      labels: BREAKTHROUGH_ENEMY_BASE_ASSETS,
      concurrency: 2,
      deferred: true,
    },
    {
      name: 'dressing',
      labels: AUTHORED_DRESSING_ASSETS,
      concurrency: 1,
      deferred: true,
    },
  ];
}

export function authoredBreakthroughRuntimePhasePlan(
  fixture: string,
  state: Pick<GameState, 'units' | 'buildings' | 'resources' | 'blockers' | 'intel' | 'mission' | 'tick'>,
): AuthoredAssetPhasePlan[] {
  if (!isPlayableBreakthroughFixture(fixture) || state.tick <= 0) return [];
  return [
    {
      name: 'ensure',
      labels: stableUnique([
        ...collectPresentationAuthoredAssetLabels(state),
        ...collectBreakthroughMissionPrefetchLabels(fixture, state),
        ...collectLevelAuthoredAssetLabels(state),
      ]),
      concurrency: 2,
      deferred: false,
    },
    ...authoredBreakthroughStreamingPhasePlan(fixture),
  ];
}

export function collectLevelAuthoredAssetLabels(
  state: Pick<GameState, 'resources' | 'blockers'>,
): string[] {
  const labels: string[] = [];
  if (state.blockers.length > 0) labels.push('FF-ROK-01');
  if (state.resources.length > 0) labels.push('FF-ORE-01');
  return orderedUnique(labels);
}

export function authoredAssetPhasePlan(
  fixture: string,
  state: Pick<GameState, 'units' | 'buildings' | 'resources' | 'blockers' | 'intel' | 'mission' | 'tick'>,
): AuthoredAssetPhasePlan[] {
  const reviewAllowlist = authoredAssetAllowlist(fixture);
  if (reviewAllowlist) {
    return [{
      name: 'review',
      labels: orderedUnique(reviewAllowlist),
      concurrency: 2,
      deferred: false,
    }];
  }

  const entityLabels = collectEntityAuthoredAssetLabels(state);
  const levelLabels = collectLevelAuthoredAssetLabels(state);
  if (isPlayableBreakthroughFixture(fixture)) {
    const phases: AuthoredAssetPhasePlan[] = [
      {
        name: 'critical',
        labels: prioritize([
          ...collectPresentationAuthoredAssetLabels(state),
          PLAYER_BUILDING_ASSETS.sentry,
          PLAYER_BUILDING_ASSETS.cannon,
          // The factory may queue either support vehicle immediately. Keeping
          // these two compact no-texture GLBs in the opening phase prevents a
          // user production request from sitting behind optional dressing.
          PLAYER_UNIT_ASSETS.suppressor,
          PLAYER_UNIT_ASSETS.artillery,
          ...(state.tick > 0 ? collectBreakthroughMissionPrefetchLabels(fixture, state) : []),
        ], BREAKTHROUGH_OPENING_PRIORITY),
        concurrency: 4,
        deferred: false,
      },
      { name: 'level', labels: levelLabels, concurrency: 3, deferred: false },
    ];
    return phases.filter((phase) => phase.labels.length > 0);
  }
  if (fixture.startsWith('breakthrough-demo')) {
    const phases: AuthoredAssetPhasePlan[] = [
      {
        name: 'critical',
        labels: entityLabels,
        concurrency: 4,
        deferred: false,
      },
      { name: 'level', labels: levelLabels, concurrency: 3, deferred: false },
      { name: 'dressing', labels: AUTHORED_DRESSING_ASSETS, concurrency: 2, deferred: true },
    ];
    return phases.filter((phase) => phase.labels.length > 0);
  }

  return [{
    name: 'level',
    labels: orderedUnique([...entityLabels, ...levelLabels, ...AUTHORED_DRESSING_ASSETS]),
    concurrency: 4,
    deferred: false,
  }];
}

export interface IncrementalAssetLoadSnapshot {
  queued: number;
  inflight: number;
  loaded: number;
  failed: number;
  disposed: boolean;
}

/** Pure request-state ledger used by the scene scheduler and unit tests. */
export class IncrementalAssetLoadLedger {
  private readonly queued = new Set<string>();
  private readonly inflight = new Set<string>();
  private readonly loaded = new Set<string>();
  private readonly failed = new Set<string>();
  private readonly attempts = new Map<string, number>();
  private disposed = false;

  queue(labels: Iterable<string>): string[] {
    if (this.disposed) return [];
    const accepted: string[] = [];
    // Phase planners already provide deterministic priority. Preserve it so a
    // small visible asset is not sorted behind multi-megabyte GLBs again.
    for (const label of stableUnique(labels)) {
      if (this.queued.has(label) || this.inflight.has(label) || this.loaded.has(label) || this.failed.has(label)) continue;
      this.queued.add(label);
      accepted.push(label);
    }
    return accepted;
  }

  start(label: string): boolean {
    if (this.disposed || !this.queued.delete(label)) return false;
    this.inflight.add(label);
    this.attempts.set(label, (this.attempts.get(label) ?? 0) + 1);
    return true;
  }

  retry(label: string, maximumAttempts = 2): boolean {
    if (
      this.disposed
      || !this.inflight.has(label)
      || (this.attempts.get(label) ?? 0) >= Math.max(1, Math.floor(maximumAttempts))
    ) return false;
    this.inflight.delete(label);
    this.queued.add(label);
    return true;
  }

  succeed(label: string): boolean {
    if (this.disposed || !this.inflight.delete(label)) return false;
    this.loaded.add(label);
    return true;
  }

  fail(label: string): boolean {
    if (this.disposed || !this.inflight.delete(label)) return false;
    this.failed.add(label);
    return true;
  }

  failedCount(labels: Iterable<string>): number {
    let count = 0;
    for (const label of new Set(labels)) {
      if (this.failed.has(label)) count += 1;
    }
    return count;
  }

  queuedLabels(labels: Iterable<string>): string[] {
    if (this.disposed) return [];
    return stableUnique(labels).filter((label) => this.queued.has(label));
  }

  dispose(): void {
    this.disposed = true;
    this.queued.clear();
    this.inflight.clear();
  }

  snapshot(): IncrementalAssetLoadSnapshot {
    return {
      queued: this.queued.size,
      inflight: this.inflight.size,
      loaded: this.loaded.size,
      failed: this.failed.size,
      disposed: this.disposed,
    };
  }
}
