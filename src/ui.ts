import './styles.css';

import {
  BUILDING_DEFS,
  BUILD_MENU,
  DEFENSE_MIN_POWER_RATIO,
  SIGNAL_TARGET_SECONDS,
  SIGNAL_UNLOCK_SECONDS,
  UNIT_DEFS,
  UNIT_MENU,
} from './game/config';
import { factionCssColor, healthVisualBand } from './game/faction-visuals';
import {
  BREAKTHROUGH_DIFFICULTIES,
  isPlayableBreakthroughFixture,
  type BreakthroughDifficultyId,
} from './game/difficulty';
import {
  shouldHideReviewPresentationBlocker,
  shouldHideReviewPresentationEntity,
} from './game/review-presentation';
import {
  TECHNOLOGY_DEFS,
  TECHNOLOGY_KINDS,
  type TechnologyKind,
} from './game/technology';
import type { RenderQualityLevel } from './game/render-quality';
import type {
  BuildingState,
  BuildingKind,
  GameState,
  NotificationState,
  Team,
  UnitKind,
  Vec2,
  WorldEntity,
} from './game/types';
import type { VisibilitySnapshot, VisibilityState } from './game/visibility';

export type HUDCommand = 'move' | 'attackMove' | 'stop';
export type HUDTone = NotificationState['tone'];

type ArmoryTab = 'structures' | 'armoury' | 'infantry' | 'vehicles';

const ARMORY_TAB_ORDER: readonly ArmoryTab[] = ['structures', 'armoury', 'infantry', 'vehicles'];
const BREAKTHROUGH_DIFFICULTY_ORDER: readonly BreakthroughDifficultyId[] = ['cadet', 'standard', 'veteran'];
const DEFENSE_BUILD_KINDS = new Set<BuildingKind>(['sentry', 'cannon']);
const INFANTRY_UNIT_KINDS = new Set<UnitKind>(['rifle', 'antitank', 'engineer']);

function supportsBreakthroughDifficultyFixture(fixture: string): boolean {
  return isPlayableBreakthroughFixture(fixture)
    || fixture === 'breakthrough-demo-victory-review'
    || fixture === 'breakthrough-demo-defeat-review';
}

export interface HUDCallbacks {
  onBuild(kind: BuildingKind): void;
  onProduce(kind: UnitKind): void;
  onResearch?(kind: TechnologyKind): void;
  onCancelConstruction?(buildingId: string): void;
  onCancelProduction?(buildingId: string): void;
  onCancelResearch?(): void;
  onCommand(command: HUDCommand): void;
  onRestart(): void;
  onSave(): void;
  onLoad(): void;
  onAudioAction?(): void;
  onQualityAction?(): void;
  onToggleHelp(): void;
  onOverlayPauseChange?(paused: boolean): void;
  onSelectEntity(id: string): void;
  onMinimapNavigate(point: MinimapNavigationPoint): void;
  /** Returns true when the current tick-zero battlefield can start in place. */
  onDeployDifficulty?(difficulty: BreakthroughDifficultyId, mode: 'initial' | 'change'): boolean;
  onResumeSavedDeployment?(): void;
}

export interface HUDAudioState {
  available: boolean;
  muted: boolean;
  unlocked: boolean;
}

export interface HUDOptions {
  layoutMode?: 'default' | 'visual-review';
  fixture?: string;
  difficultyId?: BreakthroughDifficultyId;
  resumeDeployment?: HUDResumeDeployment | null;
}

export interface HUDResumeDeployment {
  difficultyId: BreakthroughDifficultyId;
  difficultyLabel: string;
  elapsedSeconds: number;
}

export function shouldComposeDesktopCommandSidebar(
  layoutMode: NonNullable<HUDOptions['layoutMode']>,
  rightOverlay: boolean,
): boolean {
  return layoutMode === 'default' && !rightOverlay;
}

export function shouldPauseForTacticalOverlay(
  helpOpen: boolean,
  leftRailOpen: boolean,
  rightRailOpen: boolean,
  rightRailOverlay: boolean,
  deploymentBriefingOpen = false,
): boolean {
  return deploymentBriefingOpen || helpOpen || leftRailOpen || (rightRailOpen && rightRailOverlay);
}

export type BreakthroughPreparationAction = 'wait-deposit' | 'build-sentry' | 'open-vehicles' | 'wait-vehicle' | 'complete';

export interface BreakthroughPreparationGuide {
  action: BreakthroughPreparationAction;
  detail: string;
  buttonLabel: string;
  buttonDisabled: boolean;
}

export function breakthroughPreparationGuide(
  depositReady: boolean,
  sentryReady: boolean,
  producedVehicleReady: boolean,
  vehicleRemainingSeconds: number | null = null,
): BreakthroughPreparationGuide {
  if (!depositReady) {
    return {
      action: 'wait-deposit',
      detail: '① 采集车将自动完成卸矿 · ② 防御页建哨戒塔 · ③ 载具页生产战斗车',
      buttonLabel: '第一步 · 等待采集车自动卸矿',
      buttonDisabled: true,
    };
  }
  if (!sentryReady) {
    return {
      action: 'build-sentry',
      detail: '① 回炼完成 · ② 在防御页建造哨戒塔（下一步） · ③ 生产战斗车',
      buttonLabel: '第二步 · 定位并建造哨戒塔',
      buttonDisabled: false,
    };
  }
  if (producedVehicleReady) {
    return {
      action: 'complete',
      detail: '① 回炼完成 · ② 哨戒塔完成 · ③ 新载具完成',
      buttonLabel: '战前整备完成',
      buttonDisabled: true,
    };
  }
  if (vehicleRemainingSeconds !== null) {
    const remaining = Math.max(0, Math.ceil(vehicleRemainingSeconds));
    return {
      action: 'wait-vehicle',
      detail: `① 回炼完成 · ② 哨戒塔完成 · ③ 战斗载具生产中（约 ${remaining} 秒）`,
      buttonLabel: `第三步 · 载具生产中 ${remaining}s`,
      buttonDisabled: true,
    };
  }
  return {
    action: 'open-vehicles',
    detail: '① 回炼完成 · ② 哨戒塔完成 · ③ 在载具页生产任意战斗车（下一步）',
    buttonLabel: '第三步 · 打开载具生产',
    buttonDisabled: false,
  };
}

export interface ClientSelectionRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface MinimapNavigationPoint {
  x: number;
  z: number;
}

export interface MinimapClientRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface MinimapWorldBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface ProductionButtonRefs {
  button: HTMLButtonElement;
  badge: HTMLElement;
  requirement: HTMLElement;
}

interface TechnologyButtonRefs {
  button: HTMLButtonElement;
  status: HTMLElement;
  progress: HTMLElement;
  progressFill: HTMLElement;
}

const BUILD_GLYPHS: Record<BuildingKind, string> = {
  hq: '◇',
  reactor: 'ϟ',
  refinery: '⬡',
  barracks: '▥',
  factory: '▰',
  relay: '⌁',
  sentry: '╫',
  cannon: '◉',
};

const UNIT_GLYPHS: Record<UnitKind, string> = {
  scout: '⌁',
  rifle: '▥',
  antitank: '⌖',
  engineer: '◇',
  suppressor: '▰',
  tank: '⬢',
  artillery: '⌒',
  harvester: '⬡',
};

const TECHNOLOGY_GLYPHS: Record<TechnologyKind, string> = {
  efficientRefining: '◆',
  compositeArmor: '⬢',
  signalAmplifier: '⌁',
};

const ORDER_LABELS = {
  idle: '待命',
  move: '移动',
  attackMove: '移动攻击',
  attack: '交战',
  gather: '采集',
  return: '返航',
  repair: '维修',
} as const;

const numberFormatter = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 });
const VISIBILITY_EPSILON = 1e-9;
const MINIMAP_INSET = 7;

export function isPrimaryMinimapPointer(button: number, isPrimary: boolean): boolean {
  return button === 0 && isPrimary;
}

export function shouldRenderMinimapEntity(
  fixture: string,
  entityId: string,
  team: Team,
  visibleEnemyIds: ReadonlySet<string>,
): boolean {
  if (shouldHideReviewPresentationEntity(fixture, entityId)) return false;
  return team !== 'enemy' || visibleEnemyIds.has(entityId);
}

export function shouldRenderMinimapBlocker(
  fixture: string,
  blockerId: string,
  visibility: VisibilityState,
): boolean {
  return !shouldHideReviewPresentationBlocker(fixture, blockerId) && visibility !== 'unknown';
}

export function minimapClientPointToNormalized(
  clientX: number,
  clientY: number,
  rect: MinimapClientRect,
  inset = MINIMAP_INSET,
): MinimapNavigationPoint | null {
  if (
    !Number.isFinite(clientX)
    || !Number.isFinite(clientY)
    || !Number.isFinite(rect.left)
    || !Number.isFinite(rect.top)
    || !Number.isFinite(rect.width)
    || !Number.isFinite(rect.height)
    || !Number.isFinite(inset)
    || inset < 0
  ) return null;
  const width = rect.width - inset * 2;
  const height = rect.height - inset * 2;
  if (width <= 0 || height <= 0) return null;
  return {
    x: clamp((clientX - rect.left - inset) / width),
    z: clamp((clientY - rect.top - inset) / height),
  };
}

export function normalizedMinimapPointToWorld(
  point: MinimapNavigationPoint,
  bounds: MinimapWorldBounds,
): Vec2 {
  const normalizedX = Number.isFinite(point.x) ? clamp(point.x) : 0.5;
  const normalizedZ = Number.isFinite(point.z) ? clamp(point.z) : 0.5;
  return {
    x: bounds.minX + (bounds.maxX - bounds.minX) * normalizedX,
    z: bounds.minZ + (bounds.maxZ - bounds.minZ) * normalizedZ,
  };
}

function requiredElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`GameHUD 缺少界面节点：${selector}`);
  return element;
}

function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function setText(element: Element, text: string): void {
  if (element.textContent !== text) element.textContent = text;
}

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function formatTime(seconds: number): string {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = wholeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function formatCredits(value: number): string {
  return numberFormatter.format(Math.max(0, Math.floor(value)));
}

function entityLabel(entity: WorldEntity): string {
  if (entity.entityType === 'unit') return UNIT_DEFS[entity.kind].label;
  if (entity.entityType === 'building') return BUILDING_DEFS[entity.kind].label;
  return '辉晶矿脉';
}

function entityGlyph(entity: WorldEntity): string {
  if (entity.entityType === 'unit') return UNIT_GLYPHS[entity.kind];
  if (entity.entityType === 'building') return BUILD_GLYPHS[entity.kind];
  return '◆';
}

function isDefenseBuilding(entity: WorldEntity): boolean {
  return entity.entityType === 'building' && BUILDING_DEFS[entity.kind].weapon !== undefined;
}

function defenseTowerStatus(building: BuildingState, powerRatio: number, compact = false): string {
  const network = building.connected ? '联网' : '断网';
  const hasDefensePower = powerRatio >= DEFENSE_MIN_POWER_RATIO;
  const power = !building.powered ? '断电' : hasDefensePower ? '供电' : '低电';
  let activity: string;
  if (building.buildProgress < 1) {
    activity = `施工 ${Math.round(clamp(building.buildProgress) * 100)}%`;
  } else if (!building.connected || !building.powered || !hasDefensePower) {
    activity = '武器停机';
  } else if (building.cooldownRemaining > 0.05) {
    activity = compact ? '交战' : `交战 · 装填 ${building.cooldownRemaining.toFixed(1)}s`;
  } else {
    activity = '待机警戒';
  }
  return `${network} · ${power} · ${activity}`;
}

function containsSorted(values: readonly number[], target: number): boolean {
  let low = 0;
  let high = values.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const value = values[middle];
    if (value === target) return true;
    if (value === undefined || value > target) high = middle - 1;
    else low = middle + 1;
  }
  return false;
}

function visibilityAt(
  snapshot: VisibilitySnapshot,
  position: Vec2,
  radius = 0,
): VisibilityState {
  const { bounds, cellSize, width, height } = snapshot;
  if (!Number.isFinite(position.x) || !Number.isFinite(position.z) || !Number.isFinite(radius)) return 'unknown';
  const safeRadius = Math.max(0, radius);
  if (
    position.x + safeRadius < bounds.minX - VISIBILITY_EPSILON
    || position.x - safeRadius > bounds.maxX + VISIBILITY_EPSILON
    || position.z + safeRadius < bounds.minZ - VISIBILITY_EPSILON
    || position.z - safeRadius > bounds.maxZ + VISIBILITY_EPSILON
  ) return 'unknown';

  const rangePadding = safeRadius > 0 ? VISIBILITY_EPSILON : 0;
  const minCellX = Math.min(width - 1, Math.max(0, Math.floor((position.x - safeRadius - bounds.minX - rangePadding) / cellSize)));
  const maxCellX = Math.min(width - 1, Math.max(0, Math.floor((position.x + safeRadius - bounds.minX + rangePadding) / cellSize)));
  const minCellZ = Math.min(height - 1, Math.max(0, Math.floor((position.z - safeRadius - bounds.minZ - rangePadding) / cellSize)));
  const maxCellZ = Math.min(height - 1, Math.max(0, Math.floor((position.z + safeRadius - bounds.minZ + rangePadding) / cellSize)));
  let touchesExplored = false;
  for (let z = minCellZ; z <= maxCellZ; z += 1) {
    for (let x = minCellX; x <= maxCellX; x += 1) {
      if (safeRadius > 0) {
        const cellMinX = bounds.minX + x * cellSize;
        const cellMinZ = bounds.minZ + z * cellSize;
        const closestX = Math.max(cellMinX, Math.min(position.x, Math.min(bounds.maxX, cellMinX + cellSize)));
        const closestZ = Math.max(cellMinZ, Math.min(position.z, Math.min(bounds.maxZ, cellMinZ + cellSize)));
        const dx = position.x - closestX;
        const dz = position.z - closestZ;
        if (dx * dx + dz * dz > safeRadius * safeRadius + VISIBILITY_EPSILON) continue;
      }
      const index = z * width + x;
      if (containsSorted(snapshot.visible, index)) return 'visible';
      if (containsSorted(snapshot.explored, index)) touchesExplored = true;
    }
  }
  return touchesExplored ? 'explored' : 'unknown';
}

