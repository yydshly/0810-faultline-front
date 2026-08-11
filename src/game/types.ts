import type { TechnologyKind, TechnologyTeamState } from './technology';
import type { VisibilitySnapshot } from './visibility';

export type Team = 'player' | 'enemy' | 'neutral';

export type UnitKind =
  | 'scout'
  | 'rifle'
  | 'antitank'
  | 'engineer'
  | 'suppressor'
  | 'tank'
  | 'artillery'
  | 'harvester';

export type BuildingKind = 'hq' | 'reactor' | 'refinery' | 'barracks' | 'factory' | 'relay' | 'sentry' | 'cannon';

export type CombatUnitKind = Exclude<UnitKind, 'harvester'>;

export interface Vec2 {
  x: number;
  z: number;
}

export interface UnitDefinition {
  label: string;
  shortLabel: string;
  cost: number;
  buildTime: number;
  bandwidth: number;
  maxHp: number;
  speed: number;
  radius: number;
  range: number;
  minRange: number;
  damage: number;
  cooldown: number;
  sight: number;
  targetRole: string;
  producer: 'hq' | 'refinery' | 'barracks' | 'factory';
  projectileSpeed: number;
}

export interface BuildingDefinition {
  label: string;
  shortLabel: string;
  cost: number;
  buildTime: number;
  maxHp: number;
  footprint: Vec2;
  powerSupply: number;
  powerDemand: number;
  buildRadius: number;
  bandwidth: number;
  description: string;
  weapon?: BuildingWeaponDefinition;
}

export type ArmorClass = 'infantry' | 'light' | 'heavy' | 'building';

export interface BuildingWeaponDefinition {
  range: number;
  minRange: number;
  damage: number;
  cooldown: number;
  sight: number;
  projectileSpeed: number;
  splashRadius: number;
  targetRole: string;
  damageMultipliers: Record<ArmorClass, number>;
}

export interface UnitOrder {
  type: 'idle' | 'move' | 'attackMove' | 'attack' | 'gather' | 'return' | 'repair';
  target?: Vec2;
  targetId?: string;
  queued?: boolean;
  waypoints?: Vec2[];
  waypointIndex?: number;
}

export interface UnitState {
  id: string;
  entityType: 'unit';
  team: Exclude<Team, 'neutral'>;
  kind: UnitKind;
  position: Vec2;
  rotation: number;
  hp: number;
  maxHp: number;
  radius: number;
  cooldownRemaining: number;
  order: UnitOrder;
  cargo: number;
  cargoCapacity: number;
  selected?: boolean;
}

export interface ProductionItem {
  unitKind: UnitKind;
  remaining: number;
  total: number;
}

export interface BuildingState {
  id: string;
  entityType: 'building';
  team: Exclude<Team, 'neutral'>;
  kind: BuildingKind;
  position: Vec2;
  rotation: number;
  aimRotation: number;
  hp: number;
  maxHp: number;
  footprint: Vec2;
  connected: boolean;
  powered: boolean;
  buildProgress: number;
  cooldownRemaining: number;
  queue: ProductionItem[];
  rallyPoint?: Vec2;
  selected?: boolean;
}

export interface ResourceState {
  id: string;
  entityType: 'resource';
  team: 'neutral';
  position: Vec2;
  amount: number;
  maxAmount: number;
  radius: number;
}

export interface BlockerState {
  id: string;
  position: Vec2;
  radius: number;
  blocksMovement: boolean;
  blocksVision: boolean;
}

export interface BeaconState {
  id: string;
  position: Vec2;
  radius: number;
  unlocked: boolean;
  controllingTeam: Exclude<Team, 'neutral'> | null;
  contested: boolean;
  playerProgress: number;
  enemyProgress: number;
  targetProgress: number;
}

export interface TeamEconomyState {
  credits: number;
  powerSupply: number;
  powerDemand: number;
  powerRatio: number;
  bandwidthUsed: number;
  bandwidthCap: number;
  incomePerMinute: number;
}

export interface NotificationState {
  id: number;
  tone: 'info' | 'success' | 'warning' | 'danger';
  text: string;
  expiresAt: number;
}

export type AITacticalPhase = 'economy' | 'rally' | 'attack' | 'defend' | 'recover';

export interface AITacticalStatus {
  phase: AITacticalPhase;
  reason: string;
  stateEnteredTick: number;
}

export interface TeamIntelState {
  visibility: VisibilitySnapshot;
  radarOnline: boolean;
  visibleEnemyIds: string[];
}

export type MissionPhase = 'deployment' | 'frontline' | 'counterattack' | 'reinforcement' | 'command' | 'complete';

export interface MissionState {
  kind: 'standard' | 'breakthrough';
  phase: MissionPhase;
  phaseStartedTick: number;
  counterattackUnitIds: string[];
  reinforcementUnitIds: string[];
}

export interface GameState {
  seed: number;
  tick: number;
  elapsed: number;
  status: 'active' | 'victory' | 'defeat';
  statusReason: string;
  units: UnitState[];
  buildings: BuildingState[];
  resources: ResourceState[];
  blockers: BlockerState[];
  beacon: BeaconState;
  ai: { enemy: AITacticalStatus };
  economy: Record<'player' | 'enemy', TeamEconomyState>;
  intel: Record<'player' | 'enemy', TeamIntelState>;
  mission: MissionState;
  technology: Record<'player' | 'enemy', TechnologyTeamState>;
  notifications: NotificationState[];
}

export type GameCommand =
  | { type: 'move'; unitIds: string[]; target: Vec2; queued?: boolean }
  | { type: 'attackMove'; unitIds: string[]; target: Vec2; queued?: boolean }
  | { type: 'attack'; unitIds: string[]; targetId: string; queued?: boolean }
  | { type: 'gather'; unitIds: string[]; resourceId: string; queued?: boolean }
  | { type: 'repair'; unitIds: string[]; targetId: string; queued?: boolean }
  | { type: 'stop'; unitIds: string[] }
  | { type: 'build'; kind: BuildingKind; position: Vec2; rotation: number }
  | { type: 'produce'; buildingId: string; unitKind: UnitKind }
  | { type: 'setRally'; buildingId: string; target: Vec2 }
  | { type: 'research'; kind: TechnologyKind }
  | { type: 'cancelConstruction'; buildingId: string }
  | { type: 'cancelProduction'; buildingId: string }
  | { type: 'cancelResearch' };

export interface BuildValidation {
  valid: boolean;
  reason: string;
}

export interface SimulationEvent {
  type: 'shot' | 'impact' | 'destroyed' | 'deposit' | 'built' | 'produced' | 'command' | 'repair' | 'research' | 'cancelled';
  at: Vec2;
  team?: Team;
  sourceId?: string;
  targetId?: string;
  amount?: number;
  radius?: number;
  technologyKind?: TechnologyKind;
}

export type WorldEntity = UnitState | BuildingState | ResourceState;
