import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

import {
  BUILDING_DEFS,
  CYAN,
  DEFENSE_MIN_POWER_RATIO,
  ENEMY_COLOR,
  MAP_HALF_SIZE,
  PLAYER_COLOR,
  UNIT_DEFS,
} from './config';
import {
  FACTION_VISUALS,
  HEALTH_BAR_PRESENTATION,
  factionVisual,
  healthVisualBand,
  shouldShowHealthBar,
} from './faction-visuals';
import {
  IncrementalAssetLoadLedger,
  authoredAssetAllowlist,
  authoredAssetPhasePlan,
  authoredBuildingAssetLabel,
  collectEntityAuthoredAssetLabels,
  collectLevelAuthoredAssetLabels,
  type AuthoredAssetPhasePlan,
} from './asset-dependencies';
import { LEVEL_ANCHORS } from './level';
import {
  shouldHideReviewPresentationBlocker,
  shouldHideReviewPresentationEntity,
} from './review-presentation';
import {
  RENDER_QUALITY_PROFILES,
  type RenderQualityLevel,
} from './render-quality';
import {
  importedMaterialDescriptorSignature,
  importedMaterialOwnerKey,
  type ImportedMaterialDescriptor,
  type ImportedMaterialOwner,
  type MaterialDescriptorValue,
} from './imported-materials';
import {
  isInsideExpandedFlatView,
  orthographicProjectedHeightPx,
  resolveAvailablePresentationLod,
  selectPresentationLodTier,
  shouldUpdatePresentationOnFrame,
  type FlatWorldBounds,
  type PresentationLodThresholds,
  type PresentationLodTier,
  type RenderablePresentationLodTier,
} from './presentation-lod';
import { resolvePublicAssetUrl } from './public-asset-url';
import type { VisibilitySnapshot } from './visibility';
import type {
  BeaconState,
  BuildingKind,
  GameState,
  SimulationEvent,
  Team,
  UnitKind,
  Vec2,
  WorldEntity,
} from './types';

export {
  IncrementalAssetLoadLedger,
  authoredAssetAllowlist,
  authoredAssetPhasePlan,
  collectEntityAuthoredAssetLabels,
  collectLevelAuthoredAssetLabels,
} from './asset-dependencies';

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface ScreenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

type CombatTeam = Exclude<Team, 'neutral'>;
type VisualEntityType = WorldEntity['entityType'];

interface HealthBarVisual {
  group: THREE.Group;
  frame: THREE.Mesh;
  back: THREE.Mesh;
  fill: THREE.Mesh;
  batched: boolean;
}

interface HealthBarPresentationBatches {
  frame: THREE.InstancedMesh;
  back: THREE.InstancedMesh;
  fill: THREE.InstancedMesh;
}

interface PresentationPart {
  node: THREE.Object3D;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
}

export type RefineryMechanismRole = 'gate' | 'conveyor' | 'collector';

interface RefineryMechanismPart extends PresentationPart {
  role: RefineryMechanismRole;
}

interface PresentationDetailNode {
  node: THREE.Object3D;
  visible: boolean;
}

interface PresentationShadowCaster {
  node: THREE.Mesh;
  castShadow: boolean;
}

interface PresentationVisibilityNode {
  node: THREE.Object3D;
  visible: boolean;
}

export type ConstructionPresentationStage = 'foundation' | 'frame' | 'shell' | 'complete';

interface ConstructionVisual {
  footprint: Vec2;
  height: number;
  team: CombatTeam;
  progress: number;
  stage: ConstructionPresentationStage;
}

interface ConstructionPresentationBatches {
  foundation: THREE.InstancedMesh;
  frame: THREE.InstancedMesh;
  shell: THREE.InstancedMesh;
  scan: THREE.InstancedMesh;
}

export type BuildingDamageVisualStage = 'none' | 'damaged' | 'critical';
export type AuthoredBuildingDamageRole = 'damaged' | 'critical';

export function isInfrastructureReviewFixture(fixture: string): boolean {
  return fixture === 'enemy-infrastructure-review' || fixture === 'player-infrastructure-review';
}

export function shouldHideInfrastructureReviewAttacker(fixture: string, entityId: string): boolean {
  if (fixture === 'enemy-infrastructure-review') return entityId.startsWith('u-enemy-infra-');
  if (fixture === 'player-infrastructure-review') return entityId.startsWith('u-player-infra-');
  return false;
}

export const ENEMY_VEHICLE_SOCKET_REVIEW_SUPPRESSOR_BODY_YAW_OFFSET = Math.PI / 5;

export function enemyVehicleSocketReviewBodyYaw(
  fixture: string,
  entityId: string,
  logicalAimYaw: number,
): number {
  return fixture === 'enemy-vehicle-socket-review' && entityId === 'u-enemy-socket-suppressor'
    ? logicalAimYaw - ENEMY_VEHICLE_SOCKET_REVIEW_SUPPRESSOR_BODY_YAW_OFFSET
    : logicalAimYaw;
}

export function shouldHideEnemyVehicleSocketReviewEntity(fixture: string, entityId: string): boolean {
  return fixture === 'enemy-vehicle-socket-review'
    && shouldHideReviewPresentationEntity(fixture, entityId);
}

export const COMBAT_VEHICLE_FAMILY_REVIEW_ENTITY_IDS = Object.freeze([
  'u-combat-vehicle-family-player-scout',
  'u-combat-vehicle-family-player-suppressor',
  'u-combat-vehicle-family-player-artillery',
  'u-combat-vehicle-family-enemy-scout',
  'u-combat-vehicle-family-enemy-suppressor',
  'u-combat-vehicle-family-enemy-artillery',
] as const);

export interface CombatVehicleFamilyReviewEntry {
  id: string;
  modelKey: string;
  team: Team;
  unitKind: UnitKind | null;
}

export interface CombatVehicleFamilyReviewMetrics {
  entities: number;
  contracts: number;
  fallbacks: number;
  player: number;
  enemy: number;
  scout: number;
  suppressor: number;
  artillery: number;
}

export function combatVehicleFamilyReviewMetrics(
  entries: readonly CombatVehicleFamilyReviewEntry[],
): CombatVehicleFamilyReviewMetrics {
  const expected = new Set<string>(COMBAT_VEHICLE_FAMILY_REVIEW_ENTITY_IDS);
  const reviewEntries = entries.filter((entry) => expected.has(entry.id));
  const contracts = reviewEntries.filter((entry) => entry.modelKey.endsWith(':authored-v1')).length;
  return {
    entities: reviewEntries.length,
    contracts,
    fallbacks: reviewEntries.length - contracts,
    player: reviewEntries.filter((entry) => entry.team === 'player').length,
    enemy: reviewEntries.filter((entry) => entry.team === 'enemy').length,
    scout: reviewEntries.filter((entry) => entry.unitKind === 'scout').length,
    suppressor: reviewEntries.filter((entry) => entry.unitKind === 'suppressor').length,
    artillery: reviewEntries.filter((entry) => entry.unitKind === 'artillery').length,
  };
}

export function shouldHideCombatVehicleFamilyReviewEntity(fixture: string, entityId: string): boolean {
  return fixture === 'combat-vehicle-family-review'
    && shouldHideReviewPresentationEntity(fixture, entityId);
}

export function shouldHideCombatVehicleFamilyReviewBlocker(fixture: string, blockerId: string): boolean {
  return shouldHideReviewPresentationBlocker(fixture, blockerId);
}

export const AUTHORED_BUILDING_DAMAGE_POLICY = Object.freeze({
  version: 'authored-building-damage-v1',
  buildCompleteAt: 0.995,
  damagedAt: 0.66,
  criticalAt: 0.3,
});
export type ImpactVisualKind = 'ballistic' | 'heavy';
export type CombatVfxKind =
  | 'projectile'
  | 'muzzle'
  | 'ballistic-impact'
  | 'heavy-explosion'
  | 'smoke'
  | 'debris'
  | 'scorch'
  | 'residue'
  | 'economy-transfer'
  | 'signal'
  | 'dust';

interface DamageVisual {
  root: THREE.Group;
  smokeA: THREE.Mesh;
  smokeB: THREE.Mesh;
  ember: THREE.Mesh;
  scarA: THREE.Mesh;
  scarB: THREE.Mesh;
  criticalMarker: THREE.Mesh;
  building: boolean;
  stage: BuildingDamageVisualStage;
  ratio: number;
}

interface EntityVisual {
  root: THREE.Group;
  body: THREE.Group;
  turretPivot: THREE.Object3D | null;
  modelKey: string;
  entityType: VisualEntityType;
  height: number;
  pickRadius: number;
  targetPosition: THREE.Vector3;
  targetRotation: number;
  targetAimRotation: number;
  team: Team;
  contactShadowScaleX: number;
  contactShadowScaleZ: number;
  selectionScaleX: number;
  selectionScaleZ: number;
  selection: THREE.Mesh;
  healthBar: HealthBarVisual | null;
  damageVisual: DamageVisual | null;
  authoredBuildingDamageRoots: Readonly<Record<AuthoredBuildingDamageRole, THREE.Object3D | null>>;
  animatedNodes: THREE.Object3D[];
  locomotionNodes: THREE.Object3D[];
  infantryParts: PresentationPart[];
  activityParts: PresentationPart[];
  cargoSlots: THREE.Object3D[];
  muzzleSockets: Map<MuzzleSocketName, THREE.Object3D>;
  muzzleSocketNames: MuzzleSocketName[];
  repairToolSocket: THREE.Object3D | null;
  launcherPitch: THREE.Object3D | null;
  presentationSockets: Map<PresentationSocketName, THREE.Object3D>;
  damageSocketName: DamageSocketName | null;
  wreckAnchor: THREE.Object3D | null;
  authoredWreckRoot: THREE.Object3D | null;
  authoredWreckLiveNodes: PresentationVisibilityNode[];
  authoredWreckAge: number;
  authoredWreckDuration: number;
  authoredWreckActivationOrder: number;
  authoredBuildingRuinRoot: THREE.Object3D | null;
  authoredBuildingRuinLiveNodes: PresentationVisibilityNode[];
  authoredBuildingRuinMarkerAnchor: THREE.Object3D | null;
  authoredBuildingRuinAge: number;
  authoredBuildingRuinDuration: number;
  authoredBuildingRuinActivationOrder: number;
  destructionResiduePosition: Vec2 | null;
  constructionVisual: ConstructionVisual | null;
  unitKind: UnitKind | null;
  buildingKind: BuildingKind | null;
  motionPhase: number;
  motionAmount: number;
  activityTarget: number;
  activityAmount: number;
  productionProgress: number;
  productionKey: string;
  productionRemaining: number;
  productionActiveUntil: number;
  productionDoorHoldUntil: number;
  productionExitUntil: number;
  refineryUnloadStartedAt: number;
  refineryUnloadUntil: number;
  refineryMechanismPhase: number;
  refineryMechanismParts: RefineryMechanismPart[];
  doorOpenTarget: number;
  doorOpenAmount: number;
  constructionProgressObserved: number;
  constructionActiveUntil: number;
  constructionActive: boolean;
  animationMixer: THREE.AnimationMixer | null;
  animationActions: Map<string, THREE.AnimationAction>;
  animationState: string;
  buildProgress: number;
  bodyBaseY: number;
  bodyBaseX: number;
  bodyBaseZ: number;
  bodyBaseRotationX: number;
  bodyBaseRotationZ: number;
  turretBasePosition: THREE.Vector3 | null;
  recoilAmount: number;
  recoilStrength: number;
  hitAmount: number;
  hitDirectionX: number;
  hitDirectionZ: number;
  hitStrength: number;
  destructionAge: number;
  destructionDuration: number;
  destructionDirection: number;
  selected: boolean;
  lodTier: PresentationLodTier;
  lodGeometryTier: RenderablePresentationLodTier | null;
  lodPhase: number;
  lodAnimationDelta: number;
  lodAnimatedThisFrame: boolean;
  lodDetailNodes: PresentationDetailNode[];
  lodShadowCasters: PresentationShadowCaster[];
}

interface ActiveEffect {
  root: THREE.Object3D;
  age: number;
  duration: number;
  kind: CombatVfxKind;
  update: (progress: number, elapsed: number) => void;
}

interface AuthoredAssetTask {
  label: string;
  run: () => Promise<void>;
}

interface BeaconVisual {
  root: THREE.Group;
  controlRing: THREE.Mesh;
  progressDisc: THREE.Mesh;
  signal: THREE.Mesh;
}

const colorDescriptor = (color: THREE.Color): readonly number[] => [color.r, color.g, color.b];

const textureDescriptor = (texture: THREE.Texture): MaterialDescriptorValue => ({
  // UUIDs are runtime-instance identities, not authored names. Two GLBs may
  // both contain "BaseColor" without ever becoming texture-compatible here.
  runtimeTextureId: texture.uuid,
  runtimeSourceId: texture.source.uuid,
  mapping: texture.mapping,
  channel: texture.channel,
  colorSpace: texture.colorSpace,
  wrapS: texture.wrapS,
  wrapT: texture.wrapT,
  magFilter: texture.magFilter,
  minFilter: texture.minFilter,
  flipY: texture.flipY,
  premultiplyAlpha: texture.premultiplyAlpha,
  rotation: texture.rotation,
  offset: texture.offset.toArray(),
  repeat: texture.repeat.toArray(),
  center: texture.center.toArray(),
  matrixAutoUpdate: texture.matrixAutoUpdate,
});

/**
 * Convert a runtime Three.js material into the plain-data compatibility
 * descriptor consumed by imported-materials.ts. Named textures are never used
 * as identities; texture/source UUIDs prevent same-name cross-wiring.
 */
export function importedMaterialRuntimeDescriptor(material: THREE.Material): ImportedMaterialDescriptor {
  const textures: Record<string, MaterialDescriptorValue> = {};
  for (const [slot, value] of Object.entries(material)) {
    if (value instanceof THREE.Texture) textures[slot] = textureDescriptor(value);
  }
  const common: ImportedMaterialDescriptor = {
    name: material.name.trim() || `__runtime_material__:${material.uuid}`,
    shader: material.type,
    alphaTest: material.alphaTest,
    blending: material.blending,
    blendDst: material.blendDst,
    blendEquation: material.blendEquation,
    blendSrc: material.blendSrc,
    colorWrite: material.colorWrite,
    depthTest: material.depthTest,
    depthWrite: material.depthWrite,
    opacity: material.opacity,
    polygonOffset: material.polygonOffset,
    polygonOffsetFactor: material.polygonOffsetFactor,
    polygonOffsetUnits: material.polygonOffsetUnits,
    premultipliedAlpha: material.premultipliedAlpha,
    side: material.side,
    toneMapped: material.toneMapped,
    transparent: material.transparent,
    vertexColors: material.vertexColors,
    visible: material.visible,
    textures,
  };
  if (material instanceof THREE.MeshStandardMaterial) {
    return {
      ...common,
      color: colorDescriptor(material.color),
      emissive: colorDescriptor(material.emissive),
      emissiveIntensity: material.emissiveIntensity,
      roughness: material.roughness,
      metalness: material.metalness,
      normalMapType: material.normalMapType,
      normalScale: material.normalScale.toArray(),
      aoMapIntensity: material.aoMapIntensity,
      bumpScale: material.bumpScale,
      displacementBias: material.displacementBias,
      displacementScale: material.displacementScale,
      envMapIntensity: material.envMapIntensity,
      flatShading: material.flatShading,
      lightMapIntensity: material.lightMapIntensity,
      wireframe: material.wireframe,
    };
  }
  if (material instanceof THREE.MeshBasicMaterial) {
    return {
      ...common,
      color: colorDescriptor(material.color),
      combine: material.combine,
      fog: material.fog,
      reflectivity: material.reflectivity,
      refractionRatio: material.refractionRatio,
      wireframe: material.wireframe,
    };
  }
  // Unknown/custom material classes stay isolated even inside one GLB.
  return { ...common, runtimeMaterialId: material.uuid };
}

export function applyImportedFallbackColor(
  material: THREE.MeshStandardMaterial,
  color: number | undefined,
): void {
  if (color === undefined || material.map !== null) return;
  material.color.setHex(color);
}

export function visibleCargoSlotCount(cargo: number, capacity: number, slotCount = 3): number {
  const slots = Number.isFinite(slotCount) ? Math.max(0, Math.floor(slotCount)) : 0;
  if (slots === 0 || !Number.isFinite(cargo) || !Number.isFinite(capacity) || cargo <= 0 || capacity <= 0) return 0;
  return Math.min(slots, Math.max(1, Math.ceil((Math.min(cargo, capacity) / capacity) * slots)));
}

export function healthOverlayMaterialParameters(
  color: THREE.ColorRepresentation,
  opacity = 1,
): THREE.MeshBasicMaterialParameters {
  return {
    color,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  };
}

export function screenSpaceEntityPickRadius(
  pickRadius: number,
  viewHeight: number,
  viewportHeight: number,
  entityType: WorldEntity['entityType'],
): number {
  if (![pickRadius, viewHeight, viewportHeight].every(Number.isFinite) || viewHeight <= 0 || viewportHeight <= 0) {
    return 9;
  }
  const projected = Math.max(9, (Math.max(0, pickRadius) / viewHeight) * viewportHeight);
  return entityType === 'building' ? Math.max(18, projected * 1.35) : projected;
}

export function productionProgress(remaining: number, total: number): number {
  if (!Number.isFinite(remaining) || !Number.isFinite(total) || total <= 0) return 0;
  return THREE.MathUtils.clamp((total - remaining) / total, 0, 1);
}

export function productionDoorOpenTarget(active: boolean, remaining: number, total: number): number {
  if (!active) return 0;
  const progress = productionProgress(remaining, total);
  const latePhase = THREE.MathUtils.clamp((progress - 0.62) / 0.38, 0, 1);
  const eased = latePhase * latePhase * (3 - 2 * latePhase);
  return 0.28 + eased * 0.72;
}

export function productionDoorPresentationTarget(
  active: boolean,
  remaining: number,
  total: number,
  holdingForExit: boolean,
): number {
  return holdingForExit ? 1 : productionDoorOpenTarget(active, remaining, total);
}

export function refineryMechanismRole(
  nodeName: string,
  presentationRole: unknown,
): RefineryMechanismRole | null {
  if (nodeName === 'intake_gate' || presentationRole === 'deposit_gate') return 'gate';
  if (nodeName === 'intake_conveyor' || presentationRole === 'deposit_conveyor') return 'conveyor';
  if (nodeName === 'intake_collector' || presentationRole === 'deposit_collector') return 'collector';
  return null;
}

export function hasCompleteRefineryMechanism(roles: readonly RefineryMechanismRole[]): boolean {
  const available = new Set(roles);
  return available.has('gate') && available.has('conveyor') && available.has('collector');
}

export interface RefineryUnloadPresentation {
  gate: number;
  mechanism: number;
}

/**
 * Presentation-only unload envelope. Repeated deposits may extend `until`
 * without restarting the opening phase; simulation economy remains authoritative.
 */
export function refineryUnloadPresentation(
  now: number,
  startedAt: number,
  until: number,
  reducedMotion: boolean,
): RefineryUnloadPresentation {
  if (![now, startedAt, until].every(Number.isFinite) || now < startedAt || now >= until || until <= startedAt) {
    return { gate: 0, mechanism: 0 };
  }
  if (reducedMotion) return { gate: 1, mechanism: 0 };
  const elapsed = now - startedAt;
  const remaining = until - now;
  const smooth = (value: number): number => {
    const t = THREE.MathUtils.clamp(value, 0, 1);
    return t * t * (3 - 2 * t);
  };
  const gate = Math.min(smooth(elapsed / 0.16), smooth(remaining / 0.29));
  const mechanism = Math.min(smooth((elapsed - 0.1) / 0.12), smooth((remaining - 0.08) / 0.18));
  return { gate, mechanism };
}

export function buildingDamageVisualStage(
  hp: number,
  maxHp: number,
  buildProgress = 1,
): BuildingDamageVisualStage {
  if (
    !Number.isFinite(hp)
    || !Number.isFinite(maxHp)
    || !Number.isFinite(buildProgress)
    || maxHp <= 0
    || buildProgress < AUTHORED_BUILDING_DAMAGE_POLICY.buildCompleteAt
  ) return 'none';
  const ratio = THREE.MathUtils.clamp(hp / maxHp, 0, 1);
  if (ratio <= AUTHORED_BUILDING_DAMAGE_POLICY.criticalAt) return 'critical';
  if (ratio <= AUTHORED_BUILDING_DAMAGE_POLICY.damagedAt) return 'damaged';
  return 'none';
}

export function authoredBuildingDamageRole(
  name: string,
  presentationRole: unknown,
): AuthoredBuildingDamageRole | null {
  if (name === 'damage_visual_damaged' || presentationRole === 'building_damage_damaged') return 'damaged';
  if (name === 'damage_visual_critical' || presentationRole === 'building_damage_critical') return 'critical';
  return null;
}

export function authoredBuildingDamageVisibility(
  stage: BuildingDamageVisualStage,
): Readonly<Record<AuthoredBuildingDamageRole, boolean>> {
  return {
    damaged: stage === 'damaged',
    critical: stage === 'critical',
  };
}

export const CONSTRUCTION_PRESENTATION_POLICY = Object.freeze({
  version: 'construction-stages-v1',
  foundationEnd: 0.28,
  frameEnd: 0.68,
  completeAt: 0.995,
  frameInstancesPerSite: 12,
  siteCapacity: 64,
  drawCallCeiling: 4,
  textures: 0,
});

export interface ConstructionStagePresentation {
  stage: ConstructionPresentationStage;
  foundationVisible: boolean;
  frameVisible: boolean;
  shellVisible: boolean;
  bodyVisible: boolean;
  bodyScaleY: 1;
}

/** Maps authoritative build progress to a natural-proportion, presentation-only stage. */
export function constructionStagePresentation(buildProgress: number): ConstructionStagePresentation {
  const progress = THREE.MathUtils.clamp(Number.isFinite(buildProgress) ? buildProgress : 0, 0, 1);
  const stage: ConstructionPresentationStage = progress >= CONSTRUCTION_PRESENTATION_POLICY.completeAt
    ? 'complete'
    : progress >= CONSTRUCTION_PRESENTATION_POLICY.frameEnd
      ? 'shell'
      : progress >= CONSTRUCTION_PRESENTATION_POLICY.foundationEnd
        ? 'frame'
        : 'foundation';
  const complete = stage === 'complete';
  return {
    stage,
    foundationVisible: !complete,
    frameVisible: stage === 'frame' || stage === 'shell',
    shellVisible: stage === 'shell',
    bodyVisible: stage === 'shell' || complete,
    bodyScaleY: 1,
  };
}

/** Only authoritative forward progress may wake the short-lived construction scan. */
export function constructionProgressAdvanced(previous: number, next: number): boolean {
  return Number.isFinite(previous)
    && Number.isFinite(next)
    && next < CONSTRUCTION_PRESENTATION_POLICY.completeAt
    && next > previous + 0.000001;
}

export function shouldBatchConstructionPresentation(
  stage: ConstructionPresentationStage,
  disclosedAndVisible: boolean,
  destructionAge: number,
): boolean {
  return disclosedAndVisible
    && stage !== 'complete'
    && Number.isFinite(destructionAge)
    && destructionAge < 0;
}

export function constructionScanPulse(
  active: boolean,
  reducedMotion: boolean,
  time: number,
  phase: number,
): number {
  if (!active) return 0;
  if (reducedMotion || !Number.isFinite(time) || !Number.isFinite(phase)) return 1;
  return 0.86 + Math.sin(time * 5.5 + phase) * 0.14;
}

export interface ConstructionPresentationBudget {
  drawCalls: number;
  visibleTrianglesUpperBound: number;
  textures: number;
}

/** Four box-geometry batches: slab, 12 frame members, shell proxy, and active scan. */
export function constructionPresentationBudget(siteCount: number): ConstructionPresentationBudget {
  const sites = Math.max(0, Math.floor(Number.isFinite(siteCount) ? siteCount : 0));
  const boxTriangles = 12;
  return {
    drawCalls: sites > 0 ? CONSTRUCTION_PRESENTATION_POLICY.drawCallCeiling : 0,
    visibleTrianglesUpperBound: sites
      * (1 + CONSTRUCTION_PRESENTATION_POLICY.frameInstancesPerSite + 1 + 1)
      * boxTriangles,
    textures: CONSTRUCTION_PRESENTATION_POLICY.textures,
  };
}

export interface ImpactVisualProfile {
  kind: ImpactVisualKind;
  size: number;
  duration: number;
  scorchSize: number;
  smokeSize: number;
  debris: boolean;
}

/** Pure presentation contract: it does not change simulation damage, event radius, or hit timing. */
export const COMBAT_VFX_READABILITY_V2 = Object.freeze({
  version: 'heavy-impact-v2',
  heavy: Object.freeze({
    duration: 0.6,
    reducedMotionDuration: 0.18,
    // Stricter than the 4.2m / 4.6m safety ceiling: at 900px / 48m these stay under 85px.
    maxContactRingRadius: 2.2,
    maxShockwaveRadius: 2.25,
    shockwaveOpacity: 0.3,
    caps: Object.freeze({ low: 2, medium: 3, high: 4 }),
    reducedMotionCap: 2,
  }),
});

export interface ImpactVfxLayerMetrics {
  ringRadius: number;
  shockwaveRadius: number;
  flashScale: number;
  fireScale: number;
  groundFlashScale: number;
  groundFlashRadius: number;
  blastUpperScaleXZ: number;
  blastUpperScaleY: number;
  blastUpperCenterY: number;
  upperExtent: number;
}

/**
 * Resolve the visible contact envelope in world metres. Ballistic coefficients are the v1 values;
 * heavy ordnance has its own bounded hierarchy so weapon size cannot compound into screen-filling rings.
 */
export function impactVfxLayerMetrics(
  kind: ImpactVisualKind,
  size: number,
  progress: number,
  target?: ImpactVfxLayerMetrics,
): ImpactVfxLayerMetrics {
  const safeSize = Number.isFinite(size) ? Math.max(0, size) : 0;
  const safeProgress = THREE.MathUtils.clamp(Number.isFinite(progress) ? progress : 0, 0, 1);
  const metrics = target ?? {
    ringRadius: 0,
    shockwaveRadius: 0,
    flashScale: 0,
    fireScale: 0,
    groundFlashScale: 0,
    groundFlashRadius: 0,
    blastUpperScaleXZ: 0,
    blastUpperScaleY: 0,
    blastUpperCenterY: 0,
    upperExtent: 0,
  };
  if (kind === 'ballistic') {
    const ringRadius = safeSize * (0.45 + safeProgress * 1.25);
    const flashScale = safeSize * (0.8 + safeProgress * 0.7);
    const fireScale = safeSize * (0.68 + safeProgress * 0.48);
    const groundFlashScale = safeSize * (0.55 + safeProgress * 1.45);
    metrics.ringRadius = ringRadius;
    metrics.shockwaveRadius = 0;
    metrics.flashScale = flashScale;
    metrics.fireScale = fireScale;
    metrics.groundFlashScale = groundFlashScale;
    metrics.groundFlashRadius = groundFlashScale * 0.72;
    metrics.blastUpperScaleXZ = 0;
    metrics.blastUpperScaleY = 0;
    metrics.blastUpperCenterY = 0;
    metrics.upperExtent = Math.max(0.42 + flashScale * 0.45, 0.32 + fireScale * 0.34);
    return metrics;
  }

  const ringRadius = Math.min(
    COMBAT_VFX_READABILITY_V2.heavy.maxContactRingRadius,
    safeSize * (0.48 + safeProgress * 0.38),
  );
  const shockwaveRadius = Math.min(
    COMBAT_VFX_READABILITY_V2.heavy.maxShockwaveRadius,
    safeSize * (0.55 + safeProgress * 0.5),
  );
  const flashScale = safeSize * (1.05 + safeProgress * 0.33);
  const fireScale = safeSize * (0.9 + safeProgress * 0.36);
  const groundFlashScale = safeSize * (0.78 + safeProgress * 0.75);
  const blastUpperScaleXZ = safeSize * (0.64 + safeProgress * 0.5);
  const blastUpperScaleY = safeSize * (0.78 + safeProgress * 0.3);
  const blastUpperCenterY = 0.68 + Math.sin(safeProgress * Math.PI) * safeSize * 0.28;
  metrics.ringRadius = ringRadius;
  metrics.shockwaveRadius = shockwaveRadius;
  metrics.flashScale = flashScale;
  metrics.fireScale = fireScale;
  metrics.groundFlashScale = groundFlashScale;
  metrics.groundFlashRadius = groundFlashScale * 0.72;
  metrics.blastUpperScaleXZ = blastUpperScaleXZ;
  metrics.blastUpperScaleY = blastUpperScaleY;
  metrics.blastUpperCenterY = blastUpperCenterY;
  metrics.upperExtent = Math.max(
    0.42 + flashScale * 0.45,
    0.32 + fireScale * 0.34,
    blastUpperCenterY + blastUpperScaleY * 0.42,
  );
  return metrics;
}

export function resolvedImpactVfxDuration(
  kind: ImpactVisualKind,
  requestedDuration: number,
  reducedMotion: boolean,
): number {
  const fallback = kind === 'heavy' ? COMBAT_VFX_READABILITY_V2.heavy.duration : 0.34;
  const safeDuration = Number.isFinite(requestedDuration) ? Math.max(0.01, requestedDuration) : fallback;
  if (kind === 'ballistic') return safeDuration;
  return Math.min(
    safeDuration,
    reducedMotion
      ? COMBAT_VFX_READABILITY_V2.heavy.reducedMotionDuration
      : COMBAT_VFX_READABILITY_V2.heavy.duration,
  );
}

export function impactVisualProfile(
  radius = 0,
  damage = 0,
  heavyOrdnance = false,
): ImpactVisualProfile {
  const safeRadius = Number.isFinite(radius) ? Math.max(0, radius) : 0;
  const safeDamage = Number.isFinite(damage) ? Math.max(0, damage) : 0;
  const heavy = heavyOrdnance || safeRadius >= 1.2 || safeDamage >= 100;
  if (!heavy) {
    return {
      kind: 'ballistic',
      size: THREE.MathUtils.clamp(0.72 + safeDamage / 180, 0.72, 1.12),
      duration: 0.34,
      scorchSize: 0,
      smokeSize: 0,
      debris: false,
    };
  }
  const size = THREE.MathUtils.clamp(1.55 + Math.max(safeRadius * 0.38, safeDamage / 300), 1.55, 3.15);
  return {
    kind: 'heavy',
    size,
    duration: COMBAT_VFX_READABILITY_V2.heavy.duration,
    scorchSize: size * 0.92,
    smokeSize: size * 0.76,
    debris: true,
  };
}

export interface DisclosedImpactPresentation {
  team: Team;
  profile: Readonly<ImpactVisualProfile>;
  reactionDamage: number;
}

const ANONYMOUS_CONTACT_PROFILE: Readonly<ImpactVisualProfile> = Object.freeze({
  kind: 'ballistic',
  size: 0.84,
  duration: 0.32,
  scorchSize: 0,
  smokeSize: 0,
  debris: false,
});

/** Prevent an undisclosed attacker from leaking faction, damage, or weapon class. */
export function disclosedImpactPresentation(
  sourceDisclosed: boolean,
  team: Team | undefined,
  radius: number | undefined,
  damage: number | undefined,
  heavyOrdnance: boolean,
): DisclosedImpactPresentation {
  if (!sourceDisclosed) {
    return { team: 'neutral', profile: ANONYMOUS_CONTACT_PROFILE, reactionDamage: 24 };
  }
  return {
    team: team ?? 'neutral',
    profile: impactVisualProfile(radius, damage, heavyOrdnance),
    reactionDamage: Number.isFinite(damage) ? Math.max(0, damage ?? 0) : 24,
  };
}

const VFX_CAPS: Readonly<Record<CombatVfxKind, Readonly<Record<RenderQualityLevel, number>>>> = {
  projectile: { low: 18, medium: 28, high: 36 },
  muzzle: { low: 12, medium: 20, high: 28 },
  'ballistic-impact': { low: 14, medium: 24, high: 32 },
  'heavy-explosion': COMBAT_VFX_READABILITY_V2.heavy.caps,
  smoke: { low: 4, medium: 8, high: 12 },
  debris: { low: 0, medium: 6, high: 10 },
  scorch: { low: 6, medium: 12, high: 18 },
  residue: { low: 4, medium: 8, high: 12 },
  'economy-transfer': { low: 2, medium: 4, high: 6 },
  signal: { low: 10, medium: 14, high: 18 },
  dust: { low: 0, medium: 14, high: 24 },
};

const REDUCED_MOTION_VFX_CAPS: Readonly<Record<CombatVfxKind, number>> = {
  projectile: 8,
  muzzle: 8,
  'ballistic-impact': 8,
  'heavy-explosion': COMBAT_VFX_READABILITY_V2.heavy.reducedMotionCap,
  smoke: 2,
  debris: 0,
  scorch: 6,
  residue: 4,
  'economy-transfer': 2,
  signal: 6,
  dust: 0,
};

export function combatVfxCap(kind: CombatVfxKind, quality: RenderQualityLevel, reducedMotion: boolean): number {
  const qualityCap = VFX_CAPS[kind][quality];
  return reducedMotion ? Math.min(qualityCap, REDUCED_MOTION_VFX_CAPS[kind]) : qualityCap;
}

export const AUTHORED_VEHICLE_WRECK_POLICY = {
  version: 'authored-vehicle-wreck-v1',
  unitKinds: ['tank', 'harvester'] as const,
  lowLifetimeSeconds: 14,
  fullLifetimeSeconds: 34,
} as const;

export const AUTHORED_BUILDING_RUIN_POLICY = {
  version: 'authored-building-ruin-v2',
  buildingKinds: ['hq', 'factory', 'barracks', 'reactor'] as const,
  lowLifetimeSeconds: 14,
  fullLifetimeSeconds: 34,
} as const;

export type DestructionResidueFamily =
  | 'none'
  | 'light-vehicle'
  | 'wide-armor'
  | 'artillery'
  | 'tracked-vehicle'
  | 'building-rubble'
  | 'unknown-debris';

export const GENERIC_DESTRUCTION_RESIDUE_POLICY = {
  version: 'semantic-generic-residue-v1',
  maxMeshesPerResidue: 4,
  meshCountByFamily: {
    none: 0,
    'light-vehicle': 4,
    'wide-armor': 4,
    artillery: 4,
    'tracked-vehicle': 4,
    'building-rubble': 4,
    'unknown-debris': 3,
  } satisfies Readonly<Record<DestructionResidueFamily, number>>,
} as const;

const UNIT_DESTRUCTION_RESIDUE_FAMILY = {
  scout: 'light-vehicle',
  rifle: 'none',
  antitank: 'none',
  engineer: 'none',
  suppressor: 'wide-armor',
  tank: 'tracked-vehicle',
  artillery: 'artillery',
  harvester: 'tracked-vehicle',
} as const satisfies Readonly<Record<UnitKind, DestructionResidueFamily>>;

export const RENDERED_DESTRUCTION_RESIDUE_FAMILIES = [
  'light-vehicle',
  'wide-armor',
  'artillery',
  'tracked-vehicle',
  'building-rubble',
  'unknown-debris',
] as const;

export type RenderedDestructionResidueFamily = (typeof RENDERED_DESTRUCTION_RESIDUE_FAMILIES)[number];

export function countGenericDestructionResidueFamilies(
  families: readonly unknown[],
): Record<RenderedDestructionResidueFamily, number> {
  const counts = Object.fromEntries(
    RENDERED_DESTRUCTION_RESIDUE_FAMILIES.map((family) => [family, 0]),
  ) as Record<RenderedDestructionResidueFamily, number>;
  for (const family of families) {
    if (typeof family !== 'string' || !Object.prototype.hasOwnProperty.call(counts, family)) continue;
    counts[family as RenderedDestructionResidueFamily] += 1;
  }
  return counts;
}

const AUTHORED_VEHICLE_WRECK_KINDS = new Set<UnitKind>(AUTHORED_VEHICLE_WRECK_POLICY.unitKinds);
const AUTHORED_BUILDING_RUIN_KINDS = new Set<BuildingKind>(AUTHORED_BUILDING_RUIN_POLICY.buildingKinds);

export function isAuthoredWreckRoot(name: string, presentationRole: unknown): boolean {
  return name === 'wreck_visual_root' || presentationRole === 'wreck_visual';
}

export function shouldUseAuthoredVehicleWreck(
  unitKind: UnitKind | null,
  hasAuthoredRoot: boolean,
): boolean {
  return unitKind !== null && AUTHORED_VEHICLE_WRECK_KINDS.has(unitKind) && hasAuthoredRoot;
}

export function isAuthoredBuildingRuinRoot(name: string, presentationRole: unknown): boolean {
  return name === 'ruin_visual_root'
    || presentationRole === 'building_ruin'
    || presentationRole === 'building_ruin_visual';
}

export function shouldUseAuthoredBuildingRuin(
  buildingKind: BuildingKind | null,
  hasAuthoredRoot: boolean,
): boolean {
  return buildingKind !== null && AUTHORED_BUILDING_RUIN_KINDS.has(buildingKind) && hasAuthoredRoot;
}

export function authoredVehicleWreckLifetime(
  quality: RenderQualityLevel,
  reducedMotion: boolean,
): number {
  return reducedMotion || quality === 'low'
    ? AUTHORED_VEHICLE_WRECK_POLICY.lowLifetimeSeconds
    : AUTHORED_VEHICLE_WRECK_POLICY.fullLifetimeSeconds;
}

export function authoredBuildingRuinLifetime(
  quality: RenderQualityLevel,
  reducedMotion: boolean,
): number {
  return reducedMotion || quality === 'low'
    ? AUTHORED_BUILDING_RUIN_POLICY.lowLifetimeSeconds
    : AUTHORED_BUILDING_RUIN_POLICY.fullLifetimeSeconds;
}

/** Exhaustive semantic fallback mapping; infantry deliberately leaves no persistent geometry. */
export function destructionResidueFamilyForKind(
  unitKind: UnitKind | null,
  buildingKind: BuildingKind | null,
): DestructionResidueFamily {
  if (buildingKind !== null) return 'building-rubble';
  if (unitKind !== null) return UNIT_DESTRUCTION_RESIDUE_FAMILY[unitKind];
  return 'unknown-debris';
}

export function genericDestructionResidueLifetime(
  quality: RenderQualityLevel,
  reducedMotion: boolean,
): number {
  return authoredVehicleWreckLifetime(quality, reducedMotion);
}

/** Own persistent residues retain their marker; enemy markers never reveal through fog. */
export function shouldShowPersistentFactionMarker(
  team: Team,
  persistent: boolean,
  positionVisible: boolean,
): boolean {
  return !persistent || team === 'player' || positionVisible;
}

export function authoredVehicleWreckCap(
  quality: RenderQualityLevel,
  reducedMotion: boolean,
): number {
  return combatVfxCap('residue', quality, reducedMotion);
}

export interface AuthoredWreckBudgetEntry {
  id: string;
  activationOrder: number;
}

/** Keeps the newest authored wrecks with a stable id tiebreaker. */
export function authoredWreckSurvivorIds(
  entries: ReadonlyArray<AuthoredWreckBudgetEntry>,
  cap: number,
): string[] {
  const safeCap = Number.isFinite(cap) ? Math.max(0, Math.floor(cap)) : 0;
  return [...entries]
    .sort((left, right) => left.activationOrder - right.activationOrder || left.id.localeCompare(right.id))
    .slice(Math.max(0, entries.length - safeCap))
    .map((entry) => entry.id);
}

export async function runBoundedAssetTasks(
  tasks: ReadonlyArray<() => Promise<void>>,
  concurrency: number,
): Promise<void> {
  const workerCount = Math.max(1, Math.min(Math.floor(concurrency), tasks.length));
  let cursor = 0;
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < tasks.length) {
      const task = tasks[cursor];
      cursor += 1;
      if (task) await task();
    }
  });
  await Promise.all(workers);
}

interface BuildGhostVisual {
  root: THREE.Group;
  kind: BuildingKind;
  valid: boolean;
  modelKey: string;
  assetRevision: number;
}

export async function recoverAssetLoaderInitialization(
  initialization: Promise<void>,
  onFailure: (error: unknown) => void,
): Promise<void> {
  try {
    await initialization;
  } catch (error) {
    onFailure(error);
  }
}

/** A destroyed event has already passed position visibility filtering. */
export function previousVisualForVisibleDestruction<T>(
  targetId: string | undefined,
  visuals: ReadonlyMap<string, T>,
): T | undefined {
  return targetId ? visuals.get(targetId) : undefined;
}

/** Own losses are always disclosed; enemy losses still obey current fog visibility. */
export function shouldDiscloseDestroyedEvent(team: Team | undefined, positionVisible: boolean): boolean {
  return team === 'player' || positionVisible;
}

export function buildGhostAssetModelKey(
  kind: BuildingKind,
  authored: boolean,
  assetRevision: number,
): string {
  const revision = Number.isFinite(assetRevision) ? Math.max(0, Math.floor(assetRevision)) : 0;
  return `building:player:${kind}:${authored ? 'authored' : 'fallback'}:r${revision}`;
}

export type VisualGoldGroundPurpose =
  | 'service-apron'
  | 'entrance-route'
  | 'route-shoulder'
  | 'surface-wear'
  | 'faction-marking'
  | 'wayfinding-landmark';

export type VisualGoldGroundMaterial =
  | 'concrete'
  | 'road'
  | 'roadEdge'
  | 'trackMark'
  | 'playerTeam'
  | 'marking';

export interface VisualGoldGroundInstance {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly rotation: number;
}

export interface VisualGoldGroundBatch {
  readonly id: string;
  readonly purpose: VisualGoldGroundPurpose;
  readonly geometry: 'box' | 'disc';
  readonly material: VisualGoldGroundMaterial;
  readonly collision: 'none';
  readonly navigation: 'none';
  readonly instances: ReadonlyArray<Readonly<VisualGoldGroundInstance>>;
}

interface VisualGoldRouteSegment {
  readonly id: string;
  readonly startX: number;
  readonly startZ: number;
  readonly endX: number;
  readonly endZ: number;
  readonly width: number;
}

const VISUAL_GOLD_ROUTE_SEGMENTS: ReadonlyArray<VisualGoldRouteSegment> = [
  { id: 'hq-throat', startX: -10, startZ: 12.4, endX: -10, endZ: 22, width: 5.4 },
  { id: 'hq-merge', startX: -10, startZ: 22, endX: -2, endZ: 26, width: 5.4 },
  { id: 'factory-throat', startX: 4, startZ: 9.8, endX: 4, endZ: 22, width: 6.4 },
  { id: 'factory-merge', startX: 4, startZ: 22, endX: -2, endZ: 26, width: 6.4 },
  { id: 'outbound-spine', startX: -2, startZ: 26, endX: 10, endZ: 32, width: 6.4 },
];

function visualGoldSegmentInstance(
  segment: VisualGoldRouteSegment,
  y: number,
  height: number,
  width = segment.width,
  lateralOffset = 0,
  idSuffix = '',
): VisualGoldGroundInstance {
  const dx = segment.endX - segment.startX;
  const dz = segment.endZ - segment.startZ;
  const length = Math.hypot(dx, dz);
  const rightX = dz / length;
  const rightZ = -dx / length;
  return {
    id: `visual-gold-${segment.id}${idSuffix}`,
    x: (segment.startX + segment.endX) * 0.5 + rightX * lateralOffset,
    y,
    z: (segment.startZ + segment.endZ) * 0.5 + rightZ * lateralOffset,
    width,
    height,
    depth: length + 0.08,
    rotation: Math.atan2(dx, dz),
  };
}

const VISUAL_GOLD_ROUTE_SURFACES = VISUAL_GOLD_ROUTE_SEGMENTS.map((segment) =>
  visualGoldSegmentInstance(segment, 0.0105, 0.007),
);

const VISUAL_GOLD_ROUTE_SHOULDERS = VISUAL_GOLD_ROUTE_SEGMENTS.flatMap((segment) => {
  const shoulderWidth = 0.62;
  const lateral = segment.width * 0.5 + shoulderWidth * 0.5;
  return [
    visualGoldSegmentInstance(segment, 0.0105, 0.007, shoulderWidth, -lateral, '-shoulder-left'),
    visualGoldSegmentInstance(segment, 0.0105, 0.007, shoulderWidth, lateral, '-shoulder-right'),
  ];
});

/**
 * Deterministic, fixture-only ground dressing for the desktop visual gold frame.
 * Every batch is presentation-only, stays on the y=0 gameplay plane and is
 * intentionally absent from collision, navigation, selection and simulation.
 */
export const VISUAL_GOLD_GROUND_DRESSING: ReadonlyArray<Readonly<VisualGoldGroundBatch>> = [
  {
    id: 'visual-gold-review-service-aprons',
    purpose: 'service-apron',
    geometry: 'box',
    material: 'concrete',
    collision: 'none',
    navigation: 'none',
    instances: [
      { id: 'visual-gold-hq-apron', x: -10, y: 0.0105, z: 7, width: 15.2, height: 0.007, depth: 13.4, rotation: 0 },
      { id: 'visual-gold-factory-apron', x: 4, y: 0.0105, z: 5, width: 14.4, height: 0.007, depth: 12.2, rotation: 0 },
      { id: 'visual-gold-shared-service-yard', x: -2.5, y: 0.0105, z: 14.6, width: 20.8, height: 0.007, depth: 5.8, rotation: 0 },
    ],
  },
  {
    id: 'visual-gold-review-entrance-route',
    purpose: 'entrance-route',
    geometry: 'box',
    material: 'road',
    collision: 'none',
    navigation: 'none',
    instances: VISUAL_GOLD_ROUTE_SURFACES,
  },
  {
    id: 'visual-gold-review-route-shoulders',
    purpose: 'route-shoulder',
    geometry: 'box',
    material: 'roadEdge',
    collision: 'none',
    navigation: 'none',
    instances: VISUAL_GOLD_ROUTE_SHOULDERS,
  },
  {
    id: 'visual-gold-review-service-wear-and-oil',
    purpose: 'surface-wear',
    geometry: 'disc',
    material: 'trackMark',
    collision: 'none',
    navigation: 'none',
    instances: [
      { id: 'visual-gold-hq-wear-01', x: -13.2, y: 0.014, z: 8.8, width: 2.4, height: 0, depth: 0.75, rotation: -0.26 },
      { id: 'visual-gold-hq-wear-02', x: -7.1, y: 0.014, z: 11.2, width: 1.65, height: 0, depth: 0.58, rotation: 0.34 },
      { id: 'visual-gold-hq-oil-01', x: -11.2, y: 0.014, z: 14.1, width: 1.2, height: 0, depth: 0.58, rotation: -0.48 },
      { id: 'visual-gold-factory-wear-01', x: 0.8, y: 0.014, z: 7.4, width: 2.6, height: 0, depth: 0.72, rotation: 0.18 },
      { id: 'visual-gold-factory-wear-02', x: 6.6, y: 0.014, z: 8.5, width: 1.9, height: 0, depth: 0.62, rotation: -0.22 },
      { id: 'visual-gold-factory-oil-01', x: 4.7, y: 0.014, z: 13.2, width: 1.45, height: 0, depth: 0.72, rotation: 0.38 },
      { id: 'visual-gold-route-wear-01', x: -10.4, y: 0.014, z: 18.2, width: 2.15, height: 0, depth: 0.64, rotation: 0.06 },
      { id: 'visual-gold-route-wear-02', x: 4.2, y: 0.014, z: 18.8, width: 2.45, height: 0, depth: 0.68, rotation: -0.08 },
      { id: 'visual-gold-route-wear-03', x: -5.2, y: 0.014, z: 24.1, width: 2.3, height: 0, depth: 0.62, rotation: 0.92 },
      { id: 'visual-gold-route-wear-04', x: 0.7, y: 0.014, z: 24.5, width: 1.85, height: 0, depth: 0.55, rotation: -0.78 },
      { id: 'visual-gold-route-wear-05', x: 4.3, y: 0.014, z: 29.2, width: 2.1, height: 0, depth: 0.62, rotation: 1.08 },
    ],
  },
  {
    id: 'visual-gold-review-player-corner-markers',
    purpose: 'faction-marking',
    geometry: 'box',
    material: 'playerTeam',
    collision: 'none',
    navigation: 'none',
    instances: [
      { id: 'visual-gold-hq-corner-nw', x: -15.7, y: 0.012, z: 12.8, width: 2.3, height: 0.004, depth: 0.34, rotation: 0.62 },
      { id: 'visual-gold-hq-corner-ne', x: -4.3, y: 0.012, z: 12.8, width: 2.3, height: 0.004, depth: 0.34, rotation: -0.62 },
      { id: 'visual-gold-hq-throat-left', x: -12.15, y: 0.012, z: 16.2, width: 1.7, height: 0.004, depth: 0.3, rotation: 0.68 },
      { id: 'visual-gold-hq-throat-right', x: -7.85, y: 0.012, z: 16.2, width: 1.7, height: 0.004, depth: 0.3, rotation: -0.68 },
      { id: 'visual-gold-factory-corner-nw', x: -1.6, y: 0.012, z: 10.5, width: 2.3, height: 0.004, depth: 0.34, rotation: 0.62 },
      { id: 'visual-gold-factory-corner-ne', x: 9.6, y: 0.012, z: 10.5, width: 2.3, height: 0.004, depth: 0.34, rotation: -0.62 },
      { id: 'visual-gold-factory-throat-left', x: 1.4, y: 0.012, z: 15.4, width: 1.8, height: 0.004, depth: 0.3, rotation: 0.68 },
      { id: 'visual-gold-factory-throat-right', x: 6.6, y: 0.012, z: 15.4, width: 1.8, height: 0.004, depth: 0.3, rotation: -0.68 },
      { id: 'visual-gold-merge-chevron-left', x: -3.4, y: 0.012, z: 24.9, width: 1.9, height: 0.004, depth: 0.32, rotation: 0.34 },
      { id: 'visual-gold-merge-chevron-right', x: -0.8, y: 0.012, z: 24.9, width: 1.9, height: 0.004, depth: 0.32, rotation: -0.34 },
      { id: 'visual-gold-spine-chevron-left', x: 2.6, y: 0.012, z: 28.2, width: 2.0, height: 0.004, depth: 0.32, rotation: 0.72 },
      { id: 'visual-gold-spine-chevron-right', x: 4.2, y: 0.012, z: 29.8, width: 2.0, height: 0.004, depth: 0.32, rotation: 0.38 },
    ],
  },
  {
    id: 'visual-gold-review-wayfinding-tabs',
    purpose: 'wayfinding-landmark',
    geometry: 'box',
    material: 'marking',
    collision: 'none',
    navigation: 'none',
    instances: [
      { id: 'visual-gold-hq-tab-left', x: -13.05, y: 0.012, z: 20.4, width: 0.62, height: 0.004, depth: 1.35, rotation: 0 },
      { id: 'visual-gold-hq-tab-right', x: -6.95, y: 0.012, z: 20.4, width: 0.62, height: 0.004, depth: 1.35, rotation: 0 },
      { id: 'visual-gold-factory-tab-left', x: 0.48, y: 0.012, z: 20.1, width: 0.62, height: 0.004, depth: 1.35, rotation: 0 },
      { id: 'visual-gold-factory-tab-right', x: 7.52, y: 0.012, z: 20.1, width: 0.62, height: 0.004, depth: 1.35, rotation: 0 },
      { id: 'visual-gold-merge-tab-left', x: -4.2, y: 0.012, z: 26.7, width: 0.72, height: 0.004, depth: 1.25, rotation: 1.08 },
      { id: 'visual-gold-merge-tab-right', x: 0.2, y: 0.012, z: 27.2, width: 0.72, height: 0.004, depth: 1.25, rotation: -0.78 },
      { id: 'visual-gold-spine-tab-left', x: 1.8, y: 0.012, z: 28.1, width: 0.72, height: 0.004, depth: 1.4, rotation: 1.08 },
      { id: 'visual-gold-spine-tab-right', x: 6.1, y: 0.012, z: 30.25, width: 0.72, height: 0.004, depth: 1.4, rotation: 1.08 },
    ],
  },
];

export interface VisualGoldGroundDressingMetrics {
  readonly drawCalls: number;
  readonly instanceCount: number;
  readonly visibleTrianglesUpperBound: number;
  readonly maxY: number;
}

export function visualGoldGroundDressingMetrics(
  batches: ReadonlyArray<Readonly<VisualGoldGroundBatch>> = VISUAL_GOLD_GROUND_DRESSING,
): VisualGoldGroundDressingMetrics {
  let instanceCount = 0;
  let visibleTrianglesUpperBound = 0;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const batch of batches) {
    const trianglesPerInstance = batch.geometry === 'box' ? 12 : 24;
    instanceCount += batch.instances.length;
    visibleTrianglesUpperBound += batch.instances.length * trianglesPerInstance;
    for (const instance of batch.instances) {
      const top = batch.geometry === 'box' ? instance.y + instance.height * 0.5 : instance.y;
      maxY = Math.max(maxY, top);
    }
  }
  return {
    drawCalls: batches.length,
    instanceCount,
    visibleTrianglesUpperBound,
    maxY: Number.isFinite(maxY) ? maxY : 0,
  };
}

interface MaterialPalette {
  ground: THREE.MeshStandardMaterial;
  earth: THREE.MeshStandardMaterial;
  earthDark: THREE.MeshStandardMaterial;
  road: THREE.MeshStandardMaterial;
  roadEdge: THREE.MeshStandardMaterial;
  roadMarking: THREE.MeshStandardMaterial;
  contactShadow: THREE.MeshBasicMaterial;
  trackMark: THREE.MeshBasicMaterial;
  defenseFootprint: THREE.MeshBasicMaterial;
  groundScar: THREE.MeshBasicMaterial;
  dustPatch: THREE.MeshBasicMaterial;
  scorch: THREE.MeshBasicMaterial;
  dust: THREE.MeshBasicMaterial;
  smoke: THREE.MeshBasicMaterial;
  muzzleCore: THREE.MeshBasicMaterial;
  heavyShockwave: THREE.MeshBasicMaterial;
  muzzleFlame: THREE.MeshBasicMaterial;
  spark: THREE.MeshBasicMaterial;
  fire: THREE.MeshBasicMaterial;
  concrete: THREE.MeshStandardMaterial;
  graphite: THREE.MeshStandardMaterial;
  graphiteDark: THREE.MeshStandardMaterial;
  panel: THREE.MeshStandardMaterial;
  bronze: THREE.MeshStandardMaterial;
  marking: THREE.MeshStandardMaterial;
  steel: THREE.MeshStandardMaterial;
  rubber: THREE.MeshStandardMaterial;
  rock: THREE.MeshStandardMaterial;
  crystal: THREE.MeshStandardMaterial;
  cyan: THREE.MeshStandardMaterial;
  cyanDim: THREE.MeshStandardMaterial;
  team: Record<CombatTeam, THREE.MeshStandardMaterial>;
  selection: Record<CombatTeam, THREE.MeshBasicMaterial>;
  compactSelection: Record<CombatTeam, THREE.MeshBasicMaterial>;
  neutralRing: THREE.MeshBasicMaterial;
  compactNeutralRing: THREE.MeshBasicMaterial;
  warningRing: THREE.MeshBasicMaterial;
  factionMarkerBack: THREE.MeshBasicMaterial;
  factionMarker: THREE.MeshBasicMaterial;
  healthFrame: Record<Team, THREE.MeshBasicMaterial>;
  healthBack: THREE.MeshBasicMaterial;
  healthGood: THREE.MeshBasicMaterial;
  healthWarning: THREE.MeshBasicMaterial;
  healthDanger: THREE.MeshBasicMaterial;
  healthBatchColor: THREE.MeshBasicMaterial;
  ghostValid: THREE.MeshBasicMaterial;
  ghostInvalid: THREE.MeshBasicMaterial;
  impact: Record<Team, THREE.MeshBasicMaterial>;
  command: Record<'move' | 'attack' | 'build' | 'warning', THREE.MeshBasicMaterial>;
}

const CAMERA_YAW = THREE.MathUtils.degToRad(45);
const CAMERA_ELEVATION = THREE.MathUtils.degToRad(55);
const CAMERA_DISTANCE = 180;
const DEFAULT_VIEW_HEIGHT = 48;
const MIN_VIEW_HEIGHT = 32;
const MAX_VIEW_HEIGHT = 80;
const MAX_EFFECTS = 128;
const FOG_TEXTURE_SIZE = 64;
const PRESENTATION_LOD_VIEW_MARGIN = 10;
const PRESENTATION_LOD_THRESHOLDS: Readonly<Record<RenderQualityLevel, PresentationLodThresholds>> = {
  high: {
    lod0MinPixels: 34,
    lod1MinPixels: 16,
    lod0MaxDistance: 30,
    lod1MaxDistance: 60,
    hysteresisRatio: 0.15,
  },
  medium: {
    lod0MinPixels: 38,
    lod1MinPixels: 19,
    lod0MaxDistance: 28,
    lod1MaxDistance: 54,
    hysteresisRatio: 0.15,
  },
  low: {
    lod0MinPixels: 44,
    lod1MinPixels: 22,
    lod0MaxDistance: 24,
    lod1MaxDistance: 48,
    hysteresisRatio: 0.15,
  },
};
const PRESENTATION_GEOMETRY_TIERS = ['lod0'] as const;
const PRESENTATION_VIEW_CORNERS = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
] as const;

export interface EffectBudgetEntry {
  kind: CombatVfxKind;
  decorative: boolean;
}

/** Return chronological entries that survive family, decorative, and global caps. */
export function effectBudgetSurvivorIndices(
  entries: readonly EffectBudgetEntry[],
  quality: RenderQualityLevel,
  reducedMotion: boolean,
  globalLimit = MAX_EFFECTS,
): number[] {
  const active = entries.map(() => true);
  const removeOldest = (predicate: (entry: EffectBudgetEntry) => boolean): boolean => {
    const index = entries.findIndex((entry, candidate) => active[candidate] === true && predicate(entry));
    if (index < 0) return false;
    active[index] = false;
    return true;
  };
  for (const kind of Object.keys(VFX_CAPS) as CombatVfxKind[]) {
    const limit = combatVfxCap(kind, quality, reducedMotion);
    let count = entries.reduce(
      (total, entry, index) => total + (active[index] && entry.kind === kind ? 1 : 0),
      0,
    );
    while (count > limit && removeOldest((entry) => entry.kind === kind)) count -= 1;
  }
  const decorativeLimit = RENDER_QUALITY_PROFILES[quality].maxDecorativeEffects;
  let decorativeCount = entries.reduce(
    (total, entry, index) => total + (active[index] && entry.decorative ? 1 : 0),
    0,
  );
  while (decorativeCount > decorativeLimit && removeOldest((entry) => entry.decorative)) decorativeCount -= 1;
  const safeGlobalLimit = Number.isFinite(globalLimit) ? Math.max(0, Math.floor(globalLimit)) : MAX_EFFECTS;
  let total = active.filter(Boolean).length;
  while (total > safeGlobalLimit) {
    if (!removeOldest((entry) => entry.decorative) && !removeOldest(() => true)) break;
    total -= 1;
  }
  return active.flatMap((keep, index) => keep ? [index] : []);
}

const DUST_VEHICLE_KINDS = new Set<UnitKind>(['scout', 'suppressor', 'tank', 'artillery', 'harvester']);

const FOG_UNKNOWN = [7, 14, 18, 218] as const;
const FOG_EXPLORED = [11, 20, 24, 120] as const;
const FOG_VISIBLE = [0, 0, 0, 0] as const;

export type FogDisplayState = 'visible' | 'explored' | 'unknown';
export type FogVisibleEdgeRing = 0 | 1 | 2 | 3;

/**
 * Presentation-only fog policy. The simulation visibility grid and disclosure
 * rules remain authoritative; this contract only softens the 64x64 overlay.
 */
export const FOG_EDGE_POLICY = {
  version: 'soft-edge-v2',
  textureSize: FOG_TEXTURE_SIZE,
  searchRadius: 2,
  alpha: {
    visible: 0,
    explored: 120,
    unknown: 218,
    firstExplored: 52,
    firstUnknown: 80,
    secondExplored: 92,
    secondUnknown: 148,
  },
} as const;

/** Return the Chebyshev display ring around visible pixels, capped after two rings. */
export function fogVisibleEdgeRing(
  visibleMask: Uint8Array,
  width: number,
  height: number,
  x: number,
  z: number,
): FogVisibleEdgeRing {
  if (
    !Number.isInteger(width)
    || !Number.isInteger(height)
    || width <= 0
    || height <= 0
    || !Number.isInteger(x)
    || !Number.isInteger(z)
    || x < 0
    || z < 0
    || x >= width
    || z >= height
    || visibleMask.length < width * height
  ) return 3;
  if (visibleMask[z * width + x] === 1) return 0;
  for (let radius = 1; radius <= FOG_EDGE_POLICY.searchRadius; radius += 1) {
    const minX = Math.max(0, x - radius);
    const maxX = Math.min(width - 1, x + radius);
    const minZ = Math.max(0, z - radius);
    const maxZ = Math.min(height - 1, z + radius);
    for (let sampleZ = minZ; sampleZ <= maxZ; sampleZ += 1) {
      for (let sampleX = minX; sampleX <= maxX; sampleX += 1) {
        if (Math.max(Math.abs(sampleX - x), Math.abs(sampleZ - z)) !== radius) continue;
        if (visibleMask[sampleZ * width + sampleX] === 1) return radius as 1 | 2;
      }
    }
  }
  return 3;
}

/** Resolve one display pixel without changing explored/visible simulation masks. */
export function fogDisplayPixel(
  state: FogDisplayState,
  edgeRing: FogVisibleEdgeRing,
): readonly [number, number, number, number] {
  const color = state === 'visible' ? FOG_VISIBLE : state === 'explored' ? FOG_EXPLORED : FOG_UNKNOWN;
  if (state === 'visible') return FOG_VISIBLE;
  const alpha = edgeRing === 1
    ? state === 'explored' ? FOG_EDGE_POLICY.alpha.firstExplored : FOG_EDGE_POLICY.alpha.firstUnknown
    : edgeRing === 2
      ? state === 'explored' ? FOG_EDGE_POLICY.alpha.secondExplored : FOG_EDGE_POLICY.alpha.secondUnknown
      : state === 'explored' ? FOG_EDGE_POLICY.alpha.explored : FOG_EDGE_POLICY.alpha.unknown;
  return [color[0], color[1], color[2], alpha];
}

export const GROUP_SELECTION_RING_POLICY = {
  version: 'compact-group-v1',
  minimumGroupSize: 6,
  normalInnerRadius: 0.79,
  compactInnerRadius: 0.92,
  normalOpacity: 0.9,
  compactOpacity: 0.54,
} as const;

export interface SelectionRingPresentation {
  readonly compact: boolean;
  readonly innerRadius: number;
  readonly opacity: number;
}

export function resolveSelectionRingPresentation(selectedCount: number): SelectionRingPresentation {
  const count = Number.isFinite(selectedCount) ? Math.max(0, Math.floor(selectedCount)) : 0;
  const compact = count >= GROUP_SELECTION_RING_POLICY.minimumGroupSize;
  return {
    compact,
    innerRadius: compact
      ? GROUP_SELECTION_RING_POLICY.compactInnerRadius
      : GROUP_SELECTION_RING_POLICY.normalInnerRadius,
    opacity: compact
      ? GROUP_SELECTION_RING_POLICY.compactOpacity
      : GROUP_SELECTION_RING_POLICY.normalOpacity,
  };
}

export const CONTACT_SHADOW_PRESENTATION = {
  version: 'compact-contact-v1',
  opacity: 0.22,
  scale: 0.84,
  unitDepthRatio: 0.76,
  buildingDepthRatio: 0.96,
} as const;

export const BREAKTHROUGH_DEFENSE_MARKERS = [
  { id: 'breakthrough-defense-west', x: 9, z: -22, radius: 3.9 },
  { id: 'breakthrough-defense-east', x: 23, z: -23, radius: 4.7 },
] as const;

export const BREAKTHROUGH_DEFENSE_MARKER_PRESENTATION = {
  version: 'narrow-defense-v1',
  innerRadius: 0.95,
  outerRadius: 1,
  opacity: 0.16,
} as const;

export type BreakthroughStaticGeometry =
  | 'box'
  | 'churn-disc'
  | 'shell-disc'
  | 'shell-rim'
  | 'defense-ring';

export type BreakthroughStaticMaterial =
  | 'concrete'
  | 'enemy-team'
  | 'ground-scar'
  | 'dust-patch'
  | 'track-mark'
  | 'scorch'
  | 'defense-footprint';

export interface BreakthroughStaticInstance {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotationX: number;
  readonly rotationY: number;
  readonly rotationZ: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly scaleZ: number;
}

export interface BreakthroughStaticBatch {
  readonly id: string;
  readonly objectName: string;
  readonly geometry: BreakthroughStaticGeometry;
  readonly material: BreakthroughStaticMaterial;
  readonly renderOrder: number;
  readonly receiveShadow: boolean;
  readonly collision: 'none';
  readonly navigation: 'none';
  readonly instances: ReadonlyArray<Readonly<BreakthroughStaticInstance>>;
}

const BREAKTHROUGH_COMMAND_BORDERS = [
  { id: 'breakthrough-command-border-north-west', width: 11, depth: 0.24, x: 15, z: -45.2 },
  { id: 'breakthrough-command-border-north-east', width: 11, depth: 0.24, x: 37, z: -45.2 },
  { id: 'breakthrough-command-border-west', width: 0.24, depth: 8.5, x: 10.2, z: -38.5 },
  { id: 'breakthrough-command-border-east', width: 0.24, depth: 8.5, x: 41.8, z: -38.5 },
] as const;

const BREAKTHROUGH_CHURNED_GROUND = [
  { id: 'breakthrough-churn-01', x: -11, z: -3, width: 6.6, depth: 2.5, rotation: -0.7 },
  { id: 'breakthrough-churn-02', x: -3, z: -9, width: 8.4, depth: 3.1, rotation: -0.82 },
  { id: 'breakthrough-churn-03', x: 7, z: -16, width: 7.2, depth: 3.4, rotation: -0.75 },
  { id: 'breakthrough-churn-04', x: 15, z: -23, width: 8.8, depth: 3.7, rotation: -0.68 },
  { id: 'breakthrough-churn-05', x: 24, z: -30, width: 7.6, depth: 3.2, rotation: -0.72 },
  { id: 'breakthrough-churn-06', x: 33, z: -38, width: 7.4, depth: 3.1, rotation: -0.68 },
] as const;

const BREAKTHROUGH_ASSAULT_ROUTE: ReadonlyArray<Readonly<Vec2>> = [
  { x: -17, z: 3 },
  { x: -7, z: -6 },
  { x: 5, z: -16 },
  { x: 17, z: -25 },
  { x: 30, z: -36 },
  { x: 39, z: -42 },
];

const BREAKTHROUGH_SHELL_SITES = [
  { id: 'breakthrough-shell-01', x: 0, z: -14, scale: 1.5, rotation: 0.2 },
  { id: 'breakthrough-shell-02', x: 5, z: -24, scale: 1.1, rotation: -0.7 },
  { id: 'breakthrough-shell-03', x: 13, z: -17, scale: 1.25, rotation: 0.9 },
  { id: 'breakthrough-shell-04', x: 18, z: -31, scale: 1.55, rotation: -0.3 },
  { id: 'breakthrough-shell-05', x: 26, z: -18, scale: 1.2, rotation: 0.6 },
  { id: 'breakthrough-shell-06', x: 29, z: -28, scale: 1.45, rotation: -0.8 },
  { id: 'breakthrough-shell-07', x: 36, z: -23, scale: 1.1, rotation: 0.4 },
  { id: 'breakthrough-shell-08', x: 39, z: -39, scale: 1.7, rotation: -0.4 },
] as const;

function breakthroughTrackInstances(): BreakthroughStaticInstance[] {
  const instances: BreakthroughStaticInstance[] = [];
  for (let index = 1; index < BREAKTHROUGH_ASSAULT_ROUTE.length; index += 1) {
    const start = BREAKTHROUGH_ASSAULT_ROUTE[index - 1];
    const end = BREAKTHROUGH_ASSAULT_ROUTE[index];
    if (!start || !end) continue;
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.hypot(dx, dz);
    const rightX = dz / length;
    const rightZ = -dx / length;
    for (const [sideName, lateralOffset] of [['left', -0.48], ['right', 0.48]] as const) {
      instances.push({
        id: `breakthrough-track-${String(index).padStart(2, '0')}-${sideName}`,
        x: (start.x + end.x) * 0.5 + rightX * lateralOffset,
        y: 0.0135,
        z: (start.z + end.z) * 0.5 + rightZ * lateralOffset,
        rotationX: 0,
        rotationY: Math.atan2(dx, dz),
        rotationZ: 0,
        scaleX: 0.18,
        scaleY: 0.003,
        scaleZ: length + 0.2,
      });
    }
  }
  return instances;
}

/**
 * Deterministic presentation-only plan for the breakthrough battlefield.
 * It preserves the original 39 transforms while reducing them to eight draw batches.
 */
export const BREAKTHROUGH_STATIC_BATTLEFIELD_BATCHES: ReadonlyArray<Readonly<BreakthroughStaticBatch>> = [
  {
    id: 'breakthrough-command-pad-batch',
    objectName: 'breakthrough-command-sector-pad',
    geometry: 'box',
    material: 'concrete',
    renderOrder: 0,
    receiveShadow: true,
    collision: 'none',
    navigation: 'none',
    instances: [{
      id: 'breakthrough-command-sector-pad',
      x: 26,
      y: 0.005,
      z: -34,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scaleX: 33,
      scaleY: 0.01,
      scaleZ: 25,
    }],
  },
  {
    id: 'breakthrough-command-border-batch',
    objectName: 'breakthrough-command-sector-border',
    geometry: 'box',
    material: 'enemy-team',
    renderOrder: 0,
    receiveShadow: false,
    collision: 'none',
    navigation: 'none',
    instances: BREAKTHROUGH_COMMAND_BORDERS.map((border) => ({
      id: border.id,
      x: border.x,
      y: 0.0135,
      z: border.z,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scaleX: border.width,
      scaleY: 0.003,
      scaleZ: border.depth,
    })),
  },
  {
    id: 'breakthrough-churn-ground-scar-batch',
    objectName: 'breakthrough-churned-ground',
    geometry: 'churn-disc',
    material: 'ground-scar',
    renderOrder: 2,
    receiveShadow: false,
    collision: 'none',
    navigation: 'none',
    instances: BREAKTHROUGH_CHURNED_GROUND.filter((_, index) => index % 2 === 0).map((patch) => ({
      id: patch.id,
      x: patch.x,
      y: 0.013,
      z: patch.z,
      rotationX: -Math.PI / 2,
      rotationY: 0,
      rotationZ: patch.rotation,
      scaleX: patch.width,
      scaleY: patch.depth,
      scaleZ: 1,
    })),
  },
  {
    id: 'breakthrough-churn-dust-patch-batch',
    objectName: 'breakthrough-churned-ground',
    geometry: 'churn-disc',
    material: 'dust-patch',
    renderOrder: 2,
    receiveShadow: false,
    collision: 'none',
    navigation: 'none',
    instances: BREAKTHROUGH_CHURNED_GROUND.filter((_, index) => index % 2 === 1).map((patch) => ({
      id: patch.id,
      x: patch.x,
      y: 0.013,
      z: patch.z,
      rotationX: -Math.PI / 2,
      rotationY: 0,
      rotationZ: patch.rotation,
      scaleX: patch.width,
      scaleY: patch.depth,
      scaleZ: 1,
    })),
  },
  {
    id: 'breakthrough-track-mark-batch',
    objectName: 'breakthrough-track-mark',
    geometry: 'box',
    material: 'track-mark',
    renderOrder: 3,
    receiveShadow: false,
    collision: 'none',
    navigation: 'none',
    instances: breakthroughTrackInstances(),
  },
  {
    id: 'breakthrough-shell-scar-batch',
    objectName: 'breakthrough-shell-scar',
    geometry: 'shell-disc',
    material: 'scorch',
    renderOrder: 3,
    receiveShadow: false,
    collision: 'none',
    navigation: 'none',
    instances: BREAKTHROUGH_SHELL_SITES.map((site) => ({
      id: `${site.id}-scar`,
      x: site.x,
      y: 0.013,
      z: site.z,
      rotationX: -Math.PI / 2,
      rotationY: 0,
      rotationZ: site.rotation,
      scaleX: site.scale * 1.35,
      scaleY: site.scale,
      scaleZ: 1,
    })),
  },
  {
    id: 'breakthrough-shell-rim-batch',
    objectName: 'breakthrough-shell-rim',
    geometry: 'shell-rim',
    material: 'ground-scar',
    renderOrder: 3,
    receiveShadow: false,
    collision: 'none',
    navigation: 'none',
    instances: BREAKTHROUGH_SHELL_SITES.map((site) => ({
      id: `${site.id}-rim`,
      x: site.x,
      y: 0.014,
      z: site.z,
      rotationX: -Math.PI / 2,
      rotationY: 0,
      rotationZ: site.rotation,
      scaleX: site.scale * 1.32,
      scaleY: site.scale,
      scaleZ: 1,
    })),
  },
  {
    id: 'breakthrough-defense-footprint-batch',
    objectName: 'breakthrough-defense-footprint',
    geometry: 'defense-ring',
    material: 'defense-footprint',
    renderOrder: 4,
    receiveShadow: false,
    collision: 'none',
    navigation: 'none',
    instances: BREAKTHROUGH_DEFENSE_MARKERS.map((marker) => ({
      id: marker.id,
      x: marker.x,
      y: 0.015,
      z: marker.z,
      rotationX: -Math.PI / 2,
      rotationY: 0,
      rotationZ: 0,
      scaleX: marker.radius,
      scaleY: marker.radius,
      scaleZ: marker.radius,
    })),
  },
];

export interface BreakthroughBattlefieldInstancingMetrics {
  readonly staticBattlefieldInstances: number;
  readonly staticBattlefieldBatches: number;
  readonly maximumInstanceY: number;
  readonly stableInstanceIds: ReadonlyArray<string>;
}

export function breakthroughBattlefieldInstancingMetrics(
  batches: ReadonlyArray<Readonly<BreakthroughStaticBatch>> = BREAKTHROUGH_STATIC_BATTLEFIELD_BATCHES,
): BreakthroughBattlefieldInstancingMetrics {
  const stableInstanceIds: string[] = [];
  let maximumInstanceY = Number.NEGATIVE_INFINITY;
  for (const batch of batches) {
    for (const instance of batch.instances) {
      stableInstanceIds.push(instance.id);
      maximumInstanceY = Math.max(maximumInstanceY, instance.y);
    }
  }
  return {
    staticBattlefieldInstances: stableInstanceIds.length,
    staticBattlefieldBatches: batches.length,
    maximumInstanceY: Number.isFinite(maximumInstanceY) ? maximumInstanceY : 0,
    stableInstanceIds,
  };
}

export interface InstancedPresentationCandidate {
  readonly id: string;
  readonly visible: boolean;
  readonly removed: boolean;
  readonly entityType: VisualEntityType;
  readonly team: Team;
  readonly selected: boolean;
}

export interface BreakthroughPresentationPlan {
  readonly contactShadowIds: ReadonlyArray<string>;
  readonly contactShadowBatches: number;
  readonly compactSelectionRingIds: ReadonlyArray<string>;
  readonly compactSelectionRingBatches: number;
}

export function shouldInstanceVisibleEntity(
  visible: boolean,
  removed: boolean,
  entityType: VisualEntityType,
): boolean {
  return visible && !removed && entityType !== 'resource';
}

export function planBreakthroughPresentationInstances(
  candidates: ReadonlyArray<Readonly<InstancedPresentationCandidate>>,
  compactSelection: boolean,
): BreakthroughPresentationPlan {
  const contactShadowIds: string[] = [];
  const compactSelectionRingIds: string[] = [];
  for (const candidate of candidates) {
    if (!shouldInstanceVisibleEntity(candidate.visible, candidate.removed, candidate.entityType)) continue;
    contactShadowIds.push(candidate.id);
    if (compactSelection && candidate.selected && candidate.team === 'player') {
      compactSelectionRingIds.push(candidate.id);
    }
  }
  return {
    contactShadowIds,
    contactShadowBatches: contactShadowIds.length > 0 ? 1 : 0,
    compactSelectionRingIds,
    compactSelectionRingBatches: compactSelectionRingIds.length > 0 ? 1 : 0,
  };
}

export const BREAKTHROUGH_HEALTH_BAR_BATCH_POLICY = Object.freeze({
  version: 'breakthrough-health-bar-batches-v1',
  sourceMeshesPerBar: 3,
  drawCallCeiling: 3,
  preservesFactionFrameColor: true,
  preservesHealthBands: true,
  preservesBillboardTransform: true,
});

export interface BreakthroughHealthBarBatchMetrics {
  readonly visibleBars: number;
  readonly sourceDrawCalls: number;
  readonly batchedDrawCalls: number;
  readonly avoidedDrawCalls: number;
}

/** Three shared layers retain the original frame, track, and fill semantics. */
export function breakthroughHealthBarBatchMetrics(
  visibleBarCount: number,
  batchingEnabled = true,
): BreakthroughHealthBarBatchMetrics {
  const visibleBars = Math.max(0, Math.floor(Number.isFinite(visibleBarCount) ? visibleBarCount : 0));
  const sourceDrawCalls = visibleBars * BREAKTHROUGH_HEALTH_BAR_BATCH_POLICY.sourceMeshesPerBar;
  const batchedDrawCalls = visibleBars > 0 && batchingEnabled
    ? BREAKTHROUGH_HEALTH_BAR_BATCH_POLICY.drawCallCeiling
    : sourceDrawCalls;
  return {
    visibleBars,
    sourceDrawCalls,
    batchedDrawCalls,
    avoidedDrawCalls: sourceDrawCalls - batchedDrawCalls,
  };
}

export function nextInstancedBatchCapacity(
  currentCapacity: number,
  requiredCapacity: number,
  minimumCapacity: number,
): number {
  const required = Math.max(0, Math.ceil(Number.isFinite(requiredCapacity) ? requiredCapacity : 0));
  let capacity = Math.max(1, Math.ceil(Number.isFinite(currentCapacity) ? currentCapacity : 0));
  const minimum = Math.max(1, Math.ceil(Number.isFinite(minimumCapacity) ? minimumCapacity : 1));
  capacity = Math.max(capacity, minimum);
  while (capacity < required) capacity *= 2;
  return capacity;
}

export interface BeaconPresentationPolicy {
  readonly controlRingVisible: boolean;
  readonly signalVisible: boolean;
  readonly signalDimmed: boolean;
}

export function resolveBeaconPresentationPolicy(
  fixture: string,
  beacon: Pick<BeaconState, 'unlocked'>,
): BeaconPresentationPolicy {
  const breakthrough = fixture.startsWith('breakthrough-demo');
  const lockedBreakthrough = breakthrough && !beacon.unlocked;
  return {
    controlRingVisible: !lockedBreakthrough,
    signalVisible: breakthrough || beacon.unlocked,
    signalDimmed: lockedBreakthrough,
  };
}

const UNIT_HEIGHT: Record<UnitKind, number> = {
  scout: 1.8,
  rifle: 2.1,
  antitank: 2.15,
  engineer: 2.1,
  suppressor: 2.2,
  tank: 2.7,
  artillery: 3.1,
  harvester: 2.9,
};

const BUILDING_HEIGHT: Record<BuildingKind, number> = {
  hq: 8.2,
  reactor: 6.3,
  refinery: 6.1,
  barracks: 4.5,
  factory: 5.8,
  relay: 6.4,
  sentry: 4.4,
  cannon: 5.2,
};

const clampMapCoordinate = (value: number): number => THREE.MathUtils.clamp(value, -MAP_HALF_SIZE, MAP_HALF_SIZE);

const shortestAngleDelta = (from: number, to: number): number => {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
};

const stableHash = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export type MuzzleSocketName =
  | 'muzzle_socket'
  | 'muzzle_socket_left'
  | 'muzzle_socket_right';

export type DamageSocketName =
  | 'damage_socket_engine'
  | 'damage_socket_turret'
  | 'damage_socket_roof';

export type PresentationSocketName =
  | 'resource_socket'
  | 'deposit_socket'
  | 'production_socket'
  | 'infantry_spawn'
  | DamageSocketName
  | 'wreck_anchor';

const PRESENTATION_SOCKET_NAMES: ReadonlySet<string> = new Set<PresentationSocketName>([
  'resource_socket',
  'deposit_socket',
  'production_socket',
  'infantry_spawn',
  'damage_socket_engine',
  'damage_socket_turret',
  'damage_socket_roof',
  'wreck_anchor',
]);

export function productionPresentationSocketName(
  producerKind: BuildingKind,
  availableNames: readonly string[],
): 'production_socket' | 'infantry_spawn' | null {
  const available = new Set(availableNames);
  if (producerKind === 'barracks' && available.has('infantry_spawn')) return 'infantry_spawn';
  if (producerKind === 'factory' && available.has('production_socket')) return 'production_socket';
  if (available.has('production_socket')) return 'production_socket';
  if (available.has('infantry_spawn')) return 'infantry_spawn';
  return null;
}

export function selectDamageSocketName(
  availableNames: readonly string[],
  stableEntityKey: string,
): DamageSocketName | null {
  const sockets = availableNames
    .filter((name): name is DamageSocketName => (
      name === 'damage_socket_engine'
      || name === 'damage_socket_turret'
      || name === 'damage_socket_roof'
    ))
    .sort();
  if (sockets.length === 0) return null;
  return sockets[stableHash(stableEntityKey) % sockets.length] ?? null;
}

/** Select one authored muzzle deterministically without depending on traversal order. */
export function selectMuzzleSocketName(
  availableNames: readonly string[],
  stableEventKey: string,
): MuzzleSocketName | null {
  let single = false;
  let left = false;
  let right = false;
  for (const name of availableNames) {
    if (name === 'muzzle_socket') single = true;
    else if (name === 'muzzle_socket_left') left = true;
    else if (name === 'muzzle_socket_right') right = true;
  }
  if (left && right) return (stableHash(stableEventKey) & 1) === 0 ? 'muzzle_socket_left' : 'muzzle_socket_right';
  if (single) return 'muzzle_socket';
  if (left) return 'muzzle_socket_left';
  if (right) return 'muzzle_socket_right';
  return null;
}

/** Never resolve a presentation socket for an entity outside the current disclosure set. */
export function disclosedSocketSource<T>(
  sourceId: string | undefined,
  disclosedIds: ReadonlySet<string>,
  visuals: ReadonlyMap<string, T>,
): T | undefined {
  return sourceId && disclosedIds.has(sourceId) ? visuals.get(sourceId) : undefined;
}

export interface PresentationSessionMetricState {
  socketShots: number;
  muzzleShots: Record<MuzzleSocketName, number>;
  socketRepairs: number;
  socketDeposits: number;
  socketProductionExits: number;
  socketRefineryMechanisms: number;
  refineryMechanismFallbacks: number;
  socketWreckAnchors: number;
  authoredWreckActivations: number;
  authoredWreckFallbacks: number;
  authoredBuildingRuinActivations: number;
  authoredBuildingRuinFallbacks: number;
  socketFallbacks: number;
}

export function createPresentationSessionMetricState(): PresentationSessionMetricState {
  return {
    socketShots: 0,
    muzzleShots: {
      muzzle_socket: 0,
      muzzle_socket_left: 0,
      muzzle_socket_right: 0,
    },
    socketRepairs: 0,
    socketDeposits: 0,
    socketProductionExits: 0,
    socketRefineryMechanisms: 0,
    refineryMechanismFallbacks: 0,
    socketWreckAnchors: 0,
    authoredWreckActivations: 0,
    authoredWreckFallbacks: 0,
    authoredBuildingRuinActivations: 0,
    authoredBuildingRuinFallbacks: 0,
    socketFallbacks: 0,
  };
}

export interface DisposedImportedResourceCounts {
  geometries: number;
  materials: number;
  textures: number;
}

/** Dispose shared GLTF resources exactly once per imported scene. */
export function disposeUniqueImportedResources(root: THREE.Object3D): DisposedImportedResourceCounts {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of meshMaterials) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
  return { geometries: geometries.size, materials: materials.size, textures: textures.size };
}

/**
 * Three.js presentation for the flat Faultline Front battlefield.
 * Simulation data stays authoritative; this class only renders snapshots.
 */
export class BattlefieldScene {
  private readonly container: HTMLElement;
  private readonly hostWindow: Window;
  private readonly fixture: string;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 500);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly sunLight: THREE.DirectionalLight;
  private readonly worldRoot = new THREE.Group();
  private readonly entityRoot = new THREE.Group();
  private readonly blockerRoot = new THREE.Group();
  private readonly effectRoot = new THREE.Group();
  private readonly ghostRoot = new THREE.Group();
  private readonly cameraTarget = new THREE.Vector3();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2();
  private readonly lodNdc = new THREE.Vector2();
  private readonly lodGroundHit = new THREE.Vector3();
  private readonly lodViewBounds: FlatWorldBounds = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };

  private readonly ownedGeometries = new Set<THREE.BufferGeometry>();
  private readonly ownedMaterials = new Set<THREE.Material>();
  private readonly ownedTextures = new Set<THREE.Texture>();
  private readonly geometryCache = new Map<string, THREE.BufferGeometry>();
  private readonly importedMaterialLibrary = new Map<string, THREE.Material>();
  private readonly importedMaterialOwners = new Set<string>();
  private readonly importedMaterialOwnerByInstance = new WeakMap<THREE.Material, string>();
  private readonly importedMaterialNameSignatures = new Map<string, Set<string>>();
  private readonly authoredAssetTasks = new Map<string, AuthoredAssetTask>();
  private readonly authoredAssetRevisions = new Map<string, number>();
  private readonly assetLoadLedger = new IncrementalAssetLoadLedger();
  private readonly assetLoaderReady: Promise<void>;
  private assetPhaseTail: Promise<void> = Promise.resolve();
  private readonly assetPhaseHistory: string[] = [];
  private assetPhaseCurrent = 'idle';
  private assetPhaseCompleted = 0;
  private initialAssetRequirementsQueued = false;
  private materialConflictCount = 0;
  private materialCrossOwnerReuse = 0;
  private lodSwitches = 0;
  private presentationFrame = 0;
  private ktx2Loader: import('three/examples/jsm/loaders/KTX2Loader.js').KTX2Loader | null = null;
  private readonly unitTemplates = new Map<string, THREE.Group>();
  private readonly buildingTemplates = new Map<string, THREE.Group>();
  private readonly entityVisuals = new Map<string, EntityVisual>();
  private readonly blockerVisuals = new Map<string, THREE.Group>();
  private readonly pickables = new Set<THREE.Group>();
  private readonly breakthroughStaticBatches: THREE.InstancedMesh[] = [];
  private readonly instancedPresentationTransform = new THREE.Object3D();
  private healthBarBatches: HealthBarPresentationBatches | null = null;
  private healthBarBatchCapacity = 0;
  private healthBarBatchCount = 0;
  private healthBarBatchInstanceIds: string[] = [];
  private readonly healthBarBatchColor = new THREE.Color();
  private contactShadowBatch: THREE.InstancedMesh | null = null;
  private contactShadowBatchCapacity = 0;
  private contactShadowInstanceIds: string[] = [];
  private contactShadowCount = 0;
  private compactSelectionBatch: THREE.InstancedMesh | null = null;
  private compactSelectionBatchCapacity = 0;
  private compactSelectionInstanceIds: string[] = [];
  private compactSelectionBatchCount = 0;
  private independentCompactSelectionRingCount = 0;
  private factionMarkerBackBatch: THREE.InstancedMesh | null = null;
  private factionMarkerColorBatch: THREE.InstancedMesh | null = null;
  private factionMarkerBatchCapacity = 0;
  private factionMarkerInstanceIds: string[] = [];
  private factionMarkerCount = 0;
  private playerFactionMarkerCount = 0;
  private enemyFactionMarkerCount = 0;
  private readonly factionMarkerColor = new THREE.Color();
  private readonly constructionBatches: ConstructionPresentationBatches;
  private constructionFoundationCount = 0;
  private constructionFrameCount = 0;
  private constructionShellCount = 0;
  private constructionScanCount = 0;
  private readonly effects: ActiveEffect[] = [];
  private readonly dustTrackers = new Map<string, { last: THREE.Vector3; distance: number }>();
  private readonly dustPuffPool: THREE.Mesh[] = [];
  private readonly semanticSocketWorldPosition = new THREE.Vector3();
  private readonly semanticSocketWorldTarget = new THREE.Vector3();
  private readonly fogTextureData = new Uint8Array(FOG_TEXTURE_SIZE * FOG_TEXTURE_SIZE * 4);
  private readonly fogSampleVisibleMask = new Uint8Array(FOG_TEXTURE_SIZE * FOG_TEXTURE_SIZE);
  private readonly fogSampleExploredMask = new Uint8Array(FOG_TEXTURE_SIZE * FOG_TEXTURE_SIZE);
  private readonly fogTexture: THREE.DataTexture;
  private readonly fogMesh: THREE.Mesh;

  private readonly palette: MaterialPalette;
  private readonly beaconVisual: BeaconVisual;
  private authoredPlayerTankTemplate: THREE.Group | null = null;
  private authoredPlayerHarvesterTemplate: THREE.Group | null = null;
  private authoredPlayerRifleTemplate: THREE.Group | null = null;
  private readonly authoredUnitAnimations = new Map<string, THREE.AnimationClip[]>();
  private authoredPlayerEngineerTemplate: THREE.Group | null = null;
  private authoredPlayerAntitankTemplate: THREE.Group | null = null;
  private authoredPlayerScoutTemplate: THREE.Group | null = null;
  private authoredPlayerSuppressorTemplate: THREE.Group | null = null;
  private authoredPlayerArtilleryTemplate: THREE.Group | null = null;
  private authoredEnemyTankTemplate: THREE.Group | null = null;
  private authoredEnemyRifleTemplate: THREE.Group | null = null;
  private authoredEnemyAntitankTemplate: THREE.Group | null = null;
  private authoredEnemyScoutTemplate: THREE.Group | null = null;
  private authoredEnemySuppressorTemplate: THREE.Group | null = null;
  private authoredEnemyArtilleryTemplate: THREE.Group | null = null;
  private authoredEnemyHarvesterTemplate: THREE.Group | null = null;
  private authoredEnemyEngineerTemplate: THREE.Group | null = null;
  private authoredEnemyHqTemplate: THREE.Group | null = null;
  private authoredEnemyRefineryTemplate: THREE.Group | null = null;
  private authoredEnemyFactoryTemplate: THREE.Group | null = null;
  private authoredEnemyReactorTemplate: THREE.Group | null = null;
  private authoredEnemyBarracksTemplate: THREE.Group | null = null;
  private authoredEnemyRelayTemplate: THREE.Group | null = null;
  private authoredEnemySentryTemplate: THREE.Group | null = null;
  private authoredEnemyCannonTemplate: THREE.Group | null = null;
  private authoredPlayerHqTemplate: THREE.Group | null = null;
  private authoredPlayerRefineryTemplate: THREE.Group | null = null;
  private authoredPlayerFactoryTemplate: THREE.Group | null = null;
  private authoredPlayerReactorTemplate: THREE.Group | null = null;
  private authoredPlayerBarracksTemplate: THREE.Group | null = null;
  private authoredPlayerRelayTemplate: THREE.Group | null = null;
  private authoredPlayerSentryTemplate: THREE.Group | null = null;
  private authoredPlayerCannonTemplate: THREE.Group | null = null;
  private rockTemplate: THREE.Group | null = null;
  private authoredResourceTemplate: THREE.Group | null = null;
  private readonly authoredSmallPropVisuals: THREE.Group[] = [];
  private readonly authoredVegetationVisuals: THREE.Group[] = [];
  private buildGhost: BuildGhostVisual | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private motionQuery: MediaQueryList | null = null;
  private animationFrame = 0;
  private renderMetricFrame = 0;
  private assetLoadRequested = 0;
  private assetLoadCompleted = 0;
  private assetLoadFailed = 0;
  private assetLoadRetries = 0;
  private socketShots = 0;
  private readonly semanticMuzzleSocketShots: Record<MuzzleSocketName, number> = {
    muzzle_socket: 0,
    muzzle_socket_left: 0,
    muzzle_socket_right: 0,
  };
  private socketRepairs = 0;
  private socketDeposits = 0;
  private socketProductionExits = 0;
  private socketRefineryMechanisms = 0;
  private refineryMechanismFallbacks = 0;
  private socketWreckAnchors = 0;
  private authoredWreckActivations = 0;
  private authoredWreckFallbacks = 0;
  private authoredWreckSequence = 0;
  private authoredBuildingRuinActivations = 0;
  private authoredBuildingRuinFallbacks = 0;
  private socketFallbacks = 0;
  private assetLoadStartTime = 0;
  private firstAuthoredAssetTime = -1;
  private lastFrameTime = 0;
  private viewHeight = DEFAULT_VIEW_HEIGHT;
  private viewportHeight = 1;
  private renderQuality: RenderQualityLevel;
  private reducedMotion = false;
  private disposed = false;
  private visibilitySnapshot: VisibilitySnapshot | null = null;
  private visibilityMask = new Uint8Array(0);
  private exploredMask = new Uint8Array(0);
  private groupSelectionCount = 0;
  private compactSelectionRingCount = 0;
  private beaconControlRingVisible = false;

  private readonly onMotionPreferenceChange = (event: MediaQueryListEvent): void => {
    this.reducedMotion = event.matches || this.fixture.endsWith('-reduced');
    this.enforceEffectBudgets();
    this.enforceAuthoredWreckBudget();
  };

  private readonly onAnimationFrame = (time: number): void => {
    if (this.disposed) return;
    const elapsed = this.lastFrameTime === 0 ? 1 / 60 : Math.min((time - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = time;
    this.updatePresentation(elapsed, time / 1000);
    this.renderer.render(this.scene, this.camera);
    this.updateDevelopmentRenderMetrics();
    this.animationFrame = this.hostWindow.requestAnimationFrame(this.onAnimationFrame);
  };

  constructor(container: HTMLElement, renderQuality: RenderQualityLevel = 'high', fixture = 'default') {
    this.container = container;
    this.renderQuality = renderQuality;
    this.fixture = fixture;
    const hostWindow = container.ownerDocument.defaultView;
    if (!hostWindow) throw new Error('BattlefieldScene requires a browser window.');
    this.hostWindow = hostWindow;
    this.assetLoadStartTime = hostWindow.performance.now();

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const visualGold = this.fixture === 'visual-gold-review';
    this.renderer.toneMappingExposure = visualGold
      ? 1.18
      : this.fixture.startsWith('breakthrough-demo') ? 1.12 : 1.1;
    this.renderer.shadowMap.enabled = RENDER_QUALITY_PROFILES[this.renderQuality].shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.setAttribute('aria-label', '断层战线战场');
    container.append(this.renderer.domElement);

    const worldAtmosphere = visualGold
      ? 0x2b302d
      : this.fixture.startsWith('breakthrough-demo') ? 0x30332e : 0x222925;
    this.scene.background = new THREE.Color(worldAtmosphere);
    this.scene.fog = new THREE.Fog(
      worldAtmosphere,
      visualGold ? 190 : this.fixture.startsWith('breakthrough-demo') ? 175 : 165,
      visualGold ? 370 : 350,
    );
    this.scene.add(this.worldRoot, this.entityRoot, this.blockerRoot, this.effectRoot, this.ghostRoot);

    this.palette = this.createPalette();
    this.constructionBatches = this.createConstructionPresentationBatches();
    this.assetLoaderReady = recoverAssetLoaderInitialization(
      this.loadAuthoredPlayerAssets(),
      (error) => {
        if (!this.disposed) console.warn('Authored asset loader initialization failed; using procedural fallbacks.', error);
      },
    );
    this.sunLight = this.createLighting();
    this.createGroundAndRoads();
    if (this.fixture.startsWith('breakthrough-demo')) {
      this.ensureHealthBarBatchCapacity(32);
      this.ensureContactShadowBatchCapacity(32);
      this.ensureCompactSelectionBatchCapacity(16);
    }
    const fog = this.createFogOverlay();
    this.fogTexture = fog.texture;
    this.fogMesh = fog.mesh;
    if (
      this.fixture === 'enemy-base-review'
      || visualGold
      || this.fixture === 'construction-review'
      || this.fixture === 'construction-review-reduced'
      || this.fixture === 'building-ruin-review'
      || this.fixture === 'building-ruin-review-reduced'
      || this.fixture === 'destruction-residue-review'
      || this.fixture === 'destruction-residue-review-reduced'
      || this.fixture === 'building-damage-review'
      || this.fixture === 'building-damage-review-reduced'
      || isInfrastructureReviewFixture(this.fixture)
      || this.fixture === 'enemy-vehicle-socket-review'
      || this.fixture === 'combat-vehicle-family-review'
    ) this.fogMesh.visible = false;
    this.beaconVisual = this.createBeaconVisual();
    this.worldRoot.add(this.beaconVisual.root);

    const spawn = LEVEL_ANCHORS.find((anchor) => anchor.id === 'spawn_player');
    this.cameraTarget.set(spawn?.position.x ?? 0, 0, spawn?.position.z ?? 0);
    this.updateCameraTransform();
    this.resize();

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(container);
    }
    if (typeof hostWindow.matchMedia === 'function') {
      this.motionQuery = hostWindow.matchMedia('(prefers-reduced-motion: reduce)');
      this.reducedMotion = this.motionQuery.matches || this.fixture.endsWith('-reduced');
      this.motionQuery.addEventListener('change', this.onMotionPreferenceChange);
    }

    this.animationFrame = hostWindow.requestAnimationFrame(this.onAnimationFrame);
  }

  sync(state: GameState, selectedIds: Set<string>, events: SimulationEvent[] = []): SimulationEvent[] {
    if (this.disposed) return [];
    this.syncAuthoredAssetRequirements(state);
    const playerIntel = state.intel.player;
    const selectionPresentation = resolveSelectionRingPresentation(selectedIds.size);
    this.groupSelectionCount = selectedIds.size;
    if (import.meta.env.DEV) {
      const canvas = this.renderer.domElement;
      canvas.dataset.visibleEnemyCount = String(playerIntel.visibleEnemyIds.length);
      canvas.dataset.fogEdgePolicyVersion = FOG_EDGE_POLICY.version;
      canvas.dataset.fogTextureSize = String(FOG_EDGE_POLICY.textureSize);
      canvas.dataset.fogEdgeAlphas = [
        FOG_EDGE_POLICY.alpha.visible,
        FOG_EDGE_POLICY.alpha.firstUnknown,
        FOG_EDGE_POLICY.alpha.secondUnknown,
        FOG_EDGE_POLICY.alpha.unknown,
      ].join(',');
      canvas.dataset.groupSelectionCount = String(this.groupSelectionCount);
      canvas.dataset.groupSelectionPolicyVersion = GROUP_SELECTION_RING_POLICY.version;
      canvas.dataset.demoPlayerAlive = state.units
        .filter((unit) => unit.id.startsWith('u-demo-player-'))
        .map((unit) => unit.kind)
        .join(',');
      canvas.dataset.demoEnemyAlive = state.units
        .filter((unit) => unit.id.startsWith('u-demo-enemy-'))
        .map((unit) => unit.kind)
        .join(',');
      canvas.dataset.breakthroughPlayerAlive = state.units
        .filter((unit) => unit.id.startsWith('u-break-player-'))
        .map((unit) => unit.kind)
        .join(',');
      canvas.dataset.breakthroughEnemyAlive = state.units
        .filter((unit) => unit.id.startsWith('u-break-enemy-'))
        .map((unit) => unit.kind)
        .join(',');
      canvas.dataset.harvesterCargoSlots = state.units
        .filter((unit) => unit.kind === 'harvester')
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((unit) => `${unit.id}:${visibleCargoSlotCount(unit.cargo, unit.cargoCapacity)}`)
        .join(',');
      canvas.dataset.productionQueues = state.buildings
        .filter((building) => building.queue.length > 0)
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((building) => `${building.id}:${building.queue.length}`)
        .join(',');
    }
    this.updateFogOverlay(playerIntel.visibility);
    const visibleEnemyIds = new Set(playerIntel.visibleEnemyIds);
    const disclosedIds = new Set<string>();
    const seen = new Set<string>();
    const hideBuildingRuinReviewAttackers = this.fixture === 'building-ruin-review'
      || this.fixture === 'building-ruin-review-reduced';
    const hideDestructionResidueReviewAttackers = this.fixture === 'destruction-residue-review'
      || this.fixture === 'destruction-residue-review-reduced';

    for (const unit of state.units) {
      if (
        (hideBuildingRuinReviewAttackers && unit.id.startsWith('u-ruin-'))
        || (hideDestructionResidueReviewAttackers && unit.id.startsWith('u-residue-attacker-'))
        || shouldHideInfrastructureReviewAttacker(this.fixture, unit.id)
      ) {
        // These deterministic artillery pieces exist only to produce real combat
        // events. Keeping them out of the comparison frame avoids loading or
        // presenting an unrelated fallback asset in the four-building review.
        disclosedIds.add(unit.id);
        continue;
      }
      if (
        unit.team === 'enemy'
        && !visibleEnemyIds.has(unit.id)
        && this.fixture !== 'combat-vehicle-family-review'
      ) continue;
      seen.add(unit.id);
      disclosedIds.add(unit.id);
      this.syncEntity(unit, selectedIds.has(unit.id), true, selectionPresentation);
    }
    for (const building of state.buildings) {
      if (shouldHideReviewPresentationEntity(this.fixture, building.id)) {
        // Static targets and the victory anchor remain authoritative and
        // disclosed to combat events, but do not add unrelated building assets
        // or silhouettes to focused comparison frames. Socket-review targets
        // remain disclosed so their real shot and impact events can render.
        if (this.fixture === 'enemy-vehicle-socket-review') disclosedIds.add(building.id);
        continue;
      }
      if (building.team === 'enemy' && !visibleEnemyIds.has(building.id)) continue;
      seen.add(building.id);
      disclosedIds.add(building.id);
      const hasDefensePower = BUILDING_DEFS[building.kind].weapon === undefined
        || state.economy[building.team].powerRatio >= DEFENSE_MIN_POWER_RATIO;
      this.syncEntity(building, selectedIds.has(building.id), hasDefensePower, selectionPresentation);
    }
    for (const resource of state.resources) {
      if (!this.isExplored(resource.position)) continue;
      seen.add(resource.id);
      disclosedIds.add(resource.id);
      this.syncEntity(resource, selectedIds.has(resource.id), true, selectionPresentation);
    }

    const disclosedEvents = events.filter((event) => this.shouldRenderEvent(event, disclosedIds));
    this.consumeEvents(state, disclosedEvents, disclosedIds);

    for (const [id, visual] of this.entityVisuals) {
      if (seen.has(id)) continue;
      if (visual.destructionAge >= 0) continue;
      this.entityRoot.remove(visual.root);
      this.entityVisuals.delete(id);
      this.pickables.delete(visual.root);
      this.dustTrackers.delete(id);
    }

    this.syncBlockers(state);
    this.syncBeacon(state.beacon);
    this.compactSelectionRingCount = 0;
    this.independentCompactSelectionRingCount = 0;
    for (const visual of this.entityVisuals.values()) {
      const independentCompactRing = visual.selection.visible
        && visual.selection.userData.compactSelectionRing === true;
      const batchedCompactRing = this.fixture.startsWith('breakthrough-demo')
        && selectionPresentation.compact
        && visual.selected
        && visual.team === 'player'
        && visual.entityType !== 'resource';
      if (independentCompactRing) this.independentCompactSelectionRingCount += 1;
      if (independentCompactRing || batchedCompactRing) this.compactSelectionRingCount += 1;
    }
    if (import.meta.env.DEV) {
      const canvas = this.renderer.domElement;
      canvas.dataset.compactSelectionRings = String(this.compactSelectionRingCount);
      canvas.dataset.beaconRingVisible = String(this.beaconControlRingVisible);
      canvas.dataset.defenseMarkerCount = String(
        this.fixture.startsWith('breakthrough-demo') ? BREAKTHROUGH_DEFENSE_MARKERS.length : 0,
      );
    }
    return disclosedEvents;
  }

  resize(): void {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth || this.container.getBoundingClientRect().width || 1);
    const height = Math.max(1, this.container.clientHeight || this.container.getBoundingClientRect().height || 1);
    this.viewportHeight = height;
    const profile = RENDER_QUALITY_PROFILES[this.renderQuality];
    this.renderer.setPixelRatio(Math.min(this.hostWindow.devicePixelRatio || 1, profile.pixelRatioCap));
    this.renderer.setSize(width, height, false);

    const aspect = width / height;
    this.camera.left = -(this.viewHeight * aspect) / 2;
    this.camera.right = (this.viewHeight * aspect) / 2;
    this.camera.top = this.viewHeight / 2;
    this.camera.bottom = -this.viewHeight / 2;
    this.camera.updateProjectionMatrix();
    this.updateCameraTransform();
  }

  setRenderQuality(level: RenderQualityLevel): void {
    if (this.disposed || level === this.renderQuality) return;
    this.renderQuality = level;
    const profile = RENDER_QUALITY_PROFILES[level];
    this.renderer.shadowMap.enabled = profile.shadows;
    this.sunLight.castShadow = profile.shadows;
    if (this.sunLight.shadow.mapSize.width !== profile.shadowMapSize) {
      this.sunLight.shadow.mapSize.set(profile.shadowMapSize, profile.shadowMapSize);
      this.sunLight.shadow.map?.dispose();
      this.sunLight.shadow.map = null;
    }
    this.updateTextureQuality();
    this.updateDecorativeDetailVisibility();
    for (const visual of this.entityVisuals.values()) this.applyPresentationLod(visual, visual.lodTier);
    this.enforceEffectBudgets();
    this.enforceAuthoredWreckBudget();
    this.resize();
    this.renderer.domElement.dataset.renderQuality = level;
  }

  resetPresentationSession(): void {
    if (this.disposed) return;
    for (let index = this.effects.length - 1; index >= 0; index -= 1) this.removeEffectAt(index);
    for (const visual of this.entityVisuals.values()) this.entityRoot.remove(visual.root);
    this.entityVisuals.clear();
    this.pickables.clear();
    this.dustTrackers.clear();

    const metrics = createPresentationSessionMetricState();
    this.socketShots = metrics.socketShots;
    this.semanticMuzzleSocketShots.muzzle_socket = metrics.muzzleShots.muzzle_socket;
    this.semanticMuzzleSocketShots.muzzle_socket_left = metrics.muzzleShots.muzzle_socket_left;
    this.semanticMuzzleSocketShots.muzzle_socket_right = metrics.muzzleShots.muzzle_socket_right;
    this.socketRepairs = metrics.socketRepairs;
    this.socketDeposits = metrics.socketDeposits;
    this.socketProductionExits = metrics.socketProductionExits;
    this.socketRefineryMechanisms = metrics.socketRefineryMechanisms;
    this.refineryMechanismFallbacks = metrics.refineryMechanismFallbacks;
    this.socketWreckAnchors = metrics.socketWreckAnchors;
    this.authoredWreckActivations = metrics.authoredWreckActivations;
    this.authoredWreckFallbacks = metrics.authoredWreckFallbacks;
    this.authoredBuildingRuinActivations = metrics.authoredBuildingRuinActivations;
    this.authoredBuildingRuinFallbacks = metrics.authoredBuildingRuinFallbacks;
    this.socketFallbacks = metrics.socketFallbacks;
    this.authoredWreckSequence = 0;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.hostWindow.cancelAnimationFrame(this.animationFrame);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.motionQuery?.removeEventListener('change', this.onMotionPreferenceChange);
    this.motionQuery = null;

    this.clearBuildGhost();
    this.effects.length = 0;
    this.entityVisuals.clear();
    this.dustTrackers.clear();
    this.dustPuffPool.length = 0;
    this.blockerVisuals.clear();
    this.pickables.clear();
    this.unitTemplates.clear();
    this.buildingTemplates.clear();
    this.geometryCache.clear();
    this.importedMaterialLibrary.clear();
    this.importedMaterialOwners.clear();
    this.importedMaterialNameSignatures.clear();
    this.authoredAssetTasks.clear();
    this.authoredAssetRevisions.clear();
    this.assetLoadLedger.dispose();
    for (const batch of this.breakthroughStaticBatches) batch.dispose();
    this.breakthroughStaticBatches.length = 0;
    if (this.healthBarBatches) {
      for (const batch of Object.values(this.healthBarBatches)) batch.dispose();
      this.healthBarBatches = null;
    }
    this.contactShadowBatch?.dispose();
    this.contactShadowBatch = null;
    this.compactSelectionBatch?.dispose();
    this.compactSelectionBatch = null;
    this.factionMarkerBackBatch?.dispose();
    this.factionMarkerBackBatch = null;
    this.factionMarkerColorBatch?.dispose();
    this.factionMarkerColorBatch = null;
    for (const batch of Object.values(this.constructionBatches)) batch.dispose();
    this.ktx2Loader?.dispose();
    this.ktx2Loader = null;
    this.scene.clear();

    this.fogTexture.dispose();
    for (const texture of this.ownedTextures) texture.dispose();
    for (const geometry of this.ownedGeometries) geometry.dispose();
    for (const material of this.ownedMaterials) material.dispose();
    this.ownedGeometries.clear();
    this.ownedMaterials.clear();
    this.ownedTextures.clear();
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }

  pickEntity(clientX: number, clientY: number): string | null {
    if (this.disposed || !this.setPointerNdc(clientX, clientY)) return null;
    this.camera.updateMatrixWorld(true);
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const intersections = this.raycaster.intersectObjects([...this.pickables], true);
    for (const intersection of intersections) {
      let current: THREE.Object3D | null = intersection.object;
      while (current) {
        if (typeof current.userData.entityId === 'string') return current.userData.entityId;
        current = current.parent;
      }
    }

    // Small infantry remain selectable at strategic zoom even if the ray misses thin geometry.
    let closestId: string | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (const [id, visual] of this.entityVisuals) {
      if (
        visual.entityType === 'resource'
        || !visual.root.visible
        || visual.destructionAge >= 0
        || visual.authoredWreckAge >= 0
        || visual.authoredBuildingRuinAge >= 0
      ) continue;
      const screen = this.projectWorldPosition(visual.root.position, visual.height * 0.35);
      if (!screen) continue;
      const distance = Math.hypot(screen.x - clientX, screen.y - clientY);
      const pixelRadius = screenSpaceEntityPickRadius(
        visual.pickRadius,
        this.viewHeight,
        this.viewportHeight,
        visual.entityType,
      );
      if (distance <= pixelRadius && distance < closestDistance) {
        closestDistance = distance;
        closestId = id;
      }
    }
    return closestId;
  }

  groundAt(clientX: number, clientY: number): Vec2 | null {
    if (this.disposed || !this.setPointerNdc(clientX, clientY)) return null;
    this.camera.updateMatrixWorld(true);
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, hit)) return null;
    if (Math.abs(hit.x) > MAP_HALF_SIZE || Math.abs(hit.z) > MAP_HALF_SIZE) return null;
    return { x: hit.x, z: hit.z };
  }

  entitiesInScreenRect(rect: ScreenRect, state: GameState): string[] {
    if (this.disposed) return [];
    const left = Math.min(rect.left, rect.right);
    const right = Math.max(rect.left, rect.right);
    const top = Math.min(rect.top, rect.bottom);
    const bottom = Math.max(rect.top, rect.bottom);
    const result: string[] = [];

    for (const entity of [...state.units, ...state.buildings]) {
      const visual = this.entityVisuals.get(entity.id);
      if (!visual) continue;
      const point = this.projectWorldPosition(visual.root.position, visual.height * 0.25);
      if (point && point.x >= left && point.x <= right && point.y >= top && point.y <= bottom) {
        result.push(entity.id);
      }
    }
    return result;
  }

  setBuildGhost(kind: BuildingKind, position: Vec2, rotation: number, valid: boolean): void {
    if (this.disposed) return;
    const label = authoredBuildingAssetLabel('player', kind);
    this.queueEnsureAssets([label]);
    const assetRevision = this.authoredAssetRevisions.get(label) ?? 0;
    const modelKey = buildGhostAssetModelKey(
      kind,
      this.authoredPlayerBuildingTemplate(kind) !== null,
      assetRevision,
    );
    if (
      !this.buildGhost
      || this.buildGhost.kind !== kind
      || this.buildGhost.modelKey !== modelKey
      || this.buildGhost.assetRevision !== assetRevision
    ) {
      this.clearBuildGhost();
      const root = new THREE.Group();
      const model = this.getBuildingTemplate(kind, 'player').clone(true);
      root.add(model);
      const footprint = this.addMesh(
        root,
        this.planeGeometry(1, 1),
        valid ? this.palette.ghostValid : this.palette.ghostInvalid,
        0,
        0.035,
        0,
        false,
      );
      footprint.rotation.x = -Math.PI / 2;
      footprint.scale.set(BUILDING_DEFS[kind].footprint.x, BUILDING_DEFS[kind].footprint.z, 1);
      this.buildGhost = { root, kind, valid, modelKey, assetRevision };
      this.ghostRoot.add(root);
      this.applyGhostMaterial(root, valid);
    } else if (this.buildGhost.valid !== valid) {
      this.buildGhost.valid = valid;
      this.applyGhostMaterial(this.buildGhost.root, valid);
    }

    this.buildGhost.root.position.set(clampMapCoordinate(position.x), 0.02, clampMapCoordinate(position.z));
    this.buildGhost.root.rotation.y = rotation;
  }

  private refreshBuildGhostForAsset(label: string): void {
    const ghost = this.buildGhost;
    if (!ghost || authoredBuildingAssetLabel('player', ghost.kind) !== label) return;
    const position = { x: ghost.root.position.x, z: ghost.root.position.z };
    const rotation = ghost.root.rotation.y;
    const { kind, valid } = ghost;
    this.clearBuildGhost();
    this.setBuildGhost(kind, position, rotation, valid);
  }

  clearBuildGhost(): void {
    if (!this.buildGhost) return;
    this.ghostRoot.remove(this.buildGhost.root);
    this.buildGhost = null;
  }

  showCommandMarker(position: Vec2, tone = 'move'): void {
    if (this.disposed) return;
    const material = tone === 'attack' || tone === 'danger'
      ? this.palette.command.attack
      : tone === 'build' || tone === 'success'
        ? this.palette.command.build
        : tone === 'warning'
          ? this.palette.command.warning
          : this.palette.command.move;
    this.addPulse(position, material, 0.9, this.reducedMotion ? 0.22 : 0.62);
  }

  pan(dx: number, dz: number): void {
    if (this.disposed) return;
    this.cameraTarget.x = clampMapCoordinate(this.cameraTarget.x + dx);
    this.cameraTarget.z = clampMapCoordinate(this.cameraTarget.z + dz);
    this.updateCameraTransform();
  }

  zoom(delta: number): void {
    if (this.disposed || !Number.isFinite(delta) || delta === 0) return;
    const normalized = Math.abs(delta) > 2 ? delta / 100 : delta;
    this.viewHeight = THREE.MathUtils.clamp(this.viewHeight * Math.pow(1.12, normalized), MIN_VIEW_HEIGHT, MAX_VIEW_HEIGHT);
    this.resize();
    this.updateDecorativeDetailVisibility();
  }

  /** Set an absolute orthographic framing for deterministic desktop review fixtures. */
  setViewHeight(height: number): void {
    if (this.disposed || !Number.isFinite(height)) return;
    this.viewHeight = THREE.MathUtils.clamp(height, MIN_VIEW_HEIGHT, MAX_VIEW_HEIGHT);
    this.resize();
    this.updateDecorativeDetailVisibility();
  }

  focus(position: Vec2): void {
    if (this.disposed) return;
    this.cameraTarget.set(clampMapCoordinate(position.x), 0, clampMapCoordinate(position.z));
    this.updateCameraTransform();
  }

  listenerX(): number {
    return this.cameraTarget.x;
  }

  worldToScreen(position: Vec2): ScreenPoint {
    return this.projectWorldPosition(new THREE.Vector3(position.x, 0, position.z), 0) ?? {
      x: Number.NaN,
      y: Number.NaN,
    };
  }

  private createPalette(): MaterialPalette {
    const standard = (parameters: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial =>
      this.ownMaterial(new THREE.MeshStandardMaterial(parameters));
    const basic = (parameters: THREE.MeshBasicMaterialParameters): THREE.MeshBasicMaterial =>
      this.ownMaterial(new THREE.MeshBasicMaterial({ toneMapped: false, ...parameters }));

    return {
      ground: standard({ color: 0xffffff, map: this.createTerrainTexture(), roughness: 1, metalness: 0 }),
      earth: standard({ color: 0x5c594b, roughness: 1, metalness: 0 }),
      earthDark: standard({ color: 0x252b28, roughness: 1, metalness: 0 }),
      road: standard({ color: 0xffffff, map: this.createRoadTexture(), roughness: 0.94, metalness: 0.03 }),
      roadEdge: standard({ color: 0x55584e, roughness: 0.98, metalness: 0 }),
      roadMarking: standard({
        color: 0xffffff,
        map: this.createRoadMarkingTexture(),
        transparent: true,
        alphaTest: 0.24,
        depthWrite: false,
        roughness: 0.88,
        metalness: 0,
      }),
      contactShadow: basic({
        color: 0x07100f,
        transparent: true,
        opacity: CONTACT_SHADOW_PRESENTATION.opacity,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
      trackMark: basic({ color: 0x1c2421, transparent: true, opacity: 0.34, depthWrite: false }),
      defenseFootprint: basic({
        color: 0xc88432,
        transparent: true,
        opacity: BREAKTHROUGH_DEFENSE_MARKER_PRESENTATION.opacity,
        depthWrite: false,
      }),
      groundScar: basic({ color: 0x202623, transparent: true, opacity: 0.28, depthWrite: false }),
      dustPatch: basic({ color: 0x9d8b63, transparent: true, opacity: 0.13, depthWrite: false }),
      scorch: basic({ color: 0x171b18, transparent: true, opacity: 0.42, depthWrite: false }),
      dust: basic({ color: 0xb8a477, transparent: true, opacity: 0.24, depthWrite: false }),
      smoke: basic({ color: 0x3b413e, transparent: true, opacity: 0.3, depthWrite: false }),
      muzzleCore: basic({
        color: 0xfff2b0,
        transparent: true,
        opacity: 0.96,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      heavyShockwave: basic({
        color: 0xffad66,
        transparent: true,
        opacity: COMBAT_VFX_READABILITY_V2.heavy.shockwaveOpacity,
        depthWrite: false,
      }),
      muzzleFlame: basic({
        color: 0xff8a24,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      spark: basic({
        color: 0xffc45a,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      fire: basic({
        color: 0xff5a1f,
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      concrete: standard({ color: 0xffffff, map: this.createConcreteTexture(), roughness: 0.92, metalness: 0.03 }),
      graphite: standard({ color: 0x373d3c, roughness: 0.6, metalness: 0.18 }),
      graphiteDark: standard({ color: 0x171d1d, roughness: 0.74, metalness: 0.22 }),
      panel: standard({ color: 0x515956, roughness: 0.48, metalness: 0.34 }),
      bronze: standard({ color: 0x7a5735, roughness: 0.58, metalness: 0.48 }),
      marking: standard({ color: 0xb77a32, emissive: 0x261406, emissiveIntensity: 0.22, roughness: 0.84, metalness: 0 }),
      steel: standard({ color: 0x929894, roughness: 0.35, metalness: 0.9 }),
      rubber: standard({ color: 0x111516, roughness: 0.84, metalness: 0 }),
      rock: standard({ color: 0x4b4c49, roughness: 0.96, metalness: 0, flatShading: true }),
      crystal: standard({ color: 0x2587ca, emissive: 0x126bb0, emissiveIntensity: 1.6, roughness: 0.26, metalness: 0.08 }),
      cyan: standard({ color: CYAN, emissive: CYAN, emissiveIntensity: 2.1, roughness: 0.26, metalness: 0.2 }),
      cyanDim: standard({ color: 0x2b6870, emissive: 0x17454c, emissiveIntensity: 0.6, roughness: 0.45, metalness: 0.18 }),
      team: {
        player: standard({ color: PLAYER_COLOR, roughness: 0.58, metalness: 0.12 }),
        enemy: standard({ color: ENEMY_COLOR, roughness: 0.58, metalness: 0.12 }),
      },
      selection: {
        player: basic({ color: CYAN, transparent: true, opacity: 0.9, depthWrite: false }),
        enemy: basic({ color: ENEMY_COLOR, transparent: true, opacity: 0.9, depthWrite: false }),
      },
      compactSelection: {
        player: basic({
          color: CYAN,
          transparent: true,
          opacity: GROUP_SELECTION_RING_POLICY.compactOpacity,
          depthWrite: false,
        }),
        enemy: basic({
          color: ENEMY_COLOR,
          transparent: true,
          opacity: GROUP_SELECTION_RING_POLICY.compactOpacity,
          depthWrite: false,
        }),
      },
      neutralRing: basic({ color: 0x8a9690, transparent: true, opacity: 0.62, depthWrite: false }),
      compactNeutralRing: basic({
        color: 0x8a9690,
        transparent: true,
        opacity: GROUP_SELECTION_RING_POLICY.compactOpacity,
        depthWrite: false,
      }),
      warningRing: basic({ color: 0xf0b84c, transparent: true, opacity: 0.9, depthWrite: false }),
      factionMarkerBack: basic(healthOverlayMaterialParameters(HEALTH_BAR_PRESENTATION.trackColor, 0.96)),
      factionMarker: basic(healthOverlayMaterialParameters(0xffffff)),
      healthFrame: {
        player: basic(healthOverlayMaterialParameters(FACTION_VISUALS.player.bright)),
        enemy: basic(healthOverlayMaterialParameters(FACTION_VISUALS.enemy.bright)),
        neutral: basic(healthOverlayMaterialParameters(FACTION_VISUALS.neutral.bright)),
      },
      healthBack: basic(healthOverlayMaterialParameters(
        HEALTH_BAR_PRESENTATION.trackColor,
        HEALTH_BAR_PRESENTATION.trackOpacity,
      )),
      healthGood: basic(healthOverlayMaterialParameters(HEALTH_BAR_PRESENTATION.healthyColor)),
      healthWarning: basic(healthOverlayMaterialParameters(HEALTH_BAR_PRESENTATION.warningColor)),
      healthDanger: basic(healthOverlayMaterialParameters(HEALTH_BAR_PRESENTATION.criticalColor)),
      healthBatchColor: basic(healthOverlayMaterialParameters(0xffffff)),
      ghostValid: basic({ color: CYAN, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }),
      ghostInvalid: basic({ color: 0xef4d69, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide }),
      impact: {
        player: basic({ color: CYAN, transparent: true, opacity: 0.78, depthWrite: false }),
        enemy: basic({ color: ENEMY_COLOR, transparent: true, opacity: 0.78, depthWrite: false }),
        neutral: basic({ color: 0xe7c76b, transparent: true, opacity: 0.72, depthWrite: false }),
      },
      command: {
        move: basic({ color: CYAN, transparent: true, opacity: 0.9, depthWrite: false }),
        attack: basic({ color: ENEMY_COLOR, transparent: true, opacity: 0.92, depthWrite: false }),
        build: basic({ color: 0x67e8a0, transparent: true, opacity: 0.9, depthWrite: false }),
        warning: basic({ color: 0xf0b84c, transparent: true, opacity: 0.92, depthWrite: false }),
      },
    };
  }

  private createTerrainTexture(): THREE.DataTexture {
    const size = 512;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const index = (y * size + x) * 4;
        const hash = stableHash(`${x >> 1}:${y >> 1}:faultline`);
        const fine = (hash & 31) - 15;
        const broad = Math.sin(x * 0.036) * 7 + Math.cos(y * 0.031) * 6 + Math.sin((x + y) * 0.014) * 7;
        const ash = Math.max(0, Math.sin(x * 0.018 - y * 0.024) * 6);
        const rutA = Math.abs(((x * 0.66 + y * 0.39) % 131) - 65.5) < 1.15;
        const rutB = Math.abs(((x * 0.66 + y * 0.39 + 9) % 131) - 65.5) < 0.72;
        const track = rutA || rutB ? -13 : 0;
        const pebble = (hash & 255) > 249 ? -20 : 0;
        const rustDust = ((hash >>> 8) & 255) > 251 ? 7 : 0;
        data[index] = THREE.MathUtils.clamp(Math.round(91 + fine * 0.42 + broad + ash * 0.52 + track + pebble + rustDust), 50, 128);
        data[index + 1] = THREE.MathUtils.clamp(Math.round(94 + fine * 0.35 + broad * 0.82 + ash * 0.48 + track + pebble + rustDust * 0.52), 52, 126);
        data[index + 2] = THREE.MathUtils.clamp(Math.round(80 + fine * 0.28 + broad * 0.58 + ash * 0.32 + track * 0.8 + pebble), 44, 112);
        data[index + 3] = 255;
      }
    }
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
    texture.name = 'deterministic-battlefield-soil';
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.anisotropy = Math.min(
      RENDER_QUALITY_PROFILES[this.renderQuality].anisotropy,
      this.renderer.capabilities.getMaxAnisotropy(),
    );
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    this.ownedTextures.add(texture);
    return texture;
  }

  private createRoadTexture(): THREE.DataTexture {
    const size = 256;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const index = (y * size + x) * 4;
        const hash = stableHash(`road:${x >> 1}:${y >> 1}`);
        const grain = (hash & 23) - 11;
        const wear = Math.sin(x * 0.075) * 3 + Math.cos(y * 0.048) * 4;
        const crack = Math.abs(((x * 0.58 + y * 0.93) % 139) - 69.5) < 0.65 ? -14 : 0;
        const aggregate = (hash & 255) > 247 ? 13 : 0;
        const oilLane = Math.abs(x - size * 0.32) < 9 || Math.abs(x - size * 0.68) < 9 ? -5 : 0;
        const value = THREE.MathUtils.clamp(Math.round(45 + grain * 0.4 + wear + crack + aggregate + oilLane), 22, 76);
        data[index] = value;
        data[index + 1] = value + 2;
        data[index + 2] = value + 2;
        data[index + 3] = 255;
      }
    }
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
    texture.name = 'deterministic-worn-road';
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2.5, 6);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.anisotropy = Math.min(
      RENDER_QUALITY_PROFILES[this.renderQuality].anisotropy,
      this.renderer.capabilities.getMaxAnisotropy(),
    );
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    this.ownedTextures.add(texture);
    return texture;
  }

  private createRoadMarkingTexture(): THREE.DataTexture {
    const width = 64;
    const height = 256;
    const data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      const dash = y % 64 < 34;
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        const hash = stableHash(`road-mark:${x}:${y}`);
        const line = Math.abs(x - width / 2) < 2.6;
        const chipped = (hash & 255) > 235;
        data[index] = 205;
        data[index + 1] = 175;
        data[index + 2] = 92;
        data[index + 3] = dash && line && !chipped ? 238 : 0;
      }
    }
    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
    texture.name = 'deterministic-worn-road-marking';
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    this.ownedTextures.add(texture);
    return texture;
  }

  private createConcreteTexture(): THREE.DataTexture {
    const size = 256;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const index = (y * size + x) * 4;
        const hash = stableHash(`concrete:${x >> 1}:${y >> 1}`);
        const grain = (hash & 31) - 15;
        const panelSeam = x % 64 < 2 || y % 64 < 2 ? -21 : 0;
        const expansionJoint = x % 128 < 3 || y % 128 < 3 ? -11 : 0;
        const hairline = Math.abs(((x * 0.73 + y * 1.11) % 173) - 86.5) < 0.62 ? -16 : 0;
        const oil = Math.max(0, 1 - Math.hypot((x % 96) - 48, (y % 112) - 56) / 30) * -13;
        const value = THREE.MathUtils.clamp(Math.round(105 + grain * 0.38 + panelSeam + expansionJoint + hairline + oil), 54, 128);
        data[index] = value;
        data[index + 1] = value + 2;
        data[index + 2] = value;
        data[index + 3] = 255;
      }
    }
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
    texture.name = 'deterministic-industrial-concrete';
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.anisotropy = Math.min(
      RENDER_QUALITY_PROFILES[this.renderQuality].anisotropy,
      this.renderer.capabilities.getMaxAnisotropy(),
    );
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    this.ownedTextures.add(texture);
    return texture;
  }

  private createLighting(): THREE.DirectionalLight {
    const breakthrough = this.fixture.startsWith('breakthrough-demo');
    const visualGold = this.fixture === 'visual-gold-review';
    const sky = new THREE.HemisphereLight(
      0xcbd7d7,
      visualGold ? 0x665b46 : 0x5a503e,
      visualGold ? 1.62 : breakthrough ? 1.52 : 1.44,
    );
    this.scene.add(sky);

    if (visualGold) {
      // A uniform studio-strength environment fill keeps the very dark
      // authored armor planes legible from the fixed review camera without
      // introducing local hero lights or changing ordinary gameplay scenes.
      this.scene.add(new THREE.AmbientLight(0xbfcac4, 0.52));
    }

    const sun = new THREE.DirectionalLight(0xffddb2, visualGold ? 2.48 : breakthrough ? 2.58 : 2.34);
    sun.position.set(visualGold ? 105 : -105, 150, visualGold ? 105 : -105);
    const profile = RENDER_QUALITY_PROFILES[this.renderQuality];
    sun.castShadow = profile.shadows;
    sun.shadow.mapSize.set(profile.shadowMapSize, profile.shadowMapSize);
    sun.shadow.camera.left = -105;
    sun.shadow.camera.right = 105;
    sun.shadow.camera.top = 105;
    sun.shadow.camera.bottom = -105;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 360;
    sun.shadow.bias = -0.00022;
    sun.shadow.normalBias = 0.04;
    this.scene.add(sun, sun.target);
    return sun;
  }

  private createGroundAndRoads(): void {
    const ground = this.addMesh(
      this.worldRoot,
      this.planeGeometry(MAP_HALF_SIZE * 2, MAP_HALF_SIZE * 2),
      this.palette.ground,
      0,
      -0.06,
      0,
      false,
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;

    const routes: Vec2[][] = [
      [{ x: -72, z: 66 }, { x: -52, z: 46 }, { x: 0, z: 0 }, { x: 52, z: -46 }, { x: 72, z: -66 }],
      [{ x: -52, z: 46 }, { x: -52, z: -29 }, { x: 0, z: 0 }],
      [{ x: 52, z: -46 }, { x: 52, z: 29 }, { x: 0, z: 0 }],
      [{ x: -68, z: -2 }, { x: 0, z: 0 }, { x: 68, z: 2 }],
    ];
    for (const route of routes) {
      for (let index = 1; index < route.length; index += 1) {
        const start = route[index - 1];
        const end = route[index];
        if (start && end) this.addRoadSegment(start, end, 5.4);
      }
    }

    const playerSpawn = LEVEL_ANCHORS.find((anchor) => anchor.id === 'spawn_player')?.position;
    const enemySpawn = LEVEL_ANCHORS.find((anchor) => anchor.id === 'spawn_enemy')?.position;
    if (playerSpawn) this.addPad(playerSpawn, 28, 24, 'player');
    if (enemySpawn) this.addPad(enemySpawn, 28, 24, 'enemy');
    this.createOperationalBaseDressing();
    if (this.fixture === 'visual-gold-review') this.createVisualGoldGroundDressing();

    this.createTerrainDressing();
    if (this.fixture.startsWith('breakthrough-demo')) this.createBreakthroughBattlefieldDressing();

    const borderThickness = 0.45;
    this.addBox(this.worldRoot, MAP_HALF_SIZE * 2, 0.35, borderThickness, 0, 0.12, -MAP_HALF_SIZE, this.palette.roadEdge, false);
    this.addBox(this.worldRoot, MAP_HALF_SIZE * 2, 0.35, borderThickness, 0, 0.12, MAP_HALF_SIZE, this.palette.roadEdge, false);
    this.addBox(this.worldRoot, borderThickness, 0.35, MAP_HALF_SIZE * 2, -MAP_HALF_SIZE, 0.12, 0, this.palette.roadEdge, false);
    this.addBox(this.worldRoot, borderThickness, 0.35, MAP_HALF_SIZE * 2, MAP_HALF_SIZE, 0.12, 0, this.palette.roadEdge, false);
  }

  private createOperationalBaseDressing(): void {
    // Presentation-only service surfaces. Navigation, placement and ground picking remain on y=0.
    const slabs: ReadonlyArray<readonly [number, number, number, number, number]> = [
      [-49, 30, 13, 11, 0], [-37, 48, 10, 9, 0], [-33, 31, 12, 10, -0.72],
      [49, -30, 13, 11, 0], [37, -48, 10, 9, 0], [33, -31, 12, 10, -0.72],
    ];
    const slabMesh = new THREE.InstancedMesh(this.boxGeometry(1, 1, 1), this.palette.concrete, slabs.length);
    slabMesh.name = 'operational-base-service-aprons';
    slabMesh.receiveShadow = true;
    const transform = new THREE.Object3D();
    slabs.forEach(([x, z, width, depth, rotation], index) => {
      transform.position.set(x, 0.005, z);
      transform.rotation.set(0, rotation, 0);
      transform.scale.set(width, 0.01, depth);
      transform.updateMatrix();
      slabMesh.setMatrixAt(index, transform.matrix);
    });
    slabMesh.instanceMatrix.needsUpdate = true;
    this.worldRoot.add(slabMesh);

    const trackSegments: ReadonlyArray<readonly [Vec2, Vec2, number]> = [
      [{ x: -49, z: 29 }, { x: -51, z: 19 }, -0.64], [{ x: -49, z: 29 }, { x: -51, z: 19 }, 0.64],
      [{ x: 49, z: -29 }, { x: 51, z: -19 }, -0.64], [{ x: 49, z: -29 }, { x: 51, z: -19 }, 0.64],
      [{ x: -46, z: 40 }, { x: -36, z: 31 }, -0.72], [{ x: -46, z: 40 }, { x: -36, z: 31 }, 0.72],
      [{ x: 46, z: -40 }, { x: 36, z: -31 }, -0.72], [{ x: 46, z: -40 }, { x: 36, z: -31 }, 0.72],
    ];
    const tracks = new THREE.InstancedMesh(this.boxGeometry(1, 1, 1), this.palette.trackMark, trackSegments.length);
    tracks.name = 'operational-haul-and-entry-ruts';
    trackSegments.forEach(([start, end, lateralOffset], index) => {
      const dx = end.x - start.x;
      const dz = end.z - start.z;
      const length = Math.hypot(dx, dz);
      const rightX = dz / length;
      const rightZ = -dx / length;
      transform.position.set(
        (start.x + end.x) * 0.5 + rightX * lateralOffset,
        0.014,
        (start.z + end.z) * 0.5 + rightZ * lateralOffset,
      );
      transform.rotation.set(0, Math.atan2(dx, dz), 0);
      transform.scale.set(0.2, 0.003, length + 0.2);
      transform.updateMatrix();
      tracks.setMatrixAt(index, transform.matrix);
    });
    tracks.instanceMatrix.needsUpdate = true;
    this.worldRoot.add(tracks);

    const stains: ReadonlyArray<readonly [number, number, number, number]> = [
      [-48, 31, 2.2, 1.3], [-34, 30, 1.7, 1.1], [-39, 49, 1.2, 0.8],
      [48, -31, 2.2, 1.3], [34, -30, 1.7, 1.1], [39, -49, 1.2, 0.8],
    ];
    const stainMesh = new THREE.InstancedMesh(this.circleGeometry(1, 24), this.palette.scorch, stains.length);
    stainMesh.name = 'operational-service-stains';
    stainMesh.renderOrder = 2;
    stains.forEach(([x, z, width, depth], index) => {
      transform.position.set(x, 0.015, z);
      transform.rotation.set(-Math.PI / 2, 0, 0);
      transform.scale.set(width, depth, 1);
      transform.updateMatrix();
      stainMesh.setMatrixAt(index, transform.matrix);
    });
    stainMesh.instanceMatrix.needsUpdate = true;
    this.worldRoot.add(stainMesh);
  }

  private createVisualGoldGroundDressing(): void {
    const transform = new THREE.Object3D();
    for (const batch of VISUAL_GOLD_GROUND_DRESSING) {
      const geometry = batch.geometry === 'box'
        ? this.boxGeometry(1, 1, 1)
        : this.circleGeometry(1, 24);
      const material = batch.material === 'playerTeam'
        ? this.palette.team.player
        : batch.material === 'concrete'
          ? this.palette.concrete
          : batch.material === 'road'
            ? this.palette.road
            : batch.material === 'roadEdge'
              ? this.palette.roadEdge
              : batch.material === 'trackMark'
                ? this.palette.trackMark
                : this.palette.marking;
      const mesh = new THREE.InstancedMesh(geometry, material, batch.instances.length);
      mesh.name = batch.id;
      mesh.castShadow = false;
      mesh.receiveShadow = batch.geometry === 'box';
      mesh.renderOrder = batch.purpose === 'surface-wear'
        ? 3
        : batch.purpose === 'faction-marking' || batch.purpose === 'wayfinding-landmark'
          ? 4
          : 2;
      mesh.userData.fixture = 'visual-gold-review';
      mesh.userData.presentationOnly = true;
      mesh.userData.collision = batch.collision;
      mesh.userData.navigation = batch.navigation;
      mesh.userData.purpose = batch.purpose;

      batch.instances.forEach((instance, index) => {
        transform.position.set(instance.x, instance.y, instance.z);
        if (batch.geometry === 'disc') {
          transform.rotation.set(-Math.PI / 2, 0, instance.rotation);
          transform.scale.set(instance.width, instance.depth, 1);
        } else {
          transform.rotation.set(0, instance.rotation, 0);
          transform.scale.set(instance.width, instance.height, instance.depth);
        }
        transform.updateMatrix();
        mesh.setMatrixAt(index, transform.matrix);
      });
      mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
      this.worldRoot.add(mesh);
    }
  }

  private createBreakthroughBattlefieldDressing(): void {
    // Presentation only: collision, navigation and every gameplay anchor remain on y=0.
    const transform = new THREE.Object3D();
    for (const batch of BREAKTHROUGH_STATIC_BATTLEFIELD_BATCHES) {
      const geometry = batch.geometry === 'box'
        ? this.boxGeometry(1, 1, 1)
        : batch.geometry === 'churn-disc'
          ? this.circleGeometry(1, 28)
          : batch.geometry === 'shell-disc'
            ? this.circleGeometry(1, 24)
            : batch.geometry === 'shell-rim'
              ? this.ringGeometry(0.62, 1, 24)
              : this.ringGeometry(
                BREAKTHROUGH_DEFENSE_MARKER_PRESENTATION.innerRadius,
                BREAKTHROUGH_DEFENSE_MARKER_PRESENTATION.outerRadius,
                32,
              );
      const material = batch.material === 'concrete'
        ? this.palette.concrete
        : batch.material === 'enemy-team'
          ? this.palette.team.enemy
          : batch.material === 'ground-scar'
            ? this.palette.groundScar
            : batch.material === 'dust-patch'
              ? this.palette.dustPatch
              : batch.material === 'track-mark'
                ? this.palette.trackMark
                : batch.material === 'scorch'
                  ? this.palette.scorch
                  : this.palette.defenseFootprint;
      const mesh = new THREE.InstancedMesh(geometry, material, batch.instances.length);
      mesh.name = batch.objectName;
      mesh.castShadow = false;
      mesh.receiveShadow = batch.receiveShadow;
      mesh.renderOrder = batch.renderOrder;
      mesh.userData.batchId = batch.id;
      mesh.userData.instanceIds = batch.instances.map((instance) => instance.id);
      mesh.userData.semanticInstanceCount = batch.instances.length;
      mesh.userData.presentationOnly = true;
      mesh.userData.collision = batch.collision;
      mesh.userData.navigation = batch.navigation;
      batch.instances.forEach((instance, index) => {
        transform.position.set(instance.x, instance.y, instance.z);
        transform.rotation.set(instance.rotationX, instance.rotationY, instance.rotationZ);
        transform.scale.set(instance.scaleX, instance.scaleY, instance.scaleZ);
        transform.updateMatrix();
        mesh.setMatrixAt(index, transform.matrix);
      });
      mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
      this.worldRoot.add(mesh);
      this.breakthroughStaticBatches.push(mesh);
    }
  }

  private ensureHealthBarBatchCapacity(requiredCapacity: number): void {
    const capacity = nextInstancedBatchCapacity(this.healthBarBatchCapacity, requiredCapacity, 32);
    if (this.healthBarBatches && capacity === this.healthBarBatchCapacity) return;

    if (this.healthBarBatches) {
      for (const previous of Object.values(this.healthBarBatches)) {
        previous.parent?.remove(previous);
        previous.dispose();
      }
    }
    const createBatch = (
      name: string,
      geometry: THREE.BufferGeometry,
      material: THREE.MeshBasicMaterial,
      renderOrder: number,
      vertexColors: boolean,
    ): THREE.InstancedMesh => {
      const mesh = new THREE.InstancedMesh(geometry, material, capacity);
      mesh.name = name;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.renderOrder = renderOrder;
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.visible = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.userData.healthBar = true;
      mesh.userData.batchedHealthBar = true;
      mesh.userData.presentationOnly = true;
      mesh.userData.vertexColors = vertexColors;
      this.entityRoot.add(mesh);
      return mesh;
    };
    const frame = createBatch(
      'health-bar-frame-batch',
      this.planeGeometry(1.14, 1.72),
      this.palette.healthBatchColor,
      20,
      true,
    );
    const back = createBatch(
      'health-bar-track-batch',
      this.planeGeometry(1.06, 1.34),
      this.palette.healthBack,
      21,
      false,
    );
    const fill = createBatch(
      'health-bar-fill-batch',
      this.planeGeometry(1, 1),
      this.palette.healthBatchColor,
      22,
      true,
    );
    this.healthBarBatchInstanceIds = new Array<string>(capacity).fill('');
    for (const batch of [frame, back, fill]) {
      batch.userData.instanceIds = this.healthBarBatchInstanceIds;
    }
    this.healthBarBatches = { frame, back, fill };
    this.healthBarBatchCapacity = capacity;
  }

  private ensureContactShadowBatchCapacity(requiredCapacity: number): void {
    const capacity = nextInstancedBatchCapacity(this.contactShadowBatchCapacity, requiredCapacity, 32);
    if (this.contactShadowBatch && capacity === this.contactShadowBatchCapacity) return;

    const previous = this.contactShadowBatch;
    if (previous) {
      previous.parent?.remove(previous);
      previous.dispose();
    }
    const mesh = new THREE.InstancedMesh(
      this.circleGeometry(1, 28),
      this.palette.contactShadow,
      capacity,
    );
    mesh.name = 'entity-contact-shadow-batch';
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.renderOrder = 1;
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.visible = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.userData.contactShadow = true;
    mesh.userData.presentationOnly = true;
    mesh.userData.opacity = CONTACT_SHADOW_PRESENTATION.opacity;
    mesh.userData.scale = CONTACT_SHADOW_PRESENTATION.scale;
    this.contactShadowInstanceIds = new Array<string>(capacity).fill('');
    mesh.userData.instanceIds = this.contactShadowInstanceIds;
    this.entityRoot.add(mesh);
    this.contactShadowBatch = mesh;
    this.contactShadowBatchCapacity = capacity;
  }

  private ensureFactionMarkerBatchCapacity(requiredCapacity: number): void {
    const capacity = nextInstancedBatchCapacity(this.factionMarkerBatchCapacity, requiredCapacity, 32);
    if (
      this.factionMarkerBackBatch
      && this.factionMarkerColorBatch
      && capacity === this.factionMarkerBatchCapacity
    ) return;

    for (const previous of [this.factionMarkerBackBatch, this.factionMarkerColorBatch]) {
      if (!previous) continue;
      previous.parent?.remove(previous);
      previous.dispose();
    }
    const createBatch = (
      name: string,
      material: THREE.MeshBasicMaterial,
      renderOrder: number,
    ): THREE.InstancedMesh => {
      const mesh = new THREE.InstancedMesh(this.planeGeometry(1, 1), material, capacity);
      mesh.name = name;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.renderOrder = renderOrder;
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.visible = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.userData.factionMarker = true;
      mesh.userData.presentationOnly = true;
      this.entityRoot.add(mesh);
      return mesh;
    };
    this.factionMarkerInstanceIds = new Array<string>(capacity).fill('');
    this.factionMarkerBackBatch = createBatch(
      'faction-marker-back-batch',
      this.palette.factionMarkerBack,
      24,
    );
    this.factionMarkerColorBatch = createBatch(
      'faction-marker-color-batch',
      this.palette.factionMarker,
      25,
    );
    this.factionMarkerBackBatch.userData.instanceIds = this.factionMarkerInstanceIds;
    this.factionMarkerColorBatch.userData.instanceIds = this.factionMarkerInstanceIds;
    this.factionMarkerBatchCapacity = capacity;
  }

  private ensureCompactSelectionBatchCapacity(requiredCapacity: number): void {
    const capacity = nextInstancedBatchCapacity(this.compactSelectionBatchCapacity, requiredCapacity, 16);
    if (this.compactSelectionBatch && capacity === this.compactSelectionBatchCapacity) return;

    const previous = this.compactSelectionBatch;
    if (previous) {
      previous.parent?.remove(previous);
      previous.dispose();
    }
    const mesh = new THREE.InstancedMesh(
      this.ringGeometry(GROUP_SELECTION_RING_POLICY.compactInnerRadius, 1, 48),
      this.palette.compactSelection.player,
      capacity,
    );
    mesh.name = 'compact-player-selection-ring-batch';
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.renderOrder = 5;
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.visible = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.userData.compactSelectionRing = true;
    mesh.userData.presentationOnly = true;
    mesh.userData.team = 'player';
    this.compactSelectionInstanceIds = new Array<string>(capacity).fill('');
    mesh.userData.instanceIds = this.compactSelectionInstanceIds;
    this.entityRoot.add(mesh);
    this.compactSelectionBatch = mesh;
    this.compactSelectionBatchCapacity = capacity;
  }

  private updateHealthBarBatch(): void {
    if (!this.healthBarBatches) return;
    let requiredCapacity = 0;
    for (const visual of this.entityVisuals.values()) {
      if (
        visual.healthBar?.batched === true
        && visual.healthBar.group.visible
        && shouldInstanceVisibleEntity(
          visual.root.visible,
          visual.root.parent !== this.entityRoot,
          visual.entityType,
        )
      ) requiredCapacity += 1;
    }
    this.ensureHealthBarBatchCapacity(requiredCapacity);
    const batches = this.healthBarBatches;
    if (!batches) return;

    let instanceIndex = 0;
    for (const [entityId, visual] of this.entityVisuals) {
      const healthBar = visual.healthBar;
      if (
        !healthBar?.batched
        || !healthBar.group.visible
        || !shouldInstanceVisibleEntity(
          visual.root.visible,
          visual.root.parent !== this.entityRoot,
          visual.entityType,
        )
      ) continue;
      healthBar.group.updateWorldMatrix(true, true);
      batches.frame.setMatrixAt(instanceIndex, healthBar.frame.matrixWorld);
      batches.back.setMatrixAt(instanceIndex, healthBar.back.matrixWorld);
      batches.fill.setMatrixAt(instanceIndex, healthBar.fill.matrixWorld);
      this.healthBarBatchColor.copy(this.palette.healthFrame[visual.team].color);
      batches.frame.setColorAt(instanceIndex, this.healthBarBatchColor);
      const fillMaterial = healthBar.fill.material;
      this.healthBarBatchColor.copy(
        fillMaterial instanceof THREE.MeshBasicMaterial
          ? fillMaterial.color
          : this.palette.healthGood.color,
      );
      batches.fill.setColorAt(instanceIndex, this.healthBarBatchColor);
      this.healthBarBatchInstanceIds[instanceIndex] = entityId;
      instanceIndex += 1;
    }
    for (let index = instanceIndex; index < this.healthBarBatchCount; index += 1) {
      this.healthBarBatchInstanceIds[index] = '';
    }
    for (const batch of Object.values(batches)) {
      batch.count = instanceIndex;
      batch.visible = instanceIndex > 0;
      batch.instanceMatrix.needsUpdate = instanceIndex > 0;
      batch.userData.semanticInstanceCount = instanceIndex;
    }
    if (batches.frame.instanceColor) batches.frame.instanceColor.needsUpdate = instanceIndex > 0;
    if (batches.fill.instanceColor) batches.fill.instanceColor.needsUpdate = instanceIndex > 0;
    this.healthBarBatchCount = instanceIndex;
  }

  private updateContactShadowBatch(): void {
    if (!this.contactShadowBatch) return;
    let requiredCapacity = 0;
    for (const visual of this.entityVisuals.values()) {
      if (shouldInstanceVisibleEntity(
        visual.root.visible,
        visual.root.parent !== this.entityRoot,
        visual.entityType,
      ) && visual.authoredBuildingRuinAge < 0) requiredCapacity += 1;
    }
    this.ensureContactShadowBatchCapacity(requiredCapacity);
    const mesh = this.contactShadowBatch;
    if (!mesh) return;

    let instanceIndex = 0;
    for (const [entityId, visual] of this.entityVisuals) {
      if (!shouldInstanceVisibleEntity(
        visual.root.visible,
        visual.root.parent !== this.entityRoot,
        visual.entityType,
      ) || visual.authoredBuildingRuinAge >= 0) continue;
      const transform = this.instancedPresentationTransform;
      transform.position.set(visual.root.position.x, visual.root.position.y + 0.026, visual.root.position.z);
      transform.rotation.set(-Math.PI / 2, 0, 0);
      transform.scale.set(visual.contactShadowScaleX, visual.contactShadowScaleZ, 1);
      transform.updateMatrix();
      mesh.setMatrixAt(instanceIndex, transform.matrix);
      this.contactShadowInstanceIds[instanceIndex] = entityId;
      instanceIndex += 1;
    }
    for (let index = instanceIndex; index < this.contactShadowCount; index += 1) {
      this.contactShadowInstanceIds[index] = '';
    }
    mesh.count = instanceIndex;
    mesh.visible = instanceIndex > 0;
    mesh.instanceMatrix.needsUpdate = instanceIndex > 0;
    mesh.userData.semanticInstanceCount = instanceIndex;
    this.contactShadowCount = instanceIndex;
  }

  private updateFactionMarkerBatch(): void {
    let requiredCapacity = 0;
    for (const visual of this.entityVisuals.values()) {
      if (shouldInstanceVisibleEntity(
        visual.root.visible,
        visual.root.parent !== this.entityRoot,
        visual.entityType,
      )) requiredCapacity += 1;
    }
    this.ensureFactionMarkerBatchCapacity(requiredCapacity);
    const backBatch = this.factionMarkerBackBatch;
    const colorBatch = this.factionMarkerColorBatch;
    if (!backBatch || !colorBatch) return;

    let instanceIndex = 0;
    let playerCount = 0;
    let enemyCount = 0;
    for (const [entityId, visual] of this.entityVisuals) {
      if (!shouldInstanceVisibleEntity(
        visual.root.visible,
        visual.root.parent !== this.entityRoot,
        visual.entityType,
      )) continue;
      const transform = this.instancedPresentationTransform;
      const authoredWreck = visual.authoredWreckAge >= 0;
      const authoredBuildingRuin = visual.authoredBuildingRuinAge >= 0;
      const persistent = authoredWreck || authoredBuildingRuin || visual.destructionAge >= 0;
      const revealBuildingRuinReviewMarker = authoredBuildingRuin && (
        this.fixture === 'building-ruin-review'
        || this.fixture === 'building-ruin-review-reduced'
        || this.fixture === 'enemy-infrastructure-review'
      );
      if (!shouldShowPersistentFactionMarker(
        visual.team,
        persistent,
        revealBuildingRuinReviewMarker || this.isVisible(visual.root.position),
      )) continue;
      const markerScale = (visual.entityType === 'building'
        ? HEALTH_BAR_PRESENTATION.buildingMarkerSize
        : HEALTH_BAR_PRESENTATION.unitMarkerSize) * (authoredWreck ? 1.1 : authoredBuildingRuin ? 1.35 : 1);
      if (authoredBuildingRuin) {
        const anchor = visual.authoredBuildingRuinMarkerAnchor;
        if (anchor) anchor.getWorldPosition(transform.position);
        else transform.position.set(
          visual.root.position.x,
          visual.root.position.y + 1,
          visual.root.position.z,
        );
      } else {
        transform.position.set(
          visual.root.position.x,
          visual.root.position.y + (authoredWreck
            ? 1.15
            : visual.height + HEALTH_BAR_PRESENTATION.markerOffset),
          visual.root.position.z,
        );
      }
      transform.quaternion.copy(this.camera.quaternion);
      transform.rotateZ(Math.PI / 4);
      transform.scale.setScalar(markerScale);
      transform.updateMatrix();
      backBatch.setMatrixAt(instanceIndex, transform.matrix);
      transform.scale.setScalar(markerScale * 0.64);
      transform.updateMatrix();
      colorBatch.setMatrixAt(instanceIndex, transform.matrix);
      this.factionMarkerColor.setHex(factionVisual(visual.team).bright);
      colorBatch.setColorAt(instanceIndex, this.factionMarkerColor);
      this.factionMarkerInstanceIds[instanceIndex] = entityId;
      if (visual.team === 'player') playerCount += 1;
      if (visual.team === 'enemy') enemyCount += 1;
      instanceIndex += 1;
    }
    for (let index = instanceIndex; index < this.factionMarkerCount; index += 1) {
      this.factionMarkerInstanceIds[index] = '';
    }
    for (const batch of [backBatch, colorBatch]) {
      batch.count = instanceIndex;
      batch.visible = instanceIndex > 0;
      batch.instanceMatrix.needsUpdate = instanceIndex > 0;
      batch.userData.semanticInstanceCount = instanceIndex;
    }
    if (colorBatch.instanceColor) colorBatch.instanceColor.needsUpdate = instanceIndex > 0;
    this.factionMarkerCount = instanceIndex;
    this.playerFactionMarkerCount = playerCount;
    this.enemyFactionMarkerCount = enemyCount;
  }

  private updateCompactSelectionBatch(): void {
    if (!this.compactSelectionBatch) return;
    const compact = this.groupSelectionCount >= GROUP_SELECTION_RING_POLICY.minimumGroupSize;
    let requiredCapacity = 0;
    if (compact) {
      for (const visual of this.entityVisuals.values()) {
        if (
          visual.selected
          && visual.team === 'player'
          && shouldInstanceVisibleEntity(
            visual.root.visible,
            visual.root.parent !== this.entityRoot,
            visual.entityType,
          )
        ) requiredCapacity += 1;
      }
    }
    this.ensureCompactSelectionBatchCapacity(requiredCapacity);
    const mesh = this.compactSelectionBatch;
    if (!mesh) return;

    let instanceIndex = 0;
    if (compact) {
      for (const [entityId, visual] of this.entityVisuals) {
        if (
          !visual.selected
          || visual.team !== 'player'
          || !shouldInstanceVisibleEntity(
            visual.root.visible,
            visual.root.parent !== this.entityRoot,
            visual.entityType,
          )
        ) continue;
        const transform = this.instancedPresentationTransform;
        transform.position.set(visual.root.position.x, visual.root.position.y + 0.075, visual.root.position.z);
        transform.rotation.set(-Math.PI / 2, 0, 0);
        transform.scale.set(visual.selectionScaleX, visual.selectionScaleZ, 1);
        transform.updateMatrix();
        mesh.setMatrixAt(instanceIndex, transform.matrix);
        this.compactSelectionInstanceIds[instanceIndex] = entityId;
        instanceIndex += 1;
      }
    }
    for (let index = instanceIndex; index < this.compactSelectionBatchCount; index += 1) {
      this.compactSelectionInstanceIds[index] = '';
    }
    mesh.count = instanceIndex;
    mesh.visible = instanceIndex > 0;
    mesh.instanceMatrix.needsUpdate = instanceIndex > 0;
    mesh.userData.semanticInstanceCount = instanceIndex;
    this.compactSelectionBatchCount = instanceIndex;
    this.compactSelectionRingCount = instanceIndex + this.independentCompactSelectionRingCount;
  }

  private createFogOverlay(): { texture: THREE.DataTexture; mesh: THREE.Mesh } {
    for (let offset = 0; offset < this.fogTextureData.length; offset += 4) {
      this.writeFogPixel(offset, FOG_UNKNOWN);
    }

    const texture = new THREE.DataTexture(
      this.fogTextureData,
      FOG_TEXTURE_SIZE,
      FOG_TEXTURE_SIZE,
      THREE.RGBAFormat,
      THREE.UnsignedByteType,
    );
    texture.name = 'player-visibility-fog';
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;

    const material = this.ownMaterial(new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }));
    const mesh = new THREE.Mesh(this.planeGeometry(1, 1), material);
    mesh.name = 'player-visibility-fog-plane';
    // +90 degrees preserves the visibility grid's min-Z to max-Z row order.
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(0, 0.09, 0);
    mesh.scale.set(MAP_HALF_SIZE * 2, MAP_HALF_SIZE * 2, 1);
    mesh.frustumCulled = false;
    mesh.renderOrder = 40;
    this.worldRoot.add(mesh);
    return { texture, mesh };
  }

  private updateFogOverlay(snapshot: VisibilitySnapshot): void {
    this.visibilitySnapshot = snapshot;
    const width = Number.isInteger(snapshot.width) && snapshot.width > 0 ? snapshot.width : 0;
    const height = Number.isInteger(snapshot.height) && snapshot.height > 0 ? snapshot.height : 0;
    const cellCount = width * height;
    if (cellCount <= 0 || !Number.isSafeInteger(cellCount)) {
      this.visibilityMask = new Uint8Array(0);
      this.exploredMask = new Uint8Array(0);
      this.fogSampleVisibleMask.fill(0);
      this.fogSampleExploredMask.fill(0);
      for (let offset = 0; offset < this.fogTextureData.length; offset += 4) {
        this.writeFogPixel(offset, FOG_UNKNOWN);
      }
      this.fogTexture.needsUpdate = true;
      return;
    }

    if (this.visibilityMask.length !== cellCount) {
      this.visibilityMask = new Uint8Array(cellCount);
      this.exploredMask = new Uint8Array(cellCount);
    } else {
      this.visibilityMask.fill(0);
      this.exploredMask.fill(0);
    }
    for (const index of snapshot.explored) {
      if (Number.isInteger(index) && index >= 0 && index < cellCount) this.exploredMask[index] = 1;
    }
    for (const index of snapshot.visible) {
      if (!Number.isInteger(index) || index < 0 || index >= cellCount) continue;
      this.visibilityMask[index] = 1;
      this.exploredMask[index] = 1;
    }

    // Resample the authoritative grid into the existing 64x64 display buffer.
    // Edge rings are computed only from this presentation mask so intelligence,
    // entity disclosure and event filtering continue to read the masks above.
    for (let textureZ = 0; textureZ < FOG_TEXTURE_SIZE; textureZ += 1) {
      const cellZ = Math.min(height - 1, Math.floor(((textureZ + 0.5) * height) / FOG_TEXTURE_SIZE));
      for (let textureX = 0; textureX < FOG_TEXTURE_SIZE; textureX += 1) {
        const cellX = Math.min(width - 1, Math.floor(((textureX + 0.5) * width) / FOG_TEXTURE_SIZE));
        const cellIndex = cellZ * width + cellX;
        const textureIndex = textureZ * FOG_TEXTURE_SIZE + textureX;
        this.fogSampleVisibleMask[textureIndex] = this.visibilityMask[cellIndex] === 1 ? 1 : 0;
        this.fogSampleExploredMask[textureIndex] = this.exploredMask[cellIndex] === 1 ? 1 : 0;
      }
    }
    for (let textureZ = 0; textureZ < FOG_TEXTURE_SIZE; textureZ += 1) {
      for (let textureX = 0; textureX < FOG_TEXTURE_SIZE; textureX += 1) {
        const textureIndex = textureZ * FOG_TEXTURE_SIZE + textureX;
        const state: FogDisplayState = this.fogSampleVisibleMask[textureIndex] === 1
          ? 'visible'
          : this.fogSampleExploredMask[textureIndex] === 1 ? 'explored' : 'unknown';
        const edgeRing = fogVisibleEdgeRing(
          this.fogSampleVisibleMask,
          FOG_TEXTURE_SIZE,
          FOG_TEXTURE_SIZE,
          textureX,
          textureZ,
        );
        const color = fogDisplayPixel(state, edgeRing);
        const pixelOffset = (textureZ * FOG_TEXTURE_SIZE + textureX) * 4;
        this.fogTextureData[pixelOffset] = color[0];
        this.fogTextureData[pixelOffset + 1] = color[1];
        this.fogTextureData[pixelOffset + 2] = color[2];
        this.fogTextureData[pixelOffset + 3] = color[3];
      }
    }

    const { bounds } = snapshot;
    const mapWidth = Math.max(0.001, bounds.maxX - bounds.minX);
    const mapDepth = Math.max(0.001, bounds.maxZ - bounds.minZ);
    this.fogMesh.position.set((bounds.minX + bounds.maxX) / 2, 0.09, (bounds.minZ + bounds.maxZ) / 2);
    this.fogMesh.scale.set(mapWidth, mapDepth, 1);
    this.fogTexture.needsUpdate = true;
  }

  private writeFogPixel(offset: number, color: readonly [number, number, number, number]): void {
    this.fogTextureData[offset] = color[0];
    this.fogTextureData[offset + 1] = color[1];
    this.fogTextureData[offset + 2] = color[2];
    this.fogTextureData[offset + 3] = color[3];
  }

  private visibilityCellIndex(position: Vec2): number | null {
    const snapshot = this.visibilitySnapshot;
    if (!snapshot || this.visibilityMask.length === 0 || !Number.isFinite(position.x) || !Number.isFinite(position.z)) {
      return null;
    }
    const { bounds, cellSize, width, height } = snapshot;
    if (
      !Number.isFinite(cellSize)
      || cellSize <= 0
      || position.x < bounds.minX
      || position.x > bounds.maxX
      || position.z < bounds.minZ
      || position.z > bounds.maxZ
    ) return null;
    const x = Math.min(width - 1, Math.max(0, Math.floor((position.x - bounds.minX) / cellSize)));
    const z = Math.min(height - 1, Math.max(0, Math.floor((position.z - bounds.minZ) / cellSize)));
    const index = z * width + x;
    return index >= 0 && index < this.visibilityMask.length ? index : null;
  }

  private isVisible(position: Vec2): boolean {
    const index = this.visibilityCellIndex(position);
    return index !== null && this.visibilityMask[index] === 1;
  }

  private isExplored(position: Vec2): boolean {
    const index = this.visibilityCellIndex(position);
    return index !== null && this.exploredMask[index] === 1;
  }

  private shouldRenderEvent(event: SimulationEvent, disclosedIds: ReadonlySet<string>): boolean {
    if (event.type === 'shot') {
      if (event.sourceId && !disclosedIds.has(event.sourceId)) return false;
      if (event.targetId && !disclosedIds.has(event.targetId)) return false;
      return this.isVisible(event.at);
    }
    if (event.type === 'impact') return this.isVisible(event.at);
    if (event.type === 'destroyed') {
      const buildingRuinReview = this.fixture === 'building-ruin-review'
        || this.fixture === 'building-ruin-review-reduced';
      if (buildingRuinReview && event.targetId?.startsWith('b-ruin-')) return true;
      if (this.fixture === 'enemy-infrastructure-review' && event.targetId?.startsWith('b-enemy-infra-')) {
        return true;
      }
      return shouldDiscloseDestroyedEvent(event.team, this.isVisible(event.at));
    }
    return event.team === 'player' || this.isVisible(event.at);
  }

  private createTerrainDressing(): void {
    const wornGround: Array<[number, number, number, number, number]> = [
      [-42, 57, 8.5, 4.2, -0.35], [-62, 20, 6.8, 3.1, 0.42], [-34, -52, 9.2, 3.8, -0.18],
      [35, 54, 8.2, 3.6, 0.28], [62, -18, 7.4, 3.2, -0.5], [38, -58, 9.6, 4.1, 0.18],
      [-7, 42, 5.8, 2.6, -0.62], [8, -43, 6.2, 2.8, 0.55], [71, 45, 5.3, 2.4, -0.2],
      [-72, -43, 5.7, 2.5, 0.3],
    ];
    wornGround.forEach(([x, z, width, depth, rotation], index) => {
      const patch = this.addMesh(
        this.worldRoot,
        this.circleGeometry(1, 32),
        index % 3 === 0 ? this.palette.dustPatch : this.palette.groundScar,
        x,
        0.004,
        z,
        false,
      );
      patch.rotation.x = -Math.PI / 2;
      patch.rotation.z = rotation;
      patch.scale.set(width, depth, 1);
      patch.renderOrder = 1;
    });

    for (const anchor of LEVEL_ANCHORS) {
      if (anchor.purpose === 'resource') {
        const scar = this.addCylinder(
          this.worldRoot,
          7.8,
          8.6,
          0.01,
          28,
          anchor.position.x,
          0.005,
          anchor.position.z,
          this.palette.earthDark,
          false,
        );
        scar.scale.z = 0.78;
        const warning = this.addMesh(
          this.worldRoot,
          this.ringGeometry(6.78, 6.94, 32),
          this.palette.marking,
          anchor.position.x,
          0.014,
          anchor.position.z,
          false,
        );
        warning.rotation.x = -Math.PI / 2;
        warning.scale.z = 0.78;
      }
      if (anchor.purpose === 'landmark') this.addIndustrialLandmark(anchor.position, anchor.id.endsWith('north') ? 1 : -1);
    }

    const rubbleSites: Vec2[] = [
      { x: -78, z: 28 }, { x: -74, z: -52 }, { x: -34, z: -70 }, { x: 32, z: 72 },
      { x: 76, z: 50 }, { x: 78, z: -26 }, { x: 30, z: -76 }, { x: -12, z: 76 },
      { x: -70, z: 4 }, { x: 69, z: -3 }, { x: -21, z: -66 }, { x: 19, z: 67 },
    ];
    rubbleSites.forEach((site, siteIndex) => {
      const count = 3 + (siteIndex % 3);
      for (let index = 0; index < count; index += 1) {
        const hash = stableHash(`terrain-rubble:${siteIndex}:${index}`);
        const angle = ((hash % 628) / 100) - Math.PI;
        const distance = 0.8 + ((hash >>> 8) % 28) / 10;
        const scale = 0.22 + ((hash >>> 16) % 30) / 100;
        const rock = this.addMesh(
          this.worldRoot,
          this.dodecahedronGeometry(1),
          this.palette.rock,
          site.x + Math.sin(angle) * distance,
          scale * 0.62,
          site.z + Math.cos(angle) * distance,
          true,
        );
        rock.scale.set(scale * 1.2, scale * 0.75, scale);
        rock.rotation.set(angle * 0.11, angle, angle * 0.07);
      }
    });
  }

  private addIndustrialLandmark(position: Vec2, direction: 1 | -1): void {
    const group = new THREE.Group();
    group.name = direction > 0 ? 'background-industrial-landmark-north' : 'background-industrial-landmark-south';
    group.userData.nonInteractiveBackdrop = true;
    group.position.set(position.x, 0, position.z + direction * 24);
    group.rotation.y = direction > 0 ? 0 : Math.PI;
    this.worldRoot.add(group);
    this.addBox(group, 15, 0.18, 8, 0, 0.08, 0, this.palette.earthDark, false);
    for (const x of [-5.5, 5.5]) {
      this.addBox(group, 2.1, 3.8, 2.1, x, 1.98, 0, this.palette.graphiteDark, true);
      this.addBox(group, 2.45, 0.3, 2.45, x, 3.92, 0, this.palette.bronze, true);
      this.addCylinder(group, 0.28, 0.38, 3.8, 10, x, 5.82, 0, this.palette.steel, true);
      this.addBox(group, 0.5, 0.5, 0.5, x, 7.74, 0, this.palette.marking, false);
    }
    this.addBox(group, 11.3, 0.38, 0.58, 0, 4.2, 0, this.palette.panel, true);
    for (const x of [-3.75, -1.25, 1.25, 3.75]) {
      const pennant = this.addBox(group, 1.3, 0.18, 0.28, x, 4.2, 0.42, this.palette.marking, false);
      pennant.rotation.z = (x / 3.75) * 0.06;
    }
  }

  private addRoadSegment(start: Vec2, end: Vec2, width: number): void {
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.hypot(dx, dz);
    const centerX = (start.x + end.x) / 2;
    const centerZ = (start.z + end.z) / 2;
    const rotation = Math.atan2(dx, dz);
    const shoulder = this.addBox(this.worldRoot, width + 1.5, 0.01, length + 0.8, centerX, 0.004, centerZ, this.palette.roadEdge, false);
    shoulder.rotation.y = rotation;
    const road = this.addBox(this.worldRoot, width, 0.01, length + 0.3, centerX, 0.007, centerZ, this.palette.road, false);
    road.rotation.y = rotation;
    road.receiveShadow = true;
    const marking = this.addBox(this.worldRoot, width, 0.003, length + 0.08, centerX, 0.0135, centerZ, this.palette.roadMarking, false);
    marking.rotation.y = rotation;
    marking.renderOrder = 2;
  }

  private addPad(position: Vec2, width: number, depth: number, team: CombatTeam): void {
    const pad = this.addBox(this.worldRoot, width, 0.01, depth, position.x, 0.005, position.z, this.palette.concrete, false);
    pad.receiveShadow = true;
    const teamMaterial = this.palette.team[team];
    for (const [barWidth, barDepth, offsetX, offsetZ] of [
      [width - 1.4, 0.22, 0, -depth * 0.46], [width - 1.4, 0.22, 0, depth * 0.46],
      [0.22, depth - 1.4, -width * 0.46, 0], [0.22, depth - 1.4, width * 0.46, 0],
    ] as const) {
      this.addBox(this.worldRoot, barWidth, 0.003, barDepth, position.x + offsetX, 0.0125, position.z + offsetZ, this.palette.graphiteDark, false);
    }
    const inset = this.addMesh(
      this.worldRoot,
      this.ringGeometry(0.87, 1, 8),
      this.palette.neutralRing,
      position.x,
      0.014,
      position.z,
      false,
    );
    inset.rotation.x = -Math.PI / 2;
    inset.rotation.z = Math.PI / 8;
    inset.scale.set(width * 0.47, depth * 0.47, 1);
    for (const [x, z, rotation] of [
      [-width * 0.42, -depth * 0.41, 0], [width * 0.42, -depth * 0.41, Math.PI / 2],
      [-width * 0.42, depth * 0.41, Math.PI / 2], [width * 0.42, depth * 0.41, 0],
    ] as const) {
      const corner = this.addBox(this.worldRoot, 3.8, 0.003, 0.48, position.x + x, 0.0145, position.z + z, teamMaterial, false);
      corner.rotation.y = rotation;
    }

    const servicePanels: Array<readonly [number, number, number]> = [];
    for (const x of [-9, -3, 3, 9]) {
      servicePanels.push([position.x + x, position.z - depth * 0.405, 0]);
      servicePanels.push([position.x + x, position.z + depth * 0.405, 0]);
    }
    for (const z of [-6, 0, 6]) {
      servicePanels.push([position.x - width * 0.405, position.z + z, Math.PI / 2]);
      servicePanels.push([position.x + width * 0.405, position.z + z, Math.PI / 2]);
    }
    const panelMesh = new THREE.InstancedMesh(
      this.boxGeometry(0.62, 0.026, 1.18),
      this.palette.graphiteDark,
      servicePanels.length,
    );
    panelMesh.name = `${team}-base-service-panels`;
    panelMesh.receiveShadow = true;
    const transform = new THREE.Object3D();
    servicePanels.forEach(([x, z, rotation], index) => {
      transform.position.set(x, 0.014, z);
      transform.rotation.set(0, rotation, 0);
      transform.updateMatrix();
      panelMesh.setMatrixAt(index, transform.matrix);
    });
    panelMesh.instanceMatrix.needsUpdate = true;
    this.worldRoot.add(panelMesh);
  }

  private createBeaconVisual(): BeaconVisual {
    const root = new THREE.Group();
    root.position.set(0, 0, 0);
    const controlRing = this.addMesh(root, this.ringGeometry(5.8, 7, 64), this.palette.neutralRing, 0, 0.014, 0, false);
    controlRing.name = 'beacon-control-ring';
    controlRing.rotation.x = -Math.PI / 2;
    const plaza = this.addCylinder(root, 5.25, 5.8, 0.01, 12, 0, 0.005, 0, this.palette.earthDark, false);
    plaza.rotation.y = Math.PI / 12;
    for (let index = 0; index < 6; index += 1) {
      const angle = (index / 6) * Math.PI * 2;
      const arm = this.addBox(
        root,
        1.15,
        0.01,
        3.2,
        Math.sin(angle) * 3.65,
        0.015,
        Math.cos(angle) * 3.65,
        index % 2 === 0 ? this.palette.marking : this.palette.panel,
        false,
      );
      arm.rotation.y = angle;
    }
    const pad = this.addCylinder(root, 2.2, 2.7, 0.01, 8, 0, 0.012, 0, this.palette.concrete, false);
    pad.rotation.y = Math.PI / 8;
    this.addCylinder(root, 1.35, 1.8, 1.0, 8, 0, 0.52, 0, this.palette.graphite, true);
    this.addCylinder(root, 0.35, 0.45, 3.8, 12, 0, 2.92, 0, this.palette.steel, true);
    for (const height of [1.42, 2.32, 3.22]) {
      this.addCylinder(root, 0.72, 0.72, 0.13, 12, 0, height, 0, this.palette.bronze, true);
    }
    const signal = this.addCylinder(root, 0.5, 0.72, 0.32, 16, 0, 4.92, 0, this.palette.cyan, false);
    signal.name = 'beacon-signal';
    signal.userData.spinSpeed = 1.4;
    const progressDisc = this.addMesh(root, this.circleGeometry(1, 48), this.palette.cyanDim, 0, 0.016, 0, false);
    progressDisc.rotation.x = -Math.PI / 2;
    progressDisc.scale.setScalar(0.65);
    return { root, controlRing, progressDisc, signal };
  }

  private syncBeacon(beacon: BeaconState): void {
    this.beaconVisual.root.position.set(beacon.position.x, 0, beacon.position.z);
    this.beaconVisual.root.visible = true;
    const presentation = resolveBeaconPresentationPolicy(this.fixture, beacon);
    this.beaconVisual.controlRing.visible = presentation.controlRingVisible;
    this.beaconControlRingVisible = presentation.controlRingVisible;
    this.beaconVisual.signal.visible = presentation.signalVisible;
    this.beaconVisual.signal.material = presentation.signalDimmed ? this.palette.cyanDim : this.palette.cyan;
    this.beaconVisual.controlRing.material = !beacon.unlocked
      ? this.palette.neutralRing
      : beacon.contested
        ? this.palette.warningRing
        : beacon.controllingTeam
          ? this.palette.selection[beacon.controllingTeam]
          : this.palette.selection.player;
    const progress = Math.max(beacon.playerProgress, beacon.enemyProgress) / Math.max(1, beacon.targetProgress);
    const scale = 0.65 + THREE.MathUtils.clamp(progress, 0, 1) * 0.9;
    this.beaconVisual.progressDisc.scale.setScalar(scale);
    this.beaconVisual.progressDisc.material = beacon.controllingTeam
      ? this.palette.selection[beacon.controllingTeam]
      : this.palette.cyanDim;
  }

  private syncEntity(
    entity: WorldEntity,
    selected: boolean,
    hasDefensePower: boolean,
    selectionPresentation: SelectionRingPresentation,
  ): void {
    const key = this.entityModelKey(entity);
    let visual = this.entityVisuals.get(entity.id);
    if (!visual || visual.modelKey !== key) {
      if (visual) {
        this.entityRoot.remove(visual.root);
        this.pickables.delete(visual.root);
      }
      visual = this.createEntityVisual(entity, key);
      this.entityVisuals.set(entity.id, visual);
      this.entityRoot.add(visual.root);
      this.pickables.add(visual.root);
    }

    visual.targetPosition.set(entity.position.x, 0, entity.position.z);
    if (this.reducedMotion) visual.root.position.copy(visual.targetPosition);
    visual.selected = selected;
    const compactSelection = selected && selectionPresentation.compact;
    const team = entity.team === 'neutral' ? null : entity.team;
    const batchedPlayerSelection = this.fixture.startsWith('breakthrough-demo')
      && compactSelection
      && team === 'player';
    visual.selection.visible = selected && !batchedPlayerSelection;
    if (!batchedPlayerSelection) {
      visual.selection.geometry = this.ringGeometry(
        compactSelection
          ? GROUP_SELECTION_RING_POLICY.compactInnerRadius
          : GROUP_SELECTION_RING_POLICY.normalInnerRadius,
        1,
        48,
      );
      visual.selection.material = compactSelection
        ? team ? this.palette.compactSelection[team] : this.palette.compactNeutralRing
        : team ? this.palette.selection[team] : this.palette.neutralRing;
    }
    visual.selection.userData.compactSelectionRing = compactSelection && !batchedPlayerSelection;

    if (entity.entityType === 'unit') {
      visual.targetRotation = enemyVehicleSocketReviewBodyYaw(this.fixture, entity.id, entity.rotation);
      visual.targetAimRotation = entity.rotation;
      visual.body.scale.set(1, 1, 1);
      visual.activityTarget = entity.kind === 'harvester'
        ? entity.order.type === 'gather' ? 1 : 0
        : entity.order.type === 'attack'
          || entity.order.type === 'attackMove'
          || entity.order.type === 'repair'
          ? 1
          : 0;
      const cargoSlots = visibleCargoSlotCount(entity.cargo, entity.cargoCapacity, visual.cargoSlots.length);
      visual.cargoSlots.forEach((slot, index) => {
        slot.visible = index < cargoSlots;
      });
      visual.buildProgress = 1;
      this.updateHealthBar(visual, entity.hp, entity.maxHp, selected);
      this.updateDamageVisual(visual, entity.hp, entity.maxHp, 1);
    } else if (entity.entityType === 'building') {
      visual.targetRotation = entity.rotation;
      visual.targetAimRotation = entity.aimRotation;
      const now = this.hostWindow.performance.now() / 1000;
      const production = entity.queue[0];
      if (production) {
        const key = production.unitKind;
        const changed = key !== visual.productionKey
          || Math.abs(production.remaining - visual.productionRemaining) > 0.0001;
        if (changed) visual.productionActiveUntil = now + 0.18;
        visual.productionKey = key;
        visual.productionRemaining = production.remaining;
        visual.productionProgress = productionProgress(production.remaining, production.total);
      } else {
        visual.productionKey = '';
        visual.productionRemaining = Number.NaN;
        visual.productionProgress = 0;
        visual.productionActiveUntil = 0;
      }
      const productionAdvancing = Boolean(production && now < visual.productionActiveUntil);
      const holdingForExit = now < visual.productionDoorHoldUntil;
      visual.activityTarget = productionAdvancing ? 1 : 0;
      visual.doorOpenTarget = productionDoorPresentationTarget(
        productionAdvancing,
        production?.remaining ?? 0,
        production?.total ?? 0,
        holdingForExit,
      );
      visual.buildProgress = entity.buildProgress;
      if (constructionProgressAdvanced(visual.constructionProgressObserved, entity.buildProgress)) {
        visual.constructionActiveUntil = now + 0.18;
      }
      visual.constructionProgressObserved = entity.buildProgress;
      visual.constructionActive = entity.buildProgress < 0.995 && now < visual.constructionActiveUntil;
      visual.body.traverse((object) => {
        if (object.userData.poweredOnly === true) {
          object.visible = entity.powered && entity.connected && hasDefensePower;
        }
      });
      this.updateHealthBar(visual, entity.hp, entity.maxHp, selected);
      this.updateDamageVisual(visual, entity.hp, entity.maxHp, entity.buildProgress);
      this.updateConstructionVisual(visual, entity.buildProgress);
    } else {
      visual.targetRotation = 0;
      visual.targetAimRotation = 0;
      visual.activityTarget = 0;
      visual.buildProgress = 1;
      const abundance = 0.38 + Math.sqrt(Math.max(0, entity.amount) / Math.max(1, entity.maxAmount)) * 0.62;
      const radiusScale = entity.radius / 5.2;
      visual.body.scale.set(radiusScale * abundance, abundance, radiusScale * abundance);
      if (visual.healthBar) visual.healthBar.group.visible = false;
    }
  }

  private createEntityVisual(entity: WorldEntity, modelKey: string): EntityVisual {
    const root = new THREE.Group();
    root.userData.entityId = entity.id;
    root.userData.vehicleDust = entity.entityType === 'unit' && DUST_VEHICLE_KINDS.has(entity.kind);
    root.position.set(entity.position.x, 0, entity.position.z);
    let body: THREE.Group;
    let height: number;
    let pickRadius: number;
    let ringX: number;
    let ringZ: number;

    if (entity.entityType === 'unit') {
      const template = this.getUnitTemplate(entity.kind, entity.team);
      body = template.userData.riggedAnimation === true
        ? cloneSkeleton(template) as THREE.Group
        : template.clone(true);
      height = UNIT_HEIGHT[entity.kind];
      pickRadius = entity.radius * 1.4;
      ringX = entity.radius * 1.28;
      ringZ = entity.radius * 1.28;
    } else if (entity.entityType === 'building') {
      body = this.getBuildingTemplate(entity.kind, entity.team).clone(true);
      height = BUILDING_HEIGHT[entity.kind];
      pickRadius = Math.max(entity.footprint.x, entity.footprint.z) * 0.55;
      ringX = entity.footprint.x * 0.55;
      ringZ = entity.footprint.z * 0.55;
    } else {
      body = this.createResourceTemplate().clone(true);
      height = 5.4;
      pickRadius = entity.radius;
      ringX = entity.radius * 1.05;
      ringZ = entity.radius * 1.05;
    }

    body.rotation.y = entity.entityType === 'resource' ? 0 : entity.rotation;
    root.add(body);
    const contactShadowScaleX = entity.entityType === 'resource'
      ? 0
      : ringX * CONTACT_SHADOW_PRESENTATION.scale;
    const contactShadowScaleZ = entity.entityType === 'resource'
      ? 0
      : ringZ
        * CONTACT_SHADOW_PRESENTATION.scale
        * (entity.entityType === 'unit'
          ? CONTACT_SHADOW_PRESENTATION.unitDepthRatio
          : CONTACT_SHADOW_PRESENTATION.buildingDepthRatio);
    if (entity.entityType !== 'resource' && !this.fixture.startsWith('breakthrough-demo')) {
      const contactShadow = this.addMesh(
        root,
        this.circleGeometry(1, 28),
        this.palette.contactShadow,
        0,
        0.026,
        0,
        false,
      );
      contactShadow.name = 'entity-contact-shadow';
      contactShadow.userData.contactShadow = true;
      contactShadow.userData.presentationOnly = true;
      contactShadow.userData.opacity = CONTACT_SHADOW_PRESENTATION.opacity;
      contactShadow.userData.scale = CONTACT_SHADOW_PRESENTATION.scale;
      contactShadow.rotation.x = -Math.PI / 2;
      contactShadow.scale.set(contactShadowScaleX, contactShadowScaleZ, 1);
      contactShadow.renderOrder = 1;
    }
    const turretPivots: THREE.Object3D[] = [];
    body.traverse((object) => {
      if (object.userData.turretPivot === true) turretPivots.push(object);
    });
    const turretPivot = turretPivots[0] ?? null;
    const targetAimRotation = entity.entityType === 'building' ? entity.aimRotation : entity.entityType === 'unit' ? entity.rotation : 0;
    if (turretPivot) turretPivot.rotation.y = targetAimRotation - body.rotation.y;
    const team = entity.team === 'neutral' ? null : entity.team;
    const selection = this.addMesh(
      root,
      this.ringGeometry(GROUP_SELECTION_RING_POLICY.normalInnerRadius, 1, 48),
      team ? this.palette.selection[team] : this.palette.neutralRing,
      0,
      0.075,
      0,
      false,
    );
    selection.rotation.x = -Math.PI / 2;
    selection.scale.set(ringX, ringZ, 1);
    selection.visible = false;
    selection.renderOrder = 5;

    const healthBar = entity.entityType === 'resource'
      ? null
      : this.createHealthBar(root, height, Math.max(1.8, ringX * 1.35), entity.team);
    const damageVisual = entity.entityType === 'building'
      || (entity.entityType === 'unit' && DUST_VEHICLE_KINDS.has(entity.kind))
      ? this.createDamageVisual(root, height, entity.id, entity.entityType === 'building')
      : null;
    const animatedNodes: THREE.Object3D[] = [];
    const locomotionNodes: THREE.Object3D[] = [];
    const infantryParts: PresentationPart[] = [];
    const activityParts: PresentationPart[] = [];
    const authoredBuildingDamageRoots: Record<AuthoredBuildingDamageRole, THREE.Object3D | null> = {
      damaged: null,
      critical: null,
    };
    const refineryMechanismParts: RefineryMechanismPart[] = [];
    const cargoSlots: THREE.Object3D[] = [];
    const muzzleSockets = new Map<MuzzleSocketName, THREE.Object3D>();
    const presentationSockets = new Map<PresentationSocketName, THREE.Object3D>();
    let repairToolSocket: THREE.Object3D | null = null;
    let launcherPitch: THREE.Object3D | null = null;
    let authoredWreckRoot: THREE.Object3D | null = null;
    let authoredBuildingRuinRoot: THREE.Object3D | null = null;
    let authoredBuildingRuinMarkerAnchor: THREE.Object3D | null = null;
    const lodDetailNodes: PresentationDetailNode[] = [];
    const lodShadowCasters: PresentationShadowCaster[] = [];
    body.traverse((object) => {
      if (typeof object.userData.spinSpeed === 'number') animatedNodes.push(object);
      if (/^(?:wheel|hub|roadwheel)_/.test(object.name)) locomotionNodes.push(object);
      if (/^cargo_slot_\d+$/.test(object.name)) cargoSlots.push(object);
      if (
        object.name === 'muzzle_socket'
        || object.name === 'muzzle_socket_left'
        || object.name === 'muzzle_socket_right'
      ) {
        muzzleSockets.set(object.name, object);
      }
      if (object.name === 'repair_tool_socket') repairToolSocket = object;
      if (object.name === 'launcher_pitch') launcherPitch = object;
      const buildingDamageRole = authoredBuildingDamageRole(
        object.name,
        object.userData.presentation_role,
      );
      if (buildingDamageRole) {
        authoredBuildingDamageRoots[buildingDamageRole] = object;
        object.visible = false;
      }
      if (isAuthoredWreckRoot(object.name, object.userData.presentation_role)) {
        authoredWreckRoot = object;
      }
      if (isAuthoredBuildingRuinRoot(object.name, object.userData.presentation_role)) {
        authoredBuildingRuinRoot = object;
      }
      if (
        object.name === 'ruin_marker_anchor'
        || object.userData.socket_role === 'faction_marker_low'
      ) {
        authoredBuildingRuinMarkerAnchor = object;
      }
      if (PRESENTATION_SOCKET_NAMES.has(object.name)) {
        presentationSockets.set(object.name as PresentationSocketName, object);
      }
      if (object.userData.decorativeDetail === true) {
        lodDetailNodes.push({ node: object, visible: object.visible });
      }
      if (object instanceof THREE.Mesh && object.castShadow) {
        lodShadowCasters.push({ node: object, castShadow: true });
      }
      if (!(object instanceof THREE.Bone) && /^(?:soldier|engineer|launcher|loader)_(?:lead|left|right)$/.test(object.name)) {
        infantryParts.push(this.capturePresentationPart(object));
      }
      if (object.name === 'factory_door' || object.name === 'barracks_door') {
        activityParts.push(this.capturePresentationPart(object));
      }
      const refineryRole = refineryMechanismRole(object.name, object.userData.presentation_role);
      if (refineryRole) {
        refineryMechanismParts.push({
          ...this.capturePresentationPart(object),
          role: refineryRole,
        });
      }
    });
    const resolvedAuthoredWreckRoot = authoredWreckRoot as THREE.Object3D | null;
    const authoredWreckLiveNodes: PresentationVisibilityNode[] = [];
    if (resolvedAuthoredWreckRoot) {
      const wreckNodes = new Set<THREE.Object3D>();
      resolvedAuthoredWreckRoot.traverse((object) => wreckNodes.add(object));
      body.traverse((object) => {
        if (object instanceof THREE.Mesh && !wreckNodes.has(object)) {
          authoredWreckLiveNodes.push({ node: object, visible: object.visible });
        }
      });
      resolvedAuthoredWreckRoot.visible = false;
    }
    const resolvedAuthoredBuildingRuinRoot = authoredBuildingRuinRoot as THREE.Object3D | null;
    const authoredBuildingRuinLiveNodes: PresentationVisibilityNode[] = [];
    if (resolvedAuthoredBuildingRuinRoot) {
      const ruinNodes = new Set<THREE.Object3D>();
      resolvedAuthoredBuildingRuinRoot.traverse((object) => ruinNodes.add(object));
      body.traverse((object) => {
        if (object instanceof THREE.Mesh && !ruinNodes.has(object)) {
          authoredBuildingRuinLiveNodes.push({ node: object, visible: object.visible });
        }
      });
      resolvedAuthoredBuildingRuinRoot.visible = false;
    }
    cargoSlots.sort((left, right) => left.name.localeCompare(right.name));
    const muzzleSocketNames = [...muzzleSockets.keys()].sort();
    const damageSocketName = selectDamageSocketName(
      [...presentationSockets.keys()],
      `${entity.id}:damage-socket`,
    );
    if (damageVisual && damageSocketName) {
      const damageSocket = presentationSockets.get(damageSocketName);
      if (damageSocket) {
        damageVisual.root.removeFromParent();
        damageSocket.add(damageVisual.root);
        damageVisual.root.position.set(0, 0, 0);
        damageVisual.root.rotation.set(0, 0, 0);
        damageVisual.root.userData.damageSocketName = damageSocketName;
      }
    }
    const wreckAnchor = presentationSockets.get('wreck_anchor') ?? null;
    const constructionVisual = entity.entityType === 'building'
      ? this.createConstructionVisual(entity.footprint, height, entity.team)
      : null;
    const motionPhase = (stableHash(`${entity.id}:presentation`) % 628) / 100;
    const animationClips = entity.entityType === 'unit'
      ? this.authoredUnitAnimations.get(`${entity.team}:${entity.kind}`) ?? []
      : [];
    const animationMixer = entity.entityType === 'unit'
      && animationClips.length > 0
      ? new THREE.AnimationMixer(body)
      : null;
    const animationActions = new Map<string, THREE.AnimationAction>();
    if (animationMixer) {
      for (const clip of animationClips) {
        const action = animationMixer.clipAction(clip);
        const role = clip.name.slice(clip.name.lastIndexOf('_') + 1);
        if (role === 'fire' || role === 'hit' || role === 'death') {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
        }
        animationActions.set(role, action);
      }
      animationActions.get('idle')?.play();
    }

    return {
      root,
      body,
      turretPivot,
      modelKey,
      entityType: entity.entityType,
      height,
      pickRadius,
      targetPosition: new THREE.Vector3(entity.position.x, 0, entity.position.z),
      targetRotation: entity.entityType === 'resource' ? 0 : entity.rotation,
      targetAimRotation,
      team: entity.team,
      contactShadowScaleX,
      contactShadowScaleZ,
      selectionScaleX: ringX,
      selectionScaleZ: ringZ,
      selection,
      healthBar,
      damageVisual,
      authoredBuildingDamageRoots,
      animatedNodes,
      locomotionNodes,
      infantryParts,
      activityParts,
      cargoSlots,
      muzzleSockets,
      muzzleSocketNames,
      repairToolSocket,
      launcherPitch,
      presentationSockets,
      damageSocketName,
      wreckAnchor,
      authoredWreckRoot: resolvedAuthoredWreckRoot,
      authoredWreckLiveNodes,
      authoredWreckAge: -1,
      authoredWreckDuration: 0,
      authoredWreckActivationOrder: 0,
      authoredBuildingRuinRoot: resolvedAuthoredBuildingRuinRoot,
      authoredBuildingRuinLiveNodes,
      authoredBuildingRuinMarkerAnchor,
      authoredBuildingRuinAge: -1,
      authoredBuildingRuinDuration: 0,
      authoredBuildingRuinActivationOrder: 0,
      destructionResiduePosition: null,
      constructionVisual,
      unitKind: entity.entityType === 'unit' ? entity.kind : null,
      buildingKind: entity.entityType === 'building' ? entity.kind : null,
      motionPhase,
      motionAmount: 0,
      activityTarget: 0,
      activityAmount: 0,
      productionProgress: 0,
      productionKey: '',
      productionRemaining: Number.NaN,
      productionActiveUntil: 0,
      productionDoorHoldUntil: 0,
      productionExitUntil: 0,
      refineryUnloadStartedAt: 0,
      refineryUnloadUntil: 0,
      refineryMechanismPhase: 0,
      refineryMechanismParts,
      doorOpenTarget: 0,
      doorOpenAmount: 0,
      constructionProgressObserved: entity.entityType === 'building' ? entity.buildProgress : 1,
      constructionActiveUntil: 0,
      constructionActive: false,
      animationMixer,
      animationActions,
      animationState: animationMixer ? 'idle' : '',
      buildProgress: entity.entityType === 'building' ? entity.buildProgress : 1,
      bodyBaseY: body.position.y,
      bodyBaseX: body.position.x,
      bodyBaseZ: body.position.z,
      bodyBaseRotationX: body.rotation.x,
      bodyBaseRotationZ: body.rotation.z,
      turretBasePosition: turretPivot?.position.clone() ?? null,
      recoilAmount: 0,
      recoilStrength: 0,
      hitAmount: 0,
      hitDirectionX: 0,
      hitDirectionZ: 1,
      hitStrength: 0,
      destructionAge: -1,
      destructionDuration: 0,
      destructionDirection: stableHash(`${entity.id}:destruction`) % 2 === 0 ? 1 : -1,
      selected: false,
      lodTier: 'lod0',
      lodGeometryTier: 'lod0',
      lodPhase: stableHash(`${entity.id}:lod`) % 4,
      lodAnimationDelta: 0,
      lodAnimatedThisFrame: false,
      lodDetailNodes,
      lodShadowCasters,
    };
  }

  private capturePresentationPart(node: THREE.Object3D): PresentationPart {
    return {
      node,
      position: node.position.clone(),
      rotation: node.rotation.clone(),
      scale: node.scale.clone(),
    };
  }

  private transitionRigAnimation(visual: EntityVisual, name: string): void {
    if (!visual.animationMixer || visual.animationState === name) return;
    const next = visual.animationActions.get(name);
    if (!next) return;
    const current = visual.animationActions.get(visual.animationState);
    current?.fadeOut(0.08);
    next.reset().fadeIn(0.08).play();
    visual.animationState = name;
  }

  private createHealthBar(parent: THREE.Group, height: number, width: number, team: Team): HealthBarVisual {
    const group = new THREE.Group();
    group.name = `health-bar-${team}`;
    group.position.set(0, height + HEALTH_BAR_PRESENTATION.heightOffset, 0);
    group.scale.set(width, HEALTH_BAR_PRESENTATION.worldThickness, 1);
    group.renderOrder = 20;
    group.userData.healthBar = true;
    group.userData.team = team;
    group.userData.presentationOnly = true;
    parent.add(group);

    const frame = this.addMesh(
      group,
      this.planeGeometry(1.14, 1.72),
      this.palette.healthFrame[team],
      0,
      0,
      0,
      false,
    );
    frame.name = 'health-bar-faction-frame';
    frame.renderOrder = 20;
    const back = this.addMesh(group, this.planeGeometry(1.06, 1.34), this.palette.healthBack, 0, 0, 0.004, false);
    back.name = 'health-bar-track';
    back.renderOrder = 21;
    const fill = this.addMesh(group, this.planeGeometry(1, 1), this.palette.healthGood, 0, 0, 0.008, false);
    fill.name = 'health-bar-fill';
    fill.renderOrder = 22;
    const batched = this.fixture.startsWith('breakthrough-demo');
    if (batched) {
      frame.visible = false;
      back.visible = false;
      fill.visible = false;
      frame.userData.batchedHealthBarSource = true;
      back.userData.batchedHealthBarSource = true;
      fill.userData.batchedHealthBarSource = true;
    }
    group.visible = false;
    return { group, frame, back, fill, batched };
  }

  private updateHealthBar(visual: EntityVisual, hp: number, maxHp: number, selected: boolean): void {
    if (!visual.healthBar) return;
    const ratio = THREE.MathUtils.clamp(hp / Math.max(1, maxHp), 0, 1);
    visual.healthBar.group.visible = shouldShowHealthBar(selected, hp, maxHp);
    visual.healthBar.fill.scale.x = Math.max(0.001, ratio);
    visual.healthBar.fill.position.x = (ratio - 1) / 2;
    const band = healthVisualBand(hp, maxHp);
    visual.healthBar.fill.userData.healthBand = band;
    visual.healthBar.fill.material = band === 'healthy'
      ? this.palette.healthGood
      : band === 'warning'
        ? this.palette.healthWarning
        : this.palette.healthDanger;
  }

  private createDamageVisual(
    parent: THREE.Group,
    height: number,
    entityId: string,
    building: boolean,
  ): DamageVisual {
    const group = new THREE.Group();
    const seed = stableHash(`${entityId}:damage-vfx`);
    const offsetX = ((seed & 15) - 7) * (building ? 0.12 : 0.08);
    const offsetZ = (((seed >>> 4) & 15) - 7) * (building ? 0.12 : 0.08);
    group.position.set(offsetX, height * (building ? 0.82 : 0.72), offsetZ);
    group.visible = false;
    group.userData.damageStage = 'none';
    group.userData.buildingDamage = building;
    const scarA = this.addBox(
      group,
      building ? 1.5 : 0.72,
      building ? 0.08 : 0.055,
      building ? 0.62 : 0.34,
      -0.18,
      building ? -height * 0.17 : -height * 0.24,
      0.08,
      this.palette.graphiteDark,
      false,
    );
    scarA.name = 'damage_scar_a';
    scarA.rotation.y = ((seed >>> 9) % 32) / 100 - 0.16;
    scarA.rotation.z = 0.18;
    const scarB = this.addBox(
      group,
      building ? 1.15 : 0.56,
      building ? 0.07 : 0.05,
      building ? 0.48 : 0.28,
      0.34,
      building ? -height * 0.08 : -height * 0.16,
      -0.12,
      this.palette.bronze,
      false,
    );
    scarB.name = 'damage_scar_b';
    scarB.rotation.y = -0.34;
    scarB.rotation.z = -0.24;
    const puffA = this.addMesh(group, this.sphereGeometry(0.52, 8, 5), this.palette.smoke, -0.34, 0.12, 0.08, false);
    puffA.name = 'damage_smoke_a';
    const puffB = this.addMesh(group, this.sphereGeometry(0.44, 8, 5), this.palette.smoke, 0.28, 0.58, -0.12, false);
    puffB.name = 'damage_smoke_b';
    const ember = this.addMesh(group, this.sphereGeometry(0.22, 8, 5), this.palette.fire, 0, -0.08, 0, false);
    ember.name = 'damage_ember';
    const criticalMarker = this.addMesh(
      group,
      this.ringGeometry(building ? 0.62 : 0.24, building ? 0.98 : 0.42, 18),
      this.palette.warningRing,
      0,
      building ? -height * 0.04 : -height * 0.05,
      0,
      false,
    );
    criticalMarker.name = 'damage_critical_marker';
    criticalMarker.rotation.x = -Math.PI / 2;
    criticalMarker.renderOrder = 9;
    parent.add(group);
    return {
      root: group,
      smokeA: puffA,
      smokeB: puffB,
      ember,
      scarA,
      scarB,
      criticalMarker,
      building,
      stage: 'none',
      ratio: 1,
    };
  }

  private createConstructionPresentationBatches(): ConstructionPresentationBatches {
    const geometry = this.boxGeometry(1, 1, 1);
    const shellMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.58,
      metalness: 0.12,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    });
    const scanMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      toneMapped: false,
    });
    this.ownedMaterials.add(shellMaterial);
    this.ownedMaterials.add(scanMaterial);

    const createBatch = (
      name: string,
      material: THREE.Material,
      capacity: number,
      renderOrder = 0,
    ): THREE.InstancedMesh => {
      const batch = new THREE.InstancedMesh(geometry, material, capacity);
      batch.name = name;
      batch.count = 0;
      batch.visible = false;
      batch.frustumCulled = false;
      batch.castShadow = false;
      batch.receiveShadow = false;
      batch.renderOrder = renderOrder;
      batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      batch.userData.constructionPresentationBatch = true;
      this.worldRoot.add(batch);
      return batch;
    };

    return {
      foundation: createBatch(
        'construction-foundation-batch',
        this.palette.concrete,
        CONSTRUCTION_PRESENTATION_POLICY.siteCapacity,
      ),
      frame: createBatch(
        'construction-frame-batch',
        this.palette.steel,
        CONSTRUCTION_PRESENTATION_POLICY.siteCapacity * CONSTRUCTION_PRESENTATION_POLICY.frameInstancesPerSite,
      ),
      shell: createBatch('construction-shell-batch', shellMaterial, CONSTRUCTION_PRESENTATION_POLICY.siteCapacity, 7),
      scan: createBatch('construction-scan-batch', scanMaterial, CONSTRUCTION_PRESENTATION_POLICY.siteCapacity, 8),
    };
  }

  private createConstructionVisual(footprint: Vec2, height: number, team: CombatTeam): ConstructionVisual {
    return {
      footprint: { x: footprint.x, z: footprint.z },
      height,
      team,
      progress: 1,
      stage: 'complete',
    };
  }

  private updateDamageVisual(visual: EntityVisual, hp: number, maxHp: number, buildProgress: number): void {
    const damage = visual.damageVisual;
    if (!damage) return;
    const ratio = THREE.MathUtils.clamp(hp / Math.max(1, maxHp), 0, 1);
    const stage = damage.building
      ? buildingDamageVisualStage(hp, maxHp, buildProgress)
      : buildProgress >= 0.98 && ratio <= 0.28
        ? 'critical'
        : buildProgress >= 0.98 && ratio <= 0.55
          ? 'damaged'
          : 'none';
    damage.stage = stage;
    damage.ratio = ratio;
    damage.root.visible = stage !== 'none';
    damage.root.userData.damageStage = stage;
    damage.scarA.visible = stage !== 'none';
    damage.scarB.visible = stage === 'critical';
    damage.smokeA.visible = stage !== 'none';
    damage.smokeB.visible = stage === 'critical';
    damage.ember.visible = stage === 'critical';
    damage.criticalMarker.visible = stage === 'critical';
    const authoredVisibility = authoredBuildingDamageVisibility(stage);
    for (const role of ['damaged', 'critical'] as const) {
      const authoredRoot = visual.authoredBuildingDamageRoots[role];
      if (authoredRoot) authoredRoot.visible = authoredVisibility[role];
    }
  }

  private updateConstructionVisual(visual: EntityVisual, buildProgress: number): void {
    if (!visual.constructionVisual) return;
    const progress = THREE.MathUtils.clamp(buildProgress, 0, 1);
    const construction = visual.constructionVisual;
    const presentation = constructionStagePresentation(progress);
    construction.progress = progress;
    construction.stage = presentation.stage;
    visual.body.visible = presentation.bodyVisible;
    visual.body.scale.set(1, presentation.bodyScaleY, 1);
  }

  private updateConstructionPresentationBatches(time: number): void {
    const { foundation, frame, shell, scan } = this.constructionBatches;
    let foundationCount = 0;
    let frameCount = 0;
    let shellCount = 0;
    let scanCount = 0;
    const transform = this.instancedPresentationTransform;
    const teamColor = this.factionMarkerColor;

    const setBox = (
      batch: THREE.InstancedMesh,
      index: number,
      visual: EntityVisual,
      localX: number,
      y: number,
      localZ: number,
      sizeX: number,
      sizeY: number,
      sizeZ: number,
      extraYaw = 0,
      color?: number,
    ): void => {
      const yaw = visual.body.rotation.y;
      const cosine = Math.cos(yaw);
      const sine = Math.sin(yaw);
      transform.position.set(
        visual.root.position.x + localX * cosine + localZ * sine,
        y,
        visual.root.position.z - localX * sine + localZ * cosine,
      );
      transform.rotation.set(0, yaw + extraYaw, 0);
      transform.scale.set(sizeX, sizeY, sizeZ);
      transform.updateMatrix();
      batch.setMatrixAt(index, transform.matrix);
      if (color !== undefined) {
        teamColor.setHex(color);
        batch.setColorAt(index, teamColor);
      }
    };

    const constructing = [...this.entityVisuals.entries()]
      .filter(([, visual]) => visual.constructionVisual !== null && shouldBatchConstructionPresentation(
        visual.constructionVisual.stage,
        visual.root.visible,
        visual.destructionAge,
      ))
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(0, CONSTRUCTION_PRESENTATION_POLICY.siteCapacity);

    for (const [, visual] of constructing) {
      const construction = visual.constructionVisual;
      if (!construction) continue;
      const presentation = constructionStagePresentation(construction.progress);
      const { footprint, height, progress } = construction;
      const faction = factionVisual(construction.team);

      if (presentation.foundationVisible) {
        setBox(
          foundation,
          foundationCount,
          visual,
          0,
          0.07,
          0,
          footprint.x * 0.94,
          0.14,
          footprint.z * 0.94,
        );
        foundationCount += 1;
      }

      if (presentation.frameVisible) {
        const frameSpan = CONSTRUCTION_PRESENTATION_POLICY.frameEnd - CONSTRUCTION_PRESENTATION_POLICY.foundationEnd;
        const frameProgress = THREE.MathUtils.clamp(
          (progress - CONSTRUCTION_PRESENTATION_POLICY.foundationEnd) / frameSpan,
          0,
          1,
        );
        const frameHeight = Math.max(0.6, height * (0.38 + frameProgress * 0.56));
        const x = footprint.x * 0.43;
        const z = footprint.z * 0.43;
        for (const localX of [-x, x]) {
          for (const localZ of [-z, z]) {
            setBox(frame, frameCount, visual, localX, frameHeight * 0.5, localZ, 0.14, frameHeight, 0.14);
            frameCount += 1;
          }
        }
        for (const railY of [frameHeight * 0.54, frameHeight]) {
          for (const localZ of [-z, z]) {
            setBox(frame, frameCount, visual, 0, railY, localZ, footprint.x * 0.9, 0.13, 0.13);
            frameCount += 1;
          }
          for (const localX of [-x, x]) {
            setBox(frame, frameCount, visual, localX, railY, 0, 0.13, 0.13, footprint.z * 0.9);
            frameCount += 1;
          }
        }
      }

      if (presentation.shellVisible) {
        setBox(
          shell,
          shellCount,
          visual,
          0,
          height * 0.5,
          0,
          footprint.x * 0.88,
          height,
          footprint.z * 0.88,
          0,
          faction.primary,
        );
        shellCount += 1;
      }

      if (visual.constructionActive) {
        const scanPulse = constructionScanPulse(true, this.reducedMotion, time, visual.motionPhase);
        setBox(
          scan,
          scanCount,
          visual,
          0,
          Math.max(0.18, height * progress),
          0,
          footprint.x * 0.82 * scanPulse,
          0.035,
          0.14,
          this.reducedMotion ? 0 : time * 0.8,
          faction.bright,
        );
        scanCount += 1;
      }
    }

    const finalizeBatch = (batch: THREE.InstancedMesh, count: number): void => {
      batch.count = count;
      batch.visible = count > 0;
      if (count > 0) {
        batch.instanceMatrix.needsUpdate = true;
        if (batch.instanceColor) batch.instanceColor.needsUpdate = true;
      }
    };
    finalizeBatch(foundation, foundationCount);
    finalizeBatch(frame, frameCount);
    finalizeBatch(shell, shellCount);
    finalizeBatch(scan, scanCount);
    this.constructionFoundationCount = foundationCount;
    this.constructionFrameCount = frameCount;
    this.constructionShellCount = shellCount;
    this.constructionScanCount = scanCount;
  }

  private entityModelKey(entity: WorldEntity): string {
    if (entity.entityType === 'resource') return this.authoredResourceTemplate ? 'resource:authored-v1' : 'resource';
    if (
      entity.entityType === 'unit'
      && entity.team === 'player'
      && this.authoredPlayerUnitTemplate(entity.kind)
    ) return `unit:player:${entity.kind}:authored-v1`;
    if (
      entity.entityType === 'unit'
      && entity.team === 'enemy'
      && this.authoredEnemyUnitTemplate(entity.kind)
    ) return `unit:enemy:${entity.kind}:authored-v1`;
    if (
      entity.entityType === 'building'
      && entity.team === 'player'
      && this.authoredPlayerBuildingTemplate(entity.kind)
    ) return `building:player:${entity.kind}:authored-v1`;
    if (
      entity.entityType === 'building'
      && entity.team === 'enemy'
      && this.authoredEnemyBuildingTemplate(entity.kind)
    ) return `building:enemy:${entity.kind}:authored-v1`;
    return `${entity.entityType}:${entity.team}:${entity.kind}`;
  }

  private getUnitTemplate(kind: UnitKind, team: CombatTeam): THREE.Group {
    const key = `${team}:${kind}`;
    const cached = this.unitTemplates.get(key);
    if (cached) return cached;
    const authoredTemplate = team === 'player'
      ? this.authoredPlayerUnitTemplate(kind)
      : this.authoredEnemyUnitTemplate(kind);
    const template = authoredTemplate
      ? authoredTemplate.userData.riggedAnimation === true
        ? cloneSkeleton(authoredTemplate) as THREE.Group
        : authoredTemplate.clone(true)
      : this.buildUnitTemplate(kind, team);
    this.unitTemplates.set(key, template);
    return template;
  }

  private syncAuthoredAssetRequirements(state: GameState): void {
    if (!this.initialAssetRequirementsQueued) {
      this.initialAssetRequirementsQueued = true;
      for (const phase of authoredAssetPhasePlan(this.fixture, state)) this.queueAssetPhase(phase);
      return;
    }
    if (authoredAssetAllowlist(this.fixture)) return;
    this.queueEnsureAssets([
      ...collectEntityAuthoredAssetLabels(state),
      ...collectLevelAuthoredAssetLabels(state),
    ]);
  }

  private queueEnsureAssets(labels: Iterable<string>): void {
    const reviewAllowlist = authoredAssetAllowlist(this.fixture);
    const requested = reviewAllowlist
      ? [...labels].filter((label) => reviewAllowlist.has(label))
      : [...labels];
    this.queueAssetPhase({
      name: 'ensure',
      labels: requested,
      concurrency: 2,
      deferred: false,
    });
  }

  private queueAssetPhase(phase: AuthoredAssetPhasePlan): Promise<void> {
    const labels = this.assetLoadLedger.queue(phase.labels);
    if (labels.length === 0) return this.assetPhaseTail;
    this.assetLoadRequested += labels.length;
    this.assetPhaseHistory.push(phase.name);
    this.updateAssetLoadMetrics();

    const runPhase = async (): Promise<void> => {
      try {
        await this.assetLoaderReady;
        if (this.disposed) return;
        if (phase.deferred) {
          this.assetPhaseCurrent = `${phase.name}:waiting`;
          this.updateAssetLoadMetrics();
          await new Promise<void>((resolve) => this.hostWindow.setTimeout(resolve, 80));
          if (this.disposed) return;
        }
        this.assetPhaseCurrent = phase.name;
        this.updateAssetLoadMetrics();
        await runBoundedAssetTasks(
          labels.map((label) => async () => {
            const task = this.authoredAssetTasks.get(label);
            if (task) {
              await task.run();
              return;
            }
            if (this.assetLoadLedger.start(label) && this.assetLoadLedger.fail(label)) {
              this.assetLoadFailed += 1;
              this.updateAssetLoadMetrics();
            }
          }),
          phase.concurrency,
        );
      } catch (error) {
        if (!this.disposed) console.warn(`Authored asset phase ${phase.name} failed; continuing with fallbacks.`, error);
      } finally {
        if (this.disposed) return;
        for (const label of labels) {
          const failedInflight = this.assetLoadLedger.fail(label);
          const failedQueued = !failedInflight
            && this.assetLoadLedger.start(label)
            && this.assetLoadLedger.fail(label);
          if (failedInflight || failedQueued) this.assetLoadFailed += 1;
        }
        this.assetPhaseCompleted += 1;
        this.assetPhaseCurrent = 'idle';
        this.updateAssetLoadMetrics();
      }
    };

    this.assetPhaseTail = this.assetPhaseTail.catch(() => undefined).then(runPhase);
    return this.assetPhaseTail;
  }

  private async loadAuthoredPlayerAssets(): Promise<void> {
    let GLTFLoader: typeof import('three/examples/jsm/loaders/GLTFLoader.js').GLTFLoader;
    let KTX2Loader: typeof import('three/examples/jsm/loaders/KTX2Loader.js').KTX2Loader;
    try {
      ({ GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js'));
      ({ KTX2Loader } = await import('three/examples/jsm/loaders/KTX2Loader.js'));
    } catch (error) {
      if (!this.disposed) console.warn('GLTF/KTX2 loader failed to initialize; using procedural asset fallbacks.', error);
      return;
    }
    if (this.disposed) return;
    const publicAssetUrl = (path: string): string =>
      resolvePublicAssetUrl(import.meta.env.BASE_URL, path);
    const loader = new GLTFLoader();
    this.ktx2Loader = new KTX2Loader()
      .setTranscoderPath(publicAssetUrl('/assets/basis/'))
      .detectSupport(this.renderer);
    loader.setKTX2Loader(this.ktx2Loader);
    const load = (
      url: string,
      label: string,
      onReady: (template: THREE.Group, animations: THREE.AnimationClip[]) => void,
    ): void => {
      this.authoredAssetTasks.set(label, {
        label,
        run: () => new Promise<void>((resolve) => {
          const handleFailure = (error: unknown): void => {
            if (this.assetLoadLedger.retry(label, 2)) {
              this.assetLoadRetries += 1;
              this.updateAssetLoadMetrics();
              attempt();
              return;
            }
            if (this.assetLoadLedger.fail(label)) {
              this.assetLoadFailed += 1;
              this.updateAssetLoadMetrics();
              console.warn(`${label} authored model failed to load; using procedural fallback.`, error);
            }
            resolve();
          };
          const attempt = (): void => {
            if (!this.assetLoadLedger.start(label)) {
              resolve();
              return;
            }
            try {
              loader.load(publicAssetUrl(url), (gltf) => {
                let commitStarted = false;
                try {
                  if (this.disposed) {
                    this.disposeImportedScene(gltf.scene);
                    resolve();
                    return;
                  }
                  const template = gltf.scene;
                  template.name = `${label}-template`;
                  template.userData.riggedAnimation = gltf.animations.length > 0;
                  // Register the raw graph before normalization so a rare
                  // commit-time exception remains owned and can be released
                  // exactly once by BattlefieldScene.dispose().
                  template.traverse((object) => {
                    if (!(object instanceof THREE.Mesh)) return;
                    this.ownedGeometries.add(object.geometry);
                    const materials = Array.isArray(object.material) ? object.material : [object.material];
                    for (const material of materials) {
                      this.ownedMaterials.add(material);
                      for (const value of Object.values(material)) {
                        if (value instanceof THREE.Texture) this.ownedTextures.add(value);
                      }
                    }
                  });
                  commitStarted = true;
                  this.normalizeImportedMaterials(template, label);
                  template.traverse((object) => {
                    if (object.name === 'turret_yaw') object.userData.turretPivot = true;
                    if (object.name === 'radar_yaw') object.userData.spinSpeed = 0.22;
                    if (object.name === 'crane_yaw') {
                      object.userData.spinSpeed = 0.42;
                      object.userData.activityOnly = true;
                    }
                    if (object.name === 'collector_head') {
                      object.userData.spinSpeed = 3.2;
                      object.userData.spinAxis = 'x';
                      object.userData.activityOnly = true;
                    }
                    if (object.name === 'reactor_ring') object.userData.spinSpeed = 0.32;
                    if (object.name.startsWith('powered_')) object.userData.poweredOnly = true;
                    if (/^(drum_band_|crate_strap_|panel_meter_|marker_signal_)/.test(object.name)) {
                      object.userData.decorativeDetail = true;
                    }
                    if (!(object instanceof THREE.Mesh)) return;
                    object.castShadow = true;
                    object.receiveShadow = true;
                    this.ownedGeometries.add(object.geometry);
                    const materials = Array.isArray(object.material) ? object.material : [object.material];
                    for (const material of materials) {
                      this.ownedMaterials.add(material);
                      for (const value of Object.values(material)) {
                        if (value instanceof THREE.Texture) this.ownedTextures.add(value);
                      }
                    }
                  });
                  this.updateTextureQuality();
                  onReady(template, gltf.animations);
                  this.authoredAssetRevisions.set(label, (this.authoredAssetRevisions.get(label) ?? 0) + 1);
                  this.refreshBuildGhostForAsset(label);
                  if (!this.assetLoadLedger.succeed(label)) {
                    this.disposeImportedScene(template);
                    resolve();
                    return;
                  }
                  this.assetLoadCompleted += 1;
                  if (this.firstAuthoredAssetTime < 0) {
                    this.firstAuthoredAssetTime = this.hostWindow.performance.now() - this.assetLoadStartTime;
                  }
                  this.updateAssetLoadMetrics();
                  resolve();
                } catch (error) {
                  if (commitStarted) {
                    // Once normalization or publication begins, the scene may
                    // already own resources or reference this template. Never
                    // dispose and retry that partially committed graph: keep
                    // any published nodes valid and fall back for anything
                    // that was not installed.
                    if (this.assetLoadLedger.fail(label)) this.assetLoadFailed += 1;
                    this.updateAssetLoadMetrics();
                    if (!this.disposed) {
                      console.warn(`${label} authored model commit failed; keeping safe fallbacks.`, error);
                    }
                    resolve();
                    return;
                  }
                  this.disposeImportedScene(gltf.scene);
                  handleFailure(error);
                }
              }, undefined, handleFailure);
            } catch (error) {
              handleFailure(error);
            }
          };
          attempt();
        }),
      });
    };
    load('/assets/models/ff_mbt_01_v1.glb', 'FF-MBT-01', (template) => {
      this.authoredPlayerTankTemplate = template;
      this.unitTemplates.delete('player:tank');
    });
    load('/assets/models/ff_hrv_01_v1.glb', 'FF-HRV-01', (template) => {
      this.authoredPlayerHarvesterTemplate = template;
      this.unitTemplates.delete('player:harvester');
    });
    load('/assets/models/ff_rif_01_v1.glb', 'FF-RIF-01', (template, animations) => {
      this.authoredPlayerRifleTemplate = template;
      this.authoredUnitAnimations.set('player:rifle', animations);
      this.unitTemplates.delete('player:rifle');
    });
    load('/assets/models/ff_eng_01_v1.glb', 'FF-ENG-01', (template, animations) => {
      this.authoredPlayerEngineerTemplate = template;
      this.authoredUnitAnimations.set('player:engineer', animations);
      this.unitTemplates.delete('player:engineer');
    });
    load('/assets/models/ff_at_01_v1.glb', 'FF-AT-01', (template, animations) => {
      this.authoredPlayerAntitankTemplate = template;
      this.authoredUnitAnimations.set('player:antitank', animations);
      this.unitTemplates.delete('player:antitank');
    });
    load('/assets/models/ff_sct_01_v1.glb', 'FF-SCT-01', (template) => {
      this.authoredPlayerScoutTemplate = template;
      this.unitTemplates.delete('player:scout');
    });
    load('/assets/models/ff_sup_01_v1.glb', 'FF-SUP-01', (template) => {
      this.authoredPlayerSuppressorTemplate = template;
      this.unitTemplates.delete('player:suppressor');
    });
    load('/assets/models/ff_art_01_v1.glb', 'FF-ART-01', (template) => {
      this.authoredPlayerArtilleryTemplate = template;
      this.unitTemplates.delete('player:artillery');
    });
    load('/assets/models/ff_en_mbt_01_v1.glb', 'FF-EN-MBT-01', (template) => {
      this.authoredEnemyTankTemplate = template;
      this.unitTemplates.delete('enemy:tank');
      if (this.fixture === 'enemy-review') this.installAuthoredDecoration(template, [-1.5, 0, -Math.PI / 2, 1], 0.02, true);
    });
    load('/assets/models/ff_en_rif_01_v1.glb', 'FF-EN-RIF-01', (template, animations) => {
      this.authoredEnemyRifleTemplate = template;
      this.authoredUnitAnimations.set('enemy:rifle', animations);
      this.unitTemplates.delete('enemy:rifle');
      if (this.fixture === 'enemy-review') this.installAuthoredDecoration(template, [4.5, 2.5, -Math.PI / 2, 1], 0.02, true);
    });
    load('/assets/models/ff_en_at_01_v1.glb', 'FF-EN-AT-01', (template, animations) => {
      this.authoredEnemyAntitankTemplate = template;
      this.authoredUnitAnimations.set('enemy:antitank', animations);
      this.unitTemplates.delete('enemy:antitank');
      if (this.fixture === 'enemy-review') this.installAuthoredDecoration(template, [2.5, 7, -Math.PI / 2, 1], 0.02, true);
    });
    load('/assets/models/ff_en_sct_01_v1.glb', 'FF-EN-SCT-01', (template) => {
      this.authoredEnemyScoutTemplate = template;
      this.unitTemplates.delete('enemy:scout');
      if (this.fixture === 'enemy-review') this.installAuthoredDecoration(template, [-6.5, 5.5, -Math.PI / 2, 1], 0.02, true);
    });
    load('/assets/models/ff_en_sup_01_v1.glb', 'FF-EN-SUP-01', (template) => {
      this.authoredEnemySuppressorTemplate = template;
      this.unitTemplates.delete('enemy:suppressor');
      if (this.fixture === 'enemy-review') this.installAuthoredDecoration(template, [-6.5, -4.5, -Math.PI / 2, 1], 0.02, true);
    });
    load('/assets/models/ff_en_art_01_v1.glb', 'FF-EN-ART-01', (template) => {
      this.authoredEnemyArtilleryTemplate = template;
      this.unitTemplates.delete('enemy:artillery');
      if (this.fixture === 'enemy-review') this.installAuthoredDecoration(template, [0.5, -7.5, -Math.PI / 2, 1], 0.02, true);
    });
    load('/assets/models/ff_en_hrv_01_v1.glb', 'FF-EN-HRV-01', (template) => {
      this.authoredEnemyHarvesterTemplate = template;
      this.unitTemplates.delete('enemy:harvester');
      if (this.fixture === 'enemy-review') this.installAuthoredDecoration(template, [7, -5, -Math.PI / 2, 1], 0.02, true);
    });
    load('/assets/models/ff_en_eng_01_v1.glb', 'FF-EN-ENG-01', (template, animations) => {
      this.authoredEnemyEngineerTemplate = template;
      this.authoredUnitAnimations.set('enemy:engineer', animations);
      this.unitTemplates.delete('enemy:engineer');
      if (this.fixture === 'enemy-review') this.installAuthoredDecoration(template, [7.2, 6.5, -Math.PI / 2, 1], 0.02, true);
    });
    load('/assets/models/ff_en_hq_01_v1.glb', 'FF-EN-HQ-01', (template) => {
      this.authoredEnemyHqTemplate = template;
      this.buildingTemplates.delete('enemy:hq');
      if (this.fixture === 'enemy-base-review') this.installAuthoredDecoration(template, [0, 0, 0, 0.72], 0.02, true);
    });
    load('/assets/models/ff_en_ref_01_v1.glb', 'FF-EN-REF-01', (template) => {
      this.authoredEnemyRefineryTemplate = template;
      this.buildingTemplates.delete('enemy:refinery');
      if (this.fixture === 'enemy-base-review') this.installAuthoredDecoration(template, [-10, 2, 0.25, 0.72], 0.02, true);
    });
    load('/assets/models/ff_en_fac_01_v1.glb', 'FF-EN-FAC-01', (template) => {
      this.authoredEnemyFactoryTemplate = template;
      this.buildingTemplates.delete('enemy:factory');
      if (this.fixture === 'enemy-base-review') this.installAuthoredDecoration(template, [10, 2, -0.25, 0.72], 0.02, true);
    });
    load('/assets/models/ff_en_rct_01_v1.glb', 'FF-EN-RCT-01', (template) => {
      this.authoredEnemyReactorTemplate = template;
      this.buildingTemplates.delete('enemy:reactor');
      if (this.fixture === 'enemy-base-review') this.installAuthoredDecoration(template, [-9, 9, 0, 0.72], 0.02, true);
    });
    load('/assets/models/ff_en_bar_01_v1.glb', 'FF-EN-BAR-01', (template) => {
      this.authoredEnemyBarracksTemplate = template;
      this.buildingTemplates.delete('enemy:barracks');
      if (this.fixture === 'enemy-base-review') this.installAuthoredDecoration(template, [9, 9, 0, 0.72], 0.02, true);
    });
    load('/assets/models/ff_en_rel_01_v1.glb', 'FF-EN-REL-01', (template) => {
      this.authoredEnemyRelayTemplate = template;
      this.buildingTemplates.delete('enemy:relay');
      if (this.fixture === 'enemy-base-review') this.installAuthoredDecoration(template, [0, 10, 0, 0.76], 0.02, true);
    });
    load('/assets/models/ff_en_sen_01_v1.glb', 'FF-EN-SEN-01', (template) => {
      this.authoredEnemySentryTemplate = template;
      this.buildingTemplates.delete('enemy:sentry');
      if (this.fixture === 'enemy-base-review') this.installAuthoredDecoration(template, [-6, -7, 0, 0.76], 0.02, true);
    });
    load('/assets/models/ff_en_can_01_v1.glb', 'FF-EN-CAN-01', (template) => {
      this.authoredEnemyCannonTemplate = template;
      this.buildingTemplates.delete('enemy:cannon');
      if (this.fixture === 'enemy-base-review') this.installAuthoredDecoration(template, [6, -7, 0, 0.76], 0.02, true);
    });
    load('/assets/models/ff_hq_01_v1.glb', 'FF-HQ-01', (template) => {
      this.authoredPlayerHqTemplate = template;
      this.buildingTemplates.delete('player:hq');
    });
    load('/assets/models/ff_ref_01_v1.glb', 'FF-REF-01', (template) => {
      this.authoredPlayerRefineryTemplate = template;
      this.buildingTemplates.delete('player:refinery');
    });
    load('/assets/models/ff_fac_01_v1.glb', 'FF-FAC-01', (template) => {
      this.authoredPlayerFactoryTemplate = template;
      this.buildingTemplates.delete('player:factory');
    });
    load('/assets/models/ff_rct_01_v1.glb', 'FF-RCT-01', (template) => {
      this.authoredPlayerReactorTemplate = template;
      this.buildingTemplates.delete('player:reactor');
    });
    load('/assets/models/ff_bar_01_v1.glb', 'FF-BAR-01', (template) => {
      this.authoredPlayerBarracksTemplate = template;
      this.buildingTemplates.delete('player:barracks');
    });
    load('/assets/models/ff_rel_01_v1.glb', 'FF-REL-01', (template) => {
      this.authoredPlayerRelayTemplate = template;
      this.buildingTemplates.delete('player:relay');
    });
    load('/assets/models/ff_sen_01_v1.glb', 'FF-SEN-01', (template) => {
      this.authoredPlayerSentryTemplate = template;
      this.buildingTemplates.delete('player:sentry');
    });
    load('/assets/models/ff_can_01_v1.glb', 'FF-CAN-01', (template) => {
      this.authoredPlayerCannonTemplate = template;
      this.buildingTemplates.delete('player:cannon');
    });
    load('/assets/models/ff_rok_01_v1.glb', 'FF-ROK-01', (template) => {
      this.rockTemplate = template;
      for (const visual of this.blockerVisuals.values()) this.blockerRoot.remove(visual);
      this.blockerVisuals.clear();
    });
    load('/assets/models/ff_wrk_01_v1.glb', 'FF-WRK-01', (template) => {
      this.installAuthoredWrecks(template);
    });
    load('/assets/models/ff_ore_01_v1.glb', 'FF-ORE-01', (template) => {
      this.authoredResourceTemplate = template;
      this.unitTemplates.delete('neutral:resource');
    });
    load('/assets/models/ff_crt_01_v1.glb', 'FF-CRT-01', (template) => {
      this.installAuthoredCraters(template);
    });
    load('/assets/models/ff_rdm_01_v1.glb', 'FF-RDM-01', (template) => {
      this.installAuthoredRoadMarkers(template);
    });
    load('/assets/models/ff_sbg_01_v1.glb', 'FF-SBG-01', (template) => {
      this.installAuthoredSmallProps(template, [
        [-69, 56, 0.15, 0.78], [-29, 58, 2.95, 0.75],
        [69, -56, Math.PI + 0.15, 0.78], [29, -58, -0.2, 0.75],
        [-18, -18, 1.1, 0.62], [18, 18, -2.04, 0.62],
      ]);
      if (this.fixture.startsWith('breakthrough-demo')) {
        this.installAuthoredSmallProps(template, [
          [5, -20, 0.3, 0.7], [16, -18, Math.PI + 0.25, 0.66], [28, -27, 0.8, 0.62],
        ]);
      }
    });
    load('/assets/models/ff_cch_01_v1.glb', 'FF-CCH-01', (template) => {
      this.installAuthoredSmallProps(template, [
        [-63, 34, -0.4, 0.8], [-37, 37, 0.8, 0.72],
        [63, -34, Math.PI - 0.4, 0.8], [37, -37, Math.PI + 0.8, 0.72],
        [-23, 12, -0.55, 0.58], [23, -12, Math.PI - 0.55, 0.58],
      ]);
      if (this.fixture.startsWith('breakthrough-demo')) {
        this.installAuthoredSmallProps(template, [
          [3, -25, -0.4, 0.66], [19, -29, 0.9, 0.62], [31, -19, -1.1, 0.58],
        ]);
      }
    });
    load('/assets/models/ff_aux_01_v1.glb', 'FF-AUX-01', (template) => {
      this.installAuthoredSmallProps(template, [
        [-71, 37, -0.1, 0.72], [-34, 56, 2.65, 0.66],
        [71, -37, Math.PI - 0.1, 0.72], [34, -56, -0.5, 0.66],
      ]);
    });
    load('/assets/models/ff_scr_01_v1.glb', 'FF-SCR-01', (template) => {
      this.installAuthoredVegetation(template, [
        [-74, 12, 0.4, 0.8], [-67, -15, -0.6, 0.72], [-43, -69, 1.2, 0.76],
        [-11, 71, -1.1, 0.68], [20, 67, 0.2, 0.75], [69, 51, 1.7, 0.82],
        [75, 9, -0.2, 0.7], [64, -62, 2.4, 0.78], [31, -73, -1.8, 0.72],
        [-18, -72, 0.8, 0.7], [-69, 70, 2.1, 0.76], [-28, 66, -2.5, 0.66],
      ]);
    });
    load('/assets/models/ff_stm_01_v1.glb', 'FF-STM-01', (template) => {
      this.installAuthoredVegetation(template, [
        [-76, -8, 0.3, 0.75], [-61, -69, -0.8, 0.7], [-6, 73, 1.5, 0.68],
        [74, 42, -1.2, 0.76], [58, -71, 2.2, 0.72], [9, -74, -2.4, 0.66],
      ]);
    });
  }

  private updateAssetLoadMetrics(): void {
    const canvas = this.renderer.domElement;
    const snapshot = this.assetLoadLedger.snapshot();
    canvas.dataset.assetLoadRequested = String(this.assetLoadRequested);
    canvas.dataset.assetLoadCompleted = String(this.assetLoadCompleted);
    canvas.dataset.assetLoadLoaded = String(snapshot.loaded);
    canvas.dataset.assetLoadInflight = String(snapshot.inflight);
    canvas.dataset.assetLoadQueued = String(snapshot.queued);
    canvas.dataset.assetLoadFailed = String(this.assetLoadFailed);
    canvas.dataset.assetLoadRetries = String(this.assetLoadRetries);
    canvas.dataset.assetLoadPhase = this.assetPhaseCurrent;
    canvas.dataset.assetLoadPhaseCount = String(this.assetPhaseHistory.length);
    canvas.dataset.assetLoadPhaseCompleted = String(this.assetPhaseCompleted);
    canvas.dataset.assetLoadPhases = this.assetPhaseHistory.join(',');
    canvas.dataset.materialOwnerCount = String(this.importedMaterialOwners.size);
    canvas.dataset.materialInstanceCount = String(this.importedMaterialLibrary.size);
    canvas.dataset.materialConflictCount = String(this.materialConflictCount);
    canvas.dataset.materialCrossOwnerReuse = String(this.materialCrossOwnerReuse);
    canvas.dataset.assetLoadFirstMs = this.firstAuthoredAssetTime < 0
      ? ''
      : String(Math.round(this.firstAuthoredAssetTime));
    canvas.dataset.assetLoadStatus = snapshot.queued === 0
      && snapshot.inflight === 0
      && this.assetPhaseCompleted >= this.assetPhaseHistory.length
      ? 'ready'
      : 'loading';
  }

  private normalizeImportedMaterials(root: THREE.Object3D, label: string): void {
    const owner: ImportedMaterialOwner = { assetLabel: label };
    const ownerKey = importedMaterialOwnerKey(owner);
    this.importedMaterialOwners.add(ownerKey);
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
      const sharedMaterials = sourceMaterials.map((sourceMaterial) => {
        const existingOwner = this.importedMaterialOwnerByInstance.get(sourceMaterial);
        const material = existingOwner && existingOwner !== ownerKey
          ? sourceMaterial.clone()
          : sourceMaterial;
        this.tuneImportedMaterial(material);
        const descriptor = importedMaterialRuntimeDescriptor(material);
        const signature = importedMaterialDescriptorSignature(descriptor);
        const libraryKey = JSON.stringify([ownerKey, signature]);
        const ownerNameKey = JSON.stringify([ownerKey, descriptor.name]);
        let nameSignatures = this.importedMaterialNameSignatures.get(ownerNameKey);
        if (!nameSignatures) {
          nameSignatures = new Set<string>();
          this.importedMaterialNameSignatures.set(ownerNameKey, nameSignatures);
        }
        if (nameSignatures.size > 0 && !nameSignatures.has(signature)) this.materialConflictCount += 1;
        nameSignatures.add(signature);

        const shared = this.importedMaterialLibrary.get(libraryKey);
        if (!shared) {
          this.importedMaterialLibrary.set(libraryKey, material);
          this.importedMaterialOwnerByInstance.set(material, ownerKey);
          return material;
        }
        if (shared === material) return material;
        const sharedOwner = this.importedMaterialOwnerByInstance.get(shared);
        if (sharedOwner !== ownerKey) {
          // The owner is encoded into libraryKey, so this is a defensive path.
          // Never assign the foreign material: the actual reuse metric remains 0.
          const isolatedKey = JSON.stringify([ownerKey, signature, material.uuid]);
          this.importedMaterialLibrary.set(isolatedKey, material);
          this.importedMaterialOwnerByInstance.set(material, ownerKey);
          return material;
        }
        // Compatible materials may be reused only within this GLB owner. Keep
        // the replaced object owned so its GPU program can still be disposed.
        this.ownedMaterials.add(material);
        return shared;
      });
      object.material = Array.isArray(object.material) ? sharedMaterials : sharedMaterials[0] ?? object.material;
    });
    this.updateAssetLoadMetrics();
  }

  private tuneImportedMaterial(material: THREE.Material): void {
    if (!(material instanceof THREE.MeshStandardMaterial)) return;
    const finish: Record<string, { color?: number; roughness: number; metalness: number }> = {
      M_ArmorPanel: { color: 0x667069, roughness: 0.56, metalness: 0.08 },
      M_Gunmetal: { color: 0x343d3d, roughness: 0.4, metalness: 0.42 },
      M_Recess: { color: 0x111817, roughness: 0.76, metalness: 0.14 },
      M_TrackRubber: { color: 0x111514, roughness: 0.94, metalness: 0 },
      M_Steel: { color: 0xa0a8a3, roughness: 0.3, metalness: 0.78 },
      M_AmberArmor: { color: 0xb06b1d, roughness: 0.48, metalness: 0.12 },
      M_UnitMarking: { color: 0xd5d7c4, roughness: 0.68, metalness: 0.04 },
      M_EnemyCrimsonArmor: { color: 0x8d2119, roughness: 0.46, metalness: 0.2 },
      M_EnemyObsidianArmor: { color: 0x171d1d, roughness: 0.58, metalness: 0.3 },
      M_EnemyGunmetal: { color: 0x59605e, roughness: 0.32, metalness: 0.76 },
      M_EnemyRecess: { color: 0x0b0e0e, roughness: 0.82, metalness: 0.08 },
      M_EnemyTrack: { color: 0x0d1010, roughness: 0.96, metalness: 0 },
      M_EnemyMarking: { color: 0xb8aa87, roughness: 0.66, metalness: 0.04 },
      M_FieldConcrete: { color: 0x74776e, roughness: 0.94, metalness: 0.02 },
      M_FieldSandbag: { color: 0x8b7950, roughness: 0.98, metalness: 0 },
      M_BurntMetal: { color: 0x171c1b, roughness: 0.92, metalness: 0.18 },
      M_Rust: { color: 0x74321c, roughness: 0.9, metalness: 0.12 },
    };
    const tunedFinish = finish[material.name];
    if (tunedFinish) {
      // Authored base-color textures already contain the intended palette.
      // Applying the fallback swatch as a color factor would multiply the map
      // and make otherwise correct KTX2 assets appear almost black at runtime.
      applyImportedFallbackColor(material, tunedFinish.color);
      material.roughness = tunedFinish.roughness;
      material.metalness = tunedFinish.metalness;
    }
    const emissiveStrength: Record<string, number> = {
      M_CyanSignal: 1.55,
      M_CyanGlass: 0.48,
      M_Huijing: 1.35,
      M_EnemySignal: 1.85,
      M_EnemyHuijing: 1.45,
    };
    const target = emissiveStrength[material.name];
    if (target !== undefined) material.emissiveIntensity = target;
    if (material.name === 'M_Huijing') {
      material.color.setHex(0x0a5f86);
      material.emissive.setHex(0x0879a7);
    } else if (material.name === 'M_CyanSignal' || material.name === 'M_CyanGlass') {
      material.color.setHex(0x086879);
      material.emissive.setHex(0x00a9c1);
    } else if (material.name === 'M_EnemyHuijing') {
      material.color.setHex(0x095473);
      material.emissive.setHex(0x087a9f);
    } else if (material.name === 'M_EnemySignal') {
      material.color.setHex(0x76160e);
      material.emissive.setHex(0xd52a18);
    }
    material.needsUpdate = true;
  }

  private disposeImportedScene(root: THREE.Object3D): void {
    disposeUniqueImportedResources(root);
  }

  private authoredPlayerUnitTemplate(kind: UnitKind): THREE.Group | null {
    switch (kind) {
      case 'tank': return this.authoredPlayerTankTemplate;
      case 'harvester': return this.authoredPlayerHarvesterTemplate;
      case 'rifle': return this.authoredPlayerRifleTemplate;
      case 'engineer': return this.authoredPlayerEngineerTemplate;
      case 'antitank': return this.authoredPlayerAntitankTemplate;
      case 'scout': return this.authoredPlayerScoutTemplate;
      case 'suppressor': return this.authoredPlayerSuppressorTemplate;
      case 'artillery': return this.authoredPlayerArtilleryTemplate;
      default: return null;
    }
  }

  private authoredEnemyUnitTemplate(kind: UnitKind): THREE.Group | null {
    switch (kind) {
      case 'tank': return this.authoredEnemyTankTemplate;
      case 'rifle': return this.authoredEnemyRifleTemplate;
      case 'antitank': return this.authoredEnemyAntitankTemplate;
      case 'scout': return this.authoredEnemyScoutTemplate;
      case 'suppressor': return this.authoredEnemySuppressorTemplate;
      case 'artillery': return this.authoredEnemyArtilleryTemplate;
      case 'harvester': return this.authoredEnemyHarvesterTemplate;
      case 'engineer': return this.authoredEnemyEngineerTemplate;
      default: return null;
    }
  }

  private installAuthoredWrecks(template: THREE.Group): void {
    const placements: Array<[number, number, number, number]> = [
      [-27, 34, -0.7, 0.82],
      [-72, 56, 1.95, 0.72],
      [31, -33, 2.5, 0.9],
      [-20, 8, -0.92, 0.68],
      [20, -8, 2.22, 0.66],
    ];
    if (this.fixture.startsWith('breakthrough-demo')) {
      placements.push([4, -28, -0.45, 0.72], [28, -12, 2.4, 0.68]);
    }
    for (const placement of placements) this.installAuthoredDecoration(template, placement, 0.02, true);
  }

  private installAuthoredCraters(template: THREE.Group): void {
    const placements: Array<[number, number, number, number]> = [
      [-73, -24, 0.2, 0.9], [-38, 69, -0.65, 0.75], [28, 70, 0.9, 0.82],
      [72, 25, -1.1, 0.78], [18, -71, 0.45, 0.86], [-58, -63, 1.25, 0.7],
      [-15, -5, 0.35, 0.62], [14, 9, -0.8, 0.58], [-3, -17, 1.15, 0.54], [4, 18, -1.32, 0.56],
    ];
    if (this.fixture.startsWith('breakthrough-demo')) {
      placements.push([2, -18, 0.4, 0.68], [15, -26, -0.9, 0.64], [29, -18, 1.2, 0.58]);
    }
    for (const placement of placements) this.installAuthoredDecoration(template, placement, 0.006, false);
  }

  private installAuthoredRoadMarkers(template: THREE.Group): void {
    const placements: Array<[number, number, number, number]> = [
      [-37.7, 28, -0.78, 0.72], [-56.5, 29, 0, 0.68], [-10, 14, -1.52, 0.62],
      [37.7, -28, 2.36, 0.72], [56.5, -29, Math.PI, 0.68], [10, -14, 1.62, 0.62],
    ];
    for (const placement of placements) {
      this.authoredSmallPropVisuals.push(this.installAuthoredDecoration(template, placement, 0.02, true));
    }
    this.updateDecorativeDetailVisibility();
  }

  private installAuthoredSmallProps(
    template: THREE.Group,
    placements: ReadonlyArray<readonly [number, number, number, number]>,
  ): void {
    for (const placement of placements) {
      this.authoredSmallPropVisuals.push(this.installAuthoredDecoration(template, placement, 0.02, true));
    }
    this.updateDecorativeDetailVisibility();
  }

  private updateDecorativeDetailVisibility(): void {
    const profile = RENDER_QUALITY_PROFILES[this.renderQuality];
    const showDetail = this.viewHeight <= profile.detailViewHeight;
    for (const root of this.authoredSmallPropVisuals) {
      root.traverse((object) => {
        if (object.userData.decorativeDetail === true) object.visible = showDetail;
      });
    }
    const showVegetation = this.viewHeight <= profile.vegetationViewHeight;
    for (const root of this.authoredVegetationVisuals) root.visible = showVegetation;
  }

  private installAuthoredVegetation(
    template: THREE.Group,
    placements: ReadonlyArray<readonly [number, number, number, number]>,
  ): void {
    for (const placement of placements) {
      this.authoredVegetationVisuals.push(this.installAuthoredDecoration(template, placement, 0.02, false));
    }
    this.updateDecorativeDetailVisibility();
  }

  private installAuthoredDecoration(
    template: THREE.Group,
    placement: readonly [number, number, number, number],
    groundY: number,
    castShadow: boolean,
  ): THREE.Group {
    const [x, z, yaw, scale] = placement;
    const visual = template.clone(true);
    visual.name = `${template.name}-decoration`;
    visual.position.set(x, groundY, z);
    visual.rotation.y = yaw;
    visual.scale.setScalar(scale);
    visual.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = castShadow && object.castShadow;
    });
    this.worldRoot.add(visual);
    return visual;
  }

  private authoredPlayerBuildingTemplate(kind: BuildingKind): THREE.Group | null {
    switch (kind) {
      case 'hq': return this.authoredPlayerHqTemplate;
      case 'refinery': return this.authoredPlayerRefineryTemplate;
      case 'factory': return this.authoredPlayerFactoryTemplate;
      case 'reactor': return this.authoredPlayerReactorTemplate;
      case 'barracks': return this.authoredPlayerBarracksTemplate;
      case 'relay': return this.authoredPlayerRelayTemplate;
      case 'sentry': return this.authoredPlayerSentryTemplate;
      case 'cannon': return this.authoredPlayerCannonTemplate;
      default: return null;
    }
  }

  private authoredEnemyBuildingTemplate(kind: BuildingKind): THREE.Group | null {
    switch (kind) {
      case 'hq': return this.authoredEnemyHqTemplate;
      case 'refinery': return this.authoredEnemyRefineryTemplate;
      case 'factory': return this.authoredEnemyFactoryTemplate;
      case 'reactor': return this.authoredEnemyReactorTemplate;
      case 'barracks': return this.authoredEnemyBarracksTemplate;
      case 'relay': return this.authoredEnemyRelayTemplate;
      case 'sentry': return this.authoredEnemySentryTemplate;
      case 'cannon': return this.authoredEnemyCannonTemplate;
      default: return null;
    }
  }

  private getBuildingTemplate(kind: BuildingKind, team: CombatTeam): THREE.Group {
    const key = `${team}:${kind}`;
    const cached = this.buildingTemplates.get(key);
    if (cached) return cached;
    const authoredTemplate = team === 'player'
      ? this.authoredPlayerBuildingTemplate(kind)
      : this.authoredEnemyBuildingTemplate(kind);
    const template = authoredTemplate?.clone(true) ?? this.buildBuildingTemplate(kind, team);
    this.buildingTemplates.set(key, template);
    return template;
  }

  private buildBuildingTemplate(kind: BuildingKind, team: CombatTeam): THREE.Group {
    const group = new THREE.Group();
    const teamMaterial = this.palette.team[team];
    const footprint = BUILDING_DEFS[kind].footprint;
    this.addBox(group, footprint.x + 0.9, 0.16, footprint.z + 0.9, 0, 0.08, 0, this.palette.earthDark, false);
    this.addBox(group, footprint.x + 0.48, 0.2, footprint.z + 0.48, 0, 0.19, 0, teamMaterial, false);
    this.addBox(group, footprint.x, 0.34, footprint.z, 0, 0.38, 0, this.palette.graphiteDark, true);

    switch (kind) {
      case 'hq':
        this.addBox(group, 9, 3.2, 7.2, 0, 2.05, 0, this.palette.graphite, true);
        for (const x of [-4.6, 4.6]) {
          for (const z of [-3.7, 3.7]) this.addBox(group, 2.2, 2.2, 2.2, x, 1.45, z, this.palette.graphite, true);
        }
        this.addCylinder(group, 3, 3.4, 2.2, 12, 0, 4.35, 0, this.palette.graphite, true);
        this.addCylinder(group, 3.12, 3.12, 0.28, 12, 0, 5.42, 0, teamMaterial, true);
        this.addCylinder(group, 0.82, 1.05, 2.15, 12, 0, 6.55, 0, this.palette.steel, true);
        this.addCylinder(group, 0.48, 0.65, 0.28, 12, 0, 7.68, 0, this.palette.cyan, false).userData.poweredOnly = true;
        this.addBox(group, 2.8, 0.22, 0.18, 0, 2.6, 3.66, this.palette.cyan, false).userData.poweredOnly = true;
        this.addBox(group, 3.25, 2.65, 0.28, 0, 1.72, 3.72, this.palette.graphiteDark, true);
        this.addBox(group, 2.35, 1.82, 0.15, 0, 1.52, 3.9, this.palette.panel, false);
        for (const x of [-3.35, 3.35]) {
          const brace = this.addBox(group, 0.42, 2.85, 0.62, x, 2.25, 3.55, this.palette.bronze, true);
          brace.rotation.z = x < 0 ? -0.14 : 0.14;
        }
        for (const z of [-2.35, 0, 2.35]) this.addBox(group, 0.22, 0.32, 1.35, -4.62, 2.1, z, this.palette.panel, true);
        break;
      case 'reactor':
        this.addCylinder(group, 2.35, 2.7, 3.6, 16, 0, 2.1, 0, this.palette.graphite, true);
        this.addCylinder(group, 1.18, 1.55, 2.65, 16, 0, 2.35, 0, this.palette.cyan, false).userData.poweredOnly = true;
        this.addCylinder(group, 2.5, 2.5, 0.3, 16, 0, 3.9, 0, teamMaterial, true);
        for (const x of [-2.7, 2.7]) {
          for (const z of [-2.7, 2.7]) this.addCylinder(group, 0.48, 0.62, 4.6, 10, x, 2.65, z, this.palette.steel, true);
        }
        this.addCylinder(group, 0.82, 0.82, 0.32, 16, 0, 4.42, 0, this.palette.cyan, false).userData.poweredOnly = true;
        for (const height of [1.15, 2.18, 3.22]) this.addCylinder(group, 2.48, 2.48, 0.16, 16, 0, height, 0, this.palette.bronze, true);
        for (const x of [-1.28, 1.28]) {
          const conduit = this.addCylinder(group, 0.18, 0.22, 3.8, 10, x, 2.2, 2.38, this.palette.steel, true);
          conduit.rotation.x = Math.PI / 2;
        }
        break;
      case 'refinery':
        this.addBox(group, 7.2, 3.35, 6.4, -1.65, 2.05, 0, this.palette.graphite, true);
        this.addCylinder(group, 1.65, 2.0, 4.8, 14, 3.9, 2.72, -0.5, this.palette.graphite, true);
        this.addCylinder(group, 1.75, 1.75, 0.3, 14, 3.9, 5.02, -0.5, teamMaterial, true);
        this.addBox(group, 4.2, 1.45, 2.3, -1.0, 1.15, 4.2, this.palette.graphiteDark, true);
        this.addBox(group, 3.2, 0.18, 0.2, -1.0, 2.2, 5.37, this.palette.cyan, false).userData.poweredOnly = true;
        this.addCylinder(group, 0.22, 0.28, 4.6, 10, -4.6, 3.0, -2.0, this.palette.steel, true);
        this.addBox(group, 4.8, 0.36, 1.65, -0.45, 1.0, 4.65, this.palette.panel, true).rotation.x = -0.1;
        for (const x of [-2.1, -0.7, 0.7]) this.addBox(group, 0.48, 0.16, 1.6, x, 1.22, 4.8, this.palette.marking, false);
        for (const height of [1.3, 2.55, 3.8]) this.addCylinder(group, 1.78, 1.78, 0.16, 14, 3.9, height, -0.5, this.palette.bronze, true);
        break;
      case 'barracks':
        this.addBox(group, 6.6, 2.8, 5.7, 0, 1.75, 0, this.palette.graphite, true);
        this.addBox(group, 7.2, 0.3, 6.25, 0, 3.22, 0, teamMaterial, true);
        this.addBox(group, 2.3, 2.1, 0.22, 0, 1.45, 2.91, this.palette.graphiteDark, false);
        this.addBox(group, 2.7, 0.16, 0.28, 0, 2.72, 3.08, this.palette.cyan, false).userData.poweredOnly = true;
        for (const x of [-2.45, 2.45]) this.addCylinder(group, 0.11, 0.14, 2.1, 8, x, 4.12, -1.6, this.palette.steel, true);
        for (const x of [-2.45, 2.45]) {
          this.addBox(group, 1.05, 0.88, 0.7, x, 3.78, -1.5, this.palette.panel, true);
          for (const z of [-0.18, 0.18]) this.addBox(group, 0.65, 0.08, 0.08, x, 3.82, -1.15 + z, this.palette.steel, false);
        }
        for (const x of [-2.55, 2.55]) this.addBox(group, 1.15, 0.7, 1.15, x, 0.82, 2.48, this.palette.bronze, true);
        break;
      case 'factory':
        this.addBox(group, 9.7, 4.2, 7.35, 0, 2.4, -0.25, this.palette.graphite, true);
        this.addBox(group, 5.4, 3.15, 0.24, 0, 1.95, 3.47, this.palette.graphiteDark, false);
        this.addBox(group, 5.8, 0.3, 0.5, 0, 3.75, 3.62, teamMaterial, true);
        this.addBox(group, 3.6, 0.18, 0.2, 0, 3.35, 3.76, this.palette.cyan, false).userData.poweredOnly = true;
        for (const x of [-4.55, 4.55]) {
          this.addCylinder(group, 0.35, 0.5, 4.9, 10, x, 3.2, -2.25, this.palette.steel, true);
        }
        this.addBox(group, 4.2, 0.38, 2.5, 0, 4.68, -0.5, this.palette.graphiteDark, true);
        const ramp = this.addBox(group, 5.9, 0.24, 3.2, 0, 0.42, 4.72, this.palette.panel, true);
        ramp.rotation.x = -0.07;
        for (const x of [-2.2, -1.1, 0, 1.1, 2.2]) this.addBox(group, 0.52, 0.1, 2.9, x, 0.58, 4.72, this.palette.marking, false);
        for (const x of [-1.5, 1.5]) this.addCylinder(group, 0.28, 0.34, 1.1, 10, x, 5.32, -0.5, this.palette.steel, true);
        break;
      case 'relay': {
        this.addBox(group, 4.8, 1.5, 4.8, 0, 1.0, 0, this.palette.graphite, true);
        this.addCylinder(group, 1.7, 2.0, 0.38, 12, 0, 1.9, 0, teamMaterial, true);
        this.addCylinder(group, 0.28, 0.4, 3.8, 10, 0, 3.85, 0, this.palette.steel, true);
        const dish = this.addMesh(group, this.sphereGeometry(1, 18, 10), this.palette.graphite, 0, 5.35, 0.45, true);
        dish.scale.set(1.45, 1.45, 0.26);
        dish.rotation.x = -0.28;
        dish.userData.spinSpeed = 0.32;
        this.addBox(group, 3.65, 0.25, 0.4, 0, 4.42, 0, this.palette.bronze, true);
        this.addBox(group, 0.4, 0.25, 3.65, 0, 4.42, 0, this.palette.bronze, true);
        for (const x of [-1.72, 1.72]) this.addCylinder(group, 0.16, 0.2, 2.0, 8, x, 3.45, 0, this.palette.steel, true);
        this.addCylinder(group, 0.42, 0.55, 0.26, 12, 0, 5.92, 0.75, this.palette.cyan, false).userData.poweredOnly = true;
        break;
      }
      case 'sentry':
      case 'cannon':
        this.buildDefenseTower(group, kind, team);
        break;
    }
    this.addBuildingTrim(group, footprint, teamMaterial);
    return group;
  }

  private addBuildingTrim(group: THREE.Group, footprint: Vec2, teamMaterial: THREE.Material): void {
    const cornerX = footprint.x * 0.48;
    const cornerZ = footprint.z * 0.48;
    for (const [x, z] of [[-cornerX, -cornerZ], [cornerX, -cornerZ], [-cornerX, cornerZ], [cornerX, cornerZ]] as const) {
      this.addBox(group, 0.72, 0.8, 0.72, x, 0.72, z, this.palette.bronze, true);
      this.addCylinder(group, 0.12, 0.12, 0.14, 8, x, 1.15, z, this.palette.steel, true);
    }
    for (const x of [-footprint.x * 0.27, 0, footprint.x * 0.27]) {
      this.addBox(group, Math.min(1.2, footprint.x * 0.16), 0.18, 0.22, x, 0.68, footprint.z * 0.515, teamMaterial, false);
      this.addBox(group, Math.min(1.2, footprint.x * 0.16), 0.18, 0.22, x, 0.68, -footprint.z * 0.515, this.palette.panel, false);
    }
  }

  private buildDefenseTower(group: THREE.Group, kind: 'sentry' | 'cannon', team: CombatTeam): void {
    const heavy = kind === 'cannon';
    const teamMaterial = this.palette.team[team];
    const baseRadius = heavy ? 3.05 : 2.35;
    const pivotHeight = heavy ? 2.35 : 2.05;

    // Both defenses share one grounded silhouette and material grammar.
    this.addCylinder(group, baseRadius, baseRadius + 0.38, 0.7, 8, 0, 0.68, 0, this.palette.graphiteDark, true);
    this.addCylinder(group, baseRadius - 0.25, baseRadius, 0.72, 8, 0, 1.34, 0, this.palette.graphite, true);
    this.addCylinder(group, baseRadius + 0.05, baseRadius + 0.05, 0.24, 8, 0, 1.72, 0, teamMaterial, true);
    this.addCylinder(group, heavy ? 1.65 : 1.35, heavy ? 1.9 : 1.58, 0.52, 12, 0, 1.98, 0, this.palette.steel, true);

    const braceOffset = heavy ? 2.55 : 1.95;
    for (const [x, z, rotation] of [
      [0, braceOffset, 0],
      [braceOffset, 0, Math.PI / 2],
      [0, -braceOffset, 0],
      [-braceOffset, 0, Math.PI / 2],
    ] as const) {
      const brace = this.addBox(
        group,
        heavy ? 1.35 : 1.05,
        0.78,
        heavy ? 1.2 : 0.95,
        x,
        0.92,
        z,
        this.palette.graphite,
        true,
      );
      brace.rotation.y = rotation;
    }

    const powerLight = this.addBox(
      group,
      heavy ? 1.25 : 0.9,
      0.18,
      0.22,
      0,
      1.5,
      baseRadius + 0.08,
      this.palette.cyan,
      false,
    );
    powerLight.userData.poweredOnly = true;

    const pivot = new THREE.Group();
    pivot.name = `${kind}-turret-pivot`;
    pivot.userData.turretPivot = true;
    pivot.position.y = pivotHeight;
    group.add(pivot);

    if (kind === 'sentry') {
      this.addCylinder(pivot, 1.15, 1.38, 0.46, 12, 0, 0.22, 0, this.palette.graphiteDark, true);
      this.addBox(pivot, 1.75, 0.72, 1.45, 0, 0.68, -0.05, this.palette.graphite, true);
      this.addBox(pivot, 1.82, 0.18, 1.5, 0, 0.98, -0.05, teamMaterial, true);
      for (const x of [-0.34, 0.34]) {
        const barrel = this.addCylinder(pivot, 0.09, 0.13, 2.45, 8, x, 0.72, 1.35, this.palette.steel, true);
        barrel.rotation.x = Math.PI / 2;
        const muzzle = this.addCylinder(pivot, 0.14, 0.14, 0.26, 8, x, 0.72, 2.58, this.palette.graphiteDark, true);
        muzzle.rotation.x = Math.PI / 2;
      }
      this.addCylinder(pivot, 0.2, 0.27, 0.52, 10, 0, 1.32, -0.18, this.palette.cyan, false).userData.poweredOnly = true;
      return;
    }

    this.addCylinder(pivot, 1.52, 1.78, 0.62, 12, 0, 0.3, 0, this.palette.graphiteDark, true);
    this.addBox(pivot, 2.55, 1.05, 2.0, 0, 0.82, -0.3, this.palette.graphite, true);
    this.addBox(pivot, 2.65, 0.22, 2.08, 0, 1.23, -0.3, teamMaterial, true);
    const cannon = this.addCylinder(pivot, 0.17, 0.27, 5.2, 12, 0, 1.08, 2.15, this.palette.steel, true);
    cannon.rotation.x = Math.PI / 2 - 0.11;
    const mantlet = this.addBox(pivot, 1.25, 0.78, 1.15, 0, 0.98, 0.7, this.palette.graphiteDark, true);
    mantlet.rotation.x = -0.08;
    const muzzle = this.addCylinder(pivot, 0.29, 0.29, 0.48, 12, 0, 1.35, 4.72, this.palette.graphiteDark, true);
    muzzle.rotation.x = Math.PI / 2 - 0.11;
    this.addCylinder(pivot, 0.24, 0.3, 0.6, 10, 0, 1.65, -0.52, this.palette.cyan, false).userData.poweredOnly = true;
  }

  private buildUnitTemplate(kind: UnitKind, team: CombatTeam): THREE.Group {
    const group = new THREE.Group();
    switch (kind) {
      case 'rifle':
      case 'antitank':
      case 'engineer':
        this.buildInfantrySquad(group, kind, team);
        break;
      case 'scout':
        this.buildScout(group, team);
        break;
      case 'suppressor':
        this.buildSuppressor(group, team);
        break;
      case 'tank':
        this.buildTank(group, team, false);
        break;
      case 'artillery':
        this.buildTank(group, team, true);
        break;
      case 'harvester':
        this.buildHarvester(group, team);
        break;
    }
    return group;
  }

  private buildInfantrySquad(group: THREE.Group, kind: 'rifle' | 'antitank' | 'engineer', team: CombatTeam): void {
    const offsets: Array<[number, number]> = [[-0.43, 0.25], [0.42, 0.22], [0, -0.42]];
    offsets.forEach(([x, z], index) => {
      const soldier = new THREE.Group();
      soldier.position.set(x, 0, z);
      group.add(soldier);
      this.addBox(soldier, 0.15, 0.62, 0.18, -0.13, 0.31, 0, this.palette.graphiteDark, true);
      this.addBox(soldier, 0.15, 0.62, 0.18, 0.13, 0.31, 0, this.palette.graphiteDark, true);
      this.addBox(soldier, 0.52, 0.68, 0.34, 0, 0.93, 0, this.palette.graphite, true);
      this.addBox(soldier, 0.55, 0.18, 0.38, 0, 1.2, 0.01, this.palette.team[team], true);
      this.addMesh(soldier, this.sphereGeometry(0.22, 12, 8), this.palette.steel, 0, 1.48, 0.02, true);
      this.addBox(soldier, 0.42, 0.14, 0.32, 0, 1.56, 0.01, this.palette.graphiteDark, true);
      this.addBox(soldier, 0.38, 0.22, 0.16, 0, 1.45, 0.2, this.palette.cyanDim, false);
      this.addBox(soldier, 0.18, 0.22, 0.48, -0.34, 1.12, -0.02, this.palette.panel, true).rotation.z = -0.16;
      this.addBox(soldier, 0.18, 0.22, 0.48, 0.34, 1.12, -0.02, this.palette.panel, true).rotation.z = 0.16;
      this.addBox(soldier, 0.42, 0.5, 0.18, 0, 0.98, -0.27, this.palette.bronze, true);

      if (kind === 'rifle') {
        this.addBox(soldier, 0.12, 0.12, 0.95, index === 1 ? -0.2 : 0.2, 1.02, 0.42, this.palette.steel, true).rotation.x = -0.08;
      } else if (kind === 'antitank' && index === 0) {
        const launcher = this.addCylinder(soldier, 0.1, 0.12, 1.25, 10, 0.22, 1.23, 0.33, this.palette.steel, true);
        launcher.rotation.x = Math.PI / 2 - 0.15;
      } else if (kind === 'engineer') {
        this.addBox(soldier, 0.4, 0.55, 0.22, 0, 0.95, -0.28, this.palette.team[team], true);
        const tool = this.addBox(soldier, 0.1, 0.1, 0.8, 0.28, 0.92, 0.36, this.palette.cyan, false);
        tool.rotation.x = -0.28;
      } else {
        this.addBox(soldier, 0.14, 0.14, 0.72, 0.2, 1.0, 0.3, this.palette.steel, true);
      }
    });
  }

  private buildScout(group: THREE.Group, team: CombatTeam): void {
    this.addBox(group, 1.75, 0.56, 2.9, 0, 0.72, 0, this.palette.graphite, true);
    const bonnet = this.addBox(group, 1.54, 0.42, 1.25, 0, 0.96, 0.86, this.palette.panel, true);
    bonnet.rotation.x = -0.12;
    this.addBox(group, 1.35, 0.5, 1.32, 0, 1.16, -0.48, this.palette.team[team], true);
    this.addBox(group, 1.05, 0.36, 0.08, 0, 1.36, 0.18, this.palette.cyanDim, false).rotation.x = -0.24;
    this.addBox(group, 1.15, 0.22, 0.75, 0, 0.76, 1.55, this.palette.steel, true);
    this.addBox(group, 1.95, 0.16, 0.22, 0, 0.82, 1.78, this.palette.bronze, true);
    for (const x of [-0.96, 0.96]) {
      for (const z of [-0.93, 0.93]) this.addWheel(group, 0.39, 0.3, x, 0.48, z);
    }
    for (const x of [-0.56, 0.56]) this.addBox(group, 0.34, 0.16, 0.1, x, 0.9, 1.92, this.palette.marking, false);
    this.addCylinder(group, 0.32, 0.42, 0.28, 12, 0, 1.42, 0.3, this.palette.cyan, false).userData.spinSpeed = 1.1;
    this.addCylinder(group, 0.07, 0.08, 0.8, 8, 0, 1.84, 0.3, this.palette.steel, true);
  }

  private buildSuppressor(group: THREE.Group, team: CombatTeam): void {
    this.addBox(group, 2.45, 0.72, 4.0, 0, 0.92, 0, this.palette.graphite, true);
    this.addBox(group, 1.9, 0.36, 2.4, 0, 1.38, -0.2, this.palette.team[team], true);
    for (const x of [-1.35, 1.35]) {
      for (const z of [-1.3, 0, 1.3]) this.addWheel(group, 0.46, 0.34, x, 0.57, z);
    }
    for (const x of [-1.18, 1.18]) {
      const fender = this.addBox(group, 0.22, 0.24, 3.65, x, 0.96, 0, this.palette.bronze, true);
      fender.rotation.z = x < 0 ? -0.08 : 0.08;
    }
    this.addCylinder(group, 0.78, 0.9, 0.5, 14, 0, 1.77, 0.28, this.palette.graphiteDark, true);
    for (const x of [-0.22, 0.22]) {
      const gun = this.addCylinder(group, 0.07, 0.1, 1.65, 8, x, 1.82, 1.15, this.palette.steel, true);
      gun.rotation.x = Math.PI / 2;
    }
    this.addBox(group, 1.5, 0.16, 1.4, 0, 1.71, -0.78, this.palette.panel, true);
    this.addCylinder(group, 0.12, 0.16, 0.68, 8, -0.64, 2.15, -0.72, this.palette.steel, true);
    this.addBox(group, 0.68, 0.12, 0.18, 0, 1.48, 2.03, this.palette.cyan, false);
  }

  private buildTank(group: THREE.Group, team: CombatTeam, artillery: boolean): void {
    const width = artillery ? 2.7 : 2.9;
    const length = artillery ? 4.7 : 4.5;
    this.addBox(group, 0.58, 0.72, length, -width / 2, 0.62, 0, this.palette.rubber, true);
    this.addBox(group, 0.58, 0.72, length, width / 2, 0.62, 0, this.palette.rubber, true);
    this.addBox(group, width - 0.45, 0.72, length - 0.55, 0, 0.92, 0, this.palette.graphite, true);
    this.addBox(group, width - 0.85, 0.27, length - 1.15, 0, 1.38, -0.15, this.palette.team[team], true);
    for (const x of [-width / 2, width / 2]) {
      for (const z of [-1.55, -0.52, 0.52, 1.55]) this.addWheel(group, 0.42, 0.62, x, 0.61, z);
      const sidePlate = this.addBox(group, 0.18, 0.38, length - 0.35, x, 0.86, 0, this.palette.bronze, true);
      sidePlate.rotation.z = x < 0 ? -0.06 : 0.06;
    }
    const glacis = this.addBox(group, width - 0.8, 0.38, 1.08, 0, 1.25, 1.72, this.palette.panel, true);
    glacis.rotation.x = -0.24;
    for (const x of [-0.72, 0.72]) this.addBox(group, 0.38, 0.14, 0.12, x, 1.36, 2.18, this.palette.marking, false);
    this.addBox(group, width - 0.72, 0.18, 0.3, 0, 1.16, -2.22, this.palette.graphiteDark, true);

    if (artillery) {
      this.addCylinder(group, 0.78, 0.9, 0.5, 14, 0, 1.72, -0.72, this.palette.graphiteDark, true);
      const gun = this.addCylinder(group, 0.14, 0.2, 5.2, 10, 0, 2.17, 1.55, this.palette.steel, true);
      gun.rotation.x = Math.PI / 2 - 0.17;
      this.addBox(group, 1.75, 0.55, 1.2, 0, 1.68, -1.55, this.palette.graphite, true);
      this.addBox(group, 1.92, 0.16, 1.32, 0, 1.99, -1.55, this.palette.team[team], true);
      this.addCylinder(group, 0.11, 0.15, 0.82, 8, 0.72, 2.42, -1.66, this.palette.steel, true);
      for (const x of [-1.65, 1.65]) {
        const brace = this.addBox(group, 0.16, 0.22, 1.6, x, 0.26, -1.6, this.palette.steel, true);
        brace.rotation.y = x < 0 ? -0.22 : 0.22;
      }
    } else {
      this.addCylinder(group, 0.98, 1.12, 0.62, 16, 0, 1.79, 0.2, this.palette.graphiteDark, true);
      this.addBox(group, 1.35, 0.34, 1.6, 0, 2.06, 0.18, this.palette.team[team], true);
      this.addCylinder(group, 0.38, 0.42, 0.16, 12, -0.44, 2.31, -0.18, this.palette.steel, true);
      this.addCylinder(group, 0.08, 0.1, 0.92, 8, 0.56, 2.68, -0.35, this.palette.steel, true);
      const gun = this.addCylinder(group, 0.13, 0.2, 3.35, 10, 0, 2.1, 1.78, this.palette.steel, true);
      gun.rotation.x = Math.PI / 2;
      this.addBox(group, 0.75, 0.14, 0.18, 0, 1.48, 2.15, this.palette.cyan, false);
    }
  }

  private buildHarvester(group: THREE.Group, team: CombatTeam): void {
    this.addBox(group, 2.75, 0.82, 4.55, 0, 0.98, 0, this.palette.graphite, true);
    for (const x of [-1.55, 1.55]) {
      for (const z of [-1.35, 0, 1.35]) this.addWheel(group, 0.5, 0.36, x, 0.62, z);
      this.addBox(group, 0.22, 0.38, 4.3, x * 0.91, 0.99, 0, this.palette.bronze, true);
    }
    const cabin = this.addBox(group, 2.2, 1.2, 2.15, 0, 1.75, -0.65, this.palette.team[team], true);
    cabin.rotation.x = 0.04;
    this.addBox(group, 1.72, 0.54, 0.12, 0, 1.92, 0.45, this.palette.cyanDim, false).rotation.x = -0.18;
    this.addBox(group, 2.38, 0.2, 2.35, 0, 2.42, -0.68, this.palette.panel, true);
    this.addBox(group, 2.35, 0.72, 1.6, 0, 1.45, 1.55, this.palette.graphiteDark, true);
    [-0.62, 0, 0.62].forEach((x, index) => {
      const cargoSlot = new THREE.Group();
      cargoSlot.name = `cargo_slot_${index}`;
      cargoSlot.position.set(x, 2.38 + Math.abs(x) * 0.16, 1.5);
      group.add(cargoSlot);
      const crystal = this.addMesh(cargoSlot, this.octahedronGeometry(0.34), this.palette.crystal, 0, 0, 0, false);
      crystal.scale.set(0.72, 1.9 + Math.abs(x) * 0.35, 0.72);
    });
    for (const x of [-0.72, 0.72]) this.addBox(group, 0.38, 0.16, 0.14, x, 1.32, 2.39, this.palette.marking, false);
    this.addBox(group, 1.2, 0.16, 0.2, 0, 1.78, 2.37, this.palette.cyan, false);
  }

  private addWheel(parent: THREE.Group, radius: number, width: number, x: number, y: number, z: number): void {
    const wheel = this.addCylinder(parent, radius, radius, width, 12, x, y, z, this.palette.rubber, true);
    wheel.rotation.z = Math.PI / 2;
  }

  private createResourceTemplate(): THREE.Group {
    if (this.authoredResourceTemplate) return this.authoredResourceTemplate;
    const key = 'neutral:resource';
    const cached = this.unitTemplates.get(key);
    if (cached) return cached;
    const group = new THREE.Group();
    const base = this.addCylinder(group, 4.9, 5.25, 0.2, 24, 0, 0.02, 0, this.palette.earthDark, false);
    base.receiveShadow = true;
    const placements: Array<[number, number, number, number]> = [
      [0, 0, 4.8, 0.75], [-1.6, 0.7, 3.2, 0.62], [1.55, -0.65, 3.7, 0.68],
      [-2.7, -1.4, 2.4, 0.54], [2.8, 1.35, 2.55, 0.52], [-0.8, -2.25, 2.75, 0.58],
      [1.05, 2.25, 2.2, 0.5], [-3.15, 1.8, 1.7, 0.42], [3.2, -1.85, 1.8, 0.44],
    ];
    for (const [x, z, height, width] of placements) {
      const crystal = this.addMesh(group, this.octahedronGeometry(1), this.palette.crystal, x, height * 0.45, z, true);
      crystal.scale.set(width, height * 0.62, width);
      crystal.rotation.y = (x + z) * 0.31;
    }
    for (const [x, z] of [[-3.8, -2.7], [3.6, 2.5], [-2.9, 3.4], [2.7, -3.5]] as const) {
      const shard = this.addMesh(group, this.octahedronGeometry(0.5), this.palette.crystal, x, 0.42, z, false);
      shard.scale.set(0.48, 1.3, 0.48);
      shard.rotation.z = (x + z) * 0.12;
    }
    this.unitTemplates.set(key, group);
    return group;
  }

  private syncBlockers(state: GameState): void {
    const seen = new Set<string>();
    for (const blocker of state.blockers) {
      if (shouldHideReviewPresentationBlocker(this.fixture, blocker.id)) continue;
      seen.add(blocker.id);
      let visual = this.blockerVisuals.get(blocker.id);
      if (!visual) {
        visual = this.getRockTemplate().clone(true);
        visual.rotation.y = ((stableHash(blocker.id) % 628) / 100) - Math.PI;
        this.blockerVisuals.set(blocker.id, visual);
        this.blockerRoot.add(visual);
      }
      visual.position.set(blocker.position.x, 0, blocker.position.z);
      const scale = blocker.radius / 5;
      visual.scale.set(scale, 0.8 + scale * 0.2, scale);
    }
    for (const [id, visual] of this.blockerVisuals) {
      if (seen.has(id)) continue;
      this.blockerRoot.remove(visual);
      this.blockerVisuals.delete(id);
    }
  }

  private getRockTemplate(): THREE.Group {
    if (this.rockTemplate) return this.rockTemplate;
    const group = new THREE.Group();
    const placements: Array<[number, number, number, number]> = [
      [0, 0, 2.6, 1.75], [-2.0, 0.8, 1.7, 1.35], [2.05, -0.65, 1.85, 1.4],
      [-0.85, -2.0, 1.5, 1.15], [1.1, 1.9, 1.25, 1.05],
    ];
    for (const [x, z, y, scale] of placements) {
      const rock = this.addMesh(group, this.dodecahedronGeometry(1), this.palette.rock, x, y * 0.52, z, true);
      rock.scale.set(scale, y, scale * 0.88);
      rock.rotation.set(z * 0.08, x * 0.21, x * 0.04);
    }
    this.rockTemplate = group;
    return group;
  }

  private consumeEvents(
    state: GameState,
    events: SimulationEvent[],
    disclosedIds: ReadonlySet<string>,
  ): void {
    if (events.length === 0) return;
    const entities = new Map<string, WorldEntity>();
    for (const entity of [...state.units, ...state.buildings, ...state.resources]) entities.set(entity.id, entity);

    for (let eventIndex = 0; eventIndex < events.length; eventIndex += 1) {
      const event = events[eventIndex];
      if (!event) continue;
      const sourceForTeam = event.sourceId && disclosedIds.has(event.sourceId)
        ? entities.get(event.sourceId)
        : undefined;
      const team = event.team ?? sourceForTeam?.team ?? 'neutral';
      switch (event.type) {
        case 'shot': {
          const sourceDisclosed = Boolean(event.sourceId && disclosedIds.has(event.sourceId));
          const source = sourceDisclosed && event.sourceId ? entities.get(event.sourceId) : undefined;
          const target = event.targetId ? entities.get(event.targetId) : undefined;
          const end = target?.position ?? event.at;
          const sourcePosition = source?.position ?? event.at;
          const shotLength = Math.hypot(end.x - sourcePosition.x, end.z - sourcePosition.z);
          const shotDirectionX = shotLength > 0.001 ? (end.x - sourcePosition.x) / shotLength : 0;
          const shotDirectionZ = shotLength > 0.001 ? (end.z - sourcePosition.z) / shotLength : 1;
          const muzzleOffset = source?.entityType === 'unit'
            ? UNIT_DEFS[source.kind].radius * 0.82
            : source?.entityType === 'building'
              ? Math.max(BUILDING_DEFS[source.kind].footprint.x, BUILDING_DEFS[source.kind].footprint.z) * 0.34
              : 0;
          let start = {
            x: sourcePosition.x + shotDirectionX * muzzleOffset,
            z: sourcePosition.z + shotDirectionZ * muzzleOffset,
          };
          let sourceHeight = source
            ? this.entityHeight(source) * (source.entityType === 'building' && BUILDING_DEFS[source.kind].weapon ? 0.67 : 0.55)
            : 0.8;
          const sourceVisual = disclosedSocketSource(event.sourceId, disclosedIds, this.entityVisuals);
          const socketName = sourceVisual
            ? selectMuzzleSocketName(
              sourceVisual.muzzleSocketNames,
              `${event.sourceId}:${state.tick}:${eventIndex}:${event.targetId ?? ''}:${event.at.x}:${event.at.z}`,
            )
            : null;
          const socket = socketName ? sourceVisual?.muzzleSockets.get(socketName) : undefined;
          if (socket && socketName) {
            socket.getWorldPosition(this.semanticSocketWorldPosition);
            if (
              Number.isFinite(this.semanticSocketWorldPosition.x)
              && Number.isFinite(this.semanticSocketWorldPosition.y)
              && Number.isFinite(this.semanticSocketWorldPosition.z)
            ) {
              start = { x: this.semanticSocketWorldPosition.x, z: this.semanticSocketWorldPosition.z };
              sourceHeight = Math.max(0.08, this.semanticSocketWorldPosition.y);
              this.socketShots += 1;
              this.semanticMuzzleSocketShots[socketName] += 1;
            } else {
              this.socketFallbacks += 1;
            }
          } else {
            this.socketFallbacks += 1;
          }
          const targetHeight = target ? this.entityHeight(target) * 0.35 : 0.35;
          const artillery = (source?.entityType === 'unit' && source.kind === 'artillery')
            || (source?.entityType === 'building' && source.kind === 'cannon');
          let speed = 55;
          if (source?.entityType === 'unit') speed = Math.max(8, UNIT_DEFS[source.kind].projectileSpeed);
          if (source?.entityType === 'building') {
            speed = Math.max(8, BUILDING_DEFS[source.kind].weapon?.projectileSpeed ?? speed);
          }
          this.addMuzzleFlash(start, end, sourceHeight, team, artillery);
          this.addProjectile(start, end, sourceHeight, targetHeight, speed, team, artillery);
          this.triggerWeaponRecoil(
            event.sourceId,
            artillery
              || (source?.entityType === 'unit' && (source.kind === 'tank' || source.kind === 'antitank'))
              || source?.entityType === 'building'
              ? 1
              : 0.58,
          );
          break;
        }
        case 'impact': {
          // Visible contact may be rendered without disclosing an unseen attacker or target archetype.
          const targetDisclosed = !event.targetId || disclosedIds.has(event.targetId);
          const target = event.targetId && targetDisclosed ? entities.get(event.targetId) : undefined;
          const sourceDisclosed = !event.sourceId || disclosedIds.has(event.sourceId);
          const heavyOrdnance = sourceDisclosed && (sourceForTeam?.entityType === 'unit'
            ? sourceForTeam.kind === 'antitank' || sourceForTeam.kind === 'tank' || sourceForTeam.kind === 'artillery'
            : sourceForTeam?.entityType === 'building' && sourceForTeam.kind === 'cannon');
          const presentation = disclosedImpactPresentation(
            sourceDisclosed,
            team,
            event.radius,
            event.amount,
            heavyOrdnance,
          );
          const { profile } = presentation;
          this.addImpact(
            event.at,
            presentation.team,
            profile.size,
            this.reducedMotion ? 0.18 : profile.duration,
            profile.kind,
          );
          if (profile.kind === 'heavy') {
            this.addScorchMark(event.at, profile.scorchSize);
            this.addSmokePlume(event.at, profile.smokeSize);
            if (profile.debris) this.addDebrisBurst(event.at, target?.entityType === 'building');
          }
          this.triggerHitReaction(
            targetDisclosed ? event.targetId : undefined,
            sourceDisclosed ? sourceForTeam?.position : undefined,
            event.at,
            presentation.reactionDamage,
          );
          break;
        }
        case 'destroyed': {
          const destroyedVisual = previousVisualForVisibleDestruction(event.targetId, this.entityVisuals);
          let residueAt = event.at;
          if (destroyedVisual?.wreckAnchor) {
            destroyedVisual.wreckAnchor.getWorldPosition(this.semanticSocketWorldPosition);
            if (
              Number.isFinite(this.semanticSocketWorldPosition.x)
              && Number.isFinite(this.semanticSocketWorldPosition.z)
            ) {
              residueAt = {
                x: this.semanticSocketWorldPosition.x,
                z: this.semanticSocketWorldPosition.z,
              };
              this.socketWreckAnchors += 1;
            }
          }
          this.addImpact(event.at, team, 2.8, this.reducedMotion ? 0.24 : 0.88, 'heavy');
          this.addScorchMark(event.at, 2.5);
          this.addSmokePlume(event.at, 2.2);
          this.addDebrisBurst(event.at, destroyedVisual?.entityType === 'building');
          if (destroyedVisual) {
            // Keep the final contact point until the existing death/collapse presentation completes.
            // Infantry then cleans up with no persistent mesh; vehicles/buildings resolve by family.
            destroyedVisual.destructionResiduePosition = { ...residueAt };
          } else {
            // Same-tick/first-frame fallback has no kind contract. Neutral debris preserves impact
            // continuity without inventing tracks, a turret, or a building silhouette.
            this.addDestroyedResidue(
              residueAt,
              destructionResidueFamilyForKind(null, null),
              event.targetId ?? 'unknown',
            );
          }
          this.triggerDestruction(destroyedVisual ? event.targetId : undefined);
          this.enforceAuthoredWreckBudget();
          break;
        }
        case 'command':
          this.showCommandMarker(event.at, team === 'enemy' ? 'attack' : 'move');
          break;
        case 'deposit': {
          const sourceVisual = disclosedSocketSource(event.sourceId, disclosedIds, this.entityVisuals);
          const targetVisual = disclosedSocketSource(event.targetId, disclosedIds, this.entityVisuals);
          const sourceSocket = sourceVisual?.presentationSockets.get('resource_socket');
          const targetSocket = targetVisual?.presentationSockets.get('deposit_socket');
          if (sourceSocket && targetSocket) {
            sourceSocket.getWorldPosition(this.semanticSocketWorldPosition);
            targetSocket.getWorldPosition(this.semanticSocketWorldTarget);
            if (
              this.isFiniteWorldPoint(this.semanticSocketWorldPosition)
              && this.isFiniteWorldPoint(this.semanticSocketWorldTarget)
            ) {
              this.addDepositTransfer(
                this.semanticSocketWorldPosition,
                this.semanticSocketWorldTarget,
                team,
              );
              if (targetVisual && hasCompleteRefineryMechanism(
                targetVisual.refineryMechanismParts.map((part) => part.role),
              )) {
                const now = this.hostWindow.performance.now() / 1000;
                if (now >= targetVisual.refineryUnloadUntil) {
                  targetVisual.refineryUnloadStartedAt = now;
                }
                targetVisual.refineryUnloadUntil = Math.max(
                  targetVisual.refineryUnloadUntil,
                  now + (this.reducedMotion ? 0.28 : 1.05),
                );
                this.socketRefineryMechanisms += 1;
              } else {
                this.refineryMechanismFallbacks += 1;
              }
              this.socketDeposits += 1;
              break;
            }
          }
          this.socketFallbacks += 1;
          this.addPulse(event.at, this.palette.command.build, 1.25, this.reducedMotion ? 0.2 : 0.55);
          break;
        }
        case 'repair': {
          const sourceVisual = disclosedSocketSource(event.sourceId, disclosedIds, this.entityVisuals);
          const socket = sourceVisual?.repairToolSocket;
          if (socket) {
            socket.getWorldPosition(this.semanticSocketWorldPosition);
            if (
              Number.isFinite(this.semanticSocketWorldPosition.x)
              && Number.isFinite(this.semanticSocketWorldPosition.y)
              && Number.isFinite(this.semanticSocketWorldPosition.z)
            ) {
              this.addRepairToolBeam(
                {
                  x: this.semanticSocketWorldPosition.x,
                  y: Math.max(0.08, this.semanticSocketWorldPosition.y),
                  z: this.semanticSocketWorldPosition.z,
                },
                event.at,
              );
              this.socketRepairs += 1;
              break;
            }
          }
          this.socketFallbacks += 1;
          this.addPulse(event.at, this.palette.command.build, 1.05, this.reducedMotion ? 0.18 : 0.42);
          break;
        }
        case 'built':
          this.addPulse(event.at, this.palette.command.build, 1.6, this.reducedMotion ? 0.22 : 0.7);
          break;
        case 'produced': {
          const sourceVisual = disclosedSocketSource(event.sourceId, disclosedIds, this.entityVisuals);
          const targetVisual = disclosedSocketSource(event.targetId, disclosedIds, this.entityVisuals);
          const source = sourceVisual && event.sourceId ? entities.get(event.sourceId) : undefined;
          const availableSocketNames = sourceVisual ? [...sourceVisual.presentationSockets.keys()] : [];
          const socketName = source?.entityType === 'building'
            ? productionPresentationSocketName(source.kind, availableSocketNames)
            : null;
          const socket = socketName ? sourceVisual?.presentationSockets.get(socketName) : undefined;
          if (sourceVisual && targetVisual && socket) {
            socket.getWorldPosition(this.semanticSocketWorldPosition);
            if (this.isFiniteWorldPoint(this.semanticSocketWorldPosition)) {
              const target = event.targetId ? entities.get(event.targetId) : undefined;
              this.addProductionExitCue(
                this.semanticSocketWorldPosition,
                target?.position ?? event.at,
                team,
              );
              if (!this.reducedMotion) {
                targetVisual.root.position.set(
                  this.semanticSocketWorldPosition.x,
                  0,
                  this.semanticSocketWorldPosition.z,
                );
              }
              const now = this.hostWindow.performance.now() / 1000;
              sourceVisual.productionDoorHoldUntil = Math.max(
                sourceVisual.productionDoorHoldUntil,
                now + (this.reducedMotion ? 0.28 : 0.9),
              );
              targetVisual.productionExitUntil = Math.max(
                targetVisual.productionExitUntil,
                now + (this.reducedMotion ? 0.28 : 0.9),
              );
              sourceVisual.doorOpenTarget = 1;
              this.socketProductionExits += 1;
              break;
            }
          }
          this.socketFallbacks += 1;
          this.addPulse(event.at, this.palette.command.build, 1.6, this.reducedMotion ? 0.22 : 0.7);
          break;
        }
        case 'research':
          this.addPulse(event.at, this.palette.command.move, 1.8, this.reducedMotion ? 0.22 : 0.75);
          break;
        case 'cancelled':
          this.addPulse(event.at, this.palette.command.warning, 1.35, this.reducedMotion ? 0.18 : 0.5);
          break;
      }
    }
  }

  private triggerWeaponRecoil(entityId: string | undefined, strength: number): void {
    if (!entityId) return;
    const visual = this.entityVisuals.get(entityId);
    if (!visual || visual.destructionAge >= 0) return;
    visual.recoilAmount = 1;
    visual.recoilStrength = Math.max(visual.recoilStrength, strength);
  }

  private triggerHitReaction(
    entityId: string | undefined,
    source: Vec2 | undefined,
    impact: Vec2,
    damage: number,
  ): void {
    if (!entityId) return;
    const visual = this.entityVisuals.get(entityId);
    if (!visual || visual.destructionAge >= 0) return;
    const sourcePosition = source ?? {
      x: impact.x - Math.sin(visual.targetRotation),
      z: impact.z - Math.cos(visual.targetRotation),
    };
    const dx = impact.x - sourcePosition.x;
    const dz = impact.z - sourcePosition.z;
    const length = Math.max(0.001, Math.hypot(dx, dz));
    visual.hitDirectionX = dx / length;
    visual.hitDirectionZ = dz / length;
    visual.hitAmount = 1;
    visual.hitStrength = THREE.MathUtils.clamp(0.5 + damage / 180, 0.58, 1.35);
  }

  private triggerDestruction(entityId: string | undefined): void {
    if (!entityId) return;
    const visual = this.entityVisuals.get(entityId);
    if (!visual || visual.destructionAge >= 0) return;
    visual.destructionAge = 0;
    visual.destructionDuration = this.reducedMotion
      ? 0.18
      : visual.animationMixer
        ? 1.05
      : visual.entityType === 'building'
        ? 0.82
        : 0.64;
    visual.selection.visible = false;
    if (visual.healthBar) visual.healthBar.group.visible = false;
    if (visual.damageVisual) {
      visual.damageVisual.stage = 'none';
      visual.damageVisual.root.visible = false;
    }
    for (const role of ['damaged', 'critical'] as const) {
      const authoredRoot = visual.authoredBuildingDamageRoots[role];
      if (authoredRoot) authoredRoot.visible = false;
    }
    if (visual.authoredBuildingRuinRoot) visual.authoredBuildingRuinRoot.visible = false;
    this.pickables.delete(visual.root);
  }

  private removeEntityVisual(entityId: string, visual: EntityVisual): void {
    visual.root.visible = false;
    visual.animationMixer?.stopAllAction();
    this.entityRoot.remove(visual.root);
    this.entityVisuals.delete(entityId);
    this.pickables.delete(visual.root);
    this.dustTrackers.delete(entityId);
  }

  private activateAuthoredWreck(entityId: string, visual: EntityVisual): boolean {
    const wreckRoot = visual.authoredWreckRoot;
    if (!wreckRoot || !shouldUseAuthoredVehicleWreck(visual.unitKind, true)) return false;

    for (const live of visual.authoredWreckLiveNodes) live.node.visible = false;
    wreckRoot.visible = true;
    visual.body.visible = true;
    visual.body.position.set(visual.bodyBaseX, visual.bodyBaseY, visual.bodyBaseZ);
    visual.body.rotation.x = visual.bodyBaseRotationX;
    visual.body.rotation.z = visual.bodyBaseRotationZ;
    visual.body.scale.set(1, 1, 1);
    visual.animationMixer?.stopAllAction();
    visual.motionAmount = 0;
    visual.activityAmount = 0;
    visual.recoilAmount = 0;
    visual.hitAmount = 0;
    visual.selection.visible = false;
    if (visual.healthBar) visual.healthBar.group.visible = false;
    if (visual.damageVisual) visual.damageVisual.root.visible = false;
    visual.authoredWreckAge = 0;
    visual.authoredWreckDuration = authoredVehicleWreckLifetime(this.renderQuality, this.reducedMotion);
    visual.authoredWreckActivationOrder = ++this.authoredWreckSequence;
    visual.destructionResiduePosition = null;
    this.authoredWreckActivations += 1;
    this.enforceAuthoredWreckBudget();
    return this.entityVisuals.get(entityId) === visual;
  }

  private activateAuthoredBuildingRuin(entityId: string, visual: EntityVisual): boolean {
    const ruinRoot = visual.authoredBuildingRuinRoot;
    if (!ruinRoot || !shouldUseAuthoredBuildingRuin(visual.buildingKind, true)) return false;

    for (const live of visual.authoredBuildingRuinLiveNodes) live.node.visible = false;
    for (const role of ['damaged', 'critical'] as const) {
      const damageRoot = visual.authoredBuildingDamageRoots[role];
      if (damageRoot) damageRoot.visible = false;
    }
    ruinRoot.visible = true;
    visual.body.visible = true;
    visual.body.position.set(visual.bodyBaseX, visual.bodyBaseY, visual.bodyBaseZ);
    visual.body.rotation.x = visual.bodyBaseRotationX;
    visual.body.rotation.z = visual.bodyBaseRotationZ;
    visual.body.scale.set(1, 1, 1);
    visual.animationMixer?.stopAllAction();
    visual.motionAmount = 0;
    visual.activityAmount = 0;
    visual.recoilAmount = 0;
    visual.hitAmount = 0;
    visual.selection.visible = false;
    const contactShadow = visual.root.getObjectByName('entity-contact-shadow');
    if (contactShadow) contactShadow.visible = false;
    if (visual.healthBar) visual.healthBar.group.visible = false;
    if (visual.damageVisual) {
      visual.damageVisual.stage = 'none';
      visual.damageVisual.root.visible = false;
    }
    visual.authoredBuildingRuinAge = 0;
    visual.authoredBuildingRuinDuration = authoredBuildingRuinLifetime(this.renderQuality, this.reducedMotion);
    visual.authoredBuildingRuinActivationOrder = ++this.authoredWreckSequence;
    visual.destructionResiduePosition = null;
    this.authoredBuildingRuinActivations += 1;
    this.enforceAuthoredWreckBudget();
    return this.entityVisuals.get(entityId) === visual;
  }

  private enforceAuthoredWreckBudget(): void {
    const cap = authoredVehicleWreckCap(this.renderQuality, this.reducedMotion);
    const wreckLifetime = authoredVehicleWreckLifetime(this.renderQuality, this.reducedMotion);
    const ruinLifetime = authoredBuildingRuinLifetime(this.renderQuality, this.reducedMotion);
    const genericLifetime = genericDestructionResidueLifetime(this.renderQuality, this.reducedMotion);
    for (const visual of this.entityVisuals.values()) {
      if (visual.authoredWreckAge >= 0) {
        visual.authoredWreckDuration = Math.min(visual.authoredWreckDuration, wreckLifetime);
      }
      if (visual.authoredBuildingRuinAge >= 0) {
        visual.authoredBuildingRuinDuration = Math.min(visual.authoredBuildingRuinDuration, ruinLifetime);
      }
    }
    for (const effect of this.effects) {
      if (effect.kind === 'residue') effect.duration = Math.min(effect.duration, genericLifetime);
    }
    const authoredEntries = [...this.entityVisuals.entries()]
      .filter(([, visual]) => visual.authoredWreckAge >= 0 || visual.authoredBuildingRuinAge >= 0)
      .map(([id, visual]) => ({
        id,
        activationOrder: visual.authoredWreckAge >= 0
          ? visual.authoredWreckActivationOrder
          : visual.authoredBuildingRuinActivationOrder,
      }));
    const survivors = new Set(authoredWreckSurvivorIds(authoredEntries, cap));
    for (const entry of authoredEntries) {
      if (survivors.has(entry.id)) continue;
      const visual = this.entityVisuals.get(entry.id);
      if (visual) this.removeEntityVisual(entry.id, visual);
    }

    const authoredCount = survivors.size;
    const genericAllowance = Math.max(0, cap - authoredCount);
    const genericResidueIndices = this.effects.flatMap((effect, index) =>
      effect.kind === 'residue' ? [index] : []);
    const removeCount = Math.max(0, genericResidueIndices.length - genericAllowance);
    for (let offset = removeCount - 1; offset >= 0; offset -= 1) {
      const index = genericResidueIndices[offset];
      if (index === undefined) continue;
      const [effect] = this.effects.splice(index, 1);
      effect?.root.removeFromParent();
    }
  }

  private isFiniteWorldPoint(point: THREE.Vector3): boolean {
    return Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z);
  }

  private addDebrisBurst(position: Vec2, building: boolean): void {
    if (this.reducedMotion || this.renderQuality === 'low') return;
    const root = new THREE.Group();
    root.position.set(position.x, 0.2, position.z);
    const shardCount = this.renderQuality === 'high' ? (building ? 6 : 4) : 3;
    const shards: Array<{ mesh: THREE.Mesh; angle: number; speed: number; lift: number; spin: number }> = [];
    for (let index = 0; index < shardCount; index += 1) {
      const hash = stableHash(`debris:${position.x.toFixed(2)}:${position.z.toFixed(2)}:${index}`);
      const angle = (index / shardCount) * Math.PI * 2 + (hash % 37) / 100;
      const mesh = this.addBox(
        root,
        building ? 0.34 : 0.22,
        building ? 0.16 : 0.12,
        building ? 0.52 : 0.34,
        0,
        0,
        0,
        index % 2 === 0 ? this.palette.steel : this.palette.graphiteDark,
        false,
      );
      shards.push({
        mesh,
        angle,
        speed: (building ? 2.9 : 2.2) + ((hash >>> 7) % 10) / 10,
        lift: (building ? 1.8 : 1.25) + ((hash >>> 11) % 9) / 10,
        spin: 3.8 + ((hash >>> 15) % 24) / 10,
      });
    }
    root.userData.debrisBurst = true;
    this.effectRoot.add(root);
    this.addEffect({
      root,
      age: 0,
      duration: building ? 0.88 : 0.7,
      kind: 'debris',
      update: (progress, elapsed) => {
        for (const shard of shards) {
          const travel = shard.speed * elapsed;
          shard.mesh.position.set(
            Math.cos(shard.angle) * travel,
            Math.max(0.04, Math.sin(progress * Math.PI) * shard.lift),
            Math.sin(shard.angle) * travel,
          );
          shard.mesh.rotation.set(elapsed * shard.spin, shard.angle, elapsed * shard.spin * 0.7);
          shard.mesh.visible = progress < 0.92;
        }
      },
    }, true);
  }

  private addDestroyedResidue(
    position: Vec2,
    family: DestructionResidueFamily,
    entityId: string,
  ): void {
    if (family === 'none') return;
    const root = new THREE.Group();
    root.name = 'destroyed-residue';
    root.userData.wreckResidue = true;
    root.userData.residueFamily = family;
    root.position.set(position.x, 0.035, position.z);
    root.rotation.y = (stableHash(`${entityId}:residue`) % 628) / 100;
    const stain = this.addMesh(root, this.circleGeometry(1, 24), this.palette.scorch, 0, 0.005, 0, false);
    stain.rotation.x = -Math.PI / 2;
    if (family === 'light-vehicle') {
      stain.scale.set(2.35, 1.45, 1);
      this.addBox(root, 2.25, 0.28, 1.16, 0, 0.15, 0, this.palette.graphiteDark, false).rotation.z = 0.045;
      const cabin = this.addBox(root, 0.95, 0.42, 1.02, -0.28, 0.35, 0.04, this.palette.panel, false);
      cabin.rotation.set(0.06, -0.12, 0.14);
      this.addBox(root, 0.78, 0.18, 0.96, 0.78, 0.25, -0.05, this.palette.bronze, false).rotation.z = -0.1;
    } else if (family === 'wide-armor') {
      stain.scale.set(2.85, 1.9, 1);
      this.addBox(root, 2.95, 0.3, 1.78, 0, 0.16, 0, this.palette.graphiteDark, false).rotation.z = 0.035;
      const upperArmor = this.addBox(root, 2.1, 0.36, 1.42, -0.12, 0.39, 0.03, this.palette.panel, false);
      upperArmor.rotation.set(0.04, 0.1, -0.12);
      const fallenPlate = this.addBox(root, 1.05, 0.18, 1.48, 1.08, 0.24, 0.12, this.palette.bronze, false);
      fallenPlate.rotation.set(0.08, -0.22, 0.16);
    } else if (family === 'artillery') {
      stain.scale.set(3.35, 1.62, 1);
      this.addBox(root, 3.45, 0.28, 1.34, -0.18, 0.15, -0.08, this.palette.graphiteDark, false).rotation.z = 0.035;
      const breech = this.addBox(root, 0.98, 0.38, 0.88, -0.45, 0.38, 0.02, this.palette.panel, false);
      breech.rotation.set(0.08, -0.12, 0.16);
      const fallenBarrel = this.addCylinder(root, 0.1, 0.13, 3.65, 8, 0.4, 0.27, 0.78, this.palette.bronze, false);
      fallenBarrel.rotation.set(Math.PI / 2 + 0.08, 0.18, 0.12);
    } else if (family === 'tracked-vehicle') {
      stain.scale.set(2.75, 1.75, 1);
      this.addBox(root, 2.7, 0.3, 1.48, 0, 0.16, 0, this.palette.graphiteDark, false).rotation.z = 0.05;
      this.addBox(root, 2.68, 0.16, 0.28, 0, 0.09, -0.69, this.palette.rubber, false);
      this.addBox(root, 2.68, 0.16, 0.28, 0, 0.09, 0.69, this.palette.rubber, false);
    } else if (family === 'building-rubble') {
      stain.scale.set(4.25, 3.2, 1);
      this.addBox(root, 3.15, 0.38, 2.3, -0.55, 0.2, 0.1, this.palette.graphiteDark, false).rotation.z = 0.08;
      this.addBox(root, 2.05, 0.48, 1.7, 1.05, 0.24, -0.48, this.palette.concrete, false).rotation.y = 0.32;
      this.addBox(root, 1.4, 0.32, 2.55, 0.22, 0.17, 0.92, this.palette.bronze, false).rotation.y = -0.46;
    } else {
      stain.scale.set(2.15, 1.45, 1);
      const debrisA = this.addBox(root, 1.45, 0.26, 0.9, -0.45, 0.14, 0.08, this.palette.graphiteDark, false);
      debrisA.rotation.set(0.08, 0.32, 0.12);
      const debrisB = this.addBox(root, 0.92, 0.2, 1.3, 0.62, 0.12, -0.18, this.palette.concrete, false);
      debrisB.rotation.set(-0.06, -0.42, -0.1);
    }
    const meshCount = root.children.filter((child) => child instanceof THREE.Mesh).length;
    root.userData.residueMeshCount = meshCount;
    root.userData.residueMeshBudget = GENERIC_DESTRUCTION_RESIDUE_POLICY.maxMeshesPerResidue;
    this.effectRoot.add(root);
    this.addEffect({
      root,
      age: 0,
      duration: genericDestructionResidueLifetime(this.renderQuality, this.reducedMotion),
      kind: 'residue',
      update: (progress) => {
        root.visible = progress < 0.985;
      },
    }, true);
    this.enforceAuthoredWreckBudget();
  }

  private entityHeight(entity: WorldEntity): number {
    if (entity.entityType === 'unit') return UNIT_HEIGHT[entity.kind];
    if (entity.entityType === 'building') return BUILDING_HEIGHT[entity.kind];
    return 3.5;
  }

  private addProjectile(
    start: Vec2,
    end: Vec2,
    startHeight: number,
    endHeight: number,
    speed: number,
    team: Team,
    artillery: boolean,
  ): void {
    const distance = Math.hypot(end.x - start.x, end.z - start.z);
    if (distance < 0.05) {
      this.addImpact(end, team, 0.7, 0.2, 'ballistic');
      return;
    }
    const duration = this.reducedMotion ? 0.08 : THREE.MathUtils.clamp(distance / speed, 0.16, 0.72);
    const root = new THREE.Group();
    root.position.set(start.x, startHeight, start.z);
    root.userData.projectileEffect = true;
    const projectile = this.addMesh(
      root,
      this.sphereGeometry(artillery ? 0.23 : 0.145, 10, 6),
      this.palette.muzzleCore,
      0,
      0,
      0,
      false,
    );
    const trailLength = artillery ? 1.55 : 0.96;
    const trail = this.addBox(
      root,
      artillery ? 0.14 : 0.09,
      artillery ? 0.14 : 0.09,
      trailLength,
      0,
      0,
      -trailLength * 0.46,
      this.palette.impact[team],
      false,
    );
    const crossTrail = this.addBox(
      root,
      artillery ? 0.42 : 0.22,
      0.035,
      trailLength * 0.92,
      0,
      0,
      -trailLength * 0.46,
      this.palette.muzzleFlame,
      false,
    );
    crossTrail.rotation.z = Math.PI / 2;
    const wake: THREE.Mesh[] = [];
    if (artillery && !this.reducedMotion) {
      for (let index = 0; index < 3; index += 1) {
        const puff = this.addMesh(
          root,
          this.sphereGeometry(0.22, 7, 5),
          this.palette.smoke,
          0,
          0,
          -0.9 - index * 0.5,
          false,
        );
        puff.scale.set(1 + index * 0.28, 0.55 + index * 0.12, 1 + index * 0.28);
        wake.push(puff);
      }
    }
    projectile.renderOrder = 12;
    trail.renderOrder = 11;
    this.effectRoot.add(root);
    const arc = this.reducedMotion ? 0 : artillery ? Math.max(2.5, distance * 0.28) : Math.min(0.9, distance * 0.05);
    const lookTarget = new THREE.Vector3();
    this.addEffect({
      root,
      age: 0,
      duration,
      kind: 'projectile',
      update: (progress) => {
        const x = THREE.MathUtils.lerp(start.x, end.x, progress);
        const y = THREE.MathUtils.lerp(startHeight, endHeight, progress) + Math.sin(progress * Math.PI) * arc;
        const z = THREE.MathUtils.lerp(start.z, end.z, progress);
        root.position.set(x, y, z);
        const lookProgress = Math.min(1, progress + 0.025);
        lookTarget.set(
          THREE.MathUtils.lerp(start.x, end.x, lookProgress),
          THREE.MathUtils.lerp(startHeight, endHeight, lookProgress) + Math.sin(lookProgress * Math.PI) * arc,
          THREE.MathUtils.lerp(start.z, end.z, lookProgress),
        );
        root.lookAt(lookTarget);
        trail.visible = !this.reducedMotion && progress < 0.94;
        crossTrail.visible = !this.reducedMotion && progress < 0.9;
        for (let index = 0; index < wake.length; index += 1) {
          const puff = wake[index];
          if (!puff) continue;
          const pulse = 0.9 + Math.sin((progress * 9 + index) * Math.PI) * 0.12;
          const baseScale = 1 + index * 0.28;
          puff.scale.set(baseScale * pulse, (0.55 + index * 0.12) * pulse, baseScale * pulse);
          puff.visible = progress < 0.84;
        }
      },
    });
  }

  private addMuzzleFlash(start: Vec2, end: Vec2, height: number, team: Team, heavy: boolean): void {
    const root = new THREE.Group();
    root.position.set(start.x, height, start.z);
    root.userData.muzzleEffect = true;
    root.lookAt(end.x, height, end.z);
    const scale = heavy ? 1.35 : 0.82;
    const core = this.addMesh(root, this.sphereGeometry(0.2, 10, 6), this.palette.muzzleCore, 0, 0, 0, false);
    const flame = this.addBox(root, 0.2, 0.2, 0.9, 0, 0, 0.42, this.palette.muzzleFlame, false);
    const teamGlint = this.addMesh(root, this.ringGeometry(0.18, 0.34, 16), this.palette.impact[team], 0, 0, 0.12, false);
    teamGlint.rotation.x = Math.PI / 2;
    this.effectRoot.add(root);
    this.addEffect({
      root,
      age: 0,
      duration: this.reducedMotion ? 0.06 : 0.16,
      kind: 'muzzle',
      update: (progress) => {
        const pulse = scale * (1.15 - progress * 0.65);
        core.scale.setScalar(pulse);
        flame.scale.set(1 + progress * 0.6, 1 + progress * 0.6, 1.25 - progress * 0.85);
        teamGlint.scale.setScalar(scale * (0.8 + progress * 1.25));
        flame.visible = !this.reducedMotion && progress < 0.72;
      },
    });
  }

  private addRepairToolBeam(start: Readonly<{ x: number; y: number; z: number }>, end: Vec2): void {
    const endHeight = 0.32;
    const dx = end.x - start.x;
    const dy = endHeight - start.y;
    const dz = end.z - start.z;
    const distance = Math.max(0.08, Math.hypot(dx, dy, dz));
    const root = new THREE.Group();
    root.userData.repairToolEffect = true;
    const beamRoot = new THREE.Group();
    beamRoot.position.set(start.x, start.y, start.z);
    beamRoot.lookAt(end.x, endHeight, end.z);
    root.add(beamRoot);
    const beam = this.addMesh(
      beamRoot,
      this.boxGeometry(0.09, 0.09, 1),
      this.palette.command.build,
      0,
      0,
      distance * 0.5,
      false,
    );
    beam.scale.z = distance;
    const toolGlint = this.addMesh(
      root,
      this.sphereGeometry(0.14, 8, 5),
      this.palette.muzzleCore,
      start.x,
      start.y,
      start.z,
      false,
    );
    const contact = this.addMesh(
      root,
      this.ringGeometry(0.16, 0.28, 16),
      this.palette.command.build,
      end.x,
      0.05,
      end.z,
      false,
    );
    contact.rotation.x = -Math.PI / 2;
    this.effectRoot.add(root);
    const staticEquivalent = this.reducedMotion || this.renderQuality === 'low';
    this.addEffect({
      root,
      age: 0,
      duration: staticEquivalent ? 0.16 : 0.3,
      kind: 'signal',
      update: (progress) => {
        if (staticEquivalent) return;
        const pulse = 0.82 + Math.sin(progress * Math.PI * 4) * 0.18;
        beam.scale.x = pulse;
        beam.scale.y = pulse;
        toolGlint.scale.setScalar(0.9 + progress * 0.45);
        contact.scale.setScalar(0.82 + progress * 0.65);
      },
    });
  }

  private addDepositTransfer(start: THREE.Vector3, end: THREE.Vector3, team: Team): void {
    const startPoint = { x: start.x, y: Math.max(0.08, start.y), z: start.z };
    const endPoint = { x: end.x, y: Math.max(0.08, end.y), z: end.z };
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const dz = endPoint.z - startPoint.z;
    const distance = Math.max(0.08, Math.hypot(dx, dy, dz));
    const staticEquivalent = this.reducedMotion || this.renderQuality === 'low';
    const root = new THREE.Group();
    root.name = 'deposit-socket-transfer';
    root.userData.depositSocketTransfer = true;
    root.userData.team = team;
    const conduit = new THREE.Group();
    conduit.position.set(startPoint.x, startPoint.y, startPoint.z);
    conduit.lookAt(endPoint.x, endPoint.y, endPoint.z);
    root.add(conduit);
    const beam = this.addMesh(
      conduit,
      this.boxGeometry(0.075, 0.075, 1),
      this.palette.impact[team],
      0,
      0,
      distance * 0.5,
      false,
    );
    beam.scale.z = distance;
    beam.renderOrder = 10;
    const beadCount = staticEquivalent ? 1 : this.renderQuality === 'high' ? 3 : 2;
    const beads: THREE.Mesh[] = [];
    for (let index = 0; index < beadCount; index += 1) {
      const bead = this.addMesh(
        root,
        this.octahedronGeometry(0.13),
        this.palette.crystal,
        0,
        0,
        0,
        false,
      );
      bead.renderOrder = 11;
      beads.push(bead);
    }
    const contact = this.addMesh(
      root,
      this.ringGeometry(0.18, 0.32, 18),
      this.palette.command.build,
      endPoint.x,
      Math.max(0.05, endPoint.y),
      endPoint.z,
      false,
    );
    contact.rotation.x = -Math.PI / 2;
    contact.renderOrder = 11;
    const positionBead = (bead: THREE.Mesh, t: number): void => {
      const clamped = THREE.MathUtils.clamp(t, 0, 1);
      bead.position.set(
        THREE.MathUtils.lerp(startPoint.x, endPoint.x, clamped),
        THREE.MathUtils.lerp(startPoint.y, endPoint.y, clamped)
          + (staticEquivalent ? 0 : Math.sin(clamped * Math.PI) * Math.min(1.1, distance * 0.18)),
        THREE.MathUtils.lerp(startPoint.z, endPoint.z, clamped),
      );
    };
    beads.forEach((bead, index) => positionBead(bead, staticEquivalent ? 0.5 : index / Math.max(1, beadCount)));
    this.effectRoot.add(root);
    this.addEffect({
      root,
      age: 0,
      duration: staticEquivalent ? 0.2 : 0.68,
      kind: 'economy-transfer',
      update: (progress) => {
        if (staticEquivalent) return;
        for (let index = 0; index < beads.length; index += 1) {
          const bead = beads[index];
          if (!bead) continue;
          const t = THREE.MathUtils.clamp(progress * 1.18 - index * 0.14, 0, 1);
          positionBead(bead, t);
          bead.rotation.y = progress * Math.PI * 4 + index;
          bead.visible = progress > index * 0.08 && t < 0.995;
        }
        beam.scale.x = 0.75 + Math.sin(progress * Math.PI * 5) * 0.18;
        beam.scale.y = beam.scale.x;
        contact.scale.setScalar(0.82 + progress * 0.72);
      },
    });
  }

  private addProductionExitCue(start: THREE.Vector3, end: Vec2, team: Team): void {
    const startPoint = { x: start.x, y: Math.max(0.08, start.y), z: start.z };
    const endPoint = { x: end.x, y: 0.16, z: end.z };
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const dz = endPoint.z - startPoint.z;
    const distance = Math.max(0.08, Math.hypot(dx, dy, dz));
    const staticEquivalent = this.reducedMotion || this.renderQuality === 'low';
    const root = new THREE.Group();
    root.name = 'production-socket-exit-cue';
    root.userData.productionSocketExit = true;
    root.userData.team = team;
    const guideRoot = new THREE.Group();
    guideRoot.position.set(startPoint.x, startPoint.y, startPoint.z);
    guideRoot.lookAt(endPoint.x, endPoint.y, endPoint.z);
    root.add(guideRoot);
    const guide = this.addMesh(
      guideRoot,
      this.boxGeometry(0.11, 0.045, 1),
      this.palette.impact[team],
      0,
      0,
      distance * 0.5,
      false,
    );
    guide.scale.z = distance;
    guide.renderOrder = 10;
    const marker = this.addMesh(
      root,
      this.sphereGeometry(0.16, 8, 5),
      this.palette.impact[team],
      startPoint.x,
      startPoint.y,
      startPoint.z,
      false,
    );
    marker.renderOrder = 11;
    const exitRing = this.addMesh(
      root,
      this.ringGeometry(0.28, 0.48, 20),
      this.palette.impact[team],
      endPoint.x,
      0.06,
      endPoint.z,
      false,
    );
    exitRing.rotation.x = -Math.PI / 2;
    exitRing.renderOrder = 11;
    this.effectRoot.add(root);
    this.addEffect({
      root,
      age: 0,
      duration: staticEquivalent ? 0.2 : 0.62,
      kind: 'signal',
      update: (progress) => {
        if (staticEquivalent) return;
        marker.position.set(
          THREE.MathUtils.lerp(startPoint.x, endPoint.x, progress),
          THREE.MathUtils.lerp(startPoint.y, endPoint.y, progress) + Math.sin(progress * Math.PI) * 0.36,
          THREE.MathUtils.lerp(startPoint.z, endPoint.z, progress),
        );
        marker.scale.setScalar(0.82 + Math.sin(progress * Math.PI) * 0.52);
        guide.scale.x = 0.78 + Math.sin(progress * Math.PI * 4) * 0.16;
        exitRing.scale.setScalar(0.82 + progress * 0.9);
      },
    });
  }

  private addImpact(
    position: Vec2,
    team: Team,
    size: number,
    duration: number,
    kind: ImpactVisualKind,
  ): void {
    const root = new THREE.Group();
    root.position.set(position.x, 0.09, position.z);
    root.userData.impactEffect = true;
    root.userData.impactKind = kind;
    const heavy = kind === 'heavy';
    if (heavy) root.userData.combatVfxVersion = COMBAT_VFX_READABILITY_V2.version;
    const ring = this.addMesh(root, this.ringGeometry(0.55, 1, 32), this.palette.impact[team], 0, 0, 0, false);
    ring.rotation.x = -Math.PI / 2;
    const flash = this.addMesh(root, this.sphereGeometry(0.45, 12, 8), this.palette.muzzleCore, 0, 0.42, 0, false);
    const fire = this.addMesh(root, this.sphereGeometry(0.34, 10, 6), this.palette.fire, 0, 0.32, 0, false);
    const groundFlash = this.addMesh(root, this.circleGeometry(0.72, 24), this.palette.muzzleFlame, 0, 0.015, 0, false);
    groundFlash.rotation.x = -Math.PI / 2;
    const shockRing = heavy
      ? this.addMesh(root, this.ringGeometry(0.82, 1, 40), this.palette.heavyShockwave, 0, 0.12, 0, false)
      : null;
    if (shockRing) shockRing.rotation.x = -Math.PI / 2;
    const blastDust = heavy && !this.reducedMotion
      ? this.addMesh(root, this.sphereGeometry(0.52, 10, 6), this.palette.dust, 0, 0.28, 0, false)
      : null;
    const blastUpper = heavy && !this.reducedMotion && this.renderQuality !== 'low'
      ? this.addMesh(root, this.sphereGeometry(0.42, 10, 7), this.palette.muzzleFlame, 0, 0.76, 0, false)
      : null;
    const sparkCount = this.reducedMotion ? 0 : this.renderQuality === 'high' ? 5 : this.renderQuality === 'medium' ? 3 : 2;
    const sparks: Array<{ mesh: THREE.Mesh; angle: number; lift: number }> = [];
    for (let index = 0; index < sparkCount; index += 1) {
      const hash = stableHash(`impact:${position.x.toFixed(2)}:${position.z.toFixed(2)}:${index}`);
      const angle = (index / sparkCount) * Math.PI * 2 + (hash % 41) / 100;
      const spark = this.addBox(root, 0.045, 0.045, 0.72, 0, 0.24, 0, this.palette.spark, false);
      spark.rotation.y = angle;
      sparks.push({ mesh: spark, angle, lift: 0.42 + ((hash >>> 8) % 45) / 100 });
    }
    const chips: Array<{ mesh: THREE.Mesh; angle: number; lift: number; distance: number }> = [];
    const chipCount = heavy && !this.reducedMotion
      ? this.renderQuality === 'high' ? 5 : this.renderQuality === 'medium' ? 3 : 0
      : 0;
    for (let index = 0; index < chipCount; index += 1) {
      const hash = stableHash(`impact-chip:${position.x.toFixed(2)}:${position.z.toFixed(2)}:${index}`);
      const angle = (index / chipCount) * Math.PI * 2 + (hash % 53) / 100;
      const chip = this.addBox(
        root,
        0.12 + ((hash >>> 6) % 8) / 100,
        0.08,
        0.25 + ((hash >>> 10) % 12) / 100,
        0,
        0.1,
        0,
        index % 2 === 0 ? this.palette.graphiteDark : this.palette.earth,
        false,
      );
      chips.push({
        mesh: chip,
        angle,
        lift: 0.6 + ((hash >>> 14) % 45) / 100,
        distance: 0.8 + ((hash >>> 18) % 55) / 100,
      });
    }
    this.effectRoot.add(root);
    const effectDuration = resolvedImpactVfxDuration(kind, duration, this.reducedMotion);
    const layerMetrics = impactVfxLayerMetrics(kind, size, 0);
    this.addEffect({
      root,
      age: 0,
      duration: effectDuration,
      kind: heavy ? 'heavy-explosion' : 'ballistic-impact',
      update: (progress) => {
        impactVfxLayerMetrics(kind, size, progress, layerMetrics);
        ring.scale.setScalar(layerMetrics.ringRadius);
        flash.scale.setScalar(layerMetrics.flashScale);
        fire.scale.setScalar(layerMetrics.fireScale);
        groundFlash.scale.setScalar(layerMetrics.groundFlashScale);
        groundFlash.visible = progress < (heavy ? 0.38 : 0.42);
        if (shockRing) {
          shockRing.scale.setScalar(layerMetrics.shockwaveRadius);
          shockRing.visible = progress < 0.62;
        }
        if (blastDust) {
          blastDust.scale.set(size * (0.72 + progress * 0.9), size * (0.2 + progress * 0.34), size * (0.72 + progress * 0.9));
          blastDust.position.y = 0.2 + progress * size * 0.32;
          blastDust.visible = progress < 0.78;
        }
        if (blastUpper) {
          blastUpper.position.y = layerMetrics.blastUpperCenterY;
          blastUpper.scale.set(
            layerMetrics.blastUpperScaleXZ,
            layerMetrics.blastUpperScaleY,
            layerMetrics.blastUpperScaleXZ,
          );
          blastUpper.visible = progress < 0.52;
        }
        flash.visible = progress < (heavy ? 0.42 : 0.48);
        fire.visible = progress < (heavy ? 0.62 : 0.68);
        for (const spark of sparks) {
          const distance = size * progress * 1.4;
          spark.mesh.position.set(
            Math.cos(spark.angle) * distance,
            0.18 + Math.sin(progress * Math.PI) * size * spark.lift,
            Math.sin(spark.angle) * distance,
          );
          spark.mesh.visible = progress < 0.78;
        }
        for (const chip of chips) {
          const travel = size * progress * chip.distance;
          chip.mesh.position.set(
            Math.cos(chip.angle) * travel,
            0.08 + Math.sin(progress * Math.PI) * size * chip.lift,
            Math.sin(chip.angle) * travel,
          );
          chip.mesh.rotation.set(progress * 8, chip.angle, progress * 5.5);
          chip.mesh.visible = progress < 0.88;
        }
      },
    });
  }

  private addScorchMark(position: Vec2, size: number): void {
    const mark = this.addMesh(
      this.effectRoot,
      this.circleGeometry(1, 24),
      this.palette.scorch,
      position.x,
      0.045,
      position.z,
      false,
    );
    mark.rotation.x = -Math.PI / 2;
    const variation = 0.82 + (stableHash(`${position.x.toFixed(2)}:${position.z.toFixed(2)}:scorch`) % 31) / 100;
    mark.scale.set(size * variation, size * (1.12 - (variation - 0.82) * 0.5), 1);
    mark.renderOrder = 3;
    this.addEffect({
      root: mark,
      age: 0,
      duration: this.reducedMotion ? 18 : 28,
      kind: 'scorch',
      update: () => undefined,
    }, true);
  }

  private addSmokePlume(position: Vec2, size: number): void {
    const root = new THREE.Group();
    root.position.set(position.x, 0.18, position.z);
    root.userData.smokeEffect = true;
    const puffCount = this.reducedMotion ? 1 : this.renderQuality === 'high' ? 5 : this.renderQuality === 'medium' ? 3 : 2;
    const puffs: THREE.Mesh[] = [];
    for (let index = 0; index < puffCount; index += 1) {
      const angle = (index / Math.max(1, puffCount)) * Math.PI * 2;
      const puff = this.addMesh(
        root,
        this.sphereGeometry(0.55, 8, 5),
        this.palette.smoke,
        Math.cos(angle) * size * 0.18,
        index * size * 0.13,
        Math.sin(angle) * size * 0.18,
        false,
      );
      puff.scale.setScalar(size * (0.44 + index * 0.08));
      puffs.push(puff);
    }
    const ember = this.addMesh(root, this.sphereGeometry(0.38, 10, 6), this.palette.fire, 0, 0.18, 0, false);
    ember.scale.setScalar(size * 0.72);
    this.effectRoot.add(root);
    this.addEffect({
      root,
      age: 0,
      duration: this.reducedMotion ? 0.28 : 1.35,
      kind: 'smoke',
      update: (progress) => {
        if (!this.reducedMotion) root.position.y = 0.18 + progress * size * 1.15;
        const spread = 1 + progress * 0.9;
        root.scale.set(spread, 0.9 + progress * 0.75, spread);
        ember.visible = !this.reducedMotion && progress < 0.3;
        for (let index = 0; index < puffs.length; index += 1) {
          const puff = puffs[index];
          if (puff) puff.position.y = index * size * 0.13 + progress * size * (0.22 + index * 0.03);
        }
        root.visible = progress < 0.92;
      },
    });
  }

  private addDustPuff(position: THREE.Vector3, size = 1): void {
    const profile = RENDER_QUALITY_PROFILES[this.renderQuality];
    if (!profile.movementDust || this.reducedMotion || this.viewHeight > profile.vegetationViewHeight) return;
    const puff = this.dustPuffPool.pop() ?? new THREE.Mesh(this.sphereGeometry(0.48, 8, 5), this.palette.dust);
    puff.userData.recycleDustPuff = true;
    puff.position.set(position.x, 0.12, position.z);
    puff.visible = true;
    puff.castShadow = false;
    puff.receiveShadow = false;
    this.effectRoot.add(puff);
    puff.scale.set(0.9 * size, 0.28 * size, 0.9 * size);
    this.addEffect({
      root: puff,
      age: 0,
      duration: 0.72,
      kind: 'dust',
      update: (progress) => {
        const spread = 0.9 + progress * 1.8;
        puff.position.y = 0.12 + progress * 0.38;
        puff.scale.set(spread * size, (0.28 + progress * 0.55) * size, spread * size);
        puff.visible = progress < 0.82;
      },
    }, true);
  }

  private addPulse(position: Vec2, material: THREE.Material, size: number, duration: number): void {
    const ring = this.addMesh(this.effectRoot, this.ringGeometry(0.7, 1, 32), material, position.x, 0.085, position.z, false);
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = 10;
    this.addEffect({
      root: ring,
      age: 0,
      duration,
      kind: 'signal',
      update: (progress) => {
        const scale = size * (0.75 + progress * 1.15);
        ring.scale.setScalar(scale);
        ring.visible = progress < 0.86 || Math.floor(progress * 18) % 2 === 0;
      },
    });
  }

  private addEffect(effect: ActiveEffect, decorative = false): void {
    effect.root.userData.decorativeEffect = decorative;
    effect.root.userData.vfxKind = effect.kind;
    this.effects.push(effect);
    this.enforceEffectBudgets();
  }

  private enforceEffectBudgets(): void {
    const survivorIndices = new Set(effectBudgetSurvivorIndices(
      this.effects.map((effect) => ({
        kind: effect.kind,
        decorative: effect.root.userData.decorativeEffect === true,
      })),
      this.renderQuality,
      this.reducedMotion,
    ));
    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      if (!survivorIndices.has(index)) this.removeEffectAt(index);
    }
  }

  private removeEffectAt(index: number): void {
    const [effect] = this.effects.splice(index, 1);
    if (!effect) return;
    this.effectRoot.remove(effect.root);
    if (effect.root instanceof THREE.Mesh && effect.root.userData.recycleDustPuff === true && this.dustPuffPool.length < 24) {
      effect.root.visible = false;
      this.dustPuffPool.push(effect.root);
    }
  }

  private updateMovementDust(entityId: string, visual: EntityVisual): void {
    if (visual.root.userData.vehicleDust !== true) return;
    let tracker = this.dustTrackers.get(entityId);
    if (!tracker) {
      tracker = { last: visual.root.position.clone(), distance: 0 };
      this.dustTrackers.set(entityId, tracker);
      return;
    }
    const moved = visual.root.position.distanceTo(tracker.last);
    tracker.last.copy(visual.root.position);
    if (this.reducedMotion || moved > 6) {
      tracker.distance = 0;
      return;
    }
    tracker.distance += moved;
    const dustSpacing = this.renderQuality === 'high' ? 2.05 : 2.45;
    if (tracker.distance < dustSpacing) return;
    tracker.distance %= dustSpacing;
    const yaw = visual.body.rotation.y;
    const rearDistance = Math.min(1.35, visual.pickRadius * 0.48);
    const sideDistance = Math.min(0.82, visual.pickRadius * 0.32);
    const forwardX = Math.sin(yaw);
    const forwardZ = Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);
    for (const side of [-1, 1]) {
      const position = new THREE.Vector3(
        visual.root.position.x - forwardX * rearDistance + rightX * sideDistance * side,
        0,
        visual.root.position.z - forwardZ * rearDistance + rightZ * sideDistance * side,
      );
      this.addDustPuff(position, 0.72);
    }
  }

  private updatePresentationViewBounds(): void {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    this.camera.updateMatrixWorld(true);
    for (const [x, y] of PRESENTATION_VIEW_CORNERS) {
      this.lodNdc.set(x, y);
      this.raycaster.setFromCamera(this.lodNdc, this.camera);
      if (!this.raycaster.ray.intersectPlane(this.groundPlane, this.lodGroundHit)) continue;
      minX = Math.min(minX, this.lodGroundHit.x);
      maxX = Math.max(maxX, this.lodGroundHit.x);
      minZ = Math.min(minZ, this.lodGroundHit.z);
      maxZ = Math.max(maxZ, this.lodGroundHit.z);
    }
    if (![minX, maxX, minZ, maxZ].every(Number.isFinite)) {
      const half = this.viewHeight;
      minX = this.cameraTarget.x - half;
      maxX = this.cameraTarget.x + half;
      minZ = this.cameraTarget.z - half;
      maxZ = this.cameraTarget.z + half;
    }
    this.lodViewBounds.minX = minX;
    this.lodViewBounds.maxX = maxX;
    this.lodViewBounds.minZ = minZ;
    this.lodViewBounds.maxZ = maxZ;
  }

  private applyPresentationLod(visual: EntityVisual, tier: PresentationLodTier): void {
    if (visual.lodTier !== tier) this.lodSwitches += 1;
    visual.lodTier = tier;
    visual.lodGeometryTier = resolveAvailablePresentationLod(tier, PRESENTATION_GEOMETRY_TIERS);
    visual.root.visible = tier !== 'culled';
    const fullDetail = tier === 'lod0';
    for (const detail of visual.lodDetailNodes) detail.node.visible = fullDetail && detail.visible;
    const buildingDamageVisibility = authoredBuildingDamageVisibility(
      visual.damageVisual?.stage ?? 'none',
    );
    for (const role of ['damaged', 'critical'] as const) {
      const damageRoot = visual.authoredBuildingDamageRoots[role];
      if (damageRoot) damageRoot.visible = buildingDamageVisibility[role];
    }
    if (visual.authoredWreckAge >= 0) {
      for (const live of visual.authoredWreckLiveNodes) live.node.visible = false;
      if (visual.authoredWreckRoot) visual.authoredWreckRoot.visible = true;
    }
    if (visual.authoredBuildingRuinAge >= 0) {
      for (const live of visual.authoredBuildingRuinLiveNodes) live.node.visible = false;
      for (const role of ['damaged', 'critical'] as const) {
        const damageRoot = visual.authoredBuildingDamageRoots[role];
        if (damageRoot) damageRoot.visible = false;
      }
      if (visual.authoredBuildingRuinRoot) visual.authoredBuildingRuinRoot.visible = true;
    }
    const castDynamicShadow = fullDetail && RENDER_QUALITY_PROFILES[this.renderQuality].shadows;
    for (const caster of visual.lodShadowCasters) {
      caster.node.castShadow = castDynamicShadow && caster.castShadow;
    }
  }

  private updatePresentation(delta: number, time: number): void {
    this.presentationFrame += 1;
    this.updatePresentationViewBounds();
    const positionBlend = this.reducedMotion ? 1 : 1 - Math.exp(-delta * 18);
    const rotationBlend = this.reducedMotion ? 1 : 1 - Math.exp(-delta * 20);
    for (const [entityId, visual] of this.entityVisuals) {
      const planarDistance = Math.hypot(
        visual.root.position.x - this.cameraTarget.x,
        visual.root.position.z - this.cameraTarget.z,
      );
      const forceLod0 = visual.selected
        || visual.recoilAmount > 0.001
        || visual.hitAmount > 0.001
        || visual.productionKey !== ''
        || time < visual.productionExitUntil
        || time < visual.refineryUnloadUntil
        || visual.constructionActive
        || (
          visual.destructionAge >= 0
          && visual.authoredWreckAge < 0
          && visual.authoredBuildingRuinAge < 0
        );
      const tier = selectPresentationLodTier({
        projectedHeightPx: orthographicProjectedHeightPx(visual.height, this.viewHeight, this.viewportHeight),
        planarDistance,
        insideExpandedView: isInsideExpandedFlatView(
          visual.root.position,
          this.lodViewBounds,
          PRESENTATION_LOD_VIEW_MARGIN,
          visual.pickRadius,
        ),
        previousTier: visual.lodTier,
        forceLod0,
      }, PRESENTATION_LOD_THRESHOLDS[this.renderQuality]);
      this.applyPresentationLod(visual, tier);
      const updateSecondaryPresentation = shouldUpdatePresentationOnFrame(
        tier,
        this.presentationFrame,
        visual.lodPhase,
      );
      visual.lodAnimatedThisFrame = updateSecondaryPresentation
        && (visual.animationMixer !== null
          || visual.animatedNodes.length > 0
          || (
            !this.reducedMotion
            && time < visual.refineryUnloadUntil
            && hasCompleteRefineryMechanism(visual.refineryMechanismParts.map((part) => part.role))
          ));
      visual.lodAnimationDelta = tier === 'culled'
        ? 0
        : Math.min(0.25, visual.lodAnimationDelta + delta);
      const secondaryDelta = updateSecondaryPresentation ? visual.lodAnimationDelta : 0;
      const remainingDistance = visual.root.position.distanceTo(visual.targetPosition);
      const motionTarget = visual.entityType === 'unit' && remainingDistance > 0.035 ? 1 : 0;
      const motionBlend = this.reducedMotion ? 1 : 1 - Math.exp(-delta * 10);
      visual.motionAmount += (motionTarget - visual.motionAmount) * motionBlend;
      visual.activityAmount += (visual.activityTarget - visual.activityAmount) * motionBlend;
      visual.doorOpenAmount += (visual.doorOpenTarget - visual.doorOpenAmount) * motionBlend;
      visual.root.position.lerp(visual.targetPosition, positionBlend);
      this.updateMovementDust(entityId, visual);
      visual.body.position.x = visual.bodyBaseX;
      visual.body.position.z = visual.bodyBaseZ;
      if (visual.turretPivot && visual.turretBasePosition) {
        visual.turretPivot.position.copy(visual.turretBasePosition);
      }
      visual.body.rotation.y += shortestAngleDelta(visual.body.rotation.y, visual.targetRotation) * rotationBlend;
      if (visual.turretPivot) {
        const localAimRotation = visual.targetAimRotation - visual.body.rotation.y;
        visual.turretPivot.rotation.y += shortestAngleDelta(visual.turretPivot.rotation.y, localAimRotation) * rotationBlend;
      }
      if (visual.unitKind) {
        const infantry = visual.infantryParts.length > 0 || visual.animationMixer !== null;
        const strideFrequency = infantry ? 9.2 : 5.4;
        const stride = Math.sin(time * strideFrequency + visual.motionPhase);
        const motion = this.reducedMotion ? 0 : visual.motionAmount;
        if (visual.animationMixer) {
          if (updateSecondaryPresentation) {
            visual.body.position.y = visual.bodyBaseY;
            visual.body.rotation.x = visual.bodyBaseRotationX;
            visual.body.rotation.z = visual.bodyBaseRotationZ;
            const animationName = visual.destructionAge >= 0 && visual.authoredWreckAge < 0
              ? 'death'
              : visual.hitAmount > 0.12
                ? 'hit'
                : visual.recoilAmount > 0.12
                  ? 'fire'
                  : visual.motionAmount > 0.18
                    ? 'run'
                    : visual.activityAmount > 0.12
                      ? 'aim'
                      : 'idle';
            this.transitionRigAnimation(visual, animationName);
            visual.animationMixer.timeScale = this.reducedMotion ? 0 : 1;
            visual.animationMixer.update(secondaryDelta);
          }
        } else {
          visual.body.position.y = visual.bodyBaseY + Math.abs(stride) * motion * (infantry ? 0.055 : 0.026);
          visual.body.rotation.x = visual.bodyBaseRotationX + stride * motion * (infantry ? 0.022 : 0.009);
          visual.body.rotation.z = visual.bodyBaseRotationZ + Math.cos(time * strideFrequency * 0.5 + visual.motionPhase) * motion * (infantry ? 0.035 : 0.012);
        }
        if (!this.reducedMotion && motion > 0.01) {
          for (const node of visual.locomotionNodes) node.rotation.x += delta * (7.5 + visual.motionAmount * 4.5);
        }
        if (!visual.animationMixer) {
          visual.infantryParts.forEach((part, index) => {
            const phase = time * strideFrequency + visual.motionPhase + index * 2.1;
            part.node.position.copy(part.position);
            part.node.rotation.copy(part.rotation);
            if (motion <= 0) return;
            part.node.position.y += Math.abs(Math.sin(phase)) * 0.075 * motion;
            part.node.rotation.z += Math.sin(phase) * 0.055 * motion;
          });
        }
      }
      const activityPulse = this.reducedMotion ? 0 : Math.sin(time * 6.2 + visual.motionPhase);
      for (const part of visual.activityParts) {
        part.node.position.copy(part.position);
        part.node.scale.copy(part.scale);
        if (part.node.name === 'factory_door' || part.node.name === 'barracks_door') {
          const travel = part.node.name === 'factory_door' ? 2.25 : 1.75;
          part.node.position.y += visual.doorOpenAmount * travel;
        } else if (visual.activityAmount > 0.01) {
          const scale = 1 + visual.activityAmount * (0.08 + activityPulse * 0.035);
          part.node.scale.set(part.scale.x * scale, part.scale.y * scale, part.scale.z * scale);
        }
      }
      const refineryUnload = refineryUnloadPresentation(
        time,
        visual.refineryUnloadStartedAt,
        visual.refineryUnloadUntil,
        this.reducedMotion,
      );
      const animateRefineryMechanism = !this.reducedMotion && this.renderQuality !== 'low';
      if (animateRefineryMechanism && refineryUnload.mechanism > 0.001) {
        visual.refineryMechanismPhase = (
          visual.refineryMechanismPhase + delta * 5.2 * refineryUnload.mechanism
        ) % (Math.PI * 2);
      }
      for (const part of visual.refineryMechanismParts) {
        part.node.position.copy(part.position);
        part.node.rotation.copy(part.rotation);
        part.node.scale.copy(part.scale);
        if (part.role === 'gate') {
          part.node.position.y += refineryUnload.gate * 1.45;
        } else if (
          part.role === 'conveyor'
          && animateRefineryMechanism
          && refineryUnload.mechanism > 0.001
        ) {
          part.node.position.z -= (visual.refineryMechanismPhase / (Math.PI * 2)) * 0.45;
        } else if (
          part.role === 'collector'
          && animateRefineryMechanism
          && refineryUnload.mechanism > 0.001
        ) {
          part.node.rotation.x += visual.refineryMechanismPhase;
        }
      }
      if (visual.damageVisual?.root.visible) {
        const damage = visual.damageVisual;
        const ratio = damage.ratio;
        const severity = 1 - ratio;
        damage.smokeA.position.y = 0.12 + (this.reducedMotion ? 0 : (Math.sin(time * 1.35) + 1) * 0.18);
        damage.smokeA.scale.setScalar(0.85 + severity * (damage.building ? 0.82 : 0.55));
        damage.smokeB.position.y = 0.58 + (this.reducedMotion ? 0 : (Math.cos(time * 1.1) + 1) * 0.22);
        damage.smokeB.scale.setScalar(0.72 + severity * (damage.building ? 0.74 : 0.5));
        damage.ember.visible = damage.stage === 'critical'
          && (this.reducedMotion || Math.sin(time * 9.5 + visual.motionPhase) > -0.35);
        damage.ember.scale.setScalar(0.8 + severity * (damage.building ? 1.15 : 0.7));
        const markerPulse = this.reducedMotion ? 1 : 0.88 + Math.sin(time * 5.2 + visual.motionPhase) * 0.12;
        damage.criticalMarker.scale.setScalar(markerPulse * (damage.building ? 1.25 : 0.88));
      }
      if (visual.recoilAmount > 0.001) {
        const recoil = this.reducedMotion ? 0 : visual.recoilAmount * visual.recoilStrength;
        if (visual.turretPivot && visual.turretBasePosition) {
          visual.turretPivot.position.z = visual.turretBasePosition.z - recoil * 0.32;
        } else {
          visual.body.position.z = visual.bodyBaseZ - recoil * 0.12;
        }
        visual.body.rotation.x -= recoil * (visual.unitKind ? 0.026 : 0.012);
        visual.recoilAmount = Math.max(0, visual.recoilAmount - delta * (visual.recoilStrength >= 0.9 ? 3.8 : 6.4));
        if (visual.recoilAmount <= 0.001) visual.recoilStrength = 0;
      }
      if (visual.hitAmount > 0.001) {
        const yaw = visual.body.rotation.y;
        const localX = visual.hitDirectionX * Math.cos(yaw) - visual.hitDirectionZ * Math.sin(yaw);
        const localZ = visual.hitDirectionX * Math.sin(yaw) + visual.hitDirectionZ * Math.cos(yaw);
        const infantry = visual.infantryParts.length > 0;
        const hit = this.reducedMotion
          ? 0
          : visual.hitAmount * visual.hitStrength * (0.72 + Math.sin(time * 42 + visual.motionPhase) * 0.28);
        visual.body.position.x += localX * hit * (infantry ? 0.16 : 0.095);
        visual.body.position.z += localZ * hit * (infantry ? 0.12 : 0.075);
        visual.body.position.y += hit * (infantry ? 0.075 : 0.035);
        visual.body.rotation.z += localX * hit * (infantry ? 0.13 : 0.055);
        visual.body.rotation.x -= localZ * hit * (infantry ? 0.09 : 0.045);
        visual.hitAmount *= Math.exp(-delta * (infantry ? 9.5 : 12));
        if (visual.hitAmount <= 0.001) visual.hitStrength = 0;
      }
      if (visual.authoredWreckAge >= 0) {
        visual.authoredWreckAge += delta;
        if (visual.authoredWreckAge >= visual.authoredWreckDuration) {
          this.removeEntityVisual(entityId, visual);
          continue;
        }
      } else if (visual.authoredBuildingRuinAge >= 0) {
        visual.authoredBuildingRuinAge += delta;
        if (visual.authoredBuildingRuinAge >= visual.authoredBuildingRuinDuration) {
          this.removeEntityVisual(entityId, visual);
          continue;
        }
      } else if (visual.destructionAge >= 0) {
        visual.destructionAge += delta;
        const progress = THREE.MathUtils.clamp(visual.destructionAge / Math.max(0.001, visual.destructionDuration), 0, 1);
        const collapse = 1 - Math.pow(1 - progress, 3);
        if (visual.entityType === 'building') {
          visual.body.scale.x *= 1 + collapse * 0.035;
          visual.body.scale.y *= 1 - collapse * 0.82;
          visual.body.scale.z *= 1 + collapse * 0.035;
          visual.body.position.y -= collapse * visual.height * 0.09;
          visual.body.rotation.z += visual.destructionDirection * collapse * 0.08;
        } else if (!visual.animationMixer) {
          visual.body.position.y -= collapse * 0.18;
          visual.body.rotation.z += visual.destructionDirection * collapse * (visual.infantryParts.length > 0 ? 1.18 : 0.72);
          visual.body.rotation.x += collapse * 0.16;
        }
        if (progress >= 1) {
          const activated = visual.entityType === 'building'
            ? this.activateAuthoredBuildingRuin(entityId, visual)
            : this.activateAuthoredWreck(entityId, visual);
          if (!activated) {
            if (visual.destructionResiduePosition) {
              this.addDestroyedResidue(
                visual.destructionResiduePosition,
                destructionResidueFamilyForKind(visual.unitKind, visual.buildingKind),
                entityId,
              );
              if (
                visual.buildingKind
                && AUTHORED_BUILDING_RUIN_KINDS.has(visual.buildingKind)
              ) this.authoredBuildingRuinFallbacks += 1;
              if (
                visual.unitKind
                && AUTHORED_VEHICLE_WRECK_KINDS.has(visual.unitKind)
              ) this.authoredWreckFallbacks += 1;
              visual.destructionResiduePosition = null;
            }
            this.removeEntityVisual(entityId, visual);
            continue;
          }
        }
      }
      visual.healthBar?.group.quaternion.copy(this.camera.quaternion);
      if (
        !this.reducedMotion
        && updateSecondaryPresentation
        && visual.authoredWreckAge < 0
        && visual.authoredBuildingRuinAge < 0
      ) {
        for (const node of visual.animatedNodes) {
          const activityFactor = node.userData.activityOnly === true ? visual.activityAmount : 1;
          const rotation = Number(node.userData.spinSpeed) * secondaryDelta * activityFactor;
          if (node.userData.spinAxis === 'x') node.rotation.x += rotation;
          else if (node.userData.spinAxis === 'z') node.rotation.z += rotation;
          else node.rotation.y += rotation;
        }
      }
      if (updateSecondaryPresentation) visual.lodAnimationDelta = 0;
    }

    // Entity interpolation and LOD visibility are final before shared dynamic matrices are written.
    this.updateHealthBarBatch();
    this.updateConstructionPresentationBatches(time);
    this.updateFactionMarkerBatch();
    this.updateContactShadowBatch();
    this.updateCompactSelectionBatch();

    if (!this.reducedMotion && this.beaconVisual.signal.visible) {
      this.beaconVisual.signal.rotation.y += delta * 1.4;
      const pulse = 0.9 + Math.sin(time * 3.2) * 0.1;
      this.beaconVisual.signal.scale.setScalar(pulse);
    } else {
      this.beaconVisual.signal.scale.setScalar(1);
    }

    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      const effect = this.effects[index];
      if (!effect) continue;
      effect.age += delta;
      const progress = THREE.MathUtils.clamp(effect.age / effect.duration, 0, 1);
      effect.update(progress, effect.age);
      if (effect.age >= effect.duration) {
        this.removeEffectAt(index);
      }
    }
  }

  private updateDevelopmentRenderMetrics(): void {
    if (!import.meta.env.DEV) return;
    this.renderMetricFrame += 1;
    if (this.renderMetricFrame % 60 !== 0) return;
    const { render, memory } = this.renderer.info;
    const canvas = this.renderer.domElement;
    canvas.dataset.renderFrame = String(this.renderMetricFrame);
    canvas.dataset.renderCalls = String(render.calls);
    canvas.dataset.renderTriangles = String(render.triangles);
    canvas.dataset.renderGeometries = String(memory.geometries);
    canvas.dataset.renderTextures = String(memory.textures);
    canvas.dataset.activeEffects = String(this.effects.length);
    canvas.dataset.renderQuality = this.renderQuality;
    canvas.dataset.renderPixelRatio = String(this.renderer.getPixelRatio());
    canvas.dataset.renderShadows = String(this.renderer.shadowMap.enabled);
    const visuals = [...this.entityVisuals.values()];
    canvas.dataset.lod0 = String(visuals.filter((visual) => visual.lodTier === 'lod0').length);
    canvas.dataset.lod1 = String(visuals.filter((visual) => visual.lodTier === 'lod1').length);
    canvas.dataset.lod2 = String(visuals.filter((visual) => visual.lodTier === 'lod2').length);
    canvas.dataset.lodCulled = String(visuals.filter((visual) => visual.lodTier === 'culled').length);
    canvas.dataset.lodAnimated = String(visuals.filter((visual) => visual.lodAnimatedThisFrame).length);
    canvas.dataset.lodShadowCaster = String(visuals.reduce(
      (total, visual) => total + visual.lodShadowCasters.filter((caster) => caster.node.castShadow).length,
      0,
    ));
    canvas.dataset.lodSwitches = String(this.lodSwitches);
    canvas.dataset.lod0Count = canvas.dataset.lod0;
    canvas.dataset.lod1Count = canvas.dataset.lod1;
    canvas.dataset.lod2Count = canvas.dataset.lod2;
    canvas.dataset.lodCulledCount = canvas.dataset.lodCulled;
    canvas.dataset.lodAnimatedCount = canvas.dataset.lodAnimated;
    canvas.dataset.lodShadowCasterCount = canvas.dataset.lodShadowCaster;
    canvas.dataset.presentationMoving = String(visuals.filter((visual) => visual.motionAmount > 0.12).length);
    canvas.dataset.presentationActive = String(visuals.filter((visual) => visual.activityAmount > 0.12).length);
    const constructingVisuals = visuals.filter((visual) => (
      visual.constructionVisual !== null && visual.constructionVisual.stage !== 'complete'
    ));
    canvas.dataset.presentationConstructing = String(constructingVisuals.length);
    canvas.dataset.presentationActiveConstructionScans = String(visuals.filter((visual) => visual.constructionActive).length);
    canvas.dataset.constructionPresentationVersion = CONSTRUCTION_PRESENTATION_POLICY.version;
    canvas.dataset.presentationConstructionFoundation = String(constructingVisuals.filter((visual) =>
      visual.constructionVisual?.stage === 'foundation').length);
    canvas.dataset.presentationConstructionFrame = String(constructingVisuals.filter((visual) =>
      visual.constructionVisual?.stage === 'frame').length);
    canvas.dataset.presentationConstructionShell = String(constructingVisuals.filter((visual) =>
      visual.constructionVisual?.stage === 'shell').length);
    canvas.dataset.presentationConstructionNaturalScale = String(constructingVisuals.filter((visual) =>
      Math.abs(visual.body.scale.y - 1) < 0.000001).length);
    canvas.dataset.constructionBatchCalls = String([
      this.constructionFoundationCount,
      this.constructionFrameCount,
      this.constructionShellCount,
      this.constructionScanCount,
    ].filter((count) => count > 0).length);
    canvas.dataset.constructionBatchInstances = String(
      this.constructionFoundationCount
      + this.constructionFrameCount
      + this.constructionShellCount
      + this.constructionScanCount,
    );
    canvas.dataset.constructionBatchTriangles = String((
      this.constructionFoundationCount
      + this.constructionFrameCount
      + this.constructionShellCount
      + this.constructionScanCount
    ) * 12);
    canvas.dataset.constructionTextures = String(CONSTRUCTION_PRESENTATION_POLICY.textures);
    canvas.dataset.presentationCargoSlots = String(visuals.reduce(
      (total, visual) => total + visual.cargoSlots.filter((slot) => slot.visible).length,
      0,
    ));
    canvas.dataset.presentationOpenFactoryDoors = String(visuals.filter((visual) =>
      visual.doorOpenAmount > 0.08
      && visual.activityParts.some((part) => part.node.name === 'factory_door')).length);
    canvas.dataset.presentationOpenBarracksDoors = String(visuals.filter((visual) =>
      visual.doorOpenAmount > 0.08
      && visual.activityParts.some((part) => part.node.name === 'barracks_door')).length);
    canvas.dataset.presentationActiveCranes = String(visuals.filter((visual) =>
      visual.activityAmount > 0.12
      && visual.animatedNodes.some((node) => node.name === 'crane_yaw')).length);
    const metricNow = this.hostWindow.performance.now() / 1000;
    canvas.dataset.presentationActiveProductionExits = String(visuals.filter((visual) =>
      metricNow < visual.productionExitUntil).length);
    canvas.dataset.presentationActiveRefineryMechanisms = String(visuals.filter((visual) =>
      hasCompleteRefineryMechanism(visual.refineryMechanismParts.map((part) => part.role))
      && metricNow < visual.refineryUnloadUntil).length);
    canvas.dataset.presentationOpenRefineryGates = String(visuals.filter((visual) =>
      visual.refineryMechanismParts.some((part) => part.role === 'gate')
      && refineryUnloadPresentation(
        metricNow,
        visual.refineryUnloadStartedAt,
        visual.refineryUnloadUntil,
        this.reducedMotion,
      ).gate > 0.08).length);
    canvas.dataset.presentationRefineryMechanismParts = String(visuals.reduce(
      (total, visual) => total + visual.refineryMechanismParts.length,
      0,
    ));
    canvas.dataset.refineryMechanismContracts = String(visuals.filter((visual) =>
      hasCompleteRefineryMechanism(visual.refineryMechanismParts.map((part) => part.role))).length);
    canvas.dataset.presentationActiveRefineryConveyors = String(visuals.filter((visual) =>
      !this.reducedMotion
      && this.renderQuality !== 'low'
      && refineryUnloadPresentation(
        metricNow,
        visual.refineryUnloadStartedAt,
        visual.refineryUnloadUntil,
        this.reducedMotion,
      ).mechanism > 0.08
      && visual.refineryMechanismParts.some((part) => part.role === 'conveyor')).length);
    canvas.dataset.presentationActiveRefineryCollectors = String(visuals.filter((visual) =>
      !this.reducedMotion
      && this.renderQuality !== 'low'
      && refineryUnloadPresentation(
        metricNow,
        visual.refineryUnloadStartedAt,
        visual.refineryUnloadUntil,
        this.reducedMotion,
      ).mechanism > 0.08
      && visual.refineryMechanismParts.some((part) => part.role === 'collector')).length);
    canvas.dataset.presentationActiveCollectors = String(visuals.filter((visual) =>
      visual.activityAmount > 0.12
      && visual.animatedNodes.some((node) => node.name === 'collector_head')).length);
    canvas.dataset.presentationDamaged = String(visuals.filter((visual) => visual.damageVisual?.root.visible).length);
    canvas.dataset.presentationDamagedBuildings = String(visuals.filter((visual) =>
      visual.entityType === 'building' && visual.damageVisual?.stage === 'damaged').length);
    canvas.dataset.presentationCriticalBuildings = String(visuals.filter((visual) =>
      visual.entityType === 'building' && visual.damageVisual?.stage === 'critical').length);
    const authoredDamagedBuildings = visuals.filter((visual) =>
      visual.destructionAge < 0
      && visual.lodTier !== 'culled'
      && visual.damageVisual?.stage === 'damaged'
      && visual.authoredBuildingDamageRoots.damaged !== null).length;
    const authoredCriticalBuildings = visuals.filter((visual) =>
      visual.destructionAge < 0
      && visual.lodTier !== 'culled'
      && visual.damageVisual?.stage === 'critical'
      && visual.authoredBuildingDamageRoots.critical !== null).length;
    const authoredDamageFallbacks = visuals.filter((visual) =>
      visual.entityType === 'building'
      && visual.destructionAge < 0
      && visual.lodTier !== 'culled'
      && visual.damageVisual?.stage !== 'none'
      && (
        (visual.damageVisual?.stage === 'damaged' && visual.authoredBuildingDamageRoots.damaged === null)
        || (visual.damageVisual?.stage === 'critical' && visual.authoredBuildingDamageRoots.critical === null)
      )).length;
    canvas.dataset.authoredBuildingDamageContracts = String(visuals.filter((visual) =>
      visual.authoredBuildingDamageRoots.damaged !== null
      && visual.authoredBuildingDamageRoots.critical !== null).length);
    canvas.dataset.authoredBuildingDamagePresentationVersion = AUTHORED_BUILDING_DAMAGE_POLICY.version;
    canvas.dataset.presentationAuthoredDamagedBuildings = String(authoredDamagedBuildings);
    canvas.dataset.presentationAuthoredCriticalBuildings = String(authoredCriticalBuildings);
    canvas.dataset.presentationAuthoredBuildingDamageModules = String(
      authoredDamagedBuildings + authoredCriticalBuildings,
    );
    canvas.dataset.presentationAuthoredBuildingDamageOverlaps = String(visuals.filter((visual) =>
      visual.authoredBuildingDamageRoots.damaged?.visible === true
      && visual.authoredBuildingDamageRoots.critical?.visible === true).length);
    canvas.dataset.authoredBuildingDamageFallbacks = String(authoredDamageFallbacks);
    canvas.dataset.factionPresentationVersion = 'faction-health-v1';
    canvas.dataset.factionMarkers = String(this.factionMarkerCount);
    canvas.dataset.factionMarkerBatches = String(this.factionMarkerCount > 0 ? 2 : 0);
    const visibleHealthBars = visuals.filter((visual) => visual.healthBar?.group.visible).length;
    const healthBarBatchMetrics = breakthroughHealthBarBatchMetrics(
      visibleHealthBars,
      this.fixture.startsWith('breakthrough-demo'),
    );
    canvas.dataset.visibleHealthBars = String(visibleHealthBars);
    canvas.dataset.healthBarBatchVersion = BREAKTHROUGH_HEALTH_BAR_BATCH_POLICY.version;
    canvas.dataset.healthBarBatchInstances = String(this.healthBarBatchCount);
    canvas.dataset.healthBarBatches = String(
      this.healthBarBatchCount > 0 ? BREAKTHROUGH_HEALTH_BAR_BATCH_POLICY.drawCallCeiling : 0,
    );
    canvas.dataset.healthBarSourceDrawCalls = String(healthBarBatchMetrics.sourceDrawCalls);
    canvas.dataset.healthBarAvoidedDrawCalls = String(healthBarBatchMetrics.avoidedDrawCalls);
    canvas.dataset.playerFactionMarkers = String(this.playerFactionMarkerCount);
    canvas.dataset.enemyFactionMarkers = String(this.enemyFactionMarkerCount);
    canvas.dataset.presentationRecoiling = String(visuals.filter((visual) => visual.recoilAmount > 0.08).length);
    canvas.dataset.presentationHitReaction = String(visuals.filter((visual) => visual.hitAmount > 0.08).length);
    canvas.dataset.presentationDestroying = String(visuals.filter((visual) =>
      visual.destructionAge >= 0
      && visual.authoredWreckAge < 0
      && visual.authoredBuildingRuinAge < 0
      && visual.root.visible).length);
    canvas.dataset.presentationRigged = String(visuals.filter((visual) => visual.animationMixer !== null).length);
    const rigStates: Record<string, number> = {};
    for (const visual of visuals) {
      if (!visual.animationMixer || !visual.animationState) continue;
      rigStates[visual.animationState] = (rigStates[visual.animationState] ?? 0) + 1;
    }
    canvas.dataset.presentationRigStates = JSON.stringify(rigStates);
    canvas.dataset.presentationRigClips = String(visuals.find((visual) => visual.animationMixer)?.animationActions.size ?? 0);
    canvas.dataset.presentationDebris = String(this.effects.filter((effect) => effect.root.userData.debrisBurst === true).length);
    canvas.dataset.presentationProjectiles = String(this.effects.filter((effect) => effect.root.userData.projectileEffect === true).length);
    canvas.dataset.presentationMuzzles = String(this.effects.filter((effect) => effect.root.userData.muzzleEffect === true).length);
    canvas.dataset.presentationImpacts = String(this.effects.filter((effect) => effect.root.userData.impactEffect === true).length);
    canvas.dataset.presentationBallisticImpacts = String(this.effects.filter((effect) => effect.kind === 'ballistic-impact').length);
    canvas.dataset.presentationHeavyExplosions = String(this.effects.filter((effect) => effect.kind === 'heavy-explosion').length);
    canvas.dataset.presentationHeavyExplosionCap = String(combatVfxCap('heavy-explosion', this.renderQuality, this.reducedMotion));
    canvas.dataset.presentationHeavyMaxRingRadius = String(COMBAT_VFX_READABILITY_V2.heavy.maxContactRingRadius);
    canvas.dataset.presentationHeavyMaxShockwaveRadius = String(COMBAT_VFX_READABILITY_V2.heavy.maxShockwaveRadius);
    canvas.dataset.presentationCombatVfxVersion = COMBAT_VFX_READABILITY_V2.version;
    canvas.dataset.presentationSmoke = String(this.effects.filter((effect) => effect.root.userData.smokeEffect === true).length);
    const genericResidueEffects = this.effects.filter((effect) => effect.root.userData.wreckResidue === true);
    const genericResidues = genericResidueEffects.length;
    const genericResidueFamilyCounts = countGenericDestructionResidueFamilies(
      genericResidueEffects.map((effect) => effect.root.userData.residueFamily),
    );
    const genericResidueMeshCount = genericResidueEffects.reduce(
      (total, effect) => total + (Number(effect.root.userData.residueMeshCount) || 0),
      0,
    );
    const genericResidueMeshBudgetViolations = genericResidueEffects.filter((effect) =>
      (Number(effect.root.userData.residueMeshCount) || 0)
        > GENERIC_DESTRUCTION_RESIDUE_POLICY.maxMeshesPerResidue).length;
    const authoredWrecks = visuals.filter((visual) => visual.authoredWreckAge >= 0).length;
    const authoredBuildingRuins = visuals.filter((visual) => visual.authoredBuildingRuinAge >= 0).length;
    const authoredBuildingRuinMarkers = visuals.filter((visual) =>
      visual.authoredBuildingRuinAge >= 0
      && shouldShowPersistentFactionMarker(
        visual.team,
        true,
        this.fixture === 'building-ruin-review'
          || this.fixture === 'building-ruin-review-reduced'
          || this.isVisible(visual.root.position),
      )).length;
    canvas.dataset.authoredWreckPresentationVersion = AUTHORED_VEHICLE_WRECK_POLICY.version;
    canvas.dataset.authoredWreckContracts = String(visuals.filter((visual) => visual.authoredWreckRoot !== null).length);
    canvas.dataset.presentationAuthoredWrecks = String(authoredWrecks);
    canvas.dataset.authoredBuildingRuinPresentationVersion = AUTHORED_BUILDING_RUIN_POLICY.version;
    canvas.dataset.authoredBuildingRuinContracts = String(visuals.filter((visual) =>
      visual.authoredBuildingRuinRoot !== null).length);
    canvas.dataset.presentationAuthoredBuildingRuins = String(authoredBuildingRuins);
    canvas.dataset.presentationAuthoredBuildingRuinModules = String(visuals.reduce(
      (total, visual) => total + (visual.authoredBuildingRuinAge >= 0 && visual.authoredBuildingRuinRoot
        ? visual.authoredBuildingRuinRoot.children.filter((child) => child instanceof THREE.Mesh).length
        : 0),
      0,
    ));
    canvas.dataset.presentationAuthoredBuildingRuinLiveMeshesVisible = String(visuals.reduce(
      (total, visual) => total + (visual.authoredBuildingRuinAge >= 0
        ? visual.authoredBuildingRuinLiveNodes.filter((entry) => entry.node.visible).length
        : 0),
      0,
    ));
    canvas.dataset.presentationAuthoredBuildingRuinDamageRootsVisible = String(visuals.reduce(
      (total, visual) => total + (visual.authoredBuildingRuinAge >= 0
        ? (['damaged', 'critical'] as const).filter((role) =>
          visual.authoredBuildingDamageRoots[role]?.visible === true).length
        : 0),
      0,
    ));
    canvas.dataset.authoredBuildingRuinFactionMarkers = String(authoredBuildingRuinMarkers);
    canvas.dataset.authoredBuildingRuinPrivacyViolations = String(visuals.filter((visual) =>
      visual.authoredBuildingRuinAge >= 0
      && visual.team === 'enemy'
      && this.fixture !== 'building-ruin-review'
      && this.fixture !== 'building-ruin-review-reduced'
      && this.fixture !== 'enemy-infrastructure-review'
      && !this.isVisible(visual.root.position)
      && this.factionMarkerInstanceIds.includes(
        [...this.entityVisuals.entries()].find(([, entry]) => entry === visual)?.[0] ?? '',
      )).length);
    canvas.dataset.presentationGenericResidues = String(genericResidues);
    canvas.dataset.presentationResidueFamilyVersion = GENERIC_DESTRUCTION_RESIDUE_POLICY.version;
    canvas.dataset.presentationResidueFamilies = JSON.stringify(genericResidueFamilyCounts);
    canvas.dataset.presentationResidueFamilyLightVehicle = String(genericResidueFamilyCounts['light-vehicle']);
    canvas.dataset.presentationResidueFamilyWideArmor = String(genericResidueFamilyCounts['wide-armor']);
    canvas.dataset.presentationResidueFamilyArtillery = String(genericResidueFamilyCounts.artillery);
    canvas.dataset.presentationResidueFamilyTrackedVehicle = String(genericResidueFamilyCounts['tracked-vehicle']);
    canvas.dataset.presentationResidueFamilyBuildingRubble = String(genericResidueFamilyCounts['building-rubble']);
    canvas.dataset.presentationResidueFamilyUnknownDebris = String(genericResidueFamilyCounts['unknown-debris']);
    canvas.dataset.presentationGenericResidueMeshes = String(genericResidueMeshCount);
    canvas.dataset.presentationGenericResidueMeshBudget = String(
      GENERIC_DESTRUCTION_RESIDUE_POLICY.maxMeshesPerResidue,
    );
    canvas.dataset.presentationGenericResidueMeshBudgetViolations = String(genericResidueMeshBudgetViolations);
    canvas.dataset.presentationVehicleWrecks = String(authoredWrecks);
    canvas.dataset.presentationBuildingRuins = String(authoredBuildingRuins);
    canvas.dataset.presentationPersistentResidues = String(authoredWrecks + authoredBuildingRuins);
    canvas.dataset.presentationResidues = String(genericResidues + authoredWrecks + authoredBuildingRuins);
    canvas.dataset.authoredWreckCap = String(authoredVehicleWreckCap(this.renderQuality, this.reducedMotion));
    canvas.dataset.persistentResidueCap = String(authoredVehicleWreckCap(this.renderQuality, this.reducedMotion));
    canvas.dataset.authoredWreckActivations = String(this.authoredWreckActivations);
    canvas.dataset.authoredWreckFallbacks = String(this.authoredWreckFallbacks);
    canvas.dataset.authoredBuildingRuinActivations = String(this.authoredBuildingRuinActivations);
    canvas.dataset.authoredBuildingRuinFallbacks = String(this.authoredBuildingRuinFallbacks);
    canvas.dataset.socketShots = String(this.socketShots);
    canvas.dataset.socketMuzzleSingleShots = String(this.semanticMuzzleSocketShots.muzzle_socket);
    canvas.dataset.socketMuzzleLeftShots = String(this.semanticMuzzleSocketShots.muzzle_socket_left);
    canvas.dataset.socketMuzzleRightShots = String(this.semanticMuzzleSocketShots.muzzle_socket_right);
    canvas.dataset.socketRepairs = String(this.socketRepairs);
    canvas.dataset.socketDeposits = String(this.socketDeposits);
    canvas.dataset.socketRefineryMechanisms = String(this.socketRefineryMechanisms);
    canvas.dataset.refineryMechanismFallbacks = String(this.refineryMechanismFallbacks);
    canvas.dataset.socketProductionExits = String(this.socketProductionExits);
    canvas.dataset.socketDamageAnchors = String(visuals.filter((visual) => visual.damageSocketName !== null).length);
    canvas.dataset.socketWreckAnchors = String(this.socketWreckAnchors);
    canvas.dataset.socketFallbacks = String(this.socketFallbacks);
    const socketReviewSuppressor = this.entityVisuals.get('u-enemy-socket-suppressor');
    const socketReviewArtillery = this.entityVisuals.get('u-enemy-socket-artillery');
    const socketReviewArtilleryBarrel = socketReviewArtillery?.muzzleSockets.get('muzzle_socket')?.parent;
    canvas.dataset.socketReviewSuppressorTurretYawDegrees = String(THREE.MathUtils.radToDeg(
      socketReviewSuppressor?.turretPivot?.rotation.y ?? 0,
    ));
    canvas.dataset.socketReviewArtilleryBarrelPitchDegrees = String(THREE.MathUtils.radToDeg(
      socketReviewArtilleryBarrel?.name === 'barrel_pitch' ? socketReviewArtilleryBarrel.rotation.x : 0,
    ));
    const socketReviewSuppressorLeft = socketReviewSuppressor?.muzzleSockets.get('muzzle_socket_left');
    const socketReviewSuppressorRight = socketReviewSuppressor?.muzzleSockets.get('muzzle_socket_right');
    canvas.dataset.socketReviewContracts = String(Number(Boolean(
      socketReviewSuppressorLeft?.parent?.name === 'turret_yaw'
      && socketReviewSuppressorRight?.parent?.name === 'turret_yaw',
    )) + Number(Boolean(
      socketReviewArtillery?.muzzleSockets.has('muzzle_socket')
      && socketReviewArtilleryBarrel?.name === 'barrel_pitch',
    )));
    const combatVehicleReview = combatVehicleFamilyReviewMetrics(
      [...this.entityVisuals.entries()].map(([id, visual]) => ({
        id,
        modelKey: visual.modelKey,
        team: visual.team,
        unitKind: visual.unitKind,
      })),
    );
    canvas.dataset.combatVehicleFamilyEntities = String(combatVehicleReview.entities);
    canvas.dataset.combatVehicleFamilyContracts = String(combatVehicleReview.contracts);
    canvas.dataset.combatVehicleFamilyFallbacks = String(combatVehicleReview.fallbacks);
    canvas.dataset.combatVehicleFamilyPlayerEntities = String(combatVehicleReview.player);
    canvas.dataset.combatVehicleFamilyEnemyEntities = String(combatVehicleReview.enemy);
    canvas.dataset.combatVehicleFamilyScoutEntities = String(combatVehicleReview.scout);
    canvas.dataset.combatVehicleFamilySuppressorEntities = String(combatVehicleReview.suppressor);
    canvas.dataset.combatVehicleFamilyArtilleryEntities = String(combatVehicleReview.artillery);
    canvas.dataset.combatVehicleFamilyAssetFailures = String(this.assetLoadFailed);
    canvas.dataset.combatVehicleFamilyCombatVfx = String(this.effects.filter((effect) =>
      effect.root.userData.projectileEffect === true
      || effect.root.userData.muzzleEffect === true
      || effect.root.userData.impactEffect === true).length);
    const breakthrough = this.fixture.startsWith('breakthrough-demo');
    let staticBattlefieldInstances = 0;
    for (const batch of this.breakthroughStaticBatches) {
      staticBattlefieldInstances += Number(batch.userData.semanticInstanceCount) || 0;
    }
    let contactShadowCount = this.contactShadowCount;
    if (!breakthrough) {
      contactShadowCount = 0;
      this.entityRoot.traverse((object) => {
        if (object.userData.contactShadow !== true || !object.visible) return;
        let parent = object.parent;
        while (parent && parent !== this.entityRoot) {
          if (!parent.visible) return;
          parent = parent.parent;
        }
        contactShadowCount += 1;
      });
    }
    const contactShadowBatches = breakthrough && contactShadowCount > 0 ? 1 : contactShadowCount;
    const compactSelectionRingBatches = breakthrough
      ? this.independentCompactSelectionRingCount + (this.compactSelectionBatchCount > 0 ? 1 : 0)
      : this.compactSelectionRingCount;
    const defenseMarkerCount = breakthrough ? BREAKTHROUGH_DEFENSE_MARKERS.length : 0;
    canvas.dataset.presentationContactShadows = String(contactShadowCount);
    canvas.dataset.presentationContactShadowOpacity = String(CONTACT_SHADOW_PRESENTATION.opacity);
    canvas.dataset.presentationContactShadowScale = String(CONTACT_SHADOW_PRESENTATION.scale);
    canvas.dataset.presentationBreakthroughDecals = String(staticBattlefieldInstances);
    canvas.dataset.staticBattlefieldInstances = String(staticBattlefieldInstances);
    canvas.dataset.staticBattlefieldBatches = String(this.breakthroughStaticBatches.length);
    canvas.dataset.contactShadows = String(contactShadowCount);
    canvas.dataset.contactShadowBatches = String(contactShadowBatches);
    canvas.dataset.fogEdgePolicyVersion = FOG_EDGE_POLICY.version;
    canvas.dataset.fogTextureSize = String(FOG_EDGE_POLICY.textureSize);
    canvas.dataset.groupSelectionCount = String(this.groupSelectionCount);
    canvas.dataset.groupSelectionPolicyVersion = GROUP_SELECTION_RING_POLICY.version;
    canvas.dataset.compactSelectionRings = String(this.compactSelectionRingCount);
    canvas.dataset.compactSelectionRingBatches = String(compactSelectionRingBatches);
    canvas.dataset.beaconRingVisible = String(this.beaconControlRingVisible);
    canvas.dataset.defenseMarkerCount = String(defenseMarkerCount);
    canvas.dataset.defenseMarkerOpacity = String(BREAKTHROUGH_DEFENSE_MARKER_PRESENTATION.opacity);
    canvas.dataset.presentationReducedMotion = String(this.reducedMotion);
  }

  private updateTextureQuality(): void {
    const anisotropy = Math.min(
      RENDER_QUALITY_PROFILES[this.renderQuality].anisotropy,
      this.renderer.capabilities.getMaxAnisotropy(),
    );
    const textures = new Set<THREE.Texture>(this.ownedTextures);
    for (const material of this.importedMaterialLibrary.values()) {
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
    }
    for (const texture of textures) {
      if (texture.anisotropy === anisotropy) continue;
      texture.anisotropy = anisotropy;
      texture.needsUpdate = true;
    }
  }

  private updateCameraTransform(): void {
    const horizontal = Math.cos(CAMERA_ELEVATION) * CAMERA_DISTANCE;
    this.camera.position.set(
      this.cameraTarget.x + Math.sin(CAMERA_YAW) * horizontal,
      Math.sin(CAMERA_ELEVATION) * CAMERA_DISTANCE,
      this.cameraTarget.z + Math.cos(CAMERA_YAW) * horizontal,
    );
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateMatrixWorld(true);
  }

  private setPointerNdc(clientX: number, clientY: number): boolean {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return false;
    this.pointerNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    return true;
  }

  private projectWorldPosition(position: THREE.Vector3, heightOffset: number): ScreenPoint | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    this.camera.updateMatrixWorld(true);
    const projected = new THREE.Vector3(position.x, position.y + heightOffset, position.z).project(this.camera);
    if (projected.z < -1 || projected.z > 1) return null;
    return {
      x: rect.left + (projected.x * 0.5 + 0.5) * rect.width,
      y: rect.top + (-projected.y * 0.5 + 0.5) * rect.height,
    };
  }

  private applyGhostMaterial(root: THREE.Object3D, valid: boolean): void {
    const material = valid ? this.palette.ghostValid : this.palette.ghostInvalid;
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.material = material;
      object.castShadow = false;
      object.receiveShadow = false;
      object.renderOrder = 8;
    });
  }

  private addBox(
    parent: THREE.Object3D,
    width: number,
    height: number,
    depth: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material,
    castShadow = true,
  ): THREE.Mesh {
    return this.addMesh(parent, this.boxGeometry(width, height, depth), material, x, y, z, castShadow);
  }

  private addCylinder(
    parent: THREE.Object3D,
    radiusTop: number,
    radiusBottom: number,
    height: number,
    segments: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material,
    castShadow = true,
  ): THREE.Mesh {
    return this.addMesh(parent, this.cylinderGeometry(radiusTop, radiusBottom, height, segments), material, x, y, z, castShadow);
  }

  private addMesh(
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    castShadow: boolean,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = castShadow;
    parent.add(mesh);
    return mesh;
  }

  private ownGeometry<T extends THREE.BufferGeometry>(geometry: T): T {
    this.ownedGeometries.add(geometry);
    return geometry;
  }

  private ownMaterial<T extends THREE.Material>(material: T): T {
    this.ownedMaterials.add(material);
    return material;
  }

  private cachedGeometry(key: string, factory: () => THREE.BufferGeometry): THREE.BufferGeometry {
    const cached = this.geometryCache.get(key);
    if (cached) return cached;
    const geometry = this.ownGeometry(factory());
    this.geometryCache.set(key, geometry);
    return geometry;
  }

  private boxGeometry(width: number, height: number, depth: number): THREE.BufferGeometry {
    return this.cachedGeometry(`box:${width}:${height}:${depth}`, () => new THREE.BoxGeometry(width, height, depth));
  }

  private planeGeometry(width: number, height: number): THREE.BufferGeometry {
    return this.cachedGeometry(`plane:${width}:${height}`, () => new THREE.PlaneGeometry(width, height));
  }

  private circleGeometry(radius: number, segments: number): THREE.BufferGeometry {
    return this.cachedGeometry(`circle:${radius}:${segments}`, () => new THREE.CircleGeometry(radius, segments));
  }

  private ringGeometry(inner: number, outer: number, segments: number): THREE.BufferGeometry {
    return this.cachedGeometry(`ring:${inner}:${outer}:${segments}`, () => new THREE.RingGeometry(inner, outer, segments));
  }

  private cylinderGeometry(radiusTop: number, radiusBottom: number, height: number, segments: number): THREE.BufferGeometry {
    return this.cachedGeometry(
      `cylinder:${radiusTop}:${radiusBottom}:${height}:${segments}`,
      () => new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    );
  }

  private sphereGeometry(radius: number, widthSegments: number, heightSegments: number): THREE.BufferGeometry {
    return this.cachedGeometry(
      `sphere:${radius}:${widthSegments}:${heightSegments}`,
      () => new THREE.SphereGeometry(radius, widthSegments, heightSegments),
    );
  }

  private octahedronGeometry(radius: number): THREE.BufferGeometry {
    return this.cachedGeometry(`octahedron:${radius}`, () => new THREE.OctahedronGeometry(radius, 0));
  }

  private dodecahedronGeometry(radius: number): THREE.BufferGeometry {
    return this.cachedGeometry(`dodecahedron:${radius}`, () => new THREE.DodecahedronGeometry(radius, 0));
  }
}
