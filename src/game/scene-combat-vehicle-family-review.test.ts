import { describe, expect, it } from 'vitest';

import {
  COMBAT_VEHICLE_FAMILY_REVIEW_ENTITY_IDS,
  combatVehicleFamilyReviewMetrics,
  shouldHideCombatVehicleFamilyReviewBlocker,
  shouldHideCombatVehicleFamilyReviewEntity,
  type CombatVehicleFamilyReviewEntry,
} from './scene';

const entries = (): CombatVehicleFamilyReviewEntry[] => [
  ['player', 'scout'], ['player', 'suppressor'], ['player', 'artillery'],
  ['enemy', 'scout'], ['enemy', 'suppressor'], ['enemy', 'artillery'],
].map(([team, kind]) => ({
  id: `u-combat-vehicle-family-${team}-${kind}`,
  modelKey: `unit:${team}:${kind}:authored-v1`,
  team: team as 'player' | 'enemy',
  unitKind: kind as 'scout' | 'suppressor' | 'artillery',
}));

describe('combat vehicle family review presentation policy', () => {
  it('reports all six authored contracts and the complete faction and role matrix', () => {
    expect(COMBAT_VEHICLE_FAMILY_REVIEW_ENTITY_IDS).toHaveLength(6);
    expect(combatVehicleFamilyReviewMetrics(entries())).toEqual({
      entities: 6,
      contracts: 6,
      fallbacks: 0,
      player: 3,
      enemy: 3,
      scout: 2,
      suppressor: 2,
      artillery: 2,
    });
  });

  it('reports an imported-model fallback without counting unrelated visuals', () => {
    const reviewEntries = entries();
    const first = reviewEntries[0];
    if (first) first.modelKey = 'unit:player:scout';
    reviewEntries.push({ id: 'u-unrelated', modelKey: 'unit:player:tank:authored-v1', team: 'player', unitKind: 'tank' });
    expect(combatVehicleFamilyReviewMetrics(reviewEntries)).toMatchObject({
      entities: 6,
      contracts: 5,
      fallbacks: 1,
    });
  });

  it('hides only the off-frame HQ anchors and the non-walkable vision divider', () => {
    expect(shouldHideCombatVehicleFamilyReviewEntity(
      'combat-vehicle-family-review',
      'b-combat-vehicle-family-player-hq-anchor',
    )).toBe(true);
    expect(shouldHideCombatVehicleFamilyReviewEntity(
      'combat-vehicle-family-review',
      'u-combat-vehicle-family-player-scout',
    )).toBe(false);
    expect(shouldHideCombatVehicleFamilyReviewBlocker(
      'combat-vehicle-family-review',
      'blocker-combat-vehicle-family-vision-divider',
    )).toBe(true);
    expect(shouldHideCombatVehicleFamilyReviewBlocker('default', 'blocker-combat-vehicle-family-vision-divider'))
      .toBe(false);
  });
});
