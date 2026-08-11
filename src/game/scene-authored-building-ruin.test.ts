import { describe, expect, it } from 'vitest';

import {
  AUTHORED_BUILDING_RUIN_POLICY,
  authoredBuildingDamageRole,
  authoredBuildingDamageVisibility,
  authoredBuildingRuinLifetime,
  authoredWreckSurvivorIds,
  isAuthoredBuildingRuinRoot,
  shouldShowPersistentFactionMarker,
  shouldUseAuthoredBuildingRuin,
} from './scene';

describe('authored building damage and ruin presentation', () => {
  it('accepts barracks and reactor damage roles without asset-specific runtime branches', () => {
    expect(authoredBuildingDamageRole('damage_visual_damaged', undefined)).toBe('damaged');
    expect(authoredBuildingDamageRole('damage_visual_critical', undefined)).toBe('critical');
    expect(authoredBuildingDamageVisibility('damaged')).toEqual({ damaged: true, critical: false });
    expect(authoredBuildingDamageVisibility('critical')).toEqual({ damaged: false, critical: true });
  });

  it('recognizes the stable root and both accepted semantic role spellings', () => {
    expect(isAuthoredBuildingRuinRoot('ruin_visual_root', undefined)).toBe(true);
    expect(isAuthoredBuildingRuinRoot('renamed', 'building_ruin')).toBe(true);
    expect(isAuthoredBuildingRuinRoot('renamed', 'building_ruin_visual')).toBe(true);
    expect(isAuthoredBuildingRuinRoot('damage_visual_critical', 'building_damage_critical')).toBe(false);
  });

  it('enables authored ruins for contracted core and infrastructure kinds only when a root exists', () => {
    expect(shouldUseAuthoredBuildingRuin('hq', true)).toBe(true);
    expect(shouldUseAuthoredBuildingRuin('factory', true)).toBe(true);
    expect(shouldUseAuthoredBuildingRuin('barracks', true)).toBe(true);
    expect(shouldUseAuthoredBuildingRuin('reactor', true)).toBe(true);
    expect(shouldUseAuthoredBuildingRuin('refinery', true)).toBe(false);
    expect(shouldUseAuthoredBuildingRuin('hq', false)).toBe(false);
    expect(shouldUseAuthoredBuildingRuin('barracks', false)).toBe(false);
    expect(shouldUseAuthoredBuildingRuin('reactor', false)).toBe(false);
    expect(shouldUseAuthoredBuildingRuin(null, true)).toBe(false);
    expect(AUTHORED_BUILDING_RUIN_POLICY.buildingKinds).toEqual([
      'hq',
      'factory',
      'barracks',
      'reactor',
    ]);
    expect(AUTHORED_BUILDING_RUIN_POLICY.version).toBe('authored-building-ruin-v2');
  });

  it('uses the same desktop and low-motion persistence envelope as vehicle wrecks', () => {
    expect(authoredBuildingRuinLifetime('high', false)).toBe(34);
    expect(authoredBuildingRuinLifetime('medium', false)).toBe(34);
    expect(authoredBuildingRuinLifetime('low', false)).toBe(14);
    expect(authoredBuildingRuinLifetime('high', true)).toBe(14);
  });

  it('keeps own low markers while enemy ruin markers remain fog-safe', () => {
    expect(shouldShowPersistentFactionMarker('player', true, false)).toBe(true);
    expect(shouldShowPersistentFactionMarker('enemy', true, false)).toBe(false);
    expect(shouldShowPersistentFactionMarker('enemy', true, true)).toBe(true);
    expect(shouldShowPersistentFactionMarker('enemy', false, false)).toBe(true);
  });

  it('shares deterministic newest-first survivor selection with vehicle wrecks', () => {
    const persistentResidues = [
      { id: 'vehicle-old', activationOrder: 1 },
      { id: 'building-new', activationOrder: 5 },
      { id: 'vehicle-new', activationOrder: 5 },
      { id: 'building-mid', activationOrder: 3 },
    ];
    expect(authoredWreckSurvivorIds(persistentResidues, 2)).toEqual(['building-new', 'vehicle-new']);
  });
});
