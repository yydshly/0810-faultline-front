import type { SimulationEvent } from './types';

export const AUDIO_CUE_KINDS = [
  'command',
  'warning',
  'shotLight',
  'shotHeavy',
  'impact',
  'destroyed',
  'deposit',
  'buildComplete',
  'productionComplete',
  'researchComplete',
  'repair',
  'cancelled',
] as const;

export type AudioCueKind = (typeof AUDIO_CUE_KINDS)[number];

export interface AudioCue {
  readonly kind: AudioCueKind;
  readonly priority: number;
  readonly waveform: OscillatorType;
  readonly startFrequency: number;
  readonly endFrequency: number;
  readonly durationSeconds: number;
  readonly gain: number;
  readonly throttleMs: number;
  readonly pan: number;
}

export interface AudioCueMappingOptions {
  /** World X coordinate of the camera/listener center. */
  readonly listenerX?: number;
  /** World distance from center that reaches full left/right pan. */
  readonly panDistance?: number;
  /** Damage at or above this value uses the heavy-shot cue. */
  readonly heavyShotDamage?: number;
}

interface AudioCuePreset extends Omit<AudioCue, 'pan'> {}

const CUE_PRESETS: Readonly<Record<AudioCueKind, Readonly<AudioCuePreset>>> = Object.freeze({
  command: Object.freeze({
    kind: 'command', priority: 55, waveform: 'sine', startFrequency: 620, endFrequency: 880,
    durationSeconds: 0.075, gain: 0.045, throttleMs: 80,
  }),
  warning: Object.freeze({
    kind: 'warning', priority: 88, waveform: 'square', startFrequency: 340, endFrequency: 190,
    durationSeconds: 0.2, gain: 0.062, throttleMs: 180,
  }),
  shotLight: Object.freeze({
    kind: 'shotLight', priority: 25, waveform: 'square', startFrequency: 270, endFrequency: 145,
    durationSeconds: 0.055, gain: 0.028, throttleMs: 45,
  }),
  shotHeavy: Object.freeze({
    kind: 'shotHeavy', priority: 45, waveform: 'sawtooth', startFrequency: 125, endFrequency: 52,
    durationSeconds: 0.16, gain: 0.07, throttleMs: 90,
  }),
  impact: Object.freeze({
    kind: 'impact', priority: 40, waveform: 'triangle', startFrequency: 175, endFrequency: 72,
    durationSeconds: 0.09, gain: 0.052, throttleMs: 55,
  }),
  destroyed: Object.freeze({
    kind: 'destroyed', priority: 100, waveform: 'sawtooth', startFrequency: 105, endFrequency: 28,
    durationSeconds: 0.46, gain: 0.105, throttleMs: 110,
  }),
  deposit: Object.freeze({
    kind: 'deposit', priority: 68, waveform: 'sine', startFrequency: 720, endFrequency: 1_020,
    durationSeconds: 0.17, gain: 0.06, throttleMs: 240,
  }),
  buildComplete: Object.freeze({
    kind: 'buildComplete', priority: 84, waveform: 'triangle', startFrequency: 390, endFrequency: 720,
    durationSeconds: 0.3, gain: 0.072, throttleMs: 220,
  }),
  productionComplete: Object.freeze({
    kind: 'productionComplete', priority: 76, waveform: 'square', startFrequency: 500, endFrequency: 760,
    durationSeconds: 0.2, gain: 0.052, throttleMs: 150,
  }),
  researchComplete: Object.freeze({
    kind: 'researchComplete', priority: 92, waveform: 'sine', startFrequency: 470, endFrequency: 1_080,
    durationSeconds: 0.42, gain: 0.078, throttleMs: 300,
  }),
  repair: Object.freeze({
    kind: 'repair', priority: 18, waveform: 'sine', startFrequency: 880, endFrequency: 1_040,
    durationSeconds: 0.05, gain: 0.022, throttleMs: 170,
  }),
  cancelled: Object.freeze({
    kind: 'cancelled', priority: 72, waveform: 'triangle', startFrequency: 350, endFrequency: 165,
    durationSeconds: 0.15, gain: 0.05, throttleMs: 160,
  }),
});

const DEFAULT_PAN_DISTANCE = 80;
const DEFAULT_HEAVY_SHOT_DAMAGE = 30;
const DEFAULT_MAX_VOICES = 10;
const MAX_VOICES_LIMIT = 32;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

