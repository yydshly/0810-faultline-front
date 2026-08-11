import './styles.css';
import { BUILDING_DEFS, GAME_TICK_SECONDS, UNIT_DEFS } from './game/config';
import { GameAudio } from './game/audio';
import {
  EDGE_PAN_BLOCKING_SELECTOR,
  screenPanToWorldPan,
  visibleStageEdgePanDirection,
} from './game/camera-edge';
import {
  breakthroughFixtureForDifficulty,
  canStartBreakthroughDeploymentInPlace,
  isPlayableBreakthroughFixture,
  resolveBreakthroughDifficultyId,
  type BreakthroughDifficultyId,
} from './game/difficulty';
import {
  createReplayRecorder,
  parseReplay,
  type ReplayLog,
  type ReplayRecorder,
} from './game/replay';
import { BattlefieldScene } from './game/scene';
import { replayFixtureLoadError } from './game/review-presentation';
import {
  parseSavedDeploymentSummary,
  type SavedDeploymentSummary,
} from './game/saved-deployment';
import {
  nextRenderQuality,
  resolveRenderQuality,
  type RenderQualityLevel,
} from './game/render-quality';
import type { GameSimulation } from './game/simulation';
import { TECHNOLOGY_DEFS, type TechnologyKind } from './game/technology';
import type { BuildingKind, GameCommand, UnitKind, Vec2, WorldEntity } from './game/types';
import {
  GameHUD,
  normalizedMinimapPointToWorld,
  type HUDCallbacks,
  type MinimapNavigationPoint,
} from './ui';

type InteractionMode =
  | { type: 'select' }
  | { type: 'attackMove' }
  | { type: 'build'; kind: BuildingKind; rotation: number };

type SelectionDrag = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  shift: boolean;
  active: boolean;
};

const SAVE_SLOT_KEY = 'faultline-front.save.v3';
const AUDIO_MUTED_KEY = 'faultline-front.audio-muted.v1';
const RENDER_QUALITY_KEY = 'faultline-front.render-quality.v1';
const KEYBOARD_PAN_SPEED = 25;
const EDGE_PAN_MAX_SPEED = 42;
const MIDDLE_DRAG_PAN_SPEED = 0.064;

interface SavedDeploymentSlot {
  serialized: string;
  summary: SavedDeploymentSummary;
}

interface LoadGameOptions {
  serialized?: string;
  automatic?: boolean;
}

class FaultlineApp {
  private readonly root: HTMLElement;
  private readonly hud: GameHUD;
  private readonly audio = new GameAudio();
  private scene: BattlefieldScene | null = null;
  private simulation: GameSimulation;
  private recorder: ReplayRecorder;
  private seed: number;
  private fixture: string;
  private renderQuality: RenderQualityLevel;
  private restoring = false;
  private tacticalOverlayPaused = false;
  private selectedIds = new Set<string>();
  private mode: InteractionMode = { type: 'select' };
  private drag: SelectionDrag | null = null;
  private middleDrag: { x: number; y: number } | null = null;
  private accumulator = 0;
  private lastFrame = performance.now();
  private animationFrame = 0;
  private pointer = { x: 0, y: 0, inside: false };
  private edgePanBlocked = false;
  private pressedKeys = new Set<string>();
  private controlGroups = new Map<number, string[]>();
  private lastGroupTap = { group: -1, at: 0 };