export class GameHUD {
  readonly stage: HTMLElement;
  readonly minimap: HTMLCanvasElement;

  private readonly root: HTMLElement;
  private readonly callbacks: HUDCallbacks;
  private readonly layoutMode: NonNullable<HUDOptions['layoutMode']>;
  private readonly fixture: string;
  private readonly difficultyId: BreakthroughDifficultyId;
  private readonly resumeDeployment: HUDResumeDeployment | null;
  private readonly shell: HTMLElement;
  private readonly abortController = new AbortController();
  private readonly overlayRailMedia: MediaQueryList | null;
  private readonly buildButtons = new Map<BuildingKind, HTMLButtonElement>();
  private readonly productionButtons = new Map<UnitKind, ProductionButtonRefs>();
  private readonly technologyButtons = new Map<TechnologyKind, TechnologyButtonRefs>();
  private readonly armoryTabs = new Map<ArmoryTab, HTMLButtonElement>();
  private readonly armoryPanels = new Map<ArmoryTab, HTMLElement>();
  private readonly toastTimers = new Map<HTMLElement, number>();
  private readonly seenNotifications = new Set<number>();

  private readonly creditValue: HTMLElement;
  private readonly incomeValue: HTMLElement;
  private readonly powerValue: HTMLElement;
  private readonly powerDetail: HTMLElement;
  private readonly powerFill: HTMLElement;
  private readonly bandwidthValue: HTMLElement;
  private readonly bandwidthFill: HTMLElement;
  private readonly timerValue: HTMLElement;
  private readonly topObjective: HTMLElement;
  private readonly taskSummary: HTMLElement;
  private readonly tacticalPauseChip: HTMLElement;
  private readonly battleState: HTMLElement;
  private readonly objectiveTitle: HTMLElement;
  private readonly objectiveDetail: HTMLElement;
  private readonly objectiveFill: HTMLElement;
  private readonly objectiveProgress: HTMLElement;
  private readonly objectiveMeterLabel: HTMLElement;
  private readonly missionActionButton: HTMLButtonElement;
  private readonly enemyCoreValue: HTMLElement;
  private readonly networkValue: HTMLElement;
  private readonly intelContactsValue: HTMLElement;
  private readonly radarStatus: HTMLElement;
  private readonly intelCoverage: HTMLElement;
  private readonly queueSummary: HTMLElement;
  private readonly researchSummary: HTMLElement;
  private readonly structureGrid: HTMLElement;
  private readonly defenseGrid: HTMLElement;
  private readonly infantryGrid: HTMLElement;
  private readonly vehicleGrid: HTMLElement;
  private readonly technologyGrid: HTMLElement;
  private readonly cancelConstructionButton: HTMLButtonElement;
  private readonly cancelProductionButton: HTMLButtonElement;
  private readonly cancelResearchButton: HTMLButtonElement;
  private readonly cancelConstructionLabel: HTMLElement;
  private readonly cancelProductionLabel: HTMLElement;
  private readonly cancelResearchLabel: HTMLElement;
  private readonly leftRail: HTMLElement;
  private readonly rightRail: HTMLElement;
  private readonly minimapPanel: HTMLElement;
  private readonly utilityPanel: HTMLElement;
  private readonly railScrim: HTMLButtonElement;
  private readonly leftToggle: HTMLButtonElement;
  private readonly rightToggle: HTMLButtonElement;
  private readonly armoryTabList: HTMLElement;
  private readonly helpToggle: HTMLButtonElement;
  private readonly helpDrawer: HTMLElement;
  private readonly helpClose: HTMLButtonElement;
  private readonly selectionTitle: HTMLElement;
  private readonly selectionMeta: HTMLElement;
  private readonly selectionList: HTMLElement;
  private readonly modeChip: HTMLElement;
  private readonly moveButton: HTMLButtonElement;
  private readonly attackMoveButton: HTMLButtonElement;
  private readonly stopButton: HTMLButtonElement;
  private readonly audioButton: HTMLButtonElement;
  private readonly audioLabel: HTMLElement;
  private readonly qualityButton: HTMLButtonElement;
  private readonly qualityLabel: HTMLElement;
  private readonly selectionBox: HTMLElement;
  private readonly toastRegion: HTMLElement;
  private readonly fallback: HTMLElement;
  private readonly fallbackMessage: HTMLElement;
  private readonly resultDialog: HTMLDialogElement;
  private readonly resultTitle: HTMLElement;
  private readonly resultReason: HTMLElement;
  private readonly resultMetrics: HTMLElement;
  private readonly deploymentDialog: HTMLDialogElement;
  private readonly deploymentCards = new Map<BreakthroughDifficultyId, HTMLButtonElement>();
  private readonly deploymentStartButton: HTMLButtonElement;
  private readonly deploymentCancelButton: HTMLButtonElement;
  private readonly deploymentResumeButton: HTMLButtonElement;
  private readonly difficultyButton: HTMLButtonElement;
  private readonly difficultyLabel: HTMLElement;
  private readonly resultDifficultyButton: HTMLButtonElement;

  private resizeObserver: ResizeObserver | null = null;
  private lastState: GameState | null = null;
  private lastSelection = new Set<string>();
  private lastSelectionSignature = '';
  private lastMinimapKey = '';
  private lastRenderedTick = -1;
  private dismissedResultKey = '';
  private lastFocusedBeforeHelp: HTMLElement | null = null;
  private minimapPointerId: number | null = null;
  private minimapNavigationPoint: MinimapNavigationPoint = { x: 0.5, z: 0.5 };
  private leftRailOpen = false;
  private rightRailOpen = false;
  private activeArmoryTab: ArmoryTab = 'structures';
  private tacticalOverlayActive = false;
  private deploymentSelectedDifficulty: BreakthroughDifficultyId;
  private deploymentMode: 'initial' | 'change' = 'change';
  private lastFocusedBeforeDeployment: HTMLElement | null = null;
  private deploymentReopensResult = false;
  private resumeDeploymentAvailable = false;
  private disposed = false;

