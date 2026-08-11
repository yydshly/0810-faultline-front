import { describe, expect, it } from 'vitest';

import {
  VISUAL_GOLD_GROUND_DRESSING,
  visualGoldGroundDressingMetrics,
  type VisualGoldGroundInstance,
} from './scene';

function endpoints(instance: Readonly<VisualGoldGroundInstance>): readonly [readonly [number, number], readonly [number, number]] {
  const halfLength = instance.depth * 0.5;
  const dx = Math.sin(instance.rotation) * halfLength;
  const dz = Math.cos(instance.rotation) * halfLength;
  return [
    [instance.x - dx, instance.z - dz],
    [instance.x + dx, instance.z + dz],
  ];
}

function distance(left: readonly [number, number], right: readonly [number, number]): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}

describe('visual gold ground dressing contract', () => {
  it('stays visual-only, flat and inside the fixed desktop render budget', () => {
    const metrics = visualGoldGroundDressingMetrics();

    expect(metrics.drawCalls).toBe(6);
    expect(metrics.instanceCount).toBe(49);
    expect(metrics.visibleTrianglesUpperBound).toBe(720);
    expect(metrics.visibleTrianglesUpperBound).toBeLessThanOrEqual(5_000);
    expect(metrics.maxY).toBeLessThanOrEqual(0.015);
    expect(VISUAL_GOLD_GROUND_DRESSING.every((batch) => batch.collision === 'none')).toBe(true);
    expect(VISUAL_GOLD_GROUND_DRESSING.every((batch) => batch.navigation === 'none')).toBe(true);
  });

  it('uses stable unique fixture names for each semantic layer and instance', () => {
    const expectedLayers = [
      'visual-gold-review-service-aprons',
      'visual-gold-review-entrance-route',
      'visual-gold-review-route-shoulders',
      'visual-gold-review-service-wear-and-oil',
      'visual-gold-review-player-corner-markers',
      'visual-gold-review-wayfinding-tabs',
    ];
    const batchIds = VISUAL_GOLD_GROUND_DRESSING.map((batch) => batch.id);
    const instanceIds = VISUAL_GOLD_GROUND_DRESSING.flatMap((batch) => batch.instances.map((instance) => instance.id));

    expect(batchIds).toEqual(expectedLayers);
    expect(new Set(batchIds).size).toBe(batchIds.length);
    expect(new Set(instanceIds).size).toBe(instanceIds.length);
    expect(instanceIds.every((id) => id.startsWith('visual-gold-'))).toBe(true);
    expect(VISUAL_GOLD_GROUND_DRESSING.map((batch) => batch.purpose)).toEqual([
      'service-apron',
      'entrance-route',
      'route-shoulder',
      'surface-wear',
      'faction-marking',
      'wayfinding-landmark',
    ]);
  });

  it('keeps both authored entrances continuously connected to one outbound service road', () => {
    const route = VISUAL_GOLD_GROUND_DRESSING.find((batch) => batch.purpose === 'entrance-route');
    expect(route).toBeDefined();
    const byId = new Map(route?.instances.map((instance) => [instance.id, instance]));
    const hqThroat = byId.get('visual-gold-hq-throat');
    const hqMerge = byId.get('visual-gold-hq-merge');
    const factoryThroat = byId.get('visual-gold-factory-throat');
    const factoryMerge = byId.get('visual-gold-factory-merge');
    const outbound = byId.get('visual-gold-outbound-spine');
    expect(hqThroat && hqMerge && factoryThroat && factoryMerge && outbound).toBeTruthy();
    if (!hqThroat || !hqMerge || !factoryThroat || !factoryMerge || !outbound) return;

    expect(distance(endpoints(hqThroat)[1], endpoints(hqMerge)[0])).toBeLessThan(0.1);
    expect(distance(endpoints(factoryThroat)[1], endpoints(factoryMerge)[0])).toBeLessThan(0.1);
    expect(distance(endpoints(hqMerge)[1], endpoints(outbound)[0])).toBeLessThan(0.1);
    expect(distance(endpoints(factoryMerge)[1], endpoints(outbound)[0])).toBeLessThan(0.1);
  });
});
