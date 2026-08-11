import { describe, expect, it } from 'vitest';

import {
  isInfrastructureReviewFixture,
  shouldHideInfrastructureReviewAttacker,
} from './scene';

describe('infrastructure review presentation policy', () => {
  it('treats both faction review fixtures as fog-free infrastructure comparisons', () => {
    expect(isInfrastructureReviewFixture('enemy-infrastructure-review')).toBe(true);
    expect(isInfrastructureReviewFixture('player-infrastructure-review')).toBe(true);
    expect(isInfrastructureReviewFixture('building-damage-review')).toBe(false);
  });

  it('hides only the fixture-owned off-frame artillery event drivers', () => {
    expect(shouldHideInfrastructureReviewAttacker(
      'player-infrastructure-review',
      'u-player-infra-barracks-attacker',
    )).toBe(true);
    expect(shouldHideInfrastructureReviewAttacker(
      'player-infrastructure-review',
      'u-enemy-infra-barracks-attacker',
    )).toBe(false);
    expect(shouldHideInfrastructureReviewAttacker(
      'enemy-infrastructure-review',
      'u-enemy-infra-reactor-attacker',
    )).toBe(true);
    expect(shouldHideInfrastructureReviewAttacker('default', 'u-player-infra-reactor-attacker')).toBe(false);
  });
});