  constructor(root: HTMLElement, callbacks: HUDCallbacks, options: HUDOptions = {}) {
    this.root = root;
    this.callbacks = callbacks;
    this.layoutMode = options.layoutMode ?? 'default';
    this.fixture = options.fixture ?? 'default';
    this.difficultyId = options.difficultyId ?? 'standard';
    this.resumeDeployment = options.resumeDeployment ?? null;
    this.resumeDeploymentAvailable = Boolean(this.resumeDeployment && callbacks.onResumeSavedDeployment);
    this.deploymentSelectedDifficulty = this.difficultyId;
    this.root.classList.add('ff-app');

    const difficultyCards = BREAKTHROUGH_DIFFICULTY_ORDER.map((id) => {
      const definition = BREAKTHROUGH_DIFFICULTIES[id];
      const recommended = id === 'standard' ? '<em>推荐</em>' : '';
      return `
        <button type="button" class="ff-difficulty-card" data-difficulty="${id}" aria-pressed="${id === this.difficultyId}">
          <span><strong>${definition.label}</strong>${recommended}</span>
          <small>${definition.summary}</small>
        </button>
      `;
    }).join('');

    this.shell = createElement('div', 'ff-hud');
    this.shell.dataset.layoutMode = this.layoutMode;
    this.shell.dataset.factionPresentationVersion = 'faction-health-v1';
    for (const team of ['player', 'enemy', 'neutral'] as const) {
      this.shell.style.setProperty(`--ff-faction-${team}`, factionCssColor(team, 'primary'));
      this.shell.style.setProperty(`--ff-faction-${team}-bright`, factionCssColor(team, 'bright'));
      this.shell.style.setProperty(`--ff-faction-${team}-dark`, factionCssColor(team, 'dark'));
      this.shell.style.setProperty(`--ff-faction-${team}-minimap`, factionCssColor(team, 'minimap'));
    }
    this.shell.innerHTML = `
      <main class="ff-stage" aria-label="灰烬环线三维战场" aria-describedby="ff-stage-hint">
        <div class="ff-stage-backdrop" aria-hidden="true">
          <span class="ff-stage-scanline"></span>
          <span class="ff-stage-beacon"></span>
        </div>
        <p id="ff-stage-hint" class="ff-sr-only">在战场拖拽以框选单位，右键下达智能命令。</p>
        <section class="ff-webgl-fallback" tabindex="0" hidden>
          <span class="ff-fallback-mark" aria-hidden="true">!</span>
          <div>
            <p class="ff-kicker">TACTICAL LINK DEGRADED</p>
            <h1>三维战场不可用</h1>
            <p class="ff-fallback-message"></p>
            <p class="ff-fallback-note">战术信息与控制面板仍可使用。请检查浏览器图形加速后重试。</p>
          </div>
        </section>
        <div class="ff-selection-box" aria-hidden="true" hidden></div>
      </main>

      <div class="ff-hud-layer">
        <div class="ff-ra2-sidebar-shell" aria-hidden="true"><i></i><i></i><i></i></div>
        <header class="ff-topbar ff-panel" aria-label="战场资源状态">
          <div class="ff-brand">
            <span class="ff-brand-mark" aria-hidden="true"><i></i><i></i></span>
            <span><strong>断层战线</strong><small>FAULTLINE FRONT</small></span>
          </div>
          <div class="ff-top-stats">
            <div class="ff-stat ff-stat-credit">
              <span class="ff-stat-icon" aria-hidden="true">◆</span>
              <span><small>辉晶</small><strong data-credit>0</strong></span>
              <em data-income>+0 / 分</em>
            </div>
            <div class="ff-stat" data-power-stat>
              <span class="ff-stat-icon" aria-hidden="true">ϟ</span>
              <span><small>电力</small><strong data-power>0 / 0</strong></span>
              <em data-power-detail>100%</em>
              <span class="ff-micro-meter" aria-hidden="true"><i data-power-fill></i></span>
            </div>
            <div class="ff-stat">
              <span class="ff-stat-icon" aria-hidden="true">⌬</span>
              <span><small>带宽</small><strong data-bandwidth>0 / 0</strong></span>
              <span class="ff-micro-meter" aria-hidden="true"><i data-bandwidth-fill></i></span>
            </div>
          </div>
          <div class="ff-clock-block">
            <span data-top-objective>信标锁定中</span>
            <strong data-timer>00:00</strong>
            <em class="ff-tactical-pause" data-tactical-pause hidden>战术暂停</em>
          </div>
        </header>

        <button class="ff-drawer-toggle ff-drawer-toggle-left" type="button" aria-controls="ff-left-rail" aria-expanded="false" aria-label="打开战术任务面板">
          <span aria-hidden="true">◎</span><span>任务</span><strong class="ff-task-summary" data-task-summary>战前整备 0/3</strong>
        </button>
        <button class="ff-drawer-toggle ff-drawer-toggle-right" type="button" aria-controls="ff-right-rail" aria-expanded="false" aria-label="打开生产指挥栏">
          <span aria-hidden="true">▦</span><span>生产</span>
        </button>

        <button class="ff-rail-scrim" type="button" tabindex="-1" aria-label="关闭打开的战术面板" hidden></button>

        <aside id="ff-left-rail" class="ff-left-rail ff-side-rail" aria-label="任务与快捷键">
          <section class="ff-panel ff-objective-panel">
            <div class="ff-panel-heading">
              <span><small>ACTIVE DIRECTIVE</small><strong>战术任务</strong></span>
              <span class="ff-status-chip" data-battle-state>作战中</span>
              <button class="ff-rail-close" type="button" aria-label="关闭任务面板">×</button>
            </div>
            <article class="ff-primary-objective">
              <div class="ff-objective-index" aria-hidden="true">01</div>
              <div>
                <p data-objective-title>摧毁敌方指挥核心</p>
                <span data-objective-detail>保持采集与生产，建立正面推进编队。</span>
              </div>
            </article>
            <button class="ff-mission-action" type="button" data-mission-action hidden></button>
            <div class="ff-objective-meter" aria-label="中央信标进度">
              <div><span data-objective-meter-label>中央信标</span><strong data-objective-progress>锁定</strong></div>
              <span class="ff-progress"><i data-objective-fill></i></span>
            </div>
            <dl class="ff-signal-list">
              <div><dt>敌方核心</dt><dd data-enemy-core data-state="unknown">未侦测</dd></div>
              <div><dt>指挥网络</dt><dd data-network>稳定</dd></div>
              <div><dt>侦察情报</dt><dd data-intel-contacts>无接触</dd></div>
            </dl>
          </section>

          <section class="ff-panel ff-shortcut-panel ff-utility-panel">
            <ul class="ff-hotkey-strip" aria-label="常用快捷键">
              <li><kbd>右键</kbd><span>智能命令</span></li>
              <li><kbd>A</kbd><span>移动攻击</span></li>
              <li><kbd>Ctrl 1–9</kbd><span>控制编队</span></li>
            </ul>
            <div class="ff-save-actions ff-utility-actions" aria-label="本地战况与声音">
              <button type="button" data-save-game aria-label="保存战况"><span aria-hidden="true">▣</span>保存战况</button>
              <button type="button" data-load-game aria-label="载入战况"><span aria-hidden="true">↻</span>载入战况</button>
              <button class="ff-audio-action" type="button" data-audio-action aria-pressed="false" title="音频不可用" disabled>
                <span aria-hidden="true">♪</span><span data-audio-label>音频不可用</span>
              </button>
              <button class="ff-quality-action" type="button" data-quality-action title="切换渲染画质">
                <span aria-hidden="true">◇</span><span data-quality-label>画质 高</span>
              </button>
              <button class="ff-difficulty-action" type="button" data-difficulty-action aria-haspopup="dialog" aria-controls="ff-deployment-dialog">
                <span aria-hidden="true">★</span><span data-difficulty-label>难度 标准</span>
              </button>
            </div>
            <button class="ff-help-button" type="button" aria-controls="ff-help-drawer" aria-expanded="false" aria-label="打开完整操作指南">
              <span aria-hidden="true">?</span><span>展开完整操作指南</span>
            </button>
          </section>
        </aside>

        <aside id="ff-right-rail" class="ff-right-rail ff-side-rail ff-panel" aria-label="战场指挥栏">
          <div class="ff-panel-heading ff-armory-heading">
            <span><small>FIELD PRODUCTION</small><strong>战场生产</strong></span>
            <span class="ff-mode-light" aria-hidden="true"></span>
            <button class="ff-rail-close" type="button" aria-label="关闭战场指挥栏">×</button>
          </div>
          <div class="ff-armory-tabs" role="tablist" aria-label="生产类别">
            <button id="ff-armory-tab-structures" class="ff-armory-tab" type="button" role="tab" aria-selected="true" aria-controls="ff-armory-panel-structures" data-armory-tab="structures"><span aria-hidden="true">▦</span><small>建筑</small></button>
            <button id="ff-armory-tab-armoury" class="ff-armory-tab" type="button" role="tab" aria-selected="false" aria-controls="ff-armory-panel-armoury" data-armory-tab="armoury" tabindex="-1"><span aria-hidden="true">⌾</span><small>防御</small></button>
            <button id="ff-armory-tab-infantry" class="ff-armory-tab" type="button" role="tab" aria-selected="false" aria-controls="ff-armory-panel-infantry" data-armory-tab="infantry" tabindex="-1"><span aria-hidden="true">♟</span><small>步兵</small></button>
            <button id="ff-armory-tab-vehicles" class="ff-armory-tab" type="button" role="tab" aria-selected="false" aria-controls="ff-armory-panel-vehicles" data-armory-tab="vehicles" tabindex="-1"><span aria-hidden="true">⬢</span><small>载具</small></button>
          </div>
          <div class="ff-ra2-queue-status" aria-live="polite">
            <span data-queue-summary>自动选择生产建筑</span>
            <span data-research-summary>0/3 科技完成</span>
          </div>
          <div class="ff-armory-scroll">
            <section id="ff-armory-panel-structures" class="ff-action-section ff-armory-panel" role="tabpanel" aria-labelledby="ff-armory-tab-structures" data-armory-panel="structures">
              <div class="ff-section-title">
                <h2>基地建筑</h2><span>完成后进入放置</span>
              </div>
              <div class="ff-action-grid" data-structure-grid></div>
            </section>
            <section id="ff-armory-panel-armoury" class="ff-action-section ff-armory-panel" role="tabpanel" aria-labelledby="ff-armory-tab-armoury" data-armory-panel="armoury" hidden>
              <div class="ff-section-title">
                <h2>基地防御</h2><span>可与建筑并行规划</span>
              </div>
              <div class="ff-action-grid" data-defense-grid></div>
              <div class="ff-section-title ff-ra2-tech-title"><h2>战术科技</h2><span>指挥核心研究</span></div>
              <div class="ff-technology-grid" data-technology-grid></div>
            </section>
            <section id="ff-armory-panel-infantry" class="ff-action-section ff-armory-panel" role="tabpanel" aria-labelledby="ff-armory-tab-infantry" data-armory-panel="infantry" hidden>
              <div class="ff-section-title">
                <h2>步兵训练</h2><span>兵营队列</span>
              </div>
              <div class="ff-action-grid" data-infantry-grid></div>
            </section>
            <section id="ff-armory-panel-vehicles" class="ff-action-section ff-armory-panel" role="tabpanel" aria-labelledby="ff-armory-tab-vehicles" data-armory-panel="vehicles" hidden>
              <div class="ff-section-title">
                <h2>载具生产</h2><span>工厂队列</span>
              </div>
              <div class="ff-action-grid" data-vehicle-grid></div>
            </section>
          </div>
          <div class="ff-context-actions">
            <button class="ff-context-cancel" type="button" data-cancel-construction hidden><span aria-hidden="true">×</span><span data-cancel-construction-label>取消当前施工</span></button>
            <button class="ff-context-cancel" type="button" data-cancel-production hidden><span aria-hidden="true">×</span><span data-cancel-production-label>取消当前生产</span></button>
            <button class="ff-context-cancel" type="button" data-cancel-research hidden><span aria-hidden="true">×</span><span data-cancel-research-label>取消当前研究</span></button>
          </div>
        </aside>

        <section class="ff-minimap-panel ff-panel" aria-label="战区雷达">
          <div class="ff-minimap-heading"><span>灰烬环线</span><small data-radar-status role="status" aria-live="polite">雷达在线</small></div>
          <canvas class="ff-minimap" width="300" height="188" role="application" tabindex="0" aria-keyshortcuts="Enter Space" aria-label="灰烬环线小地图；点击或拖动定位镜头；按 Enter 或空格定位当前小地图焦点；未探索区域由战争迷雾覆盖"></canvas>
          <div class="ff-minimap-footer"><span><i class="is-friendly"></i>友军</span><span><i class="is-hostile"></i>可见敌军</span><strong data-intel-coverage>侦察 0%</strong></div>
        </section>

        <section class="ff-command-dock ff-panel" aria-label="选择与单位命令">
          <div class="ff-selection-summary">
            <span class="ff-kicker">SELECTION</span>
            <strong data-selection-title>未选择部队</strong>
            <small data-selection-meta>在战场拖拽框选，或点击单位</small>
            <span class="ff-mode-chip" data-mode-chip>选择模式</span>
          </div>
          <div class="ff-selection-list" data-selection-list aria-live="polite"></div>
          <div class="ff-command-actions" aria-label="单位命令">
            <button type="button" data-command="move" aria-label="移动所选单位（快捷键 M）"><span aria-hidden="true">⌖</span><small>移动</small><kbd>M</kbd></button>
            <button type="button" data-command="attackMove" aria-label="命令所选单位移动攻击（快捷键 A）"><span aria-hidden="true">◈</span><small>移动攻击</small><kbd>A</kbd></button>
            <button type="button" data-command="stop" aria-label="停止所选单位当前命令（快捷键 S）"><span aria-hidden="true">■</span><small>停止</small><kbd>S</kbd></button>
          </div>
        </section>

        <div class="ff-toast-region" aria-live="polite" aria-atomic="false"></div>

        <aside id="ff-help-drawer" class="ff-help-drawer ff-panel" role="dialog" aria-modal="false" aria-labelledby="ff-help-title" aria-hidden="true">
          <div class="ff-help-header">
            <span><small>TACTICAL HANDBOOK</small><strong id="ff-help-title">战术操作指南</strong></span>
            <button type="button" class="ff-help-close" aria-label="关闭操作指南">×</button>
          </div>
          <div class="ff-help-content">
            <p>镜头固定朝向，所有战斗都发生在同一平面。让侦察、经济与联合兵种保持同一节奏。</p>
            <section><h2>选择与镜头</h2><dl><div><dt>左键 / 拖拽</dt><dd>选择单个或框选多个单位</dd></div><div><dt>Shift + 选择</dt><dd>追加或移出当前选择</dd></div><div><dt>方向键 / 边缘</dt><dd>平移战术镜头</dd></div><div><dt>滚轮</dt><dd>缩放战场</dd></div></dl></section>
            <section><h2>下达命令</h2><dl><div><dt>右键地面</dt><dd>编队移动；建筑选择时设置集结点</dd></div><div><dt>右键敌军</dt><dd>集中攻击目标</dd></div><div><dt>工兵右键友军</dt><dd>消耗辉晶维修受损单位或建筑</dd></div><div><dt>A 后右键</dt><dd>沿途交战并推进</dd></div><div><dt>S / H</dt><dd>立即停止当前命令</dd></div></dl></section>
            <section><h2>基地运营</h2><dl><div><dt>B</dt><dd>快速进入反应堆放置模式</dd></div><div><dt>R</dt><dd>旋转待放置建筑</dd></div><div><dt>保存 / 载入</dt><dd>以确定性命令记录保存到当前浏览器</dd></div><div><dt>Esc</dt><dd>取消放置或关闭当前抽屉</dd></div><div><dt>Ctrl + 1–9</dt><dd>保存当前控制编队</dd></div></dl></section>
          </div>
        </aside>
      </div>

      <dialog id="ff-deployment-dialog" class="ff-deployment-dialog" aria-labelledby="ff-deployment-title" aria-describedby="ff-deployment-detail">
        <div class="ff-deployment-emblem" aria-hidden="true"><i></i></div>
        <p class="ff-kicker">OPERATION BREAKTHROUGH</p>
        <h1 id="ff-deployment-title">突破战任务简报</h1>
        <p id="ff-deployment-detail">完成基地整备，突破东南防线，并在敌军最终攻势抵达前夺取信标或摧毁指挥核心。</p>
        <div class="ff-difficulty-grid" role="group" aria-label="选择作战难度">${difficultyCards}</div>
        <p class="ff-deployment-note">更改难度会重新部署本局；不同难度的本地存档互不混用。</p>
        <button type="button" class="ff-resume-deployment" data-deployment-resume hidden>
          <span>继续上次战况</span><strong>标准 · 00:00</strong>
        </button>
        <div class="ff-result-actions">
          <button type="button" class="ff-primary-button" data-deployment-start>开始新战局 · 标准</button>
          <button type="button" class="ff-secondary-button" data-deployment-cancel>返回当前战场</button>
        </div>
      </dialog>

      <dialog class="ff-result-dialog" aria-labelledby="ff-result-title" aria-describedby="ff-result-reason">
        <div class="ff-result-emblem" aria-hidden="true"><i></i></div>
        <p class="ff-kicker">BATTLE REPORT</p>
        <h1 id="ff-result-title" data-result-title>战斗结束</h1>
        <p id="ff-result-reason" data-result-reason></p>
        <div class="ff-result-metrics" data-result-metrics></div>
        <div class="ff-result-actions">
          <button type="button" class="ff-primary-button" data-result-restart>再次部署</button>
          <button type="button" class="ff-secondary-button" data-result-difficulty>更改难度</button>
          <button type="button" class="ff-secondary-button" data-result-dismiss>继续查看战场</button>
        </div>
      </dialog>
    `;

    this.root.replaceChildren(this.shell);

    this.stage = requiredElement<HTMLElement>(this.shell, '.ff-stage');
    this.minimap = requiredElement<HTMLCanvasElement>(this.shell, '.ff-minimap');
    this.creditValue = requiredElement(this.shell, '[data-credit]');
    this.incomeValue = requiredElement(this.shell, '[data-income]');
    this.powerValue = requiredElement(this.shell, '[data-power]');
    this.powerDetail = requiredElement(this.shell, '[data-power-detail]');
    this.powerFill = requiredElement(this.shell, '[data-power-fill]');
    this.bandwidthValue = requiredElement(this.shell, '[data-bandwidth]');
    this.bandwidthFill = requiredElement(this.shell, '[data-bandwidth-fill]');
    this.timerValue = requiredElement(this.shell, '[data-timer]');
    this.topObjective = requiredElement(this.shell, '[data-top-objective]');
    this.taskSummary = requiredElement(this.shell, '[data-task-summary]');
    this.tacticalPauseChip = requiredElement(this.shell, '[data-tactical-pause]');
    this.battleState = requiredElement(this.shell, '[data-battle-state]');
    this.objectiveTitle = requiredElement(this.shell, '[data-objective-title]');
    this.objectiveDetail = requiredElement(this.shell, '[data-objective-detail]');
    this.objectiveFill = requiredElement(this.shell, '[data-objective-fill]');
    this.objectiveProgress = requiredElement(this.shell, '[data-objective-progress]');
    this.objectiveMeterLabel = requiredElement(this.shell, '[data-objective-meter-label]');
    this.missionActionButton = requiredElement<HTMLButtonElement>(this.shell, '[data-mission-action]');
    this.enemyCoreValue = requiredElement(this.shell, '[data-enemy-core]');
    this.networkValue = requiredElement(this.shell, '[data-network]');
    this.intelContactsValue = requiredElement(this.shell, '[data-intel-contacts]');
    this.radarStatus = requiredElement(this.shell, '[data-radar-status]');
    this.intelCoverage = requiredElement(this.shell, '[data-intel-coverage]');
    this.queueSummary = requiredElement(this.shell, '[data-queue-summary]');
    this.researchSummary = requiredElement(this.shell, '[data-research-summary]');
    this.structureGrid = requiredElement(this.shell, '[data-structure-grid]');
    this.defenseGrid = requiredElement(this.shell, '[data-defense-grid]');
    this.infantryGrid = requiredElement(this.shell, '[data-infantry-grid]');
    this.vehicleGrid = requiredElement(this.shell, '[data-vehicle-grid]');
    this.technologyGrid = requiredElement(this.shell, '[data-technology-grid]');
    this.cancelConstructionButton = requiredElement<HTMLButtonElement>(this.shell, '[data-cancel-construction]');
    this.cancelProductionButton = requiredElement<HTMLButtonElement>(this.shell, '[data-cancel-production]');
    this.cancelResearchButton = requiredElement<HTMLButtonElement>(this.shell, '[data-cancel-research]');
    this.cancelConstructionLabel = requiredElement(this.cancelConstructionButton, '[data-cancel-construction-label]');
    this.cancelProductionLabel = requiredElement(this.cancelProductionButton, '[data-cancel-production-label]');
    this.cancelResearchLabel = requiredElement(this.cancelResearchButton, '[data-cancel-research-label]');
    this.leftRail = requiredElement(this.shell, '#ff-left-rail');
    this.rightRail = requiredElement(this.shell, '#ff-right-rail');
    this.minimapPanel = requiredElement(this.shell, '.ff-minimap-panel');
    this.utilityPanel = requiredElement(this.shell, '.ff-utility-panel');
    this.railScrim = requiredElement<HTMLButtonElement>(this.shell, '.ff-rail-scrim');
    this.leftToggle = requiredElement<HTMLButtonElement>(this.shell, '.ff-drawer-toggle-left');
    this.rightToggle = requiredElement<HTMLButtonElement>(this.shell, '.ff-drawer-toggle-right');
    this.armoryTabList = requiredElement(this.rightRail, '.ff-armory-tabs');
    for (const tab of ARMORY_TAB_ORDER) {
      this.armoryTabs.set(
        tab,
        requiredElement<HTMLButtonElement>(this.armoryTabList, `[data-armory-tab="${tab}"]`),
      );
      this.armoryPanels.set(
        tab,
        requiredElement<HTMLElement>(this.rightRail, `[data-armory-panel="${tab}"]`),
      );
    }
    this.helpToggle = requiredElement<HTMLButtonElement>(this.shell, '.ff-help-button');
    this.helpDrawer = requiredElement(this.shell, '#ff-help-drawer');
    this.helpClose = requiredElement<HTMLButtonElement>(this.shell, '.ff-help-close');
    this.helpDrawer.inert = true;
    this.selectionTitle = requiredElement(this.shell, '[data-selection-title]');
    this.selectionMeta = requiredElement(this.shell, '[data-selection-meta]');
    this.selectionList = requiredElement(this.shell, '[data-selection-list]');
    this.modeChip = requiredElement(this.shell, '[data-mode-chip]');
    this.moveButton = requiredElement<HTMLButtonElement>(this.shell, '[data-command="move"]');
    this.attackMoveButton = requiredElement<HTMLButtonElement>(this.shell, '[data-command="attackMove"]');
    this.stopButton = requiredElement<HTMLButtonElement>(this.shell, '[data-command="stop"]');
    this.audioButton = requiredElement<HTMLButtonElement>(this.shell, '[data-audio-action]');
    this.audioLabel = requiredElement(this.audioButton, '[data-audio-label]');
    this.qualityButton = requiredElement<HTMLButtonElement>(this.shell, '[data-quality-action]');
    this.qualityLabel = requiredElement(this.qualityButton, '[data-quality-label]');
    this.selectionBox = requiredElement(this.shell, '.ff-selection-box');
    this.toastRegion = requiredElement(this.shell, '.ff-toast-region');
    this.fallback = requiredElement(this.shell, '.ff-webgl-fallback');
    this.fallbackMessage = requiredElement(this.shell, '.ff-fallback-message');
    this.resultDialog = requiredElement<HTMLDialogElement>(this.shell, '.ff-result-dialog');
    this.resultTitle = requiredElement(this.shell, '[data-result-title]');
    this.resultReason = requiredElement(this.shell, '[data-result-reason]');
    this.resultMetrics = requiredElement(this.shell, '[data-result-metrics]');
    this.deploymentDialog = requiredElement<HTMLDialogElement>(this.shell, '.ff-deployment-dialog');
    this.deploymentStartButton = requiredElement<HTMLButtonElement>(this.deploymentDialog, '[data-deployment-start]');
    this.deploymentCancelButton = requiredElement<HTMLButtonElement>(this.deploymentDialog, '[data-deployment-cancel]');
    this.deploymentResumeButton = requiredElement<HTMLButtonElement>(this.deploymentDialog, '[data-deployment-resume]');
    this.difficultyButton = requiredElement<HTMLButtonElement>(this.shell, '[data-difficulty-action]');
    this.difficultyLabel = requiredElement(this.difficultyButton, '[data-difficulty-label]');
    this.resultDifficultyButton = requiredElement<HTMLButtonElement>(this.resultDialog, '[data-result-difficulty]');
    for (const id of BREAKTHROUGH_DIFFICULTY_ORDER) {
      this.deploymentCards.set(
        id,
        requiredElement<HTMLButtonElement>(this.deploymentDialog, `[data-difficulty="${id}"]`),
      );
    }

    const difficultyDefinition = BREAKTHROUGH_DIFFICULTIES[this.difficultyId];
    const difficultyAvailable = supportsBreakthroughDifficultyFixture(this.fixture)
      && Boolean(this.callbacks.onDeployDifficulty);
    this.shell.dataset.difficulty = this.difficultyId;
    setText(this.difficultyLabel, `难度 ${difficultyDefinition.shortLabel}`);
    this.difficultyButton.setAttribute('aria-label', `当前${difficultyDefinition.label}；重新部署并更改难度`);
    this.difficultyButton.hidden = !difficultyAvailable;
    this.resultDifficultyButton.hidden = !difficultyAvailable;
    if (this.resumeDeployment) {
      setText(
        requiredElement(this.deploymentResumeButton, 'strong'),
        `${this.resumeDeployment.difficultyLabel} · ${formatTime(this.resumeDeployment.elapsedSeconds)}`,
      );
      this.deploymentResumeButton.setAttribute(
        'aria-label',
        `继续上次战况，${this.resumeDeployment.difficultyLabel}，作战时间 ${formatTime(this.resumeDeployment.elapsedSeconds)}`,
      );
    }
    setText(
      requiredElement<HTMLButtonElement>(this.resultDialog, '[data-result-restart]'),
      `按${difficultyDefinition.shortLabel}再次部署`,
    );
    this.updateDeploymentSelection(this.difficultyId);

    this.populateActionGrids();
    this.setActiveArmoryTab(this.activeArmoryTab);
    this.bindInteractions();
    this.setAudioState({ available: Boolean(callbacks.onAudioAction), muted: false, unlocked: false });

    this.overlayRailMedia = typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 1180px)')
      : null;
    this.overlayRailMedia?.addEventListener('change', () => this.syncResponsiveState(), {
      signal: this.abortController.signal,
    });
    this.syncResponsiveState();

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.lastMinimapKey = '';
        this.drawMinimap();
      });
      this.resizeObserver.observe(this.minimap);
    }
  }

  render(state: GameState, selectedIds: Set<string>, interactionMode: string): void {
    if (this.disposed) return;
    if (state.tick < this.lastRenderedTick) {
      this.seenNotifications.clear();
      this.dismissedResultKey = '';
      this.lastSelectionSignature = '';
      this.lastMinimapKey = '';
    }
    this.lastRenderedTick = state.tick;
    this.lastState = state;
    this.lastSelection = new Set(selectedIds);
    this.root.dataset.gameStatus = state.status;
    this.root.dataset.interactionMode = interactionMode;
    this.root.dataset.missionKind = state.mission.kind;
    this.root.dataset.missionPhase = state.mission.phase;

    const player = state.economy.player;
    setText(this.creditValue, formatCredits(player.credits));
    setText(this.incomeValue, `${player.incomePerMinute >= 0 ? '+' : ''}${formatCredits(player.incomePerMinute)} / 分`);
    setText(this.powerValue, `${formatCredits(player.powerSupply)} / ${formatCredits(player.powerDemand)}`);
    const powerPercent = Math.round(clamp(player.powerRatio) * 100);
    setText(this.powerDetail, `${powerPercent}%`);
    this.powerFill.style.width = `${powerPercent}%`;
    const powerState = powerPercent < 80 ? 'danger' : powerPercent < 100 ? 'warning' : 'stable';
    this.powerValue.closest('.ff-stat')?.setAttribute('data-state', powerState);

    setText(this.bandwidthValue, `${formatCredits(player.bandwidthUsed)} / ${formatCredits(player.bandwidthCap)}`);
    const bandwidthRatio = player.bandwidthCap > 0 ? player.bandwidthUsed / player.bandwidthCap : 0;
    this.bandwidthFill.style.width = `${Math.round(clamp(bandwidthRatio) * 100)}%`;
    setText(this.timerValue, formatTime(state.elapsed));

    this.renderObjectives(state);
    this.renderActions(state, selectedIds, interactionMode);
    this.renderSelection(state, selectedIds, interactionMode);
    this.renderNotifications(state);
    this.renderResult(state);
    this.drawMinimap();
  }

  setAudioState(state: HUDAudioState): void {
    if (this.disposed) return;
    const available = state.available && Boolean(this.callbacks.onAudioAction);
    const label = !available
      ? '音频不可用'
      : state.muted
        ? '恢复声音'
        : !state.unlocked
          ? '启用声音'
          : '静音';
    this.audioButton.disabled = !available;
    this.audioButton.dataset.state = !available ? 'unavailable' : state.muted ? 'muted' : !state.unlocked ? 'locked' : 'active';
    this.audioButton.setAttribute('aria-pressed', String(available && state.muted));
    this.audioButton.setAttribute('aria-label', label);
    this.audioButton.title = label;
    setText(this.audioLabel, label);
  }

  setRenderQualityState(level: RenderQualityLevel): void {
    if (this.disposed) return;
    const label = level === 'high' ? '画质 高' : level === 'medium' ? '画质 中' : '画质 低';
    const next = level === 'high' ? '中' : level === 'medium' ? '低' : '高';
    this.qualityButton.dataset.quality = level;
    this.qualityButton.setAttribute('aria-label', `${label}，点击切换到${next}画质`);
    this.qualityButton.title = `${label} · 点击切换`;
    setText(this.qualityLabel, label);
  }

  setSelectionBox(rect: ClientSelectionRect | null): void {
    if (!rect) {
      this.selectionBox.hidden = true;
      return;
    }
    const stageRect = this.stage.getBoundingClientRect();
    const clientLeft = Math.max(stageRect.left, Math.min(rect.left, rect.right));
    const clientTop = Math.max(stageRect.top, Math.min(rect.top, rect.bottom));
    const clientRight = Math.min(stageRect.right, Math.max(rect.left, rect.right));
    const clientBottom = Math.min(stageRect.bottom, Math.max(rect.top, rect.bottom));
    const width = Math.max(0, clientRight - clientLeft);
    const height = Math.max(0, clientBottom - clientTop);
    if (width < 1 || height < 1) {
      this.selectionBox.hidden = true;
      return;
    }
    this.selectionBox.hidden = false;
    this.selectionBox.style.transform = `translate3d(${clientLeft - stageRect.left}px, ${clientTop - stageRect.top}px, 0)`;
    this.selectionBox.style.width = `${width}px`;
    this.selectionBox.style.height = `${height}px`;
  }

  toast(text: string, tone: HUDTone = 'info'): void {
    if (this.disposed || !text.trim()) return;
    const toast = createElement('button', 'ff-toast');
    toast.type = 'button';
    toast.dataset.tone = tone;
    toast.setAttribute('aria-label', `${tone === 'danger' ? '严重警报' : '战术提示'}：${text}。点击关闭`);
    if (tone === 'danger') toast.setAttribute('role', 'alert');

    const mark = createElement('span', 'ff-toast-mark', tone === 'success' ? '✓' : tone === 'danger' ? '!' : tone === 'warning' ? '△' : '•');
    mark.setAttribute('aria-hidden', 'true');
    const copy = createElement('span', 'ff-toast-copy');
    copy.append(createElement('small', undefined, tone === 'danger' ? 'CRITICAL' : tone === 'warning' ? 'CAUTION' : tone === 'success' ? 'CONFIRMED' : 'TACTICAL'), createElement('strong', undefined, text));
    toast.append(mark, copy);
    this.toastRegion.append(toast);

    const remove = (): void => this.removeToast(toast);
    toast.addEventListener('click', remove, { signal: this.abortController.signal });
    const timeout = window.setTimeout(remove, tone === 'danger' ? 5200 : 3800);
    this.toastTimers.set(toast, timeout);

    while (this.toastRegion.childElementCount > 4) {
      const oldest = this.toastRegion.firstElementChild;
      if (oldest instanceof HTMLElement) this.removeToast(oldest);
      else break;
    }
  }

  setWebglFallback(message: string): void {
    const visible = message.trim().length > 0;
    this.fallback.hidden = !visible;
    this.stage.classList.toggle('has-webgl-fallback', visible);
    if (visible) setText(this.fallbackMessage, message);
  }

  disableResumeDeployment(): void {
    this.resumeDeploymentAvailable = false;
    this.deploymentResumeButton.hidden = true;
    this.deploymentResumeButton.disabled = true;
  }

  showDeploymentBriefing(mode: 'initial' | 'change' = 'change'): void {
    if (
      this.disposed
      || !this.callbacks.onDeployDifficulty
      || !supportsBreakthroughDifficultyFixture(this.fixture)
      || this.deploymentDialog.open
    ) return;

    this.deploymentMode = mode;
    this.deploymentDialog.dataset.mode = mode;
    this.deploymentCancelButton.hidden = mode === 'initial';
    this.deploymentResumeButton.hidden = mode !== 'initial'
      || !this.resumeDeploymentAvailable;
    this.deploymentResumeButton.disabled = !this.resumeDeploymentAvailable;
    this.deploymentDialog.setAttribute('aria-label', mode === 'initial'
      ? '选择难度并开始突破战'
      : '重新部署并更改难度');
    this.updateDeploymentSelection(this.difficultyId);

    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.lastFocusedBeforeDeployment = focused && !this.resultDialog.contains(focused)
      ? focused
      : this.difficultyButton;
    if (this.helpDrawer.classList.contains('is-open')) this.setHelpOpen(false, false);
    this.closeOverlayRails(false);
    try {
      this.deploymentDialog.showModal();
    } catch {
      this.deploymentDialog.setAttribute('open', '');
    }
    this.syncTacticalOverlayPauseState();
    window.requestAnimationFrame(() => {
      if (mode === 'initial' && this.resumeDeploymentAvailable) this.deploymentResumeButton.focus();
      else this.deploymentCards.get(this.deploymentSelectedDifficulty)?.focus();
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.abortController.abort();
    this.resizeObserver?.disconnect();
    for (const timeout of this.toastTimers.values()) window.clearTimeout(timeout);
    this.toastTimers.clear();
    if (this.deploymentDialog.open) this.deploymentDialog.close();
    if (this.resultDialog.open) this.resultDialog.close();
    this.shell.remove();
    this.root.classList.remove('ff-app');
    delete this.root.dataset.gameStatus;
    delete this.root.dataset.interactionMode;
  }

  private populateActionGrids(): void {
    for (const [index, kind] of BUILD_MENU.entries()) {
      const definition = BUILDING_DEFS[kind];
      const button = createElement('button', 'ff-action-card');
      button.type = 'button';
      button.dataset.kind = kind;
      button.dataset.action = 'build';
      button.setAttribute('aria-label', `建造${definition.label}，花费 ${definition.cost} 辉晶，耗时 ${definition.buildTime} 秒`);
      button.innerHTML = `
        <span class="ff-card-glyph" aria-hidden="true">${BUILD_GLYPHS[kind]}</span>
        <span class="ff-card-copy"><strong>${definition.shortLabel}</strong><small>${definition.description}</small></span>
        <span class="ff-card-cost"><b>◆ ${formatCredits(definition.cost)}</b><em>${definition.buildTime}s</em></span>
        <span class="ff-card-index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
      `;
      button.addEventListener('click', () => this.callbacks.onBuild(kind), { signal: this.abortController.signal });
      (DEFENSE_BUILD_KINDS.has(kind) ? this.defenseGrid : this.structureGrid).append(button);
      this.buildButtons.set(kind, button);
    }

    for (const kind of UNIT_MENU) {
      const definition = UNIT_DEFS[kind];
      const button = createElement('button', 'ff-action-card ff-unit-card');
      button.type = 'button';
      button.dataset.kind = kind;
      button.dataset.action = 'produce';
      button.setAttribute('aria-label', `生产${definition.label}，花费 ${definition.cost} 辉晶，占用 ${definition.bandwidth} 带宽`);
      button.innerHTML = `
        <span class="ff-card-glyph" aria-hidden="true">${UNIT_GLYPHS[kind]}</span>
        <span class="ff-card-copy"><strong>${definition.shortLabel}</strong><small class="ff-card-requirement">${definition.targetRole}</small></span>
        <span class="ff-card-cost"><b>◆ ${formatCredits(definition.cost)}</b><em>⌬ ${definition.bandwidth}</em></span>
        <span class="ff-card-badge" aria-label="生产队列数量"></span>
      `;
      const badge = requiredElement<HTMLElement>(button, '.ff-card-badge');
      const requirement = requiredElement<HTMLElement>(button, '.ff-card-requirement');
      button.addEventListener('click', () => this.callbacks.onProduce(kind), { signal: this.abortController.signal });
      (INFANTRY_UNIT_KINDS.has(kind) ? this.infantryGrid : this.vehicleGrid).append(button);
      this.productionButtons.set(kind, { button, badge, requirement });
    }

    for (const kind of TECHNOLOGY_KINDS) {
      const definition = TECHNOLOGY_DEFS[kind];
      const button = createElement('button', 'ff-action-card ff-tech-card');
      button.type = 'button';
      button.dataset.kind = kind;
      button.dataset.action = 'research';
      button.setAttribute(
        'aria-label',
        `研究${definition.label}，花费 ${definition.cost} 辉晶，耗时 ${definition.durationSeconds} 秒`,
      );
      button.innerHTML = `
        <span class="ff-card-glyph" aria-hidden="true">${TECHNOLOGY_GLYPHS[kind]}</span>
        <span class="ff-card-copy"><strong>${definition.label}</strong><small>${definition.description}</small></span>
        <span class="ff-card-cost"><b>◆ ${formatCredits(definition.cost)}</b><em class="ff-tech-status">${definition.durationSeconds}s</em></span>
        <span class="ff-tech-progress" role="progressbar" aria-label="${definition.label}研究进度" aria-valuemin="0" aria-valuemax="100" hidden><i></i></span>
      `;
      const status = requiredElement<HTMLElement>(button, '.ff-tech-status');
      const progress = requiredElement<HTMLElement>(button, '.ff-tech-progress');
      const progressFill = requiredElement<HTMLElement>(button, '.ff-tech-progress i');
      button.addEventListener('click', () => this.callbacks.onResearch?.(kind), {
        signal: this.abortController.signal,
      });
      this.technologyGrid.append(button);
      this.technologyButtons.set(kind, { button, status, progress, progressFill });
    }
  }

  private bindInteractions(): void {
    const signal = this.abortController.signal;
    this.minimap.addEventListener('pointerdown', (event) => {
      if (!isPrimaryMinimapPointer(event.button, event.isPrimary)) return;
      event.preventDefault();
      event.stopPropagation();
      this.minimapPointerId = event.pointerId;
      this.minimap.setPointerCapture(event.pointerId);
      this.minimap.focus({ preventScroll: true });
      this.navigateMinimapAtClientPoint(event.clientX, event.clientY);
    }, { signal });
    this.minimap.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.minimapPointerId) return;
      event.preventDefault();
      event.stopPropagation();
      if ((event.buttons & 1) === 0) {
        this.finishMinimapPointer(event.pointerId);
        return;
      }
      this.navigateMinimapAtClientPoint(event.clientX, event.clientY);
    }, { signal });
    this.minimap.addEventListener('pointerup', (event) => {
      if (event.pointerId !== this.minimapPointerId) return;
      event.preventDefault();
      event.stopPropagation();
      this.navigateMinimapAtClientPoint(event.clientX, event.clientY);
      this.finishMinimapPointer(event.pointerId);
    }, { signal });
    this.minimap.addEventListener('pointercancel', (event) => {
      if (event.pointerId !== this.minimapPointerId) return;
      event.preventDefault();
      event.stopPropagation();
      this.finishMinimapPointer(event.pointerId);
    }, { signal });
    this.minimap.addEventListener('lostpointercapture', (event) => {
      if (event.pointerId === this.minimapPointerId) this.minimapPointerId = null;
    }, { signal });
    this.minimap.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      this.callbacks.onMinimapNavigate({ ...this.minimapNavigationPoint });
    }, { signal });
    this.minimap.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
    }, { signal });
    this.minimap.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
    }, { signal });
    this.moveButton.addEventListener('click', () => this.callbacks.onCommand('move'), { signal });
    this.attackMoveButton.addEventListener('click', () => this.callbacks.onCommand('attackMove'), { signal });
    this.stopButton.addEventListener('click', () => this.callbacks.onCommand('stop'), { signal });
    requiredElement<HTMLButtonElement>(this.shell, '[data-save-game]').addEventListener('click', () => this.callbacks.onSave(), { signal });
    requiredElement<HTMLButtonElement>(this.shell, '[data-load-game]').addEventListener('click', () => this.callbacks.onLoad(), { signal });
    this.audioButton.addEventListener('click', () => this.callbacks.onAudioAction?.(), { signal });
    this.qualityButton.addEventListener('click', () => this.callbacks.onQualityAction?.(), { signal });
    this.cancelConstructionButton.addEventListener('click', () => {
      const buildingId = this.cancelConstructionButton.dataset.buildingId;
      if (buildingId) this.callbacks.onCancelConstruction?.(buildingId);
    }, { signal });
    this.cancelProductionButton.addEventListener('click', () => {
      const buildingId = this.cancelProductionButton.dataset.buildingId;
      if (buildingId) this.callbacks.onCancelProduction?.(buildingId);
    }, { signal });
    this.cancelResearchButton.addEventListener('click', () => this.callbacks.onCancelResearch?.(), { signal });

    this.selectionList.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest<HTMLButtonElement>('[data-entity-id]');
      const id = button?.dataset.entityId;
      if (id) this.callbacks.onSelectEntity(id);
    }, { signal });

    this.armoryTabList.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest<HTMLButtonElement>('[data-armory-tab]');
      const tab = button?.dataset.armoryTab as ArmoryTab | undefined;
      if (tab && this.armoryTabs.has(tab)) this.setActiveArmoryTab(tab);
    }, { signal });
    this.armoryTabList.addEventListener('keydown', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest<HTMLButtonElement>('[data-armory-tab]');
      const current = button?.dataset.armoryTab as ArmoryTab | undefined;
      if (!current || !this.armoryTabs.has(current)) return;

      const currentIndex = ARMORY_TAB_ORDER.indexOf(current);
      let nextIndex: number | null = null;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        nextIndex = (currentIndex + 1) % ARMORY_TAB_ORDER.length;
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        nextIndex = (currentIndex - 1 + ARMORY_TAB_ORDER.length) % ARMORY_TAB_ORDER.length;
      } else if (event.key === 'Home') {
        nextIndex = 0;
      } else if (event.key === 'End') {
        nextIndex = ARMORY_TAB_ORDER.length - 1;
      }
      if (nextIndex === null) return;

      event.preventDefault();
      const next = ARMORY_TAB_ORDER[nextIndex];
      if (next) this.setActiveArmoryTab(next, true);
    }, { signal });

    this.missionActionButton.addEventListener('click', () => {
      const action = this.missionActionButton.dataset.missionAction as BreakthroughPreparationAction | undefined;
      if (action === 'build-sentry') {
        this.setActiveArmoryTab('armoury');
        this.closeOverlayRails(false);
        this.callbacks.onBuild('sentry');
        return;
      }
      if (action !== 'open-vehicles') return;
      this.setActiveArmoryTab('vehicles');
      if (this.isOverlayRail('right')) {
        this.leftRailOpen = false;
        this.rightRailOpen = true;
        this.syncResponsiveState();
        window.requestAnimationFrame(() => this.armoryTabs.get('vehicles')?.focus());
      } else {
        this.closeOverlayRails(false);
        this.armoryTabs.get('vehicles')?.focus();
      }
    }, { signal });

    this.leftToggle.addEventListener('click', () => this.toggleRail('left'), { signal });
    this.rightToggle.addEventListener('click', () => this.toggleRail('right'), { signal });
    this.railScrim.addEventListener('click', () => this.closeOverlayRails(true), { signal });
    requiredElement<HTMLButtonElement>(this.leftRail, '.ff-rail-close').addEventListener('click', () => this.closeOverlayRails(true), { signal });
    requiredElement<HTMLButtonElement>(this.rightRail, '.ff-rail-close').addEventListener('click', () => this.closeOverlayRails(true), { signal });

    this.helpToggle.addEventListener('click', () => this.setHelpOpen(true), { signal });
    this.helpClose.addEventListener('click', () => this.setHelpOpen(false), { signal });
    this.difficultyButton.addEventListener('click', () => this.showDeploymentBriefing('change'), { signal });

    for (const [index, id] of BREAKTHROUGH_DIFFICULTY_ORDER.entries()) {
      const card = this.deploymentCards.get(id);
      if (!card) continue;
      card.addEventListener('click', () => this.updateDeploymentSelection(id), { signal });
      card.addEventListener('keydown', (event) => {
        let nextIndex: number | null = null;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          nextIndex = (index + 1) % BREAKTHROUGH_DIFFICULTY_ORDER.length;
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          nextIndex = (index - 1 + BREAKTHROUGH_DIFFICULTY_ORDER.length) % BREAKTHROUGH_DIFFICULTY_ORDER.length;
        } else if (event.key === 'Home') {
          nextIndex = 0;
        } else if (event.key === 'End') {
          nextIndex = BREAKTHROUGH_DIFFICULTY_ORDER.length - 1;
        }
        if (nextIndex === null) return;
        event.preventDefault();
        const next = BREAKTHROUGH_DIFFICULTY_ORDER[nextIndex];
        if (!next) return;
        this.updateDeploymentSelection(next);
        this.deploymentCards.get(next)?.focus();
      }, { signal });
    }
    this.deploymentStartButton.addEventListener('click', () => {
      const startedInPlace = this.callbacks.onDeployDifficulty?.(
        this.deploymentSelectedDifficulty,
        this.deploymentMode,
      ) === true;
      if (!startedInPlace) return;
      this.closeDeploymentBriefing(false);
      window.requestAnimationFrame(() => this.leftToggle.focus());
    }, { signal });
    this.deploymentResumeButton.addEventListener('click', () => {
      this.callbacks.onResumeSavedDeployment?.();
    }, { signal });
    this.deploymentCancelButton.addEventListener('click', () => this.closeDeploymentBriefing(true), { signal });
    this.deploymentDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      if (this.deploymentMode === 'change') this.closeDeploymentBriefing(true);
    }, { signal });

    this.stage.addEventListener('pointerdown', () => {
      if (this.leftRailOpen || this.rightRailOpen) this.closeOverlayRails(false);
    }, { signal });

    document.addEventListener('keydown', (event) => {
      if (this.deploymentDialog.open) return;
      if (this.resultDialog.open) return;
      if (event.key === 'Tab' && this.trapOverlayFocus(event)) return;
      if (event.key !== 'Escape') return;
      if (this.helpDrawer.classList.contains('is-open')) {
        event.stopPropagation();
        this.setHelpOpen(false);
        return;
      }
      if (this.leftRailOpen || this.rightRailOpen) this.closeOverlayRails(true);
    }, { signal, capture: true });

    const restartButton = requiredElement<HTMLButtonElement>(this.resultDialog, '[data-result-restart]');
    const dismissButton = requiredElement<HTMLButtonElement>(this.resultDialog, '[data-result-dismiss]');
    restartButton.addEventListener('click', () => {
      this.dismissCurrentResult();
      this.callbacks.onRestart();
    }, { signal });
    this.resultDifficultyButton.addEventListener('click', () => {
      this.deploymentReopensResult = true;
      if (this.resultDialog.open) this.resultDialog.close();
      this.showDeploymentBriefing('change');
    }, { signal });
    dismissButton.addEventListener('click', () => this.dismissCurrentResult(), { signal });
    this.resultDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      this.dismissCurrentResult();
    }, { signal });
  }

  private navigateMinimapAtClientPoint(clientX: number, clientY: number): void {
    const point = minimapClientPointToNormalized(clientX, clientY, this.minimap.getBoundingClientRect());
    if (!point) return;
    this.minimapNavigationPoint = point;
    this.callbacks.onMinimapNavigate({ ...point });
  }

  private finishMinimapPointer(pointerId: number): void {
    if (this.minimapPointerId !== pointerId) return;
    this.minimapPointerId = null;
    if (this.minimap.hasPointerCapture(pointerId)) this.minimap.releasePointerCapture(pointerId);
  }

  private renderObjectives(state: GameState): void {
    this.missionActionButton.hidden = true;
    this.missionActionButton.disabled = true;
    delete this.missionActionButton.dataset.missionAction;
    setText(this.objectiveMeterLabel, state.mission.kind === 'breakthrough' ? '战役阶段' : '中央信标');
    const enemyCore = state.buildings.find((building) => building.team === 'enemy' && building.kind === 'hq');
    const enemyCorePercent = enemyCore ? Math.round(clamp(enemyCore.hp / enemyCore.maxHp) * 100) : 0;
    const playerIntel = state.intel.player;
    const visibleEnemyIds = new Set(playerIntel.visibleEnemyIds);
    const visibleEnemyCount = [...state.units, ...state.buildings]
      .filter((entity) => entity.team === 'enemy' && visibleEnemyIds.has(entity.id)).length;
    const totalIntelCells = Math.max(1, playerIntel.visibility.width * playerIntel.visibility.height);
    const exploredPercent = Math.round(clamp(playerIntel.visibility.explored.length / totalIntelCells) * 100);
    const enemyCoreVisible = enemyCore ? visibleEnemyIds.has(enemyCore.id) : false;

    if (!enemyCore) {
      setText(this.enemyCoreValue, '已摧毁');
      this.enemyCoreValue.dataset.state = 'success';
      this.enemyCoreValue.title = '敌方指挥核心已从战场移除';
    } else if (!enemyCoreVisible) {
      setText(this.enemyCoreValue, '未侦测');
      this.enemyCoreValue.dataset.state = 'unknown';
      this.enemyCoreValue.title = '敌方核心当前不在我方视野内，结构状态未知';
    } else {
      setText(this.enemyCoreValue, `${enemyCorePercent}%`);
      this.enemyCoreValue.dataset.state = enemyCorePercent <= 30 ? 'danger' : 'stable';
      this.enemyCoreValue.title = `最近侦测到的结构完整度 ${enemyCorePercent}%`;
    }

    setText(this.radarStatus, playerIntel.radarOnline ? '雷达在线' : '雷达离线');
    this.radarStatus.dataset.state = playerIntel.radarOnline ? 'online' : 'offline';
    setText(this.intelCoverage, `侦察 ${exploredPercent}%`);
    if (visibleEnemyCount > 0) {
      setText(this.intelContactsValue, `${visibleEnemyCount} 个接触`);
      this.intelContactsValue.dataset.state = 'danger';
      this.intelContactsValue.title = `${visibleEnemyCount} 个敌方目标处于当前共享视野`;
    } else {
      setText(this.intelContactsValue, playerIntel.radarOnline ? '无接触' : '链路受限');
      this.intelContactsValue.dataset.state = playerIntel.radarOnline ? 'stable' : 'warning';
      this.intelContactsValue.title = playerIntel.radarOnline
        ? `当前无敌方接触，已探索战区 ${exploredPercent}%`
        : `远程雷达不可用，仍共享单位目视情报；已探索战区 ${exploredPercent}%`;
    }

    const connectedBuildings = state.buildings.filter((building) => building.team === 'player' && building.connected).length;
    const playerBuildings = state.buildings.filter((building) => building.team === 'player').length;
    const networkHealthy = playerBuildings === 0 ? 0 : connectedBuildings / playerBuildings;
    setText(this.networkValue, networkHealthy >= 1 ? '稳定' : networkHealthy >= 0.6 ? '降级' : '中断');
    this.networkValue.dataset.state = networkHealthy >= 1 ? 'stable' : networkHealthy >= 0.6 ? 'warning' : 'danger';

    if (state.status !== 'active') {
      const victory = state.status === 'victory';
      setText(this.battleState, victory ? '任务完成' : '战线失守');
      this.battleState.dataset.state = victory ? 'success' : 'danger';
      setText(this.objectiveTitle, victory ? '战术目标已完成' : '指挥链路已终止');
      setText(this.objectiveDetail, state.statusReason || (victory ? '灰烬环线已进入我方控制。' : '重整部署后再次进入战区。'));
    } else {
      setText(this.battleState, '作战中');
      this.battleState.dataset.state = 'active';
      setText(this.objectiveTitle, '摧毁敌方指挥核心');
      setText(this.objectiveDetail, enemyCore
        ? enemyCoreVisible
          ? `敌方核心结构完整度 ${enemyCorePercent}%，维持采集并组织联合推进。`
          : '敌方核心尚未纳入当前视野，推进侦察网并维持采集。'
        : '敌方指挥链路已断开，等待战场结算。');
    }

    if (state.status === 'active' && state.mission.kind === 'breakthrough') {
      const phaseOrder = ['deployment', 'frontline', 'counterattack', 'reinforcement', 'command'] as const;
      const phaseIndex = Math.max(0, phaseOrder.indexOf(state.mission.phase as (typeof phaseOrder)[number]));
      const stageNumber = Math.min(5, phaseIndex + 1);
      const depositReady = state.economy.player.incomePerMinute > 0;
      const sentryReady = state.buildings.some((building) => (
        building.team === 'player' && building.kind === 'sentry' && building.buildProgress >= 1 && building.hp > 0
      ));
      const producedVehicleReady = state.units.some((unit) => (
        unit.team === 'player'
        && /u-player-(?:scout|suppressor|tank|artillery)-\d{6}/.test(unit.id)
      ));
      const queuedCombatVehicle = state.buildings
        .filter((building) => building.team === 'player' && building.kind === 'factory')
        .flatMap((building) => building.queue)
        .find((item) => item.unitKind !== 'harvester');
      const preparationGuide = breakthroughPreparationGuide(
        depositReady,
        sentryReady,
        producedVehicleReady,
        queuedCombatVehicle?.remaining ?? null,
      );
      const readinessCount = Number(depositReady) + Number(sentryReady) + Number(producedVehicleReady);
      const frontlineDefenses = state.buildings.filter((building) => (
        building.id === 'b-break-enemy-sentry' || building.id === 'b-break-enemy-cannon'
      ));
      const defenseMaxHp = frontlineDefenses.reduce((total, building) => total + building.maxHp, 0);
      const defenseHp = frontlineDefenses.reduce((total, building) => total + Math.max(0, building.hp), 0);
      const defensePercent = defenseMaxHp > 0 ? Math.round(clamp(defenseHp / defenseMaxHp) * 100) : 0;
      const counterattackAlive = state.mission.counterattackUnitIds.filter((id) => (
        state.units.some((unit) => unit.id === id && unit.hp > 0)
      )).length;
      const finalAssaultScheduled = state.mission.counterattackUnitIds.length > 3;
      const finalAssaultAlive = finalAssaultScheduled
        ? state.mission.counterattackUnitIds.filter((id) => (
            state.units.some((unit) => unit.id === id && unit.team === 'enemy' && unit.hp > 0)
          )).length
        : 0;
      const reinforcementAlive = state.mission.reinforcementUnitIds.filter((id) => (
        state.units.some((unit) => unit.id === id && unit.hp > 0)
      )).length;
      const missionCopy: Record<(typeof phaseOrder)[number], { title: string; detail: string; top: string }> = {
        deployment: {
          title: '完成基地战前整备',
          detail: preparationGuide.detail,
          top: `战前整备 ${readinessCount}/3`,
        },
        frontline: {
          title: '突破敌军前沿炮塔',
          detail: `选中编队，按 A 后右键东南防线；防御完整度 ${defensePercent}%。`,
          top: '突破前沿',
        },
        counterattack: {
          title: '击退敌军装甲反扑',
          detail: `反扑单位 ${counterattackAlive} 个仍在作战；保持坦克在前、炮兵在后。`,
          top: '装甲反扑',
        },
        reinforcement: {
          title: '接应西北方向友军增援',
          detail: `${reinforcementAlive} 个增援单位已进入战区，正在向前沿集结。`,
          top: '友军抵达',
        },
        command: {
          title: '夺取信标或摧毁指挥核心',
          detail: finalAssaultScheduled && finalAssaultAlive > 0
            ? `敌军最终攻势仍有 ${finalAssaultAlive} 个单位，正向我方核心推进；立即夺取信标或完成核心打击。`
            : state.beacon.controllingTeam === 'player'
            ? `我方正在校准信标：${Math.round(state.beacon.playerProgress)}/${Math.round(state.beacon.targetProgress)} 秒。`
            : enemyCoreVisible
              ? `敌方核心结构完整度 ${enemyCorePercent}%，也可集中重炮完成最终打击。`
              : '派步兵占领中央信标，或推进侦察网定位东南指挥核心。',
          top: '最终攻坚',
        },
      };
      const phase = state.mission.phase === 'complete' ? 'command' : state.mission.phase;
      const copy = missionCopy[phase];
      setText(this.objectiveTitle, copy.title);
      setText(this.objectiveDetail, copy.detail);
      setText(this.objectiveProgress, `阶段 ${stageNumber}/5`);
      this.setObjectiveSummary(copy.top);
      const phaseProgress = phaseIndex === 0
        ? Math.round((readinessCount / 3) * 24)
        : ([36, 60, 80, 94][phaseIndex - 1] ?? 94);
      this.objectiveFill.style.width = `${phaseProgress}%`;
      this.objectiveFill.dataset.team = 'player';
      if (phase === 'deployment' && preparationGuide.action !== 'complete') {
        this.missionActionButton.hidden = false;
        this.missionActionButton.disabled = preparationGuide.buttonDisabled;
        this.missionActionButton.dataset.missionAction = preparationGuide.action;
        setText(this.missionActionButton, preparationGuide.buttonLabel);
      }
      return;
    }

    const beacon = state.beacon;
    const target = Math.max(1, beacon.targetProgress || SIGNAL_TARGET_SECONDS);
    const playerProgress = clamp(beacon.playerProgress / target);
    const enemyProgress = clamp(beacon.enemyProgress / target);
    const displayProgress = beacon.controllingTeam === 'enemy' ? enemyProgress : playerProgress;
    this.objectiveFill.style.width = `${Math.round(displayProgress * 100)}%`;
    this.objectiveFill.dataset.team = beacon.controllingTeam ?? 'neutral';

    if (!beacon.unlocked) {
      const remaining = Math.max(0, SIGNAL_UNLOCK_SECONDS - state.elapsed);
      setText(this.objectiveProgress, `锁定 ${formatTime(remaining)}`);
      this.setObjectiveSummary(`信标 ${formatTime(remaining)}`);
    } else if (beacon.contested) {
      setText(this.objectiveProgress, '争夺中');
      this.setObjectiveSummary('信标争夺中');
    } else if (beacon.controllingTeam) {
      const seconds = beacon.controllingTeam === 'player' ? beacon.playerProgress : beacon.enemyProgress;
      const teamLabel = beacon.controllingTeam === 'player' ? '我方' : '敌方';
      setText(this.objectiveProgress, `${teamLabel} ${formatTime(seconds)}`);
      this.setObjectiveSummary(`${teamLabel}控制信标`);
    } else {
      setText(this.objectiveProgress, '待占领');
      this.setObjectiveSummary('中央信标开放');
    }
  }

  private setObjectiveSummary(value: string): void {
    setText(this.topObjective, value);
    setText(this.taskSummary, value);
  }

  private renderActions(state: GameState, selectedIds: Set<string>, interactionMode: string): void {
    const active = state.status === 'active';
    this.rightRail.dataset.mode = interactionMode;
    for (const [kind, button] of this.buildButtons) {
      button.disabled = !active;
      button.dataset.affordable = state.economy.player.credits >= BUILDING_DEFS[kind].cost ? 'true' : 'false';
    }

    const readyProducers = new Set(
      state.buildings
        .filter((building) => building.team === 'player' && building.buildProgress >= 1)
        .map((building) => building.kind),
    );
    for (const [kind, refs] of this.productionButtons) {
      const definition = UNIT_DEFS[kind];
      const hasProducer = readyProducers.has(definition.producer);
      refs.button.disabled = !active || !hasProducer;
      refs.button.dataset.affordable = state.economy.player.credits >= definition.cost ? 'true' : 'false';
      refs.button.title = hasProducer ? definition.targetRole : `需要${BUILDING_DEFS[definition.producer].label}`;
      setText(
        refs.requirement,
        !active
          ? '对局已结束'
          : hasProducer
            ? definition.targetRole
            : `需${BUILDING_DEFS[definition.producer].shortLabel}`,
      );
      refs.requirement.dataset.state = hasProducer ? 'ready' : 'blocked';
      const queued = state.buildings
        .filter((building) => building.team === 'player' && building.kind === definition.producer)
        .flatMap((building) => building.queue)
        .filter((item) => item.unitKind === kind).length;
      refs.badge.textContent = queued > 0 ? String(queued) : '';
      refs.badge.hidden = queued === 0;
    }

    const selectedBuilding = state.buildings.find((building) => selectedIds.has(building.id) && building.team === 'player');
    const selectedConstruction = selectedBuilding && selectedBuilding.buildProgress < 1 ? selectedBuilding : null;
    this.cancelConstructionButton.hidden = selectedConstruction === null;
    this.cancelConstructionButton.disabled = !active || !this.callbacks.onCancelConstruction;
    if (selectedConstruction) {
      const label = `取消${BUILDING_DEFS[selectedConstruction.kind].shortLabel}施工`;
      this.cancelConstructionButton.dataset.buildingId = selectedConstruction.id;
      this.cancelConstructionButton.setAttribute('aria-label', label);
      setText(this.cancelConstructionLabel, label);
    } else {
      delete this.cancelConstructionButton.dataset.buildingId;
    }

    const selectedProduction = selectedBuilding
      && selectedBuilding.buildProgress >= 1
      && selectedBuilding.queue.length > 0
      ? selectedBuilding
      : null;
    this.cancelProductionButton.hidden = selectedProduction === null;
    this.cancelProductionButton.disabled = !active || !this.callbacks.onCancelProduction;
    if (selectedProduction) {
      const current = selectedProduction.queue[0];
      const label = current
        ? `取消${UNIT_DEFS[current.unitKind].shortLabel}生产`
        : `取消${BUILDING_DEFS[selectedProduction.kind].shortLabel}当前生产`;
      this.cancelProductionButton.dataset.buildingId = selectedProduction.id;
      this.cancelProductionButton.setAttribute('aria-label', label);
      setText(this.cancelProductionLabel, label);
    } else {
      delete this.cancelProductionButton.dataset.buildingId;
    }

    if (!selectedBuilding) {
      setText(this.queueSummary, '自动选择可用生产建筑');
    } else if (selectedBuilding.buildProgress < 1) {
      setText(this.queueSummary, `${BUILDING_DEFS[selectedBuilding.kind].shortLabel} · 施工 ${Math.round(clamp(selectedBuilding.buildProgress) * 100)}%`);
    } else if (selectedBuilding.queue.length === 0) {
      setText(this.queueSummary, `${BUILDING_DEFS[selectedBuilding.kind].shortLabel} · 队列空闲`);
    } else {
      const current = selectedBuilding.queue[0];
      if (current) {
        const complete = current.total <= 0 ? 0 : Math.round(clamp(1 - current.remaining / current.total) * 100);
        setText(this.queueSummary, `${UNIT_DEFS[current.unitKind].shortLabel} · ${complete}%`);
      }
    }

    const technology = state.technology.player;
    const completedTechnologies = new Set(technology.completed);
    for (const kind of TECHNOLOGY_KINDS) {
      const refs = this.technologyButtons.get(kind);
      if (!refs) continue;
      const definition = TECHNOLOGY_DEFS[kind];
      const completed = completedTechnologies.has(kind);
      const current = technology.current?.kind === kind ? technology.current : null;
      const otherResearchActive = technology.current !== null && !current;
      const affordable = state.economy.player.credits >= definition.cost;
      const progress = current
        ? Math.round(clamp(current.elapsedSeconds / definition.durationSeconds) * 100)
        : 0;

      refs.button.disabled = !active
        || !this.callbacks.onResearch
        || completed
        || current !== null
        || otherResearchActive;
      refs.button.dataset.affordable = affordable ? 'true' : 'false';
      refs.button.dataset.state = completed ? 'completed' : current ? 'current' : otherResearchActive ? 'blocked' : 'available';
      refs.progress.hidden = current === null;
      refs.progress.setAttribute('aria-valuenow', String(progress));
      refs.progressFill.style.width = `${progress}%`;

      if (completed) {
        setText(refs.status, '已完成');
        refs.button.setAttribute('aria-label', `${definition.label}研究已完成`);
      } else if (current) {
        setText(refs.status, `${progress}%`);
        refs.button.setAttribute('aria-label', `${definition.label}正在研究，进度 ${progress}%`);
      } else if (otherResearchActive) {
        setText(refs.status, '槽位占用');
        refs.button.setAttribute('aria-label', `${definition.label}暂不可研究，当前研究槽位已占用`);
      } else {
        setText(refs.status, `${definition.durationSeconds}s`);
        refs.button.setAttribute(
          'aria-label',
          `研究${definition.label}，花费 ${definition.cost} 辉晶，耗时 ${definition.durationSeconds} 秒`,
        );
      }
    }

    if (technology.current) {
      const definition = TECHNOLOGY_DEFS[technology.current.kind];
      const progress = Math.round(clamp(technology.current.elapsedSeconds / definition.durationSeconds) * 100);
      setText(this.researchSummary, `${definition.label} · ${progress}%`);
      this.cancelResearchButton.hidden = false;
      this.cancelResearchButton.disabled = !active || !this.callbacks.onCancelResearch;
      const label = `取消${definition.label}研究`;
      setText(this.cancelResearchLabel, label);
      this.cancelResearchButton.setAttribute('aria-label', label);
    } else {
      setText(
        this.researchSummary,
        completedTechnologies.size === TECHNOLOGY_KINDS.length
          ? '全部研究完成'
          : `${completedTechnologies.size}/${TECHNOLOGY_KINDS.length} 完成`,
      );
      this.cancelResearchButton.hidden = true;
      this.cancelResearchButton.disabled = true;
    }
  }

  private renderSelection(state: GameState, selectedIds: Set<string>, interactionMode: string): void {
    const entityMap = new Map<string, WorldEntity>();
    for (const entity of [...state.units, ...state.buildings, ...state.resources]) entityMap.set(entity.id, entity);
    const visibleEnemyIds = new Set(state.intel.player.visibleEnemyIds);
    const entities = [...selectedIds]
      .map((id) => entityMap.get(id))
      .filter((entity): entity is WorldEntity => {
        if (!entity) return false;
        if (entity.team === 'enemy') return visibleEnemyIds.has(entity.id);
        if (entity.entityType === 'resource') {
          return visibilityAt(state.intel.player.visibility, entity.position, entity.radius) !== 'unknown';
        }
        return true;
      });
    const units = entities.filter((entity) => entity.entityType === 'unit' && entity.team === 'player');
    const buildings = entities.filter((entity) => entity.entityType === 'building');

    if (entities.length === 0) {
      setText(this.selectionTitle, '未选择部队');
      setText(this.selectionMeta, '在战场拖拽框选，或点击单位');
    } else if (entities.length === 1) {
      const entity = entities[0];
      if (entity) {
        setText(this.selectionTitle, entityLabel(entity));
        const details = entity.entityType === 'unit'
          ? `${ORDER_LABELS[entity.order.type]} · HP ${Math.ceil(entity.hp)} / ${entity.maxHp}`
          : entity.entityType === 'building'
            ? `${isDefenseBuilding(entity) ? defenseTowerStatus(entity, state.economy[entity.team].powerRatio) : entity.powered ? '供电正常' : '低电停机'} · HP ${Math.ceil(entity.hp)} / ${entity.maxHp}`
            : `剩余辉晶 ${formatCredits(entity.amount)}`;
        setText(this.selectionMeta, details);
      }
    } else {
      setText(this.selectionTitle, `${entities.length} 个目标已选择`);
      setText(this.selectionMeta, `${units.length} 单位 · ${buildings.length} 建筑`);
    }

    const modeLabel = interactionMode === 'attackMove' ? '移动攻击待命' : interactionMode === 'build' ? '建筑放置模式' : '选择模式';
    setText(this.modeChip, modeLabel);
    this.modeChip.dataset.mode = interactionMode;

    const canCommand = state.status === 'active' && units.length > 0;
    this.moveButton.disabled = !canCommand;
    this.attackMoveButton.disabled = !canCommand;
    this.stopButton.disabled = !canCommand;
    this.moveButton.setAttribute('aria-pressed', String(interactionMode === 'move'));
    this.attackMoveButton.setAttribute('aria-pressed', String(interactionMode === 'attackMove'));

    const signature = entities.map((entity) => {
      if (entity.entityType === 'unit') return `${entity.id}:${Math.ceil(entity.hp)}:${entity.order.type}:${entity.cargo}`;
      if (entity.entityType === 'building') {
        const defenseState = isDefenseBuilding(entity) ? entity.cooldownRemaining > 0.05 : false;
        const defensePowerReady = isDefenseBuilding(entity)
          ? state.economy[entity.team].powerRatio >= DEFENSE_MIN_POWER_RATIO
          : true;
        const constructionPercent = Math.round(clamp(entity.buildProgress) * 100);
        return `${entity.id}:${Math.ceil(entity.hp)}:${entity.connected}:${entity.powered}:${entity.queue.length}:${constructionPercent}:${defensePowerReady}:${defenseState}`;
      }
      return `${entity.id}:${Math.ceil(entity.amount)}`;
    }).join('|');
    if (signature !== this.lastSelectionSignature) {
      this.lastSelectionSignature = signature;
      this.rebuildSelectionCards(entities, state);
    }
  }

  private rebuildSelectionCards(entities: WorldEntity[], state: GameState): void {
    this.selectionList.replaceChildren();
    this.selectionList.dataset.mode = 'individual';
    if (entities.length === 0) {
      const empty = createElement('div', 'ff-selection-empty');
      empty.append(createElement('span', undefined, '⌁'), createElement('p', undefined, '等待战术选择'));
      this.selectionList.append(empty);
      return;
    }

    const groupedPlayerUnits = entities.length >= 4
      && entities.every((entity) => entity.entityType === 'unit' && entity.team === 'player');
    if (groupedPlayerUnits) {
      this.selectionList.dataset.mode = 'grouped';
      for (const kind of UNIT_MENU) {
        const group = entities.filter((entity) => entity.entityType === 'unit' && entity.kind === kind);
        const representative = group[0];
        if (!representative || representative.entityType !== 'unit') continue;
        const minimumHealth = Math.min(...group.map((entity) => (
          entity.entityType === 'unit' ? entity.hp / Math.max(1, entity.maxHp) : 1
        )));
        const button = createElement('button', 'ff-selection-card ff-selection-card-group');
        button.type = 'button';
        button.dataset.entityId = representative.id;
        button.dataset.team = representative.team;
        button.setAttribute('aria-label', `聚焦${UNIT_DEFS[kind].label}编组，共 ${group.length} 个单位`);

        const glyph = createElement('span', 'ff-selection-glyph', entityGlyph(representative));
        glyph.setAttribute('aria-hidden', 'true');
        const copy = createElement('span', 'ff-selection-card-copy');
        copy.append(
          createElement('strong', undefined, `${UNIT_DEFS[kind].shortLabel} ×${group.length}`),
          createElement('small', undefined, `最低完整度 ${Math.round(clamp(minimumHealth) * 100)}%`),
        );
        const meter = createElement('span', 'ff-card-health');
        meter.dataset.team = representative.team;
        const fill = createElement('i');
        fill.style.width = `${Math.round(clamp(minimumHealth) * 100)}%`;
        fill.dataset.state = healthVisualBand(minimumHealth, 1);
        meter.append(fill);
        button.append(glyph, copy, meter);
        this.selectionList.append(button);
      }
      return;
    }

    const visibleEntities = entities.slice(0, 12);
    for (const entity of visibleEntities) {
      const button = createElement('button', 'ff-selection-card');
      button.type = 'button';
      button.dataset.entityId = entity.id;
      button.dataset.team = entity.team;
      button.setAttribute('aria-label', `聚焦${entityLabel(entity)}`);

      const glyph = createElement('span', 'ff-selection-glyph', entityGlyph(entity));
      glyph.setAttribute('aria-hidden', 'true');
      const copy = createElement('span', 'ff-selection-card-copy');
      copy.append(createElement('strong', undefined, entityLabel(entity)));
      const detail = entity.entityType === 'unit'
        ? ORDER_LABELS[entity.order.type]
        : entity.entityType === 'building'
          ? isDefenseBuilding(entity)
            ? defenseTowerStatus(entity, state.economy[entity.team].powerRatio, true)
            : entity.powered ? '在线' : '离线'
          : `${Math.round(entity.amount / Math.max(1, entity.maxAmount) * 100)}%`;
      copy.append(createElement('small', undefined, detail));
      copy.title = detail;

      const meter = createElement('span', 'ff-card-health');
      meter.dataset.team = entity.team;
      const fill = createElement('i');
      const healthRatio = entity.entityType === 'resource'
        ? entity.amount / Math.max(1, entity.maxAmount)
        : entity.hp / Math.max(1, entity.maxHp);
      fill.style.width = `${Math.round(clamp(healthRatio) * 100)}%`;
      fill.dataset.state = healthVisualBand(
        entity.entityType === 'resource' ? entity.amount : entity.hp,
        entity.entityType === 'resource' ? entity.maxAmount : entity.maxHp,
      );
      meter.append(fill);
      button.append(glyph, copy, meter);
      this.selectionList.append(button);
    }

    if (entities.length > visibleEntities.length) {
      this.selectionList.append(createElement('div', 'ff-selection-overflow', `+${entities.length - visibleEntities.length}`));
    }
  }

  private renderNotifications(state: GameState): void {
    for (const notification of state.notifications) {
      if (this.seenNotifications.has(notification.id)) continue;
      this.seenNotifications.add(notification.id);
      this.toast(notification.text, notification.tone);
    }
  }

  private renderResult(state: GameState): void {
    if (state.status === 'active') {
      this.dismissedResultKey = '';
      if (this.resultDialog.open) this.resultDialog.close();
      return;
    }
    const key = `${state.status}:${state.statusReason}:${state.tick}`;
    const victory = state.status === 'victory';
    setText(this.resultTitle, victory ? '战区已控制' : '指挥核心失守');
    setText(this.resultReason, state.statusReason || (victory ? '中央信标确认我方控制。' : '重新部署并恢复指挥链路。'));
    setText(
      this.resultMetrics,
      `${BREAKTHROUGH_DIFFICULTIES[this.difficultyId].shortLabel}难度 · 作战时间 ${formatTime(state.elapsed)} · 辉晶 ${formatCredits(state.economy.player.credits)} · 带宽 ${state.economy.player.bandwidthUsed}/${state.economy.player.bandwidthCap}`,
    );
    this.resultDialog.dataset.result = state.status;
    this.resultDialog.dataset.resultKey = key;
    if (this.deploymentDialog.open) return;
    if (this.resultDialog.open || this.dismissedResultKey === key) return;
    try {
      this.resultDialog.showModal();
    } catch {
      this.resultDialog.setAttribute('open', '');
    }
  }

  private drawMinimap(): void {
    const state = this.lastState;
    if (!state || !this.minimap.isConnected) return;
    const bounds = this.minimap.getBoundingClientRect();
    const cssWidth = Math.max(120, Math.round(bounds.width || 300));
    const cssHeight = Math.max(84, Math.round(bounds.height || 188));
    const ratio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    const selectionKey = [...this.lastSelection].sort().join(',');
    const key = `${state.tick}:${selectionKey}:${cssWidth}:${cssHeight}:${ratio}`;
    if (key === this.lastMinimapKey) return;
    this.lastMinimapKey = key;

    const pixelWidth = Math.round(cssWidth * ratio);
    const pixelHeight = Math.round(cssHeight * ratio);
    if (this.minimap.width !== pixelWidth) this.minimap.width = pixelWidth;
    if (this.minimap.height !== pixelHeight) this.minimap.height = pixelHeight;
    const context = this.minimap.getContext('2d');
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, cssWidth, cssHeight);

    const inset = MINIMAP_INSET;
    const width = cssWidth - inset * 2;
    const height = cssHeight - inset * 2;
    const visibility = state.intel.player.visibility;
    const worldWidth = visibility.bounds.maxX - visibility.bounds.minX;
    const worldHeight = visibility.bounds.maxZ - visibility.bounds.minZ;
    const mapX = (x: number): number => inset + ((x - visibility.bounds.minX) / worldWidth) * width;
    const mapY = (z: number): number => inset + ((z - visibility.bounds.minZ) / worldHeight) * height;
    const visibleEnemyIds = new Set(state.intel.player.visibleEnemyIds);
    const exploredPercent = Math.round(clamp(visibility.explored.length / Math.max(1, visibility.width * visibility.height)) * 100);
    const visibleEnemyCount = [...state.units, ...state.buildings]
      .filter((entity) => entity.team === 'enemy' && visibleEnemyIds.has(entity.id)).length;
    this.minimap.setAttribute(
      'aria-label',
      `灰烬环线小地图；雷达${state.intel.player.radarOnline ? '在线' : '离线'}；已探索 ${exploredPercent}%；当前侦测 ${visibleEnemyCount} 个敌方目标；未知区域由战争迷雾覆盖`,
    );
    this.minimap.setAttribute(
      'aria-description',
      '点击或按住左键拖动可定位镜头；键盘按 Enter 或空格定位当前小地图焦点。',
    );

    context.fillStyle = '#020708';
    context.fillRect(0, 0, cssWidth, cssHeight);

    const drawVisibilityCells = (indices: readonly number[], fillStyle: string): void => {
      context.fillStyle = fillStyle;
      for (const index of indices) {
        const cellX = index % visibility.width;
        const cellZ = Math.floor(index / visibility.width);
        const worldMinX = visibility.bounds.minX + cellX * visibility.cellSize;
        const worldMinZ = visibility.bounds.minZ + cellZ * visibility.cellSize;
        const worldMaxX = Math.min(visibility.bounds.maxX, worldMinX + visibility.cellSize);
        const worldMaxZ = Math.min(visibility.bounds.maxZ, worldMinZ + visibility.cellSize);
        const x = mapX(worldMinX);
        const y = mapY(worldMinZ);
        context.fillRect(x, y, Math.max(0.5, mapX(worldMaxX) - x + 0.25), Math.max(0.5, mapY(worldMaxZ) - y + 0.25));
      }
    };
    drawVisibilityCells(visibility.explored, 'rgba(25, 58, 56, 0.64)');
    drawVisibilityCells(visibility.visible, 'rgba(50, 111, 104, 0.42)');

    context.strokeStyle = 'rgba(94, 191, 188, 0.12)';
    context.lineWidth = 1;
    for (let index = 1; index < 4; index += 1) {
      const x = inset + width * index / 4;
      const y = inset + height * index / 4;
      context.beginPath();
      context.moveTo(x, inset);
      context.lineTo(x, inset + height);
      context.moveTo(inset, y);
      context.lineTo(inset + width, y);
      context.stroke();
    }
    context.strokeStyle = 'rgba(96, 214, 208, 0.28)';
    context.strokeRect(inset + 0.5, inset + 0.5, width - 1, height - 1);

    for (const blocker of state.blockers) {
      if (!shouldRenderMinimapBlocker(
        this.fixture,
        blocker.id,
        visibilityAt(visibility, blocker.position, blocker.radius),
      )) continue;
      context.fillStyle = 'rgba(91, 105, 101, 0.42)';
      context.beginPath();
      context.arc(mapX(blocker.position.x), mapY(blocker.position.z), Math.max(1.5, blocker.radius / 2.5), 0, Math.PI * 2);
      context.fill();
    }
    for (const resource of state.resources) {
      if (visibilityAt(visibility, resource.position, resource.radius) === 'unknown') continue;
      context.fillStyle = 'rgba(77, 214, 209, 0.72)';
      context.beginPath();
      context.arc(mapX(resource.position.x), mapY(resource.position.z), 2.7, 0, Math.PI * 2);
      context.fill();
    }

    const beaconPulse = state.beacon.contested
      ? '#f0b54a'
      : factionCssColor(state.beacon.controllingTeam ?? 'neutral', 'bright');
    context.strokeStyle = beaconPulse;
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(mapX(state.beacon.position.x), mapY(state.beacon.position.z), 5, 0, Math.PI * 2);
    context.stroke();

    for (const building of state.buildings) {
      if (!shouldRenderMinimapEntity(this.fixture, building.id, building.team, visibleEnemyIds)) continue;
      const x = mapX(building.position.x);
      const y = mapY(building.position.z);
      context.fillStyle = factionCssColor(building.team, 'minimap');
      context.fillRect(x - 2.5, y - 2.5, 5, 5);
      if (this.lastSelection.has(building.id)) {
        context.strokeStyle = '#f4faf8';
        context.strokeRect(x - 4, y - 4, 8, 8);
      }
    }
    for (const unit of state.units) {
      if (!shouldRenderMinimapEntity(this.fixture, unit.id, unit.team, visibleEnemyIds)) continue;
      const x = mapX(unit.position.x);
      const y = mapY(unit.position.z);
      context.fillStyle = factionCssColor(unit.team, 'minimap');
      context.beginPath();
      context.arc(x, y, this.lastSelection.has(unit.id) ? 2.6 : 1.7, 0, Math.PI * 2);
      context.fill();
      if (this.lastSelection.has(unit.id)) {
        context.strokeStyle = '#ffffff';
        context.lineWidth = 1;
        context.stroke();
      }
    }
    const reducedMinimapMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    for (const notification of state.notifications) {
      if (!notification.at) continue;
      const x = mapX(notification.at.x);
      const y = mapY(notification.at.z);
      const pulse = reducedMinimapMotion ? 6.5 : 5.5 + (state.tick % 16) / 8;
      context.strokeStyle = notification.tone === 'danger' ? '#ff6b58' : '#f0b54a';
      context.lineWidth = 1.6;
      context.beginPath();
      context.arc(x, y, pulse, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = notification.tone === 'danger' ? '#ff4438' : '#f0b54a';
      context.beginPath();
      context.arc(x, y, 2.2, 0, Math.PI * 2);
      context.fill();
    }
  }

  private setActiveArmoryTab(tab: ArmoryTab, focusTab = false): void {
    this.activeArmoryTab = tab;
    for (const item of ARMORY_TAB_ORDER) {
      const active = item === tab;
      const button = this.armoryTabs.get(item);
      const panel = this.armoryPanels.get(item);
      if (!button || !panel) continue;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      panel.hidden = !active;
      panel.inert = !active;
    }
    this.rightRail.dataset.activeTab = tab;
    if (focusTab) this.armoryTabs.get(tab)?.focus();
  }

  private setHelpOpen(open: boolean, returnFocus = true): void {
    if (open === this.helpDrawer.classList.contains('is-open')) return;
    if (open) {
      const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      this.lastFocusedBeforeHelp = focused && this.leftRail.contains(focused)
        ? this.leftToggle
        : focused && this.rightRail.contains(focused) && this.isOverlayRail('right')
          ? this.rightToggle
          : focused;
      this.closeOverlayRails(false);
    } else if (returnFocus) {
      this.lastFocusedBeforeHelp?.focus();
    } else if (document.activeElement instanceof HTMLElement && this.helpDrawer.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    this.helpDrawer.classList.toggle('is-open', open);
    this.helpDrawer.setAttribute('aria-hidden', String(!open));
    this.helpDrawer.inert = !open;
    this.helpToggle.setAttribute('aria-expanded', String(open));
    this.callbacks.onToggleHelp();
    this.syncTacticalOverlayPauseState();
    if (open) {
      window.requestAnimationFrame(() => this.helpClose.focus());
    } else {
      this.lastFocusedBeforeHelp = null;
    }
  }

  private toggleRail(side: 'left' | 'right'): void {
    if (!this.isOverlayRail(side)) return;
    const opening = side === 'left' ? !this.leftRailOpen : !this.rightRailOpen;
    if (opening && this.helpDrawer.classList.contains('is-open')) this.setHelpOpen(false, false);
    this.leftRailOpen = side === 'left' && opening;
    this.rightRailOpen = side === 'right' && opening;
    this.syncResponsiveState();
    if (opening) {
      const rail = side === 'left' ? this.leftRail : this.rightRail;
      window.requestAnimationFrame(() => requiredElement<HTMLButtonElement>(rail, '.ff-rail-close').focus());
    }
  }

  private closeOverlayRails(returnFocus: boolean): void {
    const focusTarget = this.leftRailOpen ? this.leftToggle : this.rightRailOpen ? this.rightToggle : null;
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (returnFocus) focusTarget?.focus();
    else if (focused && (this.leftRail.contains(focused) || this.rightRail.contains(focused))) focused.blur();
    this.leftRailOpen = false;
    this.rightRailOpen = false;
    this.syncResponsiveState();
  }

  private syncResponsiveState(): void {
    const rightWasOverlay = this.rightRail.dataset.overlay === 'true';
    const rightOverlay = this.isOverlayRail('right');
    const focusedInsideRightRail = document.activeElement instanceof HTMLElement
      && this.rightRail.contains(document.activeElement);
    if (!rightOverlay) this.rightRailOpen = false;

    const leftVisible = this.leftRailOpen;
    const rightVisible = !rightOverlay || this.rightRailOpen;
    const scrimVisible = leftVisible || (rightOverlay && this.rightRailOpen);

    if (rightOverlay && !rightWasOverlay && focusedInsideRightRail && !rightVisible) {
      this.rightToggle.focus();
    }

    this.leftRail.dataset.overlay = 'true';
    this.rightRail.dataset.overlay = String(rightOverlay);
    this.leftRail.dataset.open = String(leftVisible);
    this.rightRail.dataset.open = String(rightVisible);
    this.shell.dataset.overlayRailOpen = String(scrimVisible);
    this.leftToggle.setAttribute('aria-expanded', String(leftVisible));
    this.rightToggle.setAttribute('aria-expanded', String(rightVisible));
    this.leftRail.setAttribute('aria-hidden', String(!leftVisible));
    this.rightRail.setAttribute('aria-hidden', String(!rightVisible));
    this.leftRail.inert = !leftVisible;
    this.rightRail.inert = !rightVisible;
    this.setOverlayDialogState(this.leftRail, leftVisible);
    this.setOverlayDialogState(this.rightRail, rightOverlay && this.rightRailOpen);
    this.railScrim.hidden = !scrimVisible;
    this.railScrim.setAttribute('aria-hidden', String(!scrimVisible));
    this.syncDesktopCommandSidebarComposition(rightOverlay);
    this.syncTacticalOverlayPauseState();
  }

  private syncTacticalOverlayPauseState(): void {
    const paused = shouldPauseForTacticalOverlay(
      this.helpDrawer.classList.contains('is-open'),
      this.leftRailOpen,
      this.rightRailOpen,
      this.isOverlayRail('right'),
      this.deploymentDialog.open,
    );
    if (paused === this.tacticalOverlayActive) return;
    this.tacticalOverlayActive = paused;
    this.tacticalPauseChip.hidden = !paused;
    this.shell.dataset.tacticalPaused = String(paused);
    this.callbacks.onOverlayPauseChange?.(paused);
  }

  private syncDesktopCommandSidebarComposition(rightOverlay: boolean): void {
    const composed = shouldComposeDesktopCommandSidebar(this.layoutMode, rightOverlay);
    this.shell.dataset.desktopCommandSidebar = String(composed);
    if (composed) {
      if (this.minimapPanel.parentElement !== this.rightRail) this.rightRail.prepend(this.minimapPanel);
      if (this.utilityPanel.parentElement !== this.rightRail) this.rightRail.append(this.utilityPanel);
      return;
    }

    if (this.utilityPanel.parentElement !== this.leftRail) this.leftRail.append(this.utilityPanel);
    if (this.minimapPanel.parentElement === this.rightRail) this.rightRail.after(this.minimapPanel);
  }

  private trapOverlayFocus(event: KeyboardEvent): boolean {
    const activeRail = this.leftRailOpen
      ? this.leftRail
      : this.rightRailOpen && this.isOverlayRail('right')
        ? this.rightRail
        : null;
    if (!activeRail) return false;

    const focusable = Array.from(activeRail.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    )).filter((element) => (
      !element.hidden
      && !element.inert
      && !element.closest('[hidden], [inert]')
      && element.getClientRects().length > 0
    ));
    if (focusable.length === 0) return false;

    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const focused = document.activeElement;
    if (!activeRail.contains(focused)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return true;
    }
    if (event.shiftKey && focused === first) {
      event.preventDefault();
      last.focus();
      return true;
    }
    if (!event.shiftKey && focused === last) {
      event.preventDefault();
      first.focus();
      return true;
    }
    return false;
  }

  private setOverlayDialogState(rail: HTMLElement, open: boolean): void {
    if (open) {
      rail.setAttribute('role', 'dialog');
      rail.setAttribute('aria-modal', 'true');
      return;
    }
    rail.removeAttribute('role');
    rail.removeAttribute('aria-modal');
  }

  private isOverlayRail(side: 'left' | 'right'): boolean {
    if (side === 'left') return true;
    if (this.layoutMode === 'visual-review') return true;
    return this.overlayRailMedia?.matches ?? window.innerWidth <= 1180;
  }

  private updateDeploymentSelection(difficulty: BreakthroughDifficultyId): void {
    this.deploymentSelectedDifficulty = difficulty;
    for (const id of BREAKTHROUGH_DIFFICULTY_ORDER) {
      const card = this.deploymentCards.get(id);
      if (!card) continue;
      const selected = id === difficulty;
      card.setAttribute('aria-pressed', String(selected));
      card.dataset.selected = String(selected);
      card.tabIndex = selected ? 0 : -1;
    }
    const definition = BREAKTHROUGH_DIFFICULTIES[difficulty];
    setText(this.deploymentStartButton, `开始新战局 · ${definition.shortLabel}`);
    this.deploymentStartButton.setAttribute('aria-label', `开始${definition.label}新战局`);
  }

  private closeDeploymentBriefing(returnFocus: boolean): void {
    if (!this.deploymentDialog.open) return;
    this.deploymentDialog.close();
    this.syncTacticalOverlayPauseState();

    if (this.deploymentReopensResult) {
      this.deploymentReopensResult = false;
      try {
        this.resultDialog.showModal();
      } catch {
        this.resultDialog.setAttribute('open', '');
      }
      window.requestAnimationFrame(() => this.resultDifficultyButton.focus());
      return;
    }

    if (returnFocus) {
      const target = this.lastFocusedBeforeDeployment?.isConnected
        ? this.lastFocusedBeforeDeployment
        : this.difficultyButton.hidden
          ? this.leftToggle
          : this.difficultyButton;
      window.requestAnimationFrame(() => target.focus());
    }
    this.lastFocusedBeforeDeployment = null;
  }

  private dismissCurrentResult(): void {
    this.dismissedResultKey = this.resultDialog.dataset.resultKey ?? '';
    if (this.resultDialog.open) this.resultDialog.close();
    window.requestAnimationFrame(() => this.leftToggle.focus());
  }

  private removeToast(toast: HTMLElement): void {
    const timer = this.toastTimers.get(toast);
    if (timer !== undefined) window.clearTimeout(timer);
    this.toastTimers.delete(toast);
    toast.classList.add('is-leaving');
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) toast.remove();
    else window.setTimeout(() => toast.remove(), 180);
  }
}