  constructor(root: HTMLElement) {
    this.root = root;
    const params = new URLSearchParams(window.location.search);
    this.fixture = params.get('fixture') ?? 'breakthrough-demo';
    const requestedSeed = Number(params.get('seed') ?? '1949');
    this.seed = Number.isFinite(requestedSeed) ? Math.trunc(requestedSeed) : 1949;
    const showInitialDeploymentBriefing = !params.has('fixture')
      && params.get('deploy') !== '1'
      && isPlayableBreakthroughFixture(this.fixture);
    const resumeFlagPresent = params.get('resume') === '1';
    const autoResumeRequested = resumeFlagPresent
      && isPlayableBreakthroughFixture(this.fixture);
    const requestedResumeTick = Number(params.get('resumeTick'));
    const savedDeploymentSlot = this.readSavedDeploymentSlot();
    const savedDeployment = savedDeploymentSlot?.summary ?? null;
    const autoResumeSerialized = autoResumeRequested
      && savedDeploymentSlot
      && savedDeploymentSlot.summary.fixture === this.fixture
      && savedDeploymentSlot.summary.seed === this.seed
      && Number.isSafeInteger(requestedResumeTick)
      && savedDeploymentSlot.summary.currentTick === requestedResumeTick
      ? savedDeploymentSlot.serialized
      : null;
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const requestedQuality = params.get('quality') ?? this.readRenderQualityPreference();
    this.renderQuality = resolveRenderQuality(requestedQuality, {
      viewportWidth: window.innerWidth,
      devicePixelRatio: window.devicePixelRatio || 1,
      deviceMemory,
    });
    this.recorder = createReplayRecorder(this.seed, this.fixture);
    this.simulation = this.recorder.simulation;
    this.applyFixtureOpeningSelection();
    this.audio.setMuted(this.readAudioMutedPreference());

    const callbacks: HUDCallbacks = {
      onBuild: (kind) => this.beginBuild(kind),
      onProduce: (kind) => this.produce(kind),
      onResearch: (kind) => this.research(kind),
      onCancelConstruction: (buildingId) => this.cancelConstruction(buildingId),
      onCancelProduction: (buildingId) => this.cancelProduction(buildingId),
      onCancelResearch: () => this.cancelResearch(),
      onCommand: (command) => this.handleHudCommand(command),
      onRestart: () => this.restart(),
      onSave: () => this.saveGame(),
      onLoad: () => void this.loadGame(),
      onAudioAction: () => void this.handleAudioAction(),
      onQualityAction: () => this.handleQualityAction(),
      onToggleHelp: () => undefined,
      onOverlayPauseChange: (paused) => {
        this.tacticalOverlayPaused = paused;
        this.accumulator = 0;
        if (paused) this.pressedKeys.clear();
      },
      onSelectEntity: (id) => this.selectFromHud(id),
      onMinimapNavigate: (point) => this.navigateFromMinimap(point),
      onDeployDifficulty: (difficulty, mode) => this.deployDifficulty(difficulty, mode),
      onResumeSavedDeployment: savedDeployment
        ? () => this.resumeSavedDeployment(savedDeployment)
        : undefined,
    };
    this.hud = new GameHUD(this.root, callbacks, {
      fixture: this.fixture,
      difficultyId: resolveBreakthroughDifficultyId(this.fixture),
      resumeDeployment: savedDeployment,
      layoutMode: this.fixture === 'visual-gold-review'
        || this.fixture === 'destruction-residue-review'
        || this.fixture === 'destruction-residue-review-reduced'
        || this.fixture === 'building-ruin-review'
        || this.fixture === 'building-ruin-review-reduced'
        || this.fixture === 'building-damage-review'
        || this.fixture === 'building-damage-review-reduced'
        || this.fixture === 'enemy-infrastructure-review'
        || this.fixture === 'player-infrastructure-review'
        || this.fixture === 'enemy-vehicle-socket-review'
        || this.fixture === 'combat-vehicle-family-review'
        ? 'visual-review'
        : 'default',
    });
    this.syncAudioHud();
    this.hud.setRenderQualityState(this.renderQuality);

    if (params.get('fallback') === 'webgl') {
      this.hud.setWebglFallback('当前环境不支持 WebGL。你仍可阅读任务、操作说明和系统要求，但 3D 对局已停用。');
    } else {
      try {
        this.scene = new BattlefieldScene(this.hud.stage, this.renderQuality, this.fixture);
        this.scene.focus(this.fixture === 'visual-gold-review'
          ? { x: -2, z: 0 }
          : this.fixture === 'destruction-residue-review' || this.fixture === 'destruction-residue-review-reduced'
          ? { x: 0, z: 0 }
          : this.fixture === 'building-ruin-review' || this.fixture === 'building-ruin-review-reduced'
          ? { x: 0, z: 0 }
          : this.fixture === 'building-damage-review' || this.fixture === 'building-damage-review-reduced'
          ? { x: 3.5, z: 3.5 }
          : this.fixture === 'enemy-infrastructure-review'
          ? { x: 0, z: 0 }
          : this.fixture === 'player-infrastructure-review'
          ? { x: 0, z: 0 }
          : this.fixture === 'enemy-vehicle-socket-review'
          ? { x: 0, z: 0 }
          : this.fixture === 'combat-vehicle-family-review'
          ? { x: 0, z: 0 }
          : this.fixture === 'wreck-review' || this.fixture === 'wreck-review-reduced'
          ? { x: 0, z: 1 }
          : this.fixture === 'construction-review' || this.fixture === 'construction-review-reduced'
          ? { x: 12, z: 0 }
          : isPlayableBreakthroughFixture(this.fixture)
          ? { x: -31, z: 22 }
          : this.fixture.startsWith('breakthrough-demo')
          ? { x: 8, z: -16 }
          : this.fixture === 'campaign-demo' || this.fixture === 'campaign-demo-reduced'
          ? { x: -12, z: 9 }
          : this.fixture === 'enemy-base-review'
          ? { x: 0, z: 6 }
          : this.fixture === 'infantry-rig-review'
            || this.fixture === 'infantry-rig-review-reduced'
            || this.fixture === 'infantry-family-review'
            || this.fixture === 'infantry-family-review-reduced'
            ? { x: 0, z: 12 }
          : this.fixture === 'combat'
            || this.fixture === 'combat-reduced'
            || this.fixture === 'hero-tank-review'
            || this.fixture === 'hero-tank-review-reduced'
            || this.fixture === 'infantry-rig-review'
            || this.fixture === 'infantry-rig-review-reduced'
            || this.fixture === 'skirmish'
            || this.fixture === 'skirmish-reduced'
            || this.fixture === 'enemy-review'
            ? { x: 0, z: 0 }
            : { x: -45, z: 38 });
        if (this.fixture === 'visual-gold-review') {
          this.scene.setViewHeight(44);
        } else if (this.fixture === 'destruction-residue-review' || this.fixture === 'destruction-residue-review-reduced') {
          this.scene.setViewHeight(56);
        } else if (this.fixture === 'building-ruin-review' || this.fixture === 'building-ruin-review-reduced') {
          this.scene.setViewHeight(48);
        } else if (this.fixture === 'building-damage-review' || this.fixture === 'building-damage-review-reduced') {
          this.scene.setViewHeight(56);
        } else if (this.fixture === 'enemy-infrastructure-review') {
          this.scene.setViewHeight(50);
        } else if (this.fixture === 'player-infrastructure-review') {
          this.scene.setViewHeight(50);
        } else if (this.fixture === 'enemy-vehicle-socket-review') {
          this.scene.setViewHeight(32);
        } else if (this.fixture === 'combat-vehicle-family-review') {
          this.scene.setViewHeight(48);
        } else if (this.fixture === 'wreck-review' || this.fixture === 'wreck-review-reduced') {
          this.scene.setViewHeight(48);
        } else if (this.fixture === 'construction-review' || this.fixture === 'construction-review-reduced') {
          this.scene.setViewHeight(80);
        } else if (this.fixture === 'infantry-rig-review'
          || this.fixture === 'infantry-rig-review-reduced'
          || this.fixture === 'infantry-family-review'
          || this.fixture === 'infantry-family-review-reduced') {
          this.scene.zoom(-850);
        } else if (this.fixture === 'hero-tank-review' || this.fixture === 'hero-tank-review-reduced') {
          this.scene.zoom(-400);
        } else if (this.fixture === 'skirmish' || this.fixture === 'skirmish-reduced') {
          this.scene.zoom(-700);
        } else if (this.fixture === 'campaign-demo' || this.fixture === 'campaign-demo-reduced') {
          this.scene.zoom(-250);
        } else if (this.fixture.startsWith('breakthrough-demo')) {
          this.scene.zoom(-250);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '无法创建 WebGL 战场。';
        this.hud.setWebglFallback(`当前环境无法运行 3D 战场：${message}`);
      }
    }

    this.bindInput();
    this.renderNow();
    if (autoResumeSerialized) {
      void this.loadGame({ serialized: autoResumeSerialized, automatic: true });
    } else if (autoResumeRequested) {
      this.handleAutomaticResumeFailure('存档已变化或与当前难度不一致');
    } else if (resumeFlagPresent) {
      this.clearResumeRequest();
    } else if (showInitialDeploymentBriefing) {
      this.hud.showDeploymentBriefing('initial');
    }
    this.animationFrame = requestAnimationFrame((time) => this.frame(time));

    if (import.meta.env.DEV) {
      Object.assign(window, {
        __faultline: {
          simulation: this.simulation,
          getState: () => this.simulation.state,
          restart: () => this.restart(),
          setQuality: (level: RenderQualityLevel) => this.setRenderQuality(level),
          select: (ids: string[]) => {
            this.selectedIds = new Set(ids);
            this.renderNow();
          },
        },
      });
    }
  }

  private frame(time: number): void {
    const elapsed = Math.min((time - this.lastFrame) / 1000, 0.2);
    this.lastFrame = time;
    if (this.tacticalOverlayPaused) this.accumulator = 0;
    else this.accumulator += elapsed;
    let steps = 0;
    while (!this.restoring && !this.tacticalOverlayPaused && this.accumulator >= GAME_TICK_SECONDS && steps < 5) {
      this.simulation.step(GAME_TICK_SECONDS);
      this.accumulator -= GAME_TICK_SECONDS;
      steps += 1;
    }
    if (!this.tacticalOverlayPaused) this.updateCamera(elapsed);
    this.pruneSelection();
    this.renderNow();
    this.animationFrame = requestAnimationFrame((next) => this.frame(next));
  }

  private renderNow(): void {
    const events = this.simulation.drainEvents();
    const disclosedEvents = this.scene?.sync(this.simulation.state, this.selectedIds, events)
      ?? events.filter((event) => event.team === 'player');
    const audibleEvents = new Set(disclosedEvents);
    this.audio.consume(events, this.scene?.listenerX() ?? 0, (event) => audibleEvents.has(event));
    this.hud.render(this.simulation.state, this.selectedIds, this.mode.type);
  }

  private bindInput(): void {
    const stage = this.hud.stage;
    this.root.addEventListener('pointerdown', (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-audio-action]')) return;
      void this.tryUnlockAudio();
    }, { capture: true });
    stage.addEventListener('pointerdown', (event) => this.onPointerDown(event));
    stage.addEventListener('pointermove', (event) => this.onPointerMove(event));
    stage.addEventListener('pointerup', (event) => this.onPointerUp(event));
    stage.addEventListener('pointercancel', () => this.cancelPointer());
    stage.addEventListener('contextmenu', (event) => this.onContextMenu(event));
    stage.addEventListener('wheel', (event) => {
      event.preventDefault();
      this.scene?.zoom(event.deltaY);
    }, { passive: false });

    window.addEventListener('resize', () => this.scene?.resize());
    window.addEventListener('pointermove', (event) => this.trackPointer(event));
    window.addEventListener('pointerout', (event) => {
      if (event.relatedTarget !== null) return;
      this.pointer.inside = false;
      this.edgePanBlocked = false;
    });
    window.addEventListener('keydown', (event) => {
      void this.tryUnlockAudio();
      this.onKeyDown(event);
    });
    window.addEventListener('keyup', (event) => this.pressedKeys.delete(event.key.toLowerCase()));
    window.addEventListener('blur', () => {
      this.pressedKeys.clear();
      this.middleDrag = null;
      this.pointer.inside = false;
      this.edgePanBlocked = false;
    });
  }