/** Maps flat-world X distance to Web Audio's normalized stereo pan range. */
export function worldXToStereoPan(
  worldX: number,
  listenerX = 0,
  panDistance = DEFAULT_PAN_DISTANCE,
): number {
  if (!Number.isFinite(worldX) || !Number.isFinite(listenerX)) return 0;
  if (!Number.isFinite(panDistance) || panDistance <= 0) return 0;
  return clamp((worldX - listenerX) / panDistance, -1, 1);
}

/** Creates a standalone cue for UI feedback that has no SimulationEvent. */
export function createAudioCue(kind: AudioCueKind, pan = 0): AudioCue {
  const preset = CUE_PRESETS[kind];
  return {
    ...preset,
    pan: Number.isFinite(pan) ? clamp(pan, -1, 1) : 0,
  };
}

/** Pure deterministic mapping; research-start events reuse the command cue. */
export function mapSimulationEventToAudioCue(
  event: SimulationEvent,
  options: AudioCueMappingOptions = {},
): AudioCue {
  const heavyThreshold = Number.isFinite(options.heavyShotDamage)
    ? Math.max(0, options.heavyShotDamage ?? DEFAULT_HEAVY_SHOT_DAMAGE)
    : DEFAULT_HEAVY_SHOT_DAMAGE;
  let kind: AudioCueKind;
  switch (event.type) {
    case 'command':
      kind = 'command';
      break;
    case 'shot':
      kind = (event.radius ?? 0) > 0 || (event.amount ?? 0) >= heavyThreshold ? 'shotHeavy' : 'shotLight';
      break;
    case 'impact':
      kind = 'impact';
      break;
    case 'destroyed':
      kind = 'destroyed';
      break;
    case 'alert':
      kind = 'warning';
      break;
    case 'deposit':
      kind = 'deposit';
      break;
    case 'built':
      kind = 'buildComplete';
      break;
    case 'produced':
      kind = 'productionComplete';
      break;
    case 'research':
      kind = event.amount === undefined ? 'researchComplete' : 'command';
      break;
    case 'repair':
      kind = 'repair';
      break;
    case 'cancelled':
      kind = 'cancelled';
      break;
    default: {
      const exhaustive: never = event.type;
      throw new Error(`Unsupported simulation event: ${String(exhaustive)}`);
    }
  }
  return createAudioCue(
    kind,
    worldXToStereoPan(
      event.at.x,
      options.listenerX ?? 0,
      options.panDistance ?? DEFAULT_PAN_DISTANCE,
    ),
  );
}

export interface AudioParamLike {
  value: number;
  setValueAtTime(value: number, time: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
}

export interface AudioNodeLike {
  connect(destination: AudioNodeLike): unknown;
  disconnect(): void;
}

export interface OscillatorNodeLike extends AudioNodeLike {
  type: OscillatorType;
  frequency: AudioParamLike;
  onended: (() => void) | null;
  start(when?: number): void;
  stop(when?: number): void;
}

export interface GainNodeLike extends AudioNodeLike {
  gain: AudioParamLike;
}

export interface StereoPannerNodeLike extends AudioNodeLike {
  pan: AudioParamLike;
}

export interface AudioContextLike {
  readonly currentTime: number;
  readonly destination: AudioNodeLike;
  readonly state: string;
  createOscillator(): OscillatorNodeLike;
  createGain(): GainNodeLike;
  createStereoPanner?(): StereoPannerNodeLike;
  resume?(): Promise<void>;
  close?(): Promise<void>;
}

export type AudioContextFactory = () => AudioContextLike | null;
export type AudioEventFilter = (event: SimulationEvent) => boolean;

export interface GameAudioOptions {
  /** Omit for the browser AudioContext; pass null for an explicit no-audio environment. */
  readonly contextFactory?: AudioContextFactory | null;
  readonly maxVoices?: number;
  readonly volume?: number;
  readonly panDistance?: number;
  readonly heavyShotDamage?: number;
}

interface ActiveVoice {
  readonly id: number;
  readonly priority: number;
  readonly startedAt: number;
  readonly oscillator: OscillatorNodeLike;
  readonly gain: GainNodeLike;
  readonly nodes: AudioNodeLike[];
}

type AudioContextConstructor = new () => unknown;

function browserContextFactory(): AudioContextFactory | null {
  const audioGlobal = globalThis as typeof globalThis & {
    webkitAudioContext?: AudioContextConstructor;
  };
  const Constructor: AudioContextConstructor | undefined = audioGlobal.AudioContext
    ?? audioGlobal.webkitAudioContext;
  if (typeof Constructor !== 'function') return null;
  return () => new Constructor() as AudioContextLike;
}

/**
 * Small synthesized Web Audio feedback layer.
 * Call `unlock()` directly from a pointer/keyboard handler before `consume()`.
 */
export class GameAudio {
  private readonly contextFactory: AudioContextFactory | null;
  private readonly maxVoices: number;
  private readonly volume: number;
  private readonly panDistance: number;
  private readonly heavyShotDamage: number;
  private readonly voices = new Map<number, ActiveVoice>();
  private readonly lastCueAt = new Map<AudioCueKind, number>();

