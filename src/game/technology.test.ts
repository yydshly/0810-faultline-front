import { describe, expect, it } from 'vitest';

import {
  TECHNOLOGY_CANCEL_REFUND_RATIO,
  TECHNOLOGY_DEFS,
  TECHNOLOGY_KINDS,
  advanceTechnology,
  cancelTechnology,
  createTechnologyTeamState,
  getTechnologyEffects,
  startTechnology,
  type TechnologyKind,
  type TechnologyTeamState,
} from './technology';

describe('科技研究状态机', () => {
  it('开始研究时一次性付费，且不会修改输入', () => {
    const initial = createTechnologyTeamState();
    const snapshot = structuredClone(initial);
    const result = startTechnology(initial, 'efficientRefining', 1_000);

    expect(result).toMatchObject({ ok: true, credits: 200, creditDelta: -800, reason: null });
    expect(result.state).toEqual({
      completed: [],
      current: { kind: 'efficientRefining', elapsedSeconds: 0 },
    });
    expect(initial).toEqual(snapshot);
    expect(JSON.parse(JSON.stringify(result.state))).toEqual(result.state);
  });

  it('一次只能研究一项，并拒绝余额不足与非有限 credits', () => {
    const initial = createTechnologyTeamState();
    expect(startTechnology(initial, 'compositeArmor', 1_199)).toMatchObject({
      ok: false,
      reason: 'insufficientCredits',
      creditDelta: 0,
    });
    for (const credits of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      expect(startTechnology(initial, 'efficientRefining', credits)).toMatchObject({
        ok: false,
        reason: 'invalidCredits',
        creditDelta: 0,
      });
    }

    const active = startTechnology(initial, 'efficientRefining', 2_000);
    expect(active.ok).toBe(true);
    expect(startTechnology(active.state, 'signalAmplifier', active.credits)).toMatchObject({
      ok: false,
      reason: 'researchInProgress',
    });
  });

  it('推进并只触发一次完成，已完成科技不能重复开始', () => {
    const started = startTechnology(createTechnologyTeamState(), 'efficientRefining', 2_000);
    const before = structuredClone(started.state);
    const partial = advanceTechnology(started.state, 12.5);
    expect(partial).toMatchObject({ ok: true, completed: null, reason: null });
    expect(partial.state.current?.elapsedSeconds).toBe(12.5);
    expect(started.state).toEqual(before);

    const completed = advanceTechnology(partial.state, 32.5);
    expect(completed).toMatchObject({ ok: true, completed: 'efficientRefining', reason: null });
    expect(completed.state).toEqual({ completed: ['efficientRefining'], current: null });

    expect(advanceTechnology(completed.state, 100)).toMatchObject({
      ok: false,
      completed: null,
      reason: 'noActiveResearch',
    });
    expect(startTechnology(completed.state, 'efficientRefining', 2_000)).toMatchObject({
      ok: false,
      reason: 'alreadyCompleted',
    });
  });

  it('拒绝负数与非有限 dt，零 dt 保持有效且不推进', () => {
    const started = startTechnology(createTechnologyTeamState(), 'signalAmplifier', 2_000);
    for (const dt of [-0.01, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(advanceTechnology(started.state, dt)).toMatchObject({
        ok: false,
        completed: null,
        reason: 'invalidDeltaTime',
      });
    }
    const zero = advanceTechnology(started.state, 0);
    expect(zero.ok).toBe(true);
    expect(zero.state).toEqual(started.state);
  });

  it('取消仅退款一次，金额为基础成本的 75%', () => {
    const started = startTechnology(createTechnologyTeamState(), 'compositeArmor', 2_000);
    expect(started.credits).toBe(800);
    const snapshot = structuredClone(started.state);
    const cancelled = cancelTechnology(started.state, started.credits);
    const expectedRefund = TECHNOLOGY_DEFS.compositeArmor.cost * TECHNOLOGY_CANCEL_REFUND_RATIO;

    expect(cancelled).toMatchObject({
      ok: true,
      credits: 800 + expectedRefund,
      creditDelta: expectedRefund,
      reason: null,
    });
    expect(cancelled.state).toEqual({ completed: [], current: null });
    expect(started.state).toEqual(snapshot);
    expect(cancelTechnology(cancelled.state, cancelled.credits)).toMatchObject({
      ok: false,
      credits: cancelled.credits,
      creditDelta: 0,
      reason: 'noActiveResearch',
    });
  });

  it('三项完成效果分别为 1.2、1.15、1.35，研究中不生效', () => {
    let state: TechnologyTeamState = createTechnologyTeamState();
    let credits = 10_000;
    for (const kind of TECHNOLOGY_KINDS) {
      const started = startTechnology(state, kind, credits);
      expect(started.ok).toBe(true);
      credits = started.credits;
      const completed = advanceTechnology(started.state, TECHNOLOGY_DEFS[kind].durationSeconds);
      expect(completed.completed).toBe(kind);
      state = completed.state;
    }
    expect(getTechnologyEffects(state)).toEqual({
      resourceIncomeMultiplier: 1.2,
      maxHealthMultiplier: 1.15,
      radarRangeMultiplier: 1.35,
    });

    const onlyResearching = startTechnology(createTechnologyTeamState(), 'efficientRefining', 800);
    expect(getTechnologyEffects(onlyResearching.state).resourceIncomeMultiplier).toBe(1);
  });

  it('相同输入序列以及不同 dt 分块得到确定性一致状态', () => {
    const start = (): TechnologyTeamState =>
      startTechnology(createTechnologyTeamState(), 'signalAmplifier', 3_000).state;
    const direct = advanceTechnology(start(), 0.3).state;
    const firstChunk = advanceTechnology(start(), 0.1).state;
    const chunked = advanceTechnology(firstChunk, 0.2).state;

    expect(chunked).toEqual(direct);
    expect(JSON.stringify(chunked)).toBe(JSON.stringify(direct));

    const run = (kind: TechnologyKind): TechnologyTeamState => {
      const started = startTechnology(createTechnologyTeamState(), kind, 3_000);
      return advanceTechnology(started.state, TECHNOLOGY_DEFS[kind].durationSeconds).state;
    };
    expect(run('compositeArmor')).toEqual(run('compositeArmor'));
  });
});
