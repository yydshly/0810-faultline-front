export const TECHNOLOGY_KINDS = [
  'efficientRefining',
  'compositeArmor',
  'signalAmplifier',
] as const;

export type TechnologyKind = (typeof TECHNOLOGY_KINDS)[number];

export interface TechnologyEffects {
  resourceIncomeMultiplier: number;
  maxHealthMultiplier: number;
  radarRangeMultiplier: number;
}

export type TechnologyEffectKind = keyof TechnologyEffects;

export interface TechnologyDefinition {
  kind: TechnologyKind;
  label: string;
  description: string;
  cost: number;
  durationSeconds: number;
  effect: Readonly<{
    kind: TechnologyEffectKind;
    multiplier: number;
  }>;
}

export const TECHNOLOGY_DEFS: Readonly<Record<TechnologyKind, Readonly<TechnologyDefinition>>> = Object.freeze({
  efficientRefining: Object.freeze({
    kind: 'efficientRefining',
    label: '高效精炼',
    description: '优化辉晶分离与入账流程，使采集资源入账提高 20%。',
    cost: 800,
    durationSeconds: 45,
    effect: Object.freeze({ kind: 'resourceIncomeMultiplier', multiplier: 1.2 }),
  }),
  compositeArmor: Object.freeze({
    kind: 'compositeArmor',
    label: '复合装甲',
    description: '部署复合装甲结构，使生命上限提高 15%。',
    cost: 1_200,
    durationSeconds: 60,
    effect: Object.freeze({ kind: 'maxHealthMultiplier', multiplier: 1.15 }),
  }),
  signalAmplifier: Object.freeze({
    kind: 'signalAmplifier',
    label: '信号增幅',
    description: '增强战术信号覆盖，使雷达范围提高 35%。',
    cost: 1_000,
    durationSeconds: 50,
    effect: Object.freeze({ kind: 'radarRangeMultiplier', multiplier: 1.35 }),
  }),
});

export const TECHNOLOGY_CANCEL_REFUND_RATIO = 0.75;

export interface CurrentTechnologyResearch {
  readonly kind: TechnologyKind;
  readonly elapsedSeconds: number;
}

/** Plain-data state: safe to clone or persist with JSON. */
export interface TechnologyTeamState {
  readonly completed: readonly TechnologyKind[];
  readonly current: CurrentTechnologyResearch | null;
}

export type TechnologyFailureReason =
  | 'invalidTechnology'
  | 'invalidCredits'
  | 'insufficientCredits'
  | 'alreadyCompleted'
  | 'researchInProgress'
  | 'invalidDeltaTime'
  | 'invalidState'
  | 'noActiveResearch';

export interface TechnologyTransactionResult {
  readonly ok: boolean;
  readonly state: TechnologyTeamState;
  /** Team credits after this operation. */
  readonly credits: number;
  /** Negative when paying, positive when receiving a refund, zero on rejection. */
  readonly creditDelta: number;
  readonly reason: TechnologyFailureReason | null;
}

export interface TechnologyAdvanceResult {
  readonly ok: boolean;
  readonly state: TechnologyTeamState;
  /** Non-null exactly once, on the call that completes the active research. */
  readonly completed: TechnologyKind | null;
  readonly reason: TechnologyFailureReason | null;
}

const PROGRESS_PRECISION = 1_000_000;

const isTechnologyKind = (value: unknown): value is TechnologyKind =>
  typeof value === 'string' && Object.hasOwn(TECHNOLOGY_DEFS, value);

const roundProgress = (seconds: number): number =>
  Math.round(seconds * PROGRESS_PRECISION) / PROGRESS_PRECISION;

const canonicalCompleted = (completed: readonly TechnologyKind[]): TechnologyKind[] =>
  TECHNOLOGY_KINDS.filter((kind) => completed.includes(kind));

const cloneState = (state: TechnologyTeamState): TechnologyTeamState => ({
  completed: [...state.completed],
  current: state.current
    ? { kind: state.current.kind, elapsedSeconds: state.current.elapsedSeconds }
    : null,
});

const validCredits = (credits: number): boolean => Number.isFinite(credits) && credits >= 0;