  private context: AudioContextLike | null = null;
  private mutedState = false;
  private unlockedState = false;
  private disposed = false;
  private voiceSequence = 1;

  public constructor(options: GameAudioOptions = {}) {
    this.contextFactory = options.contextFactory === undefined
      ? browserContextFactory()
      : options.contextFactory;
    this.maxVoices = Number.isFinite(options.maxVoices)
      ? clamp(Math.floor(options.maxVoices ?? DEFAULT_MAX_VOICES), 1, MAX_VOICES_LIMIT)
      : DEFAULT_MAX_VOICES;
    this.volume = Number.isFinite(options.volume) ? clamp(options.volume ?? 1, 0, 1) : 1;
    this.panDistance = Number.isFinite(options.panDistance) && (options.panDistance ?? 0) > 0
      ? options.panDistance ?? DEFAULT_PAN_DISTANCE
      : DEFAULT_PAN_DISTANCE;
    this.heavyShotDamage = Number.isFinite(options.heavyShotDamage)
      ? Math.max(0, options.heavyShotDamage ?? DEFAULT_HEAVY_SHOT_DAMAGE)
      : DEFAULT_HEAVY_SHOT_DAMAGE;
  }

  public get available(): boolean {
    return this.contextFactory !== null && !this.disposed;
  }

  public get muted(): boolean {
    return this.mutedState;
  }

  public get unlocked(): boolean {
    return this.unlockedState
      && !this.disposed
      && this.context?.state === 'running';
  }

  public get activeVoiceCount(): number {
    return this.voices.size;
  }

  /** Must be invoked in a user gesture in browsers with autoplay restrictions. */
  public async unlock(): Promise<boolean> {
    if (this.disposed || !this.contextFactory) {
      this.unlockedState = false;
      return false;
    }
    try {
      if (this.context?.state === 'closed') this.context = null;
      if (!this.context) {
        this.context = this.contextFactory();
        this.lastCueAt.clear();
      }
      if (!this.context) {
        this.unlockedState = false;
        return false;
      }
      if (this.context.state === 'suspended' || this.context.state === 'interrupted') {
        await this.context.resume?.();
      }
      this.unlockedState = this.context.state === 'running';
      return this.unlockedState;
    } catch {
      const failedContext = this.context;
      this.stopAllVoices();
      this.lastCueAt.clear();
      this.unlockedState = false;
      this.context = null;
      try {
        await failedContext?.close?.();
      } catch {
        // A failed resume may also make close reject; the instance is discarded either way.
      }
      return false;
    }
  }

  public setMuted(muted: boolean): void {
    this.mutedState = muted;
    if (muted) this.stopAllVoices();
  }

  public toggleMuted(): boolean {
    this.setMuted(!this.mutedState);
    return this.mutedState;
  }

  /** Plays the non-spatial UI rejection cue, or spatializes it when coordinates are supplied. */
  public playWarning(worldX = 0, listenerX = 0): boolean {
    return this.playCue(createAudioCue(
      'warning',
      worldXToStereoPan(worldX, listenerX, this.panDistance),
    ));
  }

  /** Maps and plays a deterministic batch. Returns the number of cues started. */
  public consume(
    events: readonly SimulationEvent[],
    listenerX = 0,
    isAudible: AudioEventFilter = () => true,
  ): number {
    if (!this.canPlay()) return 0;
    const cues = events
      .filter((event) => {
        try {
          return isAudible(event);
        } catch {
          return false;
        }
      })
      .map((event, index) => ({
        cue: mapSimulationEventToAudioCue(event, {
          listenerX,
          panDistance: this.panDistance,
          heavyShotDamage: this.heavyShotDamage,
        }),
        index,
      }))
      .sort((left, right) => right.cue.priority - left.cue.priority || left.index - right.index);
    let played = 0;
    for (const { cue } of cues) if (this.playCue(cue)) played += 1;
    return played;
  }

