import { describe, expect, it } from 'vitest';

import {
  replayFixtureLoadError,
  shouldHideReviewPresentationBlocker,
  shouldHideReviewPresentationEntity,
} from './review-presentation';

describe('focused review presentation boundaries', () => {
  it('hides only the logical buildings owned by each focused vehicle review', () => {
    expect(shouldHideReviewPresentationEntity(
      'enemy-vehicle-socket-review',
      'b-enemy-socket-suppressor-target',
    )).toBe(true);
    expect(shouldHideReviewPresentationEntity(
      'combat-vehicle-family-review',
      'b-combat-vehicle-family-player-hq-anchor',
    )).toBe(true);
    expect(shouldHideReviewPresentationEntity(
      'combat-vehicle-family-review',
      'u-combat-vehicle-family-player-scout',
    )).toBe(false);
    expect(shouldHideReviewPresentationEntity(
      'default',
      'b-enemy-socket-suppressor-target',
    )).toBe(false);
  });

  it('hides the vision divider only inside its owning review fixture', () => {
    const divider = 'blocker-combat-vehicle-family-vision-divider';
    expect(shouldHideReviewPresentationBlocker('combat-vehicle-family-review', divider)).toBe(true);
    expect(shouldHideReviewPresentationBlocker('default', divider)).toBe(false);
  });
});

describe('saved fixture compatibility', () => {
  it('accepts only the currently active fixture', () => {
    expect(replayFixtureLoadError('default', 'default')).toBeNull();
    const mismatch = replayFixtureLoadError('combat-vehicle-family-review', 'default');
    expect(mismatch).toContain('存档场景');
    expect(mismatch).toContain('当前场景');
    expect(mismatch).toContain('default');
  });
});
