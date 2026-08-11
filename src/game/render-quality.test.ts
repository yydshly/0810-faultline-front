import { describe, expect, it } from 'vitest';

import {
  RENDER_QUALITY_PROFILES,
  chooseAutomaticRenderQuality,
  nextRenderQuality,
  parseRenderQuality,
  resolveRenderQuality,
} from './render-quality';

describe('render quality profiles', () => {
  it('accepts only supported explicit levels', () => {
    expect(parseRenderQuality('low')).toBe('low');
    expect(parseRenderQuality('medium')).toBe('medium');
    expect(parseRenderQuality('high')).toBe('high');
    expect(parseRenderQuality('ultra')).toBeNull();
  });

  it('keeps combat readability budgets while reducing decoration first', () => {
    expect(RENDER_QUALITY_PROFILES.low.maxDecorativeEffects)
      .toBeLessThan(RENDER_QUALITY_PROFILES.medium.maxDecorativeEffects);
    expect(RENDER_QUALITY_PROFILES.medium.maxDecorativeEffects)
      .toBeLessThan(RENDER_QUALITY_PROFILES.high.maxDecorativeEffects);
    expect(RENDER_QUALITY_PROFILES.low.shadows).toBe(false);
    expect(RENDER_QUALITY_PROFILES.high.shadows).toBe(true);
  });

  it('chooses high for a normal desktop viewport', () => {
    expect(chooseAutomaticRenderQuality({ viewportWidth: 1440, devicePixelRatio: 1 })).toBe('high');
  });

  it('chooses medium for tablets and very dense desktop displays', () => {
    expect(chooseAutomaticRenderQuality({ viewportWidth: 1024, devicePixelRatio: 1 })).toBe('medium');
    expect(chooseAutomaticRenderQuality({ viewportWidth: 1440, devicePixelRatio: 2.5 })).toBe('medium');
  });

  it('chooses low for phones and low-memory devices', () => {
    expect(chooseAutomaticRenderQuality({ viewportWidth: 390, devicePixelRatio: 3 })).toBe('low');
    expect(chooseAutomaticRenderQuality({ viewportWidth: 1440, devicePixelRatio: 1, deviceMemory: 4 })).toBe('low');
  });

  it('lets an explicit level override automatic selection', () => {
    expect(resolveRenderQuality('high', { viewportWidth: 390, devicePixelRatio: 3 })).toBe('high');
    expect(resolveRenderQuality('auto', { viewportWidth: 390, devicePixelRatio: 3 })).toBe('low');
  });

  it('cycles through all user-facing levels', () => {
    expect(nextRenderQuality('high')).toBe('medium');
    expect(nextRenderQuality('medium')).toBe('low');
    expect(nextRenderQuality('low')).toBe('high');
  });
});