  public playCue(cue: AudioCue): boolean {
    if (!this.canPlay() || !this.validCue(cue)) return false;
    const context = this.context;
    if (!context) return false;
    const nowMs = context.currentTime * 1_000;
    const lastAt = this.lastCueAt.get(cue.kind) ?? Number.NEGATIVE_INFINITY;
    if (nowMs - lastAt < cue.throttleMs) return false;
    if (!this.reserveVoice(cue.priority)) return false;

    let oscillator: OscillatorNodeLike | null = null;
    let gain: GainNodeLike | null = null;
    let panner: StereoPannerNodeLike | null = null;
    let voiceId: number | null = null;
    try {
      const now = context.currentTime;
      const end = now + cue.durationSeconds;
      const peak = Math.min(end, now + Math.min(0.012, cue.durationSeconds * 0.25));
      oscillator = context.createOscillator();
      gain = context.createGain();
      try {
        panner = context.createStereoPanner?.() ?? null;
      } catch {
        panner = null;
      }
      oscillator.type = cue.waveform;
      oscillator.frequency.setValueAtTime(cue.startFrequency, now);
      oscillator.frequency.linearRampToValueAtTime(cue.endFrequency, end);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(cue.gain * this.volume, peak);
      gain.gain.linearRampToValueAtTime(0.0001, end);
      oscillator.connect(gain);
      if (panner) {
        panner.pan.setValueAtTime(cue.pan, now);
        gain.connect(panner);
        panner.connect(context.destination);
      } else {
        gain.connect(context.destination);
      }

      const id = this.voiceSequence;
      this.voiceSequence += 1;
      voiceId = id;
      const nodes: AudioNodeLike[] = panner ? [oscillator, gain, panner] : [oscillator, gain];
      const voice: ActiveVoice = { id, priority: cue.priority, startedAt: now, oscillator, gain, nodes };
      oscillator.onended = () => this.releaseVoice(id);
      this.voices.set(id, voice);
      oscillator.start(now);
      oscillator.stop(end + 0.01);
      this.lastCueAt.set(cue.kind, nowMs);
      return true;
    } catch {
      const voice = voiceId === null ? undefined : this.voices.get(voiceId);
      if (voice) this.stopVoice(voice);
      else for (const node of [oscillator, gain, panner]) this.safeDisconnect(node);
      return false;
    }
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopAllVoices();
    this.lastCueAt.clear();
    this.unlockedState = false;
    try {
      const closed = this.context?.close?.();
      void closed?.catch(() => undefined);
    } catch {
      // Safe degradation: closing audio must never break game teardown.
    }
    this.context = null;
  }

  private canPlay(): boolean {
    const operational = !this.disposed
      && this.available
      && this.unlockedState
      && !this.mutedState
      && this.context !== null
      && this.context.state === 'running';
    if (!operational && this.context?.state !== 'running') this.unlockedState = false;
    return operational;
  }

  private validCue(cue: AudioCue): boolean {
    return AUDIO_CUE_KINDS.includes(cue.kind)
      && Number.isFinite(cue.priority)
      && Number.isFinite(cue.startFrequency)
      && cue.startFrequency > 0
      && Number.isFinite(cue.endFrequency)
      && cue.endFrequency > 0
      && Number.isFinite(cue.durationSeconds)
      && cue.durationSeconds > 0
      && Number.isFinite(cue.gain)
      && cue.gain >= 0
      && Number.isFinite(cue.throttleMs)
      && cue.throttleMs >= 0
      && Number.isFinite(cue.pan)
      && cue.pan >= -1
      && cue.pan <= 1;
  }

  private reserveVoice(priority: number): boolean {
    if (this.voices.size < this.maxVoices) return true;
    const victim = [...this.voices.values()].sort(
      (left, right) => left.priority - right.priority || left.startedAt - right.startedAt || left.id - right.id,
    )[0];
    if (!victim || priority <= victim.priority) return false;
    this.stopVoice(victim);
    return true;
  }

  private stopAllVoices(): void {
    for (const voice of [...this.voices.values()]) this.stopVoice(voice);
  }

  private stopVoice(voice: ActiveVoice): void {
    if (!this.voices.delete(voice.id)) return;
    voice.oscillator.onended = null;
    try {
      voice.gain.gain.setValueAtTime(0.0001, this.context?.currentTime ?? 0);
      voice.oscillator.stop(this.context?.currentTime ?? 0);
    } catch {
      // A node may already have ended; disconnection below remains safe.
    }
    for (const node of voice.nodes) this.safeDisconnect(node);
  }

  private releaseVoice(id: number): void {
    const voice = this.voices.get(id);
    if (!voice) return;
    this.voices.delete(id);
    voice.oscillator.onended = null;
    for (const node of voice.nodes) this.safeDisconnect(node);
  }

  private safeDisconnect(node: AudioNodeLike | null): void {
    if (!node) return;
    try {
      node.disconnect();
    } catch {
      // Disconnection is intentionally idempotent across browser implementations.
    }
  }
}