  private trackPointer(event: PointerEvent): void {
    this.pointer = {
      x: event.clientX,
      y: event.clientY,
      inside: event.clientX >= 0
        && event.clientX <= window.innerWidth
        && event.clientY >= 0
        && event.clientY <= window.innerHeight,
    };
    const target = event.target;
    this.edgePanBlocked = target instanceof Element
      && target.closest(EDGE_PAN_BLOCKING_SELECTOR) !== null;
  }

  private onPointerDown(event: PointerEvent): void {
    this.trackPointer(event);
    if (event.button === 1) {
      event.preventDefault();
      this.middleDrag = { x: event.clientX, y: event.clientY };
      this.hud.stage.setPointerCapture(event.pointerId);
      return;
    }
    if (event.button !== 0) return;
    this.drag = {
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      shift: event.shiftKey,
      active: false,
    };
    this.hud.stage.setPointerCapture(event.pointerId);
  }

  private onPointerMove(event: PointerEvent): void {
    this.trackPointer(event);
    if (this.middleDrag && this.scene) {
      const dx = event.clientX - this.middleDrag.x;
      const dy = event.clientY - this.middleDrag.y;
      const worldPan = screenPanToWorldPan(
        -dx * MIDDLE_DRAG_PAN_SPEED,
        -dy * MIDDLE_DRAG_PAN_SPEED,
      );
      this.scene.pan(worldPan.x, worldPan.z);
      this.middleDrag = { x: event.clientX, y: event.clientY };
      return;
    }

    if (this.mode.type === 'build' && this.scene) {
      const point = this.scene.groundAt(event.clientX, event.clientY);
      if (point) {
        const snapped = { x: Math.round(point.x), z: Math.round(point.z) };
        const validation = this.simulation.validateBuild(this.mode.kind, snapped, this.mode.rotation);
        this.scene.setBuildGhost(this.mode.kind, snapped, this.mode.rotation, validation.valid);
      }
    }

    if (!this.drag) return;
    this.drag.currentX = event.clientX;
    this.drag.currentY = event.clientY;
    const distance = Math.hypot(this.drag.currentX - this.drag.startX, this.drag.currentY - this.drag.startY);
    this.drag.active = distance > 6;
    if (this.drag.active) this.hud.setSelectionBox(this.dragRect(this.drag));
  }