const validCurrentResearch = (current: CurrentTechnologyResearch): boolean =>
  isTechnologyKind(current.kind)
  && Number.isFinite(current.elapsedSeconds)
  && current.elapsedSeconds >= 0
  && current.elapsedSeconds < TECHNOLOGY_DEFS[current.kind].durationSeconds;

const transactionFailure = (
  state: TechnologyTeamState,
  credits: number,
  reason: TechnologyFailureReason,
): TechnologyTransactionResult => ({
  ok: false,
  state: cloneState(state),
  credits,
  creditDelta: 0,
  reason,
});

export function createTechnologyTeamState(
  completed: readonly TechnologyKind[] = [],
): TechnologyTeamState {
  return { completed: canonicalCompleted(completed), current: null };
}

/** Starts one research item and atomically deducts its base cost. */
export function startTechnology(
  state: TechnologyTeamState,
  kind: TechnologyKind,
  credits: number,
): TechnologyTransactionResult {
  if (!validCredits(credits)) return transactionFailure(state, credits, 'invalidCredits');
  if (!isTechnologyKind(kind)) return transactionFailure(state, credits, 'invalidTechnology');
  if (state.completed.includes(kind)) return transactionFailure(state, credits, 'alreadyCompleted');
  if (state.current !== null) return transactionFailure(state, credits, 'researchInProgress');

  const cost = TECHNOLOGY_DEFS[kind].cost;
  if (credits < cost) return transactionFailure(state, credits, 'insufficientCredits');
  return {
    ok: true,
    state: {
      completed: [...state.completed],
      current: { kind, elapsedSeconds: 0 },
    },
    credits: credits - cost,
    creditDelta: -cost,
    reason: null,
  };
}

/** Advances active research; completion is emitted only by the transition to completed. */
export function advanceTechnology(
  state: TechnologyTeamState,
  dtSeconds: number,
): TechnologyAdvanceResult {
  const unchanged = cloneState(state);
  if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
    return { ok: false, state: unchanged, completed: null, reason: 'invalidDeltaTime' };
  }
  if (state.current === null) {
    return { ok: false, state: unchanged, completed: null, reason: 'noActiveResearch' };
  }
  if (!validCurrentResearch(state.current) || state.completed.includes(state.current.kind)) {
    return { ok: false, state: unchanged, completed: null, reason: 'invalidState' };
  }

  const elapsedSeconds = roundProgress(state.current.elapsedSeconds + dtSeconds);
  const definition = TECHNOLOGY_DEFS[state.current.kind];
  if (elapsedSeconds < definition.durationSeconds) {
    return {
      ok: true,
      state: {
        completed: [...state.completed],
        current: { kind: state.current.kind, elapsedSeconds },
      },
      completed: null,
      reason: null,
    };
  }

  const completed = canonicalCompleted([...state.completed, state.current.kind]);
  return {
    ok: true,
    state: { completed, current: null },
    completed: state.current.kind,
    reason: null,
  };
}

/** Cancels active research and refunds 75% of its base cost exactly once. */
export function cancelTechnology(
  state: TechnologyTeamState,
  credits: number,
): TechnologyTransactionResult {
  if (!validCredits(credits)) return transactionFailure(state, credits, 'invalidCredits');
  if (state.current === null) return transactionFailure(state, credits, 'noActiveResearch');
  if (!validCurrentResearch(state.current) || state.completed.includes(state.current.kind)) {
    return transactionFailure(state, credits, 'invalidState');
  }

  const refund = TECHNOLOGY_DEFS[state.current.kind].cost * TECHNOLOGY_CANCEL_REFUND_RATIO;
  const refundedCredits = credits + refund;
  if (!Number.isFinite(refundedCredits)) return transactionFailure(state, credits, 'invalidCredits');
  return {
    ok: true,
    state: { completed: [...state.completed], current: null },
    credits: refundedCredits,
    creditDelta: refund,
    reason: null,
  };
}

/** Returns multiplicative effects from completed research only. */
export function getTechnologyEffects(state: TechnologyTeamState): TechnologyEffects {
  const effects: TechnologyEffects = {
    resourceIncomeMultiplier: 1,
    maxHealthMultiplier: 1,
    radarRangeMultiplier: 1,
  };
  for (const kind of canonicalCompleted(state.completed)) {
    const effect = TECHNOLOGY_DEFS[kind].effect;
    effects[effect.kind] *= effect.multiplier;
  }
  return effects;
}
