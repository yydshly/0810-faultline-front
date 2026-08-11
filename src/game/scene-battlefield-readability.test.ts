import { describe, expect, it } from 'vitest';

import {
  BREAKTHROUGH_DEFENSE_MARKERS,
  BREAKTHROUGH_DEFENSE_MARKER_PRESENTATION,
  CONTACT_SHADOW_PRESENTATION,
  FOG_EDGE_POLICY,
  GROUP_SELECTION_RING_POLICY,
  fogDisplayPixel,
  fogVisibleEdgeRing,
  resolveBeaconPresentationPolicy,
  resolveSelectionRingPresentation,
} from './scene';

describe('battlefield fog display policy', () => {
  it('keeps visible, explored and deep-unknown meanings stable at 64x64', () => {
    expect(FOG_EDGE_POLICY.version).toBe('soft-edge-v2');
    expect(FOG_EDGE_POLICY.textureSize).toBe(64);
    expect(fogDisplayPixel('visible', 0)).toEqual([0, 0, 0, 0]);
    expect(fogDisplayPixel('explored', 3)).toEqual([11, 20, 24, 120]);
    expect(fogDisplayPixel('unknown', 3)).toEqual([7, 14, 18, 218]);
  });

  it('adds two deterministic alpha rings without mutating the sampled mask', () => {
    const width = 7;
    const height = 7;
    const visible = new Uint8Array(width * height);
    visible[3 * width + 3] = 1;
    const before = [...visible];

    expect(fogVisibleEdgeRing(visible, width, height, 3, 3)).toBe(0);
    expect(fogVisibleEdgeRing(visible, width, height, 4, 3)).toBe(1);
    expect(fogVisibleEdgeRing(visible, width, height, 5, 3)).toBe(2);
    expect(fogVisibleEdgeRing(visible, width, height, 6, 3)).toBe(3);
    expect(fogDisplayPixel('unknown', 1)[3]).toBeLessThanOrEqual(80);
    expect(fogDisplayPixel('unknown', 2)[3]).toBeLessThanOrEqual(150);
    expect(fogDisplayPixel('unknown', 3)[3]).toBe(218);
    expect([...visible]).toEqual(before);
  });

  it('softens explored edges while retaining their distinct base alpha', () => {
    expect(fogDisplayPixel('explored', 1)[3]).toBe(52);
    expect(fogDisplayPixel('explored', 2)[3]).toBe(92);
    expect(fogDisplayPixel('explored', 3)[3]).toBe(120);
  });
});

describe('selection and objective readability policy', () => {
  it('uses a shared narrow low-alpha ring only for selections of six or more', () => {
    const single = resolveSelectionRingPresentation(1);
    const squad = resolveSelectionRingPresentation(5);
    const group = resolveSelectionRingPresentation(6);

    expect(single).toEqual({ compact: false, innerRadius: 0.79, opacity: 0.9 });
    expect(squad).toEqual(single);
    expect(group.compact).toBe(true);
    expect(group.innerRadius).toBeGreaterThanOrEqual(0.9);
    expect(group.opacity).toBeLessThanOrEqual(0.6);
    expect(GROUP_SELECTION_RING_POLICY.minimumGroupSize).toBe(6);
  });

  it('suppresses only the locked breakthrough control ring and preserves its signal', () => {
    expect(resolveBeaconPresentationPolicy('breakthrough-demo', { unlocked: false })).toEqual({
      controlRingVisible: false,
      signalVisible: true,
      signalDimmed: true,
    });
    expect(resolveBeaconPresentationPolicy('breakthrough-demo-reduced', { unlocked: true })).toEqual({
      controlRingVisible: true,
      signalVisible: true,
      signalDimmed: false,
    });
    expect(resolveBeaconPresentationPolicy('default', { unlocked: false })).toEqual({
      controlRingVisible: true,
      signalVisible: false,
      signalDimmed: false,
    });
  });

  it('keeps defense anchors fixed while reducing them to narrow passive markers', () => {
    expect(BREAKTHROUGH_DEFENSE_MARKERS).toEqual([
      { id: 'breakthrough-defense-west', x: 9, z: -22, radius: 3.9 },
      { id: 'breakthrough-defense-east', x: 23, z: -23, radius: 4.7 },
    ]);
    expect(BREAKTHROUGH_DEFENSE_MARKER_PRESENTATION.innerRadius).toBeGreaterThanOrEqual(0.9);
    expect(BREAKTHROUGH_DEFENSE_MARKER_PRESENTATION.opacity).toBeLessThanOrEqual(0.18);
  });

  it('keeps contact shadows texture-free and compact', () => {
    expect(CONTACT_SHADOW_PRESENTATION).toMatchObject({ opacity: 0.22, scale: 0.84 });
  });
});
