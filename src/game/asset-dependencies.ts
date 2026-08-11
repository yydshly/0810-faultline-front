import type { BuildingKind, GameState, Team, UnitKind } from './types';

type CombatTeam = Exclude<Team, 'neutral'>;

export type AuthoredAssetPhaseName = 'review' | 'critical' | 'level' | 'dressing' | 'ensure';

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

// The golden breakthrough route creates these during preparation and its
// scripted waves. Preload them with the opening force so a phase transition
// never has to display a procedural fallback while its authored GLB arrives.
const BREAKTHROUGH_MISSION_ASSETS = Object.freeze([
  PLAYER_BUILDING_ASSETS.sentry,
  PLAYER_UNIT_ASSETS.artillery,
  PLAYER_UNIT_ASSETS.suppressor,
  ENEMY_UNIT_ASSETS.suppressor,
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
  state: Pick<GameState, 'units' | 'buildings' | 'resources' | 'blockers'>,
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
  if (fixture.startsWith('breakthrough-demo')) {
    const phases: AuthoredAssetPhasePlan[] = [
      {
        name: 'critical',
        labels: orderedUnique([...entityLabels, ...BREAKTHROUGH_MISSION_ASSETS]),
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
    for (const label of orderedUnique(labels)) {
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
