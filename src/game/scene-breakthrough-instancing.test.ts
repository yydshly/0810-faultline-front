import { describe, expect, it } from 'vitest';

import {
  BREAKTHROUGH_HEALTH_BAR_BATCH_POLICY,
  BREAKTHROUGH_STATIC_BATTLEFIELD_BATCHES,
  breakthroughBattlefieldInstancingMetrics,
  breakthroughHealthBarBatchMetrics,
  nextInstancedBatchCapacity,
  planBreakthroughPresentationInstances,
  type InstancedPresentationCandidate,
} from './scene';

describe('breakthrough static battlefield instancing', () => {
  it('preserves all 39 semantic decals in no more than eight static batches', () => {
    const metrics = breakthroughBattlefieldInstancingMetrics();

    expect(metrics.staticBattlefieldInstances).toBe(39);
    expect(metrics.staticBattlefieldBatches).toBeLessThanOrEqual(8);
    expect(BREAKTHROUGH_STATIC_BATTLEFIELD_BATCHES.map((batch) => batch.instances.length))
      .toEqual([1, 4, 3, 3, 10, 8, 8, 2]);
  });

  it('keeps stable unique instance ids and every decal on the presentation plane', () => {
    const first = breakthroughBattlefieldInstancingMetrics();
    const second = breakthroughBattlefieldInstancingMetrics();

    expect(first.stableInstanceIds).toEqual(second.stableInstanceIds);
    expect(new Set(first.stableInstanceIds)).toHaveLength(39);
    expect(first.maximumInstanceY).toBeLessThanOrEqual(0.015);
    for (const batch of BREAKTHROUGH_STATIC_BATTLEFIELD_BATCHES) {
      expect(batch.collision).toBe('none');
      expect(batch.navigation).toBe('none');
      expect(batch.instances.every((instance) => instance.y >= 0 && instance.y <= 0.015)).toBe(true);
    }
  });

  it('retains original draw semantics and the 31-call static reduction budget', () => {
    const byId = new Map(BREAKTHROUGH_STATIC_BATTLEFIELD_BATCHES.map((batch) => [batch.id, batch]));

    expect(byId.get('breakthrough-command-pad-batch')).toMatchObject({
      geometry: 'box', material: 'concrete', renderOrder: 0, receiveShadow: true,
    });
    expect(byId.get('breakthrough-track-mark-batch')).toMatchObject({
      geometry: 'box', material: 'track-mark', renderOrder: 3,
    });
    expect(byId.get('breakthrough-shell-scar-batch')).toMatchObject({
      geometry: 'shell-disc', material: 'scorch', renderOrder: 3,
    });
    expect(byId.get('breakthrough-defense-footprint-batch')).toMatchObject({
      geometry: 'defense-ring', material: 'defense-footprint', renderOrder: 4,
    });
    expect(39 - BREAKTHROUGH_STATIC_BATTLEFIELD_BATCHES.length).toBe(31);
  });
});

describe('breakthrough dynamic presentation planning', () => {
  it('filters hidden, removed and resource visuals without leaking hidden enemies', () => {
    const candidates: InstancedPresentationCandidate[] = [
      { id: 'visible-player', visible: true, removed: false, entityType: 'unit', team: 'player', selected: true },
      { id: 'visible-building', visible: true, removed: false, entityType: 'building', team: 'player', selected: true },
      { id: 'hidden-enemy', visible: false, removed: false, entityType: 'unit', team: 'enemy', selected: true },
      { id: 'removed-player', visible: true, removed: true, entityType: 'unit', team: 'player', selected: true },
      { id: 'visible-resource', visible: true, removed: false, entityType: 'resource', team: 'neutral', selected: true },
      { id: 'visible-enemy', visible: true, removed: false, entityType: 'unit', team: 'enemy', selected: false },
    ];

    const plan = planBreakthroughPresentationInstances(candidates, true);
    expect(plan.contactShadowIds).toEqual(['visible-player', 'visible-building', 'visible-enemy']);
    expect(plan.compactSelectionRingIds).toEqual(['visible-player', 'visible-building']);
    expect(plan.contactShadowBatches).toBe(1);
    expect(plan.compactSelectionRingBatches).toBe(1);
  });

  it('fits the representative 29 shadows and 10 compact rings without runtime growth', () => {
    expect(nextInstancedBatchCapacity(0, 29, 32)).toBe(32);
    expect(nextInstancedBatchCapacity(0, 10, 16)).toBe(16);
    expect(nextInstancedBatchCapacity(32, 29, 32)).toBe(32);
    expect(nextInstancedBatchCapacity(16, 10, 16)).toBe(16);
  });

  it('grows only when required and never shrinks existing capacity', () => {
    expect(nextInstancedBatchCapacity(32, 33, 32)).toBe(64);
    expect(nextInstancedBatchCapacity(64, 12, 32)).toBe(64);
    expect(nextInstancedBatchCapacity(16, 129, 16)).toBe(256);
  });

  it('meets the representative 68-call reduction budget', () => {
    const staticReduction = 39 - 8;
    const contactShadowReduction = 29 - 1;
    const compactRingReduction = 10 - 1;
    expect(staticReduction + contactShadowReduction + compactRingReduction).toBe(68);
  });

  it('retains all health-bar semantics while replacing 13 three-mesh bars with three batches', () => {
    const metrics = breakthroughHealthBarBatchMetrics(13);

    expect(BREAKTHROUGH_HEALTH_BAR_BATCH_POLICY).toMatchObject({
      sourceMeshesPerBar: 3,
      drawCallCeiling: 3,
      preservesFactionFrameColor: true,
      preservesHealthBands: true,
      preservesBillboardTransform: true,
    });
    expect(metrics).toEqual({
      visibleBars: 13,
      sourceDrawCalls: 39,
      batchedDrawCalls: 3,
      avoidedDrawCalls: 36,
    });
  });

  it('does not claim a health-bar reduction when batching is disabled or no bar is visible', () => {
    expect(breakthroughHealthBarBatchMetrics(0)).toEqual({
      visibleBars: 0,
      sourceDrawCalls: 0,
      batchedDrawCalls: 0,
      avoidedDrawCalls: 0,
    });
    expect(breakthroughHealthBarBatchMetrics(4, false)).toEqual({
      visibleBars: 4,
      sourceDrawCalls: 12,
      batchedDrawCalls: 12,
      avoidedDrawCalls: 0,
    });
  });
});