  private onPointerUp(event: PointerEvent): void {
    if (event.button === 1) {
      this.middleDrag = null;
      return;
    }
    if (event.button !== 0 || !this.drag || !this.scene) return;

    if (this.mode.type === 'build') {
      const point = this.scene.groundAt(event.clientX, event.clientY);
      if (point) {
        const snapped = { x: Math.round(point.x), z: Math.round(point.z) };
        const result = this.issue({
          type: 'build', kind: this.mode.kind, position: snapped, rotation: this.mode.rotation,
        });
        this.hud.toast(result.ok ? `${BUILDING_DEFS[this.mode.kind].label}开始构筑` : result.reason, result.ok ? 'success' : 'warning');
        if (result.ok) this.cancelMode();
      }
      this.drag = null;
      return;
    }

    if (this.drag.active) {
      const ids = this.scene.entitiesInScreenRect(this.dragRect(this.drag), this.simulation.state)
        .filter((id: string) => this.entityById(id)?.team === 'player');
      const units = ids.filter((id: string) => this.entityById(id)?.entityType === 'unit');
      this.applySelection(units.length > 0 ? units : ids, this.drag.shift);
    } else {
      const id = this.scene.pickEntity(event.clientX, event.clientY);
      if (id && this.entityById(id)?.team === 'player') this.applySelection([id], this.drag.shift);
      else if (!this.drag.shift) this.applySelection([], false);
    }
    this.drag = null;
    this.hud.setSelectionBox(null);
  }

  private onContextMenu(event: MouseEvent): void {
    event.preventDefault();
    if (!this.scene || this.selectedIds.size === 0 || this.simulation.state.status !== 'active') return;
    const unitIds = this.selectedUnitIds();
    const pickedId = this.scene.pickEntity(event.clientX, event.clientY);
    const picked = pickedId ? this.entityById(pickedId) : undefined;
    let command: GameCommand | null = null;

    if (picked?.entityType === 'resource' && unitIds.some((id) => this.unitKind(id) === 'harvester')) {
      command = { type: 'gather', unitIds, resourceId: picked.id, queued: event.shiftKey };
    } else if (
      picked &&
      picked.team === 'player' &&
      picked.hp < picked.maxHp &&
      unitIds.some((id) => this.unitKind(id) === 'engineer')
    ) {
      command = {
        type: 'repair',
        unitIds: unitIds.filter((id) => this.unitKind(id) === 'engineer'),
        targetId: picked.id,
        queued: event.shiftKey,
      };
    } else if (picked && picked.team === 'enemy') {
      command = { type: 'attack', unitIds, targetId: picked.id, queued: event.shiftKey };
    } else {
      const point = this.scene.groundAt(event.clientX, event.clientY);
      if (point) {
        const selectedBuilding = [...this.selectedIds].map((id) => this.entityById(id)).find((item) => item?.entityType === 'building');
        if (selectedBuilding?.entityType === 'building' && unitIds.length === 0) {
          command = { type: 'setRally', buildingId: selectedBuilding.id, target: point };
        } else if (this.mode.type === 'attackMove') {
          command = { type: 'attackMove', unitIds, target: point, queued: event.shiftKey };
        } else {
          command = { type: 'move', unitIds, target: point, queued: event.shiftKey };
        }
      }
    }

    if (!command) return;
    const result = this.issue(command);
    if (result.ok) {
      const at = 'target' in command ? command.target : picked?.position;
      if (at) this.scene.showCommandMarker(at, command.type === 'attack' || command.type === 'attackMove' ? 'danger' : 'info');
    } else {
      this.hud.toast(result.reason, 'warning');
    }
    if (this.mode.type === 'attackMove') this.mode = { type: 'select' };
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLButtonElement) {
      if (event.key !== 'Escape') return;
    }
    const key = event.key.toLowerCase();
    this.pressedKeys.add(key);

