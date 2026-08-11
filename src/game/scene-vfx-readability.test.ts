import { describe, expect, it } from 'vitest';

import {
  COMBAT_VFX_READABILITY_V2,
  combatVfxCap,
  effectBudgetSurvivorIndices,
  impactVfxLayerMetrics,
  impactVisualProfile,
  resolvedImpactVfxDuration,
  type EffectBudgetEntry,
} from './scene';

describe('heavy impact readability v2', () => {
  it('publishes the tightened quality and reduced-motion caps', () => {
    expect(COMBAT_VFX_READABILITY_V2.version).toBe('heavy-impact-v2');
    expect(['low', 'medium', 'high'].map((quality) => (
      combatVfxCap('heavy-explosion', quality as 'low' | 'medium' | 'high', false)
    ))).toEqual([2, 3, 4]);
    expect(combatVfxCap('heavy-explosion', 'low', true)).toBeLessThanOrEqual(2);
    expect(combatVfxCap('heavy-explosion', 'medium', true)).toBeLessThanOrEqual(2);
    expect(combatVfxCap('heavy-explosion', 'high', true)).toBeLessThanOrEqual(2);
    expect(COMBAT_VFX_READABILITY_V2.heavy.shockwaveOpacity).toBeGreaterThanOrEqual(0.25);
    expect(COMBAT_VFX_READABILITY_V2.heavy.shockwaveOpacity).toBeLessThanOrEqual(0.35);
  });

  it('bounds every heavy contact ring and shockwave in world metres', () => {
    for (const size of [1.55, 2.2, 3.15, 99]) {
      for (let step = 0; step <= 20; step += 1) {
        const layers = impactVfxLayerMetrics('heavy', size, step / 20);
        expect(layers.ringRadius).toBeLessThanOrEqual(COMBAT_VFX_READABILITY_V2.heavy.maxContactRingRadius);
        expect(layers.shockwaveRadius).toBeLessThanOrEqual(COMBAT_VFX_READABILITY_V2.heavy.maxShockwaveRadius);
      }
    }
    const largestProfile = 3.15;
    const desktopPixelsPerMetre = 900 / 48;
    const finalLayers = impactVfxLayerMetrics('heavy', largestProfile, 1);
    expect(impactVfxLayerMetrics('heavy', largestProfile, 0.5, finalLayers)).toBe(finalLayers);
    impactVfxLayerMetrics('heavy', largestProfile, 1, finalLayers);
    expect(finalLayers.ringRadius * 2 * desktopPixelsPerMetre).toBeLessThanOrEqual(85);
    expect(finalLayers.shockwaveRadius * 2 * desktopPixelsPerMetre).toBeLessThanOrEqual(85);
  });

  it('retains the original ballistic scaling while separating heavy hierarchy', () => {
    const ballisticStart = impactVfxLayerMetrics('ballistic', 1, 0);
    const ballisticEnd = impactVfxLayerMetrics('ballistic', 1, 1);
    expect(ballisticStart).toMatchObject({
      ringRadius: 0.45,
      shockwaveRadius: 0,
      flashScale: 0.8,
      fireScale: 0.68,
      groundFlashScale: 0.55,
    });
    expect(ballisticEnd).toMatchObject({
      ringRadius: 1.7,
      shockwaveRadius: 0,
      flashScale: 1.5,
      groundFlashScale: 2,
    });
    expect(ballisticEnd.fireScale).toBeCloseTo(1.16);

    const largestBallisticContact = impactVfxLayerMetrics('ballistic', 1.12, 0);
    const smallestHeavyContact = impactVfxLayerMetrics('heavy', 1.55, 0);
    expect(smallestHeavyContact.groundFlashRadius ** 2)
      .toBeGreaterThanOrEqual(largestBallisticContact.groundFlashRadius ** 2 * 1.25);
    expect(smallestHeavyContact.upperExtent)
      .toBeGreaterThanOrEqual(largestBallisticContact.upperExtent * 1.25);
  });

  it('limits the main heavy flash and ring lifetime without shortening ballistic contacts', () => {
    const shell = impactVisualProfile(3.2, 190, true);
    expect(shell.duration).toBeGreaterThanOrEqual(0.58);
    expect(shell.duration).toBeLessThanOrEqual(0.62);
    expect(resolvedImpactVfxDuration('heavy', 0.88, false)).toBe(0.6);
    expect(resolvedImpactVfxDuration('heavy', 0.88, true)).toBe(0.18);
    expect(resolvedImpactVfxDuration('ballistic', 0.34, false)).toBe(0.34);
  });

  it('crops oldest overlap while preserving the newest readable contacts', () => {
    const entries: EffectBudgetEntry[] = Array.from({ length: 7 }, () => ({
      kind: 'heavy-explosion' as const,
      decorative: false,
    }));
    expect(effectBudgetSurvivorIndices(entries, 'high', false)).toEqual([3, 4, 5, 6]);
    expect(effectBudgetSurvivorIndices(entries, 'medium', false)).toEqual([4, 5, 6]);
    expect(effectBudgetSurvivorIndices(entries, 'low', false)).toEqual([5, 6]);
    expect(effectBudgetSurvivorIndices(entries, 'high', true)).toEqual([5, 6]);
  });
});
