import { describe, expect, it } from 'vitest';

import {
  CONSTRUCTION_PRESENTATION_POLICY,
  constructionPresentationBudget,
  constructionProgressAdvanced,
  constructionScanPulse,
  constructionStagePresentation,
  shouldBatchConstructionPresentation,
} from './scene';

describe('three-stage construction presentation', () => {
  it('locks the foundation, frame, shell, and completion boundaries', () => {
    expect(constructionStagePresentation(0).stage).toBe('foundation');
    expect(constructionStagePresentation(CONSTRUCTION_PRESENTATION_POLICY.foundationEnd - 0.0001).stage)
      .toBe('foundation');
    expect(constructionStagePresentation(CONSTRUCTION_PRESENTATION_POLICY.foundationEnd).stage).toBe('frame');
    expect(constructionStagePresentation(CONSTRUCTION_PRESENTATION_POLICY.frameEnd - 0.0001).stage).toBe('frame');
    expect(constructionStagePresentation(CONSTRUCTION_PRESENTATION_POLICY.frameEnd).stage).toBe('shell');
    expect(constructionStagePresentation(CONSTRUCTION_PRESENTATION_POLICY.completeAt - 0.0001).stage).toBe('shell');
    expect(constructionStagePresentation(CONSTRUCTION_PRESENTATION_POLICY.completeAt).stage).toBe('complete');
  });

  it('never vertically compresses the authored building body', () => {
    for (const progress of [0, 0.1, 0.28, 0.5, 0.64, 0.9, 0.995, 1]) {
      expect(constructionStagePresentation(progress).bodyScaleY).toBe(1);
    }
    expect(constructionStagePresentation(0.5).bodyVisible).toBe(false);
    expect(constructionStagePresentation(0.68).bodyVisible).toBe(true);
    expect(constructionStagePresentation(1).bodyVisible).toBe(true);
  });

  it('uses additive stage semantics and releases all overlays on completion', () => {
    expect(constructionStagePresentation(0.12)).toMatchObject({
      foundationVisible: true,
      frameVisible: false,
      shellVisible: false,
    });
    expect(constructionStagePresentation(0.46)).toMatchObject({
      foundationVisible: true,
      frameVisible: true,
      shellVisible: false,
    });
    expect(constructionStagePresentation(0.8)).toMatchObject({
      foundationVisible: true,
      frameVisible: true,
      shellVisible: true,
    });
    expect(constructionStagePresentation(1)).toMatchObject({
      foundationVisible: false,
      frameVisible: false,
      shellVisible: false,
    });
    expect(shouldBatchConstructionPresentation('frame', true, -1)).toBe(true);
    expect(shouldBatchConstructionPresentation('frame', false, -1)).toBe(false);
    expect(shouldBatchConstructionPresentation('frame', true, 0)).toBe(false);
    expect(shouldBatchConstructionPresentation('complete', true, -1)).toBe(false);
  });

  it('wakes the scan only for real forward authoritative progress', () => {
    expect(constructionProgressAdvanced(0.2, 0.21)).toBe(true);
    expect(constructionProgressAdvanced(0.21, 0.21)).toBe(false);
    expect(constructionProgressAdvanced(0.21, 0.2)).toBe(false);
    expect(constructionProgressAdvanced(0.99, 1)).toBe(false);
    expect(constructionProgressAdvanced(Number.NaN, 0.3)).toBe(false);
  });

  it('keeps a static reduced-motion scan equivalent', () => {
    expect(constructionScanPulse(false, false, 1, 0.3)).toBe(0);
    expect(constructionScanPulse(true, true, 1, 0.3)).toBe(1);
    expect(constructionScanPulse(true, false, 1, 0.3)).not.toBe(1);
  });

  it('stays within the six-site draw-call, triangle, and texture budget', () => {
    const budget = constructionPresentationBudget(6);
    expect(budget.drawCalls).toBeLessThanOrEqual(4);
    expect(budget.visibleTrianglesUpperBound).toBeLessThanOrEqual(2_000);
    expect(budget.textures).toBe(0);
    expect(CONSTRUCTION_PRESENTATION_POLICY.siteCapacity).toBeGreaterThanOrEqual(14);
    expect(constructionPresentationBudget(0)).toEqual({
      drawCalls: 0,
      visibleTrianglesUpperBound: 0,
      textures: 0,
    });
  });
});