    if (event.key === 'Escape') {
      this.cancelMode();
      return;
    }
    if (key === 'a') {
      this.mode = { type: 'attackMove' };
      this.hud.toast('移动攻击：右键选择目标位置', 'info');
      return;
    }
    if (key === 'm') {
      this.mode = { type: 'select' };
      this.hud.toast('移动：右键选择目标位置', 'info');
      return;
    }
    if (key === 's' || key === 'h') {
      this.stopSelected();
      return;
    }
    if (key === 'b') {
      this.beginBuild('reactor');
      return;
    }
    if (key === 'r' && this.mode.type === 'build') {
      this.mode = { ...this.mode, rotation: this.mode.rotation + Math.PI / 2 };
      return;
    }
    if (event.code === 'Space') {
      event.preventDefault();
      const focus = this.firstSelectedPosition() ?? { x: -45, z: 38 };
      this.scene?.focus(focus);
      return;
    }
    if (/^[1-9]$/.test(key)) this.handleControlGroup(Number(key), event.ctrlKey, event.shiftKey);
  }

  private updateCamera(dt: number): void {
    if (!this.scene) return;
    const keyboardSpeed = KEYBOARD_PAN_SPEED * dt;
    let dx = 0;
    let dz = 0;
    if (this.pressedKeys.has('arrowup')) dz -= keyboardSpeed;
    if (this.pressedKeys.has('arrowdown')) dz += keyboardSpeed;
    if (this.pressedKeys.has('arrowleft')) dx -= keyboardSpeed;
    if (this.pressedKeys.has('arrowright')) dx += keyboardSpeed;

    if (this.pointer.inside && !this.edgePanBlocked) {
      const rect = this.hud.stage.getBoundingClientRect();
      const direction = visibleStageEdgePanDirection(
        this.pointer,
        rect,
        { width: window.innerWidth, height: window.innerHeight },
      );
      const edgeSpeed = EDGE_PAN_MAX_SPEED * dt;
      dx += direction.x * edgeSpeed;
      dz += direction.z * edgeSpeed;
    }
    if (dx !== 0 || dz !== 0) {
      const worldPan = screenPanToWorldPan(dx, dz);
      this.scene.pan(worldPan.x, worldPan.z);
    }
  }

  private beginBuild(kind: BuildingKind): void {
    if (this.simulation.state.status !== 'active') return;
    this.mode = { type: 'build', kind, rotation: 0 };
    const guidingFirstSentry = kind === 'sentry'
      && this.fixture.startsWith('breakthrough-demo')
      && this.simulation.state.mission.phase === 'deployment'
      && !this.simulation.state.buildings.some((building) => (
        building.team === 'player'
        && building.kind === 'sentry'
        && building.hp > 0
        && building.buildProgress >= 1
      ));
    if (guidingFirstSentry) {
      this.scene?.focus({ x: -18, z: 20 });
      this.hud.toast('已定位推荐建造区 · 战场中央蓝色时左键确认 · R 旋转 · Esc 取消', 'info');
      return;
    }
    this.hud.toast(`放置${BUILDING_DEFS[kind].label} · R 旋转 · Esc 取消`, 'info');
  }

  private produce(kind: UnitKind): void {
    const def = UNIT_DEFS[kind];
    const selectedProducer = [...this.selectedIds]
      .map((id) => this.entityById(id))
      .find((entity) => entity?.entityType === 'building' && entity.team === 'player' && entity.kind === def.producer);
    const producer = selectedProducer?.entityType === 'building'
      ? selectedProducer
      : this.simulation.state.buildings.find((building) => building.team === 'player' && building.kind === def.producer);
    if (!producer) {
      this.audio.playWarning();
      this.hud.toast(`需要${BUILDING_DEFS[def.producer].label}`, 'warning');
      return;
    }
    const result = this.issue({ type: 'produce', buildingId: producer.id, unitKind: kind });
    this.hud.toast(result.ok ? `${def.label}已加入队列` : result.reason, result.ok ? 'success' : 'warning');
  }

  private research(kind: TechnologyKind): void {
    const result = this.issue({ type: 'research', kind });
    this.hud.toast(
      result.ok ? `${TECHNOLOGY_DEFS[kind].label}研究已启动` : result.reason,
      result.ok ? 'success' : 'warning',
    );
  }

  private cancelConstruction(buildingId: string): void {
    const result = this.issue({ type: 'cancelConstruction', buildingId });
    if (result.ok) this.selectedIds.delete(buildingId);
    this.hud.toast(result.ok ? '施工已取消，返还 75% 成本' : result.reason, result.ok ? 'success' : 'warning');
  }

  private cancelProduction(buildingId: string): void {
    const result = this.issue({ type: 'cancelProduction', buildingId });
    this.hud.toast(result.ok ? '当前生产已取消，返还 75% 成本' : result.reason, result.ok ? 'success' : 'warning');
  }

  private cancelResearch(): void {
    const result = this.issue({ type: 'cancelResearch' });
    this.hud.toast(result.ok ? '当前研究已取消，返还 75% 成本' : result.reason, result.ok ? 'success' : 'warning');
  }

  private async handleAudioAction(): Promise<void> {
    if (!this.audio.available) {
      this.syncAudioHud();
      this.hud.toast('当前浏览器不支持战场音频，视觉反馈仍然可用', 'info');
      return;
    }

    if (this.audio.muted) {
      this.audio.setMuted(false);
      const unlocked = await this.audio.unlock();
      this.writeAudioMutedPreference(false);
      this.syncAudioHud();
      this.hud.toast(unlocked ? '战场声音已恢复' : '战场音频暂时无法启动', unlocked ? 'success' : 'warning');
      return;
    }

    if (!this.audio.unlocked) {
      const unlocked = await this.audio.unlock();
      this.syncAudioHud();
      this.hud.toast(unlocked ? '战场声音已启用' : '战场音频暂时无法启动', unlocked ? 'success' : 'warning');
      return;
    }

    this.audio.setMuted(true);
    this.writeAudioMutedPreference(true);
    this.syncAudioHud();
    this.hud.toast('战场声音已静音', 'info');
  }

  private async tryUnlockAudio(): Promise<void> {
    if (!this.audio.available || this.audio.muted || this.audio.unlocked) return;
    await this.audio.unlock();
    this.syncAudioHud();
  }

  private syncAudioHud(): void {
    this.hud.setAudioState({
      available: this.audio.available,
      muted: this.audio.muted,
      unlocked: this.audio.unlocked,
    });
  }

  private handleQualityAction(): void {
    this.setRenderQuality(nextRenderQuality(this.renderQuality));
  }

  private setRenderQuality(level: RenderQualityLevel): void {
    this.renderQuality = level;
    this.scene?.setRenderQuality(level);
    this.hud.setRenderQualityState(level);
    this.writeRenderQualityPreference(level);
    const label = level === 'high' ? '高' : level === 'medium' ? '中' : '低';
    this.hud.toast(`渲染画质已切换为${label}档`, 'info');
  }

  private readRenderQualityPreference(): string | null {
    try {
      return window.localStorage.getItem(RENDER_QUALITY_KEY);
    } catch {
      return null;
    }
  }

  private writeRenderQualityPreference(level: RenderQualityLevel): void {
    try {
      window.localStorage.setItem(RENDER_QUALITY_KEY, level);
    } catch {
      // Render quality persistence must never interrupt the battle.
    }
  }

  private readAudioMutedPreference(): boolean {
    try {
      return window.localStorage.getItem(AUDIO_MUTED_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private writeAudioMutedPreference(muted: boolean): void {
    try {
      window.localStorage.setItem(AUDIO_MUTED_KEY, String(muted));
    } catch {
      // Local preference persistence must never interrupt the battle.
    }
  }

  private handleHudCommand(command: 'move' | 'attackMove' | 'stop'): void {
    if (command === 'stop') this.stopSelected();
    else if (command === 'attackMove') {
      this.mode = { type: 'attackMove' };
      this.hud.toast('移动攻击：右键选择目标位置', 'info');
    } else {
      this.mode = { type: 'select' };
      this.hud.toast('移动：右键选择目标位置', 'info');
    }
  }

  private stopSelected(): void {
    const ids = this.selectedUnitIds();
    if (ids.length === 0) return;
    this.issue({ type: 'stop', unitIds: ids });
    this.mode = { type: 'select' };
  }

  private issue(command: GameCommand): { ok: boolean; reason: string } {
    const result = this.restoring
      ? { ok: false, reason: '正在载入战况，请稍候' }
      : this.recorder.issue(command);
    if (!result.ok) this.audio.playWarning();
    return result;
  }

  private saveGame(): void {
    if (this.restoring) {
      this.audio.playWarning();
      this.hud.toast('正在载入战况，请稍候', 'warning');
      return;
    }
    try {
      window.localStorage.setItem(SAVE_SLOT_KEY, this.recorder.serialize());
      this.hud.toast('当前战况已保存到本机', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : '浏览器拒绝了本地存储';
      this.audio.playWarning();
      this.hud.toast(`保存失败：${message}`, 'warning');
    }
  }

  private async loadGame(options: LoadGameOptions = {}): Promise<void> {
    if (this.restoring) return;
    const automatic = options.automatic ?? false;
    let serialized = options.serialized ?? null;
    if (!serialized) {
      try {
        serialized = window.localStorage.getItem(SAVE_SLOT_KEY);
      } catch (error) {
        const message = error instanceof Error ? error.message : '浏览器拒绝了本地存储';
        if (automatic) this.handleAutomaticResumeFailure(message);
        else {
          this.audio.playWarning();
          this.hud.toast(`读取失败：${message}`, 'warning');
        }
        return;
      }
    }
    if (!serialized) {
      if (automatic) this.handleAutomaticResumeFailure('本地存档不存在');
      else this.hud.toast('尚未保存本地战况', 'info');
      return;
    }

    this.restoring = true;
    this.hud.toast('正在按命令记录重建战场…', 'info');
    try {
      const log = parseReplay(serialized);
      const fixtureError = replayFixtureLoadError(this.fixture, log.fixture);
      if (fixtureError) throw new Error(fixtureError);
      const restored = await this.rebuildRecorder(log);
      this.recorder = restored;
      this.simulation = restored.simulation;
      this.seed = log.seed;
      this.selectedIds.clear();
      this.controlGroups.clear();
      this.cancelMode();
      this.scene?.resetPresentationSession();
      const playerHq = this.simulation.state.buildings.find(
        (building) => building.team === 'player' && building.kind === 'hq',
      );
      this.scene?.focus(playerHq?.position ?? { x: -45, z: 38 });
      this.syncUrlAfterLoad(log);
      this.hud.toast('战况已恢复，确定性校验通过', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : '存档内容无法识别';
      if (automatic) this.handleAutomaticResumeFailure(message);
      else {
        this.audio.playWarning();
        this.hud.toast(`读取失败：${message}`, 'warning');
      }
    } finally {
      this.restoring = false;
      this.accumulator = 0;
      this.lastFrame = performance.now();
      this.renderNow();
    }
  }

  private async rebuildRecorder(log: ReplayLog): Promise<ReplayRecorder> {
    const recorder = createReplayRecorder(log.seed, log.fixture);
    let commandIndex = 0;
    let processedTicks = 0;
    while (true) {
      while (commandIndex < log.commands.length && log.commands[commandIndex]?.tick === recorder.currentTick) {
        const entry = log.commands[commandIndex];
        if (!entry) break;
        const result = recorder.issue(entry.command);
        if (!result.ok) throw new Error(`第 ${entry.tick} 帧命令无法恢复：${result.reason}`);
        commandIndex += 1;
      }
      recorder.simulation.drainEvents();
      if (recorder.currentTick === log.currentTick) break;
      if (recorder.simulation.state.status !== 'active') {
        throw new Error(`对局已在第 ${recorder.currentTick} 帧结束，存档目标帧无效`);
      }
      recorder.stepTicks(1);
      recorder.simulation.drainEvents();
      processedTicks += 1;
      if (processedTicks % 300 === 0) {
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      }
    }
    if (commandIndex !== log.commands.length) throw new Error('存档包含目标帧之后的命令');
    return recorder;
  }

  private cancelMode(): void {
    this.mode = { type: 'select' };
    this.scene?.clearBuildGhost();
    this.hud.setSelectionBox(null);
    this.drag = null;
  }

  private deployDifficulty(
    difficulty: BreakthroughDifficultyId,
    mode: 'initial' | 'change',
  ): boolean {
    const reduced = this.fixture.endsWith('-reduced');
    const targetFixture = breakthroughFixtureForDifficulty(difficulty, reduced);
    const url = new URL(window.location.href);
    url.searchParams.set('fixture', targetFixture);
    url.searchParams.set('seed', String(this.seed));
    url.searchParams.set('quality', this.renderQuality);
    url.searchParams.delete('fallback');
    url.searchParams.delete('resume');
    url.searchParams.delete('resumeTick');

    // The root briefing already owns a fully constructed tick-zero standard
    // battlefield. Starting that same difficulty in place preserves decoded
    // GLBs, GPU resources and the verified asset ledger instead of paying for
    // a second page load. A difficulty change or any progressed match still
    // follows the canonical navigation/rebuild path.
    if (canStartBreakthroughDeploymentInPlace(
      this.fixture,
      targetFixture,
      this.simulation.state.tick,
      this.simulation.state.status,
      mode,
    )) {
      url.searchParams.delete('deploy');
      window.history.replaceState(null, '', url);
      return true;
    }

    url.searchParams.set('deploy', '1');
    window.location.replace(url.toString());
    return false;
  }

  private resumeSavedDeployment(summary: SavedDeploymentSummary): void {
    const url = new URL(window.location.href);
    url.searchParams.set('fixture', summary.fixture);
    url.searchParams.set('seed', String(summary.seed));
    url.searchParams.set('quality', this.renderQuality);
    url.searchParams.set('resume', '1');
    url.searchParams.set('resumeTick', String(summary.currentTick));
    url.searchParams.delete('deploy');
    url.searchParams.delete('fallback');
    window.location.replace(url.toString());
  }

  private readSavedDeploymentSlot(): SavedDeploymentSlot | null {
    try {
      const serialized = window.localStorage.getItem(SAVE_SLOT_KEY);
      const summary = parseSavedDeploymentSummary(serialized);
      return serialized && summary ? { serialized, summary } : null;
    } catch {
      return null;
    }
  }

  private clearResumeRequest(): void {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('resume') && !url.searchParams.has('resumeTick')) return;
    url.searchParams.delete('resume');
    url.searchParams.delete('resumeTick');
    window.history.replaceState(null, '', url);
  }

  private syncUrlAfterLoad(log: ReplayLog): void {
    const url = new URL(window.location.href);
    url.searchParams.set('fixture', log.fixture);
    url.searchParams.set('seed', String(log.seed));
    url.searchParams.delete('resume');
    url.searchParams.delete('resumeTick');
    window.history.replaceState(null, '', url);
  }

  private handleAutomaticResumeFailure(reason: string): void {
    this.clearResumeRequest();
    this.audio.playWarning();
    this.hud.disableResumeDeployment();
    this.hud.toast(`无法恢复上次战况：${reason}。请开始新战局`, 'warning');
    this.hud.showDeploymentBriefing('initial');
  }

  private applyFixtureOpeningSelection(): void {
    this.selectedIds.clear();
    const prefix = this.fixture === 'campaign-demo' || this.fixture === 'campaign-demo-reduced'
      ? 'u-demo-player-'
      : this.fixture.startsWith('breakthrough-demo')
        ? 'u-break-player-'
        : null;
    if (!prefix) return;
    for (const unit of this.simulation.state.units) {
      if (unit.team === 'player' && unit.id.startsWith(prefix)) this.selectedIds.add(unit.id);
    }
  }

  private restart(): void {
    if (this.fixture === 'breakthrough-demo-victory-review' || this.fixture === 'breakthrough-demo-defeat-review') {
      this.fixture = 'breakthrough-demo';
      const url = new URL(window.location.href);
      url.searchParams.set('fixture', this.fixture);
      window.history.replaceState(null, '', url);
    }
    this.scene?.resetPresentationSession();
    this.recorder = createReplayRecorder(this.seed, this.fixture);
    this.simulation = this.recorder.simulation;
    this.applyFixtureOpeningSelection();
    this.controlGroups.clear();
    this.cancelMode();
    this.scene?.focus(this.fixture === 'visual-gold-review'
      ? { x: -2, z: 0 }
      : this.fixture === 'destruction-residue-review' || this.fixture === 'destruction-residue-review-reduced'
      ? { x: 0, z: 0 }
      : this.fixture === 'building-ruin-review' || this.fixture === 'building-ruin-review-reduced'
      ? { x: 0, z: 0 }
      : this.fixture === 'building-damage-review' || this.fixture === 'building-damage-review-reduced'
      ? { x: 3.5, z: 3.5 }
      : this.fixture === 'enemy-infrastructure-review'
      ? { x: 0, z: 0 }
      : this.fixture === 'player-infrastructure-review'
      ? { x: 0, z: 0 }
      : this.fixture === 'enemy-vehicle-socket-review'
      ? { x: 0, z: 0 }
      : this.fixture === 'combat-vehicle-family-review'
      ? { x: 0, z: 0 }
      : this.fixture === 'wreck-review' || this.fixture === 'wreck-review-reduced'
      ? { x: 0, z: 1 }
      : this.fixture === 'construction-review' || this.fixture === 'construction-review-reduced'
      ? { x: 12, z: 0 }
      : isPlayableBreakthroughFixture(this.fixture)
      ? { x: -31, z: 22 }
      : this.fixture.startsWith('breakthrough-demo')
      ? { x: 8, z: -16 }
      : this.fixture === 'campaign-demo' || this.fixture === 'campaign-demo-reduced'
        ? { x: -12, z: 9 }
        : { x: -45, z: 38 });
    if (this.fixture === 'visual-gold-review') this.scene?.setViewHeight(44);
    if (this.fixture === 'destruction-residue-review' || this.fixture === 'destruction-residue-review-reduced') {
      this.scene?.setViewHeight(56);
    }
    if (this.fixture === 'building-ruin-review' || this.fixture === 'building-ruin-review-reduced') {
      this.scene?.setViewHeight(48);
    }
    if (this.fixture === 'building-damage-review' || this.fixture === 'building-damage-review-reduced') {
      this.scene?.setViewHeight(56);
    }
    if (this.fixture === 'enemy-infrastructure-review') this.scene?.setViewHeight(50);
    if (this.fixture === 'player-infrastructure-review') this.scene?.setViewHeight(50);
    if (this.fixture === 'enemy-vehicle-socket-review') this.scene?.setViewHeight(32);
    if (this.fixture === 'combat-vehicle-family-review') this.scene?.setViewHeight(48);
    if (this.fixture === 'wreck-review' || this.fixture === 'wreck-review-reduced') {
      this.scene?.setViewHeight(48);
    }
    if (this.fixture === 'construction-review' || this.fixture === 'construction-review-reduced') {
      this.scene?.setViewHeight(80);
    }
    this.hud.toast('战术模拟已重置', 'success');
  }

  private handleControlGroup(group: number, assign: boolean, append: boolean): void {
    if (assign) {
      const current = [...this.selectedIds];
      const next = append ? [...new Set([...(this.controlGroups.get(group) ?? []), ...current])] : current;
      this.controlGroups.set(group, next);
      this.hud.toast(`编队 ${group} 已记录 ${next.length} 个目标`, 'success');
      return;
    }
    const ids = (this.controlGroups.get(group) ?? []).filter((id) => this.entityById(id)?.team === 'player');
    this.selectedIds = new Set(ids);
    const now = performance.now();
    if (this.lastGroupTap.group === group && now - this.lastGroupTap.at < 420) {
      const position = this.firstSelectedPosition();
      if (position) this.scene?.focus(position);
    }
    this.lastGroupTap = { group, at: now };
  }

  private selectFromHud(id: string): void {
    const entity = this.entityById(id);
    if (!entity || entity.team !== 'player') return;
    this.selectedIds = new Set([id]);
    this.scene?.focus(entity.position);
  }

  private navigateFromMinimap(point: MinimapNavigationPoint): void {
    const bounds = this.simulation.state.intel.player.visibility.bounds;
    this.scene?.focus(normalizedMinimapPointToWorld(point, bounds));
  }

  private applySelection(ids: string[], append: boolean): void {
    if (!append) this.selectedIds.clear();
    for (const id of ids) {
      if (this.selectedIds.has(id) && append) this.selectedIds.delete(id);
      else this.selectedIds.add(id);
    }
  }

  private selectedUnitIds(): string[] {
    return [...this.selectedIds].filter((id) => this.entityById(id)?.entityType === 'unit');
  }

  private unitKind(id: string): UnitKind | undefined {
    const entity = this.entityById(id);
    return entity?.entityType === 'unit' ? entity.kind : undefined;
  }

  private entityById(id: string): WorldEntity | undefined {
    return [...this.simulation.state.units, ...this.simulation.state.buildings, ...this.simulation.state.resources]
      .find((entity) => entity.id === id);
  }

  private firstSelectedPosition(): Vec2 | undefined {
    const id = this.selectedIds.values().next().value as string | undefined;
    return id ? this.entityById(id)?.position : undefined;
  }

  private pruneSelection(): void {
    for (const id of this.selectedIds) if (!this.entityById(id)) this.selectedIds.delete(id);
  }

  private dragRect(drag: SelectionDrag): { left: number; top: number; right: number; bottom: number } {
    return {
      left: Math.min(drag.startX, drag.currentX),
      top: Math.min(drag.startY, drag.currentY),
      right: Math.max(drag.startX, drag.currentX),
      bottom: Math.max(drag.startY, drag.currentY),
    };
  }

  private cancelPointer(): void {
    this.drag = null;
    this.middleDrag = null;
    this.hud.setSelectionBox(null);
  }

  dispose(): void {
    cancelAnimationFrame(this.animationFrame);
    this.audio.dispose();
    this.scene?.dispose();
    this.hud.dispose();
  }
}

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('缺少 #app 根节点。');

const app = new FaultlineApp(root);
window.addEventListener('beforeunload', () => app.dispose(), { once: true });
